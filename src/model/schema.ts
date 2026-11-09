import { z } from 'zod';
import { LAB_BY_CODE, LAB_CODES } from './labs';

/** Medasium export format. India-first defaults: IST (+05:30), mg/dL, °F, kg, cm, +91 phones. */
export const FORMAT_VERSION = 1;

const id = z.string().min(1).max(64).describe('Unique within the file. UUID recommended; any short unique string such as "e_001" is accepted. Used to match records on merge.');
const timestamp = z
  .iso.datetime({ offset: true })
  .describe('ISO 8601 date-time WITH offset, e.g. 2026-11-08T08:30:00+05:30. Use +05:30 (IST) unless the source document says otherwise.');
const note = z.string().max(4000).optional().describe('Free text note.');
const editedAt = timestamp.optional().describe('Set only if the record was corrected after saving. Omit when creating a new file.');

export const METRICS = ['bloodPressure', 'glucose', 'weight', 'temperature', 'pulse', 'spo2', 'respiratoryRate'] as const;
export const GLUCOSE_CONTEXTS = ['fasting', 'postMeal', 'random'] as const;

export const Reading = z
  .object({
    metric: z.enum(METRICS).describe('Fixed units: bloodPressure=mmHg, glucose=mg/dL, weight=kg, temperature=°F, pulse=bpm, spo2=%, respiratoryRate=breaths/min. Convert other units first (mmol/L x 18 = mg/dL; °C x 9/5 + 32 = °F; lb / 2.2046 = kg).'),
    value: z.number().describe('Reading value. For bloodPressure this is the SYSTOLIC (upper) number.'),
    diastolic: z.number().optional().describe('Only for bloodPressure: the DIASTOLIC (lower) number. Required for bloodPressure, not allowed otherwise.'),
    context: z.enum(GLUCOSE_CONTEXTS).optional().describe('Only for glucose: fasting, postMeal (2h after food) or random. Defaults to random when omitted.'),
  })
  .refine((r) => (r.metric === 'bloodPressure') === (r.diastolic !== undefined), {
    message: 'diastolic is required for bloodPressure and not allowed for other metrics',
  })
  .describe('One measurement.');

const base = { id, timestamp, note, editedAt };

export const VitalsEntry = z.object({
  ...base,
  type: z.literal('vitals'),
  readings: z.array(Reading).min(1).describe('One or more readings taken at the same time.'),
}).describe('Vitals and medical metrics. These feed the charts.');

export const MEDICATION_STATUS = ['taken', 'missed', 'skipped', 'refused'] as const;
export const MedicationEntry = z.object({
  ...base,
  type: z.literal('medication'),
  name: z.string().min(1).max(200).describe('Medicine name, e.g. "Metformin 500 mg".'),
  dose: z.string().max(100).optional().describe('Dose as written, e.g. "1 tablet", "10 units", "5 ml".'),
  status: z.enum(MEDICATION_STATUS).describe('What actually happened. Use taken only if the document says it was given.'),
  reason: z.string().max(500).optional().describe('Why a dose was missed/skipped/refused.'),
}).describe('A medication dose and whether it was taken. timestamp = time given (or due, if not taken).');

export const SEVERITY = ['mild', 'moderate', 'severe'] as const;
export const ObservationEntry = z.object({
  ...base,
  type: z.literal('observation'),
  text: z.string().min(1).max(4000).describe('Symptom, complaint or observation.'),
  severity: z.enum(SEVERITY).optional(),
}).describe('Symptoms and observations.');

export const APPOINTMENT_KIND = ['doctorVisit', 'test', 'hospitalStay', 'other'] as const;
export const APPOINTMENT_STATUS = ['scheduled', 'completed', 'cancelled'] as const;
export const AppointmentEntry = z.object({
  ...base,
  type: z.literal('appointment'),
  title: z.string().min(1).max(200),
  kind: z.enum(APPOINTMENT_KIND),
  status: z.enum(APPOINTMENT_STATUS),
  provider: z.string().max(200).optional().describe('Doctor, lab or hospital name.'),
  outcome: z.string().max(2000).optional().describe('Result, advice recorded, or diagnosis as written in the document. Do not invent.'),
}).describe('Doctor visits, tests, hospital stays.');

export const PHOTO_CATEGORY = ['report', 'prescription', 'wound', 'other'] as const;
export const PhotoEntry = z.object({
  ...base,
  type: z.literal('photo'),
  category: z.enum(PHOTO_CATEGORY),
  caption: z.string().max(500).optional(),
  image: z.string().startsWith('data:image/').max(1_500_000).describe('Data URL (data:image/jpeg;base64,...). Normally produced by the app; AI agents should usually NOT create photo entries.'),
}).describe('A photo or attachment (compressed by the app).');

export const TASK_OUTCOME = ['done', 'skipped', 'notApplicable'] as const;
export const TaskEntry = z
  .object({
    ...base,
    type: z.literal('task'),
    taskId: id.describe('The id of the task definition in `tasks`.'),
    dueAt: timestamp.describe('Which scheduled occurrence this outcome is for. MUST equal the occurrence date-time (task time on that date, with the same offset as used by the app, e.g. 2026-11-08T08:00:00+05:30).'),
    outcome: z.enum(TASK_OUTCOME),
    reason: z.string().max(500).optional().describe('REQUIRED when outcome is skipped.'),
  })
  .refine((t) => t.outcome !== 'skipped' || !!t.reason?.trim(), { message: 'A skipped task must carry a reason', path: ['reason'] })
  .describe('Outcome of one occurrence of a recurring task. timestamp = when the outcome was recorded.');

export const LAB_QUALIFIER = ['<', '>'] as const;
export const LabResult = z
  .object({
    test: z.enum([...LAB_CODES, 'custom']).describe('Catalogue test code (see the lab catalogue in the agent guide / the oneOf list in this schema), or "custom" for any test not in the catalogue.'),
    name: z.string().min(1).max(120).optional().describe('REQUIRED for custom tests: the test name as printed. Optional (ignored) for catalogue tests.'),
    value: z.number().optional().describe('Numeric result, ALREADY CONVERTED to the test\'s canonical unit. Exactly one of value or text.'),
    qualifier: z.enum(LAB_QUALIFIER).optional().describe('Use when the report prints "<2.0" or ">1000": put the number in value and "<" or ">" here.'),
    text: z.string().min(1).max(200).optional().describe('Non-numeric result as printed, e.g. "Negative", "Non-reactive", "6-8 /HPF". Exactly one of value or text.'),
    abnormal: z.boolean().optional().describe('Only for text results: true if the report marks it abnormal. Numeric results are flagged automatically from the range.'),
    unit: z.string().min(1).max(40).optional().describe('Catalogue tests: omit, or give the canonical unit exactly. Custom tests: the unit as printed.'),
    refLow: z.number().optional().describe('Lower limit of the reference range PRINTED ON THE REPORT (canonical unit). Overrides the catalogue range.'),
    refHigh: z.number().optional().describe('Upper limit of the reference range PRINTED ON THE REPORT (canonical unit). For "< 37" use refHigh 37.'),
  })
  .superRefine((x, ctx) => {
    const issue = (message: string, path: string) => ctx.addIssue({ code: 'custom', message, path: [path] });
    if ((x.value === undefined) === (x.text === undefined)) issue('Give exactly one of value (number) or text', 'value');
    if (x.qualifier && x.value === undefined) issue('qualifier needs a numeric value', 'qualifier');
    if (x.abnormal !== undefined && x.text === undefined) issue('abnormal is only for text results; numeric results are flagged from the range', 'abnormal');
    if (x.refLow !== undefined && x.refHigh !== undefined && x.refLow > x.refHigh) issue('refLow must not be greater than refHigh', 'refLow');
    if (x.test === 'custom') { if (!x.name?.trim()) issue('Custom tests need a name', 'name'); return; }
    const t = LAB_BY_CODE[x.test];
    if (x.unit !== undefined && x.unit !== t.unit) {
      const alt = t.alt?.find((a) => a.unit === x.unit);
      issue(`${t.name} must be in ${t.unit}${alt ? `; convert ${alt.unit} by multiplying by ${+alt.factor.toPrecision(4)}` : ''} (or omit unit)`, 'unit');
    }
  })
  .describe('One lab test result.');

export const LabsEntry = z.object({
  ...base,
  type: z.literal('labs'),
  lab: z.string().max(200).optional().describe('Laboratory or hospital name, e.g. "Adyar Diagnostics".'),
  results: z.array(LabResult).min(1).describe('All results from one report / sample collection.'),
}).describe('Lab report: one sample collection with its results. timestamp = sample collection time.');

export const Entry = z.discriminatedUnion('type', [VitalsEntry, MedicationEntry, ObservationEntry, AppointmentEntry, PhotoEntry, TaskEntry, LabsEntry]);

export const Task = z.object({
  id,
  title: z.string().min(1).max(200).describe('e.g. "Turn patient", "Physiotherapy", "Dressing change".'),
  details: z.string().max(1000).optional(),
  times: z.array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)).min(1).describe('Local clock times each scheduled day, 24h "HH:MM" in IST. "Every 2 hours" must be expanded into explicit times.'),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional().describe('0=Sunday ... 6=Saturday. Omit for every day.'),
  startDate: z.iso.date().describe('First day the task applies, YYYY-MM-DD. Every scheduled occurrence from this date with no outcome entry counts as OVERDUE, so set it to today (or the first unresolved day) unless you also supply outcomes for past occurrences.'),
  endDate: z.iso.date().optional().describe('Last day, inclusive. Omit if ongoing.'),
}).describe('A recurring care need with a schedule.');

export const Allergy = z.object({
  substance: z.string().min(1).max(200),
  reaction: z.string().max(300).optional(),
  severity: z.enum(SEVERITY).optional(),
});

export const SEX = ['female', 'male', 'other', 'unknown'] as const;
export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

export const Patient = z.object({
  id,
  name: z.string().min(1).max(200),
  dateOfBirth: z.iso.date().optional().describe('YYYY-MM-DD. Prefer this over ageYears. Indian documents often print DD/MM/YYYY: convert carefully, day first.'),
  ageYears: z.number().int().min(0).max(130).optional().describe('Only if the date of birth is unknown.'),
  sex: z.enum(SEX).optional(),
  conditions: z.array(z.string().min(1).max(200)).optional().describe('Known conditions and diagnoses, e.g. "Type 2 diabetes mellitus".'),
  allergies: z.array(Allergy).optional(),
  emergencyContact: z.object({
    name: z.string().max(200).optional(),
    phone: z.string().max(30).optional().describe('Indian format "+91 98xxxxxxxx" (10-digit mobile). Emergency services: 112 (national), 108 (ambulance).'),
    relation: z.string().max(100).optional(),
  }).optional(),
  bloodGroup: z.enum(BLOOD_GROUPS).optional(),
  heightCm: z.number().min(30).max(260).optional(),
  baselineWeightKg: z.number().min(1).max(400).optional(),
  note: z.string().max(4000).optional(),
}).describe('Patient profile. Exactly one patient per file.');

export const MedasiumExport = z.object({
  $schema: z.string().optional().describe('Optional pointer to the JSON Schema URL.'),
  format: z.literal('medasium'),
  version: z.literal(FORMAT_VERSION),
  exportedAt: timestamp,
  patient: Patient,
  entries: z.array(Entry).describe('All timeline entries for this patient, any order (the app sorts by timestamp).'),
  tasks: z.array(Task).describe('Recurring task definitions. Use [] if none.'),
}).superRefine((d, ctx) => {
  const seen = new Set<string>();
  d.entries.forEach((e, i) => {
    if (seen.has(e.id)) ctx.addIssue({ code: 'custom', message: `Duplicate entry id "${e.id}"`, path: ['entries', i, 'id'] });
    seen.add(e.id);
  });
  const taskIds = new Set<string>();
  d.tasks.forEach((t, i) => {
    if (taskIds.has(t.id)) ctx.addIssue({ code: 'custom', message: `Duplicate task id "${t.id}"`, path: ['tasks', i, 'id'] });
    taskIds.add(t.id);
  });
  d.entries.forEach((e, i) => {
    if (e.type === 'task' && !taskIds.has(e.taskId))
      ctx.addIssue({ code: 'custom', message: `taskId "${e.taskId}" does not match any task`, path: ['entries', i, 'taskId'] });
  });
}).describe('Medasium import/export file for ONE patient.');

export type Reading = z.infer<typeof Reading>;
export type LabResult = z.infer<typeof LabResult>;
export type LabsEntry = z.infer<typeof LabsEntry>;
export type Entry = z.infer<typeof Entry>;
export type Task = z.infer<typeof Task>;
export type Patient = z.infer<typeof Patient>;
export type MedasiumExport = z.infer<typeof MedasiumExport>;
export type EntryType = Entry['type'];
export type Metric = (typeof METRICS)[number];
