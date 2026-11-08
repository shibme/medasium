import { putEntry } from '../db';
import type { Entry } from '../model/schema';
import { nowIst, uid } from './format';
import type { Occurrence } from './schedule';

export async function recordOutcome(patientId: string, o: Occurrence, outcome: 'done' | 'skipped' | 'notApplicable', reason?: string) {
  if (outcome === 'skipped' && !reason?.trim()) throw new Error('A skipped task must carry a reason');
  const e: Entry = { id: uid(), type: 'task', taskId: o.task.id, dueAt: o.dueAt, timestamp: nowIst(), outcome, ...(reason?.trim() ? { reason: reason.trim() } : {}) };
  await putEntry(patientId, e);
}
