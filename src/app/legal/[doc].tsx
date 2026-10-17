import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { HitSlop } from '@/constants/theme';
import { LEGAL_TITLES, LegalDocument, isLegalDocKey } from '@/features/legal';
import { useTheme } from '@/hooks/use-theme';

/**
 * `/legal/terms`, `/legal/guidelines`, `/legal/privacy`, `/legal/childSafety`:
 * un documento legal en una hoja que sube sobre la pantalla en la que se estaba
 * (`presentation: 'modal'` en `src/app/_layout.tsx`), sin salir de la app.
 *
 * Un enlace a otro documento sustituye la hoja (`replace`), para que «Cerrar»
 * devuelva siempre a donde se estaba y no a través de una pila de documentos.
 */
export default function LegalRoute() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { doc } = useLocalSearchParams<{ doc: string }>();

  if (!isLegalDocKey(doc)) return <Redirect href="/" />;

  return (
    <>
      <Stack.Screen
        options={{
          title: LEGAL_TITLES[doc],
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
              hitSlop={HitSlop.inline}
              // Abierta desde un enlace (`cofounder://legal/terms`) no hay detrás
              // a donde volver: entonces, a la puerta de entrada.
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
              style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
              <ThemedText type="bodyStrong" style={{ color: theme.text }}>
                Cerrar
              </ThemedText>
            </Pressable>
          ),
        }}
      />
      <LegalDocument
        doc={doc}
        bottomInset={insets.bottom}
        onOpenDocument={(next) =>
          router.replace({ pathname: '/legal/[doc]', params: { doc: next } })
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  close: {
    paddingHorizontal: 4,
  },
  pressed: {
    opacity: 0.6,
  },
});
