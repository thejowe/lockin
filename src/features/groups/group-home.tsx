/**
 * «Tu grupo»: quién está, qué puestos quedan, el chat y la salida.
 *
 * Lo ve cualquier miembro. Quien administra tiene además «Expulsar» junto a
 * cada persona. Salir y expulsar piden confirmación en la propia pantalla; la
 * plaza queda libre y, si quien sale administraba, el grupo pasa a la persona
 * que lleva más tiempo dentro (o se borra si no queda nadie).
 */

import { useRouter, type Href } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radii, Spacing, Stroke } from '@/constants/theme';
import { useRefreshQuery, useRepositories, type GroupMemberView, type GroupView } from '@/data';
import { ProfileAvatar } from '@/features/profile';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

import { groupErrorMessage, memberRoleLabel, roleSlotsLabel } from './labels';
import { MY_GROUP_QUERY } from './use-my-group';

type Confirm = { kind: 'leave' } | { kind: 'kick'; member: GroupMemberView };

export function GroupHome({
  view,
  notice,
  onLeft,
}: {
  view: GroupView;
  /** Aviso sobre el grupo (p. ej. «acabas de entrar»). */
  notice?: string | null;
  /** Se llama tras salir del grupo. */
  onLeft?: () => void;
}) {
  const theme = useTheme();
  const router = useRouter();
  const repositories = useRepositories();
  const refreshMine = useRefreshQuery(MY_GROUP_QUERY);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const { group, roles, members, isAdmin } = view;

  async function run(action: () => Promise<void>, after?: () => void) {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
      setConfirm(null);
      refreshMine();
      after?.();
    } catch (cause: unknown) {
      setError(groupErrorMessage(cause));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  if (confirm) {
    const leaving = confirm.kind === 'leave';
    const name = leaving ? '' : (confirm.member.profile?.name ?? t('esta persona'));
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="subtitle">
          {leaving
            ? t('¿Salir de {name}?', { name: group.name })
            : t('¿Expulsar a {name}?', { name })}
        </ThemedText>
        <ThemedText type="body" themeColor="textSecondary">
          {leaving
            ? isAdmin
              ? members.length > 1
                ? t(
                    'Tu sitio queda libre y el grupo pasa a quien lleva más tiempo dentro. Dejarás de ver su chat.'
                  )
                : t('Eres la única persona del grupo: al salir, el grupo se borra.')
              : t('Tu sitio queda libre y dejarás de ver el chat del grupo.')
            : t(
                'Su sitio queda libre y dejará de ver el chat del grupo. Le avisaremos si tiene activadas las notificaciones de actividad de grupos.'
              )}
        </ThemedText>
        {error ? (
          <ThemedText type="small" themeColor="danger" accessibilityRole="alert">
            {error}
          </ThemedText>
        ) : null}
        <Button
          label={leaving ? t('Salir del grupo') : t('Expulsar')}
          accessibilityLabel={leaving ? t('Confirmar salida') : t('Confirmar expulsión')}
          variant="danger"
          disabled={busy}
          onPress={() =>
            void (confirm.kind === 'leave'
              ? run(() => repositories.groups.leave(), onLeft)
              : run(() => repositories.groups.kick(confirm.member.member.userId)))
          }
        />
        <Button
          label={t('Cancelar')}
          variant="secondary"
          disabled={busy}
          onPress={() => {
            setError(null);
            setConfirm(null);
          }}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {notice ? (
        <ThemedText type="small" themeColor="teal" accessibilityLiveRegion="polite">
          {notice}
        </ThemedText>
      ) : null}

      <View style={styles.header}>
        <ThemedText type="label" themeColor="textSecondary">
          {t('Tu grupo')}
        </ThemedText>
        <ThemedText type="title">{group.name}</ThemedText>
        <ThemedText type="body" themeColor="textSecondary">
          {group.description}
        </ThemedText>
      </View>

      <Button label={t('Abrir el chat del grupo')} href={`/group/${group.id}` as Href} />

      <View style={styles.block}>
        <ThemedText type="label" themeColor="textSecondary">
          {t('{count} de {max} miembros', { count: members.length, max: group.maxMembers })}
        </ThemedText>
        <View
          style={[
            styles.list,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}>
          {members.map((entry, index) => {
            const name = entry.profile?.name ?? t('Miembro');
            return (
              <View
                key={entry.member.userId}
                style={[
                  styles.row,
                  index > 0 && { borderTopWidth: Stroke.hairline, borderTopColor: theme.border },
                ]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('Ver el perfil de {title}', { title: name })}
                  disabled={!entry.profile}
                  onPress={() =>
                    router.push({ pathname: '/person/[id]', params: { id: entry.member.userId } })
                  }
                  style={({ pressed }) => [styles.person, pressed && styles.pressed]}>
                  {entry.profile ? (
                    <ProfileAvatar avatar={entry.profile.avatar} size="small" />
                  ) : null}
                  <View style={styles.personText}>
                    <ThemedText type="bodyStrong" numberOfLines={1}>
                      {name}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                      {memberRoleLabel(entry)}
                    </ThemedText>
                  </View>
                </Pressable>
                {isAdmin && !entry.isAdmin ? (
                  <Button
                    label={t('Expulsar')}
                    accessibilityLabel={t('Expulsar a {name}', { name })}
                    variant="secondary"
                    compact
                    onPress={() => setConfirm({ kind: 'kick', member: entry })}
                  />
                ) : null}
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.block}>
        <ThemedText type="label" themeColor="textSecondary">
          {t('Perfiles que buscamos')}
        </ThemedText>
        {roles.map((role) => (
          <ThemedText key={role.id} type="small">
            {roleSlotsLabel(role)}
          </ThemedText>
        ))}
      </View>

      {isAdmin ? (
        <Button label={t('Editar grupo')} variant="secondary" href={'/group/edit' as Href} />
      ) : null}

      <Button
        label={t('Salir del grupo')}
        variant="danger"
        onPress={() => setConfirm({ kind: 'leave' })}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.four,
    padding: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  header: { gap: Spacing.one },
  block: { gap: Spacing.two },
  list: { borderRadius: Radii.large, borderWidth: Stroke.hairline, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
  },
  person: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  personText: { flex: 1 },
  pressed: { opacity: 0.6 },
});
