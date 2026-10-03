export const money = (n: number | null | undefined) => '$' + Math.round(n ?? 0).toLocaleString('es-CO');
const pad = (n: number, l = 2) => String(n).padStart(l, '0');
export const dkey = (d: string | number | Date) => { const x = new Date(d); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
export const fmtDate = (d: string | number | Date) => { const x = new Date(d); return `${pad(x.getDate())}/${pad(x.getMonth() + 1)}/${x.getFullYear()}`; };
export const fmtTime = (d: string | number | Date) => { const x = new Date(d); return `${pad(x.getHours())}:${pad(x.getMinutes())}:${pad(x.getSeconds())}`; };
export const fmtHM = (d: string | number | Date) => { const x = new Date(d); const h = x.getHours(); return `${pad(h % 12 || 12)}:${pad(x.getMinutes())} ${h < 12 ? 'AM' : 'PM'}`; };
export const fmtDT = (d: string | number | Date) => `${fmtDate(d)} ${fmtTime(d)}`;
export const fmtDT_CO = (d: string | number | Date | null | undefined): string => {
  if (!d) return '-';
  const x = new Date(d);
  if (isNaN(x.getTime())) return '-';
  const day = pad(x.getDate());
  const month = pad(x.getMonth() + 1);
  const year = x.getFullYear();
  const hoursRaw = x.getHours();
  const hours12 = pad(hoursRaw % 12 || 12);
  const mins = pad(x.getMinutes());
  const secs = pad(x.getSeconds());
  const ampm = hoursRaw < 12 ? 'am' : 'pm';
  return `${day}/${month}/${year} ${hours12}:${mins}:${secs} ${ampm}`;
};
export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = (Math.random() * 16) | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); });
export const durText = (min: number) => {
  const m = Math.max(0, Math.floor(min)), h = Math.floor(m / 60), r = m % 60;
  const p: string[] = [];
  if (h) p.push(`${h} ${h === 1 ? 'hora' : 'horas'}`);
  if (r || !h) p.push(`${r} ${r === 1 ? 'minuto' : 'minutos'}`);
  return p.join(' ');
};
export const padN = pad;

export function downloadFile(name: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
}

export function toCSV(rows: Record<string, unknown>[], cols: string[]): string {
  const esc = (v: unknown) => { const s = v == null ? '' : String(v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return '\uFEFF' + cols.join(';') + '\r\n' + rows.map(r => cols.map(c => esc(r[c])).join(';')).join('\r\n');
}
