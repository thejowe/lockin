/**
 * Elegir la foto de perfil y dejarla lista para subir: recorte 4:5 (el de la
 * tarjeta del deck), lado largo ≤ 1080 px y JPEG al 0,8. Una foto de 12 MB del
 * móvil no tiene por qué viajar entera, y el servidor solo acepta JPEG.
 *
 * Esto es comodidad, no seguridad: la validación de verdad (JPEG real, tamaño,
 * moderación) la hace la Edge Function `moderate-avatar`.
 */

import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

export type PickedPhoto =
  { status: 'picked'; uri: string } | { status: 'cancelled' } | { status: 'denied' };

const MAX_LONG_SIDE = 1080;
const JPEG_QUALITY = 0.8;

const OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [4, 5],
  quality: 1,
};

/**
 * `aspect`: el recorte. 4:5 para la foto de perfil (la tarjeta del deck); el
 * tablón usa 1:1 (2026-10-17).
 */
export async function pickAvatarPhoto(
  source: 'library' | 'camera',
  aspect: [number, number] = [4, 5]
): Promise<PickedPhoto> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { status: 'denied' };

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync({ ...OPTIONS, aspect })
      : await ImagePicker.launchImageLibraryAsync({ ...OPTIONS, aspect });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return { status: 'cancelled' };

  const isPortrait = asset.height >= asset.width;
  const rendered = await ImageManipulator.manipulate(asset.uri)
    .resize(isPortrait ? { height: MAX_LONG_SIDE } : { width: MAX_LONG_SIDE })
    .renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });

  return { status: 'picked', uri: saved.uri };
}
