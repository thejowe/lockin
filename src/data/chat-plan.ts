export type ChatScope = { kind: 'match' | 'group'; id: string };

export type PlanDraft = Partial<TaskDetails> & {
  id: string;
  title: string;
  /** Una tarea no tiene hora de reunión. Las reuniones se guardan como instantes UTC. */
  startsAt: string | null;
  place: string | null;
};

export type TaskDetails = {
  assigneeId: string | null;
  dueAt: string | null;
  status: 'pending' | 'in_progress' | 'done';
};

export type PlanItem = PlanDraft & {
  closed: boolean;
  /** Cambia en cada edición: `updateTask` la usa para no pisar a la otra persona. */
  revision?: string;
};

/** Otra persona cambió la tarea desde que se abrió: hay que recargar, no pisar. */
export class PlanConflictError extends Error {
  constructor() {
    super('plan item changed');
    this.name = 'PlanConflictError';
  }
}

export interface ChatPlanRepository {
  list(scope: ChatScope): Promise<PlanItem[]>;
  add(scope: ChatScope, draft: PlanDraft): Promise<void>;
  /** Con `revision`, falla con `PlanConflictError` si la tarea cambió desde entonces. */
  updateTask(scope: ChatScope, id: string, details: TaskDetails, revision?: string): Promise<void>;
  setClosed(scope: ChatScope, id: string, closed: boolean): Promise<void>;
}
