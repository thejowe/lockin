import {
  validateProject,
  type Project,
  type ProjectRepository,
  type ProjectInput,
  type ProjectVersion,
} from '../projects';
import { isBlockedPair, type MockStore } from './store';
import { observeProjectNotifications, recordProjectActivity } from './project-notifications';
import { t } from '@/i18n';

export function projectRecord(
  input: ProjectInput,
  id: string,
  ownerId: string,
  revision: string
): Project {
  return {
    name: input.name.trim(),
    tagline: input.tagline.trim(),
    description: input.description.trim(),
    link: input.link,
    photos: input.photos.map((p) => ({ ...p })),
    cover: input.cover && { ...input.cover },
    id,
    ownerId,
    revision,
  };
}

export function mockProjectView(store: MockStore, project: Project, actor: string): Project {
  const ids = store.state.jointProjects.get(project.id)?.authorIds ?? [project.ownerId];
  return {
    ...project,
    photos: project.photos.map((photo) => ({ ...photo })),
    cover: project.cover && { ...project.cover },
    authors: ids
      .filter((id) => !isBlockedPair(store.state, id, actor))
      .flatMap((id) => {
        const profile = store.state.profiles.get(id);
        return profile ? [{ id, name: profile.name, avatar: { ...profile.avatar } }] : [];
      }),
  };
}

export function mockProjects(
  store: MockStore,
  actor: string,
  blocked: (a: string, b: string) => boolean
): ProjectRepository {
  observeProjectNotifications(store);
  const conflict = () => new Error(t('El proyecto ha cambiado. Vuelve a abrirlo.'));
  const view = (project: Project) => mockProjectView(store, project, actor);
  function authors(project: Project) {
    return store.state.jointProjects.get(project.id)?.authorIds ?? [project.ownerId];
  }
  function availableMatch(id: string) {
    const match = store.state.matches.find((row) => row.id === id);
    return match?.profileIds.includes(actor) && !blocked(...match.profileIds) ? match : null;
  }
  function owned(version: ProjectVersion) {
    const row = store.state.projects.find((p) => p.id === version.id);
    if (!row || !authors(row).includes(actor) || row.revision !== version.revision)
      throw conflict();
    return row;
  }
  function listing(id: string) {
    return store.state.projects.filter(
      (p) => authors(p).includes(id) && (store.state.jointProjects.get(p.id)?.published ?? true)
    );
  }
  function jointForMatch(id: string) {
    return [...store.state.jointProjects.entries()].find(([, row]) => row.matchId === id);
  }
  return {
    async list(ownerId) {
      if (!store.state.profiles.has(ownerId) || blocked(actor, ownerId)) return [];
      return listing(ownerId)
        .filter((p) => authors(p).every((id) => !blocked(actor, id)))
        .map(view);
    },
    async workspace(matchId) {
      if (!availableMatch(matchId)) return null;
      const entry = jointForMatch(matchId);
      if (!entry) return null;
      const [id, joint] = entry;
      const row = store.state.projects.find((p) => p.id === id);
      if (!row || !joint.authorIds.includes(actor)) return null;
      return {
        project: view(row),
        published: joint.published,
        proposedBy: joint.proposedBy,
        hasCapacity: joint.published || joint.authorIds.every((user) => listing(user).length < 3),
        notes: joint.notes,
        notesBy: joint.notesBy,
        notesRevision: joint.notesRevision,
      };
    },
    async lastDeletion(matchId) {
      const event = availableMatch(matchId) && store.state.projectDeletions.get(matchId);
      return event ? { ...event } : null;
    },
    async save(input, previous, draftId, matchId) {
      validateProject(input);
      const rows = store.state.projects;
      if (!store.state.profiles.has(actor)) throw new Error(t('No se ha podido guardar.'));
      const old = previous && owned(previous);
      const match = matchId && availableMatch(matchId);
      if (matchId && (!match || old || jointForMatch(matchId))) throw conflict();
      if (!old && draftId && rows.some((p) => p.id === draftId)) throw conflict();
      if (!old && !match && listing(actor).length >= 3)
        throw new Error(t('Puedes tener hasta tres proyectos.'));
      const group = old && store.state.groups.find((g) => g.projectId === old.id);
      if (group && group.adminId !== actor) throw conflict();
      const next = projectRecord(
        input,
        old?.id ?? draftId ?? store.createId('project'),
        old?.ownerId ?? actor,
        store.createId('revision')
      );
      if (old) {
        rows[rows.indexOf(old)] = next;
        const joint = store.state.jointProjects.get(old.id);
        if (joint) joint.proposedBy = null;
        if (joint?.groupId) {
          for (const member of joint.authorIds) store.notify('groups:' + member);
        }
      } else {
        rows.push(next);
        if (match) {
          store.state.jointProjects.set(next.id, {
            matchId: match.id,
            authorIds: [...match.profileIds],
            published: false,
            proposedBy: null,
            notes: '',
            notesBy: null,
            notesRevision: store.createId('notes'),
          });
          recordProjectActivity(store, 'created', match.id, next.id, actor);
        }
      }
    },
    async publication(version, action) {
      const row = owned(version);
      const joint = store.state.jointProjects.get(row.id);
      if (!joint?.matchId || !availableMatch(joint.matchId) || joint.authorIds.length !== 2)
        throw conflict();
      if (action === 'propose') {
        if (joint.published || joint.proposedBy) throw conflict();
        joint.proposedBy = actor;
        recordProjectActivity(store, 'proposed', joint.matchId, row.id, actor);
      } else if (action === 'private') {
        joint.published = false;
        joint.proposedBy = null;
      } else {
        if (!joint.proposedBy || joint.proposedBy === actor) throw conflict();
        if (action === 'accept' && joint.authorIds.some((id) => listing(id).length >= 3))
          throw new Error(t('Uno de los perfiles ya tiene tres proyectos.'));
        joint.published = action === 'accept';
        joint.proposedBy = null;
      }
      row.revision = store.createId('revision');
    },
    async saveNotes(id, text, revision) {
      const joint = store.state.jointProjects.get(id);
      if (
        !joint ||
        !!joint.groupId ||
        joint.notesRevision !== revision ||
        !joint.authorIds.includes(actor) ||
        text.length > 10000
      )
        throw conflict();
      joint.notes = text;
      joint.notesBy = actor;
      joint.notesRevision = store.createId('notes');
    },
    async remove(previous) {
      const row = owned(previous);
      const joint = store.state.jointProjects.get(row.id);
      if (joint?.groupId) throw conflict();
      store.state.jointProjects.delete(row.id);
      store.state.projects = store.state.projects.filter((p) => p !== row);
      if (joint?.matchId)
        store.state.projectDeletions.set(joint.matchId, {
          id: recordProjectActivity(store, 'deleted', joint.matchId, row.id, actor),
          actorId: actor,
        });
    },
    async promote(previous) {
      const row = owned(previous);
      if (store.state.jointProjects.get(row.id)?.groupId) throw conflict();
      store.state.projects = [row, ...store.state.projects.filter((p) => p !== row)];
    },
  };
}
