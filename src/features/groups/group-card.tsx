/**
 * Tarjeta de un grupo en el deck de quien busca grupo.
 *
 * Se ve como una tarjeta de Descubrir: la foto y la ficha de una persona del
 * grupo, empezando por quien lo administra. Arriba, una pestaña por integrante
 * (con su cargo: «Admin», «Marketing»…) y, al final, «Proyecto». Al pulsar una
 * pestaña, la tarjeta pasa a la ficha de esa persona; «Proyecto» enseña el
 * nombre, la idea, el puesto que cubriría quien mira y lo que el grupo busca.
 *
 * El menú «⋯» (bloquear o reportar el grupo) sustituye el contenido de la
 * tarjeta mientras está abierto, como en la tarjeta de perfil. Habla siempre
 * del grupo, también sobre la ficha de una persona.
 */

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, ScrimAlpha, Spacing, Stroke } from '@/constants/theme';
import { Chip, ProfileCard } from '@/features/discover';
import { specialtyLabel } from '@/features/profile';
import { SafetyMenuButton } from '@/features/safety/safety-panel';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

import { GroupSafetyPanel } from './group-safety-panel';
import { memberRoleLabel, roleSlotsLabel } from './labels';

import type { GroupDeckCard, GroupMemberView } from '@/data';

/** Pestaña elegida: el id de un integrante, o el proyecto. */
type Tab = string;
const PROJECT_TAB: Tab = '__project__';

/** Quien administra va primero; el resto, en el orden que llega (por antigüedad). */
export function membersAdminFirst(members: GroupMemberView[]): GroupMemberView[] {
  return [...members.filter((m) => m.isAdmin), ...members.filter((m) => !m.isAdmin)];
}

export function GroupCard({
  card,
  bottomInset = 0,
  safetyOpen = false,
  onSafetyOpenChange,
  onBlocked,
  onOpenMember,
}: {
  card: GroupDeckCard;
  /** Hueco para los botones que flotan encima. */
  bottomInset?: number;
  safetyOpen?: boolean;
  /** Sin él, la tarjeta no enseña el menú (la de detrás en el deck). */
  onSafetyOpenChange?: (open: boolean) => void;
  /** Se llama tras bloquear el grupo: el deck pasa a la siguiente. */
  onBlocked?: () => void;
  /** Abre el perfil completo de ese miembro (botón «i»). Sin él, no sale. */
  onOpenMember?: (userId: string) => void;
}) {
  const theme = useTheme();
  const { group, roles, myRole } = card;
  const members = membersAdminFirst(card.members);
  const [tab, setTab] = useState<Tab>(members[0]?.member.userId ?? PROJECT_TAB);
  const selected = members.find((entry) => entry.member.userId === tab) ?? null;

  if (safetyOpen && onSafetyOpenChange) {
    return (
      <View style={[styles.card, styles.panel, { backgroundColor: theme.surfaceOpaque }]}>
        <GroupSafetyPanel
          groupId={group.id}
          name={group.name}
          onClose={() => onSafetyOpenChange(false)}
          onBlocked={() => {
            onSafetyOpenChange(false);
            onBlocked?.();
          }}
        />
      </View>
    );
  }

  const tabs = (
    <MemberTabs
      groupName={group.name}
      members={members}
      selected={selected === null ? PROJECT_TAB : tab}
      onSelect={setTab}
    />
  );

  if (selected?.profile) {
    const profile = selected.profile;
    return (
      <View style={[styles.card, { borderColor: theme.border }]}>
        <ProfileCard
          // Una ficha nueva por persona: empieza en su primera página.
          key={profile.id}
          profile={profile}
          viewerSpecialties={[myRole.specialty]}
          bottomInset={bottomInset}
          topSlot={tabs}
          safetyName={group.name}
          // «⋯» abre el panel del grupo, que pinta esta tarjeta (arriba).
          safetyOpen={false}
          onSafetyOpenChange={(open) => onSafetyOpenChange?.(open)}
          onOpenProfile={onOpenMember ? () => onOpenMember(profile.id) : undefined}
        />
      </View>
    );
  }

  return (
    <View
      style={[styles.card, { backgroundColor: theme.surfaceOpaque, borderColor: theme.border }]}>
      <View
        style={[styles.projectTop, { backgroundColor: `${theme.background}${ScrimAlpha}` }]}>
        <View style={styles.projectTabs}>{tabs}</View>
        {onSafetyOpenChange ? (
          <SafetyMenuButton name={group.name} onPress={() => onSafetyOpenChange(true)} />
        ) : null}
      </View>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Spacing.four + bottomInset }]}
        showsVerticalScrollIndicator={false}>
        {selected !== null ? (
          // Un integrante cuyo perfil no se puede leer (hay un bloqueo de por medio).
          <ThemedText type="body" themeColor="textSecondary">
            {t('No puedes ver el perfil de este integrante.')}
          </ThemedText>
        ) : null}

        <ThemedText type="label" themeColor="textSecondary">
          {t('{count} de {max} miembros', { count: members.length, max: group.maxMembers })}
        </ThemedText>
        <ThemedText type="title">{group.name}</ThemedText>
        <ThemedText type="body" themeColor="textSecondary">
          {group.description}
        </ThemedText>

        <View style={styles.block}>
          <ThemedText type="label" themeColor="textSecondary">
            {t('Encajas como')}
          </ThemedText>
          <View style={styles.chips}>
            <Chip label={`✓ ${specialtyLabel(myRole.specialty)}`} tone="match" />
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
      </ScrollView>
    </View>
  );
}

/** Nombre del grupo y una pestaña por integrante, más «Proyecto» al final. */
function MemberTabs({
  groupName,
  members,
  selected,
  onSelect,
}: {
  groupName: string;
  members: GroupMemberView[];
  selected: Tab;
  onSelect: (tab: Tab) => void;
}) {
  const theme = useTheme();
  const entries: { key: Tab; label: string; a11y: string }[] = [
    ...members.map((entry) => {
      const label = memberRoleLabel(entry);
      const name = entry.profile?.name;
      return {
        key: entry.member.userId,
        label,
        a11y: name ? t('{label}: ver a {name}', { label, name }) : label,
      };
    }),
    { key: PROJECT_TAB, label: t('Proyecto'), a11y: t('Ver el proyecto del grupo') },
  ];

  return (
    <View style={styles.tabsBlock}>
      <ThemedText type="smallBold" numberOfLines={1}>
        {groupName}
      </ThemedText>
      <View style={styles.tabs} accessibilityRole="tablist">
        {entries.map(({ key, label, a11y }) => {
          const active = key === selected;
          return (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityLabel={a11y}
              accessibilityState={{ selected: active }}
              onPress={(event) => {
                // Que el toque no llegue a la tarjeta, que pasaría de página.
                event.stopPropagation();
                onSelect(key);
              }}
              style={({ pressed }) => [
                styles.tab,
                {
                  backgroundColor: active ? theme.text : theme.backgroundSelected,
                  borderColor: active ? theme.text : theme.border,
                },
                pressed && styles.pressed,
              ]}>
              <ThemedText
                type="smallBold"
                numberOfLines={1}
                style={{ color: active ? theme.background : theme.text }}>
                {label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: Radii.card,
    borderWidth: Stroke.hairline,
  },
  panel: { padding: Spacing.three, borderWidth: 0 },
  projectTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    paddingTop: Spacing.two + Spacing.one,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.two,
    paddingBottom: Spacing.two,
  },
  projectTabs: { flex: 1 },
  content: { gap: Spacing.three, padding: Spacing.four, paddingTop: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  block: { gap: Spacing.one },
  tabsBlock: { gap: Spacing.one + Spacing.half },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one + Spacing.half },
  tab: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two + Spacing.half,
    borderRadius: Radii.pill,
    borderWidth: Stroke.thin,
  },
  pressed: { opacity: 0.6 },
});
