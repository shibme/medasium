import { useEffect, useRef, useState } from 'react';
import { HashRouter, Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { CalendarCheck, FileInput, HardDrive, Plus, TriangleAlert, Users } from 'lucide-react';
import { EntryForm } from './components/EntryForm';
import { ThemeToggle } from './components/ThemeToggle';
import { ToastProvider } from './components/ui';
import { Button } from './components/ui/button';
import { ThemeProvider } from './lib/theme';
import { cn } from './lib/utils';
import { ImportScreen } from './screens/Import';
import { PatientScreen } from './screens/Patient';
import { Roster } from './screens/Roster';
import { Today } from './screens/Today';
import { lastPatient, StoreProvider, useStore } from './store';

const NAV = [
  { to: '/', label: 'Today', icon: CalendarCheck, end: true },
  { to: '/patients', label: 'Patients', icon: Users },
  { to: '/import', label: 'Import', icon: FileInput },
];

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring">
      <span className="grid size-8 place-items-center rounded-[10px] bg-gradient-to-br from-teal-500 to-teal-700 text-white shadow-sm shadow-teal-900/20">
        <Plus className="size-5" strokeWidth={3} />
      </span>
      <span className="text-[17px] font-bold tracking-tight">Medasium</span>
    </Link>
  );
}

function Shell() {
  const { patients, warning, refresh } = useStore();
  const [quick, setQuick] = useState<{ patientId?: string } | null>(null);
  const patientAdd = useRef<(() => void) | null>(null);
  const loc = useLocation();
  const nav = useNavigate();
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);
  const setRef = useRef((fn: (() => void) | null) => { patientAdd.current = fn; }).current;
  const onPatient = loc.pathname.startsWith('/p/');
  const showFab = patients.length > 0 && (loc.pathname === '/' || onPatient);

  const quickAdd = (patientId?: string) => {
    if (onPatient && patientAdd.current && !patientId) return patientAdd.current();
    const id = patientId ?? patients.find((p) => p.id === lastPatient.get())?.id ?? (patients.length === 1 ? patients[0].id : undefined);
    if (id) setQuick({ patientId: id }); else if (patients.length) nav('/patients'); else nav('/patients?new=1');
  };

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r bg-card/60 px-4 py-5 md:flex">
        <Logo />
        <nav className="grid grid-cols-1 gap-1" aria-label="Main">
          {NAV.map(({ to, label, icon: I, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground', isActive && 'bg-accent text-accent-foreground')}>
              <I className="size-[18px]" />{label}
            </NavLink>
          ))}
        </nav>
        {patients.length > 0 && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Patients</div>
            <div className="grid grid-cols-1 gap-0.5">
              {patients.map((p) => (
                <NavLink key={p.id} to={`/p/${p.id}`} className={({ isActive }) => cn('truncate rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground', isActive && 'bg-accent font-semibold text-accent-foreground')}>{p.name}</NavLink>
              ))}
            </div>
          </div>
        )}
        <div className="mt-auto flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><HardDrive className="size-3.5" />Stored on this device only</span>
          <ThemeToggle />
        </div>
      </aside>

      <div className="min-w-0">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-transparent bg-background/85 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-lg supports-[backdrop-filter]:bg-background/70 md:hidden">
          <Logo />
          <div className="flex items-center">
            <span className="mr-1 flex items-center gap-1 text-[11px] text-muted-foreground" title="All data stays in this browser"><HardDrive className="size-3.5" />Local only</span>
            <ThemeToggle />
          </div>
        </header>

        <main className="mx-auto w-full max-w-3xl px-4 pb-[calc(env(safe-area-inset-bottom)+6.5rem)] pt-3 md:px-8 md:pb-12 md:pt-8">
          {warning && (
            <div role="alert" className="mb-4 flex gap-2.5 rounded-xl border border-warning/40 bg-warning-soft p-3 text-sm text-foreground">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />{warning}
            </div>
          )}
          <Routes>
            <Route path="/" element={<Today onAdd={quickAdd} />} />
            <Route path="/patients" element={<Roster />} />
            <Route path="/p/:id" element={<PatientScreen onAddRef={setRef} />} />
            <Route path="/import" element={<ImportScreen />} />
            <Route path="*" element={<Today onAdd={quickAdd} />} />
          </Routes>
        </main>
      </div>

      {showFab && (
        <Button onClick={() => quickAdd()} aria-label="Add entry"
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+5rem)] right-4 z-30 size-14 rounded-2xl shadow-lg shadow-teal-900/25 animate-rise md:hidden [&_svg]:size-6">
          <Plus strokeWidth={2.5} />
        </Button>
      )}

      {/* Mobile tab bar */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t bg-nav pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-3 gap-1 px-3 py-1.5">
          {NAV.map(({ to, label, icon: I, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => cn('group flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors', isActive && 'text-primary')}>
              {({ isActive }) => <>
                <span className={cn('grid h-7 w-12 place-items-center rounded-full transition-colors', isActive && 'bg-accent')}><I className="size-5" strokeWidth={isActive ? 2.4 : 2} /></span>
                {label}
              </>}
            </NavLink>
          ))}
        </div>
      </nav>

      {quick?.patientId && <EntryForm patientId={quick.patientId} onClose={() => setQuick(null)} onSaved={() => { setQuick(null); refresh(); }} />}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <HashRouter><ToastProvider><StoreProvider><Shell /></StoreProvider></ToastProvider></HashRouter>
    </ThemeProvider>
  );
}
