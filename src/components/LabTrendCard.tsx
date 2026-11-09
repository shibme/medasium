import { ArrowDown, ArrowUp, TriangleAlert } from 'lucide-react';
import type { LabResult } from '@/model/schema';
import { fmtRange } from '@/model/labs';
import { effectiveRange, fmtLabValue, fmtNumber, labFlag, type LabTestSummary } from '@/lib/labs';
import type { Series } from '@/lib/series';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Chart, useWidth } from './Chart';
import { ResponsiveDialog } from './ResponsiveDialog';
import { Badge } from './ui/badge';

export const PANEL_COLOR: Record<string, string> = {
  tumour: 'var(--chart-7)', cbc: 'var(--chart-8)', lft: 'var(--chart-4)', rft: 'var(--chart-1)', diabetes: 'var(--chart-3)',
  lipid: 'var(--chart-2)', thyroid: 'var(--chart-5)', vitamins: 'var(--chart-6)', clotting: 'var(--chart-1)', custom: 'var(--chart-7)',
};
const FLAG = { high: { l: 'High', I: ArrowUp }, low: { l: 'Low', I: ArrowDown }, abnormal: { l: 'Abnormal', I: TriangleAlert } } as const;
const unitText = (u: string) => (u && u !== 'ratio' ? u : '');

interface Props { test: LabTestSummary; series: Series | null; history: { at: string; r: LabResult; lab?: string }[]; sex?: string; onOpen: () => void }

/** Compact card: latest value + flag, neutral change vs previous, sparkline with reference band. */
export function LabTrendCard({ test, series, history, sex, onOpen }: Props) {
  const last = history[history.length - 1];
  const flag = labFlag(last.r, sex);
  const pts = series?.points ?? [];
  const prev = pts.length >= 2 ? pts[pts.length - 2] : undefined, cur = pts[pts.length - 1];
  const delta = prev && cur && last.r.value !== undefined ? cur.v - prev.v : undefined;
  const pct = delta !== undefined && prev!.v !== 0 ? (delta / Math.abs(prev!.v)) * 100 : undefined;
  const F = flag ? FLAG[flag] : null;
  const color = PANEL_COLOR[test.panel];
  return (
    <button type="button" onClick={onOpen}
      className={cn('flex min-w-0 flex-col rounded-xl border bg-card p-3 text-left transition-colors outline-none hover:bg-accent/40 focus-visible:ring-[3px] focus-visible:ring-ring animate-rise', flag && 'border-destructive/40')}>
      <div className="flex min-w-0 items-start gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{test.name}</span>
        {F && <Badge variant="destructive"><F.I />{F.l}</Badge>}
      </div>
      <div className="mt-1 flex min-w-0 items-baseline gap-1.5">
        <span className={cn('truncate text-xl font-bold tabular-nums tracking-tight', flag && 'text-destructive')}>{fmtLabValue(last.r)}</span>
        {last.r.text === undefined && <span className="shrink-0 text-xs font-medium text-muted-foreground">{unitText(test.unit)}</span>}
      </div>
      <div className="mt-0.5 truncate text-xs text-muted-foreground">
        {fmtDate(last.at)} · {test.count} {test.count === 1 ? 'result' : 'results'}
        {delta !== undefined && <> · {delta === 0 ? 'no change' : <>{delta > 0 ? '↑' : '↓'} {fmtNumber(Math.abs(delta))}{pct !== undefined && isFinite(pct) ? ` (${pct > 0 ? '+' : ''}${Math.round(pct)}%)` : ''}</>}</>}
      </div>
      {pts.length >= 2 ? <Sparkline series={series!} color={color} /> : <div className="mt-2 flex h-9 items-center text-[11px] text-muted-foreground">{pts.length === 1 ? 'Single result, no trend' : 'Text result, no chart'}</div>}
    </button>
  );
}

function Sparkline({ series, color }: { series: Series; color: string }) {
  const [ref, W] = useWidth();
  const H = 36, P = 3;
  const pts = series.points, g = series.range;
  const vs = pts.map((p) => p.v);
  let lo = Math.min(...vs, g?.lo ?? Infinity), hi = Math.max(...vs, g?.hi ?? -Infinity);
  if (hi === lo) { hi += 1; lo = Math.max(lo >= 0 ? 0 : -Infinity, lo - 1); }
  const t0 = pts[0].t, t1 = pts[pts.length - 1].t;
  const X = (t: number) => (t1 === t0 ? W / 2 : P + ((t - t0) / (t1 - t0)) * (W - 2 * P));
  const Y = (v: number) => P + (1 - (v - lo) / (hi - lo)) * (H - 2 * P);
  const last = pts[pts.length - 1];
  return (
    <div ref={ref} className="mt-2 h-9 w-full" aria-hidden>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="chart-svg block">
        {g && <rect className="band" x={0} width={W} y={Y(g.hi ?? hi)} height={Math.max(0, Y(g.lo ?? lo) - Y(g.hi ?? hi))} rx={3} style={{ fill: color }} />}
        <path className="line" pathLength={1} d={pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`).join('')} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {pts.filter((p) => p.bad).map((p) => <circle key={p.t} className="pt" cx={X(p.t)} cy={Y(p.v)} r={2.5} fill="var(--color-destructive)" />)}
        <circle className="pt" cx={X(last.t)} cy={Y(last.v)} r={3.5} fill={last.bad ? 'var(--color-destructive)' : color} stroke="var(--color-card)" strokeWidth={1.5} />
      </svg>
    </div>
  );
}

/** Full chart + table for one lab test. */
export function LabDetail({ test, series, history, sex, domain, onClose }: Omit<Props, 'onOpen'> & { domain?: [number, number]; onClose: () => void }) {
  const last = history[history.length - 1];
  const range = fmtRange(effectiveRange(last.r, sex), unitText(test.unit));
  return (
    <ResponsiveDialog title={test.name} description={[unitText(test.unit), range && `Reference ${range}`, `${test.count} ${test.count === 1 ? 'result' : 'results'} in period`].filter(Boolean).join(' · ')} onClose={onClose} wide>
      <div className="grid grid-cols-1 gap-3">
        {series && <Chart title={test.name} unit={test.unit} series={[series]} colors={[PANEL_COLOR[test.panel]]} domain={domain} />}
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm tabular-nums">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground"><tr><th className="px-3 py-1.5 font-medium">Collected</th><th className="px-3 py-1.5 text-right font-medium">Result</th><th className="hidden px-3 py-1.5 text-right font-medium sm:table-cell">Reference</th></tr></thead>
            <tbody>
              {[...history].reverse().map(({ at, r, lab }, i) => {
                const f = labFlag(r, sex);
                return (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-1.5"><div>{fmtDateTime(at)}</div>{lab && <div className="truncate text-xs text-muted-foreground">{lab}</div>}</td>
                    <td className={cn('px-3 py-1.5 text-right font-semibold', f && 'text-destructive')}>{fmtLabValue(r)}{r.text === undefined && unitText(test.unit) && <span className="ml-1 text-xs font-normal text-muted-foreground">{test.unit}</span>}{f && <div className="text-xs font-medium">{FLAG[f].l}</div>}</td>
                    <td className="hidden px-3 py-1.5 text-right text-xs text-muted-foreground sm:table-cell">{r.text === undefined ? fmtRange(effectiveRange(r, sex)) : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
