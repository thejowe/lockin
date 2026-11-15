/**
 * Las secciones de grupos de Descubrir (desde el 2026-11-11, con hasta 3
 * grupos por persona y uno administrado):
 *
 * - «Grupos»: el deck de grupos que buscan lo que domina (`SeekerDeck`), para
 *   todo el mundo —también para quien ya está en grupos o administra uno—,
 *   hasta llegar al tope de grupos;
 * - «<nombre de tu grupo>»: solo si administras uno, el deck de reclutamiento
 *   (`RecruitDeck`) para buscarle gente.
 *
 * Los grupos en los que estás se abren desde Matches (una fila por grupo).
 *
 * `SectionSwitch` es el selector «Cofundador | Grupos | <tu grupo>» que la
 * pantalla pone encima; vive aquí para que Descubrir solo componga. Desde el
 * 2026-11-15 la pestaña de tu grupo no se ve en Cofundador: se despliega al
 * entrar en Grupos.
 */

import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { Button } from '@/components/button';
import { LoadingState, MessageState } from '@/components/state-view';
import { ThemedText } from '@/components/themed-text';
import { Duration, Radii, Spacing, Springs, Stroke } from '@/constants/theme';
import { GROUP_MAX_MEMBERSHIPS } from '@/data';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

import { RecruitDeck } from './recruit-deck';
import { SeekerDeck } from './seeker-deck';
import { useGroupPush } from './use-group-push';

import { useMyGroups } from './use-my-group';

export type DiscoverSection = 'cofounder' | 'groups' | 'my-group';

export function SectionSwitch({
  value,
  onChange,
  myGroupName,
}: {
  value: DiscoverSection;
  onChange: (next: DiscoverSection) => void;
  /** El nombre del grupo que administras: con él aparece su pestaña. */
  myGroupName?: string | null;
}) {
  const theme = useTheme();
  const reduceMotion = useReduceMotion();
  const options: { value: DiscoverSection; label: string; a11y: string }[] = [
    { value: 'cofounder', label: t('Cofundador'), a11y: t('Cofundador') },
    { value: 'groups', label: t('Grupos'), a11y: t('Grupos') },
  ];
  // La pestaña de tu grupo cuelga de «Grupos»: solo se despliega estando ahí.
  if (myGroupName && value !== 'cofounder') {
    options.push({
      value: 'my-group',
      label: myGroupName,
      a11y: t('Reclutar para {name}', { name: myGroupName }),
    });
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.switchScroll}
      contentContainerStyle={styles.switchScrollContent}>
      <View
        accessibilityRole="tablist"
        style={[
          styles.switch,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        ]}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Animated.View
              key={option.value}
              // Con «reducir movimiento», la pestaña aparece y se va sin recorrido.
              layout={
                reduceMotion
                  ? undefined
                  : LinearTransition.springify()
                      .damping(Springs.glide.damping)
                      .stiffness(Springs.glide.stiffness)
              }
              entering={reduceMotion ? undefined : FadeIn.duration(Duration.base)}
              exiting={reduceMotion ? undefined : FadeOut.duration(Duration.fast)}>
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={option.a11y}
                onPress={() => onChange(option.value)}
                style={[styles.option, selected && { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText
                  type="smallBold"
                  numberOfLines={1}
                  style={option.value === 'my-group' ? styles.groupLabel : undefined}
                  themeColor={selected ? 'text' : 'textSecondary'}>
                  {option.label}
                </ThemedText>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    </ScrollView>
  );
}

export function GroupsSection({
  section = 'groups',
  onDeckActive,
}: {
  section?: 'groups' | 'my-group';
  /** Hay un deck con cartas: el swipe horizontal es suyo, no de las pestañas. */
  onDeckActive?: (active: boolean) => void;
}) {
  // Descubrir lee lo mismo para la pestaña: la petición se comparte por clave.
  const mine = useMyGroups();
  const [joinedName, setJoinedName] = useState<string | null>(null);
  const refreshMine = mine.refresh;
  // Estar en algún grupo es cuando los avisos de su chat tienen sentido.
  useGroupPush(mine.groups.length > 0);

  const onJoined = useCallback(
    (name: string | null) => {
      setJoinedName(name);
      refreshMine();
    },
    [refreshMine]
  );

  if (mine.loading && mine.groups.length === 0) {
    return <LoadingState label={t('Cargando grupos…')} />;
  }
  if (mine.error && mine.groups.length === 0) {
    return (
      <MessageState
        title={t('No hemos podido cargar los grupos')}
        body={t('Inténtalo otra vez en un momento.')}>
        <Button label={t('Reintentar')} onPress={mine.refresh} />
      </MessageState>
    );
  }

  if (section === 'my-group' && mine.adminGroup) {
    return (
      <RecruitDeck
        view={mine.adminGroup}
        onMemberJoined={mine.refresh}
        onDeckActive={onDeckActive}
      />
    );
  }

  if (mine.groups.length >= GROUP_MAX_MEMBERSHIPS) {
    return (
      <MessageState
        title={t('Ya estás en {max} grupos', { max: GROUP_MAX_MEMBERSHIPS })}
        body={t(
          'Es el máximo. Para buscar otro, sal antes de alguno. Tus grupos están en Matches.'
        )}>
        {joinedName ? (
          <ThemedText type="small" themeColor="teal" accessibilityLiveRegion="polite">
            {t('¡Estás dentro de {name}! Tienes su chat en Matches.', { name: joinedName })}
          </ThemedText>
        ) : null}
      </MessageState>
    );
  }

  return (
    <SeekerDeck
      canCreate={!mine.adminGroup}
      notice={
        joinedName
          ? t('¡Estás dentro de {name}! Tienes su chat en Matches.', { name: joinedName })
          : null
      }
      onJoined={onJoined}
      onDeckActive={onDeckActive}
    />
  );
}

const styles = StyleSheet.create({
  // El selector cabe entero casi siempre; con un nombre largo, se desliza.
  switchScroll: { flexGrow: 0, flexShrink: 1 },
  switchScrollContent: { alignItems: 'center' },
  groupLabel: { maxWidth: 140 },
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
