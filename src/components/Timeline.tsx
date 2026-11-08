import { useState } from 'react';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import type { Entry, Task } from '@/model/schema';
import { fmtDateLong, fmtTime, ymd } from '@/lib/format';
import { LABELS, UNITS, isAbnormal } from '@/lib/ranges';
import { cn } from '@/lib/utils';
import { ResponsiveDialog } from './ResponsiveDialog';
import { TYPE_META } from './entryMeta';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';

const PAGE = 100;
const today = () => ymd(new Date());
const dayLabel = (iso: string) => {
  const d = ymd(iso), t = today();
  const y = ymd(new Date(Date.now() - 86400000));
  return d === t ? 'Today' : d === y ? 'Yesterday' : fmtDateLong(iso);
};

export function Timeline({ entries, tasks, newestFirst, onEdit, onDelete }: { entries: Entry[]; tasks: Task[]; newestFirst: boolean; onEdit: (e: Entry) => void; onDelete: (e: Entry) => void }) {
  const [limit, setLimit] = useState(PAGE);
  const [zoom, setZoom] = useState<string | null>(null);
  const titles = new Map(tasks.map((t) => [t.id, t.title]));
  const sorted = [...entries].sort((a, b) => (newestFirst ? -1 : 1) * (new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
  const shown = sorted.slice(0, limit);
  const days: { day: string; label: string; items: Entry[] }[] = [];
  for (const e of shown) {
    const d = ymd(e.timestamp);
    if (days.at(-1)?.day !== d) days.push({ day: d, label: dayLabel(e.timestamp), items: [] });
    days.at(-1)!.items.push(e);
  }
  return (
    <div className="grid grid-cols-1 gap-4">
      {days.map((g) => (
        <section key={g.day}>
          <h3 className="sticky top-14 z-10 -mx-4 mb-2 bg-background/90 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur md:top-0 md:-mx-8 md:px-8">
            {g.label}<span className="ml-2 font-normal normal-case tracking-normal">· {g.items.length}</span>
          </h3>
          <ol className="relative grid grid-cols-1 gap-2 before:absolute before:inset-y-3 before:left-[19px] before:w-px before:bg-border">
            {g.items.map((e, i) => {
              const m = TYPE_META[e.type];
              const I = m.icon;
              return (
                <li key={e.id} className="relative flex gap-3 animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
                  <span className={cn('relative z-[1] mt-2 grid size-10 shrink-0 place-items-center rounded-full ring-4 ring-background', m.tint, 'bg-card')}>
                    <span className={cn('absolute inset-0 rounded-full', m.tint)} />
                    <I className="relative size-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1 rounded-xl border bg-card py-2.5 pl-3 pr-1.5">
                    <div className="flex items-start gap-1">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                          <span className="font-semibold tabular-nums text-foreground/80">{fmtTime(e.timestamp)}</span>
                          <span>{m.label}</span>
                          {e.editedAt && <Badge variant="outline" className="px-1.5 py-0 text-[10px]" title="Corrected after saving">edited</Badge>}
                        </div>
                        <div className="mt-1 break-words text-sm"><Body e={e} titles={titles} onZoom={setZoom} /></div>
                        {e.note && <p className="mt-1 break-words text-xs text-muted-foreground">Note: {e.note}</p>}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button size="icon-sm" variant="ghost" className="text-muted-foreground" aria-label="Entry actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent className="min-w-[9rem]">
                          {e.type !== 'task' && <><DropdownMenuItem onSelect={() => onEdit(e)}><Pencil />Edit</DropdownMenuItem><DropdownMenuSeparator /></>}
                          <DropdownMenuItem variant="destructive" onSelect={() => onDelete(e)}><Trash2 />Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
      {sorted.length > limit && <Button variant="outline" className="w-full" onClick={() => setLimit(limit + PAGE)}>Show more ({sorted.length - limit} left)</Button>}
      {zoom && <ResponsiveDialog title="Photo" onClose={() => setZoom(null)} wide><img src={zoom} alt="Attachment" className="w-full rounded-lg" /></ResponsiveDialog>}
    </div>
  );
}

function Body({ e, titles, onZoom }: { e: Entry; titles: Map<string, string>; onZoom: (u: string) => void }) {
  switch (e.type) {
    case 'vitals':
      return (
        <div className="mt-0.5 grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-1.5 pr-1.5">
          {e.readings.map((r, i) => {
            const bad = isAbnormal(r);
            return (
              <div key={i} title={bad ? 'Outside the reference range' : undefined}
                className={cn('min-w-0 rounded-lg px-2 py-1.5', bad ? 'bg-destructive-soft text-destructive' : 'bg-muted')}>
                <div className={cn('truncate text-[11px] font-medium', bad ? 'text-destructive/90' : 'text-muted-foreground')}>{r.metric === 'glucose' ? ({ fasting: 'Fasting sugar', postMeal: 'After-meal sugar', random: 'Random sugar' } as const)[r.context ?? 'random'] : LABELS[r.metric]}</div>
                <div className="truncate font-semibold tabular-nums">
                  {r.metric === 'bloodPressure' ? `${r.value}/${r.diastolic}` : r.value}
                  <span className="ml-0.5 text-[11px] font-medium opacity-70">{UNITS[r.metric]}</span>{bad && <span aria-label="out of range"> ◆</span>}
                </div>
              </div>
            );
          })}
        </div>
      );
    case 'medication':
      return <div className="flex flex-wrap items-center gap-x-2 gap-y-1"><b className="font-semibold">{e.name}</b><Badge variant={e.status === 'taken' ? 'success' : 'warning'}>{e.status}</Badge>{e.dose && <span className="basis-full text-muted-foreground">{e.dose}</span>}{e.reason && <span className="basis-full text-xs text-muted-foreground">Reason: {e.reason}</span>}</div>;
    case 'observation':
      return <div>{e.text}{e.severity && <Badge variant={e.severity === 'mild' ? 'secondary' : e.severity === 'severe' ? 'destructive' : 'warning'} className="ml-1.5 align-middle">{e.severity}</Badge>}</div>;
    case 'appointment':
      return <div className="grid grid-cols-1 gap-0.5"><div className="flex flex-wrap items-center gap-2"><b className="font-semibold">{e.title}</b><Badge variant={e.status === 'scheduled' ? 'default' : e.status === 'cancelled' ? 'secondary' : 'success'}>{e.status}</Badge></div>{e.provider && <div className="text-xs text-muted-foreground">{e.provider}</div>}{e.outcome && <div className="mt-0.5">{e.outcome}</div>}</div>;
    case 'photo':
      return <div className="grid grid-cols-1 gap-1.5"><div className="flex flex-wrap items-center gap-2"><b className="font-semibold">{e.caption || 'Photo'}</b><Badge variant="secondary">{e.category}</Badge></div>
        <button onClick={() => onZoom(e.image)} className="w-fit overflow-hidden rounded-lg border outline-none focus-visible:ring-[3px] focus-visible:ring-ring"><img src={e.image} alt={e.caption || 'Attachment'} loading="lazy" className="max-h-44 w-auto max-w-full object-cover" /></button></div>;
    case 'task':
      return <div className="flex flex-wrap items-center gap-2"><b className="font-semibold">{titles.get(e.taskId) ?? 'Care task'}</b><Badge variant={e.outcome === 'done' ? 'success' : e.outcome === 'skipped' ? 'warning' : 'secondary'}>{e.outcome === 'notApplicable' ? 'not applicable' : e.outcome}</Badge>{e.reason && <span className="basis-full text-xs text-muted-foreground">Reason: {e.reason}</span>}</div>;
  }
}
