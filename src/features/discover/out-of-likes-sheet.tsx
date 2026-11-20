/**
 * La hoja que sale cuando el servidor rechaza una decisión por cupo
 * (`QuotaExceededError`) o por falta de Premium (`PremiumRequiredError`).
 *
 * Sube desde abajo sobre el deck, que se queda donde estaba: la carta no se ha
 * descartado, y al cerrar se sigue exactamente ahí. La hora de «Sin likes hasta
 * las HH:MM» sale de `resetsAt`, que manda el servidor, y se enseña en la zona
 * del dispositivo; nunca se calcula con el reloj del móvil, que puede ir
 * adelantado o atrasado.
 *
 * Solo ofrece Premium cuando Premium lo arregla: el tope antiabuso (300 al día)
 * y el Boost (que ya es de Premium) se cierran con «Entendido».
 */

import { FormSheet } from '@/components/form-sheet';

import { ThemedText } from '@/components/themed-text';
import { FREE_LIKES_PER_DAY, PREMIUM_SUPERS_PER_WEEK } from '@/data';

import { ActionButton } from './action-button';
import { clockOf, untilLabel } from './reset-time';

import type { Blocked } from './use-deck';
import { getIntlLocale, t } from '@/i18n';

/** «el martes 27 de octubre a las 20:30», o `null` si la fecha no se entiende. */
function dayAndClock(iso: string | null): string | null {
  if (iso === null || Number.isNaN(Date.parse(iso))) return null;
  const day = new Date(iso).toLocaleDateString(getIntlLocale(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return t('el {day} a las {v}', { day, v: clockOf(iso) });
}

interface Copy {
  title: string;
  body: string;
  /** Si Premium lo arregla. */
  upgrade: boolean;
}

function copyFor(blocked: Exclude<Blocked, null>): Copy {
  if (blocked === 'premium') {
    return {
      title: t('Esto es de Premium'),
      body: t('Deshacer y el Boost son de Premium.'),
      upgrade: true,
    };
  }

  const when = dayAndClock(blocked.resetsAt);
  switch (blocked.kind) {
    case 'likes':
      return {
        title:
          blocked.resetsAt !== null && !Number.isNaN(Date.parse(blocked.resetsAt))
            ? t('Sin likes hasta {v}', { v: untilLabel(blocked.resetsAt) })
            : t('Sin likes por ahora'),
        body: t('Has gastado tus {FREE_LIKES_PER_DAY} likes de hoy. Con Premium no hay límite.', {
          FREE_LIKES_PER_DAY,
        }),
        upgrade: true,
      };
    case 'supers':
      return {
        title: t('Sin Super Likes por ahora'),
        body: when
          ? t(
              'Tu próximo Super Like llega {when}. Con Premium tienes {PREMIUM_SUPERS_PER_WEEK} a la semana.',
              { when, PREMIUM_SUPERS_PER_WEEK }
            )
          : t('Con Premium tienes {PREMIUM_SUPERS_PER_WEEK} a la semana.', {
              PREMIUM_SUPERS_PER_WEEK,
            }),
        upgrade: true,
      };
    case 'boost':
      return {
        title: t('Boost no disponible'),
        body: when
          ? t('Podrás usar otro {when}.', { when })
          : t('Ya has usado tu Boost de este mes.'),
        upgrade: false,
      };
    case 'abuse':
      return {
        title: t('Demasiados likes por hoy'),
        body: t('Has dado demasiados likes hoy. Inténtalo más tarde.'),
        upgrade: false,
      };
  }
}

export function OutOfLikesSheet({
  blocked,
  onClose,
  onUpgrade,
  isPremium = false,
}: {
  /** Qué ha frenado la decisión, o `null` con la hoja cerrada. */
  blocked: Blocked;
  onClose: () => void;
  /** «Hazte Premium»: abre el paywall. */
  onUpgrade: () => void;
  /** Con Premium ya activo, ofrecerlo no arregla nada. */
  isPremium?: boolean;
}) {
  const copy = blocked ? copyFor(blocked) : null;
  const upgrade = copy?.upgrade === true && !isPremium;

  if (!copy) return null;
  return (
    <FormSheet
      testID="out-of-likes-modal"
      onClose={onClose}
      header={<ThemedText type="subtitle">{copy.title}</ThemedText>}
      footer={upgrade && <ActionButton label={t('Hazte Premium')} onPress={onUpgrade} />}>
      <ThemedText themeColor="textSecondary">{copy.body}</ThemedText>
    </FormSheet>
  );
}
