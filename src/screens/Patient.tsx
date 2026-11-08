import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowDownUp, CalendarDays, ChartLine, ChevronDown, ClipboardList, Database, FileJson, FileText, ListChecks, MoreVertical,
  Pencil, Phone, Plus, Search, SlidersHorizontal, Trash2, TriangleAlert, UserRound, UserX, X,
} from 'lucide-react';
import { deleteEntry, deletePatient, deleteTask, getBundle, type Bundle } from '@/db';
import { Chart } from '@/components/Chart';
import { EntryForm } from '@/components/EntryForm';
import { OccurrenceRow } from '@/components/Occurrence';
import { ProfileForm } from '@/components/ProfileForm';
import { ResponsiveDialog } from '@/components/ResponsiveDialog';
import { TaskForm } from '@/components/TaskForm';
import { Timeline } from '@/components/Timeline';
import { TYPE_META } from '@/components/entryMeta';
import { Avatar, Confirm, Empty, useToast } from '@/components/ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CHARTS, describeEntry, exportJson, exportPdf, exportSqlite, filterPeriod } from '@/lib/export';
import { addDays, ageFrom, fmtDate, fmtPhone, istInstant, ymd } from '@/lib/format';
import { LABELS, UNITS, isAbnormal } from '@/lib/ranges';
import { needsAction, occurrences } from '@/lib/schedule';
import { metricSeries } from '@/lib/series';
import { cn } from '@/lib/utils';
import type { Entry, Task } from '@/model/schema';
import { lastPatient, useStore } from '@/store';

type Tab = 'timeline' | 'charts' | 'tasks' | 'profile';
const PRESETS: [string, string][] = [['7', 'Last 7 days'], ['30', 'Last 30 days'], ['90', 'Last 90 days'], ['all', 'All time'], ['custom', 'Custom range']];
const SERIES_COLORS: Record<string, string[]> = {
  bloodPressure: ['var(--chart-1)', 'var(--chart-2)'], glucose: ['var(--chart-3)'], weight: ['var(--chart-4)'], temperature: ['var(--chart-7)'],
  pulse: ['var(--chart-5)'], spo2: ['var(--chart-1)'], respiratoryRate: ['var(--chart-3)'],
};
const dmy = (d: string) => fmtDate(`${d}T00:00:00+05:30`);

export function PatientScreen({ onAddRef }: { onAddRef: (fn: (() => void) | null) => void }) {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { refresh, version } = useStore();
  const [b, setB] = useState<Bundle | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>('timeline');
  const [preset, setPreset] = useState('30');
  const [cFrom, setCFrom] = useState(''); const [cTo, setCTo] = useState('');
  const [types, setTypes] = useState<Entry['type'][]>([]);
  const [q, setQ] = useState('');
  const [newestFirst, setNewestFirst] = useState(true);
  const [filters, setFilters] = useState(false);
  const [form, setForm] = useState<{ entry?: Entry } | null>(null);
  const [delE, setDelE] = useState<Entry | null>(null);
  const [taskForm, setTaskForm] = useState<{ task?: Task } | null>(null);
  const [delT, setDelT] = useState<Task | null>(null);
  const [editProfile, setEditProfile] = useState(false);
  const [delP, setDelP] = useState(false);
  const [allergyOpen, setAllergyOpen] = useState(false);
  const [busy, setBusy] = useState('');
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => { setB((await getBundle(id)) ?? null); setTick((t) => t + 1); }, [id]);
  useEffect(() => { load(); lastPatient.set(id); }, [load, id, version]);
  useEffect(() => { onAddRef(() => setForm({})); return () => onAddRef(null); }, [onAddRef]);

  const today = ymd(new Date());
  const period = useMemo(() => {
    if (preset === 'all') return {};
    if (preset === 'custom') return { from: cFrom || undefined, to: cTo || undefined };
    return { from: addDays(today, -(Number(preset) - 1)), to: today };
  }, [preset, cFrom, cTo, today]);
  const inPeriod = useMemo(() => (b ? filterPeriod(b.entries, period) : []), [b, period]);
  const titles = useMemo(() => new Map((b?.tasks ?? []).map((t) => [t.id, t.title])), [b]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return inPeriod.filter((e) => (!types.length || types.includes(e.type)) && (!needle || (describeEntry(e, titles) + ' ' + (e.note ?? '')).toLowerCase().includes(needle)));
  }, [inPeriod, types, q, titles]);
  const readings = useMemo(() => inPeriod.flatMap((e) => (e.type === 'vitals' ? e.readings : [])), [inPeriod]);
  const abnormal = useMemo(() => {
    const by = new Map<string, number>();
    for (const r of readings) if (isAbnormal(r)) by.set(r.metric, (by.get(r.metric) ?? 0) + 1);
    return by;
  }, [readings]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const occ = useMemo(() => (b ? occurrences(b.tasks, b.entries, new Date(), 24) : []), [b, tick]);

  if (b === undefined) return null;
  if (b === null) return <Empty icon={<UserX />} title="Patient not found"><Button variant="outline" asChild className="mt-3"><Link to="/patients">Back to patients</Link></Button></Empty>;
  const p = b.patient, age = ageFrom(p.dateOfBirth, p.ageYears);
  const domain: [number, number] | undefined = period.from && period.to ? [istInstant(period.from).getTime(), istInstant(period.to, '23:59').getTime()] : undefined;
  const totalAbn = [...abnormal.values()].reduce((a, c) => a + c, 0);
  const periodLabel = period.from ? `${dmy(period.from)} – ${dmy(period.to ?? today)}` : period.to ? `until ${dmy(period.to)}` : 'All dates';
  const dueCount = occ.filter(needsAction).length;

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label);
    try { await fn(); toast(`${label} downloaded`); } catch (e) { toast(`${label} failed: ${(e as Error).message}`); } finally { setBusy(''); }
  }
  const afterChange = async () => { setForm(null); setTaskForm(null); await load(); await refresh(); };
  const meta = [age !== undefined && `${age} y`, p.sex && p.sex !== 'unknown' && p.sex[0].toUpperCase() + p.sex.slice(1), p.bloodGroup, p.heightCm && `${p.heightCm} cm`].filter(Boolean).join(' · ');

  const rangeSelect = (
    <Select value={preset} onValueChange={setPreset}>
      <SelectTrigger className="w-auto shrink-0 gap-1.5 px-2.5 sm:px-3" aria-label="Date range">
        <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
        <span className="hidden sm:inline"><SelectValue /></span>
        <span className="sm:hidden">{preset === 'all' ? 'All' : preset === 'custom' ? 'Custom' : `${preset}d`}</span>
      </SelectTrigger>
      <SelectContent>{PRESETS.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
    </Select>
  );
  const customRange = preset === 'custom' && (
    <div className="grid grid-cols-2 gap-2">
      <Field label="From"><Input type="date" value={cFrom} max={cTo || undefined} onChange={(e) => setCFrom(e.target.value)} /></Field>
      <Field label="To"><Input type="date" value={cTo} min={cFrom || undefined} onChange={(e) => setCTo(e.target.value)} /></Field>
    </div>
  );
  const activeFilters = types.length + (newestFirst ? 0 : 1);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3">
        <Avatar name={p.name} className="size-12 text-base" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{p.name}</h1>
          {meta && <p className="truncate text-sm text-muted-foreground">{meta}</p>}
        </div>
        <Button className="hidden md:inline-flex" onClick={() => setForm({})}><Plus />Add entry</Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Patient actions" disabled={!!busy}>{busy ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <MoreVertical />}</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-[14rem]">
            <DropdownMenuLabel>Export</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => { exportJson(b); toast('Medasium JSON downloaded'); }}><FileJson /><span className="flex-1">Medasium JSON</span><span className="text-xs text-muted-foreground">re-importable</span></DropdownMenuItem>
            <DropdownMenuItem onSelect={() => run('PDF', () => exportPdf(b, period, inPeriod))}><FileText /><span className="flex-1">PDF report</span><span className="text-xs text-muted-foreground">{preset === 'all' ? 'all time' : 'selected dates'}</span></DropdownMenuItem>
            <DropdownMenuItem onSelect={() => run('SQLite', () => exportSqlite(b))}><Database />SQLite database</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setEditProfile(true)}><Pencil />Edit profile</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={() => setDelP(true)}><Trash2 />Delete patient</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {p.allergies?.length ? (
        <button onClick={() => setAllergyOpen(!allergyOpen)} aria-expanded={allergyOpen}
          className="mt-3 flex w-full items-start gap-2 rounded-xl border border-destructive/30 bg-destructive-soft px-3 py-2 text-left text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
          <span className={cn('min-w-0 flex-1', !allergyOpen && 'truncate')}>
            <b className="font-semibold text-destructive">Allergies: </b>
            {p.allergies.map((a) => `${a.substance}${a.reaction ? ` (${a.reaction})` : ''}`).join(', ')}
          </span>
          <ChevronDown className={cn('mt-0.5 size-4 shrink-0 text-destructive transition-transform', allergyOpen && 'rotate-180')} />
        </button>
      ) : null}

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mt-4">
        <TabsList>
          <TabsTrigger value="timeline"><ClipboardList /><span className="max-[359px]:sr-only">Timeline</span></TabsTrigger>
          <TabsTrigger value="charts"><ChartLine /><span className="max-[359px]:sr-only">Charts</span></TabsTrigger>
          <TabsTrigger value="tasks"><ListChecks /><span className="max-[359px]:sr-only">Tasks</span>{dueCount > 0 && <span className="grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white dark:text-background">{dueCount}</span>}</TabsTrigger>
          <TabsTrigger value="profile"><UserRound /><span className="max-[359px]:sr-only">Profile</span></TabsTrigger>
        </TabsList>

        {/* Timeline */}
        <TabsContent value="timeline" className="mt-3 outline-none">
          <div className="grid grid-cols-1 gap-2">
            <div className="flex gap-2">
              {rangeSelect}
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input type="search" placeholder="Search entries" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" aria-label="Search notes, medicines, symptoms" />
              </div>
              <Button variant="outline" size="icon" className="relative" onClick={() => setFilters(true)} aria-label={`Filters${activeFilters ? `, ${activeFilters} active` : ''}`}>
                <SlidersHorizontal />
                {activeFilters > 0 && <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{activeFilters}</span>}
              </Button>
            </div>
            {customRange}
            {(types.length > 0 || !newestFirst) && (
              <div className="flex flex-wrap gap-1.5">
                {types.map((t) => <button key={t} onClick={() => setTypes(types.filter((x) => x !== t))} className="inline-flex items-center gap-1 rounded-full bg-accent py-0.5 pl-2.5 pr-1.5 text-xs font-semibold text-accent-foreground">{TYPE_META[t].label}<X className="size-3.5" /></button>)}
                {!newestFirst && <button onClick={() => setNewestFirst(true)} className="inline-flex items-center gap-1 rounded-full bg-accent py-0.5 pl-2.5 pr-1.5 text-xs font-semibold text-accent-foreground">Oldest first<X className="size-3.5" /></button>}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span>{periodLabel}</span><span aria-hidden>·</span>
              <span>{shown.length === inPeriod.length ? `${shown.length} entries` : `${shown.length} of ${inPeriod.length} entries`}</span>
              {totalAbn > 0 && <Badge variant="destructive" className="ml-auto">{totalAbn} abnormal readings</Badge>}
            </div>
          </div>
          <div className="mt-3">
            {shown.length ? <Timeline entries={shown} tasks={b.tasks} newestFirst={newestFirst} onEdit={(e) => setForm({ entry: e })} onDelete={setDelE} />
              : <Empty icon={<ClipboardList />} title={b.entries.length ? 'Nothing matches' : 'No entries yet'}>
                  {b.entries.length ? 'Try a wider date range or clear the filters.' : <Button className="mt-3" onClick={() => setForm({})}><Plus />Add the first entry</Button>}
                </Empty>}
          </div>
        </TabsContent>

        {/* Charts */}
        <TabsContent value="charts" className="mt-3 grid grid-cols-1 gap-3 outline-none">
          <div className="flex items-center gap-2">
            {rangeSelect}
            <span className="min-w-0 truncate text-xs text-muted-foreground">{periodLabel} · {readings.length} readings</span>
          </div>
          {customRange}
          <Card className="p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[15px] font-semibold tracking-tight">Abnormal summary</h3>
              <Badge variant={totalAbn ? 'destructive' : readings.length ? 'success' : 'secondary'}>{totalAbn ? `${totalAbn} of ${readings.length}` : readings.length ? 'All in range' : 'No readings'}</Badge>
            </div>
            {readings.length > 0 && (
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-success-soft">
                <div className="h-full rounded-full bg-destructive transition-[width] duration-700" style={{ width: `${(totalAbn / readings.length) * 100}%` }} />
              </div>
            )}
            {totalAbn > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{[...abnormal].sort((a, b2) => b2[1] - a[1]).map(([m, n]) => <Badge key={m} variant="outline" className="text-foreground"><span className="text-destructive">◆</span>{LABELS[m as keyof typeof LABELS]} <b className="tabular-nums">{n}</b></Badge>)}</div>}
            <p className="mt-3 text-xs text-muted-foreground">Flags compare readings with standard adult reference ranges. They are not a diagnosis.</p>
          </Card>
          {CHARTS.map(({ metric, context, title }) => { const s = metricSeries(inPeriod, metric, context); return s.length ? <Chart key={title} title={title} unit={UNITS[metric]} series={s} colors={SERIES_COLORS[metric]} domain={domain} /> : null; })}
          {!readings.length && <Empty icon={<ChartLine />} title="Not enough data to chart">Add vitals such as blood pressure, sugar or weight, and charts draw themselves for the selected dates.<div className="mt-3"><Button onClick={() => setForm({})}><Plus />Add vitals</Button></div></Empty>}
        </TabsContent>

        {/* Tasks */}
        <TabsContent value="tasks" className="mt-3 grid grid-cols-1 gap-3 outline-none">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold tracking-tight">Today</h2>
            <Button size="sm" variant="soft" onClick={() => setTaskForm({})}><Plus />New task</Button>
          </div>
          {(() => {
            const todays = occ.filter((o) => needsAction(o) || ymd(o.due) === today);
            return todays.length
              ? <div className="grid grid-cols-1 gap-2">{todays.map((o) => <OccurrenceRow key={o.task.id + o.dueAt} o={o} patientId={id} onChange={afterChange} />)}</div>
              : <Card className="p-4 text-sm text-muted-foreground">{b.tasks.length ? 'Nothing scheduled today.' : 'No recurring tasks yet. Add turning, feeding, physiotherapy or dressing changes.'}</Card>;
          })()}
          {b.tasks.length > 0 && <h2 className="mt-2 text-base font-semibold tracking-tight">Schedules</h2>}
          <div className="grid grid-cols-1 gap-2">
            {b.tasks.map((t) => (
              <div key={t.id} className="flex items-center gap-3 rounded-xl border bg-card py-2.5 pl-3 pr-1.5">
                <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg', TYPE_META.task.tint)}><ListChecks className="size-[18px]" /></span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{t.title}</div>
                  <div className="truncate text-xs text-muted-foreground">{t.times.join(', ')} · {t.daysOfWeek?.length ? t.daysOfWeek.map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ') : 'Every day'}{t.endDate ? ` · until ${dmy(t.endDate)}` : ''}</div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button size="icon-sm" variant="ghost" aria-label={`Actions for ${t.title}`}><MoreVertical /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent className="min-w-[9rem]">
                    <DropdownMenuItem onSelect={() => setTaskForm({ task: t })}><Pencil />Edit</DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onSelect={() => setDelT(t)}><Trash2 />Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Profile */}
        <TabsContent value="profile" className="mt-3 grid grid-cols-1 gap-3 outline-none">
          <ProfileCard title="Identity" onEdit={() => setEditProfile(true)}>
            <Row k="Date of birth" v={p.dateOfBirth && dmy(p.dateOfBirth)} /><Row k="Age" v={age !== undefined ? `${age} years` : undefined} />
            <Row k="Sex" v={p.sex && p.sex !== 'unknown' ? <span className="capitalize">{p.sex}</span> : undefined} /><Row k="Blood group" v={p.bloodGroup} />
            <Row k="Height" v={p.heightCm && `${p.heightCm} cm`} /><Row k="Baseline weight" v={p.baselineWeightKg && `${p.baselineWeightKg} kg`} />
          </ProfileCard>
          <ProfileCard title="Medical">
            <Row k="Conditions" v={p.conditions?.length ? <ul className="grid grid-cols-1 gap-0.5">{p.conditions.map((c) => <li key={c}>{c}</li>)}</ul> : undefined} />
            <Row k="Allergies" v={p.allergies?.length ? <ul className="grid grid-cols-1 gap-0.5">{p.allergies.map((a) => <li key={a.substance} className="text-destructive"><b className="font-semibold">{a.substance}</b>{a.reaction && <span className="text-muted-foreground"> · {a.reaction}</span>}{a.severity && <span className="text-muted-foreground"> · {a.severity}</span>}</li>)}</ul> : 'None recorded'} />
          </ProfileCard>
          {p.emergencyContact && (
            <ProfileCard title="Emergency contact">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1"><div className="truncate font-semibold">{p.emergencyContact.name || 'Contact'}</div><div className="truncate text-sm text-muted-foreground">{[p.emergencyContact.relation, fmtPhone(p.emergencyContact.phone)].filter(Boolean).join(' · ')}</div></div>
                {p.emergencyContact.phone && <Button asChild variant="soft"><a href={`tel:${p.emergencyContact.phone.replace(/\s/g, '')}`}><Phone />Call</a></Button>}
              </div>
            </ProfileCard>
          )}
          {p.note && <ProfileCard title="Notes"><p className="whitespace-pre-wrap break-words text-sm">{p.note}</p></ProfileCard>}
          <Card className="border-destructive/30 p-4">
            <h3 className="text-[15px] font-semibold tracking-tight">Danger zone</h3>
            <p className="mt-1 text-sm text-muted-foreground">Permanently remove this patient and all their records from this browser.</p>
            <Button variant="destructive-outline" className="mt-3" onClick={() => setDelP(true)}><Trash2 />Delete patient</Button>
          </Card>
        </TabsContent>
      </Tabs>

      {filters && (
        <ResponsiveDialog title="Filter timeline" onClose={() => setFilters(false)}
          footer={<><Button variant="ghost" onClick={() => { setTypes([]); setNewestFirst(true); }} disabled={!activeFilters}>Clear all</Button><Button onClick={() => setFilters(false)}>Show {shown.length} entries</Button></>}>
          <div className="grid grid-cols-1 gap-5">
            <div className="grid grid-cols-1 gap-2">
              <div className="text-[13px] font-medium text-muted-foreground">Entry types</div>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(TYPE_META) as Entry['type'][]).map((t) => {
                  const { icon: I, label, tint } = TYPE_META[t];
                  const on = types.includes(t);
                  const n = inPeriod.filter((e) => e.type === t).length;
                  return (
                    <button key={t} aria-pressed={on} onClick={() => setTypes(on ? types.filter((x) => x !== t) : [...types, t])}
                      className={cn('flex min-w-0 items-center gap-2 rounded-xl border p-2 text-left text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring', on ? 'border-primary bg-accent ring-1 ring-primary' : 'hover:bg-muted')}>
                      <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', tint)}><I className="size-4" /></span>
                      <span className="min-w-0 flex-1 truncate">{label}</span><span className="text-xs tabular-nums text-muted-foreground">{n}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <div className="text-[13px] font-medium text-muted-foreground">Order</div>
              <div className="grid grid-cols-2 gap-2">
                {[[true, 'Newest first'], [false, 'Oldest first']].map(([v, l]) => (
                  <Button key={String(v)} variant={newestFirst === v ? 'soft' : 'outline'} className={cn(newestFirst === v && 'ring-1 ring-primary')} onClick={() => setNewestFirst(v as boolean)}><ArrowDownUp />{l as string}</Button>
                ))}
              </div>
            </div>
          </div>
        </ResponsiveDialog>
      )}

      {form && <EntryForm patientId={id} entry={form.entry} onClose={() => setForm(null)} onSaved={afterChange} />}
      {taskForm && <TaskForm patientId={id} task={taskForm.task} onClose={() => setTaskForm(null)} onSaved={afterChange} />}
      {editProfile && <ProfileForm patient={p} onClose={() => setEditProfile(false)} onSaved={async () => { setEditProfile(false); await load(); await refresh(); }} />}
      {delE && <Confirm title="Delete this entry?" body={`“${describeEntry(delE, titles).slice(0, 120)}” will be removed from the timeline. This cannot be undone.`} onNo={() => setDelE(null)} onYes={async () => { await deleteEntry(id, delE.id); setDelE(null); toast('Entry deleted'); await load(); }} />}
      {delT && <Confirm title={`Delete “${delT.title}”?`} body="The schedule and all its recorded outcomes will be removed. To stop it but keep its history, edit it and set an end date instead." onNo={() => setDelT(null)}
        onYes={async () => { const t = delT; for (const e of b.entries) if (e.type === 'task' && e.taskId === t.id) await deleteEntry(id, e.id); await deleteTask(id, t.id); setDelT(null); toast('Task deleted'); await load(); }} />}
      {delP && <Confirm title={`Delete ${p.name}?`} body="Their profile, timeline and tasks will be permanently removed from this browser. Export a Medasium JSON backup first if you may need them." confirmLabel="Delete patient" onNo={() => setDelP(false)}
        onYes={async () => { await deletePatient(id); await refresh(); toast('Patient deleted'); nav('/patients'); }} />}
    </div>
  );
}

const ProfileCard = ({ title, onEdit, children }: { title: string; onEdit?: () => void; children: React.ReactNode }) => (
  <Card className="p-4">
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {onEdit && <Button size="sm" variant="ghost" onClick={onEdit}><Pencil />Edit</Button>}
    </div>
    <div className="grid divide-y">{children}</div>
  </Card>
);
const Row = ({ k, v }: { k: string; v?: React.ReactNode }) => (v ? (
  <div className="grid grid-cols-[minmax(6rem,38%)_1fr] gap-3 py-2 text-sm first:pt-0 last:pb-0">
    <span className="text-muted-foreground">{k}</span><span className="min-w-0 break-words">{v}</span>
  </div>
) : null);
