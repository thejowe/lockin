import { Image } from 'expo-image';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { glassStyle } from '@/components/glass';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Control, FontFamily, Opacity, Radii, ScrimAlpha, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

export function PhotoCardPicker({
  uri,
  name,
  age,
  disabled,
  onPress,
}: {
  uri: string | null;
  name: string;
  age: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const { height } = useWindowDimensions();
  return (
    <View style={styles.group}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={uri ? t('Cambiar foto de perfil') : t('Añadir foto')}
        accessibilityHint={t(
          'Es obligatoria: la gente quiere saber con quién habla. Se revisa antes de publicarse.'
        )}
        accessibilityValue={uri ? { text: `${name}, ${age}` } : undefined}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          glassStyle(theme),
          styles.card,
          { width: Math.min(336, height * 0.4), opacity: pressed ? Opacity.pressed : 1 },
        ]}>
        {uri ? (
          <>
            <Image
              testID="wizard-photo"
              source={{ uri }}
              contentFit="cover"
              style={StyleSheet.absoluteFill}
            />
            <View style={[styles.edit, { backgroundColor: theme.background + ScrimAlpha }]}>
              <Icon name="camera" size={18} color={theme.text} />
            </View>
            <View style={styles.caption}>
              <Svg width="100%" height={Spacing.six}>
                <Defs>
                  <LinearGradient id="photo-caption-fade" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset={0} stopColor={theme.background} stopOpacity={0} />
                    <Stop
                      offset={1}
                      stopColor={theme.background}
                      stopOpacity={parseInt(ScrimAlpha, 16) / 255}
                    />
                  </LinearGradient>
                </Defs>
                <Rect width="100%" height="100%" fill="url(#photo-caption-fade)" />
              </Svg>
              <View style={[styles.identity, { backgroundColor: theme.background + ScrimAlpha }]}>
                <ThemedText type="title" numberOfLines={1} style={styles.name}>
                  {name}
                </ThemedText>
                <ThemedText type="subtitle" style={styles.age}>
                  {age}
                </ThemedText>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.empty}>
            <View style={[styles.camera, { backgroundColor: theme.backgroundSelected }]}>
              <Icon name="camera" size={30} color={theme.text} />
            </View>
            <ThemedText type="bodyStrong">{t('Añadir foto')}</ThemedText>
          </View>
        )}
      </Pressable>
      <ThemedText type="small" themeColor="textSecondary" style={styles.tip}>
        {t('Que se te vea la cara y con buena luz')}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { alignItems: 'center', gap: Spacing.two },
  card: { maxWidth: '100%', aspectRatio: 4 / 5, justifyContent: 'center', overflow: 'hidden' },
  empty: { alignItems: 'center', gap: Spacing.three },
  camera: {
    width: Control.button,
    height: Control.button,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  edit: {
    position: 'absolute',
    top: Spacing.three,
    right: Spacing.three,
    padding: Spacing.two,
    borderRadius: Radii.pill,
  },
  caption: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  identity: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  name: { flexShrink: 1 },
  age: { fontFamily: FontFamily.sans },
  tip: { textAlign: 'center' },
});

/**
 * Estado de la foto bajo la tarjeta («En revisión…», «Foto aprobada»). Ocupa
 * siempre su línea, también vacío: si apareciera de la nada empujaría la pantalla.
 */
export function PhotoStatus({ message }: { message: string | null }) {
  return (
    <ThemedText
      testID="photo-status"
      type="small"
      themeColor="textSecondary"
      accessibilityLiveRegion="polite"
      accessibilityElementsHidden={!message}
      importantForAccessibility={message ? 'auto' : 'no-hide-descendants'}
      style={statusStyles.status}>
      {message ?? '\u00a0'}
    </ThemedText>
  );
}

const statusStyles = StyleSheet.create({ status: { textAlign: 'center' } });
