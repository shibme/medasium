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
   - Lab results use each test's **canonical unit** from the lab catalogue below (e.g. platelets in **lakh/cumm**, WBC in **cells/cumm**). Convert with the listed factor before writing `value`.
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
| `vitals` | `readings`: [{`metric`, `value`, `diastolic`?, `context`?}] | bedside measurements (BP machine, glucometer, thermometer, scale, oximeter) |
| `labs` | `lab`?, `results`: [{`test`, `value` or `text`, `qualifier`?, `refLow`?, `refHigh`?, `unit`?, `name`?, `abnormal`?}] | lab reports: tumour markers, CBC, LFT, RFT, lipids, thyroid, HbA1c… |
| `medication` | `name`, `dose`?, `status` (`taken|missed|skipped|refused`), `reason`? | doses given or not given |
| `observation` | `text`, `severity`? | symptoms, complaints, observations |
| `appointment` | `title`, `kind` (`doctorVisit|test|hospitalStay|other`), `status` (`scheduled|completed|cancelled`), `provider`?, `outcome`? | visits, scans, admissions |
| `photo` | `category`, `image` (data URL) | do NOT create; the app makes these |
| `task` | `taskId`, `dueAt`, `outcome`, `reason`? | outcome of a recurring task; see below |

**Vitals readings.** `metric` is one of `bloodPressure, glucose, weight, temperature, pulse, spo2, respiratoryRate`.
- `bloodPressure`: `value` = systolic (upper), `diastolic` = lower. "130/85" gives `value:130, diastolic:85`. `diastolic` is required for BP and forbidden for other metrics.
- `glucose`: set `context` to `fasting`, `postMeal` (about 2 h after food) or `random`. Use `random` if unclear. This is for **glucometer / home** readings; sugar values on a **lab report** go in `labs` (`fbsLab`, `ppbsLab`, `rbsLab`).
- Put readings taken at the same time in one `vitals` entry.

**Lab results (`labs`).** One entry per report / sample collection. `timestamp` = sample collection date-time (use the report's "collected" time; else the report date at `08:00:00+05:30` and say so in `note`). `lab` = laboratory or hospital name.
- `test` = a catalogue code from the table below. Match by name **or alias** (SGPT = `alt`, TLC = `wbc`, PCV = `hct`, CA19.9 = `ca199`). Anything not in the catalogue: `test: "custom"` with `name` (as printed), `unit`, and the report range.
- `value` = the number **in the canonical unit** (convert using the factor column; e.g. platelets `2,50,000 /cumm` → `2.5`; `250 ×10³/µL` → `2.5`; WBC `7.5 ×10³/µL` → `7500`; creatinine `80 µmol/L` → `0.905`). Strip Indian digit grouping: `1,50,000` = 150000. `unit` may be omitted for catalogue tests; if you include it, it must be the canonical unit exactly.
- Values printed as `<2.0` or `>1000`: `value: 2` + `qualifier: "<"` (or `">"`).
- Non-numeric results (`Negative`, `Non-reactive`, `Nil`, `6-8 /HPF`): use `text` instead of `value` (usually with `test: "custom"`), and `abnormal: true` only if the report marks it abnormal.
- **Copy the reference range printed on the report** into `refLow` / `refHigh` (canonical unit): `"0 - 37"` → refLow 0, refHigh 37; `"< 35"` → refHigh 35; `"> 60"` → refLow 60. Omit both if the report prints no range (the app uses typical adult ranges). Do not copy H/L flags; the app computes them.
- Calculated values printed on the report (indirect bilirubin, globulin, A/G ratio, eGFR, LDL, VLDL, ANC) may be included as printed. Do not calculate missing ones yourself.

**Medication.** One entry per dose event. A prescription (a plan, not a record of intake) is not a dose event: do not create `taken` entries from it. Put the regimen in `patient.note` or as an `appointment` outcome, and create `medication` entries only for doses a document says were given/missed.

**Appointments.** Future visits: `status: "scheduled"`. Discharge summaries: one `hospitalStay` with the admission `timestamp` and the summary in `outcome`.

### tasks[] (recurring care needs, optional)
`id`, `title`, `times` (["08:00","12:00"], 24h IST, at least one), `startDate` (YYYY-MM-DD), optional `details`, `daysOfWeek` (0=Sunday..6=Saturday; omit = every day), `endDate`.
- Expand "every 2 hours" into explicit times.
- **Every scheduled occurrence from `startDate` with no outcome entry shows as OVERDUE.** Unless the documents record past outcomes, set `startDate` to today's date (the date you are generating the file).
- An outcome is an entry `{type:"task", taskId, dueAt, outcome, timestamp}` where `dueAt` = the occurrence date + its time + `+05:30` (e.g. `2026-11-08T08:00:00+05:30`), `outcome` is `done|skipped|notApplicable`, and **`reason` is required for `skipped`**.
- Only create tasks the documents actually ask for (e.g. "turn every 2 hours", "dressing on alternate days").

## Lab catalogue

<!-- LAB_CATALOG:START (generated by scripts/gen-schema.ts; do not edit) -->

**Tumour markers**

| code | test (aliases) | unit | typical range | other units → multiply by |
|---|---|---|---|---|
| `ca199` | CA 19-9 (CA19.9, CA 19.9, CA19-9, Carbohydrate antigen 19-9) | U/mL | ≤ 37 |  |
| `ca125` | CA-125 (CA 125, CA125, Cancer antigen 125) | U/mL | ≤ 35 |  |
| `ca153` | CA 15-3 (CA15.3, CA 15.3, CA15-3) | U/mL | ≤ 30 |  |
| `cea` | CEA (Carcinoembryonic antigen) | ng/mL | ≤ 5 |  |
| `afp` | AFP (Alpha-fetoprotein, Alpha fetoprotein) | ng/mL | ≤ 10 |  |
| `psa` | PSA, total (PSA, Total PSA, Prostate specific antigen) | ng/mL | ≤ 4 · male only |  |
| `psaFree` | PSA, free (Free PSA, fPSA) | ng/mL | no default range (copy the report range) · male only |  |
| `bhcg` | Beta-hCG (b-hCG, Beta HCG, hCG) | mIU/mL | ≤ 5 |  |

**Blood count (CBC)**

| code | test (aliases) | unit | typical range | other units → multiply by |
|---|---|---|---|---|
| `hb` | Haemoglobin (Hb, Hgb, Hemoglobin) | g/dL | female 12–15.5, male 13–17 | g/L ×0.1 |
| `rbc` | RBC count (Red blood cells, Total RBC, Erythrocytes) | million/cumm | female 3.8–4.8, male 4.5–5.5 | ×10⁶/µL ×1, ×10¹²/L ×1 |
| `hct` | Haematocrit (PCV) (PCV, HCT, Hematocrit, Packed cell volume) | % | female 36–46, male 40–50 |  |
| `mcv` | MCV (Mean corpuscular volume) | fL | 80–100 |  |
| `mch` | MCH (Mean corpuscular haemoglobin) | pg | 27–32 |  |
| `mchc` | MCHC (Mean corpuscular haemoglobin concentration) | g/dL | 31.5–34.5 |  |
| `rdw` | RDW-CV (RDW, Red cell distribution width) | % | 11.6–14 |  |
| `wbc` | Total WBC count (TLC, TC, WBC, Total leucocyte count, Leukocytes) | cells/cumm | 4000–11000 | ×10³/µL ×1000, ×10⁹/L ×1000, /µL ×1 |
| `neut` | Neutrophils (Polymorphs, Neutrophil %) | % | 40–75 |  |
| `lymph` | Lymphocytes (Lymphocyte %) | % | 20–40 |  |
| `mono` | Monocytes (Monocyte %) | % | 2–10 |  |
| `eos` | Eosinophils (Eosinophil %) | % | 1–6 |  |
| `baso` | Basophils (Basophil %) | % | ≤ 2 |  |
| `anc` | Absolute neutrophil count (ANC, Absolute neutrophils) | cells/cumm | 2000–7000 | ×10³/µL ×1000, ×10⁹/L ×1000, /µL ×1 |
| `alc` | Absolute lymphocyte count (ALC, Absolute lymphocytes) | cells/cumm | 1000–3000 | ×10³/µL ×1000, ×10⁹/L ×1000, /µL ×1 |
| `plt` | Platelet count (Platelets, PLT, Thrombocytes) | lakh/cumm | 1.5–4.5 | ×10³/µL ×0.01, ×10⁹/L ×0.01, /cumm ×0.00001 |
| `esr` | ESR (Erythrocyte sedimentation rate) | mm/hr | female ≤ 20, male ≤ 15 |  |

**Liver (LFT)**

| code | test (aliases) | unit | typical range | other units → multiply by |
|---|---|---|---|---|
| `biliT` | Bilirubin, total (Total bilirubin, S. bilirubin, TBIL) | mg/dL | ≤ 1.2 | µmol/L ×0.05848 |
| `biliD` | Bilirubin, direct (Direct bilirubin, Conjugated bilirubin, DBIL) | mg/dL | ≤ 0.3 | µmol/L ×0.05848 |
| `biliI` | Bilirubin, indirect (Indirect bilirubin, Unconjugated bilirubin) | mg/dL | ≤ 0.8 | µmol/L ×0.05848 |
| `ast` | SGOT (AST) (AST, SGOT, Aspartate aminotransferase) | U/L | ≤ 40 |  |
| `alt` | SGPT (ALT) (ALT, SGPT, Alanine aminotransferase) | U/L | ≤ 40 |  |
| `alp` | Alkaline phosphatase (ALP, SAP) | U/L | 44–147 |  |
| `ggt` | GGT (Gamma GT, GGTP, Gamma-glutamyl transferase) | U/L | female ≤ 42, male ≤ 71 |  |
| `protein` | Total protein (S. protein, Serum protein) | g/dL | 6–8.3 | g/L ×0.1 |
| `albumin` | Albumin (S. albumin, Serum albumin) | g/dL | 3.5–5 | g/L ×0.1 |
| `globulin` | Globulin (S. globulin) | g/dL | 2–3.5 | g/L ×0.1 |
| `agRatio` | A/G ratio (Albumin globulin ratio, A:G ratio) | ratio | 1–2.1 |  |

**Kidney & electrolytes (RFT)**

| code | test (aliases) | unit | typical range | other units → multiply by |
|---|---|---|---|---|
| `urea` | Blood urea (Urea, S. urea) | mg/dL | 15–45 | mmol/L ×6.006 |
| `bun` | BUN (Blood urea nitrogen, Urea nitrogen) | mg/dL | 7–20 | mmol/L ×2.801 |
| `creat` | Creatinine (S. creatinine, Serum creatinine, Cr) | mg/dL | female 0.5–1.1, male 0.7–1.3 | µmol/L ×0.01131 |
| `egfr` | eGFR (GFR, Estimated GFR) | mL/min/1.73m² | ≥ 60 |  |
| `uric` | Uric acid (S. uric acid, Urate) | mg/dL | female 2.4–6, male 3.4–7 | µmol/L ×0.01681 |
| `na` | Sodium (Na, Na+, S. sodium) | mmol/L | 135–145 | mEq/L ×1 |
| `k` | Potassium (K, K+, S. potassium) | mmol/L | 3.5–5.1 | mEq/L ×1 |
| `cl` | Chloride (Cl, Cl-, S. chloride) | mmol/L | 98–107 | mEq/L ×1 |
| `hco3` | Bicarbonate (HCO3, Total CO2, TCO2) | mmol/L | 22–29 | mEq/L ×1 |
| `ca` | Calcium, total (Calcium, S. calcium, Ca) | mg/dL | 8.5–10.5 | mmol/L ×4.008 |
| `phos` | Phosphorus (Phosphate, S. phosphorus, PO4) | mg/dL | 2.5–4.5 | mmol/L ×3.097 |
| `mg` | Magnesium (Mg, S. magnesium) | mg/dL | 1.7–2.2 | mmol/L ×2.431 |

**Diabetes**

| code | test (aliases) | unit | typical range | other units → multiply by |
|---|---|---|---|---|
| `hba1c` | HbA1c (Glycated haemoglobin, Glycosylated haemoglobin, A1c) | % | ≤ 5.6 |  |
| `fbsLab` | Glucose, fasting (lab) (FBS, FBG, FPG, Fasting blood sugar, Fasting plasma glucose) | mg/dL | 70–100 | mmol/L ×18.02 |
| `ppbsLab` | Glucose, post-meal (lab) (PPBS, PPBG, PP sugar, Post prandial blood sugar) | mg/dL | 70–140 | mmol/L ×18.02 |
| `rbsLab` | Glucose, random (lab) (RBS, RBG, Random blood sugar) | mg/dL | 70–140 | mmol/L ×18.02 |

**Lipid profile**

| code | test (aliases) | unit | typical range | other units → multiply by |
|---|---|---|---|---|
| `chol` | Total cholesterol (Cholesterol, S. cholesterol, T. cholesterol) | mg/dL | ≤ 200 | mmol/L ×38.67 |
| `tg` | Triglycerides (TG, S. triglycerides) | mg/dL | ≤ 150 | mmol/L ×88.57 |
| `hdl` | HDL cholesterol (HDL, HDL-C) | mg/dL | female ≥ 50, male ≥ 40 | mmol/L ×38.67 |
| `ldl` | LDL cholesterol (LDL, LDL-C) | mg/dL | ≤ 100 | mmol/L ×38.67 |
| `vldl` | VLDL cholesterol (VLDL) | mg/dL | ≤ 30 | mmol/L ×38.67 |
| `nonHdl` | Non-HDL cholesterol (Non HDL, Non-HDL-C) | mg/dL | ≤ 130 | mmol/L ×38.67 |

**Thyroid**

| code | test (aliases) | unit | typical range | other units → multiply by |
|---|---|---|---|---|
| `tsh` | TSH (Thyroid stimulating hormone, S. TSH) | µIU/mL | 0.4–4.5 | mIU/L ×1 |
| `ft4` | Free T4 (FT4, Free thyroxine) | ng/dL | 0.8–1.8 | pmol/L ×0.0777 |
| `ft3` | Free T3 (FT3, Free triiodothyronine) | pg/mL | 2.3–4.2 | pmol/L ×0.651 |
| `t3` | Total T3 (T3, Triiodothyronine) | ng/dL | 80–200 | ng/mL ×100 |
| `t4` | Total T4 (T4, Thyroxine) | µg/dL | 5–12 |  |

**Vitamins & iron**

| code | test (aliases) | unit | typical range | other units → multiply by |
|---|---|---|---|---|
| `vitD` | Vitamin D (25-OH) (Vitamin D, Vit D, 25-hydroxy vitamin D, 25 OH D) | ng/mL | 30–100 | nmol/L ×0.4006 |
| `b12` | Vitamin B12 (B12, Cobalamin, Vit B12) | pg/mL | 200–900 | pmol/L ×1.355 |
| `folate` | Folate (Folic acid, S. folate) | ng/mL | 3–20 |  |
| `ferritin` | Ferritin (S. ferritin) | ng/mL | female 13–150, male 30–400 | µg/L ×1 |
| `iron` | Serum iron (Iron, S. iron, Fe) | µg/dL | 60–170 | µmol/L ×5.585 |
| `tibc` | TIBC (Total iron binding capacity) | µg/dL | 250–450 | µmol/L ×5.585 |
| `tsat` | Transferrin saturation (TSAT, Iron saturation, % saturation) | % | 20–50 |  |

**Inflammation & clotting**

| code | test (aliases) | unit | typical range | other units → multiply by |
|---|---|---|---|---|
| `crp` | CRP (C-reactive protein, CRP quantitative) | mg/L | ≤ 6 | mg/dL ×10 |
| `pt` | Prothrombin time (PT) | seconds | 11–13.5 |  |
| `inr` | INR (PT-INR, International normalised ratio) | ratio | 0.8–1.2 |  |
| `aptt` | aPTT (APTT, PTT, Activated partial thromboplastin time) | seconds | 25–35 |  |
| `ddimer` | D-dimer (D dimer) | µg/mL FEU | ≤ 0.5 | ng/mL FEU ×0.001, mg/L FEU ×1 |
| `ldh` | LDH (Lactate dehydrogenase, LD) | U/L | 140–280 |  |

<!-- LAB_CATALOG:END -->

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
    { "id": "e_4", "type": "labs", "timestamp": "2026-11-06T07:45:00+05:30", "lab": "Adyar Diagnostics",
      "results": [
        { "test": "hb", "value": 12.9, "refLow": 13, "refHigh": 17 },
        { "test": "plt", "value": 2.1 },
        { "test": "alt", "value": 46, "refHigh": 41 },
        { "test": "psa", "value": 0.8, "qualifier": "<" },
        { "test": "custom", "name": "Urine sugar", "text": "Nil" }
      ] },
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
- [ ] Lab `value`s are in the catalogue's canonical unit (platelets lakh/cumm, WBC/ANC cells/cumm); `<`/`>` went into `qualifier`; report ranges copied to `refLow`/`refHigh`; custom tests have a `name`; each result has `value` **or** `text`, never both.
- [ ] No ids repeated; every task `taskId` matches a `tasks[].id`.
- [ ] Every `skipped` task outcome has a `reason`; task `startDate` is not in the past without outcomes.
- [ ] Nothing was guessed. Unreadable or ambiguous items were left out or described in `note`, and listed to the user separately.
- [ ] If you can, validate against the schema and fix errors before replying.

The user imports the file in Medasium under **Import**, sees a preview, and chooses merge or replace.
