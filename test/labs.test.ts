import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { LAB_BY_CODE, LAB_PANELS, LAB_TESTS, catalogRange } from '../src/model/labs';
import { LabResult } from '../src/model/schema';
import { entryHasAbnormal, flagValue, labFlag, labSeries, labTestsIn, normalize, parseLabInput, searchCatalog, toCanonical, fromCanonical, labSearchText } from '../src/lib/labs';
import { parseImportData } from '../src/lib/importer';
import { describeEntry, pdfSafe } from '../src/lib/export';

const sample = JSON.parse(readFileSync('public/samples/sample-patient.json', 'utf8'));
const schema = JSON.parse(readFileSync('public/schema/medasium.schema.json', 'utf8'));
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);
const T = (code: string) => LAB_BY_CODE[code];

describe('lab catalogue integrity', () => {
  it('codes unique, panels valid, ranges ordered, units PDF-safe', () => {
    const codes = LAB_TESTS.map((t) => t.code);
    expect(new Set(codes).size).toBe(codes.length);
    const panels = new Set(LAB_PANELS.map((p) => p.id));
    for (const t of LAB_TESTS) {
      expect(panels.has(t.panel), t.code).toBe(true);
      for (const g of [t.range, t.rangeBy?.female, t.rangeBy?.male]) if (g?.lo !== undefined && g.hi !== undefined) expect(g.lo, t.code).toBeLessThan(g.hi);
      expect(pdfSafe(t.unit), `${t.code} unit must render in PDF`).toBe(t.unit);
      expect(pdfSafe(t.name), t.code).toBe(t.name);
      for (const a of t.alt ?? []) { expect(a.factor).toBeGreaterThan(0); expect(a.unit).not.toBe(t.unit); }
    }
  });
  it('aliases do not point at two different tests', () => {
    const seen = new Map<string, string>();
    for (const t of LAB_TESTS) for (const n of [t.name, ...t.aliases]) {
      const k = normalize(n);
      if (seen.has(k)) expect(seen.get(k), `${n} used by ${seen.get(k)} and ${t.code}`).toBe(t.code);
      seen.set(k, t.code);
    }
  });
});

describe('lab flags', () => {
  it('uses sex-specific ranges, and the union when sex is unknown', () => {
    const hb = { test: 'hb', value: 12.5 } as LabResult;
    expect(labFlag(hb, 'female')).toBeNull();
    expect(labFlag(hb, 'male')).toBe('low');
    expect(catalogRange(T('hb'), 'unknown')).toEqual({ lo: 12, hi: 17 });
    expect(labFlag(hb, undefined)).toBeNull();
    expect(labFlag({ test: 'hb', value: 11.9 } as LabResult, 'other')).toBe('low');
  });
  it('report range overrides the catalogue; bounds are inclusive', () => {
    expect(labFlag({ test: 'alt', value: 46 } as LabResult, 'male')).toBe('high');
    expect(labFlag({ test: 'alt', value: 46, refHigh: 50 } as LabResult, 'male')).toBeNull();
    expect(labFlag({ test: 'ca125', value: 35 } as LabResult)).toBeNull();
    expect(labFlag({ test: 'ca125', value: 35.1 } as LabResult)).toBe('high');
    expect(labFlag({ test: 'hba1c', value: 5.7 } as LabResult)).toBe('high');
  });
  it('handles < and > qualifiers without guessing', () => {
    expect(flagValue(2, '<', { hi: 37 })).toBeNull();
    expect(flagValue(2, '<', { lo: 3 })).toBe('low');
    expect(flagValue(5, '<', { lo: 3 })).toBeNull(); // could be anything below 5
    expect(flagValue(1000, '>', { hi: 37 })).toBe('high');
    expect(flagValue(10, '>', { hi: 37 })).toBeNull();
  });
  it('text results are flagged only when marked abnormal', () => {
    expect(labFlag({ test: 'custom', name: 'Urine sugar', text: 'Nil' } as LabResult)).toBeNull();
    expect(labFlag({ test: 'custom', name: 'Pus cells', text: '6-8', abnormal: true } as LabResult)).toBe('abnormal');
  });
});

describe('unit conversion and input parsing', () => {
  it('converts to canonical units', () => {
    expect(toCanonical(250, T('plt'), '×10³/µL')).toBe(2.5);
    expect(toCanonical(250000, T('plt'), '/cumm')).toBe(2.5);
    expect(toCanonical(7.5, T('wbc'), '×10³/µL')).toBe(7500);
    expect(toCanonical(80, T('creat'), 'µmol/L')).toBeCloseTo(0.905, 3);
    expect(toCanonical(5.5, T('fbsLab'), 'mmol/L')).toBeCloseTo(99.09, 1);
    expect(toCanonical(12, T('hb'), 'g/dL')).toBe(12);
    expect(fromCanonical(2.5, T('plt'), '×10³/µL')).toBe(250);
    expect(() => toCanonical(1, T('hb'), 'furlongs')).toThrow();
  });
  it('parses Indian grouping, qualifiers, and rejects junk', () => {
    expect(parseLabInput('1,50,000')).toEqual({ value: 150000 });
    expect(parseLabInput(' 12.5 ')).toEqual({ value: 12.5 });
    expect(parseLabInput('<0.01')).toEqual({ value: 0.01, qualifier: '<' });
    expect(parseLabInput('> 1000')).toEqual({ value: 1000, qualifier: '>' });
    expect(parseLabInput('≤5')).toEqual({ value: 5, qualifier: '<' });
    expect(parseLabInput('.5')).toEqual({ value: 0.5 });
    for (const bad of ['', 'abc', '12..5', '1e3', '<', 'Negative', '5-8']) expect(parseLabInput(bad), bad).toBeNull();
  });
});

describe('lab schema (zod and JSON Schema agree)', () => {
  const base = structuredClone(sample);
  const labIdx = base.entries.findIndex((e: any) => e.type === 'labs');
  const withResult = (r: object) => { const d = structuredClone(base); d.entries[labIdx].results = [r]; return d; };
  const cases: [string, object, boolean][] = [
    ['plain value', { test: 'hb', value: 12 }, true],
    ['canonical unit given', { test: 'plt', value: 2.5, unit: 'lakh/cumm' }, true],
    ['qualifier', { test: 'psa', value: 0.01, qualifier: '<' }, true],
    ['custom text', { test: 'custom', name: 'HBsAg', text: 'Non-reactive' }, true],
    ['report range', { test: 'alt', value: 30, refLow: 0, refHigh: 41 }, true],
    ['wrong unit', { test: 'plt', value: 250, unit: '×10³/µL' }, false],
    ['custom without name', { test: 'custom', value: 3, unit: 'x' }, false],
    ['value and text', { test: 'hb', value: 12, text: 'twelve' }, false],
    ['neither value nor text', { test: 'hb' }, false],
    ['qualifier without value', { test: 'custom', name: 'X', text: 'y', qualifier: '<' }, false],
    ['abnormal on numeric', { test: 'hb', value: 12, abnormal: true }, false],
    ['unknown test code', { test: 'notatest', value: 1 }, false],
  ];
  for (const [name, r, ok] of cases) it(`${ok ? 'accepts' : 'rejects'}: ${name}`, () => {
    const d = withResult(r);
    expect(parseImportData(d).ok, 'zod').toBe(ok);
    expect(validate(d), `ajv ${JSON.stringify(validate.errors?.slice(0, 2))}`).toBe(ok);
  });
  it('rejects refLow > refHigh (app-level check)', () => {
    expect(parseImportData(withResult({ test: 'alt', value: 30, refLow: 50, refHigh: 41 })).ok).toBe(false);
  });
  it('wrong-unit error tells how to convert', () => {
    const r = parseImportData(withResult({ test: 'plt', value: 250, unit: '×10³/µL' }));
    expect(r.ok).toBe(false); if (!r.ok) expect(r.error).toMatch(/lakh\/cumm.*multiplying by 0\.01/);
  });
});

describe('series, search and summaries', () => {
  const entries = [
    { id: 'a', type: 'labs', timestamp: '2026-10-01T08:00:00+05:30', results: [{ test: 'ca125', value: 40 }, { test: 'custom', name: 'Serum IgE', unit: 'IU/mL', value: 90 }] },
    { id: 'b', type: 'labs', timestamp: '2026-09-01T08:00:00+05:30', results: [{ test: 'ca125', value: 20 }, { test: 'custom', name: 'serum ige ', unit: 'IU/mL', value: 80 }] },
  ] as any;
  it('builds sorted series per test, custom tests keyed by name+unit', () => {
    const s = labSeries(entries, 'ca125', 'female')!;
    expect(s.points.map((p) => p.v)).toEqual([20, 40]);
    expect(s.points.map((p) => p.bad)).toEqual([false, true]);
    const tests = labTestsIn(entries, 'female');
    expect(tests.map((t) => t.key)).toEqual(['ca125', 'custom:serum ige|IU/mL']);
    expect(tests[0]).toMatchObject({ count: 2, abnormal: 1 });
    expect(labSeries(entries, 'custom:serum ige|IU/mL')!.points).toHaveLength(2);
  });
  it('forgiving search: CA19.9, SGPT, TLC, platelets', () => {
    expect(searchCatalog('CA19.9', LAB_TESTS)[0].code).toBe('ca199');
    expect(searchCatalog('ca 125', LAB_TESTS)[0].code).toBe('ca125');
    expect(searchCatalog('sgpt', LAB_TESTS)[0].code).toBe('alt');
    expect(searchCatalog('TLC', LAB_TESTS)[0].code).toBe('wbc');
    expect(searchCatalog('platelet', LAB_TESTS)[0].code).toBe('plt');
    expect(searchCatalog('', LAB_TESTS)).toEqual([]);
    expect(normalize(labSearchText(entries[0]))).toContain('ca125');
  });
  it('describes lab entries with flags; abnormal detection', () => {
    expect(describeEntry(entries[0], undefined, 'female')).toContain('CA-125 40 U/mL (high)');
    expect(entryHasAbnormal(entries[0], 'female')).toBe(true);
    expect(entryHasAbnormal(entries[1], 'female')).toBe(false);
  });
});

describe('sample patient file (public/samples/sample-patient.json)', () => {
  const labs = sample.entries.filter((e: any) => e.type === 'labs');
  const val = (e: any, c: string) => e.results.find((r: any) => r.test === c)?.value;
  it('is Amma: recurrent cholangiocarcinoma, diabetes since 2002 after NHL treatment, CA 19-9 history', async () => {
    const { SAMPLE_ID } = await import('../src/lib/seed');
    expect(sample.patient).toMatchObject({ id: SAMPLE_ID, name: 'Amma', sex: 'female' });
    expect(sample.patient.emergencyContact.name).toBe('Imran');
    const history = sample.patient.conditions.join(' | ');
    for (const s of [/Recurrent metastatic hilar cholangiocarcinoma, diagnosed March 2025/, /Hilar cholangiocarcinoma, diagnosed 2020; surgery in June 2021, followed by chemotherapy 2021–2022/, /Type 2 diabetes mellitus since 2002, following treatment for non-Hodgkin lymphoma/, /Non-Hodgkin lymphoma, 2002; treated with chemotherapy/]) expect(history).toMatch(s);
    expect(sample.patient.conditions).toHaveLength(4);
    expect(JSON.stringify(sample)).not.toMatch(/Kamala|Subramanian|Rajesh|Fathima|hip fracture|ovarian|Telmisartan|Thyroxine/i);
    expect(labs.filter((e: any) => val(e, 'ca199') !== undefined).length).toBeGreaterThanOrEqual(8);
    // Penicillin allergy is recorded, so no penicillin-class drug may appear in the sample.
    expect(sample.patient.allergies.map((a: any) => a.substance)).toContain('Penicillin');
    expect(sample.entries.filter((e: any) => e.type === 'medication' && /cillin|amox|clav|augmentin/i.test(e.name))).toEqual([]);
    expect(labs.some((e: any) => e.results.some((r: any) => r.qualifier === '<'))).toBe(true);
    expect(labs.some((e: any) => e.results.some((r: any) => r.test === 'custom' && r.text))).toBe(true);
  });
  it('derived lab values are internally consistent', () => {
    for (const e of labs) {
      const g = (c: string) => val(e, c);
      if (g('hb') !== undefined) {
        expect(Math.abs(g('mcv') - (g('hct') * 10) / g('rbc'))).toBeLessThan(0.6);
        expect(Math.abs(g('mch') - (g('hb') * 10) / g('rbc'))).toBeLessThan(0.2);
        expect(Math.abs(g('mchc') - (g('hb') / g('hct')) * 100)).toBeLessThan(0.2);
        expect(g('neut') + g('lymph') + g('mono') + g('eos') + g('baso')).toBeCloseTo(100, 6);
        expect(Math.abs(g('anc') - (g('wbc') * g('neut')) / 100)).toBeLessThanOrEqual(1);
      }
      if (g('protein') !== undefined) {
        expect(g('globulin')).toBeCloseTo(g('protein') - g('albumin'), 6);
        expect(Math.abs(g('agRatio') - g('albumin') / g('globulin'))).toBeLessThan(0.01);
        expect(g('biliI')).toBeCloseTo(g('biliT') - g('biliD'), 6);
      }
      if (g('chol') !== undefined) {
        expect(g('nonHdl')).toBe(g('chol') - g('hdl'));
        expect(Math.abs(g('ldl') - (g('chol') - g('hdl') - g('tg') / 5))).toBeLessThanOrEqual(0.5);
      }
      if (g('tsat') !== undefined) expect(Math.abs(g('tsat') - (g('iron') / g('tibc')) * 100)).toBeLessThan(0.1);
    }
  });
});

describe('sample shifting never creates future records', async () => {
  const { shiftSample } = await import('../src/lib/seed');
  it('drops not-yet-happened entries but keeps scheduled appointments', () => {
    const data = (parseImportData(sample) as any).data;
    for (const now of [new Date('2026-11-08T00:30:00+05:30'), new Date('2026-11-12T07:10:00+05:30'), new Date('2027-02-01T23:00:00+05:30')]) {
      const s = shiftSample(data, now);
      const future = s.entries.filter((e: any) => new Date(e.timestamp) > now);
      expect(future.every((e: any) => e.type === 'appointment' && e.status === 'scheduled'), now.toISOString()).toBe(true);
      expect(future.length).toBe(1);
      expect(parseImportData(s).ok).toBe(true);
    }
  });
});

describe('sample loads through the ordinary import path', async () => {
  const { parseImport } = await import('../src/lib/importer');
  const { shiftSample } = await import('../src/lib/seed');
  it('parses as a picked file, and the re-dated copy is still a valid import', async () => {
    const file = new File([readFileSync('public/samples/sample-patient.json')], 'sample-patient.json', { type: 'application/json' });
    const r = await parseImport(file);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const shifted = shiftSample(r.data, new Date('2027-03-01T10:00:00+05:30'));
    expect(parseImportData(JSON.parse(JSON.stringify(shifted))).ok).toBe(true);
    expect(shifted.entries.length).toBeGreaterThan(800);
    expect(r.data.patient.name).toBe('Amma');
  });
});
