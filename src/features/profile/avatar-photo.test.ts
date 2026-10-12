/**
 * Tests del selector de la foto de perfil.
 *
 * El selector y el manipulador son nativos: se sustituyen por dobles. Lo que se
 * prueba es el contrato que usa la pantalla —`picked` / `cancelled` / `denied`—
 * y que la foto que sale es la reducida, no la original.
 */

import * as ImagePicker from 'expo-image-picker';

import { pickAvatarPhoto } from './avatar-photo';

const mockResize = jest.fn();
const mockSave = jest.fn();

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
}));

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: jest.fn(() => {
      const context = {
        resize: (...args: unknown[]) => {
          mockResize(...args);
          return context;
        },
        renderAsync: async () => ({ saveAsync: mockSave }),
      };
      return context;
    }),
  },
}));

const picker = ImagePicker as jest.Mocked<typeof ImagePicker>;
const granted = { granted: true } as never;

const portrait = {
  canceled: false,
  assets: [{ uri: 'file:///grande.jpg', width: 3000, height: 4000 }],
} as never;

describe('pickAvatarPhoto', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSave.mockResolvedValue({ uri: 'file:///reducida.jpg' });
  });

  it('devuelve la foto reducida al elegir de la galería', async () => {
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValue(granted);
    picker.launchImageLibraryAsync.mockResolvedValue(portrait);

    await expect(pickAvatarPhoto('library')).resolves.toEqual({
      status: 'picked',
      uri: 'file:///reducida.jpg',
    });
    // JPEG al 0,8: es lo que acepta el servidor.
    expect(mockSave).toHaveBeenCalledWith({ format: 'jpeg', compress: 0.8 });
  });

  it('reduce por el lado largo: alto en vertical, ancho en horizontal', async () => {
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValue(granted);

    picker.launchImageLibraryAsync.mockResolvedValueOnce(portrait);
    await pickAvatarPhoto('library');
    expect(mockResize).toHaveBeenLastCalledWith({ height: 1080 });

    picker.launchImageLibraryAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file:///ancha.jpg', width: 4000, height: 3000 }],
    } as never);
    await pickAvatarPhoto('library');
    expect(mockResize).toHaveBeenLastCalledWith({ width: 1080 });
  });

  it('la cámara pide su propio permiso y su propio selector', async () => {
    picker.requestCameraPermissionsAsync.mockResolvedValue(granted);
    picker.launchCameraAsync.mockResolvedValue(portrait);

    await expect(pickAvatarPhoto('camera')).resolves.toMatchObject({ status: 'picked' });
    expect(picker.requestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
    expect(picker.launchImageLibraryAsync).not.toHaveBeenCalled();
  });

  it('permiso denegado: status denied, sin abrir el selector', async () => {
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: false } as never);

    await expect(pickAvatarPhoto('library')).resolves.toEqual({ status: 'denied' });
    expect(picker.launchImageLibraryAsync).not.toHaveBeenCalled();
  });

  it('selección cancelada: status cancelled', async () => {
    picker.requestCameraPermissionsAsync.mockResolvedValue(granted);
    picker.launchCameraAsync.mockResolvedValue({ canceled: true, assets: null } as never);

    await expect(pickAvatarPhoto('camera')).resolves.toEqual({ status: 'cancelled' });
    expect(mockSave).not.toHaveBeenCalled();
  });
});
