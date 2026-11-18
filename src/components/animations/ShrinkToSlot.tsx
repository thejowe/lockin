import {
  createContext,
  useContext,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import type { ViewInstance } from 'react-native';
import {
  cancelAnimation,
  Easing,
  ReduceMotion,
  setNativeProps,
  useAnimatedReaction,
  useAnimatedRef,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

import type { SheetMotionStyle } from '@/components/BottomSheet';
import { Curves, Duration } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';

import { arrivalImpact } from './haptics';

type Rect = Pick<DOMRect, 'x' | 'y' | 'width' | 'height'>;
type Flight = { dx: number; dy: number; sx: number; sy: number };

function valid(rect?: Rect): rect is Rect {
  return (
    !!rect &&
    rect.width > 0 &&
    rect.height > 0 &&
    [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)
  );
}

/**
 * El panel de BottomSheet es un `Animated.View`: en nativo su ref es la instancia
 * de clase de Reanimated, que no tiene `getBoundingClientRect`. Se mide la vista
 * nativa que envuelve. Sin esto la trayectoria salía `null` y solo quedaba el fundido.
 */
function host(view: ViewInstance | null): ViewInstance | null {
  if (!view || typeof view.getBoundingClientRect === 'function') return view;
  return (view as { _componentRef?: ViewInstance | null })._componentRef ?? view;
}

function trajectory(sheet: ViewInstance | null, card: ViewInstance | null): Flight | null {
  const from = host(sheet)?.getBoundingClientRect?.();
  const to = host(card)?.getBoundingClientRect?.();
  if (!valid(from) || !valid(to)) return null;
  return {
    dx: to.x - from.x + (to.width - from.width) / 2,
    dy: to.y - from.y + (to.height - from.height) / 2,
    sx: to.width / from.width,
    sy: to.height / from.height,
  };
}

function sheetFrame(progress: number, path: Flight | null): SheetMotionStyle {
  'worklet';
  if (!path) return { opacity: 1 - progress, transform: [] };
  return {
    opacity: Math.min(1, (1 - progress) * 4),
    transform: [
      { translateX: path.dx * progress },
      { translateY: path.dy * progress },
      { scaleX: 1 + (path.sx - 1) * progress },
      { scaleY: 1 + (path.sy - 1) * progress },
    ],
  };
}

/**
 * Mount once per confirmed creation, beside the still-open editor. The real card is
 * already laid out behind the modal. onLand closes the editor and reveals that card.
 * The panel belongs to BottomSheet, hence a UI-thread native update on its existing ref.
 */
export function ShrinkToSlot({
  sheet,
  motion,
  slot,
  reduced,
  onLand,
}: {
  sheet: ViewInstance | null;
  /** El estilo de vuelo de la propia hoja (BottomSheetMotion). Sin él, setNativeProps. */
  motion: SharedValue<SheetMotionStyle | null> | null;
  slot: RefObject<ViewInstance | null>;
  reduced: boolean;
  onLand: () => void;
}) {
  const panel = useAnimatedRef<ViewInstance>();
  const hasSheet = sheet !== null;
  const path = useSharedValue<Flight | null>(null);
  const progress = useSharedValue(-1);
  const landed = useRef(false);
  const callback = useRef(onLand);
  useLayoutEffect(() => {
    callback.current = onLand;
  }, [onLand]);

  useAnimatedReaction(
    () => ({ p: progress.get(), flight: path.get() }),
    ({ p, flight }) => {
      if (p < 0) return;
      if (hasSheet && motion) motion.set(sheetFrame(p, flight));
      else setNativeProps(panel, hasSheet ? sheetFrame(p, flight) : { opacity: p });
    }
  );

  useLayoutEffect(() => {
    if (landed.current) return;
    let live = true;
    let attached = false;
    const complete = () => {
      if (!live || landed.current) return;
      landed.current = true;
      arrivalImpact('project');
      callback.current();
    };
    // Give Fabric the layout commit that inserts the destination into the list.
    const frame = requestAnimationFrame(() => {
      const surface = sheet ?? slot.current;
      if (!surface) {
        complete();
        return;
      }
      if (!(sheet && motion)) panel(surface);
      attached = true;
      const flight = reduced ? null : trajectory(sheet, slot.current);
      path.set(flight);
      progress.set(0);
      progress.set(
        withTiming(
          1,
          {
            duration: flight ? Duration.slow : Duration.fast,
            easing: Easing.bezier(...Curves.glide),
            reduceMotion: flight ? ReduceMotion.System : ReduceMotion.Never,
          },
          (finished) => {
            if (finished) scheduleOnRN(complete);
          }
        )
      );
    });
    return () => {
      live = false;
      cancelAnimationFrame(frame);
      cancelAnimation(progress);
      if (!landed.current) {
        progress.set(-1);
        if (attached && sheet && motion) motion.set(null);
        else if (attached)
          scheduleOnUI(() => {
            'worklet';
            setNativeProps(panel, { opacity: 1, transform: [] });
          });
      }
    };
  }, [sheet, motion, slot, reduced, panel, path, progress]);
  return null;
}

type SheetMotion = SharedValue<SheetMotionStyle | null>;
type Save = {
  id: string;
  sheet: ViewInstance | null;
  motion: SheetMotion | null;
  done: Promise<void>;
  resolve: () => void;
};
type PanelRef = RefObject<ViewInstance | null>;
type Source = { frame: PanelRef | null; motion: SheetMotion | null };
export const ProjectSheetSource = createContext<RefObject<Source | null> | null>(null);

/** Register BottomSheetFrame (and its motion style) from inside its provider. Read on save. */
export function useProjectSheet(frame: PanelRef | null, motion: SheetMotion | null = null) {
  const sourceRef = useContext(ProjectSheetSource);
  useLayoutEffect(() => {
    if (!sourceRef) return;
    sourceRef.current = { frame, motion };
    return () => {
      sourceRef.current = null;
    };
  }, [sourceRef, frame, motion]);
}

/** Await onProjectSaved inside the editor's existing save lock, then close it. */
export function useProjectSaveMotion() {
  const reduced = useReduceMotion();
  const slot = useRef<ViewInstance>(null);
  const source = useRef<Source | null>(null);
  const seen = useRef(new Set<string>());
  const current = useRef<Save | null>(null);
  const [save, setSave] = useState<Save | null>(null);
  const [landedId, setLandedId] = useState<string>();
  useLayoutEffect(
    () => () => {
      current.current?.resolve();
      current.current = null;
    },
    []
  );

  const onProjectSaved = useCallback((id: string) => {
    if (current.current) return current.current.done;
    if (seen.current.has(id)) return Promise.resolve();
    seen.current.add(id);
    let resolve!: () => void;
    const done = new Promise<void>((finish) => {
      resolve = finish;
    });
    const next = {
      id,
      sheet: source.current?.frame?.current ?? null,
      motion: source.current?.motion ?? null,
      done,
      resolve,
    };
    current.current = next;
    setSave(next);
    return done;
  }, []);
  const transition = save && (
    <ShrinkToSlot
      key={save.id}
      sheet={save.sheet}
      motion={save.motion}
      slot={slot}
      reduced={reduced}
      onLand={() => {
        if (current.current !== save) return;
        current.current = null;
        setLandedId(save.id);
        setSave(null);
        save.resolve();
      }}
    />
  );
  return { onProjectSaved, projectId: save?.id, landedId, source, slot, transition };
}
