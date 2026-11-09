import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight, Search, Sparkles, TriangleAlert, UserPlus, Users } from 'lucide-react';
import { ProfileForm } from '@/components/ProfileForm';
import { Avatar, Empty, PageHeader } from '@/components/ui';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ageFrom } from '@/lib/format';
import { SAMPLE_ID } from '@/lib/seed';
import { useStore } from '@/store';

export function Roster() {
  const { patients, loading, refresh } = useStore();
  const [sp, setSp] = useSearchParams();
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  const nav = useNavigate();
  useEffect(() => { if (sp.get('new')) { setAdding(true); setSp({}, { replace: true }); } }, [sp, setSp]);
  const hasSample = patients.some((p) => p.id === SAMPLE_ID);
  const shown = useMemo(() => patients.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase())), [patients, q]);
  return (
    <div>
      <PageHeader title="Patients" subtitle={patients.length ? `${patients.length} in this browser` : undefined}
        actions={patients.length > 0 && <Button onClick={() => setAdding(true)}><UserPlus />Add<span className="hidden sm:inline"> patient</span></Button>} />
      {!loading && !patients.length && (
        <>
          <Empty icon={<Users />} title="No patients yet">Add the first patient to start logging care.</Empty>
          <div className="mx-auto grid max-w-sm gap-2">
            <Button size="lg" onClick={() => setAdding(true)}><UserPlus />Add the first patient</Button>
            <Button size="lg" variant="outline" onClick={() => nav('/import?sample=1')}><Sparkles />Load sample patient</Button>
          </div>
        </>
      )}
      {patients.length > 5 && (
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" placeholder="Search patients" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" aria-label="Search patients" />
        </div>
      )}
      <div className="grid grid-cols-1 gap-2 stagger">
        {shown.map((p) => {
          const age = ageFrom(p.dateOfBirth, p.ageYears);
          return (
            <Link key={p.id} to={`/p/${p.id}`} className="group flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors outline-none hover:bg-accent/40 focus-visible:ring-[3px] focus-visible:ring-ring">
              <Avatar name={p.name} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{p.name}</div>
                <div className="truncate text-sm text-muted-foreground">{[age !== undefined && `${age} y`, p.sex !== 'unknown' && p.sex, p.bloodGroup, p.conditions?.[0]].filter(Boolean).join(' · ')}</div>
                {p.allergies?.length ? <Badge variant="destructive" className="mt-1.5"><TriangleAlert /><span className="truncate">Allergy: {p.allergies.map((a) => a.substance).join(', ')}</span></Badge> : null}
              </div>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          );
        })}
      </div>
      {patients.length > 0 && !hasSample && (
        <Button variant="ghost" className="mt-4 w-full text-muted-foreground" onClick={() => nav('/import?sample=1')}><Sparkles />Load sample patient (demo data)</Button>
      )}
      {adding && <ProfileForm onClose={() => setAdding(false)} onSaved={(p) => { setAdding(false); refresh().then(() => nav(`/p/${p.id}`)); }} />}
    </div>
  );
}
