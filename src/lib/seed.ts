import { MedasiumExport } from '../model/schema';
import { toIstIso, ymd } from './format';

const DAY = 86400000;
const shiftIso = (iso: string, days: number) => toIstIso(new Date(new Date(iso).getTime() + days * DAY));
const shiftDay = (d: string, days: number) => ymd(new Date(new Date(`${d}T12:00:00+05:30`).getTime() + days * DAY));

/** Fetch the sample patient and shift all dates by whole days so it ends today. */
export async function loadSample(): Promise<MedasiumExport> {
  const res = await fetch(`${import.meta.env.BASE_URL}samples/sample-patient.json`);
  if (!res.ok) throw new Error('Could not load the sample patient.');
  return shiftSample(MedasiumExport.parse(await res.json()));
}

export function shiftSample(raw: MedasiumExport, now = new Date()): MedasiumExport {
  const days = Math.round((new Date(`${ymd(now)}T12:00:00+05:30`).getTime() - new Date(`${ymd(raw.exportedAt)}T12:00:00+05:30`).getTime()) / DAY);
  if (days === 0) return raw;
  return {
    ...raw,
    exportedAt: shiftIso(raw.exportedAt, days),
    entries: raw.entries.map((e) => ({
      ...e, timestamp: shiftIso(e.timestamp, days),
      ...(e.editedAt ? { editedAt: shiftIso(e.editedAt, days) } : {}),
      ...(e.type === 'task' ? { dueAt: shiftIso(e.dueAt, days) } : {}),
    })),
    tasks: raw.tasks.map((t) => ({
      ...t, startDate: shiftDay(t.startDate, days), ...(t.endDate ? { endDate: shiftDay(t.endDate, days) } : {}),
      // Weekday schedules must move with the dates, or past outcomes stop matching their occurrences.
      ...(t.daysOfWeek ? { daysOfWeek: t.daysOfWeek.map((d) => (((d + days) % 7) + 7) % 7).sort() } : {}),
    })),
  } as MedasiumExport;
}
