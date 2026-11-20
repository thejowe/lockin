import {
  ProjectPhotoError,
  validateProject,
  type ProjectPhoto,
  type ProjectInput,
  type ProjectVersion,
  type Project,
  type JointWorkspace,
  type ProjectRepository,
} from '../projects';
import { GROUP_ERROR_CODES, GroupError } from '../groups';
import { toPremiumError } from './premium';
import type { GroupSettings, Profile } from '../types';
import type { LockInSupabaseClient } from './client';
import type { Database, ProfileRow } from './database.types';
import { toProfile } from './mappers';

import { readLocalImage } from './avatar-file';
import { t } from '@/i18n';

type ProjectRow = Database['public']['Tables']['profile_projects']['Row'] & {
  project_authors: { profiles: ProfileRow | null }[];
};
const fields = '*,project_authors(profiles(*))' as const;

interface SupabaseProjects extends ProjectRepository {
  forGroups(ids: string[]): Promise<Project[]>;
  createForGroup(input: ProjectInput, draftId: string, group: GroupSettings): Promise<void>;
}

export function supabaseProjects(
  getClient: () => LockInSupabaseClient,
  userId: () => Promise<string>,
  signProfiles?: (profiles: Profile[]) => Promise<Profile[]>
): SupabaseProjects {
  async function mutate(body: Record<string, unknown>) {
    const { data, error } = await getClient().functions.invoke('moderate-project', { body });
    if (!error && data?.saved === true) return;
    const details = await error?.context?.json?.().catch(() => null);
    if (Number.isInteger(details?.slot))
      throw new ProjectPhotoError(details.slot, details.error === 'flagged');
    const code = details?.error;
    if (GROUP_ERROR_CODES[code]) throw new GroupError(GROUP_ERROR_CODES[code], code);
    if (code === 'LQ005') throw toPremiumError({ code, message: code });
    if (details?.error === 'full') throw new Error(t('Puedes tener hasta tres proyectos.'));
    if (details?.error === 'conflict')
      throw new Error(t('El proyecto ha cambiado. Vuelve a abrirlo.'));
    throw new Error(t('No se ha podido guardar.'));
  }
  async function hydrate(rows: ProjectRow[]) {
    const client = getClient();
    const paths = rows.flatMap((p) => [...(p.cover_path ? [p.cover_path] : []), ...p.photo_paths]);
    const personal = paths.filter((path) => !path.startsWith('shared/'));
    const bucket = client.storage.from('board');
    const images = new Map<string, ProjectPhoto>();
    if (personal.length) {
      const { data, error } = await bucket.createSignedUrls(personal, 3600);
      if (error) throw error;
      for (const item of data)
        if (item.path && item.signedUrl)
          images.set(item.path, { path: item.path, uri: item.signedUrl });
    }
    if (paths.length > personal.length) {
      const { data, error } = await client.auth.getSession();
      if (error || !data.session) throw new Error(t('No se ha podido cargar la foto.'));
      const apiKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      const headers = {
        ...(apiKey ? { apikey: apiKey } : {}),
        Authorization: 'Bearer ' + data.session.access_token,
      };
      for (const path of paths.filter((p) => p.startsWith('shared/'))) {
        // Build the authenticated object route on the injected client's own Storage origin.
        const url = new URL(bucket.getPublicUrl(path).data.publicUrl);
        url.pathname = url.pathname.replace('/object/public/', '/object/authenticated/');
        images.set(path, { path, uri: url.toString(), headers });
      }
    }
    function photo(path: string) {
      const result = images.get(path);
      if (!result) throw new Error(t('No se ha podido cargar la foto.'));
      return result;
    }
    const profiles = rows.flatMap((p) =>
      p.project_authors.flatMap((a) => (a.profiles ? [toProfile(a.profiles)] : []))
    );
    const signed = new Map(
      (signProfiles ? await signProfiles(profiles) : profiles).map((p) => [
        p.id,
        { id: p.id, name: p.name, avatar: p.avatar },
      ])
    );
    return rows.map((p) => ({
      id: p.id,
      ownerId: p.owner_id,
      revision: p.revision,
      name: p.name,
      tagline: p.tagline,
      description: p.description,
      link: p.link,
      cover: p.cover_path ? photo(p.cover_path) : null,
      photos: p.photo_paths.map(photo),
      authors: p.project_authors.flatMap((a) => (a.profiles ? [signed.get(a.profiles.id)!] : [])),
    }));
  }
  function mutationError(code: string) {
    return new Error(
      code === 'PJ003'
        ? t('Uno de los perfiles ya tiene tres proyectos.')
        : code === 'PJ409'
          ? t('El proyecto ha cambiado. Vuelve a abrirlo.')
          : t('No se ha podido guardar.')
    );
  }
  async function readWorkspace(matchId: string, retry: boolean): Promise<JointWorkspace | null> {
    await userId();
    const client = getClient();
    const workspace = await client.rpc('project_workspace', { p_match_id: matchId }).maybeSingle();
    if (workspace.error) throw workspace.error;
    const w = workspace.data;
    if (!w) return null;
    const { data, error } = await client
      .from('profile_projects')
      .select(fields)
      .eq('id', w.project_id)
      .maybeSingle();
    if (error) throw error;
    if (!data || data.revision !== w.project_revision) {
      // Consent must apply to the exact card revision displayed to the reader.
      if (retry) return readWorkspace(matchId, false);
      throw mutationError('PJ409');
    }
    const [project] = await hydrate([data]);
    return {
      project,
      published: w.published,
      proposedBy: w.proposed_by,
      hasCapacity: w.has_capacity,
      notes: w.notes,
      notesBy: w.notes_by,
      notesRevision: w.notes_revision,
    };
  }
  async function save(
    input: ProjectInput,
    previous?: ProjectVersion,
    draftId?: string,
    matchId?: string,
    group?: GroupSettings
  ) {
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
        matchId,
        ...(group && { group }),
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
  }
  return {
    createForGroup: (input, draftId, group) => save(input, undefined, draftId, undefined, group),
    async forGroups(ids) {
      if (!ids.length) return [];
      const { data, error } = await getClient()
        .from('profile_projects')
        .select(fields)
        .in('id', ids);
      if (error) throw error;
      return hydrate(data);
    },
    async list(ownerId) {
      await userId();
      // The second embedding filters membership without removing the other author's face.
      const { data, error } = await getClient()
        .from('profile_projects')
        .select('*,project_authors(profiles(*)),listed:project_authors!inner()')
        .eq('listed.user_id', ownerId)
        .eq('published', true)
        .order('promoted_at', { ascending: false, nullsFirst: false })
        .order('created_at')
        .order('id');
      if (error) throw error;
      return hydrate(data);
    },
    async workspace(matchId) {
      return readWorkspace(matchId, true);
    },
    async lastDeletion(matchId) {
      await userId();
      const { data, error } = await getClient()
        .from('project_events')
        .select('id,actor_id')
        .eq('match_id', matchId)
        .eq('kind', 'deleted')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data && { id: data.id, actorId: data.actor_id };
    },
    async publication(version, action) {
      await userId();
      const { error } = await getClient().rpc('set_project_publication', {
        p_project_id: version.id,
        p_revision: version.revision,
        p_action: action,
      });
      if (error) throw mutationError(error.code);
    },
    async saveNotes(id, text, revision) {
      await userId();
      const { error } = await getClient().rpc('save_project_notes', {
        p_project_id: id,
        p_text: text,
        p_revision: revision,
      });
      if (error) throw mutationError(error.code);
    },
    save,
    remove: ({ id, revision }) => mutate({ action: 'remove', previous: { id, revision } }),
    promote: ({ id, revision }) => mutate({ action: 'promote', previous: { id, revision } }),
  };
}
