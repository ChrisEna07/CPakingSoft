'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { supabase } from './supabase';
import { kvGet, kvSet } from './db';
import { seedTenants, seedUsers, type LocalUser } from './seed';
import { liquidate, shiftTotals } from './billing';
import { displayPlate, normalizePlate, validatePlate } from './validators';
import { fmtHM, padN, uid } from './format';
import {
  EMPTY_DATA, DEFAULT_CONFIG,
  type CashShift, type LegalAcceptance, type ParkingRecord, type PaymentMethod, type Profile, type QueueItem, type SupportTicket, type SyncTable,
  type Tenant, type TenantData, type VehicleType, type Role,
} from './types';

export type ToastKind = 'ok' | 'err' | 'info';
export interface ToastMsg { id: number; kind: ToastKind; msg: string }
export interface Session { profile: Profile; tenant: Tenant | null }
export interface ActionResult<T = undefined> { ok: boolean; kind: ToastKind; message: string; data?: T }

interface Ctx {
  ready: boolean;
  mode: 'supabase' | 'local';
  online: boolean;
  syncing: boolean;
  syncError: string | null;
  session: Session | null;
  data: TenantData;
  tenants: Tenant[];
  toasts: ToastMsg[];
  toast: (kind: ToastKind, msg: string) => void;
  dismissToast: (id: number) => void;
  login: (email: string, password: string) => Promise<{ error: string | null; role?: Role; userId?: string }>;
  logout: () => Promise<void>;
  openShiftOf: () => CashShift | null;
  registerEntry: (plateRaw: string, type: VehicleType) => ActionResult<ParkingRecord>;
  registerExit: (recordId: string, method: PaymentMethod) => ActionResult<ParkingRecord>;
  openShift: (base: number) => ActionResult<CashShift>;
  closeShift: (reported: number) => ActionResult<CashShift>;
  addSupportTicket: (description: string, screenshotName: string | null) => void;
  saveTenant: (t: Tenant) => Promise<ActionResult>;
  createTenant: (t: Tenant, adminEmail: string, adminName: string, adminPassword: string) => Promise<ActionResult>;
  loadEmployees: () => Promise<Profile[]>;
  createEmployee: (fullName: string, email: string, password: string) => Promise<ActionResult>;
  setEmployeeActive: (id: string, active: boolean) => Promise<ActionResult>;
  fetchTenantDump: (tenantId: string) => Promise<{ profiles: Profile[]; records: ParkingRecord[]; shifts: CashShift[]; tickets: SupportTicket[] }>;
  resolveSupport: (tenantId: string) => Promise<void>;
  legalAccepted: boolean;
  recordLegalAcceptance: (terms: boolean, privacy: boolean, custody: boolean) => Promise<ActionResult>;
  loadLegalAcceptances: () => Promise<LegalAcceptance[]>;
}

const StoreCtx = createContext<Ctx | null>(null);
export const useStore = (): Ctx => {
  const c = useContext(StoreCtx);
  if (!c) throw new Error('useStore fuera de StoreProvider');
  return c;
};

// ---------- helpers ----------
const upsertById = <T extends { id: string }>(list: T[], item: T): T[] => {
  const i = list.findIndex(x => x.id === item.id);
  if (i === -1) return [...list, item];
  const c = list.slice(); c[i] = item; return c;
};
const enqueue = (queue: QueueItem[], table: SyncTable, row: QueueItem['row']): QueueItem[] =>
  [...queue.filter(x => !(x.table === table && x.row.id === row.id)), { id: `${table}:${row.id}`, table, row }];

const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const normRecord = (r: Record<string, unknown>): ParkingRecord => ({
  ...(r as unknown as ParkingRecord),
  total_minutes: num(r.total_minutes), billed_hours: num(r.billed_hours), total_amount: num(r.total_amount), sync_status: 'synced',
});
const normShift = (s: Record<string, unknown>): CashShift => ({
  ...(s as unknown as CashShift),
  initial_base_cash: Number(s.initial_base_cash ?? 0), system_calculated_cash: num(s.system_calculated_cash), reported_cash: num(s.reported_cash), difference: num(s.difference),
});
const normTenant = (t: Record<string, unknown>): Tenant => ({
  ...(t as unknown as Tenant),
  monthly_fee_cop: Number(t.monthly_fee_cop ?? 0),
  config_json: { ...DEFAULT_CONFIG, ...((t.config_json as object) || {}) },
});

function maxTicketNumber(records: ParkingRecord[], tag: 'MTO' | 'CAR'): number {
  let max = 0;
  records.forEach(r => {
    const parts = r.ticket_code.split('-');
    if (parts[parts.length - 2] === tag) max = Math.max(max, parseInt(parts[parts.length - 1], 10) || 0);
  });
  return max;
}

const ok = <T,>(message: string, data?: T, kind: ToastKind = 'ok'): ActionResult<T> => ({ ok: true, kind, message, data });
const fail = <T,>(message: string, kind: ToastKind = 'err'): ActionResult<T> => ({ ok: false, kind, message });

export function StoreProvider({ children }: { children: ReactNode }) {
  const mode: 'supabase' | 'local' = supabase ? 'supabase' : 'local';
  const [ready, setReady] = useState(false);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<TenantData>(EMPTY_DATA);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [legalAccepted, setLegalAccepted] = useState(true);

  const dataRef = useRef(data); dataRef.current = data;
  const sessionRef = useRef(session); sessionRef.current = session;
  const remoteFlag = useRef(false);
  const syncingRef = useRef(false);
  const bc = useRef<BroadcastChannel | null>(null);
  const tid = session?.tenant?.id ?? null;

  const toast = useCallback((kind: ToastKind, msg: string) => {
    const id = Math.random();
    setToasts(t => [...t.slice(-3), { id, kind, msg }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), kind === 'err' ? 9000 : 6000);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts(t => t.filter(x => x.id !== id)), []);

  // ---------- conectividad ----------
  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => { setOnline(true); toast('info', 'Conexión restablecida: sincronizando cola pendiente…'); };
    const off = () => { setOnline(false); toast('info', 'Modo Local / Desconectado: las operaciones se guardan en este equipo y se sincronizarán al volver internet.'); };
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, [toast]);

  // ---------- carga de datos del tenant ----------
  const loadTenantData = useCallback(async (tenantId: string): Promise<TenantData> => {
    const local = { ...EMPTY_DATA, ...(await kvGet<TenantData>(`snap:${tenantId}`, EMPTY_DATA)) };
    if (!supabase || !navigator.onLine) return local;
    try {
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const [a, b, s, t] = await Promise.all([
        supabase.from('parking_records').select('*').eq('tenant_id', tenantId).eq('status', 'dentro'),
        supabase.from('parking_records').select('*').eq('tenant_id', tenantId).neq('status', 'dentro').gte('entry_time', since).limit(5000),
        supabase.from('cash_shifts').select('*').eq('tenant_id', tenantId).gte('opened_at', since),
        supabase.from('support_tickets').select('*').eq('tenant_id', tenantId),
      ]);
      if (a.error || b.error || s.error || t.error) throw new Error('fetch');
      let records = [...(a.data ?? []), ...(b.data ?? [])].map(r => normRecord(r as Record<string, unknown>));
      let shifts = (s.data ?? []).map(x => normShift(x as Record<string, unknown>));
      local.queue.forEach(item => {
        if (item.table === 'parking_records') records = upsertById(records, item.row as ParkingRecord);
        if (item.table === 'cash_shifts') shifts = upsertById(shifts, item.row as CashShift);
      });
      return {
        records, shifts, tickets: (t.data ?? []) as SupportTicket[], queue: local.queue,
        counters: { moto: Math.max(local.counters.moto, maxTicketNumber(records, 'MTO')), carro: Math.max(local.counters.carro, maxTicketNumber(records, 'CAR')) },
      };
    } catch { return local; }
  }, []);

  const bootstrapProfile = useCallback(async (profile: Profile, tenant: Tenant | null) => {
    if (profile.role === 'superadmin' || profile.role === 'tenant_admin') {
      const cached = await kvGet<boolean>(`legal_accepted:${profile.id}:v1.0.0`, false);
      if (cached) {
        setLegalAccepted(true);
      } else {
        let accepted = false;
        if (supabase && navigator.onLine) {
          try {
            const { data: la } = await supabase
              .from('legal_acceptances')
              .select('id')
              .eq('profile_id', profile.id)
              .eq('agreement_version', 'v1.0.0')
              .limit(1);
            if (la && la.length > 0) {
              accepted = true;
              await kvSet(`legal_accepted:${profile.id}:v1.0.0`, true);
            }
          } catch {
            // fallback
          }
        }
        setLegalAccepted(accepted);
      }
    } else {
      setLegalAccepted(true);
    }

    if (profile.role === 'superadmin') {
      if (supabase && navigator.onLine) {
        const { data: ts } = await supabase.from('tenants').select('*').order('created_at');
        const list = (ts ?? []).map(t => normTenant(t as Record<string, unknown>));
        setTenants(list); await kvSet('sa:tenants:cache', list);
      } else if (supabase) setTenants(await kvGet<Tenant[]>('sa:tenants:cache', []));
      else {
        let list = await kvGet<Tenant[] | null>('sa:tenants', null);
        if (!list) { list = seedTenants(); await kvSet('sa:tenants', list); }
        setTenants(list);
      }
      setData(EMPTY_DATA); setSession({ profile, tenant: null });
      return;
    }
    const d = tenant ? await loadTenantData(tenant.id) : EMPTY_DATA;
    setData(d); setSession({ profile, tenant });
  }, [loadTenantData]);

  const bootstrapSupabase = useCallback(async (userId: string): Promise<string | null> => {
    if (!supabase) return 'Supabase no configurado';
    let profile: Profile | null = null; let tenant: Tenant | null = null;
    if (navigator.onLine) {
      const { data: p } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
      if (p) {
        profile = p as Profile;
        if (profile.tenant_id) {
          const { data: t } = await supabase.from('tenants').select('*').eq('id', profile.tenant_id).maybeSingle();
          if (t) tenant = normTenant(t as Record<string, unknown>);
        }
        await kvSet(`ctx:${userId}`, { profile, tenant });
      }
    }
    if (!profile) {
      const cached = await kvGet<{ profile: Profile; tenant: Tenant | null } | null>(`ctx:${userId}`, null);
      if (cached) { profile = cached.profile; tenant = cached.tenant; }
    }
    if (!profile) return 'Su usuario no tiene un perfil asignado. Contacte al administrador.';
    if (!profile.active) return 'Su cuenta está desactivada. Contacte al administrador.';
    await bootstrapProfile(profile, tenant);
    return null;
  }, [bootstrapProfile]);

  // ---------- arranque ----------
  useEffect(() => {
    (async () => {
      if (supabase) {
        const { data: s } = await supabase.auth.getSession();
        if (s.session) await bootstrapSupabase(s.session.user.id);
      } else {
        let users = await kvGet<LocalUser[] | null>('local:users', null);
        if (!users) { users = seedUsers(); await kvSet('local:users', users); }
        const sid = await kvGet<string | null>('local:session', null);
        const u = users.find(x => x.id === sid && x.active);
        if (u) await bootstrapLocal(u);
      }
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bootstrapLocal = useCallback(async (u: LocalUser) => {
    let list = await kvGet<Tenant[] | null>('sa:tenants', null);
    if (!list) { list = seedTenants(); await kvSet('sa:tenants', list); }
    const tenant = u.tenant_id ? list.find(t => t.id === u.tenant_id) ?? null : null;
    const { password: _pw, ...profile } = u; void _pw;
    await bootstrapProfile(profile, tenant);
  }, [bootstrapProfile]);

  const login = useCallback(async (email: string, password: string): Promise<{ error: string | null; role?: Role; userId?: string }> => {
    let mail = email.trim();
    if (mail.toLowerCase() === 'chrizdev07') {
      mail = 'christianjoroce@gmail.com';
    } else {
      mail = mail.toLowerCase();
    }

    if (supabase) {
      if (!navigator.onLine) return { error: 'Sin conexión: el primer inicio de sesión requiere internet.' };
      const { data: r, error } = await supabase.auth.signInWithPassword({ email: mail, password });
      if (error || !r.user) return { error: 'Credenciales incorrectas. Verifique usuario/correo y contraseña.' };

      // Consulta la tabla profiles con el user.id
      const { data: p } = await supabase.from('profiles').select('*').eq('id', r.user.id).maybeSingle();
      if (p && !p.active) {
        await supabase.auth.signOut();
        return { error: 'Su cuenta está desactivada. Contacte al administrador.' };
      }

      const err = await bootstrapSupabase(r.user.id);
      if (err) {
        await supabase.auth.signOut();
        return { error: err };
      }

      const role: Role = (p?.role as Role) || 'cajero';
      return { error: null, role, userId: r.user.id };
    }

    const users = await kvGet<LocalUser[]>('local:users', seedUsers());
    const u = users.find(x => (x.email.toLowerCase() === mail || (mail === 'christianjoroce@gmail.com' && x.role === 'superadmin')) && x.password === password);
    if (!u) return { error: 'Credenciales incorrectas. Verifique usuario/correo y contraseña.' };
    if (!u.active) return { error: 'Su cuenta está desactivada. Contacte al administrador.' };
    await kvSet('local:session', u.id);
    await bootstrapLocal(u);
    return { error: null, role: u.role, userId: u.id };
  }, [bootstrapLocal, bootstrapSupabase]);

  const logout = useCallback(async () => {
    if (supabase) await supabase.auth.signOut(); else await kvSet('local:session', null);
    setSession(null); setData(EMPTY_DATA); setLegalAccepted(true);
  }, []);

  // ---------- persistencia local + difusión entre pestañas ----------
  useEffect(() => {
    if (!tid) return;
    kvSet(`snap:${tid}`, data);
    if (remoteFlag.current) remoteFlag.current = false;
    else bc.current?.postMessage({ tid, data });
  }, [data, tid]);

  useEffect(() => {
    if (!tid || typeof BroadcastChannel === 'undefined') return;
    const ch = new BroadcastChannel('tenant_parking');
    bc.current = ch;
    ch.onmessage = e => { if (e.data?.tid === tid) { remoteFlag.current = true; setData(e.data.data as TenantData); } };
    return () => { ch.close(); bc.current = null; };
  }, [tid]);

  // ---------- sincronización de la cola ----------
  const runSync = useCallback(async () => {
    if (!supabase || !navigator.onLine || syncingRef.current || !sessionRef.current?.tenant) return;
    const queue = dataRef.current.queue;
    if (!queue.length) { setSyncError(null); return; }
    syncingRef.current = true; setSyncing(true);
    try {
      for (const item of queue) {
        const row = item.table === 'parking_records' ? { ...(item.row as ParkingRecord), sync_status: 'synced' } : item.row;
        const { error } = await supabase.from(item.table).upsert(row as never, { onConflict: 'id' });
        if (error) { setSyncError(`${item.table}: ${error.message}`); return; }
        setData(d => ({
          ...d,
          queue: d.queue.filter(x => !(x.id === item.id && x.row === item.row)),
          records: item.table === 'parking_records' ? d.records.map(r => (r === item.row ? { ...r, sync_status: 'synced' as const } : r)) : d.records,
        }));
      }
      setSyncError(null);
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : 'Error de red');
    } finally { syncingRef.current = false; setSyncing(false); }
  }, []);

  useEffect(() => {
    if (!supabase || !tid) return;
    if (online && data.queue.length) runSync();
  }, [online, data.queue, tid, runSync]);
  useEffect(() => {
    if (!supabase || !tid) return;
    const i = setInterval(runSync, 20000);
    return () => clearInterval(i);
  }, [tid, runSync]);

  // ---------- latido (heartbeat) ----------
  useEffect(() => {
    if (!tid) return;
    const beat = async () => {
      if (!navigator.onLine) return;
      if (supabase) { await supabase.rpc('heartbeat'); return; }
      const list = await kvGet<Tenant[] | null>('sa:tenants', null);
      if (list) await kvSet('sa:tenants', list.map(t => (t.id === tid ? { ...t, is_online: true, last_seen_at: new Date().toISOString() } : t)));
    };
    beat();
    const i = setInterval(beat, 60000);
    return () => clearInterval(i);
  }, [tid]);

  // ---------- realtime ----------
  useEffect(() => {
    if (!supabase || !tid) return;
    const sb = supabase;
    const ch = sb.channel('tenant_parking')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parking_records', filter: `tenant_id=eq.${tid}` }, p => {
        const row = p.new as Record<string, unknown>;
        if (!row || !row.id) return;
        setData(d => (d.queue.some(x => x.row.id === row.id) ? d : { ...d, records: upsertById(d.records, normRecord(row)) }));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_shifts', filter: `tenant_id=eq.${tid}` }, p => {
        const row = p.new as Record<string, unknown>;
        if (!row || !row.id) return;
        setData(d => (d.queue.some(x => x.row.id === row.id) ? d : { ...d, shifts: upsertById(d.shifts, normShift(row)) }));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tenants', filter: `id=eq.${tid}` }, p => {
        setSession(s => (s ? { ...s, tenant: normTenant(p.new as Record<string, unknown>) } : s));
      })
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [tid]);

  // ---------- acciones operativas ----------
  const openShiftOf = useCallback((): CashShift | null => {
    const s = sessionRef.current; if (!s) return null;
    return dataRef.current.shifts.find(x => x.status === 'abierto' && x.cashier_id === s.profile.id) ?? null;
  }, []);

  const pushRecord = (r: ParkingRecord) => setData(d => ({ ...d, records: upsertById(d.records, r), queue: enqueue(d.queue, 'parking_records', r) }));
  const pushShift = (s: CashShift) => setData(d => ({ ...d, shifts: upsertById(d.shifts, s), queue: enqueue(d.queue, 'cash_shifts', s) }));

  const registerEntry = useCallback((plateRaw: string, type: VehicleType): ActionResult<ParkingRecord> => {
    const s = sessionRef.current; const d = dataRef.current;
    if (!s?.tenant) return fail('No hay un parqueadero asociado a su usuario.');
    const cfg = s.tenant.config_json;
    if (!openShiftOf()) return fail('Turno no iniciado: Debe ingresar la base de dinero en efectivo antes de registrar entradas.', 'info');
    const plate = normalizePlate(plateRaw);
    const err = validatePlate(plate, type);
    if (err) return fail(`Error al ingresar vehículo: ${err}`);
    const dup = d.records.find(r => r.status === 'dentro' && r.plate === plate);
    if (dup) return fail(`Error al ingresar vehículo: La placa ${displayPlate(plate)} ya registra una entrada activa a las ${fmtHM(dup.entry_time)} sin registrar salida. Verifique si el vehículo sigue en patio.`);
    const inside = d.records.filter(r => r.status === 'dentro' && r.vehicle_type === type).length;
    if (inside >= (type === 'moto' ? cfg.cap_moto : cfg.cap_carro)) return fail(`Error al ingresar vehículo: Capacidad máxima de ${type === 'moto' ? 'motos' : 'carros'} alcanzada.`);
    const tag = type === 'moto' ? 'MTO' : 'CAR';
    const n = Math.max(d.counters[type], maxTicketNumber(d.records, tag)) + 1;
    const rec: ParkingRecord = {
      id: uid(), tenant_id: s.tenant.id, ticket_code: `${cfg.ticket_prefix}-${tag}-${padN(n, 4)}`, plate, vehicle_type: type,
      entry_time: new Date().toISOString(), exit_time: null, status: 'dentro', total_minutes: null, billed_hours: null, total_amount: null,
      payment_method: null, created_by: s.profile.id, closed_by: null, sync_status: 'pending',
    };
    setData(x => ({ ...x, counters: { ...x.counters, [type]: n } }));
    pushRecord(rec);
    return ok(`Entrada registrada con éxito: ${type === 'moto' ? 'Moto' : 'Carro'} placa ${displayPlate(plate)}. Tiquete #${rec.ticket_code} generado.`, rec);
  }, [openShiftOf]);

  const registerExit = useCallback((recordId: string, method: PaymentMethod): ActionResult<ParkingRecord> => {
    const s = sessionRef.current; const d = dataRef.current;
    if (!s?.tenant) return fail('No hay un parqueadero asociado a su usuario.');
    const rec = d.records.find(r => r.id === recordId && r.status === 'dentro');
    if (!rec) return fail('Error al registrar salida: el vehículo ya no figura dentro del parqueadero (posiblemente cobrado desde otra caja).');
    const L = liquidate(rec.entry_time, rec.vehicle_type, s.tenant.config_json, Date.now());
    if (L.amount > 0 && !openShiftOf()) return fail('Turno no iniciado: Debe abrir turno con la base de efectivo antes de cobrar.', 'info');
    const out: ParkingRecord = {
      ...rec, exit_time: new Date().toISOString(), status: 'cobrado', total_minutes: L.total_minutes, billed_hours: L.billed_hours,
      total_amount: L.amount, payment_method: L.amount > 0 ? method : 'cortesia', closed_by: s.profile.id, sync_status: 'pending',
    };
    pushRecord(out);
    return ok(L.amount > 0
      ? `Salida registrada: placa ${displayPlate(rec.plate)} · cobro $${L.amount.toLocaleString('es-CO')} COP (${method}).`
      : `Salida registrada: placa ${displayPlate(rec.plate)} dentro del período de gracia, sin cobro.`, out);
  }, [openShiftOf]);

  const openShift = useCallback((base: number): ActionResult<CashShift> => {
    const s = sessionRef.current;
    if (!s?.tenant) return fail('No hay un parqueadero asociado a su usuario.');
    if (openShiftOf()) return fail('Ya tiene un turno abierto. Ciérrelo antes de abrir otro.', 'info');
    const sh: CashShift = { id: uid(), tenant_id: s.tenant.id, cashier_id: s.profile.id, opened_at: new Date().toISOString(), closed_at: null,
      initial_base_cash: base, system_calculated_cash: null, reported_cash: null, difference: null, status: 'abierto' };
    pushShift(sh);
    return ok(`Turno abierto con éxito: base de efectivo $${base.toLocaleString('es-CO')} COP.`, sh);
  }, [openShiftOf]);

  const closeShift = useCallback((reported: number): ActionResult<CashShift> => {
    const sh = openShiftOf();
    if (!sh) return fail('No hay un turno abierto para cerrar.', 'info');
    const t = shiftTotals(sh, dataRef.current.records);
    const expected = sh.initial_base_cash + t.cash;
    const closed: CashShift = { ...sh, closed_at: new Date().toISOString(), system_calculated_cash: expected, reported_cash: reported, difference: reported - expected, status: 'cerrado' };
    pushShift(closed);
    return ok('Turno cerrado.', closed);
  }, [openShiftOf]);

  const addSupportTicket = useCallback((description: string, screenshotName: string | null) => {
    const s = sessionRef.current; if (!s?.tenant) return;
    const t: SupportTicket = { id: uid(), tenant_id: s.tenant.id, reported_by: s.profile.id, issue_description: description,
      screenshot_url: screenshotName ? `local:${screenshotName}` : null, created_at: new Date().toISOString(), resolved: false };
    setData(d => ({ ...d, tickets: [...d.tickets, t], queue: enqueue(d.queue, 'support_tickets', t) }));
    if (!supabase) {
      kvGet<Tenant[] | null>('sa:tenants', null).then(list => { if (list) kvSet('sa:tenants', list.map(x => (x.id === s.tenant!.id ? { ...x, support_ticket_active: true } : x))); });
    }
  }, []);

  // ---------- acciones administrativas ----------
  const saveTenant = useCallback(async (t: Tenant): Promise<ActionResult> => {
    if (supabase) {
      if (!navigator.onLine) return fail('Esta operación requiere conexión a internet.', 'info');
      const { id, created_at: _c, ...patch } = t; void _c;
      const { error } = await supabase.from('tenants').update(patch).eq('id', id);
      if (error) return fail(`No se pudo guardar: ${error.message}`);
      setTenants(l => l.map(x => (x.id === id ? t : x)));
    } else {
      const list = (await kvGet<Tenant[]>('sa:tenants', seedTenants())).map(x => (x.id === t.id ? t : x));
      await kvSet('sa:tenants', list); setTenants(list);
    }
    setSession(s => (s && s.tenant && s.tenant.id === t.id ? { ...s, tenant: t } : s));
    return ok('Cambios guardados con éxito.');
  }, []);

  const createEmployeeRemote = async (body: Record<string, unknown>): Promise<ActionResult> => {
    const { data: sess } = await supabase!.auth.getSession();
    const res = await fetch('/api/employees', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sess.session?.access_token ?? ''}` }, body: JSON.stringify(body) });
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    return res.ok ? ok('Cuenta creada con éxito.') : fail(j.error || 'No se pudo crear la cuenta.');
  };

  const createTenant = useCallback(async (t: Tenant, adminEmail: string, adminName: string, adminPassword: string): Promise<ActionResult> => {
    if (supabase) {
      if (!navigator.onLine) return fail('Esta operación requiere conexión a internet.', 'info');
      const { id: _i, created_at: _c, ...row } = t; void _i; void _c;
      const { data: ins, error } = await supabase.from('tenants').insert(row).select().single();
      if (error || !ins) return fail(`No se pudo crear el parqueadero: ${error?.message ?? 'error'}`);
      const nt = normTenant(ins as Record<string, unknown>);

      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token ?? '';

      let adminSuccess = false;
      let adminErrorMsg = '';

      try {
        const res = await fetch('/api/admin/create-tenant-admin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            tenantId: nt.id,
            fullName: adminName,
            email: adminEmail,
            password: adminPassword,
          }),
        });

        const j = await res.json().catch(() => ({}));
        if (res.ok) {
          adminSuccess = true;
        } else {
          adminErrorMsg = j.error || 'No se pudo crear el usuario administrador.';
        }
      } catch (e: unknown) {
        adminErrorMsg = e instanceof Error ? e.message : 'Error de conexión al crear administrador.';
      }

      if (!adminSuccess) {
        // Rollback atómico: eliminar tenant para evitar registros huérfanos sin admin
        await supabase.from('tenants').delete().eq('id', nt.id);
        return fail(`Falló la creación del administrador: ${adminErrorMsg}. Se canceló la creación del parqueadero.`);
      }

      setTenants(l => [...l, nt]);
      return ok('Parqueadero y administrador creados con éxito.');
    }
    const users = await kvGet<LocalUser[]>('local:users', seedUsers());
    if (users.some(u => u.email.toLowerCase() === adminEmail.toLowerCase())) return fail('Ese correo ya está registrado.');
    const list = [...(await kvGet<Tenant[]>('sa:tenants', seedTenants())), t];
    await kvSet('sa:tenants', list); setTenants(list);
    await kvSet('local:users', [...users, { id: uid(), tenant_id: t.id, full_name: adminName, email: adminEmail, role: 'tenant_admin', active: true, password: adminPassword }]);
    return ok('Parqueadero y administrador creados con éxito.');
  }, []);

  const loadEmployees = useCallback(async (): Promise<Profile[]> => {
    const s = sessionRef.current; if (!s?.tenant) return [];
    if (supabase) {
      const { data: p } = await supabase.from('profiles').select('*').eq('tenant_id', s.tenant.id).eq('role', 'cajero');
      return (p ?? []) as Profile[];
    }
    const users = await kvGet<LocalUser[]>('local:users', seedUsers());
    return users.filter(u => u.tenant_id === s.tenant!.id && u.role === 'cajero').map(({ password: _p, ...rest }) => { void _p; return rest; });
  }, []);

  const createEmployee = useCallback(async (fullName: string, email: string, password: string): Promise<ActionResult> => {
    const s = sessionRef.current; if (!s?.tenant) return fail('Sin parqueadero asociado.');
    if (supabase) {
      if (!navigator.onLine) return fail('Esta operación requiere conexión a internet.', 'info');
      return createEmployeeRemote({ role: 'cajero', email, full_name: fullName, password });
    }
    const users = await kvGet<LocalUser[]>('local:users', seedUsers());
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) return fail('Error al crear cajero: ese correo ya está registrado.');
    await kvSet('local:users', [...users, { id: uid(), tenant_id: s.tenant.id, full_name: fullName, email, role: 'cajero', active: true, password }]);
    return ok(`Cajero ${fullName} creado con éxito.`);
  }, []);

  const setEmployeeActive = useCallback(async (id: string, active: boolean): Promise<ActionResult> => {
    if (supabase) {
      if (!navigator.onLine) return fail('Esta operación requiere conexión a internet.', 'info');
      const { error } = await supabase.from('profiles').update({ active }).eq('id', id);
      return error ? fail(error.message) : ok(active ? 'Cajero activado.' : 'Cajero desactivado.');
    }
    const users = await kvGet<LocalUser[]>('local:users', seedUsers());
    await kvSet('local:users', users.map(u => (u.id === id ? { ...u, active } : u)));
    return ok(active ? 'Cajero activado.' : 'Cajero desactivado.');
  }, []);

  const fetchTenantDump = useCallback(async (tenantId: string) => {
    if (supabase) {
      const [p, r, s, t] = await Promise.all([
        supabase.from('profiles').select('*').eq('tenant_id', tenantId),
        supabase.from('parking_records').select('*').eq('tenant_id', tenantId),
        supabase.from('cash_shifts').select('*').eq('tenant_id', tenantId),
        supabase.from('support_tickets').select('*').eq('tenant_id', tenantId),
      ]);
      return { profiles: (p.data ?? []) as Profile[], records: (r.data ?? []).map(x => normRecord(x as Record<string, unknown>)), shifts: (s.data ?? []).map(x => normShift(x as Record<string, unknown>)), tickets: (t.data ?? []) as SupportTicket[] };
    }
    const snap = { ...EMPTY_DATA, ...(await kvGet<TenantData>(`snap:${tenantId}`, EMPTY_DATA)) };
    const users = await kvGet<LocalUser[]>('local:users', seedUsers());
    return { profiles: users.filter(u => u.tenant_id === tenantId).map(({ password: _p, ...rest }) => { void _p; return rest; }), records: snap.records, shifts: snap.shifts, tickets: snap.tickets };
  }, []);

  const resolveSupport = useCallback(async (tenantId: string) => {
    if (supabase) {
      await supabase.from('support_tickets').update({ resolved: true }).eq('tenant_id', tenantId);
      await supabase.from('tenants').update({ support_ticket_active: false }).eq('id', tenantId);
      setTenants(l => l.map(t => (t.id === tenantId ? { ...t, support_ticket_active: false } : t)));
      return;
    }
    const list = (await kvGet<Tenant[]>('sa:tenants', seedTenants())).map(t => (t.id === tenantId ? { ...t, support_ticket_active: false } : t));
    await kvSet('sa:tenants', list); setTenants(list);
  }, []);

  const recordLegalAcceptance = useCallback(async (terms: boolean, privacy: boolean, custody: boolean): Promise<ActionResult> => {
    if (!session?.profile) return fail('Sesión no encontrada');
    const profile = session.profile;
    const tenantId = session.tenant?.id || null;

    try {
      const res = await fetch('/api/legal/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_id: profile.id,
          tenant_id: tenantId,
          role: profile.role,
          agreement_version: 'v1.0.0',
          terms_accepted: terms,
          privacy_accepted: privacy,
          custody_waiver_accepted: custody,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        return fail(json.error || 'Error al registrar aceptación');
      }

      await kvSet(`legal_accepted:${profile.id}:v1.0.0`, true);
      setLegalAccepted(true);
      return ok('Aceptación de términos y condiciones registrada');
    } catch {
      if (terms && privacy && custody) {
        await kvSet(`legal_accepted:${profile.id}:v1.0.0`, true);
        setLegalAccepted(true);
        return ok('Aceptación registrada en modo local');
      }
      return fail('Error al registrar la aceptación legal');
    }
  }, [session]);

  const loadLegalAcceptances = useCallback(async (): Promise<LegalAcceptance[]> => {
    try {
      const res = await fetch('/api/legal/list');
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.data)) {
          return json.data as LegalAcceptance[];
        }
      }
    } catch {
      // fallback
    }
    const local = await kvGet<LegalAcceptance[]>('local:legal_acceptances', []);
    return local;
  }, []);

  // refresco periódico de la lista de tenants para el Super-Admin (estado en línea / soporte)
  useEffect(() => {
    if (session?.profile.role !== 'superadmin') return;
    const i = setInterval(async () => {
      if (supabase && navigator.onLine) {
        const { data: ts } = await supabase.from('tenants').select('*').order('created_at');
        if (ts) setTenants(ts.map(t => normTenant(t as Record<string, unknown>)));
      } else if (!supabase) setTenants(await kvGet<Tenant[]>('sa:tenants', seedTenants()));
    }, 10000);
    return () => clearInterval(i);
  }, [session?.profile.role]);

  const value = useMemo<Ctx>(() => ({
    ready, mode, online, syncing, syncError, session, data, tenants, toasts, toast, dismissToast, login, logout, openShiftOf,
    registerEntry, registerExit, openShift, closeShift, addSupportTicket, saveTenant, createTenant, loadEmployees, createEmployee, setEmployeeActive,
    fetchTenantDump, resolveSupport, legalAccepted, recordLegalAcceptance, loadLegalAcceptances,
  }), [ready, mode, online, syncing, syncError, session, data, tenants, toasts, toast, dismissToast, login, logout, openShiftOf, registerEntry, registerExit,
    openShift, closeShift, addSupportTicket, saveTenant, createTenant, loadEmployees, createEmployee, setEmployeeActive, fetchTenantDump, resolveSupport,
    legalAccepted, recordLegalAcceptance, loadLegalAcceptances]);

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}
