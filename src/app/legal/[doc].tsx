import { CloseButton } from '@/components/close-button';
import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LEGAL_TITLES, LegalDocument, isLegalDocKey } from '@/features/legal';

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
  const insets = useSafeAreaInsets();
  const { doc } = useLocalSearchParams<{ doc: string }>();

  if (!isLegalDocKey(doc)) return <Redirect href="/" />;

  return (
    <>
      <Stack.Screen
        options={{
          title: LEGAL_TITLES[doc],
          headerRight: () => (
            <CloseButton
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            />
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
