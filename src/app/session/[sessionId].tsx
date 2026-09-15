/**
 * Sesión Lock-In en curso.
 *
 * La cuenta atrás sale de `phaseAt` con la hora del dispositivo corregida por
 * `serverNow()`: los dos móviles calculan lo mismo sin mandarse nada. Entrar se
 * registra solo al abrir la pantalla dentro de la ventana; salir antes de acabar
 * pide confirmación porque cuenta como abandono.
 *
 * El final tiene tres caras (`endingView`): pregunta cuando entraron los dos y
 * no has valorado, agradece cuando ya valoraste, y **no pregunta nada** cuando
 * la otra persona no entró. Un toque en un chip no navega: la pantalla se queda
 * en el agradecimiento, porque cerrarse sola dejaría la duda de si se registró.
 */

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import { isInJoinWindow } from '@/data';
import { ProfileAvatar } from '@/features/chat';
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
      <Centered>
        {screenOptions}
        <ThemedText type="body" themeColor="textSecondary">
          Cargando la sesión…
        </ThemedText>
      </Centered>
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
      {screenOptions}
      <View style={styles.content}>
        <View style={styles.counterpart}>
          <ProfileAvatar avatar={match.counterpart.avatar} size={56} />
          <View style={styles.counterpartText}>
            <ThemedText type="heading">{match.counterpart.name}</ThemedText>
            <ThemedText
              type="small"
              themeColor={counterpartPresence === 'aqui' ? 'teal' : 'textSecondary'}>
              {PRESENCE_TEXT[counterpartPresence]}
            </ThemedText>
          </View>
        </View>

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

            <ActionButton label="Volver al chat" onPress={() => router.back()} />
          </View>
        ) : phase ? (
          <>
            <View style={styles.clock}>
              <ThemedText type="label" themeColor="textSecondary">
                {phaseTitle(phase, session.blocks)}
              </ThemedText>
              <ThemedText type="display">{formatCountdown(phase.remainingMs)}</ThemedText>
              <View style={styles.blocks}>
                {Array.from({ length: session.blocks }, (_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.block,
                      {
                        borderColor: theme.brass,
                        backgroundColor:
                          index + 1 < phase.block
                            ? theme.brass
                            : index + 1 === phase.block
                              ? theme.brassSoft
                              : 'transparent',
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
                <ActionButton label="Salir de la sesión" tone="danger" onPress={leave} />
                <ActionButton
                  label="Seguir"
                  tone="quiet"
                  onPress={() => setConfirmingLeave(false)}
                />
              </View>
            ) : (
              <ActionButton label="Salir" tone="quiet" onPress={() => setConfirmingLeave(true)} />
            )}
          </>
        ) : null}
      </View>
    </View>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

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
  return (
    <Centered>
      {children}
      <ThemedText type="subtitle" style={styles.centeredText}>
        {title}
      </ThemedText>
      {detail && (
        <ThemedText type="body" themeColor="textSecondary" style={styles.centeredText}>
          {detail}
        </ThemedText>
      )}
      <ActionButton label="Volver al chat" onPress={onBack} />
    </Centered>
  );
}

function ActionButton({
  label,
  onPress,
  tone = 'accent',
}: {
  label: string;
  onPress: () => void;
  tone?: 'accent' | 'danger' | 'quiet';
}) {
  const theme = useTheme();
  const background =
    tone === 'accent' ? theme.brass : tone === 'danger' ? theme.danger : 'transparent';
  const color = tone === 'quiet' ? theme.text : theme.onAccent;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: background, borderColor: theme.border, opacity: pressed ? 0.85 : 1 },
      ]}>
      <ThemedText type="bodyStrong" style={{ color }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

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
  counterpart: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  counterpartText: { gap: Spacing.half },
  clock: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  blocks: { flexDirection: 'row', gap: Spacing.two },
  block: { width: 32, height: 8, borderRadius: Radii.pill, borderWidth: StyleSheet.hairlineWidth },
  confirm: { gap: Spacing.two },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  centeredText: { textAlign: 'center' },
  action: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
