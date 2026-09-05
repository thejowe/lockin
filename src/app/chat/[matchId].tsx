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
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

/** Altura de la barra de navegación nativa, para descontarla al subir el teclado. */
const HEADER_HEIGHT = 44;

export default function ChatScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
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

      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + HEADER_HEIGHT : 0}>
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
