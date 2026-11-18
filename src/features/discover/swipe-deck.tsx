/**
 * Deck de tarjetas con gesto de swipe.
 *
 * Es el corazón de la identidad del producto, así que el gesto manda: la
 * tarjeta sigue al dedo, se inclina, y al soltar decide por umbral o por
 * velocidad (un flick corto pero rápido también cuenta). Los botones de
 * `DeckActions` disparan exactamente la misma animación de salida para que
 * ambos caminos se sientan iguales.
 *
 * Las tarjetas ocupan todo el alto y los botones flotan encima, abajo, fijos
 * mientras la tarjeta se mueve por debajo: como en Tinder.
 *
 * Solo la tarjeta superior escucha el gesto. La de justo detrás sube hacia
 * delante a medida que la de arriba se aparta (escala y desplazamiento ligados
 * al arrastre, no a un temporizador): cuando la superior sale, la siguiente ya
 * está en su sitio y el relevo no pega un salto. La tercera no sigue al
 * arrastre: solo sube un puesto cuando la superior sale.
 *
 * La superior lleva la sombra `raised`: es lo único del deck que se coge con
 * la mano, y tiene que leerse por encima de las demás.
 *
 * El relevo no depende del orden entre hilos. El arrastre (`translateX`/`Y`)
 * pertenece a un turno concreto —`owner`: la tarjeta que estaba arriba en ese
 * render, contada aparte cada vez que la superior cambia— y no se devuelve al
 * centro al decidir: la tarjeta decidida se queda fuera y se marca `exited`, que la
 * oculta y adelanta un puesto a las de detrás en el MISMO fotograma del hilo de
 * UI. Así da igual quién llegue antes, ese fotograma o el commit de React que la
 * retira: la decidida no vuelve al centro, y la nueva superior no hereda un
 * desplazamiento que no es suyo porque su turno es otro. El arrastre se reinicia
 * solo cuando el turno nuevo lo toma (al tocar la tarjeta o con los botones),
 * en un único paso en el hilo de UI. Que el turno no sea el id a secas importa
 * cuando una tarjeta vuelve arriba (el guardado falló, o se cambia de modo y
 * reaparece): nace con turno nuevo, visible y en el centro.
 *
 * Con el cupo de likes agotado (`likeLocked`), el like —gesto, botón o Super Like—
 * no descarta la tarjeta: vuelve a su sitio con el mismo muelle que un arrastre
 * corto y se avisa a quien lo gestiona (`onLikeLocked`), que abre la hoja. Pasar
 * sigue igual: no gasta cupo.
 *
 * Con «reducir movimiento» activado en el sistema, la tarjeta llega al MISMO
 * estado final sin el recorrido: misma decisión, mismo `onDecide`, misma lógica
 * de match aguas arriba. Lo que se apaga es solo lo que se mueve solo —la salida
 * de pantalla y el rebote de vuelta al centro—, nunca el seguimiento del dedo:
 * eso es manipulación directa y quitarla dejaría el deck sin feedback.
 */

import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  runOnUI,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Elevation, Radii, Spacing, Springs } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme, useThemeName } from '@/hooks/use-theme';

import { useButtonsTour } from './buttons-tour';
import { DECK_ACTIONS_SPACE, DeckActions } from './deck-actions';
import { ProfileCard } from './profile-card';
import {
  DEPTH_DIM,
  DEPTH_OFFSET,
  DEPTH_SCALE,
  EXIT_TIMING,
  exitTiming,
  FLICK_VELOCITY,
  MAX_ROTATION,
  projected,
  SWIPE_THRESHOLD,
  SwipeOverlay,
  VISIBLE_CARDS,
} from './swipe-motion';
import { useTapHint } from './tap-hint';

import type { SharedValue } from 'react-native-reanimated';
import type { DeckProfile, Decision, Specialty } from '@/data';
import type { DaySchedule } from '@/features/profile';
import { t } from '@/i18n';

/** Identificador del gesto de la tarjeta superior. Lo usan los tests. */
export const PAN_TEST_ID = 'swipe-deck-pan';

/** `testID` de la vista animada de cada tarjeta. Lo usan los tests. */
export const cardTestId = (profileId: string) => `swipe-deck-card-${profileId}`;

/** Estado del arrastre, compartido entre el hilo de UI y el de JS. */
interface Drag {
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  /** Turno al que pertenece el arrastre (ver `turnKey`). `null` hasta el primero. */
  owner: SharedValue<string | null>;
  /** La dueña ya salió: se oculta y las de detrás suben un puesto. */
  exited: SharedValue<boolean>;
}

export function SwipeDeck({
  profiles,
  onDecide,
  viewerSpecialties,
  viewerSchedule,
  likeLocked = false,
  onLikeLocked,
  isPremium,
  likesLeft,
  onUndo,
  onSuperLike,
  onBoost,
  userId,
  onTourStep,
}: {
  profiles: DeckProfile[];
  /** Se llama una vez por tarjeta, cuando la animación de salida termina. */
  onDecide: (profile: DeckProfile, decision: Decision) => void;
  /** El cupo de likes está agotado: el like devuelve la tarjeta y avisa en vez de decidir. */
  likeLocked?: boolean;
  onLikeLocked?: () => void;
  /** Lo que enseñan los botones de Premium (ver `DeckActions`). */
  isPremium?: boolean;
  likesLeft?: number | null;
  onUndo?: () => void;
  /** Super Like sobre la tarjeta superior: sale como un like y llega aquí, no a `onDecide`. */
  onSuperLike?: (profile: DeckProfile) => void;
  onBoost?: () => void;
  /** Cuenta que mira el deck: las pistas de primera vez se recuerdan por cuenta. */
  userId?: string | null;
  /** Paso del mini tutorial de botones, o `null` cuando no hay (o termina). */
  onTourStep?: (step: number | null) => void;
  /** Lo que domina quien swipea. Solo lo reenvía a la tarjeta, que lo resalta. */
  viewerSpecialties?: Specialty[];
  /** Jornada de quien swipea: la tarjeta marca en qué franjas coincidís. */
  viewerSchedule?: DaySchedule;
}) {
  const { width } = useWindowDimensions();
  const reduceMotion = useReduceMotion();

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const owner = useSharedValue<string | null>(null);
  const exited = useSharedValue(false);
  const drag: Drag = { translateX, translateY, owner, exited };
  /** Bloquea nuevas decisiones mientras la tarjeta actual sale de pantalla. */
  const exiting = useSharedValue(false);

  const tapHint = useTapHint(userId ?? null);
  const top = profiles.length > 0 ? profiles[0] : null;
  const topId = top?.id ?? null;
  const exitDistance = width + 160;

  // Cada vez que cambia la superior empieza un turno nuevo. Es estado derivado
  // de las props, así que se ajusta durante el render (patrón de React para
  // esto) y la nueva superior se pinta ya con su turno, en el mismo commit.
  // El panel de seguridad de la superior (bloquear/reportar) está abierto: ni el
  // gesto ni Like/Pass deciden mientras tanto.
  const [safetyOpen, setSafetyOpen] = useState(false);
  // Tras la mano de «toca la tarjeta», explica Deshacer, Super Like y Boost.
  const tour = useButtonsTour(tapHint.done && profiles.length > 0 && !safetyOpen, userId ?? null);
  // La pantalla pinta el último paso (Filtros, fuera del deck) y bloquea ese botón.
  useEffect(() => {
    onTourStep?.(tour.step);
    return () => onTourStep?.(null);
  }, [tour.step, onTourStep]);
  const [turn, setTurn] = useState({ topId, count: 0 });
  if (turn.topId !== topId) {
    setTurn({ topId, count: turn.count + 1 });
    if (safetyOpen) setSafetyOpen(false);
  }
  const turnKey = topId === null ? null : `${turn.count}:${topId}`;

  // Cuánto va la tarjeta superior hacia un lado, de -1 (pasar) a 1 (like): lo
  // leen los botones de abajo para crecer y rellenarse. Vuelve a 0 en cuanto la
  // tarjeta sale, para que la siguiente empiece con los iconos en reposo.
  const swipeProgress = useDerivedValue(() => {
    if (turnKey === null || owner.get() !== turnKey || exited.get()) return 0;
    return interpolate(
      translateX.get(),
      [-SWIPE_THRESHOLD, 0, SWIPE_THRESHOLD],
      [-1, 0, 1],
      Extrapolation.CLAMP
    );
  });

  /** Cierra la decisión. La tarjeta ya está oculta: aquí solo se avisa al padre. */
  function settle(profile: DeckProfile, decision: Decision, superLike = false) {
    exiting.set(false);
    // Quien ya decide una tarjeta no necesita la pista de tocarla.
    tapHint.dismiss();
    if (superLike && onSuperLike) onSuperLike(profile);
    else onDecide(profile, decision);
  }

  /** Salida animada disparada desde los botones (el gesto tiene la suya). */
  function swipeAway(decision: Decision, superLike = false) {
    if (top === null || exiting.get()) return;
    // Sin cupo de likes la tarjeta no sale: se queda donde está y se avisa.
    if (decision === 'like' && likeLocked) {
      onLikeLocked?.();
      return;
    }
    const profile = top;
    const key = turnKey;
    const target = decision === 'like' ? exitDistance : -exitDistance;

    exiting.set(true);

    if (reduceMotion) {
      runOnUI(() => {
        'worklet';
        owner.set(key);
        exited.set(true);
      })();
      settle(profile, decision, superLike);
      return;
    }

    // Tomar el arrastre y lanzar la salida van juntos en el hilo de UI: entre
    // una cosa y otra no hay fotograma con la tarjeta en un sitio que no toca.
    runOnUI(() => {
      'worklet';
      if (owner.get() !== key || exited.get()) {
        owner.set(key);
        exited.set(false);
        translateX.set(0);
        translateY.set(0);
      }
      translateX.set(
        withTiming(target, EXIT_TIMING, (finished) => {
          if (!finished) return;
          exited.set(true);
          runOnJS(settle)(profile, decision, superLike);
        })
      );
    })();
  }

  const pan = Gesture.Pan()
    // El id es la única forma de alcanzar el gesto desde un test:
    // `getByGestureTestId` de `react-native-gesture-handler/jest-utils`.
    .withTestId(PAN_TEST_ID)
    .enabled(top !== null && !safetyOpen)
    .onBegin(() => {
      if (exiting.get() || turnKey === null) return;
      // Al tocar una tarjeta que no era la dueña, el arrastre pasa a ser suyo
      // desde cero. Si ya lo era (la coge otra vez a medio rebote), se respeta.
      if (owner.get() !== turnKey || exited.get()) {
        owner.set(turnKey);
        exited.set(false);
        translateX.set(0);
        translateY.set(0);
      }
    })
    .onUpdate((event) => {
      if (exiting.get() || owner.get() !== turnKey) return;
      translateX.set(event.translationX);
      translateY.set(event.translationY);
    })
    .onEnd((event) => {
      if (exiting.get() || top === null || owner.get() !== turnKey) return;

      const landing = projected(translateX.get(), event.velocityX);
      const liked = landing > SWIPE_THRESHOLD || event.velocityX > FLICK_VELOCITY;
      const passed = landing < -SWIPE_THRESHOLD || event.velocityX < -FLICK_VELOCITY;

      if (!liked && !passed) {
        // Vuelve al sitio con la velocidad que traía el dedo: si la iba
        // devolviendo, el muelle sigue ese mismo movimiento en vez de arrancar
        // de cero.
        translateX.set(
          reduceMotion ? 0 : withSpring(0, { ...Springs.settle, velocity: event.velocityX })
        );
        translateY.set(
          reduceMotion ? 0 : withSpring(0, { ...Springs.settle, velocity: event.velocityY })
        );
        return;
      }

      const decision: Decision = liked ? 'like' : 'pass';

      if (liked && likeLocked) {
        // Sin cupo, el like no sale: la tarjeta vuelve al centro como en un
        // arrastre corto y se avisa para abrir la hoja.
        translateX.set(
          reduceMotion ? 0 : withSpring(0, { ...Springs.settle, velocity: event.velocityX })
        );
        translateY.set(
          reduceMotion ? 0 : withSpring(0, { ...Springs.settle, velocity: event.velocityY })
        );
        if (onLikeLocked) runOnJS(onLikeLocked)();
        return;
      }

      exiting.set(true);

      if (reduceMotion) {
        // La tarjeta se oculta donde la soltó el dedo y el padre la retira: el
        // deck pasa a la siguiente sin que nada recorra la pantalla.
        exited.set(true);
        runOnJS(settle)(top, decision);
        return;
      }

      // La tarjeta mantiene el arco del gesto al salir: sube o baja según iba.
      const exitX = liked ? exitDistance : -exitDistance;
      const timing = exitTiming(exitX - translateX.get(), event.velocityX);
      translateY.set(withTiming(translateY.get() + event.velocityY * 0.1, timing));
      translateX.set(
        withTiming(exitX, timing, (finished) => {
          if (!finished) return;
          exited.set(true);
          runOnJS(settle)(top, decision);
        })
      );
    });

  // Se pintan del fondo hacia delante: la superior es la última y queda encima.
  const stack = profiles
    .slice(0, VISIBLE_CARDS)
    .map((profile, index) => ({ profile, index }))
    .reverse();

  return (
    <View style={styles.root}>
      <View style={styles.deck}>
        {stack.map(({ profile, index }) =>
          index > 0 ? (
            <BehindCard
              key={profile.id}
              profile={profile}
              index={index}
              frontKey={turnKey}
              drag={drag}
              viewerSpecialties={viewerSpecialties}
              viewerSchedule={viewerSchedule}
            />
          ) : (
            <GestureDetector key={profile.id} gesture={pan}>
              <TopCard
                profile={profile}
                turnKey={turnKey}
                drag={drag}
                viewerSpecialties={viewerSpecialties}
                viewerSchedule={viewerSchedule}
                safetyOpen={safetyOpen}
                onSafetyOpenChange={setSafetyOpen}
                // Bloquear retira el perfil del deck: se cuenta como un pase.
                onBlocked={() => swipeAway('pass')}
                tapHint={tapHint.visible && !safetyOpen}
                onPageChange={tapHint.dismiss}
              />
            </GestureDetector>
          )
        )}
      </View>

      {/*
        Encima de las tarjetas y fijos: la tarjeta se va por debajo. Con el panel
        de seguridad abierto no se pintan: flotarían sobre sus botones (Cancelar
        del reporte va anclado abajo) y se comerían los toques.
      */}
      {tour.step !== null ? (
        // Como en la tarjeta: la mitad derecha avanza y la izquierda vuelve.
        <View style={[StyleSheet.absoluteFill, styles.tourBackdrop, styles.tourHalves]}>
          <Pressable
            testID="buttons-tour-back"
            accessibilityRole="button"
            accessibilityLabel={t('Explicación anterior')}
            accessibilityState={{ disabled: tour.step === 0 }}
            onPress={tour.back}
            style={styles.tourHalf}
          />
          <Pressable
            testID="buttons-tour-catcher"
            accessibilityRole="button"
            accessibilityLabel={t('Siguiente explicación')}
            onPress={tour.next}
            style={styles.tourHalf}
          />
        </View>
      ) : null}
      {safetyOpen ? null : (
        <View style={styles.actions} pointerEvents="box-none">
          <DeckActions
            onDecide={swipeAway}
            disabled={top === null}
            progress={swipeProgress}
            isPremium={isPremium}
            likesLeft={likesLeft}
            onUndo={onUndo}
            onSuperLike={() => swipeAway('like', true)}
            onBoost={onBoost}
            tourStep={tour.step}
          />
        </View>
      )}
    </View>
  );
}

/**
 * La superior: sigue al arrastre solo si es su dueña. Si no lo es —acaba de
 * subir y nadie la ha tocado—, está quieta en el centro aunque el arrastre
 * todavía guarde la salida de la anterior.
 */
function TopCard({
  profile,
  turnKey,
  drag,
  viewerSpecialties,
  viewerSchedule,
  safetyOpen,
  onSafetyOpenChange,
  onBlocked,
  tapHint,
  onPageChange,
}: {
  profile: DeckProfile;
  turnKey: string | null;
  drag: Drag;
  viewerSpecialties?: Specialty[];
  /** Jornada de quien swipea: la tarjeta marca en qué franjas coincidís. */
  viewerSchedule?: DaySchedule;
  safetyOpen: boolean;
  onSafetyOpenChange: (open: boolean) => void;
  onBlocked: () => void;
  tapHint: boolean;
  onPageChange: () => void;
}) {
  const elevation = Elevation[useThemeName()];
  const router = useRouter();
  const { width } = useWindowDimensions();
  const id = profile.id;
  const { translateX, translateY, owner, exited } = drag;

  const cardStyle = useAnimatedStyle(() => {
    const mine = owner.get() === turnKey;
    const x = mine ? translateX.get() : 0;
    const y = mine ? translateY.get() : 0;
    const rotation = interpolate(
      x,
      [-width, 0, width],
      [-MAX_ROTATION, 0, MAX_ROTATION],
      Extrapolation.CLAMP
    );

    return {
      opacity: mine && exited.get() ? 0 : 1,
      transform: [{ translateX: x }, { translateY: y }, { rotate: rotation + 'deg' }, { scale: 1 }],
    };
  });

  // Desplazamiento de esta tarjeta para el velo y el sello: 0 si el arrastre no es suyo.
  const offset = useDerivedValue(() => (owner.get() === turnKey ? translateX.get() : 0));

  return (
    <Animated.View
      testID={cardTestId(id)}
      style={[styles.card, styles.cardTop, { boxShadow: elevation.raised }, cardStyle]}>
      <ProfileCard
        profile={profile}
        viewerSpecialties={viewerSpecialties}
        viewerSchedule={viewerSchedule}
        safetyOpen={safetyOpen}
        onSafetyOpenChange={onSafetyOpenChange}
        onBlocked={onBlocked}
        bottomInset={DECK_ACTIONS_SPACE}
        tapHint={tapHint}
        onPageChange={onPageChange}
        onOpenProfile={() => router.push({ pathname: '/person/[id]', params: { id } })}
      />

      {/* Velo y corazón o cruz que van apareciendo a medida que se arrastra. */}
      <SwipeOverlay offset={offset} />
    </Animated.View>
  );
}

/**
 * Una de detrás. Su puesto sale del hilo de UI, no solo de su índice: si la de
 * delante ya salió (`exited`), sube uno aunque React todavía no la haya
 * retirado. La de justo detrás de la que se arrastra avanza con el arrastre.
 */
function BehindCard({
  profile,
  index,
  frontKey,
  drag,
  viewerSpecialties,
  viewerSchedule,
}: {
  profile: DeckProfile;
  index: number;
  /** Turno de la superior actual: si el arrastre es suyo, esta la sigue. */
  frontKey: string | null;
  drag: Drag;
  viewerSpecialties?: Specialty[];
  /** Jornada de quien swipea: la tarjeta marca en qué franjas coincidís. */
  viewerSchedule?: DaySchedule;
}) {
  const theme = useTheme();
  const { translateX, owner, exited } = drag;

  // El contenido de las de detrás no se lee: asomaría por debajo de la de
  // delante como texto cortado. Solo la que sube recupera su contenido, a la
  // par que el arrastre de la de delante.
  const contentStyle = useAnimatedStyle(() => {
    const frontIsDragged = owner.get() !== null && owner.get() === frontKey;
    const frontGone = frontIsDragged && exited.get();
    const depth = frontGone ? index - 1 : index;
    const progress =
      index === 1 && frontIsDragged && !frontGone
        ? interpolate(Math.abs(translateX.get()), [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP)
        : 0;
    return { opacity: interpolate(depth - progress, [0, 1], [1, 0], Extrapolation.CLAMP) };
  });

  const style = useAnimatedStyle(() => {
    const frontIsDragged = owner.get() !== null && owner.get() === frontKey;
    const frontGone = frontIsDragged && exited.get();
    const depth = frontGone ? index - 1 : index;
    // Solo la de justo detrás sigue al arrastre, y solo mientras la superior
    // sigue ahí: una vez fuera, su desplazamiento de salida ya no cuenta.
    const progress =
      index === 1 && frontIsDragged && !frontGone
        ? interpolate(Math.abs(translateX.get()), [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP)
        : 0;

    return {
      // Las de detrás se apagan con la profundidad: el cristal de atrás recibe
      // menos luz. Al avanzar, la que sube recupera el brillo con el arrastre.
      opacity: 1 - DEPTH_DIM * (depth - progress),
      transform: [
        { translateX: 0 },
        { translateY: DEPTH_OFFSET * (depth - progress) },
        { rotate: '0deg' },
        { scale: 1 - DEPTH_SCALE * (depth - progress) },
      ],
    };
  });

  return (
    <Animated.View
      testID={cardTestId(profile.id)}
      // Se pintan detrás y no se pueden decidir todavía: para un lector de
      // pantalla solo son ruido delante de la tarjeta real.
      aria-hidden
      style={[styles.card, styles.cardBehind, { backgroundColor: theme.surfaceOpaque }, style]}>
      <Animated.View style={[styles.behindContent, contentStyle]}>
        <ProfileCard
          profile={profile}
          viewerSpecialties={viewerSpecialties}
          viewerSchedule={viewerSchedule}
          bottomInset={DECK_ACTIONS_SPACE}
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  deck: {
    flex: 1,
  },
  card: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  cardBehind: {
    pointerEvents: 'none',
    borderRadius: Radii.card,
    overflow: 'hidden',
  },
  behindContent: {
    flex: 1,
  },
  cardTop: {
    borderRadius: Radii.card,
  },
  tourBackdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  tourHalves: { flexDirection: 'row' },
  tourHalf: { flex: 1 },
  actions: {
    position: 'absolute',
    right: 0,
    bottom: Spacing.four,
    left: 0,
  },
});
