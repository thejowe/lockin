import {
  validateProject,
  type Project,
  type ProjectRepository,
  type ProjectVersion,
} from '../projects';
import type { MockStore } from './store';
import { t } from '@/i18n';

export function mockProjects(
  store: MockStore,
  actor: string,
  blocked: (a: string, b: string) => boolean
): ProjectRepository {
  function owned(version: ProjectVersion) {
    const row = store.state.projects.find(
      (p) => p.ownerId === actor && p.id === version.id && p.revision === version.revision
    );
    if (!row) throw new Error(t('El proyecto ha cambiado. Vuelve a abrirlo.'));
    return row;
  }
  return {
    async list(ownerId) {
      if (!store.state.profiles.has(ownerId) || blocked(actor, ownerId)) return [];
      return store.state.projects
        .filter((p) => p.ownerId === ownerId)
        .map((p) => ({
          ...p,
          photos: p.photos.map((photo) => ({ ...photo })),
          cover: p.cover && { ...p.cover },
        }));
    },
    async save(input, previous) {
      validateProject(input);
      const rows = store.state.projects;
      if (!store.state.profiles.has(actor)) throw new Error(t('No se ha podido guardar.'));
      const old = previous && owned(previous);
      if (!old && rows.filter((p) => p.ownerId === actor).length >= 3)
        throw new Error(t('Puedes tener hasta tres proyectos.'));
      const next: Project = {
        ...input,
        photos: input.photos.map((p) => ({ ...p })),
        cover: input.cover && { ...input.cover },
        id: old?.id ?? store.createId('project'),
        ownerId: actor,
        revision: store.createId('revision'),
      };
      if (old) rows[rows.indexOf(old)] = next;
      else rows.push(next);
    },
    async remove(previous) {
      const row = owned(previous);
      store.state.projects = store.state.projects.filter((p) => p !== row);
    },
    async promote(previous) {
      const row = owned(previous);
      store.state.projects = [row, ...store.state.projects.filter((p) => p !== row)];
    },
  };
}
