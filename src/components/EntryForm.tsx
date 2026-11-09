import { useEffect, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { getBundle, putEntry } from '@/db';
import type { Entry, LabsEntry, Reading } from '@/model/schema';
import { APPOINTMENT_KIND, APPOINTMENT_STATUS, MEDICATION_STATUS, PHOTO_CATEGORY, SEVERITY } from '@/model/schema';
import { nowIst, uid } from '@/lib/format';
import { UNITS } from '@/lib/ranges';
import { compressImage } from '@/lib/storage';
import { cn } from '@/lib/utils';
import { ResponsiveDialog } from './ResponsiveDialog';
import { FORM_TYPES, TYPE_META, type FormType } from './entryMeta';
import { LabEditor, buildResults, rowsFromResults, type LabRow } from './LabForm';
import { Button } from './ui/button';
import { Input, InputSuffix, Textarea } from './ui/input';
import { Field } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useToast } from './ui';

export { TYPE_META } from './entryMeta';
export type { FormType } from './entryMeta';

const LABEL_KIND: Record<string, string> = { doctorVisit: 'Doctor visit', test: 'Test', hospitalStay: 'Hospital stay', other: 'Other' };
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
// datetime-local values are treated as IST (+05:30).
const toInput = (iso: string) => new Date(iso).toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' }).slice(0, 16).replace(' ', 'T');
const fromInput = (v: string) => `${v}:00+05:30`;
const num = (s: string) => (s.trim() === '' || isNaN(Number(s)) ? undefined : Number(s));

function Pick({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: readonly string[] | [string, string][]; label?: (v: string) => string }) {
  const opts = (options as (string | [string, string])[]).map((o) => (Array.isArray(o) ? o : [o, label ? label(o) : cap(o)]));
  return (
    <Select value={value || '__none'} onValueChange={(v) => onChange(v === '__none' ? '' : v)}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>{opts.map(([v, l]) => <SelectItem key={v} value={v || '__none'}>{l}</SelectItem>)}</SelectContent>
    </Select>
  );
}

interface Props { patientId: string; entry?: Entry; initialType?: FormType; onClose: () => void; onSaved: () => void }

export function EntryForm({ patientId, entry, initialType, onClose, onSaved }: Props) {
  const toast = useToast();
  const [type, setType] = useState<FormType>((entry && entry.type !== 'task' ? entry.type : initialType) ?? 'vitals');
  const [when, setWhen] = useState(toInput(entry?.timestamp ?? nowIst()));
  const [note, setNote] = useState(entry?.note ?? '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const e = entry as any;
  const rv = (m: string, k: 'value' | 'diastolic' | 'context') => (e?.type === 'vitals' ? e.readings.find((r: Reading) => r.metric === m)?.[k] : undefined);
  const s0 = (x: unknown) => (x === undefined ? '' : String(x));
  const [v, setV] = useState<Record<string, string>>({
    sys: s0(rv('bloodPressure', 'value')), dia: s0(rv('bloodPressure', 'diastolic')), glucose: s0(rv('glucose', 'value')), weight: s0(rv('weight', 'value')),
    temperature: s0(rv('temperature', 'value')), pulse: s0(rv('pulse', 'value')), spo2: s0(rv('spo2', 'value')), respiratoryRate: s0(rv('respiratoryRate', 'value')),
  });
  const [gctx, setGctx] = useState<string>(rv('glucose', 'context') ?? 'fasting');
  const [f, setF] = useState({
    name: e?.name ?? '', dose: e?.dose ?? '', status: e?.status ?? 'taken', reason: e?.reason ?? '',
    text: e?.text ?? '', severity: e?.severity ?? '', title: e?.title ?? '', kind: e?.kind ?? 'doctorVisit', provider: e?.provider ?? '',
    outcome: e?.outcome ?? '', category: e?.category ?? 'report', caption: e?.caption ?? '', image: e?.image ?? '',
  });
  const set = (k: keyof typeof f, val: string) => setF((p) => ({ ...p, [k]: val }));
  // Lab results
  const [labRows, setLabRowsState] = useState<LabRow[]>(() => (e?.type === 'labs' ? rowsFromResults(e.results) : []));
  const setLabRows = (fn: (r: LabRow[]) => LabRow[]) => setLabRowsState(fn);
  const [labName, setLabName] = useState<string>(e?.type === 'labs' ? e.lab ?? '' : '');
  const [ctx, setCtx] = useState<{ sex?: string; labNames: string[]; last?: LabsEntry }>({ labNames: [] });
  useEffect(() => {
    let live = true;
    getBundle(patientId).then((b) => {
      if (!live || !b) return;
      const labs = b.entries.filter((x): x is LabsEntry => x.type === 'labs' && x.id !== entry?.id).sort((a, c) => c.timestamp.localeCompare(a.timestamp));
      setCtx({ sex: b.patient.sex, labNames: [...new Set(labs.map((x) => x.lab).filter(Boolean) as string[])], last: labs[0] });
    });
    return () => { live = false; };
  }, [patientId, entry?.id]);
  const chType = (t: FormType) => { setType(t); setErr(''); if (t === 'appointment') set('status', 'scheduled'); if (t === 'medication') set('status', 'taken'); };

  async function save() {
    setErr('');
    if (!when) return setErr('Please set a date and time.');
    const base = { id: entry?.id ?? uid(), timestamp: fromInput(when), ...(note.trim() ? { note: note.trim() } : {}), ...(entry ? { editedAt: nowIst() } : {}) };
    let out: Entry;
    if (type === 'vitals') {
      const rs: Reading[] = [];
      const s = num(v.sys), d = num(v.dia);
      if (s !== undefined || d !== undefined) {
        if (s === undefined || d === undefined) return setErr('Enter both the upper (systolic) and lower (diastolic) blood pressure.');
        rs.push({ metric: 'bloodPressure', value: s, diastolic: d });
      }
      if (num(v.glucose) !== undefined) rs.push({ metric: 'glucose', value: num(v.glucose)!, context: gctx as Reading['context'] });
      for (const m of ['weight', 'temperature', 'pulse', 'spo2', 'respiratoryRate'] as const) if (num(v[m]) !== undefined) rs.push({ metric: m, value: num(v[m])! });
      if (!rs.length) return setErr('Enter at least one reading.');
      out = { ...base, type: 'vitals', readings: rs };
    } else if (type === 'labs') {
      const b = buildResults(labRows);
      if ('error' in b) return setErr(b.error);
      out = { ...base, type: 'labs', ...(labName.trim() ? { lab: labName.trim() } : {}), results: b.results };
    } else if (type === 'medication') {
      if (!f.name.trim()) return setErr('Enter the medicine name.');
      out = { ...base, type: 'medication', name: f.name.trim(), ...(f.dose.trim() ? { dose: f.dose.trim() } : {}), status: f.status, ...(f.status !== 'taken' && f.reason.trim() ? { reason: f.reason.trim() } : {}) };
    } else if (type === 'observation') {
      if (!f.text.trim()) return setErr('Describe the symptom or observation.');
      out = { ...base, type: 'observation', text: f.text.trim(), ...(f.severity ? { severity: f.severity } : {}) } as Entry;
    } else if (type === 'appointment') {
      if (!f.title.trim()) return setErr('Enter a title.');
      out = { ...base, type: 'appointment', title: f.title.trim(), kind: f.kind, status: f.status, ...(f.provider.trim() ? { provider: f.provider.trim() } : {}), ...(f.outcome.trim() ? { outcome: f.outcome.trim() } : {}) } as Entry;
    } else {
      if (!f.image) return setErr('Choose a photo.');
      out = { ...base, type: 'photo', category: f.category, ...(f.caption.trim() ? { caption: f.caption.trim() } : {}), image: f.image } as Entry;
    }
    setBusy(true);
    try { await putEntry(patientId, out); toast(entry ? 'Entry updated' : 'Entry saved'); onSaved(); }
    catch (x) { setErr(x instanceof DOMException && x.name === 'QuotaExceededError' ? 'Browser storage is full. Export a backup and free up space.' : String(x)); setBusy(false); }
  }
  async function pickPhoto(file?: File) {
    if (!file) return;
    try { set('image', await compressImage(file)); setErr(''); } catch (x) { setErr((x as Error).message); }
  }
  const M = (m: string, label: string, ph: string, step = '1') => (
    <Field label={label}><InputSuffix suffix={UNITS[m as keyof typeof UNITS]} inputMode="decimal" type="number" step={step} value={v[m]} placeholder={ph} onChange={(ev) => setV({ ...v, [m]: ev.target.value })} /></Field>
  );

  return (
    <ResponsiveDialog title={entry ? `Edit ${TYPE_META[type].label.toLowerCase()}` : 'Add entry'} onClose={onClose}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={busy} onClick={save} className="min-w-28">{entry ? 'Save changes' : 'Save entry'}</Button></>}>
      <div className="grid grid-cols-1 gap-4">
        {!entry && (
          <div role="radiogroup" aria-label="Entry type" className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
            {FORM_TYPES.map((t) => {
              const { icon: I, short, tint } = TYPE_META[t];
              const on = t === type;
              return (
                <button key={t} role="radio" aria-checked={on} onClick={() => chType(t)}
                  className={cn('flex min-w-0 flex-col items-center gap-1 rounded-xl border px-1 py-2 text-[11px] font-semibold text-muted-foreground transition-all outline-none focus-visible:ring-[3px] focus-visible:ring-ring', on ? 'border-primary bg-accent text-foreground ring-1 ring-primary' : 'hover:bg-muted')}>
                  <span className={cn('grid size-8 place-items-center rounded-lg', tint)}><I className="size-[18px]" /></span>
                  <span className="truncate">{short}</span>
                </button>
              );
            })}
          </div>
        )}
        {type === 'labs' ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Sample collected (IST)"><Input type="datetime-local" value={when} onChange={(ev) => setWhen(ev.target.value)} /></Field>
            <Field label="Lab or hospital (optional)">
              <Input value={labName} onChange={(ev) => setLabName(ev.target.value)} list="lab-names" placeholder="e.g. Adyar Diagnostics" autoComplete="off" />
            </Field>
            <datalist id="lab-names">{ctx.labNames.map((n) => <option key={n} value={n} />)}</datalist>
          </div>
        ) : (
          <Field label="Date and time (IST)"><Input type="datetime-local" value={when} onChange={(ev) => setWhen(ev.target.value)} /></Field>
        )}

        {type === 'labs' && <LabEditor rows={labRows} setRows={setLabRows} sex={ctx.sex} lastReport={ctx.last} />}

        {type === 'vitals' && <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="BP upper (systolic)"><InputSuffix suffix="mmHg" inputMode="numeric" type="number" value={v.sys} placeholder="120" onChange={(ev) => setV({ ...v, sys: ev.target.value })} /></Field>
            <Field label="BP lower (diastolic)"><InputSuffix suffix="mmHg" inputMode="numeric" type="number" value={v.dia} placeholder="80" onChange={(ev) => setV({ ...v, dia: ev.target.value })} /></Field>
            {M('glucose', 'Blood sugar', '110')}
            <Field label="Sugar taken"><Pick value={gctx} onChange={setGctx} options={[['fasting', 'Fasting'], ['postMeal', '2 h after meal'], ['random', 'Random']]} /></Field>
            {M('pulse', 'Pulse', '76')}{M('spo2', 'SpO₂', '98')}
            {M('temperature', 'Temperature', '98.6', '0.1')}{M('weight', 'Weight', '62', '0.1')}
            {M('respiratoryRate', 'Breathing rate', '16')}
          </div>
        </>}

        {type === 'medication' && <>
          <Field label="Medicine"><Input value={f.name} onChange={(ev) => set('name', ev.target.value)} placeholder="Metformin 500 mg" /></Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Dose"><Input value={f.dose} onChange={(ev) => set('dose', ev.target.value)} placeholder="1 tablet after food" /></Field>
            <Field label="What happened"><Pick value={f.status} onChange={(x) => set('status', x)} options={MEDICATION_STATUS} /></Field>
          </div>
          {f.status !== 'taken' && <Field label="Reason"><Input value={f.reason} onChange={(ev) => set('reason', ev.target.value)} placeholder="Why was it not taken?" /></Field>}
        </>}

        {type === 'observation' && <>
          <Field label="Symptom or observation"><Textarea rows={4} value={f.text} onChange={(ev) => set('text', ev.target.value)} placeholder="How did the patient feel? What was observed?" /></Field>
          <Field label="Severity"><Pick value={f.severity} onChange={(x) => set('severity', x)} options={[['', 'Not set'], ...SEVERITY.map((s) => [s, cap(s)] as [string, string])]} /></Field>
        </>}

        {type === 'appointment' && <>
          <Field label="Title"><Input value={f.title} onChange={(ev) => set('title', ev.target.value)} placeholder="Cardiology review" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kind"><Pick value={f.kind} onChange={(x) => set('kind', x)} options={APPOINTMENT_KIND} label={(k) => LABEL_KIND[k]} /></Field>
            <Field label="Status"><Pick value={f.status} onChange={(x) => set('status', x)} options={APPOINTMENT_STATUS} /></Field>
          </div>
          <Field label="Doctor, lab or hospital"><Input value={f.provider} onChange={(ev) => set('provider', ev.target.value)} /></Field>
          <Field label="Outcome"><Textarea value={f.outcome} onChange={(ev) => set('outcome', ev.target.value)} placeholder="Advice, results or diagnosis as written" /></Field>
        </>}

        {type === 'photo' && <>
          <label className="grid cursor-pointer place-items-center gap-2 overflow-hidden rounded-xl border-2 border-dashed p-4 text-center text-sm text-muted-foreground transition-colors hover:border-primary hover:bg-accent/50">
            {f.image ? <img src={f.image} alt="Preview" className="max-h-56 rounded-lg object-contain" /> : <><ImagePlus className="size-8 text-primary" /><span><b className="text-foreground">Choose a photo</b><br />Resized and compressed automatically</span></>}
            <input type="file" accept="image/*" className="sr-only" onChange={(ev) => pickPhoto(ev.target.files?.[0])} />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Category"><Pick value={f.category} onChange={(x) => set('category', x)} options={PHOTO_CATEGORY} /></Field>
            <Field label="Caption"><Input value={f.caption} onChange={(ev) => set('caption', ev.target.value)} /></Field>
          </div>
        </>}

        <Field label="Note (optional)"><Input value={note} onChange={(ev) => setNote(ev.target.value)} /></Field>
        {err && <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive-soft px-3 py-2 text-sm text-destructive">{err}</div>}
      </div>
    </ResponsiveDialog>
  );
}
