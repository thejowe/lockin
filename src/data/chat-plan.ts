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

export type PlanItem = PlanDraft & { closed: boolean };

export interface ChatPlanRepository {
  list(scope: ChatScope): Promise<PlanItem[]>;
  add(scope: ChatScope, draft: PlanDraft): Promise<void>;
  updateTask(scope: ChatScope, id: string, details: TaskDetails): Promise<void>;
  setClosed(scope: ChatScope, id: string, closed: boolean): Promise<void>;
}
