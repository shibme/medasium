import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { applyImport, listPatients } from './db';
import type { Patient } from './model/schema';
import { loadSample } from './lib/seed';
import { requestPersist, storageWarning } from './lib/storage';

interface Ctx {
  patients: Patient[]; loading: boolean; version: number; warning: string | null;
  refresh: () => Promise<void>; seed: () => Promise<string>;
}
const C = createContext<Ctx>(null!);
export const useStore = () => useContext(C);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const [warning, setWarning] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setPatients(await listPatients()); setVersion((v) => v + 1); setLoading(false);
    setWarning(await storageWarning());
  }, []);
  useEffect(() => { refresh(); requestPersist(); }, [refresh]);
  const seed = useCallback(async () => {
    const data = await loadSample();
    await applyImport(data, 'replace'); // replaces only the sample patient's own record
    await refresh();
    return data.patient.id;
  }, [refresh]);
  return <C.Provider value={{ patients, loading, version, warning, refresh, seed }}>{children}</C.Provider>;
}

/** Remember which patient was last opened. */
export const lastPatient = {
  get: () => localStorage.getItem('medasium.last') ?? undefined,
  set: (id: string) => localStorage.setItem('medasium.last', id),
};
