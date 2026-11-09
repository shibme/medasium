import { LAB_BY_CODE, LAB_PANELS, catalogRange, panelName, type LabTest, type Range } from '@/model/labs';
import type { Entry, LabResult, LabsEntry } from '@/model/schema';
import { isAbnormal } from './ranges';
import type { Series } from './series';

export type LabFlag = 'low' | 'high' | 'abnormal' | null;
const PANEL_ORDER = Object.fromEntries(LAB_PANELS.map((p, i) => [p.id, i]));
const CODE_ORDER = Object.fromEntries(Object.keys(LAB_BY_CODE).map((c, i) => [c, i]));

export const labTest = (r: Pick<LabResult, 'test'>): LabTest | undefined => (r.test === 'custom' ? undefined : LAB_BY_CODE[r.test]);
export const labName = (r: LabResult) => labTest(r)?.name ?? r.name ?? 'Custom test';
export const labUnit = (r: LabResult) => labTest(r)?.unit ?? r.unit ?? '';
export const labPanel = (r: LabResult) => labTest(r)?.panel ?? 'custom';

/** Report-printed range if present, else the catalogue range for the patient's sex. */
export function effectiveRange(r: LabResult, sex?: string): Range | undefined {
  if (r.refLow !== undefined || r.refHigh !== undefined) return { ...(r.refLow !== undefined ? { lo: r.refLow } : {}), ...(r.refHigh !== undefined ? { hi: r.refHigh } : {}) };
  const t = labTest(r);
  return t ? catalogRange(t, sex) : undefined;
}

/** Compare a (possibly "<" / ">" qualified) value with a range. Bounds are inclusive. */
export function flagValue(v: number, q: LabResult['qualifier'], g?: Range): LabFlag {
  if (!g) return null;
  if (q === '<') return g.lo !== undefined && v <= g.lo ? 'low' : null; // true value is below v
  if (q === '>') return g.hi !== undefined && v >= g.hi ? 'high' : null; // true value is above v
  if (g.lo !== undefined && v < g.lo) return 'low';
  if (g.hi !== undefined && v > g.hi) return 'high';
  return null;
}
export function labFlag(r: LabResult, sex?: string): LabFlag {
  if (r.text !== undefined) return r.abnormal ? 'abnormal' : null;
  if (r.value === undefined) return null;
  return flagValue(r.value, r.qualifier, effectiveRange(r, sex));
}

/** Convert an entered value to the test's canonical unit, rounded to 6 significant digits. */
export function toCanonical(value: number, t: LabTest | undefined, unit: string | undefined): number {
  if (!t || !unit || unit === t.unit) return value;
  const a = t.alt?.find((x) => x.unit === unit);
  if (!a) throw new Error(`Unknown unit ${unit} for ${t.name}`);
  return Number((value * a.factor).toPrecision(6));
}
export function fromCanonical(value: number, t: LabTest | undefined, unit: string | undefined): number {
  if (!t || !unit || unit === t.unit) return value;
  const a = t.alt?.find((x) => x.unit === unit);
  if (!a) throw new Error(`Unknown unit ${unit} for ${t.name}`);
  return Number((value / a.factor).toPrecision(6));
}

/** Parse typed lab input: "12.5", "1,50,000", "< 0.01", ">1000", "≤5". Returns null if not a number. */
export function parseLabInput(raw: string): { value: number; qualifier?: '<' | '>' } | null {
  let s = raw.trim().replace(/[\s,]/g, '');
  let qualifier: '<' | '>' | undefined;
  const m = /^(<=?|>=?|≤|≥)/.exec(s);
  if (m) { qualifier = m[1].startsWith('<') || m[1] === '≤' ? '<' : '>'; s = s.slice(m[1].length); }
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const value = Number(s);
  return Number.isFinite(value) ? { value, ...(qualifier ? { qualifier } : {}) } : null;
}

export const fmtLabValue = (r: LabResult) => (r.text !== undefined ? r.text : `${r.qualifier ?? ''}${fmtNumber(r.value!)}`);
export const fmtNumber = (n: number) => (Math.abs(n) >= 1000 ? new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n) : String(Number(n.toPrecision(6))));

/** Key that identifies a test across reports (custom tests by name + unit). */
export const labKey = (r: LabResult) => (r.test === 'custom' ? `custom:${(r.name ?? '').trim().toLowerCase()}|${(r.unit ?? '').trim()}` : r.test);

export const sortResults = (rs: LabResult[]) =>
  [...rs].sort((a, b) => (PANEL_ORDER[labPanel(a)] - PANEL_ORDER[labPanel(b)]) || ((CODE_ORDER[a.test] ?? 999) - (CODE_ORDER[b.test] ?? 999)));

export interface LabTestSummary { key: string; name: string; unit: string; panel: string; count: number; abnormal: number }
/** All numeric/text tests present in these entries, in catalogue order. */
export function labTestsIn(entries: Entry[], sex?: string): LabTestSummary[] {
  const m = new Map<string, LabTestSummary & { o: number }>();
  for (const e of entries) {
    if (e.type !== 'labs') continue;
    for (const r of e.results) {
      const key = labKey(r);
      const s = m.get(key) ?? { key, name: labName(r), unit: labUnit(r), panel: labPanel(r), count: 0, abnormal: 0, o: (PANEL_ORDER[labPanel(r)] * 1000) + (CODE_ORDER[r.test] ?? 999) };
      s.count++; if (labFlag(r, sex)) s.abnormal++;
      m.set(key, s);
    }
  }
  return [...m.values()].sort((a, b) => a.o - b.o || a.name.localeCompare(b.name)).map(({ o: _o, ...s }) => s);
}

export interface LabPoint { t: number; v: number; bad: boolean; id: string; q?: '<' | '>' }
/** Numeric series for one test, built only from recorded results. Band = latest result's effective range. */
export function labSeries(entries: Entry[], key: string, sex?: string): Series | null {
  const pts: (LabPoint & { range?: Range })[] = [];
  let label = '';
  for (const e of entries) {
    if (e.type !== 'labs') continue;
    for (const r of e.results) {
      if (labKey(r) !== key || r.value === undefined) continue;
      label = labName(r);
      pts.push({ t: new Date(e.timestamp).getTime(), v: r.value, bad: !!labFlag(r, sex), id: e.id, ...(r.qualifier ? { q: r.qualifier } : {}), range: effectiveRange(r, sex) });
    }
  }
  if (!pts.length) return null;
  pts.sort((a, b) => a.t - b.t);
  return { key, label, points: pts.map(({ range: _r, ...p }) => p), range: pts[pts.length - 1].range };
}

/** Normalise for forgiving search: "CA 19.9" == "ca19-9" == "ca199". */
export const normalize = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');
export const labSearchText = (e: LabsEntry) =>
  [e.lab ?? '', ...e.results.flatMap((r) => [labName(r), ...(labTest(r)?.aliases ?? []), panelName(labPanel(r))])].join(' ');
/** Search the catalogue by name or alias. */
export function searchCatalog(q: string, tests: LabTest[]): LabTest[] {
  const raw = q.trim().toLowerCase(), n = normalize(q);
  if (!n) return [];
  const score = (t: LabTest) => {
    const names = [t.name, ...t.aliases];
    if (names.some((x) => normalize(x) === n)) return 0;
    if (names.some((x) => normalize(x).startsWith(n))) return 1;
    if (names.some((x) => normalize(x).includes(n) || x.toLowerCase().includes(raw))) return 2;
    return 9;
  };
  return tests.map((t) => [t, score(t)] as const).filter(([, s]) => s < 9).sort((a, b) => a[1] - b[1]).map(([t]) => t);
}

export function entryHasAbnormal(e: Entry, sex?: string): boolean {
  if (e.type === 'vitals') return e.readings.some(isAbnormal);
  if (e.type === 'labs') return e.results.some((r) => labFlag(r, sex) !== null);
  return false;
}

/** Every result of one test, oldest first (numeric and text). */
export function labHistory(entries: Entry[], key: string): { at: string; r: LabResult; lab?: string }[] {
  const out: { at: string; r: LabResult; lab?: string }[] = [];
  for (const e of entries) if (e.type === 'labs') for (const r of e.results) if (labKey(r) === key) out.push({ at: e.timestamp, r, lab: e.lab });
  return out.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}
