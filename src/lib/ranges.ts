import type { Reading, Metric } from '../model/schema';

export interface Range { lo?: number; hi?: number }
export const UNITS: Record<Metric, string> = {
  bloodPressure: 'mmHg', glucose: 'mg/dL', weight: 'kg', temperature: '°F', pulse: 'bpm', spo2: '%', respiratoryRate: '/min',
};
export const LABELS: Record<Metric, string> = {
  bloodPressure: 'Blood pressure', glucose: 'Blood sugar', weight: 'Weight', temperature: 'Temperature',
  pulse: 'Pulse', spo2: 'SpO₂', respiratoryRate: 'Respiratory rate',
};
/** Adult reference bands (flagging only, not advice). Weight has none. */
export const RANGES = {
  systolic: { lo: 90, hi: 140 }, diastolic: { lo: 60, hi: 90 },
  glucose: { fasting: { lo: 70, hi: 100 }, postMeal: { lo: 70, hi: 140 }, random: { lo: 70, hi: 140 } },
  temperature: { lo: 97, hi: 99.5 }, pulse: { lo: 60, hi: 100 }, spo2: { lo: 95 }, respiratoryRate: { lo: 12, hi: 20 },
} as const;

export const outside = (v: number, r?: Range) => !!r && ((r.lo !== undefined && v < r.lo) || (r.hi !== undefined && v > r.hi));

export function rangeFor(metric: Metric, context?: Reading['context']): Range | undefined {
  switch (metric) {
    case 'bloodPressure': return RANGES.systolic;
    case 'glucose': return RANGES.glucose[context ?? 'random'];
    case 'weight': return undefined;
    default: return RANGES[metric];
  }
}
export function isAbnormal(r: Reading): boolean {
  if (r.metric === 'bloodPressure') return outside(r.value, RANGES.systolic) || outside(r.diastolic!, RANGES.diastolic);
  return outside(r.value, rangeFor(r.metric, r.context));
}
export const fmtReading = (r: Reading) =>
  r.metric === 'bloodPressure' ? `${r.value}/${r.diastolic} ${UNITS.bloodPressure}` : `${r.value} ${UNITS[r.metric]}`;
