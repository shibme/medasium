import type { MedasiumExport } from '../model/schema';
import { toIstIso, ymd } from './format';

/** Stable id of the bundled sample patient. */
export const SAMPLE_ID = 'pt_sample';
const DAY = 86400000;
const shiftIso = (iso: string, days: number) => toIstIso(new Date(new Date(iso).getTime() + days * DAY));
const shiftDay = (d: string, days: number) => ymd(new Date(new Date(`${d}T12:00:00+05:30`).getTime() + days * DAY));

/** The sample patient is an ordinary Medasium JSON file, served from public/samples. */
export const SAMPLE_PATH = 'samples/sample-patient.json';

/** Fetch the bundled sample as a File, exactly as if the user had picked it for import. */
export async function fetchSampleFile(): Promise<File> {
  const res = await fetch(`${import.meta.env.BASE_URL}${SAMPLE_PATH}`);
  if (!res.ok) throw new Error('Could not load the sample patient file.');
  return new File([await res.blob()], 'sample-patient.json', { type: 'application/json' });
}

/** Move every date by whole days so the sample's last day is today (the file itself is never changed). */

export function shiftSample(raw: MedasiumExport, now = new Date()): MedasiumExport {
  const days = Math.round((new Date(`${ymd(now)}T12:00:00+05:30`).getTime() - new Date(`${ymd(raw.exportedAt)}T12:00:00+05:30`).getTime()) / DAY);
  // Records can't be in the future, except appointments that are scheduled.
  const notFuture = (e: MedasiumExport['entries'][number]) => e.type === 'appointment' || new Date(e.timestamp).getTime() <= now.getTime();
  if (days === 0) return { ...raw, entries: raw.entries.filter(notFuture) };
  return {
    ...raw,
    exportedAt: shiftIso(raw.exportedAt, days),
    entries: raw.entries.map((e) => ({
      ...e, timestamp: shiftIso(e.timestamp, days),
      ...(e.editedAt ? { editedAt: shiftIso(e.editedAt, days) } : {}),
      ...(e.type === 'task' ? { dueAt: shiftIso(e.dueAt, days) } : {}),
    })).filter(notFuture),
    tasks: raw.tasks.map((t) => ({
      ...t, startDate: shiftDay(t.startDate, days), ...(t.endDate ? { endDate: shiftDay(t.endDate, days) } : {}),
      // Weekday schedules must move with the dates, or past outcomes stop matching their occurrences.
      ...(t.daysOfWeek ? { daysOfWeek: t.daysOfWeek.map((d) => (((d + days) % 7) + 7) % 7).sort() } : {}),
    })),
  } as MedasiumExport;
}
