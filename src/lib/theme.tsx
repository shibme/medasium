import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type ThemePref = 'system' | 'light' | 'dark';
const KEY = 'medasium.theme';
const mq = () => matchMedia('(prefers-color-scheme: dark)');
const read = (): ThemePref => { try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : 'system'; } catch { return 'system'; } };

interface Ctx { pref: ThemePref; resolved: 'light' | 'dark'; setPref: (p: ThemePref) => void }
const C = createContext<Ctx>({ pref: 'system', resolved: 'light', setPref: () => {} });
export const useTheme = () => useContext(C);

function apply(dark: boolean) {
  const root = document.documentElement;
  root.classList.toggle('dark', dark);
  root.style.colorScheme = dark ? 'dark' : 'light';
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#0b1212' : '#f6f8f8');
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(read);
  const [sysDark, setSysDark] = useState(() => mq().matches);
  useEffect(() => { const m = mq(); const f = () => setSysDark(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  const resolved = pref === 'system' ? (sysDark ? 'dark' : 'light') : pref;
  useEffect(() => apply(resolved === 'dark'), [resolved]);
  const setPref = (p: ThemePref) => { setPrefState(p); try { p === 'system' ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, p); } catch { /* private mode */ } };
  return <C.Provider value={{ pref, resolved, setPref }}>{children}</C.Provider>;
}
