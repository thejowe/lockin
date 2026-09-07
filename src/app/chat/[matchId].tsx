/**
 * Conversación 1:1 con un match.
 *
 * Tres piezas, en este orden de importancia: el hueco de "Agendar sesión
 * Lock-In" fijo arriba (el diferenciador — ver `docs/plan/CONCEPTO.md`), el hilo
 * de mensajes, y el campo de escritura. Los icebreakers solo aparecen mientras
 * nadie ha escrito: en cuanto hay conversación, sobran.
 *
 * Los mensajes viven en memoria durante la sesión (repositorio mock). Cuando
 * `datos` conecte Supabase, esta pantalla no cambia: ya lee por `matchId` y se
 * suscribe a los cambios.
 */

import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { Fragment, useCallback, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import {
  KeyboardAvoidingView,
  useWindowDimensions as useKeyboardWindowDimensions,
} from 'react-native-keyboard-controller';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radii, Spacing } from '@/constants/theme';
import {
  ConversationIntro,
  DayDivider,
  IcebreakerSuggestions,
  LockInCta,
  MessageBubble,
  MessageComposer,
  formatDayHeading,
  isSameDayIso,
  keyboardVerticalOffset,
  suggestIcebreakers,
  useConversation,
} from '@/features/chat';
import { useTheme } from '@/hooks/use-theme';

export default function ChatScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ matchId: string }>();
  const matchId = Array.isArray(params.matchId) ? params.matchId[0] : (params.matchId ?? '');

  const { match, messages, me, loading, error, sending, sendError, send } =
    useConversation(matchId);

  const [draft, setDraft] = useState('');
  const inputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);

  const icebreakers = useMemo(
    () => (match ? suggestIcebreakers(match.counterpart, me, match.mode) : []),
    [match, me]
  );

  // El offset que el `KeyboardAvoidingView` de abajo no sabe calcular solo: la
  // distancia entre el borde de la ventana y el de esta vista (barra de estado
  // + cabecera nativa). Se deduce de su propia altura medida — ver
  // `keyboardVerticalOffset` para por qué y para las cifras del emulador.
  const { height: windowHeight } = useKeyboardWindowDimensions();
  const [avoidingViewHeight, setAvoidingViewHeight] = useState(0);
  const handleAvoidingViewLayout = useCallback((event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    // `onLayout` puede repetirse con la misma altura; sin esta guarda cada
    // repetición sería un render de más.
    setAvoidingViewHeight((previous) => (previous === height ? previous : height));
  }, []);

  const handleSend = async () => {
    const sent = await send(draft);
    if (sent) setDraft('');
  };

  const pickIcebreaker = (text: string) => {
    setDraft(text);
    inputRef.current?.focus();
  };

  const title = match?.counterpart.name ?? 'Conversación';

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title }} />

      {/*
        `KeyboardAvoidingView` de `react-native-keyboard-controller`, NO el de
        React Native. El de RN es inerte en Android bajo edge-to-edge —el modo
        obligatorio desde Expo SDK 54—: se entera del teclado por
        `keyboardDidShow`, que Android emite al observar que la ventana se
        redimensiona, y desde Android 15 la ventana ya no se redimensiona. Sin
        evento, `state.bottom` se queda en 0 y ningún `behavior` mueve nada
        (comprobado en emulador: falla igual con `height` que con `padding`).
        El de la librería lee los WindowInsets del IME, que sí llegan.

        `keyboardVerticalOffset` tampoco es un extra: sin él, `frame` sale del
        `onLayout`, y `onLayout` da coordenadas RELATIVAS AL PADRE. El
        componente compara `frame.y + frame.height` contra `screenHeight -
        alturaTeclado`, donde `screenHeight` sí es la ventana entera. Con
        `frame.y = 0` bajo una cabecera nativa, el relleno sale corto justo por
        la altura de barra de estado + cabecera, que es más que el compositor
        entero.

        `automaticOffset` promete arreglar eso pidiendo la posición absoluta al
        nativo, pero aquí NO se aplica: su `.catch` se traga el fallo en
        silencio y vuelve a la posición relativa. Con él puesto, el relleno
        medido en emulador fue exactamente el de `frame.y = 0`. Por eso va el
        offset a mano, y por eso `automaticOffset` NO puede volver: los dos
        juntos cuentan la misma distancia dos veces.

        Dejaba el compositor entero debajo del teclado: no se veía lo escrito ni
        había forma de enviar — `returnKeyType` es `default` a propósito, por ser
        multilínea. Lo encontró el E2E en emulador real y es su guardián; ver
        `docs/plan/todo/chat.md`.
      */}
      <KeyboardAvoidingView
        style={styles.root}
        behavior="padding"
        keyboardVerticalOffset={keyboardVerticalOffset(windowHeight, avoidingViewHeight)}
        onLayout={handleAvoidingViewLayout}>
        {loading && !match ? (
          <Centered>
            <ThemedText type="body" themeColor="textSecondary">
              Cargando la conversación…
            </ThemedText>
          </Centered>
        ) : !match ? (
          <MissingMatch error={error} />
        ) : (
          <View style={styles.content}>
            <View style={styles.lockIn}>
              <LockInCta counterpartName={match.counterpart.name} />
            </View>

            <ScrollView
              ref={scrollRef}
              contentContainerStyle={styles.thread}
              keyboardDismissMode="interactive"
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
              <ConversationIntro match={match} />

              {messages.length === 0 ? (
                <IcebreakerSuggestions suggestions={icebreakers} onPick={pickIcebreaker} />
              ) : (
                messages.map((message, index) => {
                  const previous = messages[index - 1];
                  // El primer mensaje solo lleva separador si se escribió otro
                  // día que el match: la cabecera ya dice cuándo fue.
                  const startsDay = !isSameDayIso(
                    previous?.sentAt ?? match.createdAt,
                    message.sentAt
                  );

                  return (
                    <Fragment key={message.id}>
                      {startsDay && <DayDivider label={formatDayHeading(message.sentAt)} />}
                      <MessageBubble
                        message={message}
                        // El emisor se compara con el otro lado del match, no con
                        // un id propio cableado: así vale también con backend real.
                        isMine={message.senderId !== match.counterpart.id}
                      />
                    </Fragment>
                  );
                })
              )}
            </ScrollView>

            {sendError && (
              <ThemedText type="small" themeColor="danger" style={styles.sendError}>
                No se ha podido enviar. Inténtalo otra vez.
              </ThemedText>
            )}

            <MessageComposer
              ref={inputRef}
              value={draft}
              onChangeText={setDraft}
              onSend={handleSend}
              sending={sending}
              placeholder={`Escribe a ${match.counterpart.name.split(' ')[0]}`}
            />
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <View style={styles.centered}>{children}</View>;
}

/** El id no resuelve: enlace roto, o el match ya no existe tras recargar el mock. */
function MissingMatch({ error }: { error: Error | null }) {
  const theme = useTheme();

  return (
    <Centered>
      <ThemedText type="subtitle" style={styles.centeredText}>
        Esta conversación no está disponible
      </ThemedText>
      <ThemedText type="body" themeColor="textSecondary" style={styles.centeredText}>
        {error
          ? 'Ha fallado la carga. Vuelve a tus matches y entra otra vez.'
          : 'El match ya no existe. Los mensajes del MVP solo viven mientras la app está abierta.'}
      </ThemedText>

      <Link href="/matches" asChild>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.backAction,
            { backgroundColor: theme.brass, opacity: pressed ? 0.85 : 1 },
          ]}>
          <ThemedText type="bodyStrong" style={{ color: theme.onAccent }}>
            Volver a Matches
          </ThemedText>
        </Pressable>
      </Link>
    </Centered>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  lockIn: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
  },
  thread: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  centeredText: {
    textAlign: 'center',
  },
  backAction: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Radii.pill,
  },
  sendError: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.one,
  },
});
