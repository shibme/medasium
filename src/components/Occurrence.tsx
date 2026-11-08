import { useState } from 'react';
import { Ban, Check, Clock, MoreHorizontal, SkipForward } from 'lucide-react';
import { recordOutcome } from '@/lib/tasks';
import { fmtDate, fmtTime, ymd } from '@/lib/format';
import type { Occurrence } from '@/lib/schedule';
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { PromptReason, useToast } from './ui';

const STATUS = {
  overdue: { v: 'destructive', l: 'Overdue', bar: 'bg-destructive' },
  due: { v: 'warning', l: 'Due now', bar: 'bg-warning' },
  upcoming: { v: 'outline', l: 'Upcoming', bar: 'bg-border' },
  done: { v: 'success', l: 'Done', bar: 'bg-success' },
  skipped: { v: 'warning', l: 'Skipped', bar: 'bg-warning/60' },
  notApplicable: { v: 'secondary', l: 'N/A', bar: 'bg-border' },
} as const;

export function OccurrenceRow({ o, patientId, onChange }: { o: Occurrence; patientId: string; onChange: () => void }) {
  const [skip, setSkip] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const act = async (out: 'done' | 'skipped' | 'notApplicable', reason?: string) => {
    setBusy(true);
    try { await recordOutcome(patientId, o, out, reason); toast(out === 'done' ? `Done: ${o.task.title}` : out === 'skipped' ? 'Marked skipped' : 'Marked not applicable'); onChange(); }
    catch (e) { toast((e as Error).message); setBusy(false); }
  };
  const s = STATUS[o.status];
  const open = o.status === 'due' || o.status === 'overdue' || o.status === 'upcoming';
  const d = ymd(o.due), today = d === ymd(new Date()), yest = d === ymd(new Date(Date.now() - 86400000));
  return (
    <div className="relative flex items-center gap-3 overflow-hidden rounded-xl border bg-card py-2.5 pl-4 pr-2.5 animate-rise">
      <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1', s.bar)} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{o.task.title}</div>
        <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <Badge variant={s.v} className="shrink-0">{s.l}</Badge>
          <Clock className="size-3 shrink-0" /><span className="truncate tabular-nums">{today ? 'Today' : yest ? 'Yesterday' : fmtDate(o.due)}, {fmtTime(o.due)}{o.outcome?.reason ? ` · ${o.outcome.reason}` : ''}</span>
        </div>
      </div>
      {open && (
        <div className="flex shrink-0 items-center gap-1">
          <Button size="sm" disabled={busy} onClick={() => act('done')} aria-label={`Mark ${o.task.title} done`}><Check />Done</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button size="icon-sm" variant="ghost" aria-label="More task actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => setSkip(true)}><SkipForward />Skip with reason…</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => act('notApplicable')}><Ban />Not applicable today</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      {skip && <PromptReason title={`Skip “${o.task.title}”`} onClose={() => setSkip(false)} onSubmit={(r) => { setSkip(false); act('skipped', r); }} />}
    </div>
  );
}
