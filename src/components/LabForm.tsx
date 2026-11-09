import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, History, Layers, Plus, Search, SlidersHorizontal, TriangleAlert, X } from 'lucide-react';
import { LAB_BY_CODE, LAB_PANELS, LAB_TESTS, catalogRange, fmtRange, type LabTest, type Range } from '@/model/labs';
import { LabResult, type LabsEntry } from '@/model/schema';
import { flagValue, fromCanonical, parseLabInput, searchCatalog, sortResults, toCanonical, type LabFlag } from '@/lib/labs';
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

type Q = '' | '<' | '>';
export interface LabRow {
  uid: string;
  test: string;          // catalogue code or 'custom'
  name: string;          // custom tests only
  unit: string;          // selected unit (catalogue: canonical or an alternate; custom: free text)
  input: string;         // value as typed, or text
  q: Q;                  // qualifier button
  textMode: boolean;     // loaded as a text result
  abnormal: boolean;     // text results only
  refLow: string;
  refHigh: string;
  showRange: boolean;
}

let seq = 0;
const rid = () => `r${++seq}`;
const PANEL_ORDER = Object.fromEntries(LAB_PANELS.map((p, i) => [p.id, i]));
const sig = (n: number) => String(Number(n.toPrecision(6)));
const isCustom = (r: LabRow) => r.test === 'custom';
const testOf = (r: LabRow): LabTest | undefined => (isCustom(r) ? undefined : LAB_BY_CODE[r.test]);

export function newRow(test: string, extra: Partial<LabRow> = {}): LabRow {
  const t = LAB_BY_CODE[test];
  return { uid: rid(), test, name: '', unit: t?.unit ?? '', input: '', q: '', textMode: false, abnormal: false, refLow: '', refHigh: '', showRange: false, ...extra };
}
export function rowsFromResults(results: LabResult[]): LabRow[] {
  return sortResults(results).map((r) => newRow(r.test, {
    name: r.name ?? '', unit: r.test === 'custom' ? r.unit ?? '' : LAB_BY_CODE[r.test]?.unit ?? '',
    input: r.text ?? (r.value !== undefined ? sig(r.value) : ''), q: r.qualifier ?? '', textMode: r.text !== undefined, abnormal: !!r.abnormal,
    refLow: r.refLow !== undefined ? sig(r.refLow) : '', refHigh: r.refHigh !== undefined ? sig(r.refHigh) : '',
    showRange: r.refLow !== undefined || r.refHigh !== undefined,
  }));
}

const parseBound = (s: string) => { if (!s.trim()) return undefined; const p = parseLabInput(s); return p && !p.qualifier ? p.value : NaN; };
/** Row range in the row's selected unit (report range if typed, else catalogue). */
function rowRange(r: LabRow, sex?: string): { range?: Range; fromReport: boolean } {
  const lo = parseBound(r.refLow), hi = parseBound(r.refHigh);
  if (lo !== undefined || hi !== undefined) return { range: { ...(lo !== undefined && !isNaN(lo) ? { lo } : {}), ...(hi !== undefined && !isNaN(hi) ? { hi } : {}) }, fromReport: true };
  const t = testOf(r);
  const g = t && catalogRange(t, sex);
  if (!g || !t) return { fromReport: false };
  const conv = (v?: number) => (v === undefined ? undefined : Number(fromCanonical(v, t, r.unit).toPrecision(4)));
  return { range: { ...(g.lo !== undefined ? { lo: conv(g.lo) } : {}), ...(g.hi !== undefined ? { hi: conv(g.hi) } : {}) }, fromReport: false };
}
function liveFlag(r: LabRow, sex?: string): LabFlag {
  if (!r.input.trim()) return null;
  const p = parseLabInput(r.input);
  if (!p) return (isCustom(r) || r.textMode) && r.abnormal ? 'abnormal' : null;
  return flagValue(p.value, p.qualifier ?? (r.q || undefined), rowRange(r, sex).range);
}
const rowName = (r: LabRow) => testOf(r)?.name ?? (r.name.trim() || 'Custom test');

/** Validate and convert rows to canonical lab results. Blank rows are ignored. */
export function buildResults(rows: LabRow[]): { results: LabResult[] } | { error: string } {
  const out: LabResult[] = [];
  for (const r of rows) {
    const t = testOf(r);
    const raw = r.input.trim();
    if (!raw) { if (isCustom(r) && r.name.trim()) return { error: `Enter a result for ${r.name.trim()}, or remove it.` }; continue; }
    if (isCustom(r) && !r.name.trim()) return { error: 'Give the custom test a name.' };
    const p = parseLabInput(raw);
    const res: Record<string, unknown> = { test: r.test };
    if (isCustom(r)) { res.name = r.name.trim(); if (r.unit.trim()) res.unit = r.unit.trim(); }
    if (p) {
      res.value = toCanonical(p.value, t, t ? r.unit : undefined);
      const q = p.qualifier ?? (r.q || undefined);
      if (q) res.qualifier = q;
      const lo = parseBound(r.refLow), hi = parseBound(r.refHigh);
      if (Number.isNaN(lo) || Number.isNaN(hi)) return { error: `Reference range for ${rowName(r)} must be plain numbers.` };
      if (lo !== undefined) res.refLow = toCanonical(lo, t, t ? r.unit : undefined);
      if (hi !== undefined) res.refHigh = toCanonical(hi, t, t ? r.unit : undefined);
      if (lo !== undefined && hi !== undefined && lo > hi) return { error: `Reference range for ${rowName(r)}: low is greater than high.` };
    } else if (isCustom(r) || r.textMode) {
      res.text = raw;
      if (r.abnormal) res.abnormal = true;
    } else {
      return { error: `“${raw}” is not a number for ${rowName(r)}. Use digits, e.g. 12.5, 1,50,000 or <0.01.` };
    }
    const ok = LabResult.safeParse(res);
    if (!ok.success) return { error: `${rowName(r)}: ${ok.error.issues[0].message}` };
    out.push(ok.data);
  }
  if (!out.length) return { error: 'Enter at least one result.' };
  return { results: out };
}

const FLAG_UI = {
  high: { label: 'High', icon: ArrowUp }, low: { label: 'Low', icon: ArrowDown }, abnormal: { label: 'Abnormal', icon: TriangleAlert },
} as const;

interface EditorProps {
  rows: LabRow[];
  setRows: (fn: (r: LabRow[]) => LabRow[]) => void;
  sex?: string;
  lastReport?: LabsEntry;
}

export function LabEditor({ rows, setRows, sex, lastReport }: EditorProps) {
  const [q, setQ] = useState('');
  const [focusUid, setFocusUid] = useState<string | null>(null);
  const valueRefs = useRef(new Map<string, HTMLInputElement>());
  useEffect(() => {
    if (!focusUid) return;
    const el = valueRefs.current.get(focusUid);
    if (el) { el.focus({ preventScroll: true }); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    setFocusUid(null);
  }, [focusUid, rows]);

  const present = new Set(rows.filter((r) => !isCustom(r)).map((r) => r.test));
  const hits = useMemo(() => searchCatalog(q, LAB_TESTS).slice(0, 6), [q]);
  const update = (uid: string, patch: Partial<LabRow>) => setRows((rs) => rs.map((r) => (r.uid === uid ? { ...r, ...patch } : r)));
  const addTest = (code: string) => {
    const existing = rows.find((r) => r.test === code);
    if (existing) { setFocusUid(existing.uid); return; }
    const row = newRow(code); setRows((rs) => [...rs, row]); setFocusUid(row.uid); setQ('');
  };
  const addCustom = (name: string) => { const row = newRow('custom', { name }); setRows((rs) => [...rs, row]); setFocusUid(row.uid); setQ(''); };
  const addPanel = (panel: string) => {
    const add = LAB_TESTS.filter((t) => t.panel === panel && t.preset && !present.has(t.code)).map((t) => newRow(t.code));
    if (add.length) { setRows((rs) => [...rs, ...add]); setFocusUid(add[0].uid); }
  };
  const repeatLast = () => {
    if (!lastReport) return;
    const add = rowsFromResults(lastReport.results).filter((r) => isCustom(r) ? !rows.some((x) => isCustom(x) && x.name.trim().toLowerCase() === r.name.trim().toLowerCase()) : !present.has(r.test))
      .map((r) => ({ ...r, input: '', q: '' as Q, abnormal: false }));
    if (add.length) { setRows((rs) => [...rs, ...add]); setFocusUid(add[0].uid); }
  };

  const groups = useMemo(() => {
    const m = new Map<string, LabRow[]>();
    for (const r of rows) { const p = isCustom(r) ? 'custom' : LAB_BY_CODE[r.test].panel; m.set(p, [...(m.get(p) ?? []), r]); }
    return [...m].sort((a, b) => PANEL_ORDER[a[0]] - PANEL_ORDER[b[0]]);
  }, [rows]);
  const filled = rows.filter((r) => r.input.trim()).length;
  const flagged = rows.filter((r) => liveFlag(r, sex)).length;

  return (
    <div className="grid grid-cols-1 gap-3">
      {/* Add tests */}
      <div className="grid grid-cols-1 gap-2 rounded-xl border bg-muted/40 p-2.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tests: CA-125, SGPT, platelets…" className="pl-9" aria-label="Search lab tests"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (hits[0]) addTest(hits[0].code); else if (q.trim()) addCustom(q.trim()); } }} />
        </div>
        {q.trim() && (
          <ul className="grid grid-cols-1 overflow-hidden rounded-lg border bg-card" role="listbox" aria-label="Matching tests">
            {hits.map((t) => (
              <li key={t.code}>
                <button type="button" role="option" aria-selected={false} onClick={() => addTest(t.code)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent">
                  <span className="min-w-0 flex-1"><span className="font-medium">{t.name}</span><span className="ml-1.5 truncate text-xs text-muted-foreground">{t.aliases.slice(0, 2).join(' · ')}</span></span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{present.has(t.code) ? 'Added' : LAB_PANELS.find((p) => p.id === t.panel)?.name}</span>
                </button>
              </li>
            ))}
            <li className="border-t">
              <button type="button" onClick={() => addCustom(q.trim())} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-primary outline-none hover:bg-accent focus-visible:bg-accent">
                <Plus className="size-4 shrink-0" /><span className="truncate">Add custom test “{q.trim()}”</span>
              </button>
            </li>
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button type="button" variant="outline" size="sm"><Layers />Add panel<ChevronDown className="opacity-60" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[15rem]">
              <DropdownMenuLabel>Adds the usual tests as empty rows</DropdownMenuLabel>
              {LAB_PANELS.filter((p) => p.id !== 'custom').map((p) => {
                const n = LAB_TESTS.filter((t) => t.panel === p.id && t.preset && !present.has(t.code)).length;
                return <DropdownMenuItem key={p.id} disabled={!n} onSelect={() => addPanel(p.id)}><span className="flex-1">{p.name}</span><span className="text-xs text-muted-foreground">{n ? `+${n}` : 'added'}</span></DropdownMenuItem>;
              })}
            </DropdownMenuContent>
          </DropdownMenu>
          {lastReport && <Button type="button" variant="outline" size="sm" onClick={repeatLast}><History />Repeat last report ({lastReport.results.length})</Button>}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">Search for a test, add a whole panel, or repeat the last report. Leave a row empty to skip it.</p>
      ) : (
        <div className="flex items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
          <span>{filled} of {rows.length} filled{flagged ? <> · <span className="font-semibold text-destructive">{flagged} out of range</span></> : null}</span>
          <button type="button" className="font-medium text-primary hover:underline" onClick={() => setRows((rs) => rs.filter((r) => r.input.trim()))}>Remove empty rows</button>
        </div>
      )}

      {groups.map(([panel, rs]) => (
        <section key={panel} className="grid grid-cols-1 gap-2">
          <h4 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{LAB_PANELS.find((p) => p.id === panel)?.name}</h4>
          {rs.map((r) => <Row key={r.uid} r={r} sex={sex} update={update} remove={() => setRows((x) => x.filter((y) => y.uid !== r.uid))} inputRef={(el) => { if (el) valueRefs.current.set(r.uid, el); else valueRefs.current.delete(r.uid); }} />)}
        </section>
      ))}
    </div>
  );
}

function Row({ r, sex, update, remove, inputRef }: { r: LabRow; sex?: string; update: (uid: string, p: Partial<LabRow>) => void; remove: () => void; inputRef: (el: HTMLInputElement | null) => void }) {
  const t = testOf(r);
  const custom = isCustom(r);
  const flag = liveFlag(r, sex);
  const { range, fromReport } = rowRange(r, sex);
  const typed = parseLabInput(r.input);
  const isText = !!r.input.trim() && !typed && (custom || r.textMode);
  const notNumber = !!r.input.trim() && !typed && !custom && !r.textMode;
  const units = t ? [t.unit, ...(t.alt?.map((a) => a.unit) ?? [])] : [];
  const unitLabel = r.unit;
  const F = flag ? FLAG_UI[flag] : null;
  return (
    <div className={cn('rounded-xl border bg-card p-2.5 transition-colors', flag && 'border-destructive/40 bg-destructive-soft/40')}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {custom ? (
            <Input value={r.name} onChange={(e) => update(r.uid, { name: e.target.value })} placeholder="Test name as printed" aria-label="Custom test name" className="h-9" />
          ) : (
            <>
              <div className="truncate text-sm font-semibold">{t!.name}</div>
              {t!.aliases.length > 0 && <div className="truncate text-[11px] text-muted-foreground">{t!.aliases.slice(0, 3).join(' · ')}</div>}
            </>
          )}
        </div>
        {F && <Badge variant="destructive" className="mt-1"><F.icon />{F.label}</Badge>}
        <Button type="button" size="icon-sm" variant="ghost" className="-mr-1 text-muted-foreground" onClick={remove} aria-label={`Remove ${rowName(r)}`}><X /></Button>
      </div>

      <div className="mt-2 flex gap-2">
        {!isText && (
          <button type="button" onClick={() => update(r.uid, { q: r.q === '' ? '<' : r.q === '<' ? '>' : '' })}
            aria-label={`Qualifier: ${r.q === '<' ? 'less than' : r.q === '>' ? 'greater than' : 'equals'}. Tap to change.`}
            className={cn('grid h-10 w-9 shrink-0 place-items-center rounded-lg border text-sm font-bold tabular-nums outline-none focus-visible:ring-[3px] focus-visible:ring-ring', r.q ? 'border-primary bg-accent text-accent-foreground' : 'text-muted-foreground')}>
            {r.q || '='}
          </button>
        )}
        <Input ref={inputRef} value={r.input} onChange={(e) => update(r.uid, { input: e.target.value })}
          inputMode={custom || r.textMode ? 'text' : 'decimal'} placeholder={custom ? 'Value or text, e.g. Negative' : 'Value'}
          aria-label={`${rowName(r)} result`} aria-invalid={notNumber || undefined} className="min-w-0 flex-1 tabular-nums" />
        {custom ? (
          !isText && <Input value={r.unit} onChange={(e) => update(r.uid, { unit: e.target.value })} placeholder="Unit" aria-label="Unit" className="w-24 shrink-0" />
        ) : units.length > 1 ? (
          <Select value={r.unit} onValueChange={(u) => update(r.uid, { unit: u })}>
            <SelectTrigger className="w-[7.75rem] shrink-0 px-2.5 text-xs" aria-label={`${rowName(r)} unit`}><SelectValue /></SelectTrigger>
            <SelectContent>{units.map((u) => <SelectItem key={u} value={u} hint={u === t!.unit ? 'standard' : undefined}>{u}</SelectItem>)}</SelectContent>
          </Select>
        ) : (
          <span className="grid h-10 shrink-0 place-items-center rounded-lg bg-muted px-2.5 text-xs font-medium text-muted-foreground">{unitLabel}</span>
        )}
      </div>

      {notNumber && <p className="mt-1.5 text-xs text-destructive">Not a number. Use digits, e.g. 12.5, 1,50,000 or &lt;0.01.</p>}
      {isText ? (
        <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={r.abnormal} onChange={(e) => update(r.uid, { abnormal: e.target.checked })} className="size-4 accent-[var(--color-destructive)]" />
          Report marks this abnormal <span className="ml-auto">Saved as text</span>
        </label>
      ) : (
        <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="min-w-0 truncate">{range ? `${fromReport ? 'Report range' : 'Ref'} ${fmtRange(range, unitLabel)}` : 'No reference range'}{!custom && r.unit !== t!.unit && typed ? ` · saved as ${sig(toCanonical(typed.value, t, r.unit))} ${t!.unit}` : ''}</span>
          <button type="button" className="inline-flex shrink-0 items-center gap-1 font-medium text-primary hover:underline" onClick={() => update(r.uid, { showRange: !r.showRange })} aria-expanded={r.showRange}>
            <SlidersHorizontal className="size-3" />{r.showRange ? 'Hide range' : 'Report range'}
          </button>
        </div>
      )}
      {r.showRange && !isText && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Input value={r.refLow} onChange={(e) => update(r.uid, { refLow: e.target.value })} inputMode="decimal" placeholder="Low" aria-label={`${rowName(r)} report range low`} />
          <Input value={r.refHigh} onChange={(e) => update(r.uid, { refHigh: e.target.value })} inputMode="decimal" placeholder="High" aria-label={`${rowName(r)} report range high`} />
        </div>
      )}
    </div>
  );
}

