import type { Entry, Task } from '../model/schema';
import { addDays, istInstant, ymd } from './format';

export type TaskStatus = 'upcoming' | 'due' | 'overdue' | 'done' | 'skipped' | 'notApplicable';
export interface Occurrence { task: Task; dueAt: string; due: Date; status: TaskStatus; outcome?: Extract<Entry, { type: 'task' }> }

/** Minutes after the scheduled time during which a task counts as "due" rather than "overdue". */
export const DUE_WINDOW_MIN = 60;
/** Safety cap on how far back we generate occurrences. */
const MAX_DAYS = 400;

export const occKey = (taskId: string, dueMs: number) => `${taskId}|${dueMs}`;
export const dueIso = (day: string, hhmm: string) => `${day}T${hhmm}:00+05:30`;

export function occurrences(tasks: Task[], entries: Entry[], now = new Date(), horizonHours = 24): Occurrence[] {
  const outcomes = new Map<string, Extract<Entry, { type: 'task' }>>();
  for (const e of entries) if (e.type === 'task') outcomes.set(occKey(e.taskId, new Date(e.dueAt).getTime()), e);
  const today = ymd(now);
  const horizon = now.getTime() + horizonHours * 3600000;
  const out: Occurrence[] = [];
  for (const task of tasks) {
    let day = task.startDate;
    const last = task.endDate && task.endDate < today ? task.endDate : addDays(today, 1);
    if (day < addDays(today, -MAX_DAYS)) day = addDays(today, -MAX_DAYS);
    for (let guard = 0; day <= last && guard < MAX_DAYS + 3; guard++, day = addDays(day, 1)) {
      const dow = istInstant(day, '12:00').getUTCDay(); // noon IST = 06:30 UTC, same weekday
      if (task.daysOfWeek?.length && !task.daysOfWeek.includes(dow)) continue;
      for (const t of task.times) {
        const iso = dueIso(day, t), due = new Date(iso);
        const o = outcomes.get(occKey(task.id, due.getTime()));
        let status: TaskStatus;
        if (o) status = o.outcome === 'notApplicable' ? 'notApplicable' : o.outcome;
        else if (due.getTime() > now.getTime()) status = 'upcoming';
        else status = now.getTime() - due.getTime() <= DUE_WINDOW_MIN * 60000 ? 'due' : 'overdue';
        if (status === 'upcoming' && due.getTime() > horizon) continue;
        out.push({ task, dueAt: iso, due, status, outcome: o });
      }
    }
  }
  return out.sort((a, b) => a.due.getTime() - b.due.getTime());
}
export const needsAction = (o: Occurrence) => o.status === 'due' || o.status === 'overdue';
