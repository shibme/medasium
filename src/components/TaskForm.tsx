import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { putTask } from '@/db';
import type { Task } from '@/model/schema';
import { uid, ymd } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ResponsiveDialog } from './ResponsiveDialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Field, Label } from './ui/label';
import { useToast } from './ui';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function TaskForm({ patientId, task, onClose, onSaved }: { patientId: string; task?: Task; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [title, setTitle] = useState(task?.title ?? '');
  const [details, setDetails] = useState(task?.details ?? '');
  const [times, setTimes] = useState<string[]>(task?.times ?? ['08:00']);
  const [days, setDays] = useState<number[]>(task?.daysOfWeek ?? []);
  const [start, setStart] = useState(task?.startDate ?? ymd(new Date()));
  const [end, setEnd] = useState(task?.endDate ?? '');
  const [err, setErr] = useState('');
  async function save() {
    const ts = [...new Set(times.filter(Boolean))].sort();
    if (!title.trim()) return setErr('Enter a task name.');
    if (!ts.length) return setErr('Add at least one time.');
    if (end && end < start) return setErr('End date is before the start date.');
    await putTask(patientId, { id: task?.id ?? uid(), title: title.trim(), ...(details.trim() ? { details: details.trim() } : {}), times: ts, ...(days.length && days.length < 7 ? { daysOfWeek: [...days].sort() } : {}), startDate: start, ...(end ? { endDate: end } : {}) });
    toast('Task saved'); onSaved();
  }
  return (
    <ResponsiveDialog title={task ? 'Edit recurring task' : 'New recurring task'} onClose={onClose}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save}>Save task</Button></>}>
      <div className="grid grid-cols-1 gap-4">
        <Field label="Task"><Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Turn patient, physiotherapy, dressing…" /></Field>
        <Field label="Details (optional)"><Input value={details} onChange={(e) => setDetails(e.target.value)} /></Field>
        <div className="grid grid-cols-1 gap-2">
          <Label>Times each day (IST)</Label>
          <div className="flex flex-wrap gap-2">
            {times.map((t, i) => (
              <div key={i} className="flex items-center gap-1 rounded-lg border bg-muted/50 py-1 pl-1 pr-1">
                <input type="time" aria-label={`Time ${i + 1}`} value={t} onChange={(e) => setTimes(times.map((x, j) => (j === i ? e.target.value : x)))} className="h-8 w-[7.5rem] rounded-md bg-transparent px-2 tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                {times.length > 1 && <Button size="icon-sm" variant="ghost" onClick={() => setTimes(times.filter((_, j) => j !== i))} aria-label="Remove time"><X /></Button>}
              </div>
            ))}
            <Button variant="soft" size="sm" className="h-10" onClick={() => setTimes([...times, '12:00'])}><Plus />Add time</Button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2">
          <Label>Days <span className="font-normal">(none selected means every day)</span></Label>
          <div className="grid grid-cols-7 gap-1.5">
            {DAYS.map((d, i) => {
              const on = days.includes(i);
              return <button key={i} aria-pressed={on} aria-label={DAY_NAMES[i]} onClick={() => setDays(on ? days.filter((x) => x !== i) : [...days, i])}
                className={cn('h-10 rounded-lg border text-sm font-semibold transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring', on ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}>{d}</button>;
            })}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts"><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label="Ends (optional)"><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
        </div>
        {err && <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive-soft px-3 py-2 text-sm text-destructive">{err}</div>}
      </div>
    </ResponsiveDialog>
  );
}
