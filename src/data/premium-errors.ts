/**
 * Errores de dominio de Premium.
 *
 * Los lanzan los dos backends con el mismo significado; en Supabase salen de los
 * `errcode` LQ001–LQ005 de los RPCs. La UI decide qué hacer mirando la clase y
 * `kind`, nunca el mensaje.
 */

/** Qué cupo se agotó. */
export type QuotaKind = 'likes' | 'supers' | 'boost' | 'abuse';

const QUOTA_MESSAGES: Record<QuotaKind, string> = {
  likes: 'Te has quedado sin likes por hoy.',
  supers: 'Ya has usado tus Super Likes de esta semana.',
  boost: 'Ya has usado tu Boost de este mes.',
  abuse: 'Has dado demasiados likes hoy. Inténtalo más tarde.',
};

/** Se agotó un cupo. LQ001–LQ004. */
export class QuotaExceededError extends Error {
  override name = 'QuotaExceededError';
  readonly kind: QuotaKind;
  /** Cuándo se libera un hueco, en ISO y con el reloj del servidor. `null` si no se sabe. */
  readonly resetsAt: string | null;

  constructor(kind: QuotaKind, resetsAt: string | null = null) {
    super(QUOTA_MESSAGES[kind]);
    this.kind = kind;
    this.resetsAt = resetsAt;
  }
}

/** La operación exige Premium. LQ005. */
export class PremiumRequiredError extends Error {
  override name = 'PremiumRequiredError';

  constructor(message = 'Esto requiere Premium.') {
    super(message);
  }
}
