'use client';
import { useEffect, useMemo, useState } from 'react';
import { Download, Save, Settings, UserPlus, Users, FileText, Power } from 'lucide-react';
import { useStore } from '@/lib/store';
import { dkey, downloadFile, fmtDT, money, toCSV } from '@/lib/format';
import { displayPlate, isEmail } from '@/lib/validators';
import { shiftTotals } from '@/lib/billing';
import type { Profile, Tenant, TenantConfig } from '@/lib/types';
import { Btn, Card, DigitsInput, TextInput, TextOnlyInput } from './ui';

type Tab = 'config' | 'empleados' | 'reportes';

export function Admin() {
  const [tab, setTab] = useState<Tab>('reportes');
  return (
    <div className="space-y-5">
      <div className="flex gap-2 overflow-x-auto">
        {([['reportes', 'Reportes y Auditoría', FileText], ['config', 'Configuración del negocio', Settings], ['empleados', 'Empleados', Users]] as const).map(([k, l, Ic]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm whitespace-nowrap ${tab === k ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}><Ic size={16} />{l}</button>
        ))}
      </div>
      {tab === 'reportes' && <Reports />}
      {tab === 'config' && <BusinessConfig />}
      {tab === 'empleados' && <Employees />}
    </div>
  );
}

function BusinessConfig() {
  const { session, saveTenant, toast } = useStore();
  const t0 = session!.tenant!;
  const [t, setT] = useState<Tenant>(t0);
  const [c, setC] = useState<TenantConfig>(t0.config_json);
  const n = (k: keyof TenantConfig) => String(c[k] as number);
  const setN = (k: keyof TenantConfig) => (v: string) => setC(x => ({ ...x, [k]: v === '' ? 0 : Number(v) }));

  const save = async () => {
    if (!t.business_name.trim()) { toast('err', 'Error al guardar: el nombre del parqueadero es obligatorio.'); return; }
    if (c.rate_moto <= 0 || c.rate_carro <= 0) { toast('err', 'Error al guardar: las tarifas por hora deben ser mayores a cero.'); return; }
    if (c.cap_moto <= 0 || c.cap_carro <= 0) { toast('err', 'Error al guardar: las capacidades deben ser mayores a cero.'); return; }
    if (!c.ticket_prefix.trim()) { toast('err', 'Error al guardar: el prefijo de tiquete es obligatorio.'); return; }
    const r = await saveTenant({ ...t, config_json: c });
    toast(r.ok ? 'ok' : r.kind, r.ok ? 'Configuración guardada con éxito. Los nuevos tiquetes usarán estos valores.' : r.message);
  };

  return (
    <Card className="p-5 space-y-4 max-w-3xl">
      <div className="grid sm:grid-cols-2 gap-3">
        <TextInput label="Nombre del parqueadero" value={t.business_name} onChange={v => setT({ ...t, business_name: v })} />
        <DigitsInput label="NIT / RUT (solo números)" value={t.nit_rut ?? ''} onChange={v => setT({ ...t, nit_rut: v })} maxLength={12} />
        <TextOnlyInput label="Ciudad" value={t.city ?? ''} onChange={v => setT({ ...t, city: v })} />
        <TextInput label="Dirección" value={t.address ?? ''} onChange={v => setT({ ...t, address: v })} />
        <DigitsInput label="Teléfono (solo números)" value={t.phone ?? ''} onChange={v => setT({ ...t, phone: v })} maxLength={10} />
        <TextInput label="Prefijo de tiquete" value={c.ticket_prefix} onChange={v => setC({ ...c, ticket_prefix: v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5) })} />
        <DigitsInput label="Valor hora Moto (COP)" value={n('rate_moto')} onChange={setN('rate_moto')} format />
        <DigitsInput label="Valor hora Carro (COP)" value={n('rate_carro')} onChange={setN('rate_carro')} format />
        <DigitsInput label="Minutos de gracia" value={n('grace_minutes')} onChange={setN('grace_minutes')} maxLength={3} />
        <label className="block text-xs text-slate-500 font-medium">Cobro por
          <select value={c.billing_mode} onChange={e => setC({ ...c, billing_mode: e.target.value as TenantConfig['billing_mode'] })} className="block w-full border border-slate-300 rounded-lg px-3 py-2 text-base text-slate-900">
            <option value="hora">Hora o fracción iniciada</option><option value="media">Bloques de 30 min (media tarifa)</option></select></label>
        <DigitsInput label="Capacidad Motos" value={n('cap_moto')} onChange={setN('cap_moto')} maxLength={4} />
        <DigitsInput label="Capacidad Carros" value={n('cap_carro')} onChange={setN('cap_carro')} maxLength={4} />
        <label className="block text-xs text-slate-500 font-medium">Papel térmico
          <select value={c.paper_width} onChange={e => setC({ ...c, paper_width: Number(e.target.value) as 58 | 80 })} className="block w-full border border-slate-300 rounded-lg px-3 py-2 text-base text-slate-900"><option value={80}>80 mm</option><option value={58}>58 mm</option></select></label>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={c.barrier_enabled} onChange={e => setC({ ...c, barrier_enabled: e.target.checked })} />Talanquera habilitada</label>
          <DigitsInput label="Segundos de apertura de talanquera" value={n('barrier_open_seconds')} onChange={setN('barrier_open_seconds')} maxLength={2} disabled={!c.barrier_enabled} />
        </div>
      </div>
      <label className="block text-xs text-slate-500 font-medium">Texto legal del tiquete
        <textarea rows={4} value={c.legal_text} onChange={e => setC({ ...c, legal_text: e.target.value })} className="block w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900" /></label>
      <Btn onClick={save} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3"><Save size={18} />Guardar configuración</Btn>
    </Card>
  );
}

function Employees() {
  const { loadEmployees, createEmployee, setEmployeeActive, toast } = useStore();
  const [list, setList] = useState<Profile[]>([]);
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [pw, setPw] = useState('');
  const refresh = () => { loadEmployees().then(setList); };
  useEffect(refresh, [loadEmployees]);

  const add = async () => {
    if (name.trim().length < 3) { toast('err', 'Error al crear cajero: digite el nombre completo (solo letras).'); return; }
    if (!isEmail(email.trim())) { toast('err', 'Error al crear cajero: el correo no tiene un formato válido.'); return; }
    if (pw.length < 6) { toast('err', 'Error al crear cajero: la contraseña debe tener al menos 6 caracteres.'); return; }
    const r = await createEmployee(name.trim(), email.trim().toLowerCase(), pw);
    toast(r.ok ? 'ok' : r.kind, r.message);
    if (r.ok) { setName(''); setEmail(''); setPw(''); refresh(); }
  };
  const toggle = async (p: Profile) => { const r = await setEmployeeActive(p.id, !p.active); toast(r.ok ? 'ok' : r.kind, r.message); refresh(); };

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <Card className="p-5 space-y-3">
        <div className="font-bold flex items-center gap-2"><UserPlus size={20} />Nuevo cajero / taquillero</div>
        <TextOnlyInput label="Nombre completo" value={name} onChange={setName} />
        <TextInput label="Correo electrónico" value={email} onChange={setEmail} />
        <label className="block text-xs text-slate-500 font-medium">Contraseña inicial
          <input type="password" value={pw} onChange={e => setPw(e.target.value)} className="block w-full border border-slate-300 rounded-lg px-3 py-2 text-base text-slate-900" /></label>
        <Btn onClick={add} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5">Crear cuenta de cajero</Btn>
      </Card>
      <Card className="p-5">
        <div className="font-bold mb-3">Cajeros de este parqueadero ({list.length})</div>
        <div className="space-y-2">
          {list.map(p => (
            <div key={p.id} className="flex items-center gap-3 border border-slate-200 rounded-lg p-2">
              <div className="flex-1 min-w-0"><div className="font-semibold">{p.full_name}</div><div className="text-xs text-slate-500">{p.email}</div></div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{p.active ? 'Activo' : 'Inactivo'}</span>
              <Btn onClick={() => toggle(p)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-2 py-1.5"><Power size={14} />{p.active ? 'Desactivar' : 'Activar'}</Btn>
            </div>
          ))}
          {!list.length && <div className="text-sm text-slate-400 text-center py-6">Aún no hay cajeros.</div>}
        </div>
      </Card>
    </div>
  );
}

function Reports() {
  const { data, session } = useStore();
  const today = dkey(Date.now());
  const [from, setFrom] = useState(today); const [to, setTo] = useState(today); const [ft, setFt] = useState('todos');
  const rows = useMemo(() => data.records.filter(r => r.status === 'cobrado' && r.exit_time && dkey(r.exit_time) >= from && dkey(r.exit_time) <= to && (ft === 'todos' || r.vehicle_type === ft))
    .sort((a, b) => new Date(b.exit_time!).getTime() - new Date(a.exit_time!).getTime()), [data.records, from, to, ft]);
  const total = rows.reduce((s, r) => s + (r.total_amount ?? 0), 0);
  const inside = data.records.filter(r => r.status === 'dentro');
  const tenant = session!.tenant!;

  const exportCSV = () => {
    const cols = ['ticket_code', 'plate', 'vehicle_type', 'entry_time', 'exit_time', 'total_minutes', 'billed_hours', 'total_amount', 'payment_method', 'closed_by'];
    downloadFile(`${tenant.slug}_${from}_a_${to}.csv`, toCSV(rows as unknown as Record<string, unknown>[], cols), 'text/csv;charset=utf-8');
  };

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3 mb-3">
          <div className="font-bold mr-auto">Movimientos y facturación</div>
          <label className="text-xs text-slate-500">Desde<input type="date" value={from} onChange={e => setFrom(e.target.value)} className="block border border-slate-300 rounded px-2 py-1 text-sm text-slate-800" /></label>
          <label className="text-xs text-slate-500">Hasta<input type="date" value={to} onChange={e => setTo(e.target.value)} className="block border border-slate-300 rounded px-2 py-1 text-sm text-slate-800" /></label>
          <label className="text-xs text-slate-500">Tipo<select value={ft} onChange={e => setFt(e.target.value)} className="block border border-slate-300 rounded px-2 py-1 text-sm text-slate-800"><option value="todos">Todos</option><option value="moto">Motos</option><option value="carro">Carros</option></select></label>
          <Btn onClick={exportCSV} disabled={!rows.length} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2"><Download size={18} />Exportar a Excel / CSV</Btn>
        </div>
        <div className="text-sm mb-2 text-slate-600">{rows.length} transacciones · Total: <b className="text-slate-900">{money(total)} COP</b> · {inside.length} vehículos dentro ahora</div>
        <div className="overflow-auto max-h-96">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-100 text-slate-600 text-left"><tr>{['Tiquete', 'Placa', 'Tipo', 'Entrada', 'Salida', 'Min.', 'Total', 'Pago', 'Sync'].map(h => <th key={h} className="px-3 py-2 whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody>{rows.slice(0, 400).map(r => (
              <tr key={r.id} className="border-t"><td className="px-3 py-1.5">#{r.ticket_code}</td><td className="px-3 font-mono font-bold">{displayPlate(r.plate)}</td><td className="px-3 capitalize">{r.vehicle_type}</td>
                <td className="px-3 whitespace-nowrap">{fmtDT(r.entry_time)}</td><td className="px-3 whitespace-nowrap">{fmtDT(r.exit_time!)}</td><td className="px-3">{r.total_minutes}</td>
                <td className="px-3 font-semibold">{money(r.total_amount)}</td><td className="px-3 capitalize">{r.payment_method}</td><td className="px-3">{r.sync_status === 'synced' ? '✔' : '⏳'}</td></tr>))}
              {!rows.length && <tr><td colSpan={9} className="text-center text-slate-400 py-6">Sin transacciones en el rango</td></tr>}</tbody>
          </table>
        </div>
      </Card>
      <Card className="p-4">
        <div className="font-bold mb-3">Auditoría de caja (turnos)</div>
        <div className="overflow-auto max-h-72">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-600 text-left"><tr>{['Apertura', 'Cierre', 'Base', 'Cobrado', 'Esperado', 'Reportado', 'Diferencia', 'Estado'].map(h => <th key={h} className="px-3 py-2 whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody>{[...data.shifts].sort((a, b) => b.opened_at.localeCompare(a.opened_at)).map(s => (
              <tr key={s.id} className="border-t"><td className="px-3 py-1.5 whitespace-nowrap">{fmtDT(s.opened_at)}</td><td className="px-3 whitespace-nowrap">{s.closed_at ? fmtDT(s.closed_at) : '-'}</td>
                <td className="px-3">{money(s.initial_base_cash)}</td><td className="px-3">{money(shiftTotals(s, data.records).total)}</td><td className="px-3">{s.system_calculated_cash == null ? '-' : money(s.system_calculated_cash)}</td>
                <td className="px-3">{s.reported_cash == null ? '-' : money(s.reported_cash)}</td>
                <td className={`px-3 font-bold ${s.difference === 0 ? 'text-emerald-600' : (s.difference ?? 0) < 0 ? 'text-red-600' : 'text-sky-600'}`}>{s.difference == null ? '-' : money(s.difference)}</td><td className="px-3 capitalize">{s.status}</td></tr>))}
              {!data.shifts.length && <tr><td colSpan={8} className="text-center text-slate-400 py-6">Aún no hay turnos</td></tr>}</tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
