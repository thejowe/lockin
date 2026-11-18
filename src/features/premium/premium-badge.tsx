/**
 * El distintivo de Premium: un diamante pequeño, en el azul del diamante, junto
 * al nombre. Solo el diamante, sin texto: dice «esta persona tiene Premium» y
 * nada de hasta cuándo ni de qué plan.
 */

import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/icon';
import { useRepositories } from '@/data';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

/** ¿Tiene Premium esta persona? `false` mientras se pregunta o si la consulta falla. */
export function usePremiumBadge(profileId: string): boolean {
  // `repositories.premium` solo se toca en el efecto, nunca al renderizar.
  const repositories = useRepositories();
  const [owner, setOwner] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    repositories.premium.listBadges([profileId]).then(
      (ids) => {
        if (!cancelled) setOwner(ids.includes(profileId) ? profileId : null);
      },
      () => {
        if (!cancelled) setOwner(null);
        // Sin saberlo no se pone el distintivo: es decorativo, no merece un error.
      }
    );
    return () => {
      cancelled = true;
    };
  }, [repositories, profileId]);

  return owner === profileId;
}

export function PremiumBadge({ profileId, size = 18 }: { profileId: string; size?: number }) {
  const theme = useTheme();
  const badged = usePremiumBadge(profileId);
  if (!badged) return null;

  return (
    <View accessible accessibilityLabel={t('Premium')}>
      <Icon name="diamond" size={size} color={theme.diamond} fill={theme.diamond} />
    </View>
  );
}
