import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChartLine, Table2, TriangleAlert } from 'lucide-react';
import type { Series } from '@/lib/series';
import { fmtDate, fmtDateTime } from '@/lib/format';
import { fmtNumber as fmtNum } from '@/lib/labs';
import { fmtRange } from '@/model/labs';
import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';

const H = 200, L = 40, R = 12, T = 12, B = 26;
interface Props { title: string; unit: string; series: Series[]; colors: string[]; domain?: [number, number] }

export function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(600);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** SVG line chart sized to its container: reference band, animated line, out-of-range diamonds, hover tooltip, table view. */
export function Chart({ title, unit, series, colors, domain }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [box, W] = useWidth();
  const svg = useRef<SVGSVGElement>(null);
  const all = useMemo(() => series.flatMap((s) => s.points), [series]);
  const g = useMemo(() => {
    const vs = all.map((p) => p.v);
    const bands = series.map((s) => s.range).filter(Boolean) as { lo?: number; hi?: number }[];
    let lo = Math.min(...vs, ...bands.map((b) => b.lo ?? Infinity)), hi = Math.max(...vs, ...bands.map((b) => b.hi ?? -Infinity));
    if (!isFinite(lo)) lo = Math.min(...vs);
    if (!isFinite(hi)) hi = Math.max(...vs);
    const nonNeg = lo >= 0;
    const pad = (hi - lo || 1) * 0.12; lo -= pad; hi += pad;
    if (nonNeg) lo = Math.max(0, lo); // never draw a negative axis for quantities that can't be negative
    const ts = all.map((p) => p.t);
    const t0 = domain?.[0] ?? Math.min(...ts), t1 = domain?.[1] ?? Math.max(...ts);
    const X = (t: number) => (t1 === t0 ? (L + W - R) / 2 : L + ((t - t0) / (t1 - t0)) * (W - L - R));
    const Y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
    return { lo, hi, t0, t1, X, Y };
  }, [all, series, domain, W]);
  if (!all.length) return null;
  const { X, Y } = g;
  const ticks = [0, 1, 2, 3].map((i) => g.lo + ((g.hi - g.lo) * i) / 3);
  const step = (g.hi - g.lo) / 3;
  const tickDp = step >= 5 ? 0 : step >= 0.5 ? 1 : step >= 0.05 ? 2 : 3;
  const nx = W < 420 ? 2 : 3;
  const xt = g.t1 === g.t0 ? [g.t0] : Array.from({ length: nx }, (_, i) => g.t0 + ((g.t1 - g.t0) * i) / (nx - 1));
  const sorted = [...new Set(all.map((p) => p.t))].sort((a, b) => a - b);
  const onMove = (ev: React.PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    const x = ((ev.clientX - r.left) / r.width) * W;
    let best = sorted[0], bd = Infinity;
    for (const t of sorted) { const d = Math.abs(X(t) - x); if (d < bd) { bd = d; best = t; } }
    setHover(best);
  };
  const hp = hover === null ? [] : series.map((s, i) => ({ s, i, p: s.points.find((p) => p.t === hover) })).filter((x) => x.p);
  const bad = all.filter((p) => p.bad).length;
  const single = all.length === 1;
  const dense = all.length > 60;
  const range = series[0].range;

  return (
    <Card className="overflow-hidden animate-rise">
      <div className="flex items-start justify-between gap-2 p-4 pb-1">
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold tracking-tight">{title}</h3>
          <div className="mt-0.5 text-xs text-muted-foreground">{unit && unit !== 'ratio' ? `${unit} · ` : ''}{all.length} {all.length === 1 ? 'reading' : 'readings'}</div>
          {series.length > 1 && <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">{series.map((s, i) => <span key={s.key} className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-[3px]" style={{ background: colors[i] }} />{s.label}</span>)}</div>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as 'chart' | 'table')} aria-label="View">
            <ToggleGroupItem value="chart" aria-label="Chart view"><ChartLine /></ToggleGroupItem>
            <ToggleGroupItem value="table" aria-label="Table view"><Table2 /></ToggleGroupItem>
          </ToggleGroup>
          {bad > 0 && <Badge variant="destructive"><TriangleAlert />{bad} out of range</Badge>}
        </div>
      </div>

      <div ref={box} className="px-2 pb-2">
        {view === 'table' ? (
          <div className="max-h-64 overflow-auto px-2">
            <table className="w-full text-sm tabular-nums">
              <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground"><tr><th className="py-1.5 pr-2 font-medium">When</th>{series.map((s) => <th key={s.key} className="py-1.5 pr-2 text-right font-medium">{series.length > 1 ? s.label : unit}</th>)}</tr></thead>
              <tbody>{[...sorted].reverse().map((t) => <tr key={t} className="border-t"><td className="py-1.5 pr-2 text-muted-foreground">{fmtDateTime(new Date(t))}</td>{series.map((s) => { const p = s.points.find((q) => q.t === t); return <td key={s.key} className={p?.bad ? 'py-1.5 pr-2 text-right font-semibold text-destructive' : 'py-1.5 pr-2 text-right'}>{p ? `${p.q ?? ''}${fmtNum(p.v)}${p.bad ? ' ◆' : ''}` : ''}</td>; })}</tr>)}</tbody>
            </table>
          </div>
        ) : (
          <div className="relative">
            <svg ref={svg} className="chart-svg" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`${title} chart, ${all.length} readings, ${bad} out of range`}
              onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)}>
              {series.map((s, i) => s.range && (
                <rect key={'b' + s.key} className="band" x={L} width={W - L - R} rx={4}
                  y={Y(s.range.hi ?? g.hi)} height={Math.max(0, Y(s.range.lo ?? g.lo) - Y(s.range.hi ?? g.hi))} style={{ fill: colors[i] }} />
              ))}
              {ticks.map((v) => <g key={v}><line className="grid" x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} /><text className="axis" x={L - 6} y={Y(v) + 4} textAnchor="end">{v.toFixed(tickDp)}</text></g>)}
              {xt.map((t, i) => <text key={t} className="axis" x={X(t)} y={H - 6} textAnchor={xt.length === 1 ? 'middle' : i === 0 ? 'start' : i === xt.length - 1 ? 'end' : 'middle'}>{fmtDate(new Date(t)).slice(0, 5)}</text>)}
              {series.map((s, i) => !single && s.points.length > 1 && (
                <path key={'l' + s.key} className="line" pathLength={1} fill="none" stroke={colors[i]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
                  d={s.points.map((p, k) => `${k ? 'L' : 'M'}${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`).join('')} />
              ))}
              {series.map((s, i) => s.points.map((p) => p.bad
                ? <path key={s.key + p.t + p.v} className="pt" d={`M${X(p.t)},${Y(p.v) - 5.5}l4.5,5.5l-4.5,5.5l-4.5,-5.5z`} fill="var(--color-destructive)" stroke="var(--color-card)" strokeWidth={1.5} />
                : (!dense || single) && <circle key={s.key + p.t + p.v} className="pt" cx={X(p.t)} cy={Y(p.v)} r={single ? 5 : 3} fill={colors[i]} stroke="var(--color-card)" strokeWidth={1.5} />))}
              {hover !== null && <>
                <line className="cross" x1={X(hover)} x2={X(hover)} y1={T} y2={H - B} />
                {hp.map(({ s, i, p }) => <circle key={'h' + s.key} cx={X(p!.t)} cy={Y(p!.v)} r={5} fill={colors[i]} stroke="var(--color-card)" strokeWidth={2} />)}
              </>}
            </svg>
            {hover !== null && hp.length > 0 && (
              <div className="pointer-events-none absolute top-1 z-10 rounded-lg border bg-popover px-2.5 py-1.5 text-xs shadow-lg"
                style={X(hover) > W / 2 ? { right: W - X(hover) + 10 } : { left: X(hover) + 10 }}>
                <div className="whitespace-nowrap text-muted-foreground">{fmtDateTime(new Date(hover))}</div>
                {hp.map(({ s, i, p }) => (
                  <div key={s.key} className="flex items-center gap-1.5 whitespace-nowrap">
                    <i className="size-2 rounded-[2px]" style={{ background: colors[i] }} />
                    {series.length > 1 && <span className="text-muted-foreground">{s.label}</span>}
                    <b className="tabular-nums">{p!.q ?? ''}{fmtNum(p!.v)}</b>{unit !== 'ratio' && <span className="text-muted-foreground">{unit}</span>}
                    {p!.bad && <span className="font-semibold text-destructive">◆</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {view === 'chart' && (single || range) && (
        <p className="border-t px-4 py-2 text-xs text-muted-foreground">
          {single ? 'Only one reading in this period, so no trend line is drawn. ' : ''}
          {range && <>Shaded band: reference {series.length > 1 ? 'ranges' : `range ${fmtRange(range, unit !== 'ratio' ? unit : '')}`}. <span className="text-destructive">◆</span> marks readings outside it.</>}
        </p>
      )}
    </Card>
  );
}
