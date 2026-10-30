/**
 * Cuándo se repone un cupo, dicho en la zona del dispositivo.
 *
 * La hora sale siempre de la fecha que manda el servidor; `now` solo decide si
 * esa fecha cae hoy, mañana o más tarde, para no decir «las 21:45» cuando falta
 * casi un día entero.
 */

/** «20:30», en la zona del dispositivo. */
export function clockOf(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Días de calendario (locales) que separan `target` de `now`. */
function calendarDaysBetween(target: Date, now: Date): number {
  const a = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((a - b) / 86_400_000);
}

/**
 * «las 21:45» si es hoy, «mañana a las 21:45» si es mañana y «el 6 de noviembre
 * a las 21:45» después. Para completar «hasta …».
 */
export function untilLabel(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const days = calendarDaysBetween(date, now);
  const time = clockOf(iso);
  if (days <= 0) return `las ${time}`;
  if (days === 1) return `mañana a las ${time}`;
  const day = date.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
  return `el ${day} a las ${time}`;
}
