import type { Entry, Metric } from '../model/schema';
import { RANGES, rangeFor, outside, type Range } from './ranges';

export interface Pt { t: number; v: number; bad: boolean; id: string; q?: '<' | '>' }
export interface Series { key: string; label: string; points: Pt[]; range?: Range }

/** Series for one metric, built only from existing readings (nothing invented or interpolated). */
export function metricSeries(entries: Entry[], metric: Metric, glucoseContext?: string): Series[] {
  const sys: Pt[] = [], dia: Pt[] = [], one: Pt[] = [];
  for (const e of entries) {
    if (e.type !== 'vitals') continue;
    for (const r of e.readings) {
      if (r.metric !== metric) continue;
      if (metric === 'glucose' && glucoseContext && (r.context ?? 'random') !== glucoseContext) continue;
      const t = new Date(e.timestamp).getTime();
      if (metric === 'bloodPressure') {
        sys.push({ t, v: r.value, bad: outside(r.value, RANGES.systolic), id: e.id });
        dia.push({ t, v: r.diastolic!, bad: outside(r.diastolic!, RANGES.diastolic), id: e.id });
      } else one.push({ t, v: r.value, bad: outside(r.value, rangeFor(metric, r.context)), id: e.id });
    }
  }
  const by = (a: Pt, b: Pt) => a.t - b.t;
  if (metric === 'bloodPressure') {
    return sys.length ? [
      { key: 'sys', label: 'Systolic', points: sys.sort(by), range: RANGES.systolic },
      { key: 'dia', label: 'Diastolic', points: dia.sort(by), range: RANGES.diastolic },
    ] : [];
  }
  return one.length ? [{ key: metric, label: metric, points: one.sort(by), range: rangeFor(metric, glucoseContext as never) }] : [];
}
