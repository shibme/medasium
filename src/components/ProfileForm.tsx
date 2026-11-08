import { useState } from 'react';
import { savePatient } from '@/db';
import { BLOOD_GROUPS, SEVERITY, SEX, type Patient } from '@/model/schema';
import { uid } from '@/lib/format';
import { ResponsiveDialog } from './ResponsiveDialog';
import { Button } from './ui/button';
import { Input, InputSuffix, Textarea } from './ui/input';
import { Field } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useToast } from './ui';

const lines = (s: string) => s.split(/\n|;/).map((x) => x.trim()).filter(Boolean);
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <fieldset className="grid grid-cols-1 gap-3"><legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</legend>{children}</fieldset>
);

export function ProfileForm({ patient, onClose, onSaved }: { patient?: Patient; onClose: () => void; onSaved: (p: Patient) => void }) {
  const toast = useToast();
  const [p, setP] = useState({
    name: patient?.name ?? '', dob: patient?.dateOfBirth ?? '', age: patient?.ageYears?.toString() ?? '', sex: patient?.sex ?? 'unknown',
    conditions: (patient?.conditions ?? []).join('\n'), allergies: (patient?.allergies ?? []).map((a) => [a.substance, a.reaction, a.severity].filter(Boolean).join(' | ')).join('\n'),
    ecName: patient?.emergencyContact?.name ?? '', ecRel: patient?.emergencyContact?.relation ?? '', ecPhone: patient?.emergencyContact?.phone ?? '',
    blood: patient?.bloodGroup ?? '', height: patient?.heightCm?.toString() ?? '', weight: patient?.baselineWeightKg?.toString() ?? '', note: patient?.note ?? '',
  });
  const [err, setErr] = useState('');
  const s = (k: keyof typeof p) => (e: { target: { value: string } }) => setP({ ...p, [k]: e.target.value });
  async function save() {
    if (!p.name.trim()) return setErr('Name is required.');
    if (p.ecPhone.trim() && p.ecPhone.replace(/\D/g, '').length < 10) return setErr('Enter a valid phone number (10 digits, optionally with +91).');
    const allergies = lines(p.allergies).map((l) => {
      const [substance, reaction, sev] = l.split('|').map((x) => x.trim());
      return { substance, ...(reaction ? { reaction } : {}), ...(sev && (SEVERITY as readonly string[]).includes(sev) ? { severity: sev as 'mild' } : {}) };
    });
    const out: Patient = {
      id: patient?.id ?? uid(), name: p.name.trim(),
      ...(p.dob ? { dateOfBirth: p.dob } : p.age ? { ageYears: Math.round(Number(p.age)) } : {}),
      sex: p.sex as Patient['sex'],
      ...(lines(p.conditions).length ? { conditions: lines(p.conditions) } : {}), ...(allergies.length ? { allergies } : {}),
      ...(p.ecName || p.ecPhone ? { emergencyContact: { ...(p.ecName ? { name: p.ecName.trim() } : {}), ...(p.ecRel ? { relation: p.ecRel.trim() } : {}), ...(p.ecPhone ? { phone: p.ecPhone.trim() } : {}) } } : {}),
      ...(p.blood ? { bloodGroup: p.blood as Patient['bloodGroup'] } : {}),
      ...(p.height ? { heightCm: Number(p.height) } : {}), ...(p.weight ? { baselineWeightKg: Number(p.weight) } : {}),
      ...(p.note.trim() ? { note: p.note.trim() } : {}),
    };
    await savePatient(out); toast(patient ? 'Profile updated' : 'Patient added'); onSaved(out);
  }
  return (
    <ResponsiveDialog title={patient ? 'Edit profile' : 'New patient'} onClose={onClose} wide
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save}>Save</Button></>}>
      <div className="grid grid-cols-1 gap-6">
        <Section title="Identity">
          <Field label="Full name"><Input autoFocus value={p.name} onChange={s('name')} autoComplete="off" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date of birth"><Input type="date" value={p.dob} onChange={s('dob')} /></Field>
            <Field label="or age"><InputSuffix suffix="years" type="number" inputMode="numeric" value={p.age} onChange={s('age')} disabled={!!p.dob} /></Field>
            <Field label="Sex">
              <Select value={p.sex} onValueChange={(v) => setP({ ...p, sex: v as typeof p.sex })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SEX.map((x) => <SelectItem key={x} value={x}>{cap(x)}</SelectItem>)}</SelectContent></Select>
            </Field>
            <Field label="Blood group">
              <Select value={p.blood || 'unknown'} onValueChange={(v) => setP({ ...p, blood: v === 'unknown' ? '' : v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unknown">Unknown</SelectItem>{BLOOD_GROUPS.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select>
            </Field>
            <Field label="Height"><InputSuffix suffix="cm" type="number" inputMode="decimal" value={p.height} onChange={s('height')} /></Field>
            <Field label="Baseline weight"><InputSuffix suffix="kg" type="number" inputMode="decimal" value={p.weight} onChange={s('weight')} /></Field>
          </div>
        </Section>
        <Section title="Medical">
          <Field label="Conditions and diagnoses" hint="One per line"><Textarea value={p.conditions} onChange={s('conditions')} placeholder={'Type 2 diabetes\nHypertension'} /></Field>
          <Field label="Allergies" hint="One per line: substance | reaction | mild, moderate or severe"><Textarea value={p.allergies} onChange={s('allergies')} placeholder="Penicillin | Rash | moderate" /></Field>
        </Section>
        <Section title="Emergency contact">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name"><Input value={p.ecName} onChange={s('ecName')} /></Field>
            <Field label="Relation"><Input value={p.ecRel} onChange={s('ecRel')} placeholder="Son, daughter…" /></Field>
          </div>
          <Field label="Phone"><Input type="tel" inputMode="tel" placeholder="+91 98765 43210" value={p.ecPhone} onChange={s('ecPhone')} /></Field>
        </Section>
        <Field label="Notes"><Textarea value={p.note} onChange={s('note')} /></Field>
        {err && <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive-soft px-3 py-2 text-sm text-destructive">{err}</div>}
      </div>
    </ResponsiveDialog>
  );
}
