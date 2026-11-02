/**
 * Lee un archivo local y lo devuelve como bytes.
 *
 * Aparte de `avatar.ts` para poder sustituirlo en los tests: `fetch` de una URI
 * `file://` solo existe en el runtime de la app. Solo JPEG: el selector de fotos
 * ya reduce y reencoda la imagen (ver `features/profile/avatar-photo.ts`).
 */
import { t } from '@/i18n';

export async function readLocalImage(
  uri: string
): Promise<{ bytes: ArrayBuffer; contentType: string }> {
  const response = await fetch(uri);
  if (!response.ok) throw new Error(t('No se ha podido leer la foto.'));

  return { bytes: await response.arrayBuffer(), contentType: 'image/jpeg' };
}
