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

import { useMemo, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

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
  useRefreshQueryPrefix,
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

/** Lo que falló al decidir, para poder reintentarlo desde el aviso. */
interface FailedDecision {
  like: IncomingLike;
  decision: Decision;
}

/** Páginas que siguen a la primera, atadas a la lectura de la que cuelgan. */
interface MorePages {
  base: IncomingLike[] | null;
  items: IncomingLike[];
  done: boolean;
  failed: boolean;
}

export function IncomingLikes({ onOpenChat }: { onOpenChat: (matchId: string) => void }) {
  const theme = useTheme();
  const repositories = useRepositories();
  const { quotas, loading: quotasLoading } = usePremium();
  const isPremium = quotas?.isPremium ?? false;
  const count = useQuery('incoming-likes-count', () => repositories.premium.countIncomingLikes());
  const refreshDeck = useRefreshQueryPrefix('deck');

  // La primera página es una consulta registrada: cuando el backend avisa de que las URLs
  // firmadas caducan, `DataProvider` la relee y los perfiles llegan con fotos nuevas.
  const first = useQuery(`incoming-likes:list:${isPremium}`, () =>
    isPremium
      ? repositories.premium.listIncomingLikes({ limit: PAGE_SIZE })
      : Promise.resolve<IncomingLike[]>([])
  );
  const [more, setMore] = useState<MorePages>({
    base: null,
    items: [],
    done: false,
    failed: false,
  });
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const [selected, setSelected] = useState<IncomingLike | null>(null);
  const [match, setMatch] = useState<MatchEvent | null>(null);
  const [blocked, setBlocked] = useState<Blocked>(null);
  const [failedDecision, setFailedDecision] = useState<FailedDecision | null>(null);
  const loadingPage = useRef(false);

  // Las páginas siguientes valen mientras la primera lectura sea la misma: si se relee,
  // se vuelven a pedir al desplazarse.
  const extra = more.base === first.data ? more : { items: [], done: false, failed: false };
  const likes = useMemo(() => {
    if (first.data === null) return null;
    const fresh = new Map<string, IncomingLike>();
    // Una lectura nueva reemplaza al perfil ya conocido, no solo añade ids nuevos.
    for (const like of [...first.data, ...extra.items]) fresh.set(like.profile.id, like);
    return [...fresh.values()].filter((like) => !removed.has(like.profile.id));
  }, [first.data, extra.items, removed]);

  function loadMore() {
    const last = likes?.[likes.length - 1];
    const base = first.data;
    if (!last || !base || loadingPage.current || extra.done) return;
    loadingPage.current = true;
    void repositories.premium
      .listIncomingLikes({ before: incomingLikeCursor(last), limit: PAGE_SIZE })
      .then(
        (page) =>
          setMore((current) => {
            const items = current.base === base ? current.items : [];
            return { base, items: [...items, ...page], done: page.length === 0, failed: false };
          }),
        () => setMore((current) => ({ ...current, base, failed: true }))
      )
      .finally(() => {
        loadingPage.current = false;
      });
  }

  async function decide(like: IncomingLike, decision: Decision) {
    setSelected(null);
    setFailedDecision(null);
    try {
      const result = await repositories.discovery.recordDecision(like.profile.id, decision, 'par');
      setRemoved((current) => new Set(current).add(like.profile.id));
      count.refresh();
      // El deck montado no debe volver a ofrecer a quien acabas de decidir aquí.
      refreshDeck();
      if (result.match) setMatch({ match: result.match, profile: like.profile });
    } catch (cause) {
      if (cause instanceof QuotaExceededError) {
        setBlocked({ kind: cause.kind, resetsAt: cause.resetsAt });
      } else if (cause instanceof PremiumRequiredError) {
        setBlocked('premium');
      } else {
        setFailedDecision({ like, decision });
      }
    }
  }

  const fillers = Math.min(count.data ?? 0, MAX_FILLERS);
  const loadFailed = first.error !== null || extra.failed;

  let body: React.ReactNode;
  if (quotasLoading || (isPremium && likes === null && first.error === null)) {
    body = <LoadingState label="Cargando tus likes…" />;
  } else if (!isPremium) {
    body = (
      <ScrollView testID="incoming-likes-scroll" contentContainerStyle={styles.free}>
        <View style={styles.grid}>
          {Array.from({ length: fillers }, (_, index) => (
            <Filler key={index} />
          ))}
        </View>
        <ThemedText type="body" themeColor="textSecondary" style={styles.centered}>
          Con Premium ves quién te ha dado like y puedes devolverlo desde aquí.
        </ThemedText>
        <ActionButton label="Hazte Premium" onPress={openPaywall} />
      </ScrollView>
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
        ListHeaderComponent={
          failedDecision ? (
            <View style={styles.notice}>
              <ThemedText type="small" themeColor="danger">
                No hemos podido guardar tu decisión.
              </ThemedText>
              <ActionButton
                label="Reintentar"
                variant="secondary"
                onPress={() => void decide(failedDecision.like, failedDecision.decision)}
              />
            </View>
          ) : undefined
        }
        ListEmptyComponent={
          <ThemedText type="body" themeColor="textSecondary" style={styles.centered}>
            {loadFailed ? 'No hemos podido cargar tus likes.' : 'Nadie te ha dado like todavía'}
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
  notice: {
    gap: Spacing.two,
    marginBottom: Spacing.three,
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
    // Con dos candados por fila a 44 % queda un 12 % libre: repartido a ambos lados, no pegado a uno.
    justifyContent: 'center',
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
