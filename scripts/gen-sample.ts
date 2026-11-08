// Generates public/samples/sample-patient.json: a rich, deterministic India-first sample patient.
// Anchored on ANCHOR_DAY; the app shifts every date by whole days so the sample always ends "today".
import { writeFileSync, mkdirSync } from 'node:fs';
import { MedasiumExport } from '../src/model/schema';
import type { Entry, Task } from '../src/model/schema';

const ANCHOR_DAY = '2026-11-08';
const DAYS = 60;
let seed = 20261108;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const between = (a: number, b: number) => a + rnd() * (b - a);
const r0 = (n: number) => Math.round(n);
const r1 = (n: number) => Math.round(n * 10) / 10;
const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
const addDays = (day: string, n: number) => new Date(new Date(`${day}T12:00:00+05:30`).getTime() + n * 86400000).toISOString().slice(0, 10);
const at = (day: string, hhmm: string) => `${day}T${hhmm}:00+05:30`;
const dow = (day: string) => new Date(`${day}T12:00:00+05:30`).getUTCDay();

const entries: Entry[] = [];
let n = 0;
const nid = (p: string) => `${p}_${String(++n).padStart(4, '0')}`;
const firstDay = addDays(ANCHOR_DAY, -(DAYS - 1));

const fever = new Set([addDays(ANCHOR_DAY, -14), addDays(ANCHOR_DAY, -13), addDays(ANCHOR_DAY, -12)]);

for (let i = 0; i < DAYS; i++) {
  const day = addDays(ANCHOR_DAY, -(DAYS - 1) + i);
  const isToday = day === ANCHOR_DAY;
  const trend = i / DAYS;
  // Morning vitals (06:45)
  const sys = r0(between(128, 146) + (fever.has(day) ? 6 : 0) + (rnd() < 0.12 ? 14 : 0) - trend * 4);
  const dia = r0(between(76, 90) + (sys > 150 ? 4 : 0));
  entries.push({
    id: nid('v'), type: 'vitals', timestamp: at(day, '07:00'),
    readings: [
      { metric: 'bloodPressure', value: sys, diastolic: dia },
      { metric: 'pulse', value: r0(between(70, 88) + (fever.has(day) ? 14 : 0)) },
      { metric: 'spo2', value: r0(between(95, 99) - (fever.has(day) ? 2 : 0)) },
      { metric: 'glucose', value: r0(between(98, 138) - trend * 6), context: 'fasting' },
    ],
  });
  if (!isToday) {
    entries.push({
      id: nid('v'), type: 'vitals', timestamp: at(day, '18:30'),
      readings: [
        { metric: 'bloodPressure', value: r0(between(122, 142)), diastolic: r0(between(72, 88)) },
        { metric: 'pulse', value: r0(between(72, 92)) },
        ...(i % 2 === 0 ? [{ metric: 'glucose' as const, value: r0(between(135, 195) - trend * 8), context: 'postMeal' as const }] : []),
      ],
    });
  }
  if (fever.has(day)) {
    entries.push({ id: nid('v'), type: 'vitals', timestamp: at(day, '13:00'), readings: [{ metric: 'temperature', value: r1(between(100.2, 101.8)) }], note: 'Checked with digital thermometer (axillary).' });
    entries.push({ id: nid('v'), type: 'vitals', timestamp: at(day, '21:00'), readings: [{ metric: 'temperature', value: r1(between(99.4, 100.6)) }] });
  } else if (i % 4 === 0 && !isToday) {
    entries.push({ id: nid('v'), type: 'vitals', timestamp: at(day, '12:00'), readings: [{ metric: 'temperature', value: r1(between(97.6, 99.1)) }] });
  }
  if (i % 7 === 0) {
    entries.push({ id: nid('v'), type: 'vitals', timestamp: at(day, '07:15'), readings: [{ metric: 'weight', value: r1(62.4 - trend * 1.6 + (i > 45 ? 0.9 : 0) + between(-0.2, 0.2)) }] });
  }
  if (i === DAYS - 4) entries.push({ id: nid('v'), type: 'vitals', timestamp: at(day, '10:00'), readings: [{ metric: 'respiratoryRate', value: 18 }] });

  // Medications
  const meds: [string, string, string, string][] = [
    ['Thyroxine 50 mcg', '1 tablet, empty stomach', '06:30', 'Thyroxine'],
    ['Metformin 500 mg', '1 tablet after breakfast', '08:30', 'Metformin'],
    ['Telmisartan 40 mg', '1 tablet', '08:30', 'Telmisartan'],
    ['Metformin 500 mg', '1 tablet after dinner', '20:30', 'Metformin'],
    ['Atorvastatin 10 mg', '1 tablet at bedtime', '21:30', 'Atorvastatin'],
  ];
  for (const [name, dose, t] of meds) {
    if (isToday && t > '09:00') continue;
    const roll = rnd();
    const status = roll < 0.04 ? 'missed' : roll < 0.06 ? 'refused' : roll < 0.08 ? 'skipped' : 'taken';
    entries.push({
      id: nid('m'), type: 'medication', timestamp: at(day, t), name, dose, status,
      ...(status === 'missed' ? { reason: 'Fell asleep, remembered next morning' } : status === 'refused' ? { reason: 'Felt nauseous' } : status === 'skipped' ? { reason: 'Fasting for lab test' } : {}),
    });
  }
  if (fever.has(day)) entries.push({ id: nid('m'), type: 'medication', timestamp: at(day, '14:00'), name: 'Paracetamol 650 mg', dose: '1 tablet (SOS for fever)', status: 'taken' });
}

const obs: [number, string, string, 'mild' | 'moderate' | 'severe' | undefined][] = [
  [56, '16:00', 'Mild swelling in both ankles by evening. Legs raised for 30 minutes.', 'mild'],
  [51, '09:30', 'Slept well. Good appetite, ate 2 idli with sambar.', undefined],
  [46, '11:00', 'Complained of dizziness on standing up. BP checked and noted; advised to rise slowly.', 'moderate'],
  [40, '17:00', 'Pain in right knee after physiotherapy, 4 out of 10. Applied warm compress.', 'mild'],
  [33, '08:15', 'Reduced appetite since morning, only had tea and a few biscuits.', 'mild'],
  [27, '19:30', 'Cheerful today, walked to the balcony with walker support.', undefined],
  [22, '14:30', 'Small redness near the dressing site on left hip. Cleaned and re-dressed.', 'mild'],
  [14, '12:30', 'Fever with chills since last night. Body ache. Fluids encouraged.', 'moderate'],
  [13, '09:00', 'Fever persists, appetite poor. Gave paracetamol; called Dr. Raman by phone.', 'moderate'],
  [11, '10:00', 'Fever settled. Feeling weak but eating khichdi.', 'mild'],
  [6, '15:00', 'Constipation for two days. Increased water and papaya at lunch.', 'mild'],
  [2, '21:00', 'Slept late due to leg cramps. Massaged calves.', 'mild'],
];
for (const [ago, t, text, severity] of obs)
  entries.push({ id: nid('o'), type: 'observation', timestamp: at(addDays(ANCHOR_DAY, -ago), t), text, ...(severity ? { severity } : {}), ...(ago === 46 ? { editedAt: at(addDays(ANCHOR_DAY, -ago), '11:20') } : {}) });

entries.push(
  { id: nid('a'), type: 'appointment', timestamp: at(addDays(ANCHOR_DAY, -21), '17:00'), title: 'Diabetes review', kind: 'doctorVisit', status: 'completed', provider: 'Dr. Meenakshi Raman, Apollo Clinic, Adyar', outcome: 'Sugars slightly high. Continue Metformin; repeat HbA1c and thyroid profile in 3 weeks. Reduce salt and rice portions.' },
  { id: nid('a'), type: 'appointment', timestamp: at(addDays(ANCHOR_DAY, -19), '07:30'), title: 'HbA1c and thyroid profile', kind: 'test', status: 'completed', provider: 'Thyrocare collection, home visit', outcome: 'HbA1c 7.9%. TSH 3.8 mIU/L (normal).' },
  { id: nid('a'), type: 'appointment', timestamp: at(addDays(ANCHOR_DAY, -45), '10:00'), title: 'Hip fracture surgery follow-up', kind: 'hospitalStay', status: 'completed', provider: 'Fortis Malar Hospital', outcome: 'Wound healing well. Continue physiotherapy and walker use.' },
  { id: nid('a'), type: 'appointment', timestamp: at(addDays(ANCHOR_DAY, 9), '11:30'), title: 'Orthopaedic follow-up and X-ray', kind: 'doctorVisit', status: 'scheduled', provider: 'Dr. S. Venkatesh, Fortis Malar Hospital' },
);

const svg = (title: string, lines: string[]) =>
  'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320" viewBox="0 0 480 320"><rect width="480" height="320" fill="#fffdf7"/><rect x="12" y="12" width="456" height="296" fill="none" stroke="#c9c2ae"/><text x="30" y="52" font-family="sans-serif" font-size="20" font-weight="700" fill="#33302a">${title}</text>${lines.map((l, i) => `<text x="30" y="${92 + i * 28}" font-family="sans-serif" font-size="15" fill="#5a564c">${l}</text>`).join('')}<text x="30" y="290" font-family="sans-serif" font-size="11" fill="#9b958a">Sample image generated for demo data</text></svg>`);
entries.push(
  { id: nid('p'), type: 'photo', timestamp: at(addDays(ANCHOR_DAY, -21), '18:00'), category: 'prescription', caption: 'Prescription from Dr. Raman', image: svg('Rx: Dr. M. Raman', ['Tab Metformin 500 mg  1-0-1 (after food)', 'Tab Telmisartan 40 mg  1-0-0', 'Tab Thyroxine 50 mcg  1 early morning', 'Tab Atorvastatin 10 mg  0-0-1', 'Review after 3 weeks with HbA1c']) },
  { id: nid('p'), type: 'photo', timestamp: at(addDays(ANCHOR_DAY, -18), '12:00'), category: 'report', caption: 'Lab report summary', image: svg('Lab report', ['HbA1c: 7.9 %  (target < 7.0)', 'TSH: 3.8 mIU/L  (0.4 - 4.5)', 'Creatinine: 0.9 mg/dL', 'Collected at home, reported same evening']) },
  { id: nid('p'), type: 'photo', timestamp: at(addDays(ANCHOR_DAY, -22), '14:35'), category: 'wound', caption: 'Dressing site, left hip', image: svg('Wound photo (placeholder)', ['Left hip surgical site', 'Mild redness near lower edge', 'No discharge']) },
);

// Recurring tasks, with an outcome for every past occurrence (today's are left open on purpose).
const tasks: Task[] = [
  { id: 't_turn', title: 'Reposition (turn) patient', details: 'Check pressure points; use pillow support.', times: ['08:00', '12:00', '16:00', '20:00'], startDate: firstDay },
  { id: 't_physio', title: 'Physiotherapy exercises', details: 'Knee bends and walker practice, 20 minutes.', times: ['10:00'], daysOfWeek: [1, 3, 5], startDate: firstDay },
  { id: 't_dress', title: 'Dressing change, left hip', times: ['09:00'], daysOfWeek: [2, 5], startDate: firstDay },
  { id: 't_walk', title: 'Evening walk with walker', times: ['17:30'], startDate: firstDay },
];
const skipReasons: Record<string, string[]> = {
  t_turn: ['Patient asleep, did not disturb', 'Attendant late'],
  t_physio: ['Physiotherapist on leave', 'Patient had fever'],
  t_dress: ['Dressing dry and intact, doctor advised to wait'],
  t_walk: ['Rain', 'Patient tired'],
};
for (const t of tasks) {
  for (let i = 0; i < DAYS; i++) {
    const day = addDays(ANCHOR_DAY, -(DAYS - 1) + i);
    if (day === ANCHOR_DAY) continue;
    if (t.daysOfWeek && !t.daysOfWeek.includes(dow(day))) continue;
    for (const time of t.times) {
      const roll = rnd();
      const feverDay = fever.has(day);
      const outcome = feverDay && t.id !== 't_turn' ? 'notApplicable' : roll < 0.07 ? 'skipped' : roll < 0.09 ? 'notApplicable' : 'done';
      entries.push({
        id: nid('k'), type: 'task', taskId: t.id, dueAt: at(day, time),
        timestamp: at(day, `${time.slice(0, 2)}:${String(Math.floor(between(2, 25))).padStart(2, '0')}`),
        outcome,
        ...(outcome === 'skipped' ? { reason: pick(skipReasons[t.id]) } : {}),
        ...(outcome === 'notApplicable' && feverDay ? { note: 'Resting due to fever.' } : {}),
      });
    }
  }
}
// A leftover unresolved occurrence from yesterday evening, so the Today view shows an overdue item.
const lastTurn = entries.findIndex((e) => e.type === 'task' && e.taskId === 't_turn' && e.dueAt === at(addDays(ANCHOR_DAY, -1), '20:00'));
if (lastTurn >= 0) entries.splice(lastTurn, 1);

const data = {
  format: 'medasium' as const, version: 1 as const, exportedAt: at(ANCHOR_DAY, '08:00'),
  patient: {
    id: 'pt_sample_kamala', name: 'Kamala Subramanian', dateOfBirth: '1952-03-14', sex: 'female' as const,
    conditions: ['Type 2 diabetes mellitus', 'Hypertension', 'Hypothyroidism', 'Osteoarthritis, both knees', 'Right hip fracture, surgically fixed (Sep 2026)'],
    allergies: [{ substance: 'Penicillin', reaction: 'Skin rash and itching', severity: 'moderate' as const }, { substance: 'Sulfa drugs', reaction: 'Rash', severity: 'mild' as const }],
    emergencyContact: { name: 'Rajesh Subramanian', relation: 'Son', phone: '+91 98400 12345' },
    bloodGroup: 'B+' as const, heightCm: 156, baselineWeightKg: 62,
    note: 'Lives with son and daughter-in-law in Chennai. Speaks Tamil and English. Vegetarian diet, low salt. Uses a walker. Sample patient, all data is fictional.',
  },
  entries, tasks,
};
const parsed = MedasiumExport.parse(data);
mkdirSync('public/samples', { recursive: true });
writeFileSync('public/samples/sample-patient.json', JSON.stringify(parsed, null, 1) + '\n');
console.log(`sample: ${entries.length} entries, ${tasks.length} tasks`);
