import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { applyImport, getBundle, previewImport, toExport } from '../src/db';
import { parseImportData } from '../src/lib/importer';
import { isAbnormal } from '../src/lib/ranges';
import { occurrences } from '../src/lib/schedule';
import { metricSeries } from '../src/lib/series';
import { fmtPhone, ymd } from '../src/lib/format';
import type { MedasiumExport } from '../src/model/schema';

const sample = JSON.parse(readFileSync('public/samples/sample-patient.json', 'utf8'));
const schema = JSON.parse(readFileSync('public/schema/medasium.schema.json', 'utf8'));
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);

describe('JSON Schema', () => {
  it('accepts the sample patient', () => { expect(validate(sample), JSON.stringify(validate.errors?.slice(0, 3))).toBe(true); });
  it('rejects BP without diastolic and skipped task without reason', () => {
    const bad = structuredClone(sample);
    bad.entries.find((e: any) => e.type === 'vitals').readings[0] = { metric: 'bloodPressure', value: 120 };
    expect(validate(bad)).toBe(false);
    const bad2 = structuredClone(sample);
    const t = bad2.entries.find((e: any) => e.type === 'task'); t.outcome = 'skipped'; delete t.reason;
    expect(validate(bad2)).toBe(false);
  });
});

describe('import validation', () => {
  it('accepts the sample', () => { expect(parseImportData(sample).ok).toBe(true); });
  it('rejects unrelated JSON with a clear message', () => {
    const r = parseImportData({ hello: 1 });
    expect(r.ok).toBe(false); if (!r.ok) expect(r.error).toMatch(/not a Medasium export/);
  });
  it('rejects bad files: skipped w/o reason, unknown taskId, duplicate ids', () => {
    const a = structuredClone(sample); const t = a.entries.find((e: any) => e.type === 'task'); t.outcome = 'skipped'; delete t.reason;
    expect(parseImportData(a).ok).toBe(false);
    const b = structuredClone(sample); b.entries.find((e: any) => e.type === 'task').taskId = 'nope';
    expect(parseImportData(b).ok).toBe(false);
    const c = structuredClone(sample); c.entries[1].id = c.entries[0].id;
    expect(parseImportData(c).ok).toBe(false);
  });
});

describe('merge / replace', () => {
  const data = parseImportData(sample) as { ok: true; data: MedasiumExport };
  it('preview, merge, then replace only that patient', async () => {
    const d = data.data;
    expect((await previewImport(d)).patientExists).toBe(false);
    await applyImport(d, 'merge');
    const pv = await previewImport(d);
    expect(pv.entries.unchanged).toBe(d.entries.length);
    // other patient stays untouched on replace
    await applyImport({ ...d, patient: { id: 'other', name: 'Other' }, entries: [], tasks: [] }, 'merge');
    const slim = { ...d, entries: d.entries.slice(0, 10), tasks: d.tasks.filter((t) => d.entries.slice(0, 10).every((e) => e.type !== 'task' || e.taskId === t.id)) } as MedasiumExport;
    const trimmed = { ...slim, entries: slim.entries.filter((e) => e.type !== 'task') };
    await applyImport(trimmed, 'replace');
    expect((await getBundle(d.patient.id))!.entries.length).toBe(trimmed.entries.length);
    expect(await getBundle('other')).toBeTruthy();
    // round trip
    const out = toExport((await getBundle(d.patient.id))!);
    expect(parseImportData(JSON.parse(JSON.stringify(out))).ok).toBe(true);
  });
});

describe('domain rules', () => {
  it('flags out of range readings', () => {
    expect(isAbnormal({ metric: 'bloodPressure', value: 150, diastolic: 80 })).toBe(true);
    expect(isAbnormal({ metric: 'bloodPressure', value: 120, diastolic: 80 })).toBe(false);
    expect(isAbnormal({ metric: 'glucose', value: 120, context: 'fasting' })).toBe(true);
    expect(isAbnormal({ metric: 'glucose', value: 120, context: 'postMeal' })).toBe(false);
    expect(isAbnormal({ metric: 'weight', value: 200 })).toBe(false);
  });
  it('task status: upcoming, due, overdue, done; overdue persists for days', () => {
    const task = { id: 't', title: 'x', times: ['08:00'], startDate: '2026-11-01' };
    const at = (s: string) => new Date(s);
    const st = (now: string, entries: any[] = []) => occurrences([task], entries, at(now), 24).filter((o) => o.dueAt.startsWith('2026-11-08'))[0]?.status;
    expect(st('2026-11-08T07:00:00+05:30')).toBe('upcoming');
    expect(st('2026-11-08T08:30:00+05:30')).toBe('due');
    expect(st('2026-11-08T10:00:00+05:30')).toBe('overdue');
    expect(st('2026-11-12T10:00:00+05:30')).toBe('overdue');
    const done = [{ id: 'o', type: 'task', taskId: 't', dueAt: '2026-11-08T08:00:00+05:30', timestamp: '2026-11-08T08:05:00+05:30', outcome: 'done' }];
    expect(st('2026-11-08T10:00:00+05:30', done)).toBe('done');
  });
  it('charts use only existing points; single reading gives one point', () => {
    const e: any = [{ id: 'a', type: 'vitals', timestamp: '2026-11-01T08:00:00+05:30', readings: [{ metric: 'weight', value: 60 }] }];
    expect(metricSeries(e, 'weight')[0].points).toHaveLength(1);
    expect(metricSeries(e, 'pulse')).toHaveLength(0);
  });
  it('formats Indian phones and IST dates', () => {
    expect(fmtPhone('9876543210')).toBe('+91 98765 43210');
    expect(fmtPhone('+919876543210')).toBe('+91 98765 43210');
    expect(ymd('2026-11-08T23:50:00+05:30')).toBe('2026-11-08');
  });
});

describe('sample seed shifting', async () => {
  const { shiftSample } = await import('../src/lib/seed');
  it('keeps weekday task outcomes aligned for any shift (only recent items left open)', () => {
    const data = (parseImportData(sample) as { ok: true; data: MedasiumExport }).data;
    for (const ahead of [0, 1, 3, 6, 10]) {
      const now = new Date(new Date('2026-11-08T07:30:00+05:30').getTime() + ahead * 86400000);
      const s = shiftSample(data, now);
      const open = occurrences(s.tasks, s.entries, now, 0).filter((o) => o.status === 'overdue' || o.status === 'due');
      // Only the deliberate leftover from "yesterday 20:00" may be unresolved before today's tasks start.
      expect(open.length, `shift +${ahead}`).toBeLessThanOrEqual(1);
    }
  });
});
