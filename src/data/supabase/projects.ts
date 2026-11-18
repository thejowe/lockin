import {
  ProjectPhotoError,
  validateProject,
  type ProjectPhoto,
  type ProjectRepository,
} from '../projects';
import type { LockInSupabaseClient } from './client';
import { readLocalImage } from './avatar-file';
import { t } from '@/i18n';

export function supabaseProjects(
  getClient: () => LockInSupabaseClient,
  userId: () => Promise<string>
): ProjectRepository {
  async function mutate(body: Record<string, unknown>) {
    const { data, error } = await getClient().functions.invoke('moderate-project', { body });
    if (!error && data?.saved === true) return;
    const details = await error?.context?.json?.().catch(() => null);
    if (Number.isInteger(details?.slot))
      throw new ProjectPhotoError(details.slot, details.error === 'flagged');
    if (details?.error === 'full') throw new Error(t('Puedes tener hasta tres proyectos.'));
    if (details?.error === 'conflict')
      throw new Error(t('El proyecto ha cambiado. Vuelve a abrirlo.'));
    throw new Error(t('No se ha podido guardar.'));
  }
  return {
    async warmUpModeration() {
      await getClient().functions.invoke('moderate-project', { method: 'GET' });
    },
    async list(ownerId) {
      await userId();
      const client = getClient();
      const { data, error } = await client
        .from('profile_projects')
        .select('*')
        .eq('owner_id', ownerId)
        .order('promoted_at', { ascending: false, nullsFirst: false })
        .order('created_at')
        .order('id');
      if (error) throw error;
      const paths = data.flatMap((p) => [
        ...(p.cover_path ? [p.cover_path] : []),
        ...p.photo_paths,
      ]);
      const urls = new Map<string, string>();
      if (paths.length) {
        const signed = await client.storage.from('board').createSignedUrls(paths, 3600);
        if (signed.error) throw signed.error;
        for (const item of signed.data)
          if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
      }
      function photo(path: string) {
        const uri = urls.get(path);
        if (!uri) throw new Error(t('No se ha podido cargar la foto.'));
        return { path, uri };
      }
      return data.map((p) => ({
        id: p.id,
        ownerId: p.owner_id,
        revision: p.revision,
        name: p.name,
        tagline: p.tagline,
        description: p.description,
        link: p.link,
        cover: p.cover_path ? photo(p.cover_path) : null,
        photos: p.photo_paths.map(photo),
      }));
    },
    async save(input, previous, draftId) {
      validateProject(input);
      const owner = await userId();
      const client = getClient();
      const uploaded: string[] = [];
      async function stage(image: ProjectPhoto | null) {
        if (!image) return null;
        if (image.path) return { keep: image.path };
        const { bytes, contentType } = await readLocalImage(image.uri);
        const nonce =
          globalThis.crypto?.randomUUID?.() ??
          Date.now().toString(36) + Math.random().toString(36).slice(2);
        const path = owner + '/' + nonce + '.jpg';
        const { error } = await client.storage
          .from('avatar-uploads')
          .upload(path, bytes, { contentType });
        if (error) throw new Error(t('No se ha podido subir la foto.'));
        uploaded.push(path);
        return { pending: path };
      }
      try {
        const images = [];
        for (const photo of [input.cover, ...input.photos]) images.push(await stage(photo));
        const { name, tagline, description, link } = input;
        await mutate({
          action: 'save',
          draftId,
          previous: previous && { id: previous.id, revision: previous.revision },
          name,
          tagline,
          description,
          link,
          images,
        });
      } finally {
        if (uploaded.length)
          await client.storage
            .from('avatar-uploads')
            .remove(uploaded)
            .catch(() => undefined);
      }
    },
    remove: ({ id, revision }) => mutate({ action: 'remove', previous: { id, revision } }),
    promote: ({ id, revision }) => mutate({ action: 'promote', previous: { id, revision } }),
  };
}
