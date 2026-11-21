import { isObjectionable, OBJECTIONABLE_MESSAGE } from '@/features/safety/content-filter';
import type { Profile } from './types';
import { t } from '@/i18n';

export interface ProjectPhoto {
  uri: string;
  /** Shared images require a fresh authenticated Storage read. */
  headers?: Record<string, string>;
  /** Immutable key from a published project. New local photos have no key. */
  path?: string;
}
export interface ProjectInput {
  name: string;
  tagline: string;
  description: string;
  link: string;
  cover: ProjectPhoto | null;
  photos: ProjectPhoto[];
}
export interface Project extends ProjectInput {
  id: string;
  /** Compatibility id of a historical author. Permissions use project authors. */
  ownerId: string;
  authors?: Pick<Profile, 'id' | 'name' | 'avatar'>[];
  revision: string;
  /** Falso en un proyecto privado: solo lo ven sus autores. */
  published?: boolean;
  /**
   * Proyecto conjunto que se quedó una sola persona tras un bloqueo, una baja o
   * deshacer el match: es un proyecto de perfil suyo, privado hasta que lo publique.
   */
  detached?: boolean;
}
export type ProjectVersion = Pick<Project, 'id' | 'revision'>;

export interface JointWorkspace {
  project: Project;
  published: boolean;
  proposedBy: string | null;
  hasCapacity: boolean;
  notes: string;
  notesBy: string | null;
  notesRevision: string;
}
/** `publish` y `private` sobre un proyecto desvinculado no piden consentimiento a nadie. */
export type PublicationAction = 'propose' | 'accept' | 'reject' | 'private' | 'publish';

export interface ListOptions {
  /** Incluye los proyectos privados de quien mira su propio perfil («Tus proyectos»). */
  includePrivate?: boolean;
}

export interface ProjectRepository {
  warmUpModeration(): Promise<void>;
  list(ownerId: string, options?: ListOptions): Promise<Project[]>;
  save(
    input: ProjectInput,
    previous?: ProjectVersion,
    draftId?: string,
    matchId?: string
  ): Promise<void>;
  remove(previous: ProjectVersion): Promise<void>;
  lastDeletion(matchId: string): Promise<{ id: string; actorId: string } | null>;
  workspace(matchId: string): Promise<JointWorkspace | null>;
  publication(project: ProjectVersion, action: PublicationAction): Promise<void>;
  saveNotes(projectId: string, text: string, revision: string): Promise<void>;
  promote(previous: ProjectVersion): Promise<void>;
}

/** Stable for the lifetime of a new editor, including retries after a lost reply. */
export function newProjectId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (key) => {
      const nibble = Math.floor(Math.random() * 16);
      return (key === 'x' ? nibble : (nibble & 3) | 8).toString(16);
    })
  );
}

/**
 * Mientras el interruptor `app_config.shared_project_photos` esté apagado, un
 * proyecto conjunto o de grupo no lleva fotos (`save`), ni se publica con ellas
 * si las tenía de antes (`publish`).
 */
export function sharedPhotosLockedMessage(kind: 'group' | 'save' | 'publish' = 'publish'): string {
  if (kind === 'group')
    return t(
      'Por ahora los grupos de proyecto no pueden llevar fotos. Quita las fotos para crearlo.'
    );
  if (kind === 'save')
    return t(
      'Por ahora los proyectos compartidos no pueden llevar fotos. Quítalas para guardarlo.'
    );
  return t(
    'Por ahora los proyectos compartidos con fotos no se pueden publicar. Quita las fotos o mantenlo privado.'
  );
}

export function validateProject(input: ProjectInput) {
  if ([input.name, input.tagline, input.description].some(isObjectionable))
    throw new Error(t(OBJECTIONABLE_MESSAGE));
  if (
    ![input.name, input.tagline].every((v) => v.trim().length > 0 && v.length <= 100) ||
    input.photos.length > 5 ||
    input.description.length > 5000
  )
    throw new Error(t('Revisa el nombre, la frase y los límites del proyecto.'));
  if (input.link && !/^https?:\/\/[^\s]+$/i.test(input.link))
    throw new Error(t('Introduce un enlace http o https válido.'));
}

export class ProjectPhotoError extends Error {
  constructor(
    readonly slot: number,
    rejected: boolean
  ) {
    super(
      rejected
        ? t('Esta foto se ha rechazado. Elige otra.')
        : t('No se ha podido revisar esta foto. Vuelve a intentarlo.')
    );
  }
}
