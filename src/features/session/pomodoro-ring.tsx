/**
 * Anillo del Pomodoro: la cuenta atrás de la fase dibujada como un arco que se
 * completa, con la cifra grande y fina en el centro.
 *
 * El arco avanza de forma continua aunque la hora llegue a saltos de un
 * segundo: cada tic anima el tramo que falta con una curva lineal de la misma
 * duración que el tic, así que el trazo nunca se para ni se adelanta. Al
 * cambiar de fase (trabajo → descanso) vuelve a cero con un barrido corto. Con
 * «reducir movimiento» salta de valor en valor, sin recorrido.
 *
 * Trabajo en brasa, descanso en verde-azulado: el color dice qué toca sin leer.
 * Solo presenta: la fase la calcula `phaseAt`, que es pura.
 */

import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { Glow } from '@/components/glow';
import { Curves, Duration } from '@/constants/theme';
import { BLOCK_MINUTES, WORK_MINUTES } from '@/data';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';

import type { Phase } from './phase';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const MINUTE = 60_000;
/** Grosor del arco. */
const STROKE = 8;
/** Lo que dura un tic del reloj de la pantalla: el arco anima justo eso. */
const TICK_MS = 1000;

/** Fracción completada de la fase (0–1). Antes de empezar, nada. */
export function phaseProgress(phase: Phase): number {
  const total =
    phase.kind === 'trabajo'
      ? WORK_MINUTES * MINUTE
      : phase.kind === 'descanso'
        ? (BLOCK_MINUTES - WORK_MINUTES) * MINUTE
        : 0;
  if (total === 0) return phase.kind === 'terminada' ? 1 : 0;
  return Math.min(1, Math.max(0, 1 - phase.remainingMs / total));
}

export function PomodoroRing({
  phase,
  size = 240,
  children,
}: {
  phase: Phase;
  size?: number;
  /** La cifra y la etiqueta que van en el centro. */
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const radius = (size - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const target = phaseProgress(phase);
  const color = phase.kind === 'descanso' ? theme.teal : theme.brass;

  const progress = useSharedValue(target);

  useEffect(() => {
    if (reduceMotion) {
      progress.set(target);
      return;
    }
    // Hacia atrás solo se va al cambiar de fase: barrido corto y con frenada.
    const restarting = target < progress.get();
    progress.set(
      withTiming(
        target,
        restarting
          ? { duration: Duration.slow, easing: Easing.bezier(...Curves.inOut) }
          : { duration: TICK_MS, easing: Easing.linear }
      )
    );
  }, [target, reduceMotion, progress]);

  const arc = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.get()),
  }));

  return (
    <View style={[styles.root, { width: size, height: size }]}>
      <Glow
        color={color}
        opacity={0.35}
        style={{ width: size * 1.5, height: size * 1.5, left: -size * 0.25, top: -size * 0.25 }}
      />
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.backgroundSelected}
          strokeWidth={STROKE}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={arc}
          // Empieza arriba, a las doce, como un reloj.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.center}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    gap: 2,
  },
});
