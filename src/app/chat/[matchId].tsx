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
import { Fragment, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import {
  KeyboardAvoidingView,
  useKeyboardHandler,
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

  // Sonda temporal: la ronda 3 del arreglo del compositor (ver
  // docs/plan/todo/chat.md) sigue en rojo en el E2E aunque movió el compositor
  // muy por encima de donde estaba, y sin este dato no se puede distinguir
  // entre "el teclado reporta mal su altura" y "el offset del automaticOffset
  // sigue corto" solo con capturas de pantalla. Se retira en cuanto ese TODO
  // se cierre.
  const { height: keyboardProbeWindowHeight } = useKeyboardWindowDimensions();
  useKeyboardHandler(
    {
      onStart: (e) => {
        'worklet';
        console.log(
          '[keyboard-probe] onStart height=' + e.height + ' windowHeight=' + keyboardProbeWindowHeight
        );
      },
    },
    [keyboardProbeWindowHeight]
  );

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

        `automaticOffset` no es un extra: sin él, `frame` sale del `onLayout`, y
        `onLayout` da coordenadas RELATIVAS AL PADRE. El componente compara
        `frame.y + frame.height` contra `screenHeight - alturaTeclado`, donde
        `screenHeight` sí es la ventana entera (`Dimensions.get('window')`). Con
        `frame.y = 0` bajo una cabecera nativa, el relleno sale corto justo por
        la altura de barra de estado + cabecera (~80 dp aquí), que es más que el
        compositor entero. Con `automaticOffset` la posición se pide al nativo
        (`viewPositionInWindow`) y `keyboardVerticalOffset` pasa a ser aditivo,
        por eso ya no hace falta el que se pasaba a mano en iOS.

        Dejaba el compositor entero debajo del teclado: no se veía lo escrito ni
        había forma de enviar — `returnKeyType` es `default` a propósito, por ser
        multilínea. Lo encontró el E2E en emulador real y es su guardián; ver
        `docs/plan/todo/chat.md`.
      */}
      <KeyboardAvoidingView style={styles.root} behavior="padding" automaticOffset>
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
