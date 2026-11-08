import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Check, Copy, ExternalLink, FileJson, FileUp, FlaskConical, Sparkles, TriangleAlert } from 'lucide-react';
import { applyImport, previewImport, type ImportPreview } from '@/db';
import { PageHeader, useToast } from '@/components/ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { parseImport } from '@/lib/importer';
import { cn } from '@/lib/utils';
import type { MedasiumExport } from '@/model/schema';
import { useStore } from '@/store';

const base = () => location.href.split('#')[0].replace(/[^/]*$/, '');
const URLS = () => ({ agent: base() + 'agent/AGENTS.md', schema: base() + 'schema/medasium.schema.json', sample: base() + 'samples/sample-patient.json' });

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <Button size="sm" variant="outline" onClick={() => navigator.clipboard?.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1500); })} aria-label={`${label} to clipboard`}>
      {ok ? <Check className="text-success" /> : <Copy />}<span className="hidden sm:inline">{ok ? 'Copied' : label}</span>
    </Button>
  );
}
function Stat({ n, label, tone }: { n: number; label: string; tone?: string }) {
  return <div className="min-w-0 rounded-lg bg-muted px-2 py-2 text-center"><div className={cn('text-lg font-bold tabular-nums', tone)}>{n}</div><div className="truncate text-[11px] text-muted-foreground">{label}</div></div>;
}

export function ImportScreen() {
  const { refresh, seed } = useStore();
  const toast = useToast();
  const nav = useNavigate();
  const [data, setData] = useState<MedasiumExport | null>(null);
  const [pv, setPv] = useState<ImportPreview | null>(null);
  const [fileName, setFileName] = useState('');
  const [err, setErr] = useState('');
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const u = URLS();
  const prompt = `You are filling a Medasium import file for ONE patient from the attached documents (prescriptions, lab reports, discharge summaries, notes).\n1. Read the agent guide: ${u.agent}\n2. Validate against the JSON Schema: ${u.schema}\nOutput only the JSON file. Do not invent values; omit what the documents do not say. Use India defaults (IST +05:30, mg/dL, °F, kg).`;

  async function pick(file?: File) {
    setErr(''); setData(null); setPv(null);
    if (!file) return;
    setFileName(file.name);
    const r = await parseImport(file);
    if (!r.ok) return setErr(r.error);
    setData(r.data); setPv(await previewImport(r.data));
  }
  async function apply(mode: 'merge' | 'replace') {
    if (!data) return;
    setBusy(true);
    try { const id = await applyImport(data, mode); await refresh(); toast(mode === 'merge' ? 'Imported and merged' : 'Imported and replaced'); nav(`/p/${id}`); }
    catch (e) { setErr(`Import failed, existing data was not changed.\n${(e as Error).message}`); setBusy(false); }
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      <PageHeader title="Import" subtitle="Bring in a Medasium JSON file for one patient." />

      <label
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files[0]); }}
        className={cn('grid cursor-pointer place-items-center gap-2 rounded-2xl border-2 border-dashed bg-card px-4 py-8 text-center transition-colors focus-within:ring-[3px] focus-within:ring-ring hover:border-primary hover:bg-accent/40', over && 'border-primary bg-accent/60')}>
        <span className="grid size-12 place-items-center rounded-2xl bg-accent text-accent-foreground"><FileUp className="size-6" /></span>
        <span className="font-semibold">Choose or drop a Medasium JSON file</span>
        <span className="text-sm text-muted-foreground">Nothing changes until you confirm. PDF and SQLite exports cannot be imported.</span>
        <input id="imp" type="file" accept=".json,application/json" className="sr-only" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
      </label>

      {err && (
        <div role="alert" className="flex gap-2.5 rounded-xl border border-destructive/40 bg-destructive-soft p-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div className="min-w-0 whitespace-pre-wrap break-words">{err}</div>
        </div>
      )}

      {data && pv && (
        <Card className="overflow-hidden animate-rise">
          <div className="flex items-start gap-3 p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground"><FileJson className="size-5" /></span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-base font-semibold tracking-tight">{pv.patientName}</h2><Badge variant={pv.patientExists ? 'warning' : 'success'}>{pv.patientExists ? 'Existing patient' : 'New patient'}</Badge></div>
              <p className="truncate text-xs text-muted-foreground">{fileName} · profile {!pv.patientExists ? 'new' : pv.patientChanged ? 'changed' : 'unchanged'}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 px-4 pb-4">
            {([['Timeline entries', pv.entries], ['Recurring tasks', pv.tasks]] as const).map(([l, x]) => (
              <div key={l}>
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{l}</div>
                <div className="grid grid-cols-3 gap-2"><Stat n={x.added} label="New" tone="text-success" /><Stat n={x.updated} label="Changed" tone={x.updated ? 'text-warning' : undefined} /><Stat n={x.unchanged} label="Unchanged" /></div>
                {x.removedOnReplace > 0 && <p className="mt-1.5 text-xs text-muted-foreground">Replace would remove {x.removedOnReplace} existing {l.toLowerCase()} not in this file.</p>}
              </div>
            ))}
            <p className="text-xs text-muted-foreground"><b className="text-foreground">Merge</b> keeps everything and adds or updates by record id. <b className="text-foreground">Replace</b> clears this patient’s records first. Other patients are never touched.</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t bg-muted/40 px-4 py-3">
            <Button variant="ghost" onClick={() => { setData(null); setPv(null); }}>Cancel</Button>
            <Button variant="destructive-outline" disabled={busy} onClick={() => apply('replace')}>Replace</Button>
            <Button disabled={busy} onClick={() => apply('merge')}>Merge</Button>
          </div>
        </Card>
      )}

      <Card className="p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-violet-500/12 text-violet-600 dark:text-violet-400"><Bot className="size-5" /></span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight">Build the file with an AI</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Records spread across prescriptions, reports or notes? Give an AI assistant your documents and these two links. It returns a Medasium file you can import above.</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2">
          {([['Agent guide', 'Markdown · short', u.agent], ['JSON Schema', 'Detailed', u.schema]] as const).map(([l, d, url]) => (
            <div key={url} className="flex items-center gap-2 rounded-xl border bg-muted/40 p-2.5">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{l} <span className="font-normal text-muted-foreground">· {d}</span></div>
                <code className="block truncate text-xs text-muted-foreground" title={url}>{url}</code>
              </div>
              <Button size="icon-sm" variant="ghost" asChild><a href={url} target="_blank" rel="noreferrer" aria-label={`Open ${l}`}><ExternalLink /></a></Button>
              <CopyButton text={url} label="Copy link" />
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-xl border">
          <div className="flex items-center justify-between gap-2 border-b px-3 py-2"><span className="flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="size-4 text-primary" />Suggested prompt</span><CopyButton text={prompt} label="Copy prompt" /></div>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words px-3 py-2 font-mono text-xs leading-relaxed text-muted-foreground">{prompt}</pre>
        </div>
      </Card>

      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-500/14 text-amber-600 dark:text-amber-400"><FlaskConical className="size-5" /></span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight">Try it with sample data</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">A fictional patient with 60 days of vitals, medicines, notes, visits and care tasks. <a className="font-medium text-primary underline-offset-4 hover:underline" href={u.sample} download>Download the file</a> to see the format.</p>
          </div>
        </div>
        <Button variant="outline" className="shrink-0" onClick={async () => nav(`/p/${await seed()}`)}><Sparkles />Load sample</Button>
      </Card>
    </div>
  );
}
