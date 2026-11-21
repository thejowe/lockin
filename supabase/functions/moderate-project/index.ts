import { createClient } from 'jsr:@supabase/supabase-js@2';
import { moderateBoardImage } from '../_shared/moderate-board-image.ts';
import { isObjectionable } from '../_shared/profile-content.ts';
import { cleanRetiredProjectMedia } from '../_shared/retired-project-media.mjs';
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
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

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
  const actor = data.user.id;
  const body = await request.json().catch(() => null);
  const projectId = body?.previous?.id ?? body?.draftId ?? crypto.randomUUID();
  if (
    typeof projectId !== 'string' ||
    !uuid.test(projectId) ||
    (body?.matchId != null && (typeof body.matchId !== 'string' || !uuid.test(body.matchId)))
  )
    return response(400, { error: 'invalid' });
  if (
    data.user.is_anonymous &&
    Array.isArray(body?.images) &&
    body.images.some((p: { pending?: string } | null) => p?.pending)
  )
    return response(403, {});

  async function commit(old: Version | null, action: string, values: Record<string, unknown> = {}) {
    const result =
      body.group != null
        ? await admin.rpc('create_moderated_group_project', {
            p_actor: actor,
            p_id: projectId,
            p_group: body.group,
            p_values: values,
          })
        : await admin.rpc('commit_moderated_project', {
            p_actor: actor,
            p_id: projectId,
            p_revision: old?.revision ?? null,
            p_match_id: old ? null : (body.matchId ?? null),
            p_action: action,
            p_values: values,
          });
    const { error } = result;
    if (error && /^(LG00[1-6]|LQ005)$/.test(error.code)) return error.code;
    if (error?.code === 'PJ003') return 'full';
    // The server switch keeps shared photos out of public surfaces (app_config).
    if (error?.code === 'PJ423') return 'photos-locked';
    if (['23505', '42501', 'PJ409'].includes(error?.code ?? '')) return 'conflict';
    if (error) throw error;
    return result.data === false ? 'replayed' : 'saved';
  }

  const result = await handleProject(actor, body, {
    objectionable: isObjectionable,
    async sharedPhotosEnabled() {
      const { data, error } = await admin
        .from('app_config')
        .select('shared_project_photos')
        .maybeSingle();
      if (error) throw error;
      return data?.shared_project_photos === true;
    },
    moderate: moderateBoardImage,
    async find(user: string, id: string) {
      const { data, error } = await projects()
        .select('*,project_authors!inner(user_id),groups!groups_project_id_fkey(admin_id)')
        .eq('project_authors.user_id', user)
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      // Reverse one-to-one embeddings are objects. The SQL commit rechecks
      // admin ownership after moderation under the group's row lock.
      const group = Array.isArray(data?.groups) ? data.groups[0] : data?.groups;
      if (group && group.admin_id !== user) return null;
      return data;
    },
    async change(_user: string, old: Version, action: string) {
      return (await commit(old, action)) === 'saved';
    },
    async save(_user: string, old: Version | null, values: Record<string, unknown>) {
      return commit(old, 'save', values);
    },
    async download(path: string) {
      const { data, error } = await pending.download(path);
      if (error) throw error;
      return new Uint8Array(await data.arrayBuffer());
    },
    async upload(user: string, bytes: Uint8Array, joint: boolean) {
      const folder = joint ? 'shared/' + projectId : user;
      const path = folder + '/project-' + crypto.randomUUID() + '.jpg';
      const { error } = await bucket.upload(path, bytes, {
        contentType: 'image/jpeg',
        cacheControl: joint ? '0' : '3600',
      });
      if (error) throw error;
      return path;
    },
    async discard(paths: string[]) {
      if (!paths.length) return;
      // Every new object is immutable and can be kept only by this project.
      const { data, error } = await projects()
        .select('cover_path,photo_paths')
        .eq('id', projectId)
        .maybeSingle();
      if (error) throw error;
      const used = new Set(data ? [data.cover_path, ...data.photo_paths] : []);
      await removeFiles(paths.filter((p) => !used.has(p)));
    },
    async cleanPending(paths: string[]) {
      if (paths.length) await pending.remove(paths);
    },
    async clearOwnerFiles(user: string) {
      // Shared files use their own namespace and survive deletion of either account.
      // If this account is the last remaining author, remove the detached gallery too.
      const { data: joint, error: lookup } = await projects()
        .select(
          'id,revision,cover_path,photo_paths,project_authors(user_id),groups!groups_project_id_fkey()'
        )
        .eq('owner_id', user)
        .eq('joint', true)
        .is('groups', null);
      if (lookup) throw lookup;
      for (const project of joint) {
        if (project.project_authors.length !== 1 || project.project_authors[0].user_id !== user)
          continue;
        const { error } = await admin.rpc('commit_moderated_project', {
          p_actor: user,
          p_id: project.id,
          p_revision: project.revision,
          p_match_id: null,
          p_action: 'remove',
          p_values: {},
        });
        if (error) throw error;
        await removeFiles([
          ...(project.cover_path ? [project.cover_path] : []),
          ...project.photo_paths,
        ]);
      }
      const { error } = await projects().delete().eq('owner_id', user).eq('joint', false);
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
  await cleanRetiredProjectMedia(admin).catch(() => {});
  return response(result.status, result.body);
}

Deno.serve((request) => handleProjectRequest(request, postProject));
