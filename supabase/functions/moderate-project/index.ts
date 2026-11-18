import { createClient } from 'jsr:@supabase/supabase-js@2';
import { moderateBoardImage } from '../_shared/moderate-board-image.ts';
import { isObjectionable } from '../_shared/profile-content.ts';
import { handleProjectRequest, response } from './http.mjs';
import { handleProject } from './logic.mjs';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } }
);
const bucket = admin.storage.from('board');
const pending = admin.storage.from('avatar-uploads');
type Version = { id: string; revision: string };
const projects = () => admin.from('profile_projects');
async function removeFiles(paths: string[]) {
  if (!paths.length) return;
  const { error } = await bucket.remove(paths);
  if (error) throw error;
}

async function postProject(request: Request) {
  const { data, error } = await admin.auth.getUser(
    request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  );
  if (error || !data.user) return response(401, {});
  const owner = data.user.id;
  const body = await request.json().catch(() => null);
  if (
    data.user.is_anonymous &&
    Array.isArray(body?.images) &&
    body.images.some((p: { pending?: string } | null) => p?.pending)
  )
    return response(403, {});
  const result = await handleProject(owner, body, {
    objectionable: isObjectionable,
    moderate: moderateBoardImage,
    async find(user: string, id: string) {
      const { data, error } = await projects()
        .select('*')
        .eq('owner_id', user)
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    async change(user: string, old: Version, action: string) {
      const query =
        action === 'remove'
          ? projects().delete()
          : projects().update({ promoted_at: new Date().toISOString() });
      const { data, error } = await query
        .eq('owner_id', user)
        .eq('id', old.id)
        .eq('revision', old.revision)
        .select('id');
      if (error) throw error;
      return data.length === 1;
    },
    async save(user: string, old: Version | null, values: Record<string, unknown>) {
      const query = old
        ? projects()
            .update({ ...values, revision: crypto.randomUUID() })
            .eq('owner_id', user)
            .eq('id', old.id)
            .eq('revision', old.revision)
        : projects().insert({ ...values, owner_id: user });
      const { data, error } = await query.select('id');
      if (error?.code === 'PJ003') return 'full';
      if (error?.code === '23505') return 'conflict';
      if (error) throw error;
      return data.length ? 'saved' : 'conflict';
    },
    async download(path: string) {
      const { data, error } = await pending.download(path);
      if (error) throw error;
      return new Uint8Array(await data.arrayBuffer());
    },
    async upload(user: string, bytes: Uint8Array) {
      const path = user + '/project-' + crypto.randomUUID() + '.jpg';
      const { error } = await bucket.upload(path, bytes, { contentType: 'image/jpeg' });
      if (error) throw error;
      return path;
    },
    async discard(paths: string[]) {
      if (!paths.length) return;
      const { data, error } = await projects()
        .select('cover_path,photo_paths')
        .eq('owner_id', owner);
      if (error) throw error;
      const used = new Set(data.flatMap((p) => [p.cover_path, ...p.photo_paths]));
      await removeFiles(paths.filter((p) => !used.has(p)));
    },
    async cleanPending(paths: string[]) {
      if (paths.length) await pending.remove(paths);
    },
    async clearOwnerFiles(user: string) {
      // Include detached images left by an interrupted upload or a failed cleanup.
      const { error } = await projects().delete().eq('owner_id', user);
      if (error) throw error;
      for (;;) {
        const page = await bucket.list(user, { search: 'project-', limit: 100 });
        if (page.error) throw page.error;
        const paths = page.data
          .filter((file) => /^project-[a-zA-Z0-9-]+\.jpg$/.test(file.name))
          .map((file) => user + '/' + file.name);
        if (!paths.length) break;
        await removeFiles(paths);
      }
    },
  });
  return response(result.status, result.body);
}

Deno.serve((request) => handleProjectRequest(request, postProject));
