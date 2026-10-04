/**
 * Deck de tarjetas con gesto de swipe.
 *
 * Es el corazón de la identidad del producto, así que el gesto manda: la
 * tarjeta sigue al dedo, se inclina, y al soltar decide por umbral o por
 * velocidad (un flick corto pero rápido también cuenta). Los botones de
 * `DeckActions` disparan exactamente la misma animación de salida para que
 * ambos caminos se sientan iguales.
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
 * Con «reducir movimiento» activado en el sistema, la tarjeta llega al MISMO
 * estado final sin el recorrido: misma decisión, mismo `onDecide`, misma lógica
 * de match aguas arriba. Lo que se apaga es solo lo que se mueve solo —la salida
 * de pantalla y el rebote de vuelta al centro—, nunca el seguimiento del dedo:
 * eso es manipulación directa y quitarla dejaría el deck sin feedback.
 */

import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  runOnUI,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Curves, Duration, Elevation, Radii, Spacing, Springs, Stroke } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme, useThemeName } from '@/hooks/use-theme';

import { DeckActions } from './deck-actions';
import { ProfileCard } from './profile-card';

import type { SharedValue } from 'react-native-reanimated';
import type { Decision, Profile, Specialty } from '@/data';

/** Desplazamiento a partir del cual soltar cuenta como decisión. */
const SWIPE_THRESHOLD = 110;
/** Velocidad a la que un flick corto también decide. */
const FLICK_VELOCITY = 800;
/** Inclinación máxima de la tarjeta, en grados. */
const MAX_ROTATION = 12;
/** Cuántas tarjetas se pintan a la vez. Las demás no se ven. */
const VISIBLE_CARDS = 3;
/** Cuánto encoge y baja cada tarjeta por cada puesto que tiene delante. */
const DEPTH_SCALE = 0.04;
const DEPTH_OFFSET = 14;
/** Cuánto se apaga cada tarjeta de detrás por puesto de profundidad. */
const DEPTH_DIM = 0.35;

/** Salida de pantalla: arranca con la velocidad del gesto y frena al final. */
const EXIT_TIMING = { duration: Duration.base, easing: Easing.bezier(...Curves.out) };

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
}: {
  profiles: Profile[];
  /** Se llama una vez por tarjeta, cuando la animación de salida termina. */
  onDecide: (profile: Profile, decision: Decision) => void;
  /** Lo que domina quien swipea. Solo lo reenvía a la tarjeta, que lo resalta. */
  viewerSpecialties?: Specialty[];
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

  const top = profiles.length > 0 ? profiles[0] : null;
  const topId = top?.id ?? null;
  const exitDistance = width + 160;

  // Cada vez que cambia la superior empieza un turno nuevo. Es estado derivado
  // de las props, así que se ajusta durante el render (patrón de React para
  // esto) y la nueva superior se pinta ya con su turno, en el mismo commit.
  const [turn, setTurn] = useState({ topId, count: 0 });
  if (turn.topId !== topId) setTurn({ topId, count: turn.count + 1 });
  const turnKey = topId === null ? null : `${turn.count}:${topId}`;

  /** Cierra la decisión. La tarjeta ya está oculta: aquí solo se avisa al padre. */
  function settle(profile: Profile, decision: Decision) {
    exiting.set(false);
    onDecide(profile, decision);
  }

  /** Salida animada disparada desde los botones (el gesto tiene la suya). */
  function swipeAway(decision: Decision) {
    if (top === null || exiting.get()) return;
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
      settle(profile, decision);
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
          runOnJS(settle)(profile, decision);
        })
      );
    })();
  }

  const pan = Gesture.Pan()
    // El id es la única forma de alcanzar el gesto desde un test:
    // `getByGestureTestId` de `react-native-gesture-handler/jest-utils`.
    .withTestId(PAN_TEST_ID)
    .enabled(top !== null)
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

      const liked = translateX.get() > SWIPE_THRESHOLD || event.velocityX > FLICK_VELOCITY;
      const passed = translateX.get() < -SWIPE_THRESHOLD || event.velocityX < -FLICK_VELOCITY;

      if (!liked && !passed) {
        translateX.set(reduceMotion ? 0 : withSpring(0, Springs.settle));
        translateY.set(reduceMotion ? 0 : withSpring(0, Springs.settle));
        return;
      }

      const decision: Decision = liked ? 'like' : 'pass';
      exiting.set(true);

      if (reduceMotion) {
        // La tarjeta se oculta donde la soltó el dedo y el padre la retira: el
        // deck pasa a la siguiente sin que nada recorra la pantalla.
        exited.set(true);
        runOnJS(settle)(top, decision);
        return;
      }

      // La tarjeta mantiene el arco del gesto al salir: sube o baja según iba.
      translateY.set(withTiming(translateY.get() + event.velocityY * 0.1, EXIT_TIMING));
      translateX.set(
        withTiming(liked ? exitDistance : -exitDistance, EXIT_TIMING, (finished) => {
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
            />
          ) : (
            <GestureDetector key={profile.id} gesture={pan}>
              <TopCard
                profile={profile}
                turnKey={turnKey}
                drag={drag}
                viewerSpecialties={viewerSpecialties}
              />
            </GestureDetector>
          )
        )}
      </View>

      <DeckActions onDecide={swipeAway} disabled={top === null} />
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
}: {
  profile: Profile;
  turnKey: string | null;
  drag: Drag;
  viewerSpecialties?: Specialty[];
}) {
  const theme = useTheme();
  const elevation = Elevation[useThemeName()];
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

  // El sello crece un poco a la vez que aparece: se lee como un tampón que baja
  // sobre la tarjeta, no como un texto que se enciende.
  const likeStyle = useAnimatedStyle(() => {
    const x = owner.get() === turnKey ? translateX.get() : 0;
    const progress = interpolate(x, [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP);
    return {
      opacity: progress,
      transform: [{ rotate: '-10deg' }, { scale: 0.85 + 0.15 * progress }],
    };
  });

  const passStyle = useAnimatedStyle(() => {
    const x = owner.get() === turnKey ? translateX.get() : 0;
    const progress = interpolate(x, [-SWIPE_THRESHOLD, 0], [1, 0], Extrapolation.CLAMP);
    return {
      opacity: progress,
      transform: [{ rotate: '10deg' }, { scale: 0.85 + 0.15 * progress }],
    };
  });

  return (
    <Animated.View
      testID={cardTestId(id)}
      style={[styles.card, styles.cardTop, { boxShadow: elevation.raised }, cardStyle]}>
      <ProfileCard profile={profile} viewerSpecialties={viewerSpecialties} />

      <Animated.View
        style={[
          styles.badge,
          styles.badgeLike,
          stampFill(theme.surfaceOpaque, theme.tealSoft),
          { borderColor: theme.teal },
          likeStyle,
        ]}>
        <ThemedText type="bodyStrong" style={{ color: theme.teal }}>
          Like
        </ThemedText>
      </Animated.View>

      <Animated.View
        style={[
          styles.badge,
          styles.badgePass,
          stampFill(theme.surfaceOpaque, theme.dangerSoft),
          { borderColor: theme.danger },
          passStyle,
        ]}>
        <ThemedText type="bodyStrong" style={{ color: theme.danger }}>
          Pasar
        </ThemedText>
      </Animated.View>
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
}: {
  profile: Profile;
  index: number;
  /** Turno de la superior actual: si el arrastre es suyo, esta la sigue. */
  frontKey: string | null;
  drag: Drag;
  viewerSpecialties?: Specialty[];
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
      style={[
        styles.card,
        styles.cardBehind,
        {
          backgroundColor: theme.surfaceOpaque,
          borderColor: theme.border,
          boxShadow: `inset 0px 1px 0px ${theme.glassHighlight}`,
        },
        style,
      ]}>
      <Animated.View style={[styles.behindContent, contentStyle]}>
        <ProfileCard profile={profile} viewerSpecialties={viewerSpecialties} />
      </Animated.View>
    </Animated.View>
  );
}

/**
 * Fondo de un sello: base opaca y el tinte encima. El tinte solo es
 * translúcido y el sello cae sobre el avatar, arriba a la izquierda: sin base
 * se leían a la vez las iniciales y el «Like», y no se entendía ninguno.
 */
function stampFill(base: string, tint: string) {
  return { backgroundColor: base, boxShadow: `inset 0px 0px 0px 999px ${tint}` };
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    gap: Spacing.four,
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
    borderWidth: Stroke.hairline,
  },
  behindContent: {
    flex: 1,
  },
  cardTop: {
    borderRadius: Radii.card,
  },
  badge: {
    position: 'absolute',
    pointerEvents: 'none',
    top: Spacing.four,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three + Spacing.one,
    borderRadius: Radii.pill,
    borderWidth: Stroke.strong,
  },
  badgeLike: {
    left: Spacing.four,
  },
  badgePass: {
    right: Spacing.four,
  },
});
