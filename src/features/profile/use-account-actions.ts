/**
 * Las operaciones de cuenta que comparten `AccountSection` (tab Perfil) y el
 * registro del onboarding (`register-form.tsx`).
 *
 * Asegurar la cuenta es el mismo camino se llegue por donde se llegue —email
 * con `linkEmailToCurrentUser`, contraseña con `setAccountPassword` una vez
 * confirmado el correo—, así que vive aquí una sola vez: quién está ocupado y
 * qué aviso se enseña. Dos copias de esto son dos sitios que se desincronizan,
 * y el alta y el ascenso desde Perfil tienen que comportarse igual (ver
 * `todo/perfil.md` → «Decisión de alta»). El texto de cada fallo lo pone
 * `account-copy.ts`, que lo comparte además con `sign-in-form` y
 * `auth-callback`, que no pasan por este hook.
 *
 * Lo que **no** vive aquí es el texto de cada pantalla ni qué hace cada una al
 * terminar: los métodos reciben un `done` que corre cuando la operación salió
 * bien, y ahí cada pantalla limpia su campo o deja su aviso.
 */

import { useState } from 'react';

import { useQuery } from '@/data';

import { describeAccountError } from './account-copy';
import {
  linkEmailToCurrentUser,
  readAccountState,
  sendPasswordReset,
  setAccountPassword,
} from './account-gateway';

/** Qué se le está pidiendo al servidor ahora mismo, si es que se le pide algo. */
export type AccountBusy = 'asegurar' | 'reenviar' | 'contrasena' | 'recuperar' | 'salir' | null;

/** Aviso bajo los controles: neutro para lo que salió bien, `danger` para lo que no. */
export interface AccountNotice {
  text: string;
  tone: 'textSecondary' | 'danger';
}

export function useAccountActions() {
  const {
    data: account,
    loading,
    error: loadError,
    refresh,
  } = useQuery('account:state', readAccountState);

  const [busy, setBusy] = useState<AccountBusy>(null);
  const [notice, setNotice] = useState<AccountNotice | null>(null);

  /**
   * Ejecuta una operación con su estado de ocupado y su aviso de error.
   *
   * `done` va antes de `refresh` a propósito: es quien deja el aviso de «salió
   * bien», y `refresh` no lo pisa. `onError` deja a la pantalla quedarse con un
   * fallo concreto —devolviendo `true`— en vez de enseñarlo como aviso.
   */
  async function run(
    action: Exclude<AccountBusy, null>,
    call: () => Promise<unknown>,
    done?: () => void,
    onError?: (cause: unknown) => boolean
  ) {
    if (busy) return;

    setBusy(action);
    setNotice(null);

    try {
      await call();
      done?.();
      refresh();
    } catch (cause) {
      if (onError?.(cause)) return;
      setNotice({ text: describeAccountError(cause), tone: 'danger' });
    } finally {
      setBusy(null);
    }
  }

  /** Pide el enlace de confirmación para `email`. */
  function link(email: string, done?: () => void) {
    const value = email.trim();
    if (!value) {
      setNotice({ text: 'Escribe tu email para que podamos mandarte el enlace.', tone: 'danger' });
      return;
    }

    void run('asegurar', () => linkEmailToCurrentUser(value), done);
  }

  /** Vuelve a mandar el correo al email que está pendiente de confirmar. */
  function resend(done?: () => void) {
    const pendingEmail = account?.pendingEmail;
    if (!pendingEmail) return;

    void run('reenviar', () => linkEmailToCurrentUser(pendingEmail), done);
  }

  /** Pone contraseña a la cuenta: solo se acepta con el email ya confirmado. */
  function savePassword(password: string, done?: () => void) {
    if (!password) {
      setNotice({ text: 'Escribe la contraseña que quieres usar.', tone: 'danger' });
      return;
    }

    void run('contrasena', () => setAccountPassword(password), done);
  }

  /** Manda el correo para cambiar la contraseña al email de la cuenta. */
  function resetPassword(done?: () => void) {
    const address = account?.email;
    if (!address) return;

    void run('recuperar', () => sendPasswordReset(address), done);
  }

  return {
    account,
    loading,
    loadError,
    refresh,
    busy,
    notice,
    setNotice,
    run,
    link,
    resend,
    savePassword,
    resetPassword,
  };
}
