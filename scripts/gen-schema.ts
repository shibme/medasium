import { z } from 'zod';
import { writeFileSync, mkdirSync } from 'node:fs';
import { MedasiumExport } from '../src/model/schema';

type J = Record<string, any>;
const js = z.toJSONSchema(MedasiumExport, { target: 'draft-2020-12', io: 'input', unrepresentable: 'any' }) as J;

// zod refinements are not exported to JSON Schema, so add the important ones explicitly.
let patched = { bp: 0, skip: 0 };
(function walk(n: any) {
  if (Array.isArray(n)) return n.forEach(walk);
  if (!n || typeof n !== 'object') return;
  const p = n.properties;
  if (p?.metric && p?.diastolic) {
    n.allOf = [
      { if: { properties: { metric: { const: 'bloodPressure' } }, required: ['metric'] }, then: { required: ['diastolic'] } },
      { if: { properties: { metric: { not: { const: 'bloodPressure' } } }, required: ['metric'] }, then: { not: { required: ['diastolic'] } } },
    ];
    patched.bp++;
  }
  if (p?.outcome && p?.taskId && p?.reason) {
    n.if = { properties: { outcome: { const: 'skipped' } }, required: ['outcome'] };
    n.then = { required: ['reason'], properties: { reason: { minLength: 1 } } };
    patched.skip++;
  }
  Object.values(n).forEach(walk);
})(js);
if (patched.bp !== 1 || patched.skip !== 1) throw new Error(`schema patch failed: ${JSON.stringify(patched)}`);

js.$id = 'medasium.schema.json';
js.title = 'Medasium patient import/export file';
js.description =
  'One patient with profile, timeline entries and recurring tasks. India-first: IST (+05:30), mg/dL, °F, kg, cm, +91. ' +
  'Not expressible in JSON Schema (the app also checks): entry ids unique; task ids unique; every task entry taskId matches a tasks[].id. Agent guide: ../agent/AGENTS.md';
mkdirSync('public/schema', { recursive: true });
writeFileSync('public/schema/medasium.schema.json', JSON.stringify(js, null, 2) + '\n');
console.log('wrote public/schema/medasium.schema.json');
