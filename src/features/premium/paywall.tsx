/**
 * El paywall de Premium.
 *
 * Los precios salen siempre de `getOfferings()` (`priceString`): aquí no hay
 * ninguno escrito a mano. Tras una compra se pide al servidor que relea la
 * suscripción (`syncEntitlement`) y solo se cierra cuando los cupos dicen que
 * Premium está activo: la tienda cobra, el servidor decide.
 *
 * Cancelar la compra no es un error. Un pago `pending` (p. ej. pendiente de
 * aprobación) se cuenta tal cual y no se cierra nada.
 *
 * ## Diseño (2026-11-10)
 *
 * Noche azul con el diamante como única fuente de luz, al estilo de las pantallas
 * de pago que convierten: héroe brillante arriba, beneficios con su icono en una
 * placa de cristal, planes en tarjetas con radio y la insignia «Mejor valor» en
 * el anual, y el botón de compra fijo abajo, en degradado y con un barrido de
 * luz. Cerrar es la X de arriba; Restaurar, Gestionar suscripción (cancelar en
 * la tienda) y los textos legales van como enlaces discretos al pie.
 *
 * Orden: héroe, título, lo que incluye Premium y después los precios (primero
 * se cuenta qué se gana, luego cuánto cuesta; decisión del usuario del
 * 2026-11-11). Todo entra en escalera
 * (`entranceDelay` lo retrasa hasta que el diamante de `src/app/premium.tsx`
 * ha tapado la pantalla).
 */

import * as Haptics from 'expo-haptics';
import { useEffect, useId, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Button } from '@/components/button';
import { Icon, type IconName } from '@/components/icon';
import { LoadingState, MessageState } from '@/components/state-view';
import { ThemedText } from '@/components/themed-text';
import {
  Control,
  Curves,
  Duration,
  FontFamily,
  MaxContentWidth,
  Opacity,
  PremiumTones,
  Radii,
  Spacing,
  Stagger,
  Stroke,
} from '@/constants/theme';
import { useRepositories } from '@/data';
import { setMockPremium } from '@/data/mock';
import { hasSupabaseCredentials } from '@/data/supabase/client';
import { usePressScale } from '@/hooks/use-press-scale';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';
import {
  PurchasesUnavailableError,
  getOfferings,
  manageSubscriptionsUrl,
  purchase,
  restore,
  type FreeTrial,
  type PurchasePackage,
} from '@/lib/purchases';

import { HeroGem, PremiumHalo } from './premium-visuals';

import type { LegalDocKey } from '@/features/legal';
import { t, tk } from '@/i18n';

const BENEFITS: { icon: IconName; label: string }[] = [
  { icon: 'heart', label: tk('Likes sin límite') },
  { icon: 'back', label: tk('Deshacer tu último swipe') },
  { icon: 'eye', label: tk('Ver quién te ha dado like') },
  { icon: 'sparkle', label: tk('5 Super Likes a la semana') },
  { icon: 'flame', label: tk('Boost: 30 minutos arriba del deck cada mes') },
  {
    icon: 'chevrons',
    label: tk('Filtros avanzados: disponibilidad, ambición, punto de partida y zona horaria'),
  },
];

const RENEWAL = tk('Se renueva automáticamente. Cancela cuando quieras desde la tienda.');

const easeOut = Easing.bezier(...Curves.out);
/** Paso de la escalera entre bloques (título, beneficios, planes): «standard», no micro. */
const BLOCK_STEP = Stagger * 2;

type OffersState =
  | { status: 'loading' }
  | { status: 'ready'; offers: PurchasePackage[] }
  | { status: 'unavailable' }
  | { status: 'error' };

function periodLabel(offer: PurchasePackage): string {
  return offer.period === 'month' ? t('Mensual') : t('Anual');
}

function periodSuffix(offer: PurchasePackage): string {
  return offer.period === 'month' ? t('al mes') : t('al año');
}

/** «3 días gratis». Sin plurales en `t`, cada unidad lleva su singular y su plural. */
function trialLength(trial: FreeTrial): string {
  const one = trial.count === 1;
  switch (trial.unit) {
    case 'day':
      return one ? t('1 día gratis') : t('{count} días gratis', { count: trial.count });
    case 'week':
      return one ? t('1 semana gratis') : t('{count} semanas gratis', { count: trial.count });
    case 'month':
      return one ? t('1 mes gratis') : t('{count} meses gratis', { count: trial.count });
    case 'year':
      return one ? t('1 año gratis') : t('{count} años gratis', { count: trial.count });
  }
}

/**
 * «3 días gratis, luego 4,99 € al mes» (Apple 3.1.2: qué se cobra al acabar la prueba).
 * Solo existe si la tienda dice que esta persona tiene derecho a la prueba.
 */
function trialText(offer: PurchasePackage): string | null {
  if (!offer.freeTrial) return null;
  return t('{trial}, luego {price} {period}', {
    trial: trialLength(offer.freeTrial),
    price: offer.priceString,
    period: periodSuffix(offer),
  });
}

/** Una tecla háptica de selección (solo iOS: en Android casi nunca se siente igual). */
function tick() {
  if (Platform.OS === 'ios') void Haptics.selectionAsync();
}

export function Paywall({
  onClose,
  onOpenLegal,
  entranceDelay = 0,
}: {
  /** Cierra el paywall (tras comprar o con la X). */
  onClose: () => void;
  /** Abre Términos o Privacidad. */
  onOpenLegal: (doc: LegalDocKey) => void;
  /**
   * Cuánto esperar antes de que entre el contenido: lo que tarda el diamante en
   * tapar la pantalla. 0 si se abre sin esa animación.
   */
  entranceDelay?: number;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const repositories = useRepositories();
  const [state, setState] = useState<OffersState>({ status: 'loading' });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [simulated, setSimulated] = useState(false);

  // El interruptor refleja el Premium real del mock, no un `false` de partida.
  useEffect(() => {
    let cancelled = false;
    void repositories.premium.getQuotas().then(
      (quotas) => {
        if (!cancelled) setSimulated(quotas.isPremium);
      },
      () => {}
    );
    return () => {
      cancelled = true;
    };
  }, [repositories]);

  // Cada cambio de `attempt` vuelve a pedir las ofertas («Reintentar»).
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getOfferings().then(
      (offers) => {
        if (cancelled) return;
        setSelectedId((current) =>
          offers.some((offer) => offer.id === current)
            ? current
            : ((offers.find((offer) => offer.period === 'year') ?? offers[0])?.id ?? null)
        );
        setState({ status: 'ready', offers });
      },
      (cause: unknown) => {
        if (cancelled) return;
        setState({ status: cause instanceof PurchasesUnavailableError ? 'unavailable' : 'error' });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  /** Relee la suscripción en el servidor y cierra si Premium ya está activo. */
  async function settle(): Promise<boolean> {
    await repositories.premium.syncEntitlement();
    const quotas = await repositories.premium.getQuotas();
    if (quotas.isPremium) {
      if (Platform.OS === 'ios') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      onClose();
      return true;
    }
    return false;
  }

  async function handleBuy() {
    if (!selectedId || busy) return;
    setBusy('buy');
    setNotice(null);
    try {
      const result = await purchase(selectedId);
      if (result === 'cancelled') return;
      if (result === 'pending') {
        setNotice(t('Pago pendiente de confirmar'));
        return;
      }
      if (!(await settle())) {
        setNotice(t('Tu compra se está procesando. Si no se activa, prueba «Restaurar compras».'));
      }
    } catch {
      setNotice(t('No hemos podido completar la compra. Inténtalo otra vez.'));
    } finally {
      setBusy(null);
    }
  }

  async function handleRestore() {
    if (busy) return;
    setBusy('restore');
    setNotice(null);
    try {
      await restore();
      if (!(await settle())) setNotice(t('No hemos encontrado ninguna suscripción activa.'));
    } catch (cause) {
      setNotice(
        cause instanceof PurchasesUnavailableError
          ? cause.message
          : t('No hemos podido restaurar tus compras. Inténtalo otra vez.')
      );
    } finally {
      setBusy(null);
    }
  }

  function handleSimulate(next: boolean) {
    setSimulated(next);
    setMockPremium(next);
    if (next) onClose();
  }

  function handleSelect(id: string) {
    if (id !== selectedId) tick();
    setSelectedId(id);
  }

  /** La entrada del bloque `step`: sube unos píxeles y se enciende, tras el diamante. */
  const rise = (step: number) =>
    FadeInDown.duration(Duration.slow)
      .easing(easeOut)
      .delay(entranceDelay + step * BLOCK_STEP);

  const showSimulator = __DEV__ && !hasSupabaseCredentials;
  const offers = state.status === 'ready' ? state.offers : [];
  const selectedOffer = offers.find((offer) => offer.id === selectedId);
  const selectedTrial = selectedOffer ? trialText(selectedOffer) : null;
  const showBadge = offers.length > 1;

  return (
    <View style={styles.root}>
      <PremiumHalo />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.inner}>
          <View style={styles.topBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('Ahora no')}
              hitSlop={8}
              onPress={onClose}
              style={({ pressed }) => [
                styles.close,
                {
                  backgroundColor: theme.backgroundElement,
                  borderColor: theme.border,
                  opacity: pressed ? Opacity.pressed : 1,
                },
              ]}>
              <Icon name="close" size={18} color={theme.text} strokeWidth={2} />
            </Pressable>
          </View>

          <Animated.View entering={FadeIn.duration(Duration.slow).delay(entranceDelay)}>
            <HeroGem />
          </Animated.View>

          <Animated.View entering={rise(0)} style={styles.header}>
            <View
              style={[
                styles.eyebrow,
                { borderColor: `${PremiumTones.gemMid}66`, backgroundColor: theme.brassSoft },
              ]}>
              <ThemedText type="label" style={{ color: PremiumTones.gemLight }}>
                {t('Premium')}
              </ThemedText>
            </View>
            <ThemedText type="display" style={styles.centered}>
              {t('Encuentra cofundador sin frenos')}
            </ThemedText>
            <ThemedText type="body" themeColor="textSecondary" style={styles.centered}>
              {t('Más matches, menos espera.')}
            </ThemedText>
          </Animated.View>

          <Animated.View
            entering={rise(1)}
            style={[
              styles.benefits,
              {
                backgroundColor: theme.backgroundElement,
                borderColor: theme.border,
                boxShadow: `inset 0px 1px 0px ${theme.glassHighlight}`,
              },
            ]}>
            {BENEFITS.map((benefit) => (
              <View key={benefit.label} style={styles.benefit}>
                <View style={[styles.benefitIcon, { backgroundColor: theme.brassSoft }]}>
                  <Icon name={benefit.icon} size={18} color={theme.brass} strokeWidth={2} />
                </View>
                <ThemedText type="body" style={styles.flex}>
                  {t(benefit.label)}
                </ThemedText>
              </View>
            ))}
          </Animated.View>

          {state.status === 'loading' ? (
            <LoadingState label={t('Cargando los planes…')} style={styles.plansLoading} />
          ) : state.status === 'ready' ? (
            <Animated.View
              entering={entranceDelay > 0 ? rise(2) : FadeIn.duration(Duration.base)}
              style={styles.plans}>
              {offers.map((offer) => (
                <PlanCard
                  key={offer.id}
                  offer={offer}
                  selected={offer.id === selectedId}
                  badge={showBadge && offer.period === 'year'}
                  onPress={() => handleSelect(offer.id)}
                />
              ))}
            </Animated.View>
          ) : (
            <MessageState
              style={styles.plansLoading}
              title={
                state.status === 'unavailable'
                  ? t('Las compras aún no están disponibles')
                  : t('No hemos podido cargar los planes')
              }
              body={
                state.status === 'unavailable'
                  ? t('Vuelve a mirar en unos días.')
                  : t('Comprueba tu conexión e inténtalo otra vez.')
              }>
              {state.status === 'error' ? (
                <Button
                  label={t('Reintentar')}
                  variant="secondary"
                  onPress={() => {
                    setState({ status: 'loading' });
                    setAttempt((n) => n + 1);
                  }}
                />
              ) : null}
            </MessageState>
          )}

          {notice ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
              {notice}
            </ThemedText>
          ) : null}

          <View style={styles.links}>
            <FooterLink
              role="button"
              label={busy === 'restore' ? t('Restaurando…') : t('Restaurar compras')}
              disabled={busy !== null}
              onPress={() => void handleRestore()}
            />
            <FooterLink
              role="link"
              label={t('Gestionar suscripción')}
              onPress={() => void Linking.openURL(manageSubscriptionsUrl())}
            />
            <FooterLink
              role="link"
              label={t('Términos de uso')}
              onPress={() => onOpenLegal('terms')}
            />
            <FooterLink
              role="link"
              label={t('Política de privacidad')}
              onPress={() => onOpenLegal('privacy')}
            />
          </View>

          {showSimulator ? (
            <View style={[styles.simulator, { borderColor: theme.border }]}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('Solo desarrollo')}
              </ThemedText>
              <ThemedText type="body" style={styles.flex}>
                {t('Simular Premium')}
              </ThemedText>
              <Switch
                accessibilityLabel={t('Simular Premium')}
                value={simulated}
                onValueChange={handleSimulate}
              />
            </View>
          ) : null}
        </View>
      </ScrollView>

      {state.status === 'ready' ? (
        <Animated.View
          entering={rise(3)}
          style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.three) }]}>
          <FooterFade />
          <View style={styles.footerInner}>
            <BuyButton
              label={busy === 'buy' ? t('Comprando…') : t('Hazte Premium')}
              disabled={busy !== null || selectedId === null}
              onPress={() => void handleBuy()}
            />
            {selectedTrial ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
                {selectedTrial}
              </ThemedText>
            ) : null}
            <ThemedText type="caption" themeColor="textMuted" style={styles.centered}>
              {t(RENEWAL)}
            </ThemedText>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

/**
 * Un plan: radio a la izquierda, nombre y precio por mes en medio, precio total a
 * la derecha. El elegido se enciende con el azul del diamante; el anual lleva
 * «Mejor valor» montado sobre el canto.
 */
function PlanCard({
  offer,
  selected,
  badge,
  onPress,
}: {
  offer: PurchasePackage;
  selected: boolean;
  badge: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const press = usePressScale();
  const trial = trialText(offer);

  return (
    <Animated.View style={press.style}>
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={
          trial
            ? `${periodLabel(offer)}, ${trial}`
            : `${periodLabel(offer)}, ${offer.priceString} ${periodSuffix(offer)}`
        }
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={[
          styles.plan,
          selected
            ? {
                backgroundColor: theme.backgroundSelected,
                borderColor: PremiumTones.gemMid,
                borderWidth: Stroke.strong,
                boxShadow: `0px 10px 30px ${PremiumTones.halo}55`,
              }
            : {
                backgroundColor: theme.backgroundElement,
                borderColor: theme.border,
                borderWidth: Stroke.thin,
                // Mismo hueco total que con el trazo grueso: elegir no mueve nada.
                padding: Spacing.three + (Stroke.strong - Stroke.thin),
              },
        ]}>
        <Radio selected={selected} />
        <View style={styles.flex}>
          <ThemedText type="heading">{periodLabel(offer)}</ThemedText>
          {offer.period === 'year' ? (
            <ThemedText type="small" themeColor="textSecondary">
              {`${offer.pricePerMonthString} ${t('al mes')}`}
            </ThemedText>
          ) : null}
          {offer.freeTrial ? (
            <ThemedText type="smallBold" themeColor="brass">
              {trialLength(offer.freeTrial)}
            </ThemedText>
          ) : null}
        </View>
        <ThemedText type="bodyStrong" style={styles.price}>
          {`${offer.priceString} ${periodSuffix(offer)}`}
        </ThemedText>
      </Pressable>
      {badge ? (
        <View pointerEvents="none" style={[styles.badge, { backgroundColor: PremiumTones.badge }]}>
          <ThemedText type="caption" style={[styles.badgeText, { color: PremiumTones.onBadge }]}>
            {t('Mejor valor')}
          </ThemedText>
        </View>
      ) : null}
    </Animated.View>
  );
}

/** El radio del plan: el punto crece y se enciende al elegirlo (180 ms, sin rebote). */
function Radio({ selected }: { selected: boolean }) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const on = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    const target = selected ? 1 : 0;
    on.set(reduceMotion ? target : withTiming(target, { duration: 180, easing: easeOut }));
  }, [selected, reduceMotion, on]);

  const dot = useAnimatedStyle(() => ({
    opacity: on.get(),
    transform: [{ scale: 0.6 + on.get() * 0.4 }],
  }));

  return (
    <View style={[styles.radio, { borderColor: selected ? PremiumTones.gemMid : theme.textMuted }]}>
      <Animated.View style={[styles.radioDot, { backgroundColor: PremiumTones.gemMid }, dot]}>
        <Icon name="check" size={14} color={PremiumTones.night} strokeWidth={2.6} />
      </Animated.View>
    </View>
  );
}

/**
 * El botón de compra: píldora en degradado de cian a azul con un halo debajo y
 * un barrido de luz que cruza cada pocos segundos (la invitación, no un
 * parpadeo). Sin barrido con «reducir movimiento» o mientras está desactivado.
 */
function BuyButton({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const press = usePressScale();
  const reduceMotion = useReduceMotion();
  const id = useId().replace(/:/g, '');
  const fill = `cta-${id}`;
  const sheen = `cta-sheen-${id}`;
  const [width, setWidth] = useState(0);
  const sweep = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion || disabled || width === 0) {
      sweep.set(0);
      return;
    }
    sweep.set(
      withDelay(
        900,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 1100, easing: Easing.bezier(...Curves.inOut) }),
            withDelay(2600, withTiming(0, { duration: 0 }))
          ),
          -1
        )
      )
    );
    return () => cancelAnimation(sweep);
  }, [reduceMotion, disabled, width, sweep]);

  const band = useAnimatedStyle(() => ({
    transform: [
      { translateX: -SHEEN_WIDTH + sweep.get() * (width + SHEEN_WIDTH * 2) },
      { skewX: '-20deg' },
    ],
  }));

  function onLayout(event: LayoutChangeEvent) {
    setWidth(event.nativeEvent.layout.width);
  }

  return (
    <Animated.View style={[press.style, styles.ctaShadow]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onLayout={onLayout}>
        {({ pressed }) => (
          <View
            collapsable={false}
            style={[
              styles.cta,
              { opacity: disabled ? Opacity.disabled : pressed ? Opacity.pressed : 1 },
            ]}>
            {/* Medidas en números, no en «100%»: en iOS el SVG en porcentaje se
                quedaba con el ancho de un render anterior y el degradado salía
                cortado (2026-11-10, captura del usuario). */}
            {width > 0 ? (
              <Svg style={StyleSheet.absoluteFill} width={width} height={CTA_HEIGHT}>
                <Defs>
                  <LinearGradient id={fill} x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor={PremiumTones.ctaFrom} />
                    <Stop offset="1" stopColor={PremiumTones.ctaTo} />
                  </LinearGradient>
                </Defs>
                <Rect width={width} height={CTA_HEIGHT} fill={`url(#${fill})`} />
              </Svg>
            ) : null}
            <Animated.View pointerEvents="none" style={[styles.sheen, band]}>
              <Svg width={SHEEN_WIDTH} height={CTA_HEIGHT}>
                <Defs>
                  <LinearGradient id={sheen} x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
                    <Stop offset="0.5" stopColor="#FFFFFF" stopOpacity={0.55} />
                    <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
                  </LinearGradient>
                </Defs>
                <Rect width={SHEEN_WIDTH} height={CTA_HEIGHT} fill={`url(#${sheen})`} />
              </Svg>
            </Animated.View>
            <ThemedText type="bodyStrong" style={[styles.ctaText, { color: PremiumTones.onCta }]}>
              {label}
            </ThemedText>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const SHEEN_WIDTH = 70;
const CTA_HEIGHT = Control.button + 4;
/** Alto del fundido que hay encima del pie (el pie en sí es noche opaca). */
const FADE_HEIGHT = 40;

/**
 * Fundido de la noche hacia arriba, encima del pie opaco: el contenido se
 * desvanece al pasar por debajo en vez de cortarse en seco.
 */
function FooterFade() {
  const { width } = useWindowDimensions();
  const id = useId().replace(/:/g, '');
  const grad = `foot-${id}`;
  return (
    <Svg style={styles.footerFade} width={width} height={FADE_HEIGHT} pointerEvents="none">
      <Defs>
        <LinearGradient id={grad} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={PremiumTones.night} stopOpacity={0} />
          <Stop offset="1" stopColor={PremiumTones.night} stopOpacity={1} />
        </LinearGradient>
      </Defs>
      <Rect width={width} height={FADE_HEIGHT} fill={`url(#${grad})`} />
    </Svg>
  );
}

/** Enlace pequeño del pie (Restaurar, Gestionar suscripción, Términos, Privacidad). */
function FooterLink({
  role,
  label,
  disabled = false,
  onPress,
}: {
  role: 'button' | 'link';
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={{ top: 12, bottom: 12, left: 6, right: 6 }}
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: disabled ? Opacity.disabled : pressed ? Opacity.pressed : 1,
      })}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.link}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

/** Lo que mide el pie fijo con su degradado: el contenido deja ese hueco debajo. */
const FOOTER_SPACE = 190;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PremiumTones.night,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingBottom: FOOTER_SPACE,
  },
  inner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.four,
  },
  topBar: {
    height: Control.minTouch,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    // El héroe va justo debajo: el hueco del `gap` lo descuenta `heroCenter`.
    marginBottom: -Spacing.four,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: Radii.pill,
    borderWidth: Stroke.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: -Spacing.three,
  },
  eyebrow: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.half,
    borderRadius: Radii.pill,
    borderWidth: Stroke.thin,
  },
  benefits: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radii.card,
    borderWidth: Stroke.hairline,
  },
  benefit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  benefitIcon: {
    width: 34,
    height: 34,
    borderRadius: Radii.small + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
  },
  plans: {
    gap: Spacing.three,
    paddingTop: Spacing.two,
  },
  plansLoading: {
    flex: 0,
    minHeight: 160,
  },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radii.large + 2,
  },
  price: {
    textAlign: 'right',
    maxWidth: '45%',
  },
  badge: {
    position: 'absolute',
    top: -11,
    right: Spacing.three,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: 2,
    borderRadius: Radii.pill,
  },
  badgeText: {
    fontFamily: FontFamily.sansBold,
    letterSpacing: 0.3,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: Radii.pill,
    borderWidth: Stroke.strong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 24,
    height: 24,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: {
    textAlign: 'center',
  },
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: Spacing.four,
    rowGap: Spacing.two,
  },
  link: {
    textDecorationLine: 'underline',
  },
  simulator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radii.medium,
    borderWidth: Stroke.hairline,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingTop: Spacing.two,
    paddingHorizontal: Spacing.four,
    backgroundColor: PremiumTones.night,
  },
  footerFade: {
    position: 'absolute',
    left: 0,
    top: -FADE_HEIGHT,
  },
  footerInner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.two,
  },
  ctaShadow: {
    borderRadius: Radii.pill,
    boxShadow: `0px 12px 32px ${PremiumTones.ctaTo}73`,
  },
  cta: {
    height: CTA_HEIGHT,
    backgroundColor: PremiumTones.ctaTo,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radii.pill,
    overflow: 'hidden',
    paddingHorizontal: Spacing.four,
  },
  sheen: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  ctaText: {
    fontSize: 17,
  },
});
