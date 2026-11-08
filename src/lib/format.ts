// India-first formatting: en-IN, IST, DD/MM/YYYY, 12-hour time.
export const TZ = 'Asia/Kolkata';
const dFmt = new Intl.DateTimeFormat('en-IN', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' });
const dlFmt = new Intl.DateTimeFormat('en-IN', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const tFmt = new Intl.DateTimeFormat('en-IN', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true });
const ymdFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

export const fmtDate = (d: Date | string) => dFmt.format(new Date(d));
export const fmtDateLong = (d: Date | string) => dlFmt.format(new Date(d));
export const fmtTime = (d: Date | string) => tFmt.format(new Date(d)).toUpperCase();
export const fmtDateTime = (d: Date | string) => `${fmtDate(d)}, ${fmtTime(d)}`;
/** YYYY-MM-DD of an instant in IST. */
export const ymd = (d: Date | string) => ymdFmt.format(new Date(d));
/** Instant for a given IST calendar day + "HH:MM". */
export const istInstant = (day: string, hhmm = '00:00') => new Date(`${day}T${hhmm}:00+05:30`);
export const toIstIso = (d: Date) => {
  const day = ymd(d);
  const t = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(d);
  return `${day}T${t}+05:30`;
};
export const addDays = (day: string, n: number) => ymd(new Date(istInstant(day, '12:00').getTime() + n * 86400000));
export const nowIst = () => toIstIso(new Date());
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));

export const ageFrom = (dob?: string, years?: number) => {
  if (dob) {
    const t = ymd(new Date()).split('-').map(Number), b = dob.split('-').map(Number);
    let a = t[0] - b[0];
    if (t[1] < b[1] || (t[1] === b[1] && t[2] < b[2])) a--;
    return a;
  }
  return years;
};
export const fmtNum = (n: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 }).format(n);
/** Normalise to +91 XXXXX XXXXX when it looks like an Indian mobile number. */
export const fmtPhone = (p?: string) => {
  if (!p) return '';
  const d = p.replace(/\D/g, '');
  const m = d.length === 12 && d.startsWith('91') ? d.slice(2) : d.length === 10 ? d : null;
  return m ? `+91 ${m.slice(0, 5)} ${m.slice(5)}` : p;
};
export const EMERGENCY = [{ n: '112', l: 'National emergency' }, { n: '108', l: 'Ambulance' }];
