import { openDB, type IDBPDatabase } from 'idb';
import type { Entry, MedasiumExport, Patient, Task } from '../model/schema';
import { FORMAT_VERSION } from '../model/schema';
import { nowIst } from '../lib/format';

export type StoredEntry = Entry & { patientId: string };
export type StoredTask = Task & { patientId: string };
export interface Bundle { patient: Patient; entries: Entry[]; tasks: Task[] }

let dbp: Promise<IDBPDatabase> | undefined;
export function db() {
  dbp ??= openDB('medasium', 1, {
    upgrade(d) {
      d.createObjectStore('patients', { keyPath: 'id' });
      d.createObjectStore('entries', { keyPath: ['patientId', 'id'] }).createIndex('byPatient', 'patientId');
      d.createObjectStore('tasks', { keyPath: ['patientId', 'id'] }).createIndex('byPatient', 'patientId');
    },
  });
  return dbp;
}
const strip = <T extends { patientId: string }>(x: T): Omit<T, 'patientId'> => { const { patientId: _p, ...r } = x; return r; };

export async function listPatients(): Promise<Patient[]> {
  const all = await (await db()).getAll('patients');
  return all.sort((a, b) => a.name.localeCompare(b.name, 'en-IN'));
}
export const savePatient = async (p: Patient) => { await (await db()).put('patients', p); };
export async function getBundle(patientId: string): Promise<Bundle | undefined> {
  const d = await db();
  const patient = await d.get('patients', patientId);
  if (!patient) return undefined;
  const entries = (await d.getAllFromIndex('entries', 'byPatient', patientId)).map(strip) as Entry[];
  const tasks = (await d.getAllFromIndex('tasks', 'byPatient', patientId)).map(strip) as Task[];
  return { patient, entries, tasks };
}
export async function allTasks(): Promise<{ patient: Patient; tasks: Task[]; entries: Entry[] }[]> {
  const ps = await listPatients();
  return Promise.all(ps.map(async (p) => (await getBundle(p.id))!));
}
export const putEntry = async (patientId: string, e: Entry) => { await (await db()).put('entries', { ...e, patientId }); };
export const deleteEntry = async (patientId: string, id: string) => { await (await db()).delete('entries', [patientId, id]); };
export const putTask = async (patientId: string, t: Task) => { await (await db()).put('tasks', { ...t, patientId }); };
export const deleteTask = async (patientId: string, id: string) => { await (await db()).delete('tasks', [patientId, id]); };

export async function deletePatient(patientId: string) {
  const d = await db();
  const tx = d.transaction(['patients', 'entries', 'tasks'], 'readwrite');
  await tx.objectStore('patients').delete(patientId);
  for (const s of ['entries', 'tasks'] as const) {
    const st = tx.objectStore(s);
    for (const k of await st.index('byPatient').getAllKeys(patientId)) await st.delete(k);
  }
  await tx.done;
}

export const toExport = (b: Bundle): MedasiumExport => ({
  format: 'medasium', version: FORMAT_VERSION, exportedAt: nowIst(),
  patient: b.patient,
  entries: [...b.entries].sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
  tasks: b.tasks,
}) as MedasiumExport;

export interface ImportPreview {
  patientName: string; patientExists: boolean; patientChanged: boolean;
  entries: { added: number; updated: number; unchanged: number; removedOnReplace: number };
  tasks: { added: number; updated: number; unchanged: number; removedOnReplace: number };
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function diff<T extends { id: string }>(incoming: T[], existing: T[]) {
  const m = new Map(existing.map((x) => [x.id, x]));
  const ids = new Set(incoming.map((x) => x.id));
  let added = 0, updated = 0, unchanged = 0;
  for (const x of incoming) { const o = m.get(x.id); if (!o) added++; else if (same(o, x)) unchanged++; else updated++; }
  return { added, updated, unchanged, removedOnReplace: existing.filter((x) => !ids.has(x.id)).length };
}
export async function previewImport(data: MedasiumExport): Promise<ImportPreview> {
  const cur = await getBundle(data.patient.id);
  return {
    patientName: data.patient.name, patientExists: !!cur, patientChanged: !!cur && !same(cur.patient, data.patient),
    entries: diff(data.entries, cur?.entries ?? []), tasks: diff(data.tasks, cur?.tasks ?? []),
  };
}
/** Applied only after the user confirms. One transaction: all or nothing. */
export async function applyImport(data: MedasiumExport, mode: 'merge' | 'replace') {
  const d = await db();
  const pid = data.patient.id;
  const tx = d.transaction(['patients', 'entries', 'tasks'], 'readwrite');
  if (mode === 'replace') {
    for (const s of ['entries', 'tasks'] as const) {
      const st = tx.objectStore(s);
      for (const k of await st.index('byPatient').getAllKeys(pid)) await st.delete(k);
    }
  }
  await tx.objectStore('patients').put(data.patient);
  for (const e of data.entries) await tx.objectStore('entries').put({ ...e, patientId: pid });
  for (const t of data.tasks) await tx.objectStore('tasks').put({ ...t, patientId: pid });
  await tx.done;
  return pid;
}
