/**
 * Chat de un grupo: un hilo con todos sus miembros.
 *
 * Reutiliza las piezas del chat 1:1 (`features/chat`): la burbuja, el
 * separador de día, el compositor y el mismo arreglo de teclado —ver
 * `chat/[matchId].tsx` para el porqué de cada prop del `KeyboardAvoidingView`—.
 * Lo que cambia: sobre cada mensaje ajeno va el nombre de quien lo escribe, y
 * el reporte de un mensaje va a `groups.reportMessage`.
 *
 * Solo entra quien es miembro: si sales o te expulsan, la pantalla lo dice y
 * ofrece volver. Mismas puertas que el chat 1:1: correo confirmado y Términos.
 */

import { Stack, useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Fragment, useCallback, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type ScrollViewInstance,
} from 'react-native';
import {
  KeyboardAvoidingView,
  useWindowDimensions as useKeyboardWindowDimensions,
} from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmbientBackground, Screen } from '@/components/ambient-background';
import { Button } from '@/components/button';
import { LoadingState, MessageState } from '@/components/state-view';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useQuery, useRepositories } from '@/data';
import {
  DayDivider,
  MessageBubble,
  MessageComposer,
  formatDayHeading,
  isSameDayIso,
  keyboardVerticalOffset,
  useMarkChatRead,
} from '@/features/chat';
import { useGroupConversation, useGroupPush } from '@/features/groups';
import { RequireVerifiedEmail, TermsAcceptance, useTermsGate } from '@/features/profile';
import { ReportForm } from '@/features/safety/report-form';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';
import { setActivePushRoute } from '@/lib/push';
import { ChatTabs } from '@/features/chat/shared-plan';
import { GroupProjectHeader } from '@/features/groups/group-project-header';

function GroupChatContent() {
  const theme = useTheme();
  const router = useRouter();
  const repositories = useRepositories();
  const params = useLocalSearchParams<{ groupId: string }>();
  const groupId = Array.isArray(params.groupId) ? params.groupId[0] : (params.groupId ?? '');

  const { view, messages, loading, error, sending, sendError, send } =
    useGroupConversation(groupId);
  // Con el chat delante, lo que llega ya está leído: quita su globo rojo.
  const markRead = useCallback(
    () => repositories.unread.markGroupRead(groupId),
    [repositories, groupId]
  );
  useMarkChatRead(markRead, messages.length);
  useGroupPush(!!view);
  // Con este chat delante, sus avisos push no se enseñan encima.
  useFocusEffect(
    useCallback(() => {
      return setActivePushRoute(`/group/${groupId}`);
    }, [groupId])
  );
  const { data: me } = useQuery('profile:current', () => repositories.profiles.getCurrent());

  const [draft, setDraft] = useState('');
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [reported, setReported] = useState(false);
  const scrollRef = useRef<ScrollViewInstance>(null);

  const names = useMemo(
    () =>
      new Map(
        (view?.members ?? []).map((entry) => [
          entry.member.userId,
          entry.profile?.name ?? t('Miembro'),
        ])
      ),
    [view]
  );

  const { height: windowHeight } = useKeyboardWindowDimensions();
  const [avoidingViewHeight, setAvoidingViewHeight] = useState(0);
  const handleAvoidingViewLayout = useCallback((event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    setAvoidingViewHeight((previous) => (previous === height ? previous : height));
  }, []);

  const handleSend = async () => {
    const sent = await send(draft);
    if (sent) setDraft('');
  };

  const title = view?.group.name ?? t('Chat de grupo');

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <AmbientBackground variant="teal" />
      <Stack.Screen
        options={{
          title,
          headerRight: () =>
            view ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('Ver el grupo')}
                onPress={() => router.push(`/group/info?id=${view.group.id}` as Href)}
                style={({ pressed }) => [styles.headerButton, pressed && { opacity: 0.6 }]}>
                <ThemedText type="bodyStrong">{t('Grupo')}</ThemedText>
              </Pressable>
            ) : null,
        }}
      />

      <KeyboardAvoidingView
        style={styles.root}
        behavior="padding"
        keyboardVerticalOffset={keyboardVerticalOffset(windowHeight, avoidingViewHeight)}
        onLayout={handleAvoidingViewLayout}>
        {loading && !view ? (
          <LoadingState label={t('Cargando la conversación…')} />
        ) : !view ? (
          <MessageState
            title={t('Este chat no está disponible')}
            body={
              error
                ? t('Ha fallado la carga. Inténtalo otra vez en un momento.')
                : t('Ya no estás en este grupo.')
            }>
            <Button label={t('Volver a Matches')} href="/matches" />
          </MessageState>
        ) : reportingId ? (
          <ScrollView contentContainerStyle={styles.safety} keyboardShouldPersistTaps="handled">
            {reported ? (
              <View style={styles.reported}>
                <ThemedText type="subtitle" accessibilityRole="alert">
                  {t('Reporte enviado.')}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('El reporte es privado.')}
                </ThemedText>
                <Button
                  label={t('Cerrar')}
                  variant="secondary"
                  onPress={() => {
                    setReported(false);
                    setReportingId(null);
                  }}
                />
              </View>
            ) : (
              <ReportForm
                name={title}
                title={t('Reportar mensaje')}
                onSubmit={(reason, details) =>
                  repositories.groups.reportMessage({ messageId: reportingId, reason, details })
                }
                onCancel={() => setReportingId(null)}
                onSubmitted={() => setReported(true)}
              />
            )}
          </ScrollView>
        ) : (
          <View style={styles.content}>
            <ChatTabs
              key={groupId}
              scope={{ kind: 'group', id: groupId }}
              members={
                view.group.project
                  ? [
                      ...view.members.flatMap(({ profile }) =>
                        profile
                          ? [
                              {
                                id: profile.id,
                                label: profile.id === me?.id ? t('Yo') : profile.name,
                              },
                            ]
                          : []
                      ),
                      { id: null, label: t('Todo el grupo') },
                    ]
                  : undefined
              }
              projectHeader={
                view.group.project && (
                  <GroupProjectHeader project={view.group.project} isAdmin={view.isAdmin} />
                )
              }>
              <ScrollView
                ref={scrollRef}
                contentContainerStyle={styles.thread}
                keyboardDismissMode="interactive"
                onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.intro}>
                  {t('Chat de grupo · {count} miembros', { count: view.members.length })}
                </ThemedText>

                {messages.map((message, index) => {
                  const previous = messages[index - 1];
                  const startsDay = !isSameDayIso(
                    previous?.sentAt ?? view.group.createdAt,
                    message.sentAt
                  );
                  const isMine = message.senderId === me?.id;
                  // El nombre solo al cambiar de persona: un bloque seguido es de la misma.
                  const showsName =
                    !isMine && (startsDay || previous?.senderId !== message.senderId);

                  return (
                    <Fragment key={message.id}>
                      {startsDay && <DayDivider label={formatDayHeading(message.sentAt)} />}
                      {showsName ? (
                        <ThemedText type="caption" themeColor="textMuted" style={styles.sender}>
                          {names.get(message.senderId) ?? t('Ya no está en el grupo')}
                        </ThemedText>
                      ) : null}
                      <MessageBubble
                        message={{ ...message, matchId: message.groupId }}
                        isMine={isMine}
                        onReport={() => setReportingId(message.id)}
                      />
                    </Fragment>
                  );
                })}
              </ScrollView>

              {sendError ? (
                <ThemedText type="small" themeColor="danger" style={styles.sendError}>
                  {t('No se ha podido enviar. Inténtalo otra vez.')}
                </ThemedText>
              ) : null}

              <MessageComposer
                value={draft}
                onChangeText={setDraft}
                onSend={handleSend}
                sending={sending}
                placeholder={t('Escribe al grupo')}
              />
            </ChatTabs>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.one },
  safety: { padding: Spacing.three, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  reported: { gap: Spacing.three },
  content: { flex: 1, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  thread: { gap: Spacing.two, paddingHorizontal: Spacing.three, paddingBottom: Spacing.three },
  intro: { textAlign: 'center', paddingVertical: Spacing.three },
  sender: { paddingHorizontal: Spacing.two },
  sendError: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.one },
});

/** Sin Términos y Normas aceptados (versión vigente) no se entra a chatear. */
function RequireTerms({ children }: { children: React.ReactNode }) {
  const terms = useTermsGate();
  if (terms.gate === 'checking') return null;
  if (terms.gate === 'required') {
    return (
      <Screen ambient="plum">
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <TermsAcceptance onAccepted={terms.refresh} />
        </SafeAreaView>
      </Screen>
    );
  }
  return <>{children}</>;
}

export default function GroupChatScreen() {
  return (
    <RequireVerifiedEmail>
      <RequireTerms>
        <GroupChatContent />
      </RequireTerms>
    </RequireVerifiedEmail>
  );
}
