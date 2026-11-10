/**
 * Si esta cuenta ya ha visto el mini tutorial.
 *
 * Sale una vez por cuenta: a quien acaba de crear el perfil y, desde el
 * 2026-11-10, también a quien ya la tenía de antes (así se entera de Grupos
 * al actualizar). Se recuerda en `AsyncStorage`, como las pistas del deck: es
 * comodidad de este teléfono, no un dato de la cuenta. Si no se puede leer, no
 * se enseña — mejor perderse el tutorial que quedarse atascado en él.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const tourSeenKey = (userId: string) => `cofounder.tour.seen.${userId}`;

/** `true` si hay que enseñarle el tutorial a esta cuenta. */
export async function isTourPending(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  try {
    return (await AsyncStorage.getItem(tourSeenKey(userId))) === null;
  } catch {
    return false;
  }
}

/** Lo marca como visto. Sin esperar ni fallar: lo peor es que salga otra vez. */
export function markTourSeen(userId: string | null | undefined): void {
  if (!userId) return;
  void AsyncStorage.setItem(tourSeenKey(userId), '1').catch(() => undefined);
}
