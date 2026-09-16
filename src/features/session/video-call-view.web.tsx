/**
 * Variante web del hueco de vídeo: `react-native-webrtc` es un módulo nativo
 * sin build web (ver la spec, "Por qué solo funciona en build de
 * dispositivo"). Metro resuelve este archivo en vez de `video-call-view.tsx`
 * para cualquier bundle `web` — igual que `app-tabs.web.tsx` con
 * `app-tabs.tsx` — así que `react-native-webrtc` nunca se importa aquí. Un
 * simple `Platform.OS === 'web'` dentro del archivo nativo no bastaría: el
 * `import` de un módulo nativo se ejecuta al cargar el archivo, no al entrar
 * en la rama, y eso es justo lo que rompía `expo export --platform web`
 * antes de este archivo.
 */

import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function VideoCallView({ active }: { active: boolean }) {
  const theme = useTheme();

  if (!active) return null;

  return (
    <View
      style={[styles.root, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.text}>
        La videollamada solo está disponible desde la app móvil.
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: Radii.large,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  text: { textAlign: 'center' },
});
