import { Camera, CircleCheck, FlaskConical, HeartPulse, NotebookPen, Pill, Stethoscope, type LucideIcon } from 'lucide-react';
import type { Entry } from '@/model/schema';

export type FormType = 'vitals' | 'labs' | 'medication' | 'observation' | 'appointment' | 'photo';
interface Meta { label: string; short: string; icon: LucideIcon; tint: string }
/** Tint = icon colour on a soft background, readable in both themes. */
export const TYPE_META: Record<Entry['type'], Meta> = {
  vitals: { label: 'Vitals', short: 'Vitals', icon: HeartPulse, tint: 'bg-rose-500/12 text-rose-600 dark:text-rose-400' },
  labs: { label: 'Lab results', short: 'Labs', icon: FlaskConical, tint: 'bg-cyan-500/12 text-cyan-700 dark:text-cyan-400' },
  medication: { label: 'Medication', short: 'Meds', icon: Pill, tint: 'bg-violet-500/12 text-violet-600 dark:text-violet-400' },
  observation: { label: 'Observation', short: 'Note', icon: NotebookPen, tint: 'bg-sky-500/12 text-sky-600 dark:text-sky-400' },
  appointment: { label: 'Appointment', short: 'Visit', icon: Stethoscope, tint: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400' },
  photo: { label: 'Photo', short: 'Photo', icon: Camera, tint: 'bg-amber-500/14 text-amber-600 dark:text-amber-400' },
  task: { label: 'Care task', short: 'Task', icon: CircleCheck, tint: 'bg-teal-500/12 text-teal-600 dark:text-teal-400' },
};
export const FORM_TYPES: FormType[] = ['vitals', 'labs', 'medication', 'observation', 'appointment', 'photo'];
