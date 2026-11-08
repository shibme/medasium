# Medasium import file: guide for AI agents

Goal: read the user's documents (prescriptions, lab reports, discharge summaries, doctor notes, diaries, chat exports, photos of paper) and write ONE JSON file that the Medasium web app can import. Output only the JSON.

- Schema (authoritative, validate against it): `../schema/medasium.schema.json`
- Working example: `../samples/sample-patient.json` (large; this guide has a small one below)

## Hard rules

1. **One patient per file.** If the documents cover several people, ask which one, or produce one file per person.
2. **Never invent.** Omit any field the documents do not state. No guessed doses, readings, dates, diagnoses or outcomes. Do not interpret or add medical advice. Copy outcomes and advice as written.
3. **India-first defaults** (apply unless a document clearly says otherwise):
   - Time zone IST. Every date-time is ISO 8601 **with offset**: `2026-11-08T08:30:00+05:30`.
   - Indian documents write dates **DD/MM/YYYY** (`03/04/2026` = 3 April 2026). Never read them as MM/DD. If the time is unknown, use `12:00:00+05:30` and say so in `note`.
   - Fixed units: glucose **mg/dL**, temperature **°F**, weight **kg**, height **cm**, BP **mmHg**, pulse **bpm**, SpO2 **%**. Convert first: mmol/L x 18 = mg/dL; °C x 9/5 + 32 = °F; lb / 2.2046 = kg; ft/in to cm.
   - Phones as `+91 98765 43210`. Emergency numbers are 112 (national) and 108 (ambulance).
   - Keep drug names/strengths as printed (`Metformin 500 mg`). Keep Indian dosing notation readable: `1-0-1` means morning-noon-night; write it in `dose` as `1 tablet morning and night (1-0-1)`.
4. `format` must be `"medasium"` and `version` must be `1`.
5. Every `id` is a unique string within the file (UUID or short like `e_001`). Entries and tasks have separate id lists, but all entry ids must differ from each other.
6. Output must be valid JSON: no comments, no trailing commas, no markdown fences in the saved file.

## File shape

```json
{
  "format": "medasium",
  "version": 1,
  "exportedAt": "2026-11-08T09:00:00+05:30",
  "patient": { "id": "p_1", "name": "..." },
  "entries": [],
  "tasks": []
}
```

### patient
`id`, `name` (required). Optional: `dateOfBirth` (YYYY-MM-DD, preferred) or `ageYears`; `sex` (`female|male|other|unknown`); `conditions` (string[]); `allergies` ([{`substance`, `reaction`?, `severity`? mild|moderate|severe}]); `emergencyContact` {`name`,`relation`,`phone`}; `bloodGroup` (`A+ A- B+ B- AB+ AB- O+ O-`); `heightCm`; `baselineWeightKg`; `note`.

### entries[] (all have `id`, `type`, `timestamp`; optional `note`)

| type | extra fields | use for |
|---|---|---|
| `vitals` | `readings`: [{`metric`, `value`, `diastolic`?, `context`?}] | measurements |
| `medication` | `name`, `dose`?, `status` (`taken|missed|skipped|refused`), `reason`? | doses given or not given |
| `observation` | `text`, `severity`? | symptoms, complaints, observations |
| `appointment` | `title`, `kind` (`doctorVisit|test|hospitalStay|other`), `status` (`scheduled|completed|cancelled`), `provider`?, `outcome`? | visits, lab tests, admissions |
| `photo` | `category`, `image` (data URL) | do NOT create; the app makes these |
| `task` | `taskId`, `dueAt`, `outcome`, `reason`? | outcome of a recurring task; see below |

**Vitals readings.** `metric` is one of `bloodPressure, glucose, weight, temperature, pulse, spo2, respiratoryRate`.
- `bloodPressure`: `value` = systolic (upper), `diastolic` = lower. "130/85" gives `value:130, diastolic:85`. `diastolic` is required for BP and forbidden for other metrics.
- `glucose`: set `context` to `fasting`, `postMeal` (about 2 h after food) or `random`. Use `random` if unclear. Reports saying FBS/FBG = fasting, PPBS/PP = postMeal, RBS = random.
- Put readings taken at the same time in one `vitals` entry.
- Lab values that are not in the list (HbA1c, creatinine, TSH, haemoglobin...) are not readings: put them in an `appointment` of kind `test` in `outcome`, e.g. `"HbA1c 7.9%, TSH 3.8 mIU/L"`.

**Medication.** One entry per dose event. A prescription (a plan, not a record of intake) is not a dose event: do not create `taken` entries from it. Put the regimen in `patient.note` or as an `appointment` outcome, and create `medication` entries only for doses a document says were given/missed.

**Appointments.** Future visits: `status: "scheduled"`. Discharge summaries: one `hospitalStay` with the admission `timestamp` and the summary in `outcome`.

### tasks[] (recurring care needs, optional)
`id`, `title`, `times` (["08:00","12:00"], 24h IST, at least one), `startDate` (YYYY-MM-DD), optional `details`, `daysOfWeek` (0=Sunday..6=Saturday; omit = every day), `endDate`.
- Expand "every 2 hours" into explicit times.
- **Every scheduled occurrence from `startDate` with no outcome entry shows as OVERDUE.** Unless the documents record past outcomes, set `startDate` to today's date (the date you are generating the file).
- An outcome is an entry `{type:"task", taskId, dueAt, outcome, timestamp}` where `dueAt` = the occurrence date + its time + `+05:30` (e.g. `2026-11-08T08:00:00+05:30`), `outcome` is `done|skipped|notApplicable`, and **`reason` is required for `skipped`**.
- Only create tasks the documents actually ask for (e.g. "turn every 2 hours", "dressing on alternate days").

## Minimal valid example

```json
{
  "format": "medasium",
  "version": 1,
  "exportedAt": "2026-11-08T09:00:00+05:30",
  "patient": {
    "id": "p_1", "name": "Ramesh Kulkarni", "dateOfBirth": "1957-06-21", "sex": "male",
    "conditions": ["Hypertension"], "allergies": [{ "substance": "Sulfa drugs", "reaction": "Rash" }],
    "emergencyContact": { "name": "Anita Kulkarni", "relation": "Daughter", "phone": "+91 98220 11223" }
  },
  "entries": [
    { "id": "e_1", "type": "vitals", "timestamp": "2026-11-07T07:30:00+05:30",
      "readings": [ { "metric": "bloodPressure", "value": 148, "diastolic": 92 }, { "metric": "glucose", "value": 112, "context": "fasting" } ] },
    { "id": "e_2", "type": "medication", "timestamp": "2026-11-07T08:00:00+05:30", "name": "Amlodipine 5 mg", "dose": "1 tablet", "status": "taken" },
    { "id": "e_3", "type": "appointment", "timestamp": "2026-11-20T11:00:00+05:30", "title": "Cardiology review", "kind": "doctorVisit", "status": "scheduled", "provider": "Dr. Joshi" }
  ],
  "tasks": [
    { "id": "t_1", "title": "Walk 20 minutes", "times": ["17:30"], "startDate": "2026-11-08" }
  ]
}
```

## Before you finish: checklist

- [ ] Valid JSON; `format` = `medasium`, `version` = 1; exactly one patient.
- [ ] All date-times have `+05:30` (or the documented offset); dates were read day-first.
- [ ] Units converted to mg/dL, °F, kg, cm; BP has both numbers.
- [ ] No ids repeated; every task `taskId` matches a `tasks[].id`.
- [ ] Every `skipped` task outcome has a `reason`; task `startDate` is not in the past without outcomes.
- [ ] Nothing was guessed. Unreadable or ambiguous items were left out or described in `note`, and listed to the user separately.
- [ ] If you can, validate against the schema and fix errors before replying.

The user imports the file in Medasium under **Import**, sees a preview, and chooses merge or replace.
