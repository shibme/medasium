// Lab test catalogue: the single source of truth for lab names, canonical units, reference ranges and unit conversions.
// Ranges are typical adult reference intervals, inclusive at both ends (labs differ; a report's own range overrides these).
// Canonical units are India-first and use only WinAnsi characters so they render in the PDF export.

export const LAB_PANELS = [
  { id: 'tumour', name: 'Tumour markers' },
  { id: 'cbc', name: 'Blood count (CBC)' },
  { id: 'lft', name: 'Liver (LFT)' },
  { id: 'rft', name: 'Kidney & electrolytes (RFT)' },
  { id: 'diabetes', name: 'Diabetes' },
  { id: 'lipid', name: 'Lipid profile' },
  { id: 'thyroid', name: 'Thyroid' },
  { id: 'vitamins', name: 'Vitamins & iron' },
  { id: 'clotting', name: 'Inflammation & clotting' },
  { id: 'custom', name: 'Other tests' },
] as const;
export type PanelId = (typeof LAB_PANELS)[number]['id'];

export interface Range { lo?: number; hi?: number }
export interface AltUnit { unit: string; /** canonical = entered x factor */ factor: number }
export interface LabTest {
  code: string;
  name: string;
  /** Other names seen on Indian lab reports; used for search and by AI agents. */
  aliases: string[];
  panel: Exclude<PanelId, 'custom'>;
  unit: string;
  alt?: AltUnit[];
  range?: Range;
  rangeBy?: { female: Range; male: Range };
  /** Test only applies to one sex (informational). */
  sex?: 'male' | 'female';
  /** Added by the panel quick-add. */
  preset?: boolean;
}

const r = (lo?: number, hi?: number): Range => ({ ...(lo !== undefined ? { lo } : {}), ...(hi !== undefined ? { hi } : {}) });
const COUNT_ALT: AltUnit[] = [{ unit: '×10³/µL', factor: 1000 }, { unit: '×10⁹/L', factor: 1000 }, { unit: '/µL', factor: 1 }];
const MEQ: AltUnit[] = [{ unit: 'mEq/L', factor: 1 }];
const GLU: AltUnit[] = [{ unit: 'mmol/L', factor: 18.016 }];
const CHOL: AltUnit[] = [{ unit: 'mmol/L', factor: 38.67 }];

export const LAB_TESTS: LabTest[] = [
  // Tumour markers
  { code: 'ca199', name: 'CA 19-9', aliases: ['CA19.9', 'CA 19.9', 'CA19-9', 'Carbohydrate antigen 19-9'], panel: 'tumour', unit: 'U/mL', range: r(undefined, 37), preset: true },
  { code: 'ca125', name: 'CA-125', aliases: ['CA 125', 'CA125', 'Cancer antigen 125'], panel: 'tumour', unit: 'U/mL', range: r(undefined, 35), preset: true },
  { code: 'ca153', name: 'CA 15-3', aliases: ['CA15.3', 'CA 15.3', 'CA15-3'], panel: 'tumour', unit: 'U/mL', range: r(undefined, 30) },
  { code: 'cea', name: 'CEA', aliases: ['Carcinoembryonic antigen'], panel: 'tumour', unit: 'ng/mL', range: r(undefined, 5), preset: true },
  { code: 'afp', name: 'AFP', aliases: ['Alpha-fetoprotein', 'Alpha fetoprotein'], panel: 'tumour', unit: 'ng/mL', range: r(undefined, 10) },
  { code: 'psa', name: 'PSA, total', aliases: ['PSA', 'Total PSA', 'Prostate specific antigen'], panel: 'tumour', unit: 'ng/mL', range: r(undefined, 4), sex: 'male', preset: true },
  { code: 'psaFree', name: 'PSA, free', aliases: ['Free PSA', 'fPSA'], panel: 'tumour', unit: 'ng/mL', sex: 'male' },
  { code: 'bhcg', name: 'Beta-hCG', aliases: ['b-hCG', 'Beta HCG', 'hCG'], panel: 'tumour', unit: 'mIU/mL', range: r(undefined, 5) },

  // Complete blood count
  { code: 'hb', name: 'Haemoglobin', aliases: ['Hb', 'Hgb', 'Hemoglobin'], panel: 'cbc', unit: 'g/dL', alt: [{ unit: 'g/L', factor: 0.1 }], rangeBy: { female: r(12, 15.5), male: r(13, 17) }, preset: true },
  { code: 'rbc', name: 'RBC count', aliases: ['Red blood cells', 'Total RBC', 'Erythrocytes'], panel: 'cbc', unit: 'million/cumm', alt: [{ unit: '×10⁶/µL', factor: 1 }, { unit: '×10¹²/L', factor: 1 }], rangeBy: { female: r(3.8, 4.8), male: r(4.5, 5.5) }, preset: true },
  { code: 'hct', name: 'Haematocrit (PCV)', aliases: ['PCV', 'HCT', 'Hematocrit', 'Packed cell volume'], panel: 'cbc', unit: '%', rangeBy: { female: r(36, 46), male: r(40, 50) }, preset: true },
  { code: 'mcv', name: 'MCV', aliases: ['Mean corpuscular volume'], panel: 'cbc', unit: 'fL', range: r(80, 100), preset: true },
  { code: 'mch', name: 'MCH', aliases: ['Mean corpuscular haemoglobin'], panel: 'cbc', unit: 'pg', range: r(27, 32), preset: true },
  { code: 'mchc', name: 'MCHC', aliases: ['Mean corpuscular haemoglobin concentration'], panel: 'cbc', unit: 'g/dL', range: r(31.5, 34.5), preset: true },
  { code: 'rdw', name: 'RDW-CV', aliases: ['RDW', 'Red cell distribution width'], panel: 'cbc', unit: '%', range: r(11.6, 14), preset: true },
  { code: 'wbc', name: 'Total WBC count', aliases: ['TLC', 'TC', 'WBC', 'Total leucocyte count', 'Leukocytes'], panel: 'cbc', unit: 'cells/cumm', alt: COUNT_ALT, range: r(4000, 11000), preset: true },
  { code: 'neut', name: 'Neutrophils', aliases: ['Polymorphs', 'Neutrophil %'], panel: 'cbc', unit: '%', range: r(40, 75), preset: true },
  { code: 'lymph', name: 'Lymphocytes', aliases: ['Lymphocyte %'], panel: 'cbc', unit: '%', range: r(20, 40), preset: true },
  { code: 'mono', name: 'Monocytes', aliases: ['Monocyte %'], panel: 'cbc', unit: '%', range: r(2, 10), preset: true },
  { code: 'eos', name: 'Eosinophils', aliases: ['Eosinophil %'], panel: 'cbc', unit: '%', range: r(1, 6), preset: true },
  { code: 'baso', name: 'Basophils', aliases: ['Basophil %'], panel: 'cbc', unit: '%', range: r(undefined, 2), preset: true },
  { code: 'anc', name: 'Absolute neutrophil count', aliases: ['ANC', 'Absolute neutrophils'], panel: 'cbc', unit: 'cells/cumm', alt: COUNT_ALT, range: r(2000, 7000), preset: true },
  { code: 'alc', name: 'Absolute lymphocyte count', aliases: ['ALC', 'Absolute lymphocytes'], panel: 'cbc', unit: 'cells/cumm', alt: COUNT_ALT, range: r(1000, 3000) },
  { code: 'plt', name: 'Platelet count', aliases: ['Platelets', 'PLT', 'Thrombocytes'], panel: 'cbc', unit: 'lakh/cumm', alt: [{ unit: '×10³/µL', factor: 0.01 }, { unit: '×10⁹/L', factor: 0.01 }, { unit: '/cumm', factor: 0.00001 }], range: r(1.5, 4.5), preset: true },
  { code: 'esr', name: 'ESR', aliases: ['Erythrocyte sedimentation rate'], panel: 'cbc', unit: 'mm/hr', rangeBy: { female: r(undefined, 20), male: r(undefined, 15) }, preset: true },

  // Liver function
  { code: 'biliT', name: 'Bilirubin, total', aliases: ['Total bilirubin', 'S. bilirubin', 'TBIL'], panel: 'lft', unit: 'mg/dL', alt: [{ unit: 'µmol/L', factor: 1 / 17.1 }], range: r(undefined, 1.2), preset: true },
  { code: 'biliD', name: 'Bilirubin, direct', aliases: ['Direct bilirubin', 'Conjugated bilirubin', 'DBIL'], panel: 'lft', unit: 'mg/dL', alt: [{ unit: 'µmol/L', factor: 1 / 17.1 }], range: r(undefined, 0.3), preset: true },
  { code: 'biliI', name: 'Bilirubin, indirect', aliases: ['Indirect bilirubin', 'Unconjugated bilirubin'], panel: 'lft', unit: 'mg/dL', alt: [{ unit: 'µmol/L', factor: 1 / 17.1 }], range: r(undefined, 0.8), preset: true },
  { code: 'ast', name: 'SGOT (AST)', aliases: ['AST', 'SGOT', 'Aspartate aminotransferase'], panel: 'lft', unit: 'U/L', range: r(undefined, 40), preset: true },
  { code: 'alt', name: 'SGPT (ALT)', aliases: ['ALT', 'SGPT', 'Alanine aminotransferase'], panel: 'lft', unit: 'U/L', range: r(undefined, 40), preset: true },
  { code: 'alp', name: 'Alkaline phosphatase', aliases: ['ALP', 'SAP'], panel: 'lft', unit: 'U/L', range: r(44, 147), preset: true },
  { code: 'ggt', name: 'GGT', aliases: ['Gamma GT', 'GGTP', 'Gamma-glutamyl transferase'], panel: 'lft', unit: 'U/L', rangeBy: { female: r(undefined, 42), male: r(undefined, 71) }, preset: true },
  { code: 'protein', name: 'Total protein', aliases: ['S. protein', 'Serum protein'], panel: 'lft', unit: 'g/dL', alt: [{ unit: 'g/L', factor: 0.1 }], range: r(6, 8.3), preset: true },
  { code: 'albumin', name: 'Albumin', aliases: ['S. albumin', 'Serum albumin'], panel: 'lft', unit: 'g/dL', alt: [{ unit: 'g/L', factor: 0.1 }], range: r(3.5, 5), preset: true },
  { code: 'globulin', name: 'Globulin', aliases: ['S. globulin'], panel: 'lft', unit: 'g/dL', alt: [{ unit: 'g/L', factor: 0.1 }], range: r(2, 3.5), preset: true },
  { code: 'agRatio', name: 'A/G ratio', aliases: ['Albumin globulin ratio', 'A:G ratio'], panel: 'lft', unit: 'ratio', range: r(1, 2.1), preset: true },

  // Kidney function and electrolytes
  { code: 'urea', name: 'Blood urea', aliases: ['Urea', 'S. urea'], panel: 'rft', unit: 'mg/dL', alt: [{ unit: 'mmol/L', factor: 6.006 }], range: r(15, 45), preset: true },
  { code: 'bun', name: 'BUN', aliases: ['Blood urea nitrogen', 'Urea nitrogen'], panel: 'rft', unit: 'mg/dL', alt: [{ unit: 'mmol/L', factor: 2.801 }], range: r(7, 20) },
  { code: 'creat', name: 'Creatinine', aliases: ['S. creatinine', 'Serum creatinine', 'Cr'], panel: 'rft', unit: 'mg/dL', alt: [{ unit: 'µmol/L', factor: 1 / 88.4 }], rangeBy: { female: r(0.5, 1.1), male: r(0.7, 1.3) }, preset: true },
  { code: 'egfr', name: 'eGFR', aliases: ['GFR', 'Estimated GFR'], panel: 'rft', unit: 'mL/min/1.73m²', range: r(60), preset: true },
  { code: 'uric', name: 'Uric acid', aliases: ['S. uric acid', 'Urate'], panel: 'rft', unit: 'mg/dL', alt: [{ unit: 'µmol/L', factor: 1 / 59.48 }], rangeBy: { female: r(2.4, 6), male: r(3.4, 7) }, preset: true },
  { code: 'na', name: 'Sodium', aliases: ['Na', 'Na+', 'S. sodium'], panel: 'rft', unit: 'mmol/L', alt: MEQ, range: r(135, 145), preset: true },
  { code: 'k', name: 'Potassium', aliases: ['K', 'K+', 'S. potassium'], panel: 'rft', unit: 'mmol/L', alt: MEQ, range: r(3.5, 5.1), preset: true },
  { code: 'cl', name: 'Chloride', aliases: ['Cl', 'Cl-', 'S. chloride'], panel: 'rft', unit: 'mmol/L', alt: MEQ, range: r(98, 107), preset: true },
  { code: 'hco3', name: 'Bicarbonate', aliases: ['HCO3', 'Total CO2', 'TCO2'], panel: 'rft', unit: 'mmol/L', alt: MEQ, range: r(22, 29) },
  { code: 'ca', name: 'Calcium, total', aliases: ['Calcium', 'S. calcium', 'Ca'], panel: 'rft', unit: 'mg/dL', alt: [{ unit: 'mmol/L', factor: 4.008 }], range: r(8.5, 10.5) },
  { code: 'phos', name: 'Phosphorus', aliases: ['Phosphate', 'S. phosphorus', 'PO4'], panel: 'rft', unit: 'mg/dL', alt: [{ unit: 'mmol/L', factor: 3.097 }], range: r(2.5, 4.5) },
  { code: 'mg', name: 'Magnesium', aliases: ['Mg', 'S. magnesium'], panel: 'rft', unit: 'mg/dL', alt: [{ unit: 'mmol/L', factor: 2.431 }], range: r(1.7, 2.2) },

  // Diabetes (lab values; glucometer readings belong in vitals)
  { code: 'hba1c', name: 'HbA1c', aliases: ['Glycated haemoglobin', 'Glycosylated haemoglobin', 'A1c'], panel: 'diabetes', unit: '%', range: r(undefined, 5.6), preset: true },
  { code: 'fbsLab', name: 'Glucose, fasting (lab)', aliases: ['FBS', 'FBG', 'FPG', 'Fasting blood sugar', 'Fasting plasma glucose'], panel: 'diabetes', unit: 'mg/dL', alt: GLU, range: r(70, 100), preset: true },
  { code: 'ppbsLab', name: 'Glucose, post-meal (lab)', aliases: ['PPBS', 'PPBG', 'PP sugar', 'Post prandial blood sugar'], panel: 'diabetes', unit: 'mg/dL', alt: GLU, range: r(70, 140), preset: true },
  { code: 'rbsLab', name: 'Glucose, random (lab)', aliases: ['RBS', 'RBG', 'Random blood sugar'], panel: 'diabetes', unit: 'mg/dL', alt: GLU, range: r(70, 140) },

  // Lipid profile
  { code: 'chol', name: 'Total cholesterol', aliases: ['Cholesterol', 'S. cholesterol', 'T. cholesterol'], panel: 'lipid', unit: 'mg/dL', alt: CHOL, range: r(undefined, 200), preset: true },
  { code: 'tg', name: 'Triglycerides', aliases: ['TG', 'S. triglycerides'], panel: 'lipid', unit: 'mg/dL', alt: [{ unit: 'mmol/L', factor: 88.57 }], range: r(undefined, 150), preset: true },
  { code: 'hdl', name: 'HDL cholesterol', aliases: ['HDL', 'HDL-C'], panel: 'lipid', unit: 'mg/dL', alt: CHOL, rangeBy: { female: r(50), male: r(40) }, preset: true },
  { code: 'ldl', name: 'LDL cholesterol', aliases: ['LDL', 'LDL-C'], panel: 'lipid', unit: 'mg/dL', alt: CHOL, range: r(undefined, 100), preset: true },
  { code: 'vldl', name: 'VLDL cholesterol', aliases: ['VLDL'], panel: 'lipid', unit: 'mg/dL', alt: CHOL, range: r(undefined, 30), preset: true },
  { code: 'nonHdl', name: 'Non-HDL cholesterol', aliases: ['Non HDL', 'Non-HDL-C'], panel: 'lipid', unit: 'mg/dL', alt: CHOL, range: r(undefined, 130), preset: true },

  // Thyroid
  { code: 'tsh', name: 'TSH', aliases: ['Thyroid stimulating hormone', 'S. TSH'], panel: 'thyroid', unit: 'µIU/mL', alt: [{ unit: 'mIU/L', factor: 1 }], range: r(0.4, 4.5), preset: true },
  { code: 'ft4', name: 'Free T4', aliases: ['FT4', 'Free thyroxine'], panel: 'thyroid', unit: 'ng/dL', alt: [{ unit: 'pmol/L', factor: 1 / 12.87 }], range: r(0.8, 1.8), preset: true },
  { code: 'ft3', name: 'Free T3', aliases: ['FT3', 'Free triiodothyronine'], panel: 'thyroid', unit: 'pg/mL', alt: [{ unit: 'pmol/L', factor: 1 / 1.536 }], range: r(2.3, 4.2), preset: true },
  { code: 't3', name: 'Total T3', aliases: ['T3', 'Triiodothyronine'], panel: 'thyroid', unit: 'ng/dL', alt: [{ unit: 'ng/mL', factor: 100 }], range: r(80, 200) },
  { code: 't4', name: 'Total T4', aliases: ['T4', 'Thyroxine'], panel: 'thyroid', unit: 'µg/dL', range: r(5, 12) },

  // Vitamins and iron studies
  { code: 'vitD', name: 'Vitamin D (25-OH)', aliases: ['Vitamin D', 'Vit D', '25-hydroxy vitamin D', '25 OH D'], panel: 'vitamins', unit: 'ng/mL', alt: [{ unit: 'nmol/L', factor: 0.4006 }], range: r(30, 100), preset: true },
  { code: 'b12', name: 'Vitamin B12', aliases: ['B12', 'Cobalamin', 'Vit B12'], panel: 'vitamins', unit: 'pg/mL', alt: [{ unit: 'pmol/L', factor: 1.355 }], range: r(200, 900), preset: true },
  { code: 'folate', name: 'Folate', aliases: ['Folic acid', 'S. folate'], panel: 'vitamins', unit: 'ng/mL', range: r(3, 20) },
  { code: 'ferritin', name: 'Ferritin', aliases: ['S. ferritin'], panel: 'vitamins', unit: 'ng/mL', alt: [{ unit: 'µg/L', factor: 1 }], rangeBy: { female: r(13, 150), male: r(30, 400) }, preset: true },
  { code: 'iron', name: 'Serum iron', aliases: ['Iron', 'S. iron', 'Fe'], panel: 'vitamins', unit: 'µg/dL', alt: [{ unit: 'µmol/L', factor: 5.585 }], range: r(60, 170), preset: true },
  { code: 'tibc', name: 'TIBC', aliases: ['Total iron binding capacity'], panel: 'vitamins', unit: 'µg/dL', alt: [{ unit: 'µmol/L', factor: 5.585 }], range: r(250, 450), preset: true },
  { code: 'tsat', name: 'Transferrin saturation', aliases: ['TSAT', 'Iron saturation', '% saturation'], panel: 'vitamins', unit: '%', range: r(20, 50), preset: true },

  // Inflammation, clotting and other enzymes
  { code: 'crp', name: 'CRP', aliases: ['C-reactive protein', 'CRP quantitative'], panel: 'clotting', unit: 'mg/L', alt: [{ unit: 'mg/dL', factor: 10 }], range: r(undefined, 6), preset: true },
  { code: 'pt', name: 'Prothrombin time', aliases: ['PT'], panel: 'clotting', unit: 'seconds', range: r(11, 13.5), preset: true },
  { code: 'inr', name: 'INR', aliases: ['PT-INR', 'International normalised ratio'], panel: 'clotting', unit: 'ratio', range: r(0.8, 1.2), preset: true },
  { code: 'aptt', name: 'aPTT', aliases: ['APTT', 'PTT', 'Activated partial thromboplastin time'], panel: 'clotting', unit: 'seconds', range: r(25, 35), preset: true },
  { code: 'ddimer', name: 'D-dimer', aliases: ['D dimer'], panel: 'clotting', unit: 'µg/mL FEU', alt: [{ unit: 'ng/mL FEU', factor: 0.001 }, { unit: 'mg/L FEU', factor: 1 }], range: r(undefined, 0.5) },
  { code: 'ldh', name: 'LDH', aliases: ['Lactate dehydrogenase', 'LD'], panel: 'clotting', unit: 'U/L', range: r(140, 280) },
];

export const LAB_CODES = LAB_TESTS.map((t) => t.code) as [string, ...string[]];
export const LAB_BY_CODE: Record<string, LabTest> = Object.fromEntries(LAB_TESTS.map((t) => [t.code, t]));
export const panelName = (id: string) => LAB_PANELS.find((p) => p.id === id)?.name ?? 'Other tests';

/** Catalogue range for a patient's sex; unknown/other uses the widest (union) range so nothing is falsely flagged. */
export function catalogRange(t: LabTest, sex?: string): Range | undefined {
  if (t.range) return t.range;
  if (!t.rangeBy) return undefined;
  if (sex === 'female') return t.rangeBy.female;
  if (sex === 'male') return t.rangeBy.male;
  const f = t.rangeBy.female, m = t.rangeBy.male;
  return r(f.lo === undefined || m.lo === undefined ? undefined : Math.min(f.lo, m.lo), f.hi === undefined || m.hi === undefined ? undefined : Math.max(f.hi, m.hi));
}
export const fmtRange = (g?: Range, unit?: string) => {
  if (!g || (g.lo === undefined && g.hi === undefined)) return '';
  const u = unit && unit !== 'ratio' ? ` ${unit}` : '';
  if (g.lo !== undefined && g.hi !== undefined) return `${g.lo}–${g.hi}${u}`;
  return g.lo !== undefined ? `≥ ${g.lo}${u}` : `≤ ${g.hi}${u}`;
};
