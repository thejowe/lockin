import { isObjectionable, OBJECTIONABLE_MESSAGE } from '@/features/safety/content-filter';
import { t } from '@/i18n';

export interface ProjectPhoto {
  uri: string;
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
  ownerId: string;
  revision: string;
}
export type ProjectVersion = Pick<Project, 'id' | 'revision'>;

export interface ProjectRepository {
  list(ownerId: string): Promise<Project[]>;
  save(input: ProjectInput, previous?: ProjectVersion, draftId?: string): Promise<void>;
  remove(previous: ProjectVersion): Promise<void>;
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
