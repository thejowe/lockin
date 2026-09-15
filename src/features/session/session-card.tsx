/**
 * "Sesión Lock-In" en el chat — el diferenciador del producto (ver `CONCEPTO.md`).
 *
 * Sustituye al hueco de llamada a Lock-In que dejó el MVP en el mismo sitio. Un solo componente
 * con seis estados (`cardView`): agendar, esperando respuesta, propuesta
 * recibida, acordada, entrar y valorar.
 *
 * `valorar` es solo la repesca: la vía principal para valorar es la pantalla de
 * sesión al terminar, y esto existe para quien cerró la app antes del final —lo
 * que hace quien se queda sin batería o sale antes—. Por eso la sesión viva gana
 * siempre (`cardView`) y la valoración espera o caduca.
 */

import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { SessionConflictError, SessionExpiredError, useRepositories } from '@/data';
import { useTheme } from '@/hooks/use-theme';

import { cardView } from './card-state';
import { blocksLabel, formatSessionWhen, formatStartsIn } from './format';
import { ProposeSessionSheet } from './propose-session-sheet';
import { RATING_CLOSED } from './rating';
import { RatingChips } from './rating-chips';
import { useReminderHint } from './reminder-permission';
import { streakDeadline, streakLine, visibleStreak } from './streak';
import { useActiveSession } from './use-active-session';
import { useRating } from './use-rating';

import type { LockInSession, MatchWithProfile, Profile, SessionBlocks } from '@/data';

export function SessionCard({ match, me }: { match: MatchWithProfile; me: Profile | null }) {
  const theme = useTheme();
  const router = useRouter();
  const repositories = useRepositories();
  const { session, ratable, streak, nowMs, refresh } = useActiveSession(match.id);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const reminderHint = useReminderHint();

  const firstName = match.counterpart.name.split(' ')[0];
  const view = cardView(session, ratable, me?.id ?? null, nowMs);
  const shown = visibleStreak(streak, nowMs);

  const run = async (action: () => Promise<unknown>): Promise<boolean> => {
    setBusy(true);
    setNotice(null);
    try {
      await action();
      return true;
    } catch (cause: unknown) {
      setNotice(
        cause instanceof SessionConflictError || cause instanceof SessionExpiredError
          ? 'La sesión ha cambiado.'
          : 'No se ha podido completar. Inténtalo otra vez.'
      );
      return false;
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const propose = async (startsAt: string, blocks: SessionBlocks) => {
    const done = await run(() =>
      repositories.sessions.propose({ matchId: match.id, startsAt, blocks })
    );
    if (done) setSheetOpen(false);
  };

  const detail = (value: LockInSession) =>
    `${formatSessionWhen(value.startsAt, nowMs)} · ${blocksLabel(value.blocks)}`;

  return (
    <View style={[styles.root, { backgroundColor: theme.tealSoft, borderColor: theme.teal }]}>
      <ThemedText type="label" themeColor="teal">
        Sesión Lock-In
      </ThemedText>

      {shown !== null && view.kind !== 'valorar' && (
        <>
          <ThemedText type="bodyStrong">{streakLine(shown)}</ThemedText>
          {view.kind === 'agendar' && streak && (
            <ThemedText type="small" themeColor="textSecondary">
              {streakDeadline(streak, nowMs)}
            </ThemedText>
          )}
        </>
      )}

      {view.kind === 'agendar' && (
        <CardButton
          label="Agendar sesión Lock-In"
          disabled={busy}
          onPress={() => setSheetOpen(true)}
        />
      )}

      {view.kind === 'esperando' && (
        <>
          <ThemedText type="bodyStrong">{`Esperando a ${firstName}`}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {detail(view.session)}
          </ThemedText>
          <CardButton
            label="Cancelar sesión"
            tone="quiet"
            disabled={busy}
            onPress={() => run(() => repositories.sessions.cancel(view.session.id))}
          />
        </>
      )}

      {view.kind === 'recibida' && (
        <>
          <ThemedText type="bodyStrong">{`${firstName} propone una sesión`}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {detail(view.session)}
          </ThemedText>
          <View style={styles.row}>
            <CardButton
              label="Aceptar sesión"
              disabled={busy}
              onPress={() => run(() => repositories.sessions.respond(view.session.id, 'aceptada'))}
            />
            <CardButton
              label="Rechazar sesión"
              tone="quiet"
              disabled={busy}
              onPress={() => run(() => repositories.sessions.respond(view.session.id, 'rechazada'))}
            />
          </View>
        </>
      )}

      {view.kind === 'aceptada' && (
        <>
          <ThemedText type="bodyStrong">Sesión acordada</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {`${detail(view.session)} · empieza ${formatStartsIn(Date.parse(view.session.startsAt) - nowMs)}`}
          </ThemedText>
          <CardButton
            label="Cancelar sesión"
            tone="quiet"
            disabled={busy}
            onPress={() => run(() => repositories.sessions.cancel(view.session.id))}
          />
        </>
      )}

      {view.kind === 'entrar' && (
        <>
          <ThemedText type="bodyStrong">Es la hora</ThemedText>
          <CardButton
            label="Entrar a la sesión"
            onPress={() =>
              router.push({
                pathname: '/session/[sessionId]',
                params: { sessionId: view.session.id },
              })
            }
          />
        </>
      )}

      {view.kind === 'valorar' && <RatingPrompt sessionId={view.session.id} name={firstName} />}

      {reminderHint.visible && (
        <View style={styles.row}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.hintText}>
            Activa los avisos para no perderte la sesión.
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Entendido"
            onPress={reminderHint.dismiss}>
            <ThemedText type="smallBold" themeColor="teal">
              Entendido
            </ThemedText>
          </Pressable>
        </View>
      )}

      {notice && (
        <ThemedText type="small" themeColor="danger">
          {notice}
        </ThemedText>
      )}

      {sheetOpen && (
        <ProposeSessionSheet
          visible
          me={me}
          counterpart={match.counterpart}
          nowMs={nowMs}
          submitting={busy}
          onSubmit={propose}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </View>
  );
}

/**
 * La repesca de la valoración. Va en un componente aparte para que `useRating`
 * solo se monte cuando toca: así la tarjeta no consulta la valoración de una
 * sesión que no hay que valorar.
 *
 * Tras el toque se queda en "Gracias — solo lo ves tú", y en el refresco
 * siguiente `getRatable` ya devuelve `null` y la tarjeta vuelve a `agendar`
 * sola. Reusa `useRating`: no hay una segunda llamada a `rate` en el proyecto.
 */
function RatingPrompt({ sessionId, name }: { sessionId: string; name: string }) {
  const { rating, submit, error, pending } = useRating(sessionId);

  if (rating) {
    return (
      <ThemedText type="body" themeColor="textSecondary">
        Gracias — solo lo ves tú
      </ThemedText>
    );
  }

  // Igual que en la pantalla de sesión: si el servidor ya no lo va a aceptar,
  // los chips desaparecen en vez de quedarse invitando a insistir.
  if (error === RATING_CLOSED) {
    return (
      <ThemedText type="body" themeColor="textSecondary">
        {RATING_CLOSED}
      </ThemedText>
    );
  }

  return (
    <>
      <ThemedText type="bodyStrong">{`¿Qué tal fue la sesión con ${name}?`}</ThemedText>
      <RatingChips onSelect={submit} disabled={pending} />
      {error && (
        <ThemedText type="small" themeColor="danger">
          {error}
        </ThemedText>
      )}
    </>
  );
}

function CardButton({
  label,
  onPress,
  disabled = false,
  tone = 'accent',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'accent' | 'quiet';
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: tone === 'accent' ? theme.brass : 'transparent',
          borderColor: theme.teal,
          opacity: disabled ? 0.6 : pressed ? 0.85 : 1,
        },
      ]}>
      <ThemedText
        type="bodyStrong"
        style={{ color: tone === 'accent' ? theme.onAccent : theme.text }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    borderRadius: Radii.large,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  row: { flexDirection: 'row', gap: Spacing.two },
  hintText: { flexShrink: 1 },
  button: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
