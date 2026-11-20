// Acknowledge only after Storage has removed the immutable objects. A failed
// acknowledgement is safe to retry, including from a concurrent worker.
export async function cleanRetiredProjectMedia(admin) {
  const { data, error } = await admin.rpc('retired_group_project_media', {});
  if (error) throw error;
  const paths = data.map(({ path }) => path);
  if (!paths.length) return 0;
  const removed = await admin.storage.from('board').remove(paths);
  if (removed.error) throw removed.error;
  const ack = await admin.rpc('retired_group_project_media', { p_removed: paths });
  if (ack.error) throw ack.error;
  return paths.length;
}
