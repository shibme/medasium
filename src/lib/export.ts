import type { Bundle } from '../db';
import { toExport } from '../db';
import { fmtRange, panelName } from '../model/labs';
import type { Entry, LabResult, Metric, Reading } from '../model/schema';
import { ageFrom, fmtDate, fmtDateTime, fmtPhone, ymd } from './format';
import { effectiveRange, fmtLabValue, labFlag, labKey, labName, labPanel, labSeries, labTestsIn, labUnit, sortResults } from './labs';
import { LABELS, UNITS, fmtReading, isAbnormal } from './ranges';
import { metricSeries, type Series } from './series';

export const CHARTS: { metric: Metric; context?: string; title: string }[] = [
  { metric: 'bloodPressure', title: 'Blood pressure' },
  { metric: 'glucose', context: 'fasting', title: 'Blood sugar, fasting' },
  { metric: 'glucose', context: 'postMeal', title: 'Blood sugar, after meal' },
  { metric: 'glucose', context: 'random', title: 'Blood sugar, random' },
  { metric: 'weight', title: 'Weight' }, { metric: 'temperature', title: 'Temperature' }, { metric: 'pulse', title: 'Pulse' },
  { metric: 'spo2', title: 'SpO2' }, { metric: 'respiratoryRate', title: 'Respiratory rate' },
];
export interface Period { from?: string; to?: string } // YYYY-MM-DD inclusive, IST

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'patient';
const stamp = () => ymd(new Date()).replaceAll('-', '');
export function download(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
export const filterPeriod = (es: Entry[], p: Period) =>
  es.filter((e) => { const d = ymd(e.timestamp); return (!p.from || d >= p.from) && (!p.to || d <= p.to); });

export function exportJson(b: Bundle) {
  download(`medasium-${slug(b.patient.name)}-${stamp()}.json`, JSON.stringify(toExport(b), null, 2), 'application/json');
}

const FLAG_WORD = { low: 'low', high: 'high', abnormal: 'abnormal' } as const;
export const describeLab = (r: LabResult, sex?: string) => {
  const f = labFlag(r, sex), u = r.text === undefined ? labUnit(r) : '';
  return `${labName(r)} ${fmtLabValue(r)}${u && u !== 'ratio' ? ` ${u}` : ''}${f ? ` (${FLAG_WORD[f]})` : ''}`;
};

export function describeEntry(e: Entry, titles?: Map<string, string>, sex?: string): string {
  switch (e.type) {
    case 'vitals': return e.readings.map((r: Reading) => `${LABELS[r.metric]} ${fmtReading(r)}${isAbnormal(r) ? ' (out of range)' : ''}`).join('; ');
    case 'labs': return `${e.lab ? `${e.lab}: ` : ''}${sortResults(e.results).map((r) => describeLab(r, sex)).join('; ')}`;
    case 'medication': return `${e.name}${e.dose ? `, ${e.dose}` : ''}: ${e.status}${e.reason ? ` (${e.reason})` : ''}`;
    case 'observation': return e.text;
    case 'appointment': return `${e.title} [${e.status}]${e.provider ? `, ${e.provider}` : ''}${e.outcome ? `. ${e.outcome}` : ''}`;
    case 'photo': return `Photo (${e.category})${e.caption ? `: ${e.caption}` : ''}`;
    case 'task': return `${titles?.get(e.taskId) ?? 'Task'}: ${e.outcome === 'notApplicable' ? 'not applicable' : e.outcome}${e.reason ? ` (${e.reason})` : ''}`;
  }
}

/** jsPDF's standard fonts only cover WinAnsi; map the few symbols we use outside it. */
const PDF_MAP: Record<string, string> = { '≤': '<=', '≥': '>=', '↑': '+', '↓': '-', '◆': '*', '₂': '2', '⁶': '^6', '⁹': '^9', '¹²': '^12', '¹': '1', '⁰': '0' };
export const pdfSafe = (s: string) => s.replace(/¹²|[≤≥↑↓◆₂⁶⁹¹⁰]/g, (c) => PDF_MAP[c] ?? c).replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF–—‘’“”•…€]/g, '?');

export async function exportPdf(b: Bundle, period: Period, entries: Entry[]) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 14; let y = M;
  const need = (h: number) => { if (y + h > 285) { doc.addPage(); y = M; } };
  const text = (s: string, size = 10, bold = false, color: [number, number, number] = [30, 30, 30]) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(...color);
    for (const line of doc.splitTextToSize(pdfSafe(s), W - 2 * M) as string[]) { need(size * 0.5); doc.text(line, M, y); y += size * 0.45 + 1; }
  };
  const titles = new Map(b.tasks.map((t) => [t.id, t.title]));
  const p = b.patient, sex = p.sex, age = ageFrom(p.dateOfBirth, p.ageYears);
  text('Medasium: patient care record', 16, true, [15, 118, 110]);
  text(`${p.name}${age !== undefined ? `, ${age} y` : ''}${p.sex && p.sex !== 'unknown' ? `, ${p.sex}` : ''}`, 13, true);
  text(`Period: ${period.from ? fmtDate(`${period.from}T00:00:00+05:30`) : 'start'} to ${period.to ? fmtDate(`${period.to}T00:00:00+05:30`) : 'today'}. Generated ${fmtDateTime(new Date())} IST`, 9, false, [100, 100, 100]);
  y += 2;
  const prof: [string, string | undefined][] = [
    ['Date of birth', p.dateOfBirth && fmtDate(`${p.dateOfBirth}T00:00:00+05:30`)], ['Blood group', p.bloodGroup],
    ['Height / baseline weight', [p.heightCm && `${p.heightCm} cm`, p.baselineWeightKg && `${p.baselineWeightKg} kg`].filter(Boolean).join(' / ') || undefined],
    ['Conditions', p.conditions?.join('; ')],
    ['ALLERGIES', p.allergies?.map((a) => `${a.substance}${a.reaction ? ` (${a.reaction})` : ''}`).join('; ')],
    ['Emergency contact', p.emergencyContact && [p.emergencyContact.name, p.emergencyContact.relation, fmtPhone(p.emergencyContact.phone)].filter(Boolean).join(', ')],
    ['Note', p.note],
  ];
  for (const [k, v] of prof) if (v) text(`${k}: ${v}`, 10, k === 'ALLERGIES', k === 'ALLERGIES' ? [185, 28, 28] : [30, 30, 30]);
  y += 3;

  const colors: [number, number, number][] = [[42, 120, 214], [235, 104, 52], [27, 175, 122], [98, 80, 214], [232, 123, 164], [0, 131, 0], [201, 133, 0]];
  /** Line chart drawn with vector primitives from existing points only. */
  const drawSeries = (title: string, unit: string, series: Series[], ci: number) => {
    const pts = series.flatMap((s) => s.points);
    if (!pts.length) return;
    need(48); y += 2;
    text(`${title}${unit && unit !== 'ratio' ? ` (${unit})` : ''}`, 10, true);
    const x0 = M + 8, x1 = W - M, y0 = y + 2, h = 32, y1 = y0 + h;
    const bands = series.map((s) => s.range).filter(Boolean) as { lo?: number; hi?: number }[];
    const vs = pts.map((q) => q.v);
    let lo = Math.min(...vs, ...bands.map((g) => g.lo ?? Infinity)), hi = Math.max(...vs, ...bands.map((g) => g.hi ?? -Infinity));
    if (!isFinite(lo)) lo = Math.min(...vs);
    if (!isFinite(hi)) hi = Math.max(...vs);
    const pad = (hi - lo || 1) * 0.15, a = lo >= 0 ? Math.max(0, lo - pad) : lo - pad, z = hi + pad;
    const t0 = Math.min(...pts.map((q) => q.t)), t1 = Math.max(...pts.map((q) => q.t));
    const X = (t: number) => (t1 === t0 ? (x0 + x1) / 2 : x0 + ((t - t0) / (t1 - t0)) * (x1 - x0));
    const Y = (v: number) => y1 - ((v - a) / (z - a)) * h;
    doc.setDrawColor(220); doc.rect(x0, y0, x1 - x0, h);
    for (const band of bands) {
      const top = Math.max(y0, Y(band.hi ?? z)), bot = Math.min(y1, Y(band.lo ?? a));
      doc.setFillColor(222, 242, 236); doc.rect(x0, top, x1 - x0, Math.max(0, bot - top), 'F');
    }
    const tick = (v: number) => String(Math.abs(z - a) < 10 ? Number(v.toPrecision(3)) : Math.round(v));
    doc.setFontSize(7); doc.setTextColor(120); doc.text(tick(z), M, y0 + 2); doc.text(tick(a), M, y1);
    series.forEach((s, si) => {
      const c = colors[(ci + si) % colors.length]; doc.setDrawColor(...c); doc.setLineWidth(0.4);
      s.points.forEach((q, i) => { if (i > 0) doc.line(X(s.points[i - 1].t), Y(s.points[i - 1].v), X(q.t), Y(q.v)); });
      s.points.forEach((q) => { if (q.bad) { doc.setFillColor(200, 30, 30); doc.circle(X(q.t), Y(q.v), 0.9, 'F'); } else { doc.setFillColor(...c); doc.circle(X(q.t), Y(q.v), 0.6, 'F'); } });
    });
    doc.setLineWidth(0.2);
    y = y1 + 5;
    const rng = series.length === 1 ? fmtRange(series[0].range, unit) : '';
    doc.setFontSize(7); doc.setTextColor(120);
    doc.text(pdfSafe(`${fmtDate(new Date(t0))} to ${fmtDate(new Date(t1))}. ${bands.length ? `Shaded band: reference range${rng ? ` ${rng}` : 's'}. ` : ''}Red dots: out of range.${pts.length === 1 ? ' Single reading, no trend.' : ''}`), x0, y - 1);
    y += 2;
  };

  // Vitals charts
  const vit = entries.filter((e) => e.type === 'vitals');
  const labsIn = entries.filter((e) => e.type === 'labs');
  const vAbn = vit.flatMap((e) => (e.type === 'vitals' ? e.readings : [])).filter(isAbnormal).length;
  const tests = labTestsIn(labsIn, sex);
  const lAbn = tests.reduce((n, t) => n + t.abnormal, 0);
  text('Summary', 13, true, [15, 118, 110]);
  text(`Abnormal vitals readings in period: ${vAbn}. Abnormal lab results in period: ${lAbn}. Flags compare values with reference ranges; they are not a diagnosis.`, 10);
  y += 2;
  if (vit.length) {
    text('Vitals', 13, true, [15, 118, 110]);
    CHARTS.forEach(({ metric: m, context, title }, mi) => drawSeries(title, UNITS[m], metricSeries(vit, m, context), mi));
  }

  // Lab results: latest-value table, then trend charts for tests with 2+ numeric results
  if (tests.length) {
    y += 4; need(20);
    text('Lab results', 13, true, [15, 118, 110]);
    const latest = new Map<string, { r: LabResult; t: string }>();
    for (const e of [...labsIn].sort((a, c) => a.timestamp.localeCompare(c.timestamp))) if (e.type === 'labs') for (const r of e.results) latest.set(labKey(r), { r, t: e.timestamp });
    const cols = [M, M + 62, M + 100, M + 124, M + 160, M + 176];
    const row = (cells: string[], bold = false, red = false) => {
      need(6); doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(8.5); doc.setTextColor(...((red ? [185, 28, 28] : [30, 30, 30]) as [number, number, number]));
      cells.forEach((c, i) => doc.text(pdfSafe(c).slice(0, i === 0 ? 40 : 26), cols[i], y)); y += 4.6;
    };
    let panel = '';
    row(['Test', 'Latest', 'Date', 'Reference', 'Flag', 'Results'], true);
    for (const t of tests) {
      const l = latest.get(t.key); if (!l) continue;
      if (t.panel !== panel) { panel = t.panel; y += 1; row([panelName(panel)], true); }
      const f = labFlag(l.r, sex);
      row([`  ${t.name}`, `${fmtLabValue(l.r)}${l.r.text === undefined && t.unit !== 'ratio' ? ` ${t.unit}` : ''}`, fmtDate(l.t), fmtRange(effectiveRange(l.r, sex)), f ? FLAG_WORD[f] : '', `${t.count}${t.abnormal ? ` (${t.abnormal} abn.)` : ''}`], false, !!f);
    }
    let ci = 0;
    for (const t of tests) {
      const s = labSeries(labsIn, t.key, sex);
      if (s && s.points.length >= 2) drawSeries(t.name, t.unit, [s], ci++);
    }
  }
  if (!vit.length && !tests.length) text('No vitals or lab results to chart in this period.', 10, false, [100, 100, 100]);

  y += 4; need(14);
  text(`Timeline (${entries.length} entries, oldest first)`, 13, true, [15, 118, 110]);
  for (const e of [...entries].sort((a, c) => a.timestamp.localeCompare(c.timestamp))) {
    text(`${fmtDateTime(e.timestamp)}  [${e.type}]${e.editedAt ? ' (edited)' : ''}`, 9, true, [70, 70, 70]);
    text(describeEntry(e, titles, sex) + (e.note ? `. Note: ${e.note}` : ''), 9.5);
    y += 1;
  }
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(150); doc.text(`Medasium · records only, not medical advice · page ${i}/${pages}`, M, 292); }
  doc.save(`medasium-${slug(p.name)}-${stamp()}.pdf`);
}

export async function exportSqlite(b: Bundle) {
  const { default: initSqlJs } = await import('sql.js');
  const SQL = await initSqlJs({ locateFile: (f: string) => `${import.meta.env.BASE_URL}vendor/${f}` });
  const d = new SQL.Database();
  d.run(`CREATE TABLE patient(id TEXT PRIMARY KEY, name TEXT, date_of_birth TEXT, age_years INT, sex TEXT, blood_group TEXT, height_cm REAL, baseline_weight_kg REAL, conditions TEXT, allergies TEXT, emergency_name TEXT, emergency_phone TEXT, note TEXT);
CREATE TABLE entries(id TEXT PRIMARY KEY, type TEXT, timestamp TEXT, note TEXT, edited_at TEXT, summary TEXT, data_json TEXT);
CREATE TABLE readings(entry_id TEXT, timestamp TEXT, metric TEXT, value REAL, diastolic REAL, unit TEXT, context TEXT, abnormal INT);
CREATE TABLE tasks(id TEXT PRIMARY KEY, title TEXT, details TEXT, times TEXT, days_of_week TEXT, start_date TEXT, end_date TEXT);
CREATE TABLE task_outcomes(entry_id TEXT, task_id TEXT, due_at TEXT, outcome TEXT, reason TEXT);
CREATE TABLE lab_results(entry_id TEXT, timestamp TEXT, lab TEXT, test_code TEXT, test_name TEXT, panel TEXT, value REAL, qualifier TEXT, text TEXT, unit TEXT, ref_low REAL, ref_high REAL, flag TEXT);
CREATE INDEX idx_entries_ts ON entries(timestamp);`);
  const p = b.patient;
  const titles = new Map(b.tasks.map((t) => [t.id, t.title]));
  d.run('INSERT INTO patient VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)', [p.id, p.name, p.dateOfBirth ?? null, p.ageYears ?? null, p.sex ?? null, p.bloodGroup ?? null, p.heightCm ?? null, p.baselineWeightKg ?? null,
    JSON.stringify(p.conditions ?? []), JSON.stringify(p.allergies ?? []), p.emergencyContact?.name ?? null, p.emergencyContact?.phone ?? null, p.note ?? null]);
  for (const e of b.entries) {
    const light = e.type === 'photo' ? { ...e, image: '[omitted]' } : e;
    d.run('INSERT INTO entries VALUES(?,?,?,?,?,?,?)', [e.id, e.type, e.timestamp, e.note ?? null, e.editedAt ?? null, describeEntry(e, titles, p.sex), JSON.stringify(light)]);
    if (e.type === 'vitals') for (const r of e.readings) d.run('INSERT INTO readings VALUES(?,?,?,?,?,?,?,?)', [e.id, e.timestamp, r.metric, r.value, r.diastolic ?? null, UNITS[r.metric], r.context ?? null, isAbnormal(r) ? 1 : 0]);
    if (e.type === 'labs') for (const r of e.results) {
      const g = effectiveRange(r, p.sex);
      d.run('INSERT INTO lab_results VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)', [e.id, e.timestamp, e.lab ?? null, r.test, labName(r), labPanel(r), r.value ?? null, r.qualifier ?? null, r.text ?? null, labUnit(r) || null, g?.lo ?? null, g?.hi ?? null, labFlag(r, p.sex)]);
    }
    if (e.type === 'task') d.run('INSERT INTO task_outcomes VALUES(?,?,?,?,?)', [e.id, e.taskId, e.dueAt, e.outcome, e.reason ?? null]);
  }
  for (const t of b.tasks) d.run('INSERT INTO tasks VALUES(?,?,?,?,?,?,?)', [t.id, t.title, t.details ?? null, JSON.stringify(t.times), t.daysOfWeek ? JSON.stringify(t.daysOfWeek) : null, t.startDate, t.endDate ?? null]);
  const bytes = d.export(); d.close();
  download(`medasium-${slug(p.name)}-${stamp()}.sqlite`, new Uint8Array(bytes), 'application/vnd.sqlite3');
}
