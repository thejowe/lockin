/**
 * Tests del texto que lee la persona cuando falla una operación de cuenta.
 *
 * Hay un caso por cada `AccountErrorReason`, y no por gusto: el mapa entre las
 * razones de `src/data/supabase/auth.ts` y lo que se enseña en pantalla estuvo
 * a medias, y de ahí salía texto inglés de GoTrue y frases escritas para quien
 * programa. Cada caso fija QUÉ ve el usuario con esa razón concreta.
 *
 * Las razones cuyo mensaje ya escribió `auth.ts` para la pantalla se prueban
 * con su texto real, porque lo que se garantiza es que se enseña tal cual y que
 * nadie lo sustituye por un genérico.
 */

import { describeAccountError } from './account-copy';
import { AccountError } from './account-gateway';

import type { AccountErrorReason } from './account-gateway';

/** Lo que dispara `toAccountError` para llegar a cada razón. */
const GOTRUE_ERROR = (code: string) => Object.assign(new Error('Server said no'), { code });

describe('describeAccountError', () => {
  describe('las razones que la capa de datos ya escribió para la pantalla', () => {
    it.each<[AccountErrorReason, string]>([
      ['email-in-use', 'Ese email ya tiene una cuenta de LockIn. Prueba con otro.'],
      [
        'weak-password',
        'Esa contraseña es demasiado fácil de adivinar. Alárgala o mézclala con números.',
      ],
      ['invalid-email', 'Ese email no parece válido. Revísalo.'],
      ['same-password', 'La contraseña nueva tiene que ser distinta de la que ya tenías.'],
      [
        'too-many-emails',
        'Se han mandado demasiados correos a esa dirección. Espera unos minutos y vuelve a intentarlo.',
      ],
      [
        'needs-confirmed-email',
        'Falta confirmar el email: pincha el enlace que te hemos mandado y vuelve aquí.',
      ],
    ])('%s se enseña tal cual', (reason, message) => {
      expect(describeAccountError(new AccountError(reason, message))).toBe(message);
    });
  });

  describe('las razones cuyo mensaje NO es para el usuario', () => {
    it('unrecoverable-account no le habla de `acceptDataLoss`: le dice qué pierde', () => {
      const text = describeAccountError(
        new AccountError(
          'unrecoverable-account',
          'Esta cuenta solo vive en este teléfono: … o pasa acceptDataLoss cuando el usuario ' +
            'ya haya dicho que sí a perderlo todo.'
        )
      );

      expect(text).not.toMatch(/acceptDataLoss/);
      expect(text).toMatch(/solo vive en este teléfono/);
      expect(text).toMatch(/Asegúrala antes con un email/);
    });

    it('no-session dice además qué hacer para volver a tener una', () => {
      const text = describeAccountError(
        new AccountError('no-session', 'No hay ninguna sesión abierta.')
      );

      expect(text).toMatch(/ninguna sesión abierta/);
      expect(text).toMatch(/Cierra LockIn, vuelve a abrirla/);
    });

    it('offline habla de la red, que es lo que hay que distinguir de una contraseña mal puesta', () => {
      const error = Object.assign(new Error('Failed to fetch'), {
        name: 'AuthRetryableFetchError',
      });
      const text = describeAccountError(
        new AccountError('offline', 'No hay conexión con el servidor.', error)
      );

      expect(text).toBe('No hay conexión con el servidor. Comprueba tu red y vuelve a intentarlo.');
      expect(text).not.toMatch(/contraseña/i);
    });
  });

  describe('unknown, que es la razón por defecto y la que traía el inglés', () => {
    it('unas credenciales malas se cuentan en español y sin decir cuál de las dos falló', () => {
      const text = describeAccountError(
        new AccountError(
          'unknown',
          'Invalid login credentials',
          GOTRUE_ERROR('invalid_credentials')
        )
      );

      expect(text).toBe('Email o contraseña incorrectos. Revísalos e inténtalo otra vez.');
      // Ni «ese email no existe» ni «la contraseña no es esa»: eso contaría
      // quién tiene cuenta en LockIn.
      expect(text).not.toMatch(/no existe|no está registrad/i);
    });

    it('cualquier otro fallo del servidor no enseña su texto inglés', () => {
      const text = describeAccountError(
        new AccountError(
          'unknown',
          'Email link is invalid or has expired',
          GOTRUE_ERROR('otp_expired')
        )
      );

      expect(text).toBe('No hemos podido completar la operación. Inténtalo otra vez.');
      expect(text).not.toMatch(/invalid|expired/i);
    });

    it('sin red, aunque la razón sea unknown, se dice que es la red', () => {
      const text = describeAccountError(
        new AccountError(
          'unknown',
          'Network request failed',
          Object.assign(new Error('Network request failed'), { name: 'AuthRetryableFetchError' })
        )
      );

      expect(text).toMatch(/No hay conexión con el servidor/);
    });

    it('lo que `auth.ts` sí escribió en español para la pantalla se respeta', () => {
      // Los dos casos de `completeAuthLink`: van sin `cause` justamente porque
      // el mensaje lo redactó ahí alguien pensando en quien lo va a leer.
      const message = 'El enlace ya no sirve (expired). Pide otro correo e inténtalo de nuevo.';

      expect(describeAccountError(new AccountError('unknown', message))).toBe(message);
    });
  });

  describe('los fallos que nunca llegaron a ser un AccountError', () => {
    it('el `TypeError` de una consulta sin red se cuenta como falta de red', () => {
      // Es el de `repositories.profiles.getCurrent()` en «Ya tengo cuenta»:
      // PostgREST no pasa por `toAccountError` y antes de esto la pantalla
      // enseñaba «Network request failed» donde se espera «no hay cobertura».
      expect(describeAccountError(new TypeError('Network request failed'))).toMatch(
        /No hay conexión con el servidor/
      );
      expect(describeAccountError(new TypeError('Failed to fetch'))).toMatch(
        /No hay conexión con el servidor/
      );
    });

    it('un Error cualquiera no enseña su mensaje: puede ser del servidor y venir en inglés', () => {
      expect(describeAccountError(new Error('relation "profiles" does not exist'))).toBe(
        'No hemos podido completar la operación. Inténtalo otra vez.'
      );
    });

    it('un rechazo que ni siquiera es un Error tampoco deja el hueco en blanco', () => {
      expect(describeAccountError('boom')).toMatch(/No hemos podido completar la operación/);
      expect(describeAccountError(null)).toMatch(/No hemos podido completar la operación/);
      expect(describeAccountError(undefined)).toMatch(/No hemos podido completar la operación/);
    });
  });
});
