import type { Bundle } from '../db';
import { toExport } from '../db';
import type { Entry, Metric, Reading } from '../model/schema';
import { ageFrom, fmtDate, fmtDateTime, fmtPhone, ymd } from './format';
import { LABELS, UNITS, fmtReading, isAbnormal } from './ranges';
import { metricSeries } from './series';

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

export function describeEntry(e: Entry, titles?: Map<string, string>): string {
  switch (e.type) {
    case 'vitals': return e.readings.map((r: Reading) => `${LABELS[r.metric]} ${fmtReading(r)}${isAbnormal(r) ? ' (out of range)' : ''}`).join('; ');
    case 'medication': return `${e.name}${e.dose ? `, ${e.dose}` : ''}: ${e.status}${e.reason ? ` (${e.reason})` : ''}`;
    case 'observation': return e.text;
    case 'appointment': return `${e.title} [${e.status}]${e.provider ? `, ${e.provider}` : ''}${e.outcome ? `. ${e.outcome}` : ''}`;
    case 'photo': return `Photo (${e.category})${e.caption ? `: ${e.caption}` : ''}`;
    case 'task': return `${titles?.get(e.taskId) ?? 'Task'}: ${e.outcome === 'notApplicable' ? 'not applicable' : e.outcome}${e.reason ? ` (${e.reason})` : ''}`;
  }
}

export async function exportPdf(b: Bundle, period: Period, entries: Entry[]) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 14; let y = M;
  const need = (h: number) => { if (y + h > 285) { doc.addPage(); y = M; } };
  const text = (s: string, size = 10, bold = false, color: [number, number, number] = [30, 30, 30]) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(...color);
    for (const line of doc.splitTextToSize(s, W - 2 * M) as string[]) { need(size * 0.5); doc.text(line, M, y); y += size * 0.45 + 1; }
  };
  const titles = new Map(b.tasks.map((t) => [t.id, t.title]));
  const p = b.patient, age = ageFrom(p.dateOfBirth, p.ageYears);
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

  // Charts: drawn with vector primitives from existing points only.
  const vit = entries.filter((e) => e.type === 'vitals');
  const abn = vit.flatMap((e) => (e.type === 'vitals' ? e.readings : [])).filter(isAbnormal).length;
  text('Charts', 13, true, [15, 118, 110]);
  text(`Abnormal readings in period: ${abn}`, 10);
  const colors: [number, number, number][] = [[42, 120, 214], [235, 104, 52], [27, 175, 122], [98, 80, 214], [232, 123, 164], [0, 131, 0], [201, 133, 0]];
  CHARTS.forEach(({ metric: m, context, title }, mi) => {
    const series = metricSeries(vit, m, context);
    const pts = series.flatMap((s) => s.points);
    if (pts.length === 0) return;
    need(48); y += 2;
    text(`${title} (${UNITS[m]})`, 10, true);
    const x0 = M + 8, x1 = W - M, y0 = y + 2, h = 32, y1 = y0 + h;
    const all = pts.map((q) => q.v);
    const lo = Math.min(...all, m === 'bloodPressure' ? 60 : Infinity) , hi = Math.max(...all, m === 'bloodPressure' ? 140 : -Infinity);
    const pad = (hi - lo || 1) * 0.15, a = lo - pad, z = hi + pad;
    const t0 = Math.min(...pts.map((q) => q.t)), t1 = Math.max(...pts.map((q) => q.t));
    const X = (t: number) => (t1 === t0 ? (x0 + x1) / 2 : x0 + ((t - t0) / (t1 - t0)) * (x1 - x0));
    const Y = (v: number) => y1 - ((v - a) / (z - a)) * h;
    doc.setDrawColor(220); doc.rect(x0, y0, x1 - x0, h);
    const band = series[0].range;
    if (band) {
      const top = Math.max(y0, Y(band.hi ?? z)), bot = Math.min(y1, Y(band.lo ?? a));
      doc.setFillColor(222, 242, 236); doc.rect(x0, top, x1 - x0, Math.max(0, bot - top), 'F');
    }
    doc.setFontSize(7); doc.setTextColor(120); doc.text(String(Math.round(z)), M, y0 + 2); doc.text(String(Math.round(a)), M, y1);
    series.forEach((s, si) => {
      const c = colors[(mi + si) % colors.length]; doc.setDrawColor(...c); doc.setFillColor(...c); doc.setLineWidth(0.4);
      s.points.forEach((q, i) => {
        if (i > 0) doc.line(X(s.points[i - 1].t), Y(s.points[i - 1].v), X(q.t), Y(q.v));
      });
      s.points.forEach((q) => { if (q.bad) { doc.setFillColor(200, 30, 30); doc.circle(X(q.t), Y(q.v), 0.9, 'F'); } else { doc.setFillColor(...c); doc.circle(X(q.t), Y(q.v), 0.5, 'F'); } });
    });
    doc.setLineWidth(0.2);
    y = y1 + 5;
    if (band) { doc.setFontSize(7); doc.setTextColor(120); doc.text(`Shaded band: reference range${band.lo !== undefined ? ` ${band.lo}` : ''}${band.hi !== undefined ? `–${band.hi}` : '+'} ${UNITS[m]}. Red dots: out of range.`, x0, y - 1); y += 2; }
  });
  if (!vit.length) text('Not enough readings to chart in this period.', 10, false, [100, 100, 100]);

  y += 4; need(14);
  text(`Timeline (${entries.length} entries, oldest first)`, 13, true, [15, 118, 110]);
  for (const e of [...entries].sort((a, b) => a.timestamp.localeCompare(b.timestamp))) {
    text(`${fmtDateTime(e.timestamp)}  [${e.type}]${e.editedAt ? ' (edited)' : ''}`, 9, true, [70, 70, 70]);
    text(describeEntry(e, titles) + (e.note ? `. Note: ${e.note}` : ''), 9.5);
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
CREATE INDEX idx_entries_ts ON entries(timestamp);`);
  const p = b.patient;
  d.run('INSERT INTO patient VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)', [p.id, p.name, p.dateOfBirth ?? null, p.ageYears ?? null, p.sex ?? null, p.bloodGroup ?? null, p.heightCm ?? null, p.baselineWeightKg ?? null,
    JSON.stringify(p.conditions ?? []), JSON.stringify(p.allergies ?? []), p.emergencyContact?.name ?? null, p.emergencyContact?.phone ?? null, p.note ?? null]);
  for (const e of b.entries) {
    const light = e.type === 'photo' ? { ...e, image: '[omitted]' } : e;
    d.run('INSERT INTO entries VALUES(?,?,?,?,?,?,?)', [e.id, e.type, e.timestamp, e.note ?? null, e.editedAt ?? null, describeEntry(e), JSON.stringify(light)]);
    if (e.type === 'vitals') for (const r of e.readings) d.run('INSERT INTO readings VALUES(?,?,?,?,?,?,?,?)', [e.id, e.timestamp, r.metric, r.value, r.diastolic ?? null, UNITS[r.metric], r.context ?? null, isAbnormal(r) ? 1 : 0]);
    if (e.type === 'task') d.run('INSERT INTO task_outcomes VALUES(?,?,?,?,?)', [e.id, e.taskId, e.dueAt, e.outcome, e.reason ?? null]);
  }
  for (const t of b.tasks) d.run('INSERT INTO tasks VALUES(?,?,?,?,?,?,?)', [t.id, t.title, t.details ?? null, JSON.stringify(t.times), t.daysOfWeek ? JSON.stringify(t.daysOfWeek) : null, t.startDate, t.endDate ?? null]);
  const bytes = d.export(); d.close();
  download(`medasium-${slug(p.name)}-${stamp()}.sqlite`, new Uint8Array(bytes), 'application/vnd.sqlite3');
}
