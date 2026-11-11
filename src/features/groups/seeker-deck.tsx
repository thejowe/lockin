/**
 * Deck de quien busca grupo: los grupos (en los que no está) con un puesto
 * abierto que encaja con lo que domina. Like o pase; si el grupo ya le había
 * dado like, entra en el acto. Lo ve cualquiera por debajo del tope de grupos,
 * también quien ya administra uno.
 */

import { useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { LoadingState, MessageState } from '@/components/state-view';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import {
  GROUP_CREATION_REQUIRES_PREMIUM,
  GroupError,
  useRepositories,
  type Decision,
  type GroupDeckCard,
} from '@/data';
import { openPaywall, usePremium } from '@/features/premium';
import { t } from '@/i18n';

import { DECISION_ACTIONS_SPACE, DecisionDeck } from './decision-deck';
import { GroupCard } from './group-card';
import { useSwipeQueue } from './use-swipe-queue';

const keyOf = (card: GroupDeckCard) => card.group.id;

export function SeekerDeck({
  canCreate,
  notice,
  onJoined,
  onDeckActive,
}: {
  /** Si puede crear un grupo (no administra ya uno). */
  canCreate: boolean;
  /** Aviso encima del deck (p. ej. «estás dentro de…»). */
  notice?: string | null;
  /** Ha entrado en un grupo (con su nombre) o hay que releer «mis grupos» (`null`). */
  onJoined: (name: string | null) => void;
  /** Hay cartas: el swipe horizontal es de la carta, no de las pestañas. */
  onDeckActive?: (active: boolean) => void;
}) {
  const router = useRouter();
  const repositories = useRepositories();
  const { quotas } = usePremium();
  const [safetyOpen, setSafetyOpen] = useState(false);

  const send = useCallback(
    async (card: GroupDeckCard, decision: Decision) => {
      try {
        return await repositories.groups.swipeGroup(card.group.id, decision);
      } catch (cause: unknown) {
        // Ha llegado al tope (entró por otro lado): se relee y la sección cambia sola.
        if (cause instanceof GroupError && cause.reason === 'group-limit') onJoined(null);
        throw cause;
      }
    },
    [repositories, onJoined]
  );
  const { cards, loading, error, saveFailed, decide, refresh } = useSwipeQueue(
    'groups:deck',
    () => repositories.groups.getDeck(),
    keyOf,
    send
  );

  const hasCards = !!cards && cards.length > 0;
  useEffect(() => {
    onDeckActive?.(hasCards);
    return () => onDeckActive?.(false);
  }, [hasCards, onDeckActive]);

  function createGroup() {
    if (GROUP_CREATION_REQUIRES_PREMIUM && !quotas?.isPremium) {
      openPaywall();
      return;
    }
    router.push('/group/new' as Href);
  }

  async function onDecide(card: GroupDeckCard, decision: Decision) {
    setSafetyOpen(false);
    const result = await decide(card, decision);
    if (result?.joined) {
      onJoined(card.group.name);
      // Ya está dentro: el resto del deck puede haber cambiado (tope, bloqueos).
      refresh();
    }
  }

  if (loading) return <LoadingState label={t('Buscando grupos…')} />;
  if (error && !hasCards) {
    return (
      <MessageState
        title={t('No hemos podido cargar los grupos')}
        body={t('Inténtalo otra vez en un momento.')}>
        <Button label={t('Reintentar')} onPress={refresh} />
      </MessageState>
    );
  }
  if (!hasCards) {
    return (
      <MessageState
        title={t('Ningún grupo busca ahora lo que dominas')}
        body={
          canCreate
            ? t(
                'Cuando un grupo busque un perfil como el tuyo, saldrá aquí. También puedes crear el tuyo.'
              )
            : t('Cuando un grupo busque un perfil como el tuyo, saldrá aquí.')
        }>
        {notice ? (
          <ThemedText type="small" themeColor="teal" accessibilityLiveRegion="polite">
            {notice}
          </ThemedText>
        ) : null}
        {canCreate ? <Button label={t('Crear grupo')} onPress={createGroup} /> : null}
        <Button
          label={t('Volver a comprobar')}
          variant={canCreate ? 'secondary' : undefined}
          onPress={refresh}
        />
      </MessageState>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
          {t('Grupos que buscan lo que dominas')}
        </ThemedText>
        {canCreate ? (
          <Button label={t('Crear grupo')} variant="secondary" compact onPress={createGroup} />
        ) : null}
      </View>

      {notice ? (
        <ThemedText type="small" themeColor="teal" accessibilityLiveRegion="polite">
          {notice}
        </ThemedText>
      ) : null}

      {saveFailed ? (
        <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
          {t('No hemos podido guardar tu última decisión. La tarjeta sigue en el deck.')}
        </ThemedText>
      ) : null}

      <DecisionDeck
        items={cards}
        keyOf={keyOf}
        disabled={safetyOpen}
        likeLabel={t('Quiero entrar')}
        passLabel={t('Pasar')}
        onDecide={(card, decision) => void onDecide(card, decision)}
        renderCard={(card, top) => (
          <GroupCard
            card={card}
            bottomInset={DECISION_ACTIONS_SPACE}
            safetyOpen={top && safetyOpen}
            onSafetyOpenChange={top ? setSafetyOpen : undefined}
            // Bloqueado: el servidor ya lo ha sacado del deck; se relee sin él.
            onBlocked={refresh}
            onOpenMember={
              top ? (id) => router.push({ pathname: '/person/[id]', params: { id } }) : undefined
            }
          />
        )}
      />
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
});
