/**
 * «Te han dado like»: la cuadrícula de quien ya te ha elegido.
 *
 * Con Premium salen los perfiles (los Super Likes primero, con insignia) y al
 * tocar uno se abre su tarjeta con «Pasar» y «Me gusta». Sin Premium solo hay
 * relleno genérico —una tarjeta por like, sin foto ni nombre— y el paywall:
 * nunca se baja la lista real al cliente gratis, ni difuminada.
 *
 * Si el like choca con un cupo o con Premium la tarjeta se queda donde estaba y
 * se abre la misma hoja que en el deck. Un like que crea match abre el
 * `MatchModal`, igual que al swipear.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { LoadingState } from '@/components/state-view';
import { ThemedText } from '@/components/themed-text';
// Archivos sueltos y no el índice de `discover`: `discover` importa de `premium`, y pasar
// por su índice cerraría un ciclo.
import { ActionButton } from '@/features/discover/action-button';
import { MatchModal } from '@/features/discover/match-modal';
import { OutOfLikesSheet } from '@/features/discover/out-of-likes-sheet';
import { MaxContentWidth, Radii, ScrimAlpha, Spacing, Stroke } from '@/constants/theme';
import {
  PremiumRequiredError,
  QuotaExceededError,
  incomingLikeCursor,
  useQuery,
  useRepositories,
} from '@/data';
import { ProfileAvatar } from '@/features/profile';
import { useTheme } from '@/hooks/use-theme';

import { openPaywall } from './open-paywall';
import { usePremium } from './use-premium';

import type { Blocked, MatchEvent } from '@/features/discover';
import type { Decision, IncomingLike } from '@/data';

/** Tarjetas por página, y tope de tarjetas de relleno sin Premium. */
const PAGE_SIZE = 20;
const MAX_FILLERS = 12;

/** Una tarjeta sin datos: la forma de «alguien te ha dado like», nada más. */
function Filler() {
  const theme = useTheme();
  return (
    <View
      testID="incoming-like-filler"
      accessible={false}
      style={[
        styles.tile,
        styles.filler,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ]}>
      <Icon name="lock" size={20} color={theme.textMuted} />
    </View>
  );
}

function Tile({ like, onPress }: { like: IncomingLike; onPress: () => void }) {
  const theme = useTheme();
  const { profile } = like;

  return (
    <Pressable
      testID="incoming-like-tile"
      accessibilityRole="button"
      accessibilityLabel={`${profile.name}${like.isSuper ? ', Super Like' : ''}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        {
          backgroundColor: pressed ? theme.backgroundSelected : theme.backgroundElement,
          borderColor: like.isSuper ? theme.brass : theme.border,
        },
      ]}>
      <ProfileAvatar avatar={profile.avatar} size="large" />
      <ThemedText type="heading" numberOfLines={1} style={styles.centered}>
        {profile.name}
      </ThemedText>
      {like.isSuper ? (
        <View style={[styles.badge, { backgroundColor: theme.brassSoft }]}>
          <Icon name="sparkle" size={12} color={theme.brass} strokeWidth={2.2} />
          <ThemedText type="caption" themeColor="brass">
            Super Like
          </ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
}

export function IncomingLikes({ onOpenChat }: { onOpenChat: (matchId: string) => void }) {
  const theme = useTheme();
  const repositories = useRepositories();
  const { quotas, loading: quotasLoading } = usePremium();
  const isPremium = quotas?.isPremium ?? false;
  const count = useQuery('incoming-likes-count', () => repositories.premium.countIncomingLikes());

  const [likes, setLikes] = useState<IncomingLike[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<IncomingLike | null>(null);
  const [match, setMatch] = useState<MatchEvent | null>(null);
  const [blocked, setBlocked] = useState<Blocked>(null);
  const loadingPage = useRef(false);
  const exhausted = useRef(false);

  /** Pide una página y la añade sin repetir a nadie. `before` es el cursor de la última tarjeta. */
  const loadPage = useCallback(
    (before?: string) => {
      if (loadingPage.current || exhausted.current) return Promise.resolve();
      loadingPage.current = true;
      return repositories.premium.listIncomingLikes({ before, limit: PAGE_SIZE }).then(
        (page) => {
          loadingPage.current = false;
          if (page.length === 0) exhausted.current = true;
          setFailed(false);
          setLikes((current) => {
            const seen = new Set((current ?? []).map((like) => like.profile.id));
            return [...(current ?? []), ...page.filter((like) => !seen.has(like.profile.id))];
          });
        },
        () => {
          loadingPage.current = false;
          setFailed(true);
          setLikes((current) => current ?? []);
        }
      );
    },
    [repositories]
  );

  useEffect(() => {
    // El `.then` de `loadPage` es quien escribe el estado, no el cuerpo del efecto.
    if (isPremium) void loadPage();
  }, [isPremium, loadPage]);

  function loadMore() {
    const last = likes?.[likes.length - 1];
    if (last) void loadPage(incomingLikeCursor(last));
  }

  async function decide(like: IncomingLike, decision: Decision) {
    setSelected(null);
    try {
      const result = await repositories.discovery.recordDecision(like.profile.id, decision, 'par');
      setLikes((current) => (current ?? []).filter((item) => item.profile.id !== like.profile.id));
      count.refresh();
      if (result.match) setMatch({ match: result.match, profile: like.profile });
    } catch (cause) {
      if (cause instanceof QuotaExceededError) {
        setBlocked({ kind: cause.kind, resetsAt: cause.resetsAt });
      } else if (cause instanceof PremiumRequiredError) {
        setBlocked('premium');
      } else {
        setFailed(true);
      }
    }
  }

  const fillers = Math.min(count.data ?? 0, MAX_FILLERS);

  let body: React.ReactNode;
  if (quotasLoading || (isPremium && likes === null)) {
    body = <LoadingState label="Cargando tus likes…" />;
  } else if (!isPremium) {
    body = (
      <View style={styles.free}>
        <View style={styles.grid}>
          {Array.from({ length: fillers }, (_, index) => (
            <Filler key={index} />
          ))}
        </View>
        <ThemedText type="body" themeColor="textSecondary" style={styles.centered}>
          Con Premium ves quién te ha dado like y puedes devolverlo desde aquí.
        </ThemedText>
        <ActionButton label="Hazte Premium" onPress={openPaywall} />
      </View>
    );
  } else {
    body = (
      <FlatList
        testID="incoming-likes-list"
        data={likes ?? []}
        numColumns={2}
        keyExtractor={(like) => like.profile.id}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => <Tile like={item} onPress={() => setSelected(item)} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <ThemedText type="body" themeColor="textSecondary" style={styles.centered}>
            {failed ? 'No hemos podido cargar tus likes.' : 'Nadie te ha dado like todavía'}
          </ThemedText>
        }
      />
    );
  }

  return (
    <View style={styles.root}>
      {body}

      <Modal
        visible={selected !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}>
        {selected ? (
          <View style={[styles.backdrop, { backgroundColor: theme.background + ScrimAlpha }]}>
            <View
              accessibilityViewIsModal
              style={[
                styles.sheet,
                { backgroundColor: theme.surfaceOpaque, borderColor: theme.border },
              ]}>
              <ProfileAvatar avatar={selected.profile.avatar} size="large" />
              <ThemedText type="subtitle" style={styles.centered}>
                {selected.profile.name}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
                {selected.isSuper ? 'Te ha dado un Super Like · ' : ''}
                {selected.profile.location}
              </ThemedText>
              <View style={styles.actions}>
                <ActionButton
                  label="Pasar"
                  variant="secondary"
                  onPress={() => void decide(selected, 'pass')}
                />
                <ActionButton label="Me gusta" onPress={() => void decide(selected, 'like')} />
              </View>
              <ActionButton label="Cerrar" variant="secondary" onPress={() => setSelected(null)} />
            </View>
          </View>
        ) : null}
      </Modal>

      <OutOfLikesSheet
        blocked={blocked}
        isPremium={isPremium}
        onClose={() => setBlocked(null)}
        onUpgrade={() => {
          setBlocked(null);
          openPaywall();
        }}
      />

      <MatchModal
        event={match}
        onOpenChat={(matchId) => {
          setMatch(null);
          onOpenChat(matchId);
        }}
        onDismiss={() => setMatch(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  list: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  row: {
    gap: Spacing.three,
  },
  free: {
    padding: Spacing.three,
    gap: Spacing.four,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  tile: {
    flex: 1,
    minWidth: '40%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radii.large,
    borderWidth: Stroke.hairline,
  },
  filler: {
    flexGrow: 0,
    flexBasis: '44%',
    height: 120,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Radii.pill,
  },
  centered: {
    textAlign: 'center',
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: Spacing.three,
  },
  sheet: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Radii.sheet,
    borderWidth: Stroke.hairline,
  },
  actions: {
    alignSelf: 'stretch',
    gap: Spacing.two,
  },
});
