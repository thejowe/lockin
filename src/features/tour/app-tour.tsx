/**
 * El mini tutorial de después del alta (2026-11-10).
 *
 * Sale una sola vez, entre la entrada animada de `profile-form` y el primer
 * `/discover`: cuatro páginas que enseñan lo que hay en la app —Descubrir, el
 * chat de los matches, Grupos y el perfil— antes de soltar a la persona en el
 * deck. Cada página es un teléfono con una captura real de esa pantalla y,
 * delante, una tarjeta de cristal que destaca lo importante, como en la
 * referencia que pasó el usuario.
 *
 * Las capturas (`assets/images/tour/<pantalla>-<idioma>.jpg`) son de la app de
 * verdad, sacadas en web con los datos del mock; hay una por idioma para que la
 * interfaz de fondo diga lo mismo que el texto. Cómo regenerarlas, en
 * `docs/plan/todo/tour.md`. La tarjeta de delante no es imagen: se pinta aquí,
 * con los textos traducidos, para que se lea nítida en cualquier pantalla.
 *
 * Se pasa deslizando o con «Siguiente»; «Omitir» sale directo. Lo de dentro
 * del teléfono y de la tarjeta es ilustración: queda fuera del lector de
 * pantalla, que lee el título y el texto de cada página.
 */

import { Image, type ImageSource } from 'expo-image';
import { useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
} from 'react-native';
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Screen } from '@/components/ambient-background';
import { Button } from '@/components/button';
import { Frosted } from '@/components/glass';
import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { FontFamily, HitSlop, MaxContentWidth, Radii, Spacing, Stroke } from '@/constants/theme';
import { specialtyLabel } from '@/features/profile/catalog';
import { useTheme } from '@/hooks/use-theme';
import { getLocale, t, tk, type AppLocale } from '@/i18n';

type Shot = 'discover' | 'matches' | 'groups' | 'profile';

/** `require` literal por archivo: Metro solo empaqueta lo que ve escrito. */
const SHOTS: Record<Shot, Record<AppLocale, ImageSource>> = {
  discover: {
    es: require('../../../assets/images/tour/discover-es.jpg'),
    en: require('../../../assets/images/tour/discover-en.jpg'),
    ca: require('../../../assets/images/tour/discover-ca.jpg'),
  },
  matches: {
    es: require('../../../assets/images/tour/matches-es.jpg'),
    en: require('../../../assets/images/tour/matches-en.jpg'),
    ca: require('../../../assets/images/tour/matches-ca.jpg'),
  },
  groups: {
    es: require('../../../assets/images/tour/groups-es.jpg'),
    en: require('../../../assets/images/tour/groups-en.jpg'),
    ca: require('../../../assets/images/tour/groups-ca.jpg'),
  },
  profile: {
    es: require('../../../assets/images/tour/profile-es.jpg'),
    en: require('../../../assets/images/tour/profile-en.jpg'),
    ca: require('../../../assets/images/tour/profile-ca.jpg'),
  },
};

/** Proporción de las capturas (600 × 954): la parte de arriba de la pantalla. */
const SHOT_RATIO = 954 / 600;
/** Alto del teléfono entero (marco + barra de estado + captura) por cada punto de ancho. */
const PHONE_RATIO = 1.65;

export const TOUR_PAGES = [
  {
    shot: 'discover',
    title: tk('Encuentra a tu cofundador'),
    body: tk('Perfiles que complementan lo que dominas. Si os dais like los dos, hay match.'),
  },
  {
    shot: 'matches',
    title: tk('Habla con tus matches'),
    body: tk('Cuando el interés es mutuo se abre el chat. De ahí, a construir algo juntos.'),
  },
  {
    shot: 'groups',
    title: tk('Únete a un grupo'),
    body: tk('Proyectos de hasta 6 personas buscan lo que dominas. O crea el tuyo y recluta.'),
  },
  {
    shot: 'profile',
    title: tk('Destaca con tu perfil'),
    body: tk('Vincula GitHub o LinkedIn y enseña en tu tablón en qué trabajas.'),
  },
] as const satisfies readonly { shot: Shot; title: string; body: string }[];

export function AppTour({ onDone }: { onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const scroller = useRef<ScrollViewInstance>(null);
  const [page, setPage] = useState(0);
  const progress = useSharedValue(0);
  const locale = getLocale();
  const last = page === TOUR_PAGES.length - 1;
  // Móviles bajos (iPhone SE y parecidos): título y tarjeta más pequeños para
  // que el teléfono no quede tapado entero.
  const compact = height < 720;

  const onScroll = useAnimatedScrollHandler((event) => {
    progress.value = event.contentOffset.x / Math.max(width, 1);
  });

  // La página activa se decide al soltar, no a mitad de arrastre: así el botón
  // no cambia de «Siguiente» a «Empezar» mientras el dedo aún duda.
  const onSettle = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / Math.max(width, 1));
    setPage(Math.min(Math.max(next, 0), TOUR_PAGES.length - 1));
  };

  const goNext = () => {
    if (last) {
      onDone();
      return;
    }
    const next = page + 1;
    scroller.current?.scrollTo({ x: next * width, animated: true });
    // En web `onMomentumScrollEnd` no siempre llega tras un `scrollTo`.
    setPage(next);
  };

  // El teléfono, a la medida del hueco que dejan el título y el botón: si cabe
  // entero, la tarjeta se pega a su borde de abajo para taparlo igual (como en
  // la referencia); si no cabe, lo corta el borde del hueco.
  const [stageHeight, setStageHeight] = useState(0);
  const phoneWidth = Math.min(width * 0.72, 320, stageHeight / PHONE_RATIO);
  // Lo que sobra cuando cabe entero se reparte arriba y abajo: centrado.
  const slack =
    Math.max(0, stageHeight - phoneWidth * PHONE_RATIO - Spacing.four - Spacing.three) / 2;

  return (
    <Screen>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          {last ? null : (
            <Pressable
              accessibilityRole="button"
              hitSlop={HitSlop.inline}
              onPress={onDone}
              style={styles.skip}>
              <ThemedText type="label" themeColor="textSecondary">
                {t('Omitir')}
              </ThemedText>
            </Pressable>
          )}
        </View>

        <Animated.ScrollView
          ref={scroller}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={onScroll}
          onMomentumScrollEnd={onSettle}
          style={styles.pager}>
          {TOUR_PAGES.map((item, index) => (
            <View key={item.shot} style={[styles.page, { width }]}>
              <View
                style={styles.stage}
                onLayout={
                  index === 0
                    ? (event) => setStageHeight(event.nativeEvent.layout.height)
                    : undefined
                }
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants">
                {stageHeight > 0 ? (
                  <View style={{ marginTop: slack }}>
                    <Phone width={phoneWidth} source={SHOTS[item.shot][locale]} />
                  </View>
                ) : null}
                <View style={[styles.cardSlot, { bottom: Spacing.three + slack }]}>
                  <Frosted
                    radius={Radii.sheet}
                    style={[styles.card, compact && styles.cardCompact]}>
                    <Highlight shot={item.shot} compact={compact} />
                  </Frosted>
                </View>
              </View>
              <View
                style={[styles.copy, compact && styles.copyCompact]}
                accessible
                accessibilityLabel={`${t(item.title)}. ${t(item.body)}`}
                accessibilityHint={t('Paso {step} de {total}', {
                  step: index + 1,
                  total: TOUR_PAGES.length,
                })}>
                <ThemedText type={compact ? 'subtitle' : 'title'} style={styles.title}>
                  {t(item.title)}
                </ThemedText>
                <ThemedText type="body" themeColor="textSecondary" style={styles.body}>
                  {t(item.body)}
                </ThemedText>
              </View>
            </View>
          ))}
        </Animated.ScrollView>

        <View style={styles.footer}>
          <View style={styles.dots}>
            {TOUR_PAGES.map((item, index) => (
              <Dot key={item.shot} index={index} progress={progress} />
            ))}
          </View>
          <Button label={last ? t('Empezar') : t('Siguiente')} onPress={goNext} />
        </View>
      </SafeAreaView>
    </Screen>
  );
}

/** La pastilla de la página activa se estira; el resto son puntos. */
function Dot({ index, progress }: { index: number; progress: SharedValue<number> }) {
  const theme = useTheme();
  const style = useAnimatedStyle(() => {
    const distance = Math.min(Math.abs(progress.value - index), 1);
    return {
      width: interpolate(distance, [0, 1], [22, 7]),
      opacity: interpolate(distance, [0, 1], [1, 0.45]),
    };
  });
  return <Animated.View style={[styles.dot, { backgroundColor: theme.text }, style]} />;
}

/** Un teléfono con la captura dentro, cortado por abajo: la tarjeta tapa el resto. */
function Phone({ width, source }: { width: number; source: ImageSource }) {
  const theme = useTheme();
  const bezel = Math.round(width * 0.03);
  const inner = width - bezel * 2;
  const statusHeight = Math.round(inner * 0.1);

  return (
    <View
      style={[
        styles.phone,
        {
          width,
          padding: bezel,
          borderRadius: width * 0.16,
          borderColor: theme.border,
        },
      ]}>
      <View style={[styles.phoneScreen, { borderRadius: width * 0.16 - bezel }]}>
        <View style={[styles.statusBar, { height: statusHeight }]}>
          <ThemedText style={[styles.clock, { fontSize: Math.max(9, inner * 0.045) }]}>
            9:41
          </ThemedText>
          <View
            style={[
              styles.island,
              { width: inner * 0.3, height: statusHeight * 0.55, top: statusHeight * 0.22 },
            ]}
          />
        </View>
        <Image
          source={source}
          style={{ width: inner, height: inner * SHOT_RATIO }}
          contentFit="cover"
          contentPosition="top"
        />
      </View>
    </View>
  );
}

/** Lo que la tarjeta de cristal destaca de cada pantalla. */
function Highlight({ shot, compact }: { shot: Shot; compact: boolean }) {
  switch (shot) {
    case 'discover':
      return (
        <View style={styles.cardColumn}>
          <View style={styles.row}>
            <Avatar initials="DS" tone="#FFFFFF33" />
            <View style={styles.rowText}>
              <ThemedText type="bodyStrong" numberOfLines={1}>
                Diego Salas
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {`${specialtyLabel('ventas')} · ${specialtyLabel('marketing')}`}
              </ThemedText>
            </View>
            <Pill label={t('✓ Encajas')} />
          </View>
          <View style={styles.actions}>
            <RoundAction icon="close" tone="danger" compact={compact} />
            <RoundAction icon="sparkle" tone="glass" compact={compact} />
            <RoundAction icon="heart" tone="solid" compact={compact} />
          </View>
        </View>
      );
    case 'matches':
      return (
        <View style={styles.cardColumn}>
          <ChatRow
            initials="NB"
            tone="#7FC3B080"
            name="Núria Bosch"
            text={t('Hecho. ¿El jueves por la tarde?')}
            time="6 min"
          />
          <ChatRow
            initials="MO"
            tone="#FFFFFF33"
            name="Marc Oller"
            text={t('¿Hablamos de tu proyecto?')}
            time="45 min"
            faded
          />
        </View>
      );
    case 'groups':
      return (
        <View style={styles.cardColumn}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <ThemedText type="subtitle" numberOfLines={1}>
                Taller Abierto
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t('{count} de {max} miembros', { count: 2, max: 6 })}
              </ThemedText>
            </View>
            <Pill label={t('Crear grupo')} />
          </View>
          <View style={styles.roles}>
            <ThemedText type="small">
              {t('{role} · {free} de {slots} libres', {
                role: specialtyLabel('dev'),
                free: 2,
                slots: 2,
              })}
            </ThemedText>
            <ThemedText type="small" themeColor="textMuted">
              {t('{role} · completo', { role: specialtyLabel('marketing') })}
            </ThemedText>
          </View>
        </View>
      );
    case 'profile':
      return (
        <View style={styles.cardColumn}>
          <Checked text={t('Sello de GitHub o LinkedIn en tu tarjeta')} />
          <Checked text={t('Tu tablón: lo que construyes, en fotos')} />
          <Checked text={t('Edítalo cuando quieras desde Perfil')} />
        </View>
      );
  }
}

function Avatar({ initials, tone }: { initials: string; tone: string }) {
  return (
    <View style={[styles.avatar, { backgroundColor: tone }]}>
      <ThemedText style={styles.avatarText}>{initials}</ThemedText>
    </View>
  );
}

function Pill({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.pill, { backgroundColor: theme.backgroundSelected }]}>
      <ThemedText type="label" numberOfLines={1}>
        {label}
      </ThemedText>
    </View>
  );
}

function RoundAction({
  icon,
  tone,
  compact,
}: {
  icon: IconName;
  tone: 'danger' | 'glass' | 'solid';
  compact: boolean;
}) {
  const theme = useTheme();
  const background =
    tone === 'solid' ? theme.text : tone === 'danger' ? theme.dangerSoft : theme.backgroundSelected;
  const color = tone === 'solid' ? theme.background : tone === 'danger' ? theme.danger : theme.text;
  return (
    <View
      style={[
        styles.round,
        compact && styles.roundCompact,
        { backgroundColor: background, borderColor: theme.border },
      ]}>
      <Icon name={icon} size={compact ? 18 : 22} color={color} />
    </View>
  );
}

function ChatRow({
  initials,
  tone,
  name,
  text,
  time,
  faded = false,
}: {
  initials: string;
  tone: string;
  name: string;
  text: string;
  time: string;
  faded?: boolean;
}) {
  return (
    <View style={[styles.row, faded && styles.faded]}>
      <Avatar initials={initials} tone={tone} />
      <View style={styles.rowText}>
        <ThemedText type="bodyStrong" numberOfLines={1}>
          {name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {`${text} · ${time}`}
        </ThemedText>
      </View>
    </View>
  );
}

function Checked({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <View style={[styles.check, { backgroundColor: theme.tealSoft }]}>
        <Icon name="check" size={16} color={theme.teal} />
      </View>
      <ThemedText type="small" style={styles.rowText}>
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  topBar: {
    height: 36,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.four,
  },
  skip: {
    justifyContent: 'center',
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    overflow: 'hidden',
  },
  phone: {
    backgroundColor: '#0E0E10',
    borderWidth: Stroke.thin,
    boxShadow: '0px 24px 60px rgba(0, 0, 0, 0.6)',
  },
  phoneScreen: {
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  statusBar: {
    justifyContent: 'center',
    paddingLeft: '11%',
  },
  clock: {
    fontFamily: FontFamily.sansSemiBold,
    lineHeight: undefined,
  },
  island: {
    position: 'absolute',
    alignSelf: 'center',
    borderRadius: Radii.pill,
    backgroundColor: '#000000',
    borderWidth: Stroke.thin,
    borderColor: '#1C1C1E',
  },
  cardSlot: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: MaxContentWidth,
    padding: Spacing.three + Spacing.one,
  },
  cardCompact: {
    padding: Spacing.three,
  },
  cardColumn: {
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  rowText: {
    flex: 1,
    gap: Spacing.half,
  },
  faded: {
    opacity: 0.6,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 16,
    lineHeight: 20,
  },
  pill: {
    paddingHorizontal: Spacing.three - Spacing.one,
    paddingVertical: Spacing.one + Spacing.half,
    borderRadius: Radii.pill,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.four,
  },
  round: {
    width: 52,
    height: 52,
    borderRadius: Radii.pill,
    borderWidth: Stroke.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundCompact: {
    width: 42,
    height: 42,
  },
  roles: {
    gap: Spacing.one,
  },
  check: {
    width: 28,
    height: 28,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
    alignItems: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  copyCompact: {
    paddingTop: Spacing.three,
    gap: Spacing.one,
  },
  title: {
    textAlign: 'center',
  },
  body: {
    textAlign: 'center',
  },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
    gap: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.three,
  },
  dot: {
    height: 7,
    borderRadius: Radii.pill,
  },
});
