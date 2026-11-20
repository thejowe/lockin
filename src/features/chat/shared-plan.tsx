import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { AppState, Keyboard, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { LoadingState, MessageState } from '@/components/state-view';
import { ThemedText } from '@/components/themed-text';
import { Control, Radii, Spacing, Stroke } from '@/constants/theme';
import { useQuery, useRepositories } from '@/data';
import type { ChatScope, PlanItem } from '@/data/chat-plan';
import { useTheme } from '@/hooks/use-theme';
import { getIntlLocale, t } from '@/i18n';
import { ProjectTasks, type TaskMembers } from './project-tasks';
import { PlanForm, type PlanKind } from './plan-form';
import { useLastGood } from './use-last-good';

export function ChatTabs({
  scope,
  children,
  projectHeader,
  members,
}: {
  scope: ChatScope;
  children: ReactNode;
  projectHeader?: ReactNode;
  members?: TaskMembers;
}) {
  const [plan, setPlan] = useState(false);
  return (
    <>
      <ChatTabBar plan={plan} project={!!projectHeader} onSelect={setPlan} />
      {plan ? <SharedPlan scope={scope} header={projectHeader} members={members} /> : children}
    </>
  );
}
export function ChatTabBar({
  plan,
  project,
  onSelect,
}: {
  plan: boolean;
  project?: boolean;
  onSelect: (value: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <View accessibilityRole="tablist" style={[styles.tabs, { borderColor: theme.border }]}>
      {[false, true].map((showPlan) => {
        const selected = showPlan === plan;
        return (
          <Pressable
            key={String(showPlan)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              Keyboard.dismiss();
              onSelect(showPlan);
            }}
            style={[
              styles.tab,
              { backgroundColor: selected ? theme.backgroundSelected : 'transparent' },
            ]}>
            <Icon
              name={showPlan ? 'document' : 'chat'}
              color={selected ? theme.text : theme.textMuted}
              size={18}
            />
            <ThemedText type="smallBold" themeColor={selected ? 'text' : 'textMuted'}>
              {showPlan ? (project ? t('Proyecto') : t('Plan compartido')) : t('Mensajes')}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SharedPlan({
  scope,
  members,
  header,
  footer,
}: {
  scope: ChatScope;
  members?: TaskMembers;
  header?: ReactNode;
  footer?: ReactNode;
}) {
  const repo = useRepositories().chatPlan;
  const planKey = `chat-plan:${scope.kind}:${scope.id}`;
  const query = useQuery(planKey, async () => ({
    items: await repo.list(scope),
    asOf: Date.now(),
  }));
  const { refresh } = query;
  // Un sondeo fallido deja el plan y las notas montados, con el aviso arriba:
  // la pantalla de error es solo para una primera carga sin datos.
  const { data, error, loading } = useLastGood(query, planKey);
  const [form, setForm] = useState<PlanKind | null>(null);
  const [actionError, setActionError] = useState('');
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const theme = useTheme();

  // La otra persona puede cambiar el plan desde otro dispositivo. Solo se consulta con la pestaña delante.
  useFocusEffect(
    useCallback(() => {
      const timer = setInterval(() => {
        if (AppState.currentState === 'active') refresh();
      }, 15000);
      const sub = AppState.addEventListener('change', (state) => {
        if (state === 'active') refresh();
      });
      return () => {
        clearInterval(timer);
        sub.remove();
      };
    }, [refresh])
  );

  async function toggle(item: PlanItem) {
    if (lock.current) return;
    lock.current = true;
    setSaving(true);
    setActionError('');
    try {
      await repo.setClosed(scope, item.id, !item.closed);
      refresh();
    } catch {
      setActionError(t('No se ha podido guardar. Vuelve a intentarlo.'));
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }

  if (form)
    return (
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
        <PlanForm
          kind={form}
          onClose={() => setForm(null)}
          add={async (draft) => {
            await repo.add(scope, draft);
            refresh();
          }}
        />
      </ScrollView>
    );
  if (loading) return <LoadingState label={t('Cargando el plan…')} />;
  if (error && !data)
    return (
      <MessageState title={t('No se ha podido cargar el plan')}>
        <Button label={t('Reintentar')} onPress={refresh} />
      </MessageState>
    );

  const items = data?.items ?? [];
  const asOf = data?.asOf ?? 0;
  const tasks = items
    .filter((item) => !item.startsAt)
    .sort((a, b) => Number(a.closed) - Number(b.closed));
  const meetings = items
    .filter((item) => item.startsAt)
    .sort((a, b) => {
      const startA = Date.parse(a.startsAt!);
      const startB = Date.parse(b.startsAt!);
      const inactiveA = a.closed || startA <= asOf;
      const inactiveB = b.closed || startB <= asOf;
      return (
        Number(inactiveA) - Number(inactiveB) || (inactiveA ? startB - startA : startA - startB)
      );
    });
  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      {header}
      {error ? (
        <View style={styles.section}>
          <ThemedText accessibilityRole="alert" themeColor="danger">
            {t('No se ha podido cargar el plan')}
          </ThemedText>
          <Button variant="secondary" compact label={t('Reintentar')} onPress={refresh} />
        </View>
      ) : null}
      {actionError ? (
        <ThemedText accessibilityRole="alert" themeColor="danger">
          {actionError}
        </ThemedText>
      ) : null}
      {members ? (
        <ProjectTasks
          members={members}
          tasks={tasks}
          add={async (draft) => {
            await repo.add(scope, draft);
            refresh();
          }}
          update={async (id, details) => {
            await repo.updateTask(scope, id, details);
            refresh();
          }}
        />
      ) : (
        <View style={styles.section}>
          <ThemedText type="subtitle">{t('Tareas')}</ThemedText>
          {tasks.length === 0 ? (
            <ThemedText themeColor="textSecondary">
              {t('¿Cuál es vuestro siguiente paso?')}
            </ThemedText>
          ) : null}
          {tasks.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: item.closed, disabled: saving }}
              accessibilityLabel={item.title}
              onPress={() => toggle(item)}
              disabled={saving}
              style={[styles.task, { borderColor: theme.border }]}>
              <View
                style={[
                  styles.check,
                  {
                    borderColor: item.closed ? theme.brass : theme.textMuted,
                    backgroundColor: item.closed ? theme.brass : 'transparent',
                  },
                ]}>
                {item.closed && <Icon name="check" size={16} color={theme.onAccent} />}
              </View>
              <ThemedText
                style={{ flex: 1, textDecorationLine: item.closed ? 'line-through' : 'none' }}
                themeColor={item.closed ? 'textMuted' : 'text'}>
                {item.title}
              </ThemedText>
            </Pressable>
          ))}
          <Button
            compact
            variant="secondary"
            label={t('Añadir tarea')}
            onPress={() => {
              setActionError('');
              setForm('task');
            }}
          />
        </View>
      )}
      {members && scope.kind === 'match' && (
        <View style={styles.section}>
          <ThemedText type="subtitle">{t('Recordatorios')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t(
              'Avisaremos a los responsables un día antes de cada fecha límite y a los dos 15 minutos antes de cada reunión, según vuestras preferencias.'
            )}
          </ThemedText>
        </View>
      )}
      <View style={styles.section}>
        <ThemedText type="subtitle">{t('Reuniones')}</ThemedText>
        {meetings.length === 0 ? (
          <ThemedText themeColor="textSecondary">
            {t('Todavía no hay reuniones programadas.')}
          </ThemedText>
        ) : null}
        {meetings.map((item) => {
          const date = new Date(item.startsAt!);
          const link = item.place && /^https:\/\/[^\s]+$/i.test(item.place) ? item.place : null;
          return (
            <View
              key={item.id}
              style={[
                styles.meeting,
                { backgroundColor: theme.backgroundElement, borderColor: theme.border },
              ]}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                {date.toLocaleString(getIntlLocale(), {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZoneName: 'short',
                })}
              </ThemedText>
              <ThemedText type="heading" selectable>
                {item.title}
              </ThemedText>
              {link ? (
                <ThemedText
                  type="link"
                  accessibilityRole="link"
                  onPress={() =>
                    Linking.openURL(link).catch(() =>
                      setActionError(t('No se ha podido abrir el enlace.'))
                    )
                  }>
                  {link}
                </ThemedText>
              ) : item.place ? (
                <ThemedText selectable themeColor="textSecondary">
                  {item.place}
                </ThemedText>
              ) : null}
              {item.closed && (
                <ThemedText type="small" themeColor="danger">
                  {t('Reunión cancelada')}
                </ThemedText>
              )}
              {date.getTime() > asOf && (
                <Button
                  compact
                  variant="secondary"
                  disabled={saving}
                  label={item.closed ? t('Restablecer reunión') : t('Cancelar reunión')}
                  onPress={() => toggle(item)}
                />
              )}
            </View>
          );
        })}
        <Button
          compact
          variant="secondary"
          label={t('Programar reunión')}
          onPress={() => {
            setActionError('');
            setForm('meeting');
          }}
        />
      </View>
      {footer}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    padding: Spacing.one,
    marginHorizontal: Spacing.three,
    marginVertical: Spacing.two,
    borderWidth: Stroke.hairline,
    borderRadius: Radii.medium,
  },
  tab: {
    flex: 1,
    minHeight: Control.minTouch,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderRadius: Radii.small,
  },
  body: { padding: Spacing.three, paddingBottom: Spacing.five, gap: Spacing.four },
  section: { gap: Spacing.two },
  task: {
    minHeight: Control.minTouch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderBottomWidth: Stroke.hairline,
    paddingVertical: Spacing.two,
  },
  check: {
    width: 22,
    height: 22,
    borderWidth: Stroke.thin,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meeting: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderWidth: Stroke.hairline,
    borderRadius: Radii.medium,
  },
});
