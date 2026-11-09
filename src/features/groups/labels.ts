/** Textos de los grupos que comparten varias piezas. */

import { GroupError, PremiumRequiredError } from '@/data';
import { specialtyLabel } from '@/features/profile';
import { t } from '@/i18n';

import type { GroupMemberView, GroupRole } from '@/data';

/** El cargo de un miembro: su puesto, o «Admin» si es quien lleva el grupo y no ocupa plaza. */
export function memberRoleLabel(member: Pick<GroupMemberView, 'specialty' | 'isAdmin'>): string {
  if (member.specialty) {
    return member.isAdmin
      ? t('Admin · {role}', { role: specialtyLabel(member.specialty) })
      : specialtyLabel(member.specialty);
  }
  return member.isAdmin ? t('Admin') : t('Miembro');
}

/** «Desarrollo · 1 de 2 plazas libres». */
export function roleSlotsLabel(role: GroupRole): string {
  const free = Math.max(role.slots - role.filled, 0);
  return free === 0
    ? t('{role} · completo', { role: specialtyLabel(role.specialty) })
    : t('{role} · {free} de {slots} libres', {
        role: specialtyLabel(role.specialty),
        free,
        slots: role.slots,
      });
}

/** Lo que se le dice a la persona cuando una acción de grupos falla. */
export function groupErrorMessage(error: unknown): string {
  if (error instanceof PremiumRequiredError) return t('Crear un grupo requiere Premium.');
  if (error instanceof GroupError) {
    switch (error.reason) {
      case 'already-in-group':
        return t('Ya estás en un grupo. Sal de él para unirte a otro o crear uno.');
      case 'admin-only':
        return t('Solo puede hacerlo quien administra el grupo.');
      case 'unavailable':
        return t('Este grupo ya no está disponible.');
      case 'candidate-unavailable':
        return t('Esa persona ya no está disponible.');
      case 'invalid':
        return t('Revisa los datos del grupo e inténtalo otra vez.');
    }
  }
  return t('No se ha podido completar. Inténtalo otra vez.');
}
