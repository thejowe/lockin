/**
 * La sección «Grupos» de Descubrir. Decide qué se ve según dónde está la
 * persona:
 *
 * - sin grupo: el deck de grupos que buscan lo que domina (`SeekerDeck`);
 * - administra un grupo: el deck de reclutamiento (`RecruitDeck`);
 * - es miembro sin administrar: su grupo (`GroupHome`) — con un grupo por
 *   persona no hay más grupos que enseñarle.
 *
 * `SectionSwitch` es el selector «Cofundador | Grupos» que la pantalla pone
 * encima; vive aquí para que Descubrir solo componga.
 */

import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { LoadingState, MessageState } from '@/components/state-view';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing, Stroke } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

import { GroupHome } from './group-home';
import { RecruitDeck } from './recruit-deck';
import { SeekerDeck } from './seeker-deck';
import { useGroupPush } from './use-group-push';
import { useMyGroup } from './use-my-group';

export type DiscoverSection = 'cofounder' | 'groups';

export function SectionSwitch({
  value,
  onChange,
}: {
  value: DiscoverSection;
  onChange: (next: DiscoverSection) => void;
}) {
  const theme = useTheme();
  const options: { value: DiscoverSection; label: string }[] = [
    { value: 'cofounder', label: t('Cofundador') },
    { value: 'groups', label: t('Grupos') },
  ];

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.switch,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            style={[styles.option, selected && { backgroundColor: theme.backgroundSelected }]}>
            <ThemedText type="smallBold" themeColor={selected ? 'text' : 'textSecondary'}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function GroupsSection({
  onDeckActive,
}: {
  /** Hay un deck con cartas: el swipe horizontal es suyo, no de las pestañas. */
  onDeckActive?: (active: boolean) => void;
}) {
  const mine = useMyGroup();
  const [justJoined, setJustJoined] = useState(false);
  const refreshMine = mine.refresh;
  // Estar en un grupo es cuando los avisos de su chat tienen sentido.
  useGroupPush(!!mine.group);

  const onJoined = useCallback(() => {
    setJustJoined(true);
    refreshMine();
  }, [refreshMine]);

  if (mine.loading) return <LoadingState label={t('Cargando grupos…')} />;
  if (mine.error) {
    return (
      <MessageState
        title={t('No hemos podido cargar los grupos')}
        body={t('Inténtalo otra vez en un momento.')}>
        <Button label={t('Reintentar')} onPress={mine.refresh} />
      </MessageState>
    );
  }

  if (!mine.group) return <SeekerDeck onJoined={onJoined} onDeckActive={onDeckActive} />;

  if (mine.group.isAdmin) {
    return (
      <RecruitDeck view={mine.group} onMemberJoined={mine.refresh} onDeckActive={onDeckActive} />
    );
  }

  return (
    <GroupHome
      view={mine.group}
      notice={justJoined ? t('¡Estás dentro! Ya puedes escribir en el chat del grupo.') : undefined}
      onLeft={() => setJustJoined(false)}
    />
  );
}

const styles = StyleSheet.create({
  switch: {
    flexDirection: 'row',
    padding: Spacing.half,
    borderRadius: Radii.pill,
    borderWidth: Stroke.hairline,
  },
  option: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Radii.pill,
  },
});
