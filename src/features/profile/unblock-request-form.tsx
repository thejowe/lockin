/**
 * «Solicitar desbloqueo»: para quien intenta entrar o registrarse con el correo
 * de una cuenta eliminada.
 *
 * Decisión de producto del 2026-11-09: eliminar la cuenta bloquea su correo
 * (`supabase/migrations/20261109120000_blocked_account_emails.sql`). Para
 * volver a usarlo hay que pedirlo y explicar por qué; lo revisa una persona del
 * equipo y, si lo aprueba, el correo vuelve a valer para registrarse.
 *
 * Funciona sin sesión: la solicitud la guarda una función SECURITY DEFINER que
 * solo acepta correos que de verdad están bloqueados.
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { RevealStack } from '@/components/reveal-stack';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

import { describeAccountError } from './account-copy';
import { requestAccountUnblock, UNBLOCK_REASON_MIN } from './account-gateway';
import { Field, PrimaryButton, SecondaryButton, TextField } from './controls';
import { t } from '@/i18n';

const REASON_MAX = 2000;

/**
 * El botón que acompaña al aviso de «correo bloqueado» al entrar o registrarse:
 * lleva a `/unblock` con el correo ya escrito.
 */
export function RequestUnblockButton({ email }: { email: string }) {
  const router = useRouter();
  return (
    <SecondaryButton
      label={t('Solicitar desbloqueo')}
      onPress={() => router.push({ pathname: '/unblock', params: { email: email.trim() } })}
    />
  );
}

export function UnblockRequestForm({
  initialEmail = '',
  onClose,
}: {
  initialEmail?: string;
  /** Volver a «Ya tengo cuenta» / al inicio. */
  onClose: () => void;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reasonLength = reason.trim().length;

  async function submit() {
    if (busy) return;
    if (!email.trim()) {
      setError(t('Escribe el correo de la cuenta eliminada.'));
      return;
    }
    if (reasonLength < UNBLOCK_REASON_MIN) {
      setError(
        t('Explica el motivo con al menos {UNBLOCK_REASON_MIN} caracteres.', {
          UNBLOCK_REASON_MIN,
        })
      );
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await requestAccountUnblock(email, reason);
      setSent(true);
    } catch (cause) {
      setError(describeAccountError(cause));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <RevealStack style={styles.root} revealKey="sent">
        <>
          <ThemedText type="title">{t('Solicitud enviada')}</ThemedText>
          <ThemedText type="body" themeColor="textSecondary">
            {t(
              'Revisaremos tu solicitud y te escribiremos a {email}. Si la aprobamos, podrás volver a registrarte con ese correo.',
              { email: email.trim() }
            )}
          </ThemedText>
        </>
        <PrimaryButton label={t('Volver')} onPress={onClose} />
      </RevealStack>
    );
  }

  return (
    <RevealStack style={styles.root} revealKey="form">
      <>
        <ThemedText type="label" themeColor="textSecondary">
          {t('Cuenta eliminada')}
        </ThemedText>
        <ThemedText type="title">{t('Solicitar desbloqueo')}</ThemedText>
        <ThemedText type="body" themeColor="textSecondary">
          {t(
            'Cuando se elimina una cuenta, su correo queda bloqueado y no se puede volver a usar. Si quieres recuperarlo, cuéntanos por qué y lo revisaremos.'
          )}
        </ThemedText>
      </>

      <Field label={t('Correo de la cuenta eliminada')}>
        <TextField
          value={email}
          onChangeText={setEmail}
          accessibilityLabel={t('Correo de la cuenta eliminada')}
          placeholder="tu@email.com"
          keyboardType="email-address"
          inputMode="email"
          textContentType="emailAddress"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy}
        />
      </Field>

      <Field
        label={t('¿Por qué quieres desbloquearla?')}
        hint={t('Al menos {UNBLOCK_REASON_MIN} caracteres.', { UNBLOCK_REASON_MIN })}>
        <TextField
          value={reason}
          onChangeText={setReason}
          accessibilityLabel={t('Motivo del desbloqueo')}
          placeholder={t('Explica qué pasó y por qué quieres volver a usar este correo.')}
          multiline
          maxLength={REASON_MAX}
          showCount
          editable={!busy}
        />
      </Field>

      <PrimaryButton
        label={busy ? t('Enviando…') : t('Enviar solicitud')}
        disabled={busy || reasonLength < UNBLOCK_REASON_MIN || !email.trim()}
        onPress={() => void submit()}
      />
      <SecondaryButton label={t('Cancelar')} disabled={busy} onPress={onClose} />

      {error ? (
        <ThemedText key="error" type="small" themeColor="danger" accessibilityRole="alert">
          {error}
        </ThemedText>
      ) : null}
    </RevealStack>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.three,
  },
});
