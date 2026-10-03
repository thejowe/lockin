/**
 * Sala Lock-In grupal (spec § 2, «Sala»).
 *
 * Una pantalla con estados, decididos con la hora del dispositivo corregida por
 * `serverNow()`:
 *
 * - **Antes de la ventana**: quién convoca, cuándo, quién va y las respuestas.
 *   Quien convoca ve a todo el mundo con su estado; el resto solo a quien ha
 *   aceptado, porque el servidor no le da más (el ciego de invitados lo impone
 *   la RLS, no esta pantalla). Responder se cierra al abrir la ventana.
 * - **En la ventana** (solo quien ha aceptado): entra al montar, reloj del
 *   Pomodoro y presencia por persona. Salir pide confirmación; el gesto atrás
 *   registra la salida igual.
 * - **Terminada, cancelada o no visible**: un aviso y la vuelta a Matches.
 *
 * Quien convoca no manda: solo puede cancelar, y solo antes de que empiece.
 * Ninguna confirmación es un diálogo del sistema (rompen la automatización):
 * todas van en línea, como el «Salir» de la sesión 1:1.
 */

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Screen } from '@/components/ambient-background';
import { Button } from '@/components/button';
import { Glass } from '@/components/glass';
import { enterUp } from '@/components/motion';
import { LoadingState, MessageState } from '@/components/state-view';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radii, Spacing, Stroke, type ThemeColor } from '@/constants/theme';
import {
  canCancelRoom,
  canRespondToRoom,
  isInRoomJoinWindow,
  roomEndsAtMs,
  SessionConflictError,
  SessionExpiredError,
  useQuery,
  useRepositories,
  type Avatar,
  type RoomMemberStatus,
  type RoomView,
} from '@/data';
import { ProfileAvatar } from '@/features/chat';
import { useRoom, useRoomPresence } from '@/features/room';
import {
  blocksLabel,
  formatCountdown,
  formatSessionWhen,
  phaseAt,
  useNow,
} from '@/features/session';
import { PomodoroRing } from '@/features/session/pomodoro-ring';
import { PresenceDot } from '@/features/session/presence-dot';
import { useTheme } from '@/hooks/use-theme';

import type { Phase } from '@/features/session';

const RETRY_MS = 5_000;

const STATUS_TEXT: Record<RoomMemberStatus, string> = {
  invitada: 'Invitada',
  aceptada: 'Ha aceptado',
  rechazada: 'No podrá ir',
};

type Confirming = 'leave' | 'cancel' | 'decline' | null;

function phaseTitle(phase: Phase, blocks: number): string {
  if (phase.kind === 'antes') return 'Empieza en';
  const name = phase.kind === 'trabajo' ? 'Trabajo' : 'Descanso';
  return `${name} · bloque ${phase.block} de ${blocks}`;
}

function actionErrorText(error: unknown, action: 'respond' | 'cancel'): string {
  if (error instanceof SessionConflictError) return 'La sala se acaba de cancelar.';
  if (error instanceof SessionExpiredError) {
    return action === 'respond'
      ? 'Ya no se puede responder a esta sala.'
      : 'La sala ya ha empezado: ya no se puede cancelar.';
  }
  return 'No se ha podido guardar. Inténtalo de nuevo.';
}

/** Nombre de pila de quien convoca, si quien mira no es esa persona. */
function hostFirstName(view: RoomView): string | null {
  const host = view.others.find(({ member }) => member.profileId === view.room.hostId);
  return host ? host.profile.name.split(' ')[0] : null;
}

/**
 * Entrar al montar dentro de la ventana, con reintento si falla, y registrar la
 * salida al desmontar antes del final (cubre el gesto atrás). Mismo patrón que
 * `useAttendance` de la sesión 1:1, sobre las escrituras de la sala.
 */
function useRoomEntry(
  join: () => Promise<void>,
  leave: () => Promise<void>,
  canJoin: boolean,
  ended: boolean
): () => Promise<void> {
  const [joined, setJoined] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const leftRef = useRef(false);
  const endedRef = useRef(ended);
  // La última entrada pedida: `true` si llegó a registrarse. La salida va
  // siempre detrás de ella, aunque la pantalla ya se haya desmontado: una
  // entrada que llega tarde sin su salida dejaría `leftAt` nulo.
  const entryRef = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    endedRef.current = ended;
  }, [ended]);

  useEffect(() => {
    if (!canJoin || joined || leftRef.current) return;
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;

    const entry = join().then(
      () => true,
      () => false
    );
    entryRef.current = entry;
    void entry.then((ok) => {
      if (cancelled) return;
      if (ok) setJoined(true);
      else retry = setTimeout(() => setAttempt((value) => value + 1), RETRY_MS);
    });

    return () => {
      cancelled = true;
      if (retry) clearTimeout(retry);
    };
  }, [join, canJoin, joined, attempt]);

  // Al desmontar antes del final (el gesto atrás), sale detrás de la entrada.
  useEffect(
    () => () => {
      const entry = entryRef.current;
      if (!entry || leftRef.current || endedRef.current) return;
      leftRef.current = true;
      void entry.then((ok) => (ok ? leave() : undefined)).catch(() => {});
    },
    [leave]
  );

  return useCallback(async () => {
    if (leftRef.current) return;
    leftRef.current = true;
    const entered = entryRef.current ? await entryRef.current : false;
    if (!entered) return;
    try {
      await leave();
    } catch {
      // Un `leave` que falla deja `leftAt` nulo: «no salió de forma explícita».
    }
  }, [leave]);
}

export default function RoomScreen() {
  const theme = useTheme();
  const router = useRouter();
  const repositories = useRepositories();
  const params = useLocalSearchParams<{ roomId: string }>();
  const roomId = Array.isArray(params.roomId) ? params.roomId[0] : (params.roomId ?? '');

  const room = useRoom(roomId);
  const meQuery = useQuery('profile:current', () => repositories.profiles.getCurrent());
  const nowMs = useNow(1_000) + room.offsetMs;
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [departing, setDeparting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const view = room.view;
  const inWindow = view !== null && isInRoomJoinWindow(view.room, view.me, nowMs);
  const ended = view !== null && nowMs >= roomEndsAtMs(view.room);
  const leaveRoom = useRoomEntry(room.join, room.leave, inWindow, ended);
  const presence = useRoomPresence(inWindow ? roomId : null, view?.me.profileId ?? null);

  const header = <Stack.Screen options={{ title: 'Sala Lock-In' }} />;

  // Tras rechazar la sala deja de ser visible: se vuelve a Matches sin pintar
  // «no disponible» por el camino.
  if (departing) return <Screen ambient="teal">{header}</Screen>;

  if (room.loading) {
    return (
      <Screen ambient="teal">
        {header}
        <LoadingState label="Cargando la sala…" />
      </Screen>
    );
  }

  if (!view) {
    return room.error ? (
      <Notice
        header={header}
        title="No se ha podido cargar la sala"
        detail="Comprueba la conexión."
        action={<Button label="Reintentar" onPress={room.refresh} />}
      />
    ) : (
      <Notice
        header={header}
        title="Esta sala no está disponible"
        detail="Puede que la hayas rechazado o que no seas parte de ella."
      />
    );
  }

  const isHost = view.room.hostId === view.me.profileId;
  const hostName = hostFirstName(view);

  if (view.room.cancelledAt !== null) {
    return (
      <Notice
        header={header}
        title={isHost ? 'Cancelaste la sala' : `${hostName ?? 'Quien convocó'} canceló la sala`}
      />
    );
  }

  if (ended) {
    return (
      <Notice
        header={header}
        title={view.me.status === 'aceptada' ? 'Sala completada' : 'Esta sala ya terminó'}
      />
    );
  }

  const canRespond = canRespondToRoom(view.room, view.me, nowMs);
  const canCancel = canCancelRoom(view.room, view.me.profileId, nowMs);
  const when = `${formatSessionWhen(view.room.startsAt, nowMs)} · ${blocksLabel(view.room.blocks)}`;
  const title = isHost ? 'Convocas tú' : `Convoca ${hostName ?? 'otra persona'}`;
  const myAvatar = meQuery.data?.avatar ?? null;

  const accept = async () => {
    setActionError(null);
    try {
      await room.respond('aceptada');
    } catch (error) {
      setActionError(actionErrorText(error, 'respond'));
    }
  };

  const decline = async () => {
    if (room.pending) return;
    setActionError(null);
    setDeparting(true);
    try {
      await room.respond('rechazada');
      router.back();
    } catch (error) {
      setDeparting(false);
      setConfirming(null);
      setActionError(actionErrorText(error, 'respond'));
    }
  };

  const cancel = async () => {
    setActionError(null);
    try {
      await room.cancel();
    } catch (error) {
      setActionError(actionErrorText(error, 'cancel'));
    }
    setConfirming(null);
  };

  const exit = async () => {
    await leaveRoom();
    router.back();
  };

  const cancelControls =
    confirming === 'cancel' ? (
      <Confirm
        text="Se cancelará para todas las personas invitadas."
        confirmLabel="Sí, cancelar la sala"
        backLabel="No, mantenerla"
        disabled={room.pending}
        onConfirm={cancel}
        onBack={() => setConfirming(null)}
      />
    ) : (
      <Button
        label="Cancelar sala"
        variant="secondary"
        disabled={room.pending}
        onPress={() => setConfirming('cancel')}
      />
    );

  const errorLine = actionError ? (
    <ThemedText type="small" themeColor="danger">
      {actionError}
    </ThemedText>
  ) : null;

  const summary = (
    <Animated.View entering={enterUp(0)}>
      <Glass radius={Radii.card} style={styles.summary}>
        <ThemedText type="label" themeColor="teal">
          Sala Lock-In
        </ThemedText>
        <ThemedText type="subtitle">{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {when}
        </ThemedText>
      </Glass>
    </Animated.View>
  );

  if (inWindow) {
    const phase = phaseAt(view.room.startsAt, view.room.blocks, nowMs);
    const going = view.others.filter(({ member }) => member.status === 'aceptada');

    return (
      <Screen ambient="teal">
        {header}
        <ScrollView contentContainerStyle={styles.content}>
          {summary}

          <View style={styles.people}>
            <PersonRow
              index={1}
              avatar={myAvatar}
              name="Tú"
              status={presence.online ? 'Estás aquí' : 'Sin conexión'}
              statusColor={presence.online ? 'teal' : 'textSecondary'}
              present={presence.online}
            />
            {going.map(({ member, profile }, index) => {
              const present = presence.online && presence.presentIds.has(member.profileId);
              return (
                <PersonRow
                  key={member.profileId}
                  index={index + 2}
                  avatar={profile.avatar}
                  name={profile.name}
                  status={
                    !presence.online ? 'Sin conexión' : present ? 'Está aquí' : 'Aún no ha entrado'
                  }
                  statusColor={present ? 'teal' : 'textSecondary'}
                  present={present}
                />
              );
            })}
          </View>

          <View style={styles.clock}>
            <PomodoroRing phase={phase}>
              <ThemedText type="timer">{formatCountdown(phase.remainingMs)}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {phaseTitle(phase, view.room.blocks)}
              </ThemedText>
            </PomodoroRing>
            <View style={styles.blocks}>
              {Array.from({ length: view.room.blocks }, (_, index) => (
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

          <View style={styles.actions}>
            {errorLine}
            {confirming === 'leave' ? (
              <Confirm
                text="Saldrás antes de acabar."
                confirmLabel="Salir de la sala"
                backLabel="Seguir"
                onConfirm={exit}
                onBack={() => setConfirming(null)}
              />
            ) : (
              <Button label="Salir" variant="secondary" onPress={() => setConfirming('leave')} />
            )}
            {canCancel && cancelControls}
          </View>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen ambient="teal">
      {header}
      <ScrollView contentContainerStyle={styles.content}>
        {summary}

        {view.me.status === 'invitada' && canRespond && (
          <ThemedText type="small" themeColor="textSecondary">
            Si te apuntas, quienes vayan te verán en la sala. Sin vídeo ni chat: solo el reloj y
            quién está.
          </ThemedText>
        )}

        <View style={styles.people}>
          <ThemedText type="label" themeColor="textSecondary">
            {isHost ? 'Personas' : 'Quién va'}
          </ThemedText>
          <PersonRow
            index={1}
            avatar={myAvatar}
            name="Tú"
            status={isHost ? 'Convocas' : view.me.status === 'aceptada' ? 'Vas' : 'Sin responder'}
            statusColor={view.me.status === 'aceptada' ? 'teal' : 'textSecondary'}
          />
          {view.others.map(({ member, profile }, index) => (
            <PersonRow
              key={member.profileId}
              index={index + 2}
              avatar={profile.avatar}
              name={profile.name}
              status={
                member.profileId === view.room.hostId ? 'Convoca' : STATUS_TEXT[member.status]
              }
              statusColor={member.status === 'aceptada' ? 'teal' : 'textSecondary'}
            />
          ))}
        </View>

        <View style={styles.actions}>
          {errorLine}

          {view.me.status === 'invitada' &&
            (canRespond ? (
              <>
                <Button label="Me apunto" disabled={room.pending} onPress={accept} />
                <Button
                  label="No puedo"
                  variant="secondary"
                  disabled={room.pending}
                  onPress={decline}
                />
              </>
            ) : (
              <ThemedText type="body" themeColor="textSecondary">
                Ya no se puede responder a esta sala
              </ThemedText>
            ))}

          {view.me.status === 'aceptada' &&
            !isHost &&
            canRespond &&
            (confirming === 'decline' ? (
              <Confirm
                text="Dejarás de ver esta sala y no podrás volver a apuntarte."
                confirmLabel="Sí, no podré ir"
                backLabel="Seguir en la sala"
                disabled={room.pending}
                onConfirm={decline}
                onBack={() => setConfirming(null)}
              />
            ) : (
              <Button
                label="No podré ir"
                variant="secondary"
                disabled={room.pending}
                onPress={() => setConfirming('decline')}
              />
            ))}

          {canCancel && cancelControls}
        </View>
      </ScrollView>
    </Screen>
  );
}

function PersonRow({
  index,
  avatar,
  name,
  status,
  statusColor,
  present,
}: {
  index: number;
  avatar: Avatar | null;
  name: string;
  status: string;
  statusColor: ThemeColor;
  /** Solo en la ventana: el punto de presencia. */
  present?: boolean;
}) {
  return (
    <Animated.View entering={enterUp(index)}>
      <Glass radius={Radii.large} style={styles.person}>
        {avatar && <ProfileAvatar avatar={avatar} size={40} />}
        <View style={styles.personText}>
          <ThemedText type="heading">{name}</ThemedText>
          <View style={styles.status}>
            {present !== undefined && <PresenceDot present={present} />}
            <ThemedText type="small" themeColor={statusColor}>
              {status}
            </ThemedText>
          </View>
        </View>
      </Glass>
    </Animated.View>
  );
}

/** Confirmación en línea: un texto de aviso, la acción en `danger` y la vuelta atrás. */
function Confirm({
  text,
  confirmLabel,
  backLabel,
  disabled = false,
  onConfirm,
  onBack,
}: {
  text: string;
  confirmLabel: string;
  backLabel: string;
  disabled?: boolean;
  onConfirm: () => void;
  onBack: () => void;
}) {
  return (
    <View style={styles.confirm}>
      <ThemedText type="body" themeColor="danger">
        {text}
      </ThemedText>
      <Button label={confirmLabel} variant="danger" disabled={disabled} onPress={onConfirm} />
      <Button label={backLabel} variant="secondary" onPress={onBack} />
    </View>
  );
}

/** Aviso de pantalla completa con la vuelta a Matches. */
function Notice({
  header,
  title,
  detail,
  action,
}: {
  /** El `Stack.Screen` con el título de la cabecera. */
  header: React.ReactNode;
  title: string;
  detail?: string;
  /** Acción principal, si la hay; la vuelta a Matches pasa entonces a secundaria. */
  action?: React.ReactNode;
}) {
  return (
    <Screen ambient="teal">
      {header}
      <MessageState eyebrow="Sala Lock-In" eyebrowColor="teal" title={title} body={detail}>
        {action}
        <Button
          label="Volver a Matches"
          href="/matches"
          variant={action ? 'secondary' : 'primary'}
        />
      </MessageState>
    </Screen>
  );
}

/** Marca de cada bloque del Pomodoro: una barra corta, no un punto. */
const POMODORO_BLOCK = { width: 32, height: 8 } as const;

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.four,
    gap: Spacing.four,
  },
  summary: { gap: Spacing.one, padding: Spacing.three },
  people: { gap: Spacing.two },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  personText: { flex: 1, gap: Spacing.half },
  status: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  clock: { alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  blocks: { flexDirection: 'row', gap: Spacing.two },
  block: {
    width: POMODORO_BLOCK.width,
    height: POMODORO_BLOCK.height,
    borderRadius: Radii.pill,
    borderWidth: Stroke.hairline,
  },
  actions: { gap: Spacing.two },
  confirm: { gap: Spacing.two },
});
