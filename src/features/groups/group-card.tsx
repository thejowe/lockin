/**
 * Tarjeta de un grupo en el deck de quien busca grupo.
 *
 * Arriba, los cargos que ya están cubiertos: cada chip es una persona de dentro
 * y, al pulsarlo, se abre su perfil. Debajo, el nombre, el proyecto y el puesto
 * que cubriría quien mira; al final, lo que el grupo sigue buscando.
 *
 * El menú «⋯» (bloquear o reportar el grupo) sustituye el contenido de la
 * tarjeta mientras está abierto, como en la tarjeta de perfil.
 */

import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing, Stroke } from '@/constants/theme';
import { Chip } from '@/features/discover';
import { specialtyLabel } from '@/features/profile';
import { SafetyMenuButton } from '@/features/safety/safety-panel';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

import { GroupSafetyPanel } from './group-safety-panel';
import { memberRoleLabel, roleSlotsLabel } from './labels';

import type { GroupDeckCard } from '@/data';

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
  /** Abre el perfil de ese miembro. Sin él, los chips no se pulsan. */
  onOpenMember?: (userId: string) => void;
}) {
  const theme = useTheme();
  const { group, roles, members, myRole } = card;

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

  return (
    <View
      style={[styles.card, { backgroundColor: theme.surfaceOpaque, borderColor: theme.border }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Spacing.four + bottomInset }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.topLine}>
          <ThemedText type="label" themeColor="textSecondary">
            {t('{count} de {max} miembros', { count: members.length, max: group.maxMembers })}
          </ThemedText>
          {onSafetyOpenChange ? (
            <SafetyMenuButton name={group.name} onPress={() => onSafetyOpenChange(true)} />
          ) : null}
        </View>

        <View style={styles.chips} accessibilityLabel={t('Quién está ya en el grupo')}>
          {members.map((entry) => {
            const label = memberRoleLabel(entry);
            const name = entry.profile?.name;
            if (!onOpenMember || !name) return <Chip key={entry.member.userId} label={label} />;
            return (
              <Pressable
                key={entry.member.userId}
                accessibilityRole="button"
                accessibilityLabel={t('{label}: ver el perfil de {name}', { label, name })}
                onPress={() => onOpenMember(entry.member.userId)}
                style={({ pressed }) => (pressed ? styles.pressed : null)}>
                <Chip label={label} tone="have" />
              </Pressable>
            );
          })}
        </View>

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

const styles = StyleSheet.create({
  card: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: Radii.card,
    borderWidth: Stroke.hairline,
  },
  panel: { padding: Spacing.three, borderWidth: 0 },
  content: { gap: Spacing.three, padding: Spacing.four },
  topLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  block: { gap: Spacing.one },
  pressed: { opacity: 0.6 },
});
