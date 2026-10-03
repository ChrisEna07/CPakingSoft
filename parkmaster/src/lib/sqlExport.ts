import type { CashShift, ParkingRecord, Profile, SupportTicket, Tenant } from './types';

const q = (v: unknown): string => {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
};

function inserts(table: string, rows: Record<string, unknown>[]): string {
  if (!rows.length) return `-- ${table}: sin filas\n`;
  const cols = Object.keys(rows[0]);
  return rows.map(r => `insert into public.${table} (${cols.join(', ')}) values (${cols.map(c => q(r[c])).join(', ')}) on conflict do nothing;`).join('\n') + '\n';
}

export interface TenantDump {
  exported_at: string;
  tenant: Tenant;
  profiles: Profile[];
  parking_records: ParkingRecord[];
  cash_shifts: CashShift[];
  support_tickets: SupportTicket[];
}

/** Script SQL listo para importar en la cuenta Supabase propia del cliente (esquema + datos). */
export function buildSqlDump(schemaSql: string, d: TenantDump): string {
  const t = d.tenant;
  return [
    `-- ParkMaster SaaS - MIGRACIÓN DE TENANT: ${t.business_name} (${t.slug})`,
    `-- Exportado: ${d.exported_at}`,
    `-- 1) Ejecute este script completo en el SQL Editor de la cuenta Supabase del cliente.`,
    `-- 2) Cree los usuarios en Authentication y luego enlace los perfiles (sección PROFILES).`,
    '',
    '-- ===================== ESQUEMA + RLS =====================',
    schemaSql,
    '',
    '-- ===================== DATOS =====================',
    inserts('tenants', [t as unknown as Record<string, unknown>]),
    '-- PROFILES: profiles.id referencia auth.users. Cree primero cada usuario en Auth y reemplace el UUID.',
    ...d.profiles.map(p => `-- insert into public.profiles (id, tenant_id, full_name, email, role, active) values ('<UUID-AUTH-NUEVO>', ${q(p.tenant_id)}, ${q(p.full_name)}, ${q(p.email)}, ${q(p.role)}, ${q(p.active)});`),
    '',
    inserts('parking_records', d.parking_records.map(r => ({ ...r, created_by: null, closed_by: null })) as unknown as Record<string, unknown>[]),
    inserts('cash_shifts', [] as Record<string, unknown>[]),
    `-- cash_shifts (${d.cash_shifts.length}) y support_tickets (${d.support_tickets.length}) referencian profiles: se incluyen en el JSON de la migración; impórtelos tras enlazar los perfiles.`,
  ].join('\n');
}
