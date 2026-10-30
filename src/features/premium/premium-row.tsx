/**
 * La fila de Premium en Cuenta.
 *
 * Con Premium activo dice hasta cuándo y manda a la tienda para gestionarlo
 * (cofounder no cancela nada: lo hace la tienda). Sin él, ofrece Premium.
 * Mientras los cupos no se conocen no ofrece Premium (podría ya tenerlo).
 * «Restaurar compras» está siempre disponible.
 */

import { useState } from 'react';
import { Linking } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { useRepositories } from '@/data';
import { PurchasesUnavailableError, manageSubscriptionsUrl, restore } from '@/lib/purchases';

import { openPaywall } from './open-paywall';

import type { PremiumQuotas } from '@/data';

/** «26 nov 2026», o `null` si la fecha no se entiende. */
export function untilLabel(iso: string | null): string | null {
  if (iso === null || Number.isNaN(Date.parse(iso))) return null;
  return new Date(iso)
    .toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
    .replace(/\./g, '');
}

export function PremiumRow({
  quotas,
  onRestored,
}: {
  quotas: PremiumQuotas | null;
  /** Corre tras restaurar y releer la suscripción, para que la pantalla vuelva a leer los cupos. */
  onRestored?: () => void;
}) {
  const repositories = useRepositories();
  const [restoring, setRestoring] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleRestore() {
    if (restoring) return;
    setRestoring(true);
    setNotice(null);
    try {
      await restore();
      await repositories.premium.syncEntitlement();
      const fresh = await repositories.premium.getQuotas();
      onRestored?.();
      if (!fresh.isPremium) setNotice('No hemos encontrado ninguna suscripción activa.');
    } catch (cause) {
      setNotice(
        cause instanceof PurchasesUnavailableError
          ? cause.message
          : 'No hemos podido restaurar tus compras. Inténtalo otra vez.'
      );
    } finally {
      setRestoring(false);
    }
  }

  const until = quotas?.isPremium ? untilLabel(quotas.premiumUntil) : null;
  return (
    <>
      {quotas?.isPremium ? (
        <>
          <ThemedText type="bodyStrong">
            {until ? `Activo hasta ${until}` : 'Premium activo'}
          </ThemedText>
          <Button
            variant="secondary"
            label="Gestionar suscripción"
            onPress={() => void Linking.openURL(manageSubscriptionsUrl())}
          />
        </>
      ) : quotas ? (
        <Button label="Hazte Premium" variant="secondary" onPress={openPaywall} />
      ) : null}
      <Button
        variant="secondary"
        label={restoring ? 'Restaurando…' : 'Restaurar compras'}
        disabled={restoring}
        onPress={() => void handleRestore()}
      />
      {notice ? (
        <ThemedText type="small" themeColor="textSecondary">
          {notice}
        </ThemedText>
      ) : null}
    </>
  );
}
