'use client';
import { useMemo, useState } from 'react';
import { Building2, Database, LifeBuoy, Plus, Power, Save, Wifi, WifiOff, CalendarPlus } from 'lucide-react';
import { useStore } from '@/lib/store';
import { dkey, downloadFile, money, uid } from '@/lib/format';
import { buildSqlDump } from '@/lib/sqlExport';
import { DEFAULT_CONFIG, type PlanType, type Tenant, type TenantStatus } from '@/lib/types';
import { isEmail } from '@/lib/validators';
import { Btn, Card, DigitsInput, TextInput, TextOnlyInput } from './ui';

const ONLINE_MS = 3 * 60 * 1000;
const daysTo = (d: string | null) => (d ? Math.ceil((new Date(d + 'T00:00:00').getTime() - Date.now()) / 86400000) : null);
const isOnline = (t: Tenant) => !!t.last_seen_at && Date.now() - new Date(t.last_seen_at).getTime() < ONLINE_MS;

const statusCls: Record<TenantStatus, string> = { activo: 'bg-emerald-100 text-emerald-700', piloto: 'bg-indigo-100 text-indigo-700', mora: 'bg-amber-100 text-amber-800', suspendido: 'bg-red-100 text-red-700' };

export function SuperAdmin() {
  const { tenants, saveTenant, createTenant, fetchTenantDump, resolveSupport, toast, mode } = useStore();
  const [edit, setEdit] = useState<Tenant | null>(null);
  const [creating, setCreating] = useState(false);

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

  return (
    <div className="space-y-5">
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
      {edit && <EditPlan t={edit} onClose={() => setEdit(null)} onSave={async p => { await patch(edit, p, 'Plan actualizado con éxito.'); setEdit(null); }} />}
      {creating && <CreateTenant onClose={() => setCreating(false)} onCreate={async (t, e, n, p) => { const r = await createTenant(t, e, n, p); toast(r.ok ? 'ok' : r.kind, r.message); if (r.ok) setCreating(false); }} />}
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
