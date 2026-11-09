import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, FileInput, Phone, Plus, Sparkles, Stethoscope, Sprout, UserPlus } from 'lucide-react';
import { allTasks } from '@/db';
import { OccurrenceRow } from '@/components/Occurrence';
import { Avatar, Empty } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { needsAction, occurrences, type Occurrence } from '@/lib/schedule';
import { EMERGENCY, fmtDateLong } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useStore } from '@/store';
import type { Patient } from '@/model/schema';

interface Group { patient: Patient; due: Occurrence[]; next: Occurrence[] }
const greet = () => { const h = Number(new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', hourCycle: 'h23' }).format(new Date())); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };

function Stat({ n, label, tone }: { n: number; label: string; tone?: 'bad' | 'good' }) {
  return (
    <div className="min-w-0 rounded-xl border bg-card px-3 py-3 text-center">
      <div className={cn('text-2xl font-bold tabular-nums tracking-tight', tone === 'bad' && 'text-destructive', tone === 'good' && 'text-success')}>{n}</div>
      <div className="truncate text-xs font-medium text-muted-foreground">{label}</div>
    </div>
  );
}

export function Today({ onAdd }: { onAdd: (patientId?: string) => void }) {
  const { patients, loading, version } = useStore();
  const [groups, setGroups] = useState<Group[]>([]);
  const nav = useNavigate();
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 60000); return () => clearInterval(t); }, []);
  const reload = () => setTick((x) => x + 1);
  useEffect(() => {
    let live = true;
    allTasks().then((all) => {
      if (!live) return;
      const now = new Date();
      setGroups(all.map(({ patient, tasks, entries }) => {
        const occ = occurrences(tasks, entries, now, 6);
        return { patient, due: occ.filter(needsAction), next: occ.filter((o) => o.status === 'upcoming') };
      }));
    });
    return () => { live = false; };
  }, [version, tick]);

  if (loading) return null;
  if (!patients.length) return (
    <div className="pt-6">
      <Empty icon={<Stethoscope />} title="Welcome to Medasium">
        Track care for the people you look after. Everything stays on this device, with no account and no server.
      </Empty>
      <div className="mx-auto grid max-w-sm gap-2">
        <Button size="lg" asChild><Link to="/patients?new=1"><UserPlus />Add the first patient</Link></Button>
        <Button size="lg" variant="outline" onClick={() => nav('/import?sample=1')}><Sparkles />Explore with a sample patient</Button>
        <Button variant="link" asChild><Link to="/import"><FileInput />Import records, or let an AI build the file</Link></Button>
      </div>
    </div>
  );
  const total = groups.reduce((n, g) => n + g.due.length, 0);
  const overdue = groups.reduce((n, g) => n + g.due.filter((o) => o.status === 'overdue').length, 0);
  return (
    <div className="grid grid-cols-1 gap-5">
      <div>
        <p className="text-sm font-medium text-muted-foreground">{fmtDateLong(new Date())}</p>
        <h1 className="text-2xl font-bold tracking-tight">{greet()}</h1>
      </div>
      <div className="grid grid-cols-3 gap-2 stagger">
        <Stat n={total} label="To do now" />
        <Stat n={overdue} label="Overdue" tone={overdue ? 'bad' : 'good'} />
        <Stat n={patients.length} label={patients.length === 1 ? 'Patient' : 'Patients'} />
      </div>

      {total === 0 && (
        <Card className="flex items-center gap-3 p-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-success-soft text-success"><Sprout className="size-5" /></span>
          <div><div className="font-semibold">All caught up</div><div className="text-sm text-muted-foreground">No care tasks are due or overdue.</div></div>
        </Card>
      )}

      {groups.map((g) => (g.due.length || g.next.length) ? (
        <section key={g.patient.id} className="grid grid-cols-1 gap-2">
          <div className="flex items-center gap-3">
            <Link to={`/p/${g.patient.id}`} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring">
              <Avatar name={g.patient.name} className="size-8 text-xs ring-0" />
              <span className="truncate font-semibold">{g.patient.name}</span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
            <Button size="sm" variant="soft" onClick={() => onAdd(g.patient.id)}><Plus />Entry</Button>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {g.due.map((o) => <OccurrenceRow key={o.task.id + o.dueAt} o={o} patientId={g.patient.id} onChange={reload} />)}
          </div>
          {g.next.length > 0 && <>
            <div className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Coming up · next 6 hours</div>
            <div className="grid grid-cols-1 gap-2">{g.next.map((o) => <OccurrenceRow key={o.task.id + o.dueAt} o={o} patientId={g.patient.id} onChange={reload} />)}</div>
          </>}
        </section>
      ) : null)}

      <Card className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">Emergency (India)</span>
        {EMERGENCY.map((e) => <a key={e.n} href={`tel:${e.n}`} className="inline-flex items-center gap-1 font-semibold text-destructive"><Phone className="size-3.5" />{e.n}<span className="font-normal text-muted-foreground">{e.l}</span></a>)}
        <span className="basis-full">Medasium records and flags readings. It does not give medical advice.</span>
      </Card>
    </div>
  );
}
