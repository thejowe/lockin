/**
 * El paywall de Premium.
 *
 * Los precios salen siempre de `getOfferings()` (`priceString`): aquí no hay
 * ninguno escrito a mano. Tras una compra se pide al servidor que relea la
 * suscripción (`syncEntitlement`) y solo se cierra cuando los cupos dicen que
 * Premium está activo: la tienda cobra, el servidor decide.
 *
 * Cancelar la compra no es un error. Un pago `pending` (p. ej. pendiente de
 * aprobación) se cuenta tal cual y no se cierra nada.
 */

import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { LoadingState, MessageState } from '@/components/state-view';
import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radii, Spacing, Stroke } from '@/constants/theme';
import { useRepositories } from '@/data';
import { setMockPremium } from '@/data/mock';
import { hasSupabaseCredentials } from '@/data/supabase/client';
import { useTheme } from '@/hooks/use-theme';
import {
  PurchasesUnavailableError,
  getOfferings,
  purchase,
  restore,
  type PurchasePackage,
} from '@/lib/purchases';

import type { LegalDocKey } from '@/features/legal';

const BENEFITS = [
  'Likes sin límite',
  'Deshacer tu último swipe',
  'Ver quién te ha dado like',
  '5 Super Likes a la semana',
  'Boost: 30 minutos arriba del deck cada mes',
  'Filtros avanzados: disponibilidad, ambición, punto de partida y zona horaria',
];

const RENEWAL = 'Se renueva automáticamente. Cancela cuando quieras desde la tienda.';

type OffersState =
  | { status: 'loading' }
  | { status: 'ready'; offers: PurchasePackage[] }
  | { status: 'unavailable' }
  | { status: 'error' };

function periodLabel(offer: PurchasePackage): string {
  return offer.period === 'month' ? 'Mensual' : 'Anual';
}

function periodSuffix(offer: PurchasePackage): string {
  return offer.period === 'month' ? 'al mes' : 'al año';
}

export function Paywall({
  onClose,
  onOpenLegal,
}: {
  /** Cierra el paywall (tras comprar o con «Ahora no»). */
  onClose: () => void;
  /** Abre Términos o Privacidad. */
  onOpenLegal: (doc: LegalDocKey) => void;
}) {
  const theme = useTheme();
  const repositories = useRepositories();
  const [state, setState] = useState<OffersState>({ status: 'loading' });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [simulated, setSimulated] = useState(false);

  // El interruptor refleja el Premium real del mock, no un `false` de partida.
  useEffect(() => {
    let cancelled = false;
    void repositories.premium.getQuotas().then(
      (quotas) => {
        if (!cancelled) setSimulated(quotas.isPremium);
      },
      () => {}
    );
    return () => {
      cancelled = true;
    };
  }, [repositories]);

  // Cada cambio de `attempt` vuelve a pedir las ofertas («Reintentar»).
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getOfferings().then(
      (offers) => {
        if (cancelled) return;
        setSelectedId((current) =>
          offers.some((offer) => offer.id === current)
            ? current
            : ((offers.find((offer) => offer.period === 'year') ?? offers[0])?.id ?? null)
        );
        setState({ status: 'ready', offers });
      },
      (cause: unknown) => {
        if (cancelled) return;
        setState({ status: cause instanceof PurchasesUnavailableError ? 'unavailable' : 'error' });
      }
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  /** Relee la suscripción en el servidor y cierra si Premium ya está activo. */
  async function settle(): Promise<boolean> {
    await repositories.premium.syncEntitlement();
    const quotas = await repositories.premium.getQuotas();
    if (quotas.isPremium) {
      onClose();
      return true;
    }
    return false;
  }

  async function handleBuy() {
    if (!selectedId || busy) return;
    setBusy('buy');
    setNotice(null);
    try {
      const result = await purchase(selectedId);
      if (result === 'cancelled') return;
      if (result === 'pending') {
        setNotice('Pago pendiente de confirmar');
        return;
      }
      if (!(await settle())) {
        setNotice('Tu compra se está procesando. Si no se activa, prueba «Restaurar compras».');
      }
    } catch {
      setNotice('No hemos podido completar la compra. Inténtalo otra vez.');
    } finally {
      setBusy(null);
    }
  }

  async function handleRestore() {
    if (busy) return;
    setBusy('restore');
    setNotice(null);
    try {
      await restore();
      if (!(await settle())) setNotice('No hemos encontrado ninguna suscripción activa.');
    } catch (cause) {
      setNotice(
        cause instanceof PurchasesUnavailableError
          ? cause.message
          : 'No hemos podido restaurar tus compras. Inténtalo otra vez.'
      );
    } finally {
      setBusy(null);
    }
  }

  function handleSimulate(next: boolean) {
    setSimulated(next);
    setMockPremium(next);
    if (next) onClose();
  }

  if (state.status === 'loading') {
    return <LoadingState label="Cargando los planes…" />;
  }

  const showSimulator = __DEV__ && !hasSupabaseCredentials;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      <View style={styles.inner}>
        <View style={styles.header}>
          <ThemedText type="label" themeColor="brass">
            Premium
          </ThemedText>
          <ThemedText type="title">Encuentra cofundador sin frenos</ThemedText>
        </View>

        <View style={styles.benefits}>
          {BENEFITS.map((benefit) => (
            <View key={benefit} style={styles.benefit}>
              <Icon name="check" size={18} color={theme.brass} />
              <ThemedText type="body" style={styles.benefitText}>
                {benefit}
              </ThemedText>
            </View>
          ))}
        </View>

        {state.status === 'ready' ? (
          <View style={styles.plans}>
            {state.offers.map((offer) => {
              const selected = offer.id === selectedId;
              return (
                <Pressable
                  key={offer.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${periodLabel(offer)}, ${offer.priceString} ${periodSuffix(offer)}`}
                  onPress={() => setSelectedId(offer.id)}
                  style={[
                    styles.plan,
                    {
                      backgroundColor: selected ? theme.brassSoft : theme.backgroundElement,
                      borderColor: selected ? theme.brass : theme.border,
                    },
                  ]}>
                  <View style={styles.planText}>
                    <ThemedText type="heading">{periodLabel(offer)}</ThemedText>
                    {offer.period === 'year' ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        {`${offer.pricePerMonthString} al mes`}
                      </ThemedText>
                    ) : null}
                  </View>
                  <ThemedText type="bodyStrong">{`${offer.priceString} ${periodSuffix(offer)}`}</ThemedText>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <MessageState
            title={
              state.status === 'unavailable'
                ? 'Las compras aún no están disponibles'
                : 'No hemos podido cargar los planes'
            }
            body={
              state.status === 'unavailable'
                ? 'Vuelve a mirar en unos días.'
                : 'Comprueba tu conexión e inténtalo otra vez.'
            }>
            {state.status === 'error' ? (
              <Button
                label="Reintentar"
                variant="secondary"
                onPress={() => {
                  setState({ status: 'loading' });
                  setAttempt((n) => n + 1);
                }}
              />
            ) : null}
          </MessageState>
        )}

        {state.status === 'ready' ? (
          <>
            <Button
              label={busy === 'buy' ? 'Comprando…' : 'Hazte Premium'}
              disabled={busy !== null || selectedId === null}
              onPress={() => void handleBuy()}
            />
            <ThemedText type="caption" themeColor="textMuted" style={styles.centered}>
              {RENEWAL}
            </ThemedText>
          </>
        ) : null}

        {notice ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
            {notice}
          </ThemedText>
        ) : null}

        <Button
          label={busy === 'restore' ? 'Restaurando…' : 'Restaurar compras'}
          variant="secondary"
          disabled={busy !== null}
          onPress={() => void handleRestore()}
        />
        <Button label="Ahora no" variant="secondary" onPress={onClose} />

        <View style={styles.legal}>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Términos de uso"
            onPress={() => onOpenLegal('terms')}>
            <ThemedText type="small" themeColor="brass">
              Términos de uso
            </ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Política de privacidad"
            onPress={() => onOpenLegal('privacy')}>
            <ThemedText type="small" themeColor="brass">
              Política de privacidad
            </ThemedText>
          </Pressable>
        </View>

        {showSimulator ? (
          <View style={[styles.simulator, { borderColor: theme.border }]}>
            <ThemedText type="small" themeColor="textSecondary">
              Solo desarrollo
            </ThemedText>
            <ThemedText type="body" style={styles.benefitText}>
              Simular Premium
            </ThemedText>
            <Switch
              accessibilityLabel="Simular Premium"
              value={simulated}
              onValueChange={handleSimulate}
            />
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    padding: Spacing.four,
  },
  inner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.three,
  },
  header: {
    gap: Spacing.one,
  },
  benefits: {
    gap: Spacing.two,
  },
  benefit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  benefitText: {
    flex: 1,
  },
  plans: {
    gap: Spacing.two,
  },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radii.large,
    borderWidth: Stroke.hairline,
  },
  planText: {
    flex: 1,
  },
  centered: {
    textAlign: 'center',
  },
  legal: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.four,
  },
  simulator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radii.medium,
    borderWidth: Stroke.hairline,
  },
});
