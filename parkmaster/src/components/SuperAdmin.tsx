'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2, Database, LifeBuoy, Plus, Power, Save, Wifi, WifiOff, CalendarPlus,
  ShieldCheck, Download, Printer, RefreshCw, CheckCircle2, Eye, EyeOff, Copy, Check,
  KeyRound, Mail, UserCheck, AlertTriangle, UserPlus
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { dkey, downloadFile, fmtDT, money, uid } from '@/lib/format';
import { buildSqlDump } from '@/lib/sqlExport';
import { DEFAULT_CONFIG, type PlanType, type Tenant, type TenantStatus, type LegalAcceptance, type Profile } from '@/lib/types';
import { isEmail } from '@/lib/validators';
import { Btn, Card, DigitsInput, TextInput, TextOnlyInput } from './ui';

const ONLINE_MS = 3 * 60 * 1000;
const daysTo = (d: string | null) => (d ? Math.ceil((new Date(d + 'T00:00:00').getTime() - Date.now()) / 86400000) : null);
const isOnline = (t: Tenant) => !!t.last_seen_at && Date.now() - new Date(t.last_seen_at).getTime() < ONLINE_MS;

const statusCls: Record<TenantStatus, string> = { activo: 'bg-emerald-100 text-emerald-700', piloto: 'bg-indigo-100 text-indigo-700', mora: 'bg-amber-100 text-amber-800', suspendido: 'bg-red-100 text-red-700' };

export function SuperAdmin() {
  const { tenants, saveTenant, createTenant, fetchTenantDump, resolveSupport, loadLegalAcceptances, toast, mode } = useStore();
  const [activeTab, setActiveTab] = useState<'tenants' | 'legal'>('tenants');
  const [edit, setEdit] = useState<Tenant | null>(null);
  const [creating, setCreating] = useState(false);
  const [accessTenant, setAccessTenant] = useState<Tenant | null>(null);
  const [legalList, setLegalList] = useState<LegalAcceptance[]>([]);
  const [loadingLegal, setLoadingLegal] = useState(false);
  const [legalFilter, setLegalFilter] = useState('');

  const refreshLegal = async () => {
    setLoadingLegal(true);
    try {
      const list = await loadLegalAcceptances();
      setLegalList(list);
    } catch {
      toast('err', 'No se pudieron cargar los registros de auditoría legal.');
    } finally {
      setLoadingLegal(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'legal') {
      refreshLegal();
    }
  }, [activeTab]);

  const k = useMemo(() => {
    const paying = tenants.filter(t => t.plan_type === 'mensual_saas');
    const upcoming = paying.filter(t => { const d = daysTo(t.next_payment_date); return d !== null && d >= 0 && d <= 7; });
    return {
      total: tenants.length,
      alDia: paying.filter(t => t.status === 'activo').length,
      mora: tenants.filter(t => t.status === 'mora').length,
      proximos: upcoming,
      mrr: paying.filter(t => t.status === 'activo' || t.status === 'mora').reduce((s, t) => s + t.monthly_fee_cop, 0),
      online: tenants.filter(isOnline).length,
      soporte: tenants.filter(t => t.support_ticket_active).length,
      pilotos: tenants.filter(t => t.status === 'piloto').length,
    };
  }, [tenants]);

  const patch = async (t: Tenant, p: Partial<Tenant>, msg: string) => {
    const r = await saveTenant({ ...t, ...p });
    toast(r.ok ? 'ok' : r.kind, r.ok ? msg : r.message);
  };
  const extendPilot = (t: Tenant) => {
    const base = t.next_payment_date && daysTo(t.next_payment_date)! > 0 ? new Date(t.next_payment_date + 'T00:00:00') : new Date();
    base.setDate(base.getDate() + 7);
    patch(t, { next_payment_date: dkey(base), status: 'piloto' }, `Piloto de ${t.business_name} extendido 7 días (hasta ${dkey(base)}).`);
  };
  const registerPayment = (t: Tenant) => {
    const next = new Date(); next.setMonth(next.getMonth() + 1); next.setDate(Math.min(t.billing_due_day, 28));
    patch(t, { last_payment_date: dkey(Date.now()), next_payment_date: dkey(next), status: 'activo' }, `Pago registrado para ${t.business_name}. Próximo cobro: ${dkey(next)}.`);
  };

  const migrate = async (t: Tenant) => {
    toast('info', `Generando migración de ${t.business_name}…`);
    try {
      const [dump, schema] = await Promise.all([fetchTenantDump(t.id), fetch('/schema.sql').then(r => (r.ok ? r.text() : '-- (no se pudo cargar schema.sql)'))]);
      const payload = { exported_at: new Date().toISOString(), tenant: t, profiles: dump.profiles, parking_records: dump.records, cash_shifts: dump.shifts, support_tickets: dump.tickets };
      downloadFile(`migracion_${t.slug}.sql`, buildSqlDump(schema, payload), 'text/sql;charset=utf-8');
      downloadFile(`migracion_${t.slug}.json`, JSON.stringify(payload, null, 2), 'application/json');
      toast('ok', `Migración exportada: ${dump.records.length} registros de parqueo, ${dump.shifts.length} turnos. Se descargaron .sql y .json.`);
    } catch { toast('err', 'No se pudo generar la migración: verifique su conexión.'); }
  };

  const exportLegalCSV = () => {
    if (legalList.length === 0) {
      toast('info', 'No hay registros legales para exportar.');
      return;
    }
    const headers = ['ID', 'Fecha_Aceptacion', 'Nombre_Usuario', 'Email', 'Rol', 'Parqueadero', 'IP', 'Navegador_UserAgent', 'Version_Terminos', 'Terminos_Aceptados', 'Privacidad_Aceptada', 'Exoneracion_Custodia_Aceptada'];
    const rows = legalList.map(item => [
      item.id,
      item.accepted_at,
      `"${(item.profile?.full_name || '').replace(/"/g, '""')}"`,
      `"${(item.profile?.email || '').replace(/"/g, '""')}"`,
      item.role || item.profile_role || 'N/A',
      `"${(item.tenant?.business_name || 'Global / SuperAdmin').replace(/"/g, '""')}"`,
      item.ip_address || 'N/A',
      `"${(item.user_agent || '').replace(/"/g, '""')}"`,
      item.agreement_version,
      item.terms_accepted ? 'SI' : 'NO',
      item.privacy_accepted ? 'SI' : 'NO',
      item.custody_waiver_accepted ? 'SI' : 'NO',
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    downloadFile(`auditoria_legal_cparkingsoft_${dkey(Date.now())}.csv`, csvContent, 'text/csv;charset=utf-8');
    toast('ok', 'Archivo CSV de auditoría legal exportado.');
  };

  const filteredLegal = useMemo(() => {
    const q = legalFilter.trim().toLowerCase();
    if (!q) return legalList;
    return legalList.filter(item =>
      (item.profile?.full_name && item.profile.full_name.toLowerCase().includes(q)) ||
      (item.profile?.email && item.profile.email.toLowerCase().includes(q)) ||
      (item.tenant?.business_name && item.tenant.business_name.toLowerCase().includes(q)) ||
      (item.ip_address && item.ip_address.toLowerCase().includes(q)) ||
      ((item.role || item.profile_role || '').toLowerCase().includes(q))
    );
  }, [legalList, legalFilter]);

  return (
    <div className="space-y-5">
      {/* Pestañas SuperAdmin */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('tenants')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg flex items-center gap-2 transition ${
            activeTab === 'tenants'
              ? 'bg-slate-900 text-white shadow'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Building2 size={16} /> Parqueaderos & Cobros
        </button>
        <button
          onClick={() => setActiveTab('legal')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg flex items-center gap-2 transition ${
            activeTab === 'legal'
              ? 'bg-slate-900 text-white shadow'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ShieldCheck size={16} /> Auditoría Legal & Términos
          {legalList.length > 0 && (
            <span className="ml-1 bg-amber-500/20 text-amber-700 text-xs px-2 py-0.5 rounded-full font-bold">
              {legalList.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'tenants' ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[['Clientes registrados', k.total, `${k.pilotos} en piloto`], ['Al día (SaaS)', k.alDia, `${k.mora} en mora`], ['Recaudo mensual estimado', money(k.mrr), 'licencias activas + mora'], ['En línea ahora', k.online, `${k.soporte} con soporte abierto`]].map(([l, v, s]) => (
              <Card key={String(l)} className="px-4 py-3"><div className="text-xs text-slate-500">{l}</div><div className="text-2xl font-black">{v}</div><div className="text-[11px] text-slate-400">{s}</div></Card>
            ))}
          </div>
          {k.proximos.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded-lg p-3 text-sm">
              ⏰ <b>Próximos a cobrar (≤7 días):</b> {k.proximos.map(t => `${t.business_name} (${t.next_payment_date})`).join(' · ')}
            </div>
          )}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-bold flex items-center gap-2"><Building2 size={20} />Parqueaderos (tenants){mode === 'local' && <span className="text-xs font-normal text-amber-600">· datos demo locales</span>}</div>
              <Btn onClick={() => setCreating(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 text-sm"><Plus size={16} />Nuevo parqueadero</Btn>
            </div>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-slate-600 text-left"><tr>{['Parqueadero', 'Plan', 'Cuota', 'Estado', 'Próximo cobro', 'Conexión', 'Soporte', 'Acciones'].map(h => <th key={h} className="px-3 py-2 whitespace-nowrap">{h}</th>)}</tr></thead>
                <tbody>{tenants.map(t => {
                  const d = daysTo(t.next_payment_date); const on = isOnline(t);
                  return (
                    <tr key={t.id} className="border-t align-top">
                      <td className="px-3 py-2"><div className="font-semibold">{t.business_name}</div><div className="text-xs text-slate-500">{t.city} · NIT {t.nit_rut}</div></td>
                      <td className="px-3 py-2 whitespace-nowrap">{t.plan_type.replace('_', ' ')}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{money(t.monthly_fee_cop)}<div className="text-xs text-slate-400">día {t.billing_due_day}</div></td>
                      <td className="px-3 py-2"><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusCls[t.status]}`}>{t.status}</span></td>
                      <td className="px-3 py-2 whitespace-nowrap">{t.next_payment_date ?? '—'}{d !== null && <div className={`text-xs ${d < 0 ? 'text-red-600 font-bold' : d <= 7 ? 'text-amber-600 font-bold' : 'text-slate-400'}`}>{d < 0 ? `vencido hace ${-d} d` : `en ${d} d`}</div>}</td>
                      <td className="px-3 py-2">{on ? <span className="text-emerald-600 flex items-center gap-1"><Wifi size={14} />En línea</span> : <span className="text-slate-400 flex items-center gap-1"><WifiOff size={14} />Fuera</span>}</td>
                      <td className="px-3 py-2">{t.support_ticket_active ? <button onClick={() => resolveSupport(t.id).then(() => toast('ok', 'Soporte marcado como resuelto.'))} className="text-xs font-bold bg-red-100 text-red-700 rounded-full px-2 py-1 flex items-center gap-1"><LifeBuoy size={12} />ABIERTO · resolver</button> : <span className="text-slate-300">—</span>}</td>
                      <td className="px-3 py-2"><div className="flex flex-wrap gap-1">
                        <Btn onClick={() => setAccessTenant(t)} className="bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs px-2 py-1 font-semibold flex items-center gap-1 shadow-sm">
                          <Eye size={13} className="text-amber-700" />
                          Detalles & Accesos
                        </Btn>
                        <Btn onClick={() => patch(t, { status: t.status === 'suspendido' ? 'activo' : 'suspendido' }, t.status === 'suspendido' ? `${t.business_name} activado.` : `${t.business_name} suspendido: sus usuarios no podrán operar.`)} className="bg-slate-100 hover:bg-slate-200 text-xs px-2 py-1"><Power size={12} />{t.status === 'suspendido' ? 'Activar' : 'Suspender'}</Btn>
                        {t.plan_type === 'piloto_7dias' && <Btn onClick={() => extendPilot(t)} className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs px-2 py-1"><CalendarPlus size={12} />+7 días</Btn>}
                        {t.plan_type === 'mensual_saas' && <Btn onClick={() => registerPayment(t)} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs px-2 py-1">Registrar pago</Btn>}
                        <Btn onClick={() => setEdit(t)} className="bg-slate-100 hover:bg-slate-200 text-xs px-2 py-1">Editar plan</Btn>
                        <Btn onClick={() => migrate(t)} className="bg-slate-800 hover:bg-slate-900 text-white text-xs px-2 py-1"><Database size={12} />Migrar</Btn>
                      </div></td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          </Card>
        </>
      ) : (
        <Card className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <div className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="text-emerald-600" size={22} />
                Auditoría Legal y Aceptación de Términos
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Registro inmutable de acuerdos legales · Ley 1581 de 2012 de Colombia · Exoneración de Custodia
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Btn onClick={refreshLegal} disabled={loadingLegal} className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs py-2 px-3">
                <RefreshCw size={14} className={loadingLegal ? 'animate-spin' : ''} />
                Actualizar
              </Btn>
              <Btn onClick={exportLegalCSV} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs py-2 px-3">
                <Download size={14} />
                Exportar CSV
              </Btn>
              <Btn onClick={() => window.print()} className="bg-slate-800 hover:bg-slate-900 text-white text-xs py-2 px-3">
                <Printer size={14} />
                Imprimir / PDF
              </Btn>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Buscar por usuario, correo, parqueadero o IP…"
              value={legalFilter}
              onChange={e => setLegalFilter(e.target.value)}
              className="w-full max-w-sm border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <span className="text-xs text-slate-500">
              Mostrando {filteredLegal.length} de {legalList.length} registros
            </span>
          </div>

          <div className="overflow-auto max-h-[600px] border border-slate-200 rounded-lg">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 sticky top-0 font-bold uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2.5">Fecha y Hora</th>
                  <th className="px-3 py-2.5">Usuario / Perfil</th>
                  <th className="px-3 py-2.5">Rol</th>
                  <th className="px-3 py-2.5">Parqueadero</th>
                  <th className="px-3 py-2.5">Dirección IP</th>
                  <th className="px-3 py-2.5">Navegador</th>
                  <th className="px-3 py-2.5">Versión</th>
                  <th className="px-3 py-2.5 text-center">Términos</th>
                  <th className="px-3 py-2.5 text-center">Privacidad</th>
                  <th className="px-3 py-2.5 text-center">Exon. Custodia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredLegal.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-3 py-8 text-center text-slate-400">
                      {loadingLegal ? 'Cargando registros legales…' : 'No se encontraron registros de aceptación legal.'}
                    </td>
                  </tr>
                ) : (
                  filteredLegal.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5 whitespace-nowrap font-medium text-slate-800">
                        {fmtDT(item.accepted_at)}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-semibold text-slate-900">{item.profile?.full_name || 'Desconocido'}</div>
                        <div className="text-[11px] text-slate-500">{item.profile?.email || '-'}</div>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-200 text-slate-800">
                          {item.role}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {item.tenant?.business_name || (
                          <span className="text-slate-400 italic">Global / SuperAdmin</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                        {item.ip_address || '127.0.0.1'}
                      </td>
                      <td className="px-3 py-2.5 max-w-[150px] truncate text-[11px] text-slate-500" title={item.user_agent || ''}>
                        {item.user_agent || '-'}
                      </td>
                      <td className="px-3 py-2.5 font-mono font-semibold text-slate-700 whitespace-nowrap">
                        {item.agreement_version}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {item.terms_accepted ? (
                          <span className="inline-flex items-center gap-0.5 text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-full">
                            <CheckCircle2 size={11} /> Sí
                          </span>
                        ) : (
                          <span className="text-red-600 font-bold">No</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {item.privacy_accepted ? (
                          <span className="inline-flex items-center gap-0.5 text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-full">
                            <CheckCircle2 size={11} /> Sí
                          </span>
                        ) : (
                          <span className="text-red-600 font-bold">No</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {item.custody_waiver_accepted ? (
                          <span className="inline-flex items-center gap-0.5 text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-full">
                            <CheckCircle2 size={11} /> Sí
                          </span>
                        ) : (
                          <span className="text-red-600 font-bold">No</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {edit && <EditPlan t={edit} onClose={() => setEdit(null)} onSave={async p => { await patch(edit, p, 'Plan actualizado con éxito.'); setEdit(null); }} />}
      {creating && <CreateTenant onClose={() => setCreating(false)} onCreate={async (t, e, n, p) => { const r = await createTenant(t, e, n, p); toast(r.ok ? 'ok' : r.kind, r.message); if (r.ok) setCreating(false); }} />}
      {accessTenant && <TenantAccessModal t={accessTenant} onClose={() => setAccessTenant(null)} />}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl w-full max-w-lg p-5 shadow-2xl max-h-[92vh] overflow-auto space-y-3">
        <div className="flex items-center justify-between"><h2 className="text-lg font-bold">{title}</h2><button onClick={onClose}>✕</button></div>
        {children}
      </div>
    </div>
  );
}

function EditPlan({ t, onClose, onSave }: { t: Tenant; onClose: () => void; onSave: (p: Partial<Tenant>) => void }) {
  const { toast } = useStore();
  const [plan, setPlan] = useState<PlanType>(t.plan_type);
  const [fee, setFee] = useState(String(t.monthly_fee_cop));
  const [day, setDay] = useState(String(t.billing_due_day));
  const [next, setNext] = useState(t.next_payment_date ?? '');
  const save = () => {
    const d = Number(day);
    if (!d || d < 1 || d > 31) { toast('err', 'Día de cobro inválido: debe estar entre 1 y 31.'); return; }
    onSave({ plan_type: plan, monthly_fee_cop: Number(fee || 0), billing_due_day: d, next_payment_date: next || null });
  };
  return (
    <Modal title={`Editar plan · ${t.business_name}`} onClose={onClose}>
      <label className="block text-xs text-slate-500 font-medium">Tipo de plan
        <select value={plan} onChange={e => setPlan(e.target.value as PlanType)} className="block w-full border border-slate-300 rounded-lg px-3 py-2 text-base text-slate-900">
          <option value="piloto_7dias">Piloto 7 días</option><option value="mensual_saas">Mensual SaaS</option><option value="licencia_definitiva">Licencia definitiva</option></select></label>
      <DigitsInput label="CUOTA MENSUAL (COP)" value={fee} onChange={setFee} format />
      <DigitsInput label="DÍA DE COBRO (1-31)" value={day} onChange={setDay} maxLength={2} />
      <label className="block text-xs text-slate-500 font-medium">Próximo cobro / fin de piloto<input type="date" value={next} onChange={e => setNext(e.target.value)} className="block w-full border border-slate-300 rounded-lg px-3 py-2 text-base text-slate-900" /></label>
      <Btn onClick={save} className="w-full bg-indigo-600 text-white py-2.5"><Save size={16} />Guardar</Btn>
    </Modal>
  );
}

function CreateTenant({ onClose, onCreate }: { onClose: () => void; onCreate: (t: Tenant, email: string, name: string, pw: string) => void }) {
  const { toast } = useStore();
  const [name, setName] = useState(''); const [nit, setNit] = useState(''); const [city, setCity] = useState(''); const [phone, setPhone] = useState('');
  const [aName, setAName] = useState(''); const [aEmail, setAEmail] = useState(''); const [aPw, setAPw] = useState('');
  const go = () => {
    if (name.trim().length < 3) { toast('err', 'Error al crear: escriba el nombre del parqueadero.'); return; }
    if (nit.length < 5) { toast('err', 'Error al crear: el NIT/RUT debe tener al menos 5 dígitos.'); return; }
    if (aName.trim().length < 3 || !isEmail(aEmail.trim()) || aPw.length < 6) { toast('err', 'Error al crear: complete nombre, correo válido y contraseña (mín. 6) del administrador.'); return; }
    const slug = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const t: Tenant = { id: uid(), business_name: name.trim(), nit_rut: nit, slug, city: city.trim() || null, address: null, phone: phone || null, plan_type: 'piloto_7dias', monthly_fee_cop: 220000, billing_due_day: 1,
      last_payment_date: null, next_payment_date: dkey(Date.now() + 7 * 86400000), status: 'piloto', is_online: false, last_seen_at: null, support_ticket_active: false, config_json: { ...DEFAULT_CONFIG }, created_at: new Date().toISOString() };
    onCreate(t, aEmail.trim().toLowerCase(), aName.trim(), aPw);
  };
  return (
    <Modal title="Nuevo parqueadero (piloto 7 días)" onClose={onClose}>
      <TextInput label="Nombre del parqueadero" value={name} onChange={setName} />
      <div className="grid grid-cols-2 gap-3"><DigitsInput label="NIT / RUT" value={nit} onChange={setNit} maxLength={12} /><TextOnlyInput label="Ciudad" value={city} onChange={setCity} /></div>
      <DigitsInput label="TELÉFONO" value={phone} onChange={setPhone} maxLength={10} />
      <div className="text-xs font-bold text-slate-500 pt-2">Administrador del parqueadero</div>
      <TextOnlyInput label="Nombre completo" value={aName} onChange={setAName} />
      <TextInput label="Correo" value={aEmail} onChange={setAEmail} />
      <label className="block text-xs text-slate-500 font-medium">Contraseña inicial<input type="password" value={aPw} onChange={e => setAPw(e.target.value)} className="block w-full border border-slate-300 rounded-lg px-3 py-2 text-base text-slate-900" /></label>
      <Btn onClick={go} className="w-full bg-indigo-600 text-white py-2.5"><Plus size={16} />Crear</Btn>
    </Modal>
  );
}

function TenantAccessModal({ t, onClose }: { t: Tenant; onClose: () => void }) {
  const { toast, fetchTenantDump } = useStore();
  const [adminUser, setAdminUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [copiedKit, setCopiedKit] = useState(false);
  const [copiedPw, setCopiedPw] = useState(false);
  const [lastAssignedPassword, setLastAssignedPassword] = useState<string | null>(null);

  // Estados para formulario de asignación cuando no hay administrador
  const [createName, setCreateName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [showCreatePw, setShowCreatePw] = useState(false);
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  const loadAdmin = useCallback(async () => {
    setLoading(true);
    try {
      if (supabase) {
        const { data: p } = await supabase
          .from('profiles')
          .select('*')
          .eq('tenant_id', t.id)
          .eq('role', 'tenant_admin')
          .maybeSingle();

        if (p) {
          setAdminUser(p as Profile);
          setLoading(false);
          return;
        }
      }
      const dump = await fetchTenantDump(t.id);
      const found = dump.profiles.find(x => x.role === 'tenant_admin') || dump.profiles[0] || null;
      setAdminUser(found);
    } catch (e) {
      console.warn('Error cargando administrador del tenant:', e);
    } finally {
      setLoading(false);
    }
  }, [t.id, fetchTenantDump]);

  useEffect(() => {
    loadAdmin();
  }, [loadAdmin]);

  const handleCreateAndAssignAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = createName.trim();
    const email = createEmail.trim().toLowerCase();
    const pw = createPassword.trim();

    if (name.length < 3) {
      toast('err', 'El nombre completo debe tener al menos 3 caracteres.');
      return;
    }
    if (!isEmail(email)) {
      toast('err', 'Ingrese un correo electrónico válido.');
      return;
    }
    if (pw.length < 6) {
      toast('err', 'La contraseña inicial debe tener al menos 6 caracteres.');
      return;
    }

    setCreatingAdmin(true);
    try {
      let token = '';
      if (supabase) {
        const { data: s } = await supabase.auth.getSession();
        token = s.session?.access_token || '';
      }

      const res = await fetch('/api/admin/create-tenant-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          tenantId: t.id,
          fullName: name,
          email,
          password: pw,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        toast('err', json.error || 'Error al crear o vincular administrador.');
      } else {
        toast('ok', json.message || 'Administrador asignado con éxito.');
        if (json.user) {
          setAdminUser(json.user as Profile);
        } else {
          await loadAdmin();
        }
        setLastAssignedPassword(pw);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado';
      toast('err', `Falla de red: ${msg}`);
    } finally {
      setCreatingAdmin(false);
    }
  };

  const copyWhatsAppKit = () => {
    if (!adminUser) return;
    const rawEnv = process.env.NEXT_PUBLIC_SITE_URL;
    const cleanEnv = rawEnv ? rawEnv.match(/https?:\/\/[^\s\]\)\"\'\,]+/)?.[0]?.replace(/\/$/, '') || rawEnv.trim().replace(/\/$/, '') : '';
    const siteUrl = cleanEnv
      || (typeof window !== 'undefined' ? window.location.origin : 'https://c-paking-soft.vercel.app');

    const message = `¡Hola! Aquí tienes los datos de acceso para tu sistema CParkingSoft:
🌐 Enlace: ${siteUrl}
👤 Usuario: ${adminUser.email}
🔑 Si olvidaste tu clave, usa el enlace '¿Olvidaste tu contraseña?' en la pantalla de inicio o solicítanos un restablecimiento.`;

    navigator.clipboard.writeText(message);
    setCopiedKit(true);
    toast('ok', '¡Kit de acceso copiado al portapapeles!');
    setTimeout(() => setCopiedKit(false), 3000);
  };

  const handleForceResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminUser) {
      toast('err', 'No hay usuario administrador identificado.');
      return;
    }
    const cleanPw = newPassword.trim();
    if (cleanPw.length < 6) {
      toast('err', 'La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setResetting(true);
    try {
      let token = '';
      if (supabase) {
        const { data: s } = await supabase.auth.getSession();
        token = s.session?.access_token || '';
      }

      const res = await fetch('/api/admin/force-reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          userId: adminUser.id,
          newPassword: cleanPw,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        toast('err', json.error || 'Error al actualizar contraseña.');
      } else {
        toast('ok', `Contraseña actualizada con éxito para ${adminUser.email}`);
        setLastAssignedPassword(cleanPw);
        setNewPassword('');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado';
      toast('err', `Falla de red: ${msg}`);
    } finally {
      setResetting(false);
    }
  };

  const copyCredentialsKit = () => {
    if (!adminUser || !lastAssignedPassword) return;
    const rawEnv = process.env.NEXT_PUBLIC_SITE_URL;
    const cleanEnv = rawEnv ? rawEnv.match(/https?:\/\/[^\s\]\)\"\'\,]+/)?.[0]?.replace(/\/$/, '') || rawEnv.trim().replace(/\/$/, '') : '';
    const siteUrl = cleanEnv
      || (typeof window !== 'undefined' ? window.location.origin : 'https://c-paking-soft.vercel.app');

    const message = `¡Hola! Aquí tienes las credenciales de acceso para tu sistema CParkingSoft:
🌐 Enlace del Sistema: ${siteUrl}
👤 Correo de Acceso: ${adminUser.email}
🔑 Nueva Contraseña: ${lastAssignedPassword}`;

    navigator.clipboard.writeText(message);
    setCopiedPw(true);
    toast('ok', '¡Credenciales copiadas al portapapeles!');
    setTimeout(() => setCopiedPw(false), 3000);
  };

  const handleSendEmailReset = async () => {
    if (!adminUser) return;
    setSendingEmail(true);
    try {
      const rawEnv = process.env.NEXT_PUBLIC_SITE_URL;
      const cleanEnv = rawEnv ? rawEnv.match(/https?:\/\/[^\s\]\)\"\'\,]+/)?.[0]?.replace(/\/$/, '') || rawEnv.trim().replace(/\/$/, '') : '';
      const siteUrl = cleanEnv
        || (typeof window !== 'undefined' ? window.location.origin : 'https://c-paking-soft.vercel.app');

      const { error } = await supabase.auth.resetPasswordForEmail(adminUser.email.trim(), {
        redirectTo: `${siteUrl}/reset-password`,
      });

      if (error) {
        toast('err', `Error al enviar correo: ${error.message}`);
      } else {
        toast('ok', `Enlace de restablecimiento enviado a ${adminUser.email}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al enviar enlace';
      toast('err', `Falla: ${msg}`);
    } finally {
      setSendingEmail(false);
    }
  };

  const copyPassword = (pw: string) => {
    navigator.clipboard.writeText(pw);
    setCopiedPw(true);
    toast('ok', 'Contraseña copiada al portapapeles.');
    setTimeout(() => setCopiedPw(false), 2500);
  };

  return (
    <Modal title={`Detalles & Accesos · ${t.business_name}`} onClose={onClose}>
      <div className="space-y-4 text-slate-800">
        {/* Encabezado */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-bold text-base text-slate-900">{t.business_name}</div>
            <div className="text-xs text-slate-500 font-mono">
              NIT: {t.nit_rut || 'Sin registrar'} · Ciudad: {t.city || 'No especificada'}
            </div>
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${statusCls[t.status]}`}>
            {t.status.toUpperCase()}
          </span>
        </div>

        {/* Datos del Administrador Principal */}
        <div className="border border-slate-200 rounded-xl p-3 space-y-2">
          <div className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
            <UserCheck size={15} className="text-indigo-600" />
            Administrador Principal
          </div>
          {loading ? (
            <div className="text-xs text-slate-500 py-2">Cargando datos del administrador…</div>
          ) : !adminUser ? (
            <div className="space-y-3 pt-1">
              <div className="text-xs text-amber-800 bg-amber-50 p-2.5 rounded-lg border border-amber-200 flex items-start gap-2">
                <AlertTriangle size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Sin administrador asignado:</span> No se encontró un perfil administrativo asignado a este parqueadero. Complete el formulario a continuación para crearlo y vincularlo.
                </div>
              </div>

              <form onSubmit={handleCreateAndAssignAdmin} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <UserPlus size={15} className="text-indigo-600" />
                  Crear y Asignar Administrador Principal
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Nombre completo del Administrador
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Carlos Restrepo"
                    value={createName}
                    onChange={e => setCreateName(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Correo electrónico de acceso
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="admin@parqueadero.com"
                    value={createEmail}
                    onChange={e => setCreateEmail(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Contraseña inicial
                  </label>
                  <div className="relative">
                    <input
                      type={showCreatePw ? 'text' : 'password'}
                      required
                      placeholder="Mínimo 6 caracteres"
                      value={createPassword}
                      onChange={e => setCreatePassword(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg pl-3 pr-9 py-1.5 text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCreatePw(!showCreatePw)}
                      className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                    >
                      {showCreatePw ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <Btn
                  type="submit"
                  disabled={creatingAdmin}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs py-2 shadow-sm flex items-center justify-center gap-1.5"
                >
                  <UserPlus size={14} />
                  {creatingAdmin ? 'Creando y vinculando…' : '+ Crear y Vincular Administrador'}
                </Btn>
              </form>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-400 block">Nombre completo:</span>
                <span className="font-semibold text-slate-900">{adminUser.full_name}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Correo de acceso:</span>
                <span className="font-semibold text-slate-900 font-mono">{adminUser.email}</span>
              </div>
              <div>
                <span className="text-slate-400 block">UID del Administrador (Auth):</span>
                <span className="font-mono text-[11px] text-slate-600 select-all break-all">{adminUser.id}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Rol en el sistema:</span>
                <span className="inline-block bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-md mt-0.5">
                  {adminUser.role}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Fecha de registro:</span>
                <span className="text-slate-700 font-medium">
                  {t.created_at ? fmtDT(t.created_at) : 'No disponible'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Acciones de Soporte Inmediato */}
        {adminUser && (
          <div className="space-y-3 pt-1">
            <div className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Acciones de Soporte Inmediato
            </div>

            {/* a) Botón Copiar Kit WhatsApp */}
            <button
              type="button"
              onClick={copyWhatsAppKit}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 text-xs shadow-sm transition"
            >
              {copiedKit ? <Check size={16} /> : <Copy size={16} />}
              {copiedKit ? '¡Copiado al Portapapeles!' : '📋 Copiar Kit de Acceso para WhatsApp'}
            </button>

            {/* b) Sección Cambiar Contraseña Manualmente (Acceso Desarrollador) */}
            <form onSubmit={handleForceResetPassword} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <KeyRound size={15} className="text-amber-600" />
                Cambiar Contraseña Manualmente (Acceso Desarrollador)
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Digita la nueva clave (ej: Fabricato2026*)"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg pl-3 pr-9 py-2 text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                <Btn
                  type="submit"
                  disabled={resetting || newPassword.trim().length < 6}
                  className="bg-slate-900 hover:bg-slate-800 text-white text-xs px-3.5 py-2 font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap shadow-sm"
                >
                  <Save size={13} />
                  {resetting ? 'Aplicando…' : '💾 Aplicar Nueva Clave'}
                </Btn>
              </div>

              {lastAssignedPassword && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 space-y-2 text-xs text-emerald-900">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-slate-500">Clave establecida:</span>{' '}
                      <code className="bg-white px-2 py-0.5 rounded border border-emerald-300 font-bold font-mono text-slate-900">
                        {lastAssignedPassword}
                      </code>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                      ✓ Actualizada
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={copyCredentialsKit}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 text-xs shadow-sm transition"
                  >
                    {copiedPw ? <Check size={14} /> : <Copy size={14} />}
                    {copiedPw ? '¡Credenciales Copiadas!' : '📋 Copiar credenciales para enviar al cliente'}
                  </button>
                </div>
              )}
            </form>

            {/* c) Botón Enviar Enlace por Correo */}
            <div className="pt-1">
              <button
                type="button"
                onClick={handleSendEmailReset}
                disabled={sendingEmail}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2 px-3 rounded-xl flex items-center justify-center gap-2 text-xs border border-slate-300 transition"
              >
                <Mail size={15} />
                {sendingEmail ? 'Enviando correo…' : `✉️ Enviar Enlace de Restablecimiento por Correo a ${adminUser.email}`}
              </button>
            </div>
          </div>
        )}

        <div className="pt-2 flex justify-end">
          <Btn onClick={onClose} className="bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs px-4 py-2">
            Cerrar
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
