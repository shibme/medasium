import { MedasiumExport } from '../model/schema';

export type ParseResult = { ok: true; data: MedasiumExport } | { ok: false; error: string };
const MAX_BYTES = 40 * 1024 * 1024;

export async function parseImport(file: File): Promise<ParseResult> {
  if (file.size > MAX_BYTES) return { ok: false, error: 'This file is too large to be a Medasium export.' };
  let raw: unknown;
  try { raw = JSON.parse(await file.text()); }
  catch { return { ok: false, error: 'This is not a valid JSON file. Only Medasium JSON files can be imported (PDF and SQLite are export-only).' }; }
  return parseImportData(raw);
}
export function parseImportData(raw: unknown): ParseResult {
  if (!raw || typeof raw !== 'object' || (raw as { format?: unknown }).format !== 'medasium')
    return { ok: false, error: 'This file is not a Medasium export (missing "format": "medasium"). Nothing was changed.' };
  const r = MedasiumExport.safeParse(raw);
  if (r.success) return { ok: true, data: r.data };
  const lines = r.error.issues.slice(0, 6).map((i) => `• ${i.path.join('.') || '(root)'}: ${i.message}`);
  const more = r.error.issues.length > 6 ? `\n…and ${r.error.issues.length - 6} more problems.` : '';
  return { ok: false, error: `This Medasium file has problems. Nothing was changed.\n${lines.join('\n')}${more}` };
}
