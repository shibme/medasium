import { useState, type ReactNode } from 'react';
import { Toaster, toast } from 'sonner';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { ResponsiveDialog } from './ResponsiveDialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Field } from './ui/label';

/** Backwards-compatible toast hook (string message), backed by sonner. */
export const useToast = () => notify;
function notify(m: string) {
  if (/fail|error|cannot|could not/i.test(m)) toast.error(m); else toast.success(m);
}
export function ToastProvider({ children }: { children: ReactNode }) {
  const { resolved } = useTheme();
  const desktop = useIsDesktop();
  return (
    <>
      {children}
      <Toaster theme={resolved} position={desktop ? 'bottom-right' : 'top-center'} richColors={false} closeButton={false} duration={2800}
        toastOptions={{ className: '!rounded-xl !border !border-border !bg-popover !text-popover-foreground !shadow-lg' }} offset={desktop ? 24 : 12} mobileOffset={{ top: 'calc(env(safe-area-inset-top) + 10px)' }} />
    </>
  );
}

export function Confirm({ title, body, confirmLabel = 'Delete', onYes, onNo }: { title: string; body: ReactNode; confirmLabel?: string; onYes: () => void | Promise<void>; onNo: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <ResponsiveDialog title={title} onClose={onNo}
      footer={<><Button variant="outline" onClick={onNo}>Cancel</Button><Button variant="destructive" disabled={busy} onClick={async () => { setBusy(true); await onYes(); }}>{confirmLabel}</Button></>}>
      <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
    </ResponsiveDialog>
  );
}

export function PromptReason({ title, onSubmit, onClose }: { title: string; onSubmit: (reason: string) => void; onClose: () => void }) {
  const [r, setR] = useState('');
  const quick = ['Patient asleep', 'Patient refused', 'Not available', 'Doctor advised'];
  return (
    <ResponsiveDialog title={title} description="A skipped task must carry a reason, so missed care is recorded honestly." onClose={onClose}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!r.trim()} onClick={() => onSubmit(r.trim())}>Save</Button></>}>
      <div className="grid grid-cols-1 gap-3">
        <Field label="Reason (required)"><Input autoFocus value={r} onChange={(e) => setR(e.target.value)} placeholder="Why was it skipped?" onKeyDown={(e) => e.key === 'Enter' && r.trim() && onSubmit(r.trim())} /></Field>
        <div className="flex flex-wrap gap-1.5">{quick.map((q) => <Button key={q} type="button" size="sm" variant="secondary" onClick={() => setR(q)}>{q}</Button>)}</div>
      </div>
    </ResponsiveDialog>
  );
}

const AVATAR = ['bg-teal-600', 'bg-sky-600', 'bg-indigo-500', 'bg-orange-600', 'bg-rose-600', 'bg-emerald-600', 'bg-amber-600', 'bg-fuchsia-600'];
export const Avatar = ({ name, className }: { name: string; className?: string }) => {
  const h = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  return (
    <div aria-hidden className={cn('grid size-11 shrink-0 place-items-center rounded-full text-[15px] font-bold text-white ring-2 ring-card', AVATAR[h % AVATAR.length], className)}>
      {name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
    </div>
  );
};

export const Empty = ({ icon, title, children, className }: { icon: ReactNode; title: string; children?: ReactNode; className?: string }) => (
  <div className={cn('flex flex-col items-center px-4 py-10 text-center animate-rise', className)}>
    <div className="mb-4 grid size-16 place-items-center rounded-2xl bg-accent text-accent-foreground [&_svg]:size-8">{icon}</div>
    <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
    <div className="mt-1.5 max-w-sm text-sm text-muted-foreground">{children}</div>
  </div>
);

export const PageHeader = ({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) => (
  <div className="mb-4 flex items-end justify-between gap-3">
    <div className="min-w-0">
      <h1 className="truncate text-2xl font-bold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
    </div>
    {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
  </div>
);
