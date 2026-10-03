/**
 * Sesión Lock-In en curso.
 *
 * La cuenta atrás sale de `phaseAt` con la hora del dispositivo corregida por
 * `serverNow()`: los dos móviles calculan lo mismo sin mandarse nada. Entrar se
 * registra solo al abrir la pantalla dentro de la ventana; salir antes de acabar
 * pide confirmación porque cuenta como abandono.
 *
 * El final lo decide `endingView`: pregunta cuando entraron los dos y no has
 * valorado, agradece cuando ya valoraste, dice que la otra persona no entró
 * cuando tú sí, y **no pregunta nada** si el que faltó fuiste tú. Un toque en
 * un chip no navega: la pantalla se queda en el agradecimiento, porque
 * cerrarse sola dejaría la duda de si se registró.
 */

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AmbientBackground } from '@/components/ambient-background';
import { Glass } from '@/components/glass';
import { Button } from '@/components/button';
import { LoadingState, MessageState } from '@/components/state-view';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radii, Spacing, Stroke } from '@/constants/theme';
import { isInJoinWindow } from '@/data';
import { ProfileAvatar } from '@/features/chat';
import { PomodoroRing } from '@/features/session/pomodoro-ring';
import { PresenceDot } from '@/features/session/presence-dot';
import {
  endingView,
  formatCountdown,
  phaseAt,
  RatingChips,
  RATING_CLOSED,
  useAttendance,
  useCounterpartPresence,
  useNow,
  useRating,
  useSessionRoom,
  VideoCallView,
  type CounterpartPresence,
  type Phase,
} from '@/features/session';
import { useTheme } from '@/hooks/use-theme';

const PRESENCE_TEXT: Record<CounterpartPresence, string> = {
  aqui: 'Está aquí',
  ausente: 'Aún no ha entrado',
  'sin-conexion': 'Sin conexión',
};

function phaseTitle(phase: Phase, blocks: number): string {
  if (phase.kind === 'antes') return 'Empieza en';
  const name = phase.kind === 'trabajo' ? 'Trabajo' : 'Descanso';
  return `${name} · bloque ${phase.block} de ${blocks}`;
}

export default function SessionScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ sessionId: string }>();
  const sessionId = Array.isArray(params.sessionId)
    ? params.sessionId[0]
    : (params.sessionId ?? '');

  const { session, match, me, loading, offsetMs } = useSessionRoom(sessionId);
  const nowMs = useNow(1_000) + offsetMs;

  const canJoin = session !== null && isInJoinWindow(session, nowMs);
  const phase = session ? phaseAt(session.startsAt, session.blocks, nowMs) : null;
  const ended = phase?.kind === 'terminada';

  const attendance = useAttendance(sessionId, canJoin, ended);
  const myRating = useRating(sessionId);
  const counterpartPresence = useCounterpartPresence(
    canJoin ? sessionId : null,
    me?.id ?? null,
    match?.counterpart.id ?? null
  );
  const [confirmingLeave, setConfirmingLeave] = useState(false);

  const leave = async () => {
    await attendance.leave();
    router.back();
  };

  const screenOptions = <Stack.Screen options={{ title: 'Sesión Lock-In' }} />;

  if (loading && !session) {
    return (
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <AmbientBackground variant="ember" />
        {screenOptions}
        <LoadingState label="Cargando la sesión…" />
      </View>
    );
  }

  if (!session || !match) {
    return (
      <Notice title="Esta sesión no está disponible" onBack={() => router.back()}>
        {screenOptions}
      </Notice>
    );
  }

  if (session.status !== 'aceptada') {
    return (
      <Notice title="Esta sesión todavía no está aceptada" onBack={() => router.back()}>
        {screenOptions}
      </Notice>
    );
  }

  if (!ended && !canJoin) {
    return (
      <Notice
        title="Todavía no puedes entrar"
        detail="La sesión se abre 5 minutos antes de empezar."
        onBack={() => router.back()}>
        {screenOptions}
      </Notice>
    );
  }

  const firstName = match.counterpart.name.split(' ')[0];
  // Sin las filas de asistencia o sin saber quién soy todavía no hay final que
  // pintar: darlo por vacío enseñaría "no entró" un instante antes de preguntar.
  const ending =
    ended && myRating.attendance && me
      ? endingView(myRating.attendance, me.id, match.counterpart.id, session, myRating.rating)
      : null;
  const endingKind = myRating.error === RATING_CLOSED ? 'cerrada' : (ending?.kind ?? null);

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <AmbientBackground variant="ember" />
      {screenOptions}
      <View style={styles.content}>
        <Glass radius={Radii.card} style={styles.counterpart}>
          <ProfileAvatar avatar={match.counterpart.avatar} size={52} />
          <View style={styles.counterpartText}>
            <ThemedText type="heading">{match.counterpart.name}</ThemedText>
            <View style={styles.presence}>
              <PresenceDot present={counterpartPresence === 'aqui'} />
              <ThemedText
                type="small"
                themeColor={counterpartPresence === 'aqui' ? 'teal' : 'textSecondary'}>
                {PRESENCE_TEXT[counterpartPresence]}
              </ThemedText>
            </View>
          </View>
        </Glass>

        {phase && ended ? (
          <View style={styles.clock}>
            <ThemedText type="title">Sesión completada</ThemedText>

            {endingKind === 'preguntar' && (
              <>
                <ThemedText type="body" themeColor="textSecondary">
                  ¿Qué tal ha ido?
                </ThemedText>
                <RatingChips
                  onSelect={myRating.submit}
                  selected={myRating.rating}
                  disabled={myRating.pending}
                />
                {myRating.error && (
                  <ThemedText type="small" themeColor="danger">
                    {myRating.error}
                  </ThemedText>
                )}
              </>
            )}

            {endingKind === 'gracias' && (
              <ThemedText type="body" themeColor="textSecondary">
                Gracias — solo lo ves tú
              </ThemedText>
            )}

            {endingKind === 'no-vino' && (
              <ThemedText type="body" themeColor="textSecondary" style={styles.centeredText}>
                {`${firstName} no entró`}
              </ThemedText>
            )}

            {endingKind === 'cerrada' && (
              <ThemedText type="body" themeColor="textSecondary">
                {RATING_CLOSED}
              </ThemedText>
            )}

            <Button label="Volver al chat" onPress={() => router.back()} style={styles.stretch} />
          </View>
        ) : phase ? (
          <>
            <View style={styles.clock}>
              <VideoCallView
                sessionId={session.id}
                myProfileId={me?.id ?? null}
                counterpartId={match.counterpart.id}
                active={canJoin && !ended}
              />
              <PomodoroRing phase={phase}>
                <ThemedText type="timer">{formatCountdown(phase.remainingMs)}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {phaseTitle(phase, session.blocks)}
                </ThemedText>
              </PomodoroRing>
              <View style={styles.blocks}>
                {Array.from({ length: session.blocks }, (_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.block,
                      {
                        borderColor: index + 1 <= phase.block ? theme.brass : theme.border,
                        backgroundColor:
                          index + 1 < phase.block
                            ? theme.brass
                            : index + 1 === phase.block
                              ? theme.brassSoft
                              : theme.backgroundElement,
                      },
                    ]}
                  />
                ))}
              </View>
            </View>

            {confirmingLeave ? (
              <View style={styles.confirm}>
                <ThemedText type="body" themeColor="danger">
                  Saldrás antes de acabar; contará como abandono.
                </ThemedText>
                <Button label="Salir de la sesión" variant="danger" onPress={leave} />
                <Button
                  label="Seguir"
                  variant="secondary"
                  onPress={() => setConfirmingLeave(false)}
                />
              </View>
            ) : (
              <Button label="Salir" variant="secondary" onPress={() => setConfirmingLeave(true)} />
            )}
          </>
        ) : null}
      </View>
    </View>
  );
}

/** Aviso de pantalla completa: la sesión no existe, no está aceptada o aún no abre. */
function Notice({
  title,
  detail,
  onBack,
  children,
}: {
  title: string;
  detail?: string;
  onBack: () => void;
  children?: React.ReactNode;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <AmbientBackground variant="ember" />
      {children}
      <MessageState eyebrow="Sesión Lock-In" eyebrowColor="teal" title={title} body={detail}>
        <Button label="Volver al chat" onPress={onBack} />
      </MessageState>
    </View>
  );
}

/** Marca de cada bloque del Pomodoro: una barra corta, no un punto. */
const POMODORO_BLOCK = { width: 32, height: 8 } as const;

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.four,
    gap: Spacing.five,
  },
  counterpart: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  counterpartText: { gap: Spacing.half },
  presence: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  clock: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  blocks: { flexDirection: 'row', gap: Spacing.two },
  block: {
    width: POMODORO_BLOCK.width,
    height: POMODORO_BLOCK.height,
    borderRadius: Radii.pill,
    borderWidth: Stroke.hairline,
  },
  confirm: { gap: Spacing.two },
  stretch: { alignSelf: 'stretch' },
  centeredText: { textAlign: 'center' },
});
