import { MAX_BYTES, isComplete, isJpeg, ownsPath } from '../moderate-avatar/logic.mjs';
import { boardVerdict } from '../moderate-board/logic.mjs';

const failure = (status, error, slot) => ({ status, body: { error, slot } });
const success = { status: 200, body: { saved: true } };
const conflict = failure(409, 'conflict');

export async function handleProject(user, body, deps) {
  const uploads = [];
  const published = [];
  try {
    if (!['save', 'remove', 'promote', 'remove-all'].includes(body?.action))
      return failure(400, 'invalid');
    if (body.action === 'remove-all') {
      await deps.clearOwnerFiles(user);
      return success;
    }
    const old = body.previous ? await deps.find(user, body.previous.id) : null;
    if (body.previous && (!old || old.revision !== body.previous.revision)) return conflict;
    const existing = old ? [old.cover_path, ...old.photo_paths].filter(Boolean) : [];
    if (body.action !== 'save') {
      if (!old) return conflict;
      if (!(await deps.change(user, old, body.action))) return conflict;
      if (body.action === 'remove') await deps.discard(existing).catch(() => {});
      return success;
    }
    const { name, tagline, description, link, images } = body;
    if (
      ![name, tagline].every((s) => typeof s === 'string' && s.trim() && s.length <= 100) ||
      typeof description !== 'string' ||
      description.length > 5000 ||
      [name, tagline, description].some(deps.objectionable) ||
      typeof link !== 'string' ||
      (link && !/^https?:\/\/[^\s]+$/i.test(link)) ||
      !Array.isArray(images) ||
      images.length < 1 ||
      images.length > 6
    )
      return failure(422, 'invalid');

    const paths = [];
    for (const [slot, image] of images.entries()) {
      if (slot === 0 && image === null) {
        paths.push(null);
        continue;
      }
      if (existing.includes(image?.keep)) {
        paths.push(image.keep);
        continue;
      }
      if (!ownsPath(user, image?.pending)) return failure(403, 'invalid-image', slot);
      uploads.push(image.pending);
      const bytes = await deps.download(image.pending).catch(() => null);
      if (!bytes || bytes.length > MAX_BYTES || !isJpeg(bytes))
        return failure(422, 'invalid-image', slot);
      const result = await deps.moderate(bytes, '').catch(() => null);
      if (!isComplete(result)) return failure(503, 'unavailable', slot);
      if (!boardVerdict(result)) return failure(422, 'flagged', slot);
      // Private and unreadable until the complete row commits.
      const path = await deps.upload(user, bytes);
      published.push(path);
      paths.push(path);
    }
    const values = {
      name: name.trim(),
      tagline: tagline.trim(),
      description: description.trim(),
      link,
      cover_path: paths[0],
      photo_paths: paths.slice(1),
    };
    if (!old && body.draftId !== undefined) values.id = body.draftId;
    const outcome = await deps.save(user, old, values);
    if (outcome === 'full') return failure(409, 'full');
    if (outcome !== 'saved') return conflict;
    published.length = 0;
    await deps.discard(existing.filter((path) => !paths.includes(path))).catch(() => {});
    return success;
  } catch {
    return failure(503, 'unavailable');
  } finally {
    await deps.cleanPending(uploads).catch(() => {});
    // Check committed references again in case the database reply was lost.
    await deps.discard(published).catch(() => {});
  }
}
