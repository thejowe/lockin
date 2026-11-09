/**
 * Deck de reclutamiento: lo ve quien administra un grupo. Personas sin grupo
 * que encajan en un puesto con plazas libres, cada una con el puesto que
 * cubriría. La tarjeta es la de perfil de siempre, con ese puesto encima.
 */

import { useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { LoadingState, MessageState } from '@/components/state-view';
import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useRepositories, type Decision, type GroupView, type RecruitCandidate } from '@/data';
import { ProfileCard } from '@/features/discover';
import { specialtyLabel } from '@/features/profile';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

import { DECISION_ACTIONS_SPACE, DecisionDeck } from './decision-deck';
import { useSwipeQueue } from './use-swipe-queue';

const keyOf = (candidate: RecruitCandidate) => candidate.profile.id;

export function RecruitDeck({
  view,
  onMemberJoined,
  onDeckActive,
}: {
  view: GroupView;
  /** Alguien ha entrado: quien compone relee «mi grupo». */
  onMemberJoined: () => void;
  onDeckActive?: (active: boolean) => void;
}) {
  const theme = useTheme();
  const router = useRouter();
  const repositories = useRepositories();
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [joinedName, setJoinedName] = useState<string | null>(null);

  const send = useCallback(
    (candidate: RecruitCandidate, decision: Decision) =>
      repositories.groups.swipeCandidate(candidate.profile.id, candidate.role.id, decision),
    [repositories]
  );
  // Los puestos abiertos entran en la clave: al llenarse uno, el deck se relee
  // y quien solo encajaba en él deja de salir.
  const openRoles = view.roles
    .filter((role) => role.filled < role.slots)
    .map((role) => role.id)
    .join(',');
  const { cards, loading, error, saveFailed, decide, refresh } = useSwipeQueue(
    `groups:recruit:${view.group.id}:${openRoles}`,
    () => repositories.groups.getRecruitDeck(),
    keyOf,
    send
  );

  const hasCards = !!cards && cards.length > 0;
  useEffect(() => {
    onDeckActive?.(hasCards);
    return () => onDeckActive?.(false);
  }, [hasCards, onDeckActive]);

  async function onDecide(candidate: RecruitCandidate, decision: Decision) {
    setSafetyOpen(false);
    const result = await decide(candidate, decision);
    if (result?.joined) {
      setJoinedName(candidate.profile.name);
      onMemberJoined();
    }
  }

  const full = view.members.length >= view.group.maxMembers || openRoles === '';

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.hint} numberOfLines={1}>
          {t('Reclutando para {name}', { name: view.group.name })}
        </ThemedText>
        <Button
          label={t('Tu grupo')}
          variant="secondary"
          compact
          onPress={() => router.push('/group/info' as Href)}
        />
      </View>

      {joinedName ? (
        <ThemedText type="small" themeColor="teal" accessibilityLiveRegion="polite">
          {t('{name} ha entrado en el grupo', { name: joinedName })}
        </ThemedText>
      ) : null}
      {saveFailed ? (
        <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
          {t('No hemos podido guardar tu última decisión. La tarjeta sigue en el deck.')}
        </ThemedText>
      ) : null}

      {loading ? (
        <LoadingState label={t('Buscando personas…')} />
      ) : error && !hasCards ? (
        <MessageState
          title={t('No hemos podido cargar el deck')}
          body={t('Inténtalo otra vez en un momento.')}>
          <Button label={t('Reintentar')} onPress={refresh} />
        </MessageState>
      ) : !hasCards ? (
        <MessageState
          title={full ? t('Tu grupo está completo') : t('No queda nadie por ver')}
          body={
            full
              ? t('Todas las plazas están cubiertas. Ya podéis poneros a construir.')
              : t('Cuando se apunte alguien que encaje en un puesto abierto, saldrá aquí.')
          }>
          <Button label={t('Abrir el chat del grupo')} href={`/group/${view.group.id}` as Href} />
          <Button label={t('Volver a comprobar')} variant="secondary" onPress={refresh} />
        </MessageState>
      ) : (
        <DecisionDeck
          items={cards}
          keyOf={keyOf}
          disabled={safetyOpen}
          likeLabel={t('Quiero a esta persona en el grupo')}
          passLabel={t('Pasar')}
          onDecide={(candidate, decision) => void onDecide(candidate, decision)}
          renderCard={(candidate, top) => (
            <View style={styles.card}>
              <ProfileCard
                profile={candidate.profile}
                bottomInset={DECISION_ACTIONS_SPACE}
                safetyOpen={top ? safetyOpen : undefined}
                onSafetyOpenChange={top ? setSafetyOpen : undefined}
                onBlocked={refresh}
                onOpenProfile={
                  top
                    ? () =>
                        router.push({
                          pathname: '/person/[id]',
                          params: { id: candidate.profile.id },
                        })
                    : undefined
                }
              />
              {top && safetyOpen ? null : (
                <View
                  pointerEvents="none"
                  style={[styles.role, { backgroundColor: theme.background }]}>
                  <ThemedText type="smallBold">
                    {t('Cubriría: {role}', { role: specialtyLabel(candidate.role.specialty) })}
                  </ThemedText>
                </View>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: Spacing.two },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  hint: { flex: 1 },
  card: { flex: 1 },
  role: {
    position: 'absolute',
    top: Spacing.three,
    left: Spacing.three,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two + Spacing.half,
    borderRadius: Radii.pill,
  },
});
