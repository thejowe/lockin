/**
 * Errores de dominio de las sesiones Lock-In.
 *
 * Los lanzan los dos backends con el mismo significado; en Supabase salen de los
 * `errcode` LI001–LI004 de los RPCs (ver `src/data/supabase/sessions.ts`). La UI
 * decide qué decir mirando la clase, nunca el mensaje.
 */

/** La sesión cambió antes de la operación, o ya hay otra viva en el match. LI001. */
export class SessionConflictError extends Error {
  override name = 'SessionConflictError';
}

/** La hora de la sesión ya pasó para lo que se intenta. LI002. */
export class SessionExpiredError extends Error {
  override name = 'SessionExpiredError';
}

/** Hora propuesta fuera de rango, o entrada/salida fuera de la ventana. LI003. */
export class SessionWindowError extends Error {
  override name = 'SessionWindowError';
}

/** Operación que no te corresponde: match ajeno o responder a tu propia propuesta. LI004. */
export class SessionForbiddenError extends Error {
  override name = 'SessionForbiddenError';
}
