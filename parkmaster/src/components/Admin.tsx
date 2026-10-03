'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  Download, Save, Settings, UserPlus, Users, FileText, Power, DollarSign,
  Car, Clock, ShieldAlert, FileSpreadsheet, Search, AlertTriangle, CheckCircle2,
  Calendar, Banknote, RefreshCw
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { dkey, downloadFile, fmtDT_CO, money, toCSV } from '@/lib/format';
import { displayPlate, isEmail } from '@/lib/validators';
import { shiftTotals } from '@/lib/billing';
import { printExecutiveReport } from '@/lib/pdfReport';
import type { Profile, Tenant, TenantConfig } from '@/lib/types';
import { Btn, Card, DigitsInput, TextInput, TextOnlyInput } from './ui';

type Tab = 'reportes' | 'config' | 'empleados';

export function Admin() {
  const [tab, setTab] = useState<Tab>('reportes');
  return (
    <div className="space-y-5">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {([
          ['reportes', 'Reportes y Auditoría', FileText],
          ['config', 'Configuración del negocio', Settings],
          ['empleados', 'Gestión de Cajeros', Users],
        ] as const).map(([k, l, Ic]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition shadow-sm ${
              tab === k
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <Ic size={16} />
            {l}
          </button>
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
    if (!t.business_name.trim()) {
      toast('err', 'Error al guardar: el nombre del parqueadero es obligatorio.');
      return;
    }
    if (c.rate_moto <= 0 || c.rate_carro <= 0) {
      toast('err', 'Error al guardar: las tarifas por hora deben ser mayores a cero.');
      return;
    }
    if (c.cap_moto <= 0 || c.cap_carro <= 0) {
      toast('err', 'Error al guardar: las capacidades deben ser mayores a cero.');
      return;
    }
    if (!c.ticket_prefix.trim()) {
      toast('err', 'Error al guardar: el prefijo de tiquete es obligatorio.');
      return;
    }
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
            <option value="hora">Hora o fracción iniciada</option>
            <option value="media">Bloques de 30 min (media tarifa)</option>
          </select>
        </label>
        <DigitsInput label="Capacidad Motos" value={n('cap_moto')} onChange={setN('cap_moto')} maxLength={4} />
        <DigitsInput label="Capacidad Carros" value={n('cap_carro')} onChange={setN('cap_carro')} maxLength={4} />
        <label className="block text-xs text-slate-500 font-medium">Papel térmico
          <select value={c.paper_width} onChange={e => setC({ ...c, paper_width: Number(e.target.value) as 58 | 80 })} className="block w-full border border-slate-300 rounded-lg px-3 py-2 text-base text-slate-900">
            <option value={80}>80 mm</option>
            <option value={58}>58 mm</option>
          </select>
        </label>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={c.barrier_enabled} onChange={e => setC({ ...c, barrier_enabled: e.target.checked })} />Talanquera habilitada</label>
          <DigitsInput label="Segundos de apertura de talanquera" value={n('barrier_open_seconds')} onChange={setN('barrier_open_seconds')} maxLength={2} disabled={!c.barrier_enabled} />
        </div>
      </div>
      <label className="block text-xs text-slate-500 font-medium">Texto legal del tiquete
        <textarea rows={4} value={c.legal_text} onChange={e => setC({ ...c, legal_text: e.target.value })} className="block w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900" /></label>
      <Btn onClick={save} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 font-bold"><Save size={18} />Guardar configuración</Btn>
    </Card>
  );
}

function Employees() {
  const { data, loadEmployees, createEmployee, setEmployeeActive, toast } = useStore();
  const [list, setList] = useState<Profile[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [deniedModal, setDeniedModal] = useState<string | null>(null);

  const refresh = () => {
    loadEmployees().then(setList);
  };

  useEffect(refresh, [loadEmployees]);

  const add = async () => {
    if (name.trim().length < 3) {
      toast('err', 'Error al crear cajero: digite el nombre completo.');
      return;
    }
    if (!isEmail(email.trim())) {
      toast('err', 'Error al crear cajero: el correo no tiene un formato válido.');
      return;
    }
    if (pw.length < 6) {
      toast('err', 'Error al crear cajero: la contraseña debe tener al menos 6 caracteres.');
      return;
    }
    const r = await createEmployee(name.trim(), email.trim().toLowerCase(), pw);
    toast(r.ok ? 'ok' : r.kind, r.message);
    if (r.ok) {
      setName('');
      setEmail('');
      setPw('');
      refresh();
    }
  };

  const toggle = async (p: Profile) => {
    // Si se va a desactivar, verificar si tiene turno abierto en cash_shifts
    if (p.active) {
      const openShift = data.shifts.find(s => s.cashier_id === p.id && s.status === 'abierto');
      if (openShift) {
        setDeniedModal(
          `⚠️ Operación Denegada: ${p.full_name} tiene un turno de caja abierto en la estación Taquilla 1 (T1). Debe realizar el arqueo y cierre de caja antes de poder ser desactivado.`
        );
        return;
      }
    }

    const r = await setEmployeeActive(p.id, !p.active, p.full_name);
    if (!r.ok) {
      if (r.message.includes('OPERACION_DENEGADA') || r.message.includes('Operación Denegada')) {
        setDeniedModal(r.message.replace('OPERACION_DENEGADA_TURNO_ABIERTO: ', ''));
      } else {
        toast('err', r.message);
      }
    } else {
      toast('ok', r.message);
    }
    refresh();
  };

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <Card className="p-5 space-y-3">
        <div className="font-bold flex items-center gap-2 text-slate-900">
          <UserPlus size={20} className="text-indigo-600" />
          Nuevo Cajero / Taquillero
        </div>
        <TextOnlyInput label="Nombre completo" value={name} onChange={setName} placeholder="Ej. Carlos Restrepo" />
        <TextInput label="Correo electrónico" value={email} onChange={setEmail} placeholder="cajero@parqueadero.com" />
        <label className="block text-xs text-slate-500 font-medium">Contraseña inicial
          <input
            type="password"
            value={pw}
            onChange={e => setPw(e.target.value)}
            className="block w-full border border-slate-300 rounded-lg px-3 py-2 text-base text-slate-900 mt-1"
            placeholder="Mínimo 6 caracteres"
          />
        </label>
        <Btn onClick={add} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 font-bold shadow-sm">
          Crear cuenta de cajero
        </Btn>
      </Card>

      <Card className="p-5">
        <div className="font-bold mb-3 text-slate-900">Cajeros de este parqueadero ({list.length})</div>
        <div className="space-y-2">
          {list.map(p => (
            <div key={p.id} className="flex items-center gap-3 border border-slate-200 rounded-xl p-3 bg-slate-50/50">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-900">{p.full_name}</div>
                <div className="text-xs text-slate-500 font-mono">{p.email}</div>
              </div>
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${p.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                {p.active ? 'Activo' : 'Inactivo'}
              </span>
              <Btn
                onClick={() => toggle(p)}
                className={`text-xs px-3 py-1.5 font-semibold transition ${
                  p.active
                    ? 'bg-amber-100 hover:bg-amber-200 text-amber-900'
                    : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800'
                }`}
              >
                <Power size={13} />
                {p.active ? 'Desactivar' : 'Activar'}
              </Btn>
            </div>
          ))}
          {!list.length && <div className="text-sm text-slate-400 text-center py-8">Aún no hay cajeros registrados.</div>}
        </div>
      </Card>

      {/* Modal de Advertencia por Turno Abierto */}
      {deniedModal && (
        <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4" role="dialog">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-amber-300">
            <div className="flex items-center gap-2 text-amber-600 font-bold text-base sm:text-lg">
              <AlertTriangle size={22} className="flex-shrink-0" />
              Bloqueo de Seguridad: Turno Activo
            </div>
            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed bg-amber-50 p-3 rounded-xl border border-amber-200 font-medium">
              {deniedModal}
            </p>
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setDeniedModal(null)}
                className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs px-5 py-2.5 rounded-xl shadow-md transition"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Reports() {
  const { data, session, loadEmployees } = useStore();
  const today = dkey(Date.now());
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [ft, setFt] = useState('todos');
  const [query, setQuery] = useState('');
  const [employeesMap, setEmployeesMap] = useState<Record<string, string>>({});

  useEffect(() => {
    loadEmployees().then(emps => {
      const map: Record<string, string> = {};
      emps.forEach(e => {
        map[e.id] = e.full_name;
      });
      if (session?.profile) {
        map[session.profile.id] = session.profile.full_name;
      }
      setEmployeesMap(map);
    });
  }, [loadEmployees, session?.profile]);

  const setRange = (preset: 'hoy' | 'ayer' | 'semana' | 'mes') => {
    const now = new Date();
    const tStr = dkey(now);
    if (preset === 'hoy') {
      setFrom(tStr);
      setTo(tStr);
    } else if (preset === 'ayer') {
      const y = new Date(Date.now() - 86400000);
      const yStr = dkey(y);
      setFrom(yStr);
      setTo(yStr);
    } else if (preset === 'semana') {
      const d = new Date();
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      setFrom(dkey(monday));
      setTo(tStr);
    } else if (preset === 'mes') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setFrom(dkey(firstDay));
      setTo(tStr);
    }
  };

  // Filtrado de transacciones
  const rows = useMemo(() => {
    return data.records
      .filter(r => {
        if (r.status !== 'cobrado' || !r.exit_time) return false;
        const exitDate = dkey(r.exit_time);
        if (exitDate < from || exitDate > to) return false;
        if (ft !== 'todos' && r.vehicle_type !== ft) return false;
        if (query.trim()) {
          const q = query.trim().toUpperCase();
          const matchPlate = r.plate.toUpperCase().includes(q);
          const matchTicket = r.ticket_code.toUpperCase().includes(q);
          if (!matchPlate && !matchTicket) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.exit_time!).getTime() - new Date(a.exit_time!).getTime());
  }, [data.records, from, to, ft, query]);

  // Cálculos KPIs superiores
  const totalRecaudadoHoy = useMemo(() => {
    return data.records
      .filter(r => r.status === 'cobrado' && r.exit_time && dkey(r.exit_time) === today)
      .reduce((s, r) => s + (r.total_amount ?? 0), 0);
  }, [data.records, today]);

  const insideVehicles = useMemo(() => {
    return data.records.filter(r => r.status === 'dentro');
  }, [data.records]);

  const totalCortesiaHoy = useMemo(() => {
    return data.records.filter(
      r => r.status === 'cobrado' && r.exit_time && dkey(r.exit_time) === today && (r.payment_method === 'cortesia' || (r.total_amount ?? 0) === 0)
    ).length;
  }, [data.records, today]);

  const expectedCashInBoxes = useMemo(() => {
    // Suma de turnos abiertos o cobros en efectivo hoy
    const openShifts = data.shifts.filter(s => s.status === 'abierto');
    if (openShifts.length > 0) {
      return openShifts.reduce((s, shift) => {
        const t = shiftTotals(shift, data.records);
        return s + shift.initial_base_cash + t.cash;
      }, 0);
    }
    // Si no hay turnos abiertos, sumar pagos en efectivo hoy
    return data.records
      .filter(r => r.status === 'cobrado' && r.exit_time && dkey(r.exit_time) === today && r.payment_method === 'efectivo')
      .reduce((s, r) => s + (r.total_amount ?? 0), 0);
  }, [data.shifts, data.records, today]);

  const totalRangeAmount = useMemo(() => {
    return rows.reduce((s, r) => s + (r.total_amount ?? 0), 0);
  }, [rows]);

  const tenant = session!.tenant!;

  const getEmpName = (id: string | null) => {
    if (!id) return 'Taquilla Principal';
    return employeesMap[id] || (session?.profile?.id === id ? session.profile.full_name : 'Cajero / Taquilla');
  };

  const exportCSV = () => {
    const formattedRows = rows.map(r => ({
      ticket_code: r.ticket_code,
      plate: displayPlate(r.plate),
      vehicle_type: r.vehicle_type,
      entry_time: fmtDT_CO(r.entry_time),
      exit_time: fmtDT_CO(r.exit_time),
      total_minutes: r.total_minutes ?? 0,
      billed_hours: r.billed_hours ?? 0,
      total_amount: r.total_amount ?? 0,
      payment_method: r.payment_method || 'efectivo',
      operator_entry: getEmpName(r.created_by),
      operator_exit: getEmpName(r.closed_by),
      status: r.status,
    }));

    const cols = [
      'ticket_code',
      'plate',
      'vehicle_type',
      'entry_time',
      'exit_time',
      'total_minutes',
      'billed_hours',
      'total_amount',
      'payment_method',
      'operator_entry',
      'operator_exit',
      'status',
    ];

    downloadFile(
      `Auditoria_${tenant.slug}_${from}_a_${to}.csv`,
      toCSV(formattedRows as unknown as Record<string, unknown>[], cols),
      'text/csv;charset=utf-8'
    );
  };

  const handleExportPDF = () => {
    printExecutiveReport({
      tenant,
      from,
      to,
      rows,
      employeesMap,
    });
  };

  return (
    <div className="space-y-5">
      {/* 1. KPIs Superiores Interactivos */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4 border-l-4 border-l-emerald-500 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Total Recaudado Hoy</span>
            <DollarSign size={18} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1">{money(totalRecaudadoHoy)}</div>
          <div className="text-[11px] text-emerald-700 font-medium mt-0.5">Ingresos facturados hoy</div>
        </Card>

        <Card className="p-4 border-l-4 border-l-indigo-500 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Vehículos en Patio</span>
            <Car size={18} className="text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1">{insideVehicles.length}</div>
          <div className="text-[11px] text-indigo-700 font-medium mt-0.5">
            {insideVehicles.filter(x => x.vehicle_type === 'moto').length} motos · {insideVehicles.filter(x => x.vehicle_type === 'carro').length} carros
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-amber-500 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Cortesías / Gracia</span>
            <Clock size={18} className="text-amber-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1">{totalCortesiaHoy}</div>
          <div className="text-[11px] text-amber-700 font-medium mt-0.5">Exonerados o sin costo hoy</div>
        </Card>

        <Card className="p-4 border-l-4 border-l-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Efectivo en Cajas</span>
            <Banknote size={18} className="text-slate-800" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1">{money(expectedCashInBoxes)}</div>
          <div className="text-[11px] text-slate-500 font-medium mt-0.5">Base + cobros en efectivo</div>
        </Card>
      </div>

      {/* 2. Filtros Instantáneos y Exportación Dual */}
      <Card className="p-4 space-y-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Calendar size={14} /> Filtro Rápido:
            </span>
            <div className="flex gap-1">
              {(['hoy', 'ayer', 'semana', 'mes'] as const).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setRange(p)}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 capitalize transition"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={exportCSV}
              disabled={!rows.length}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
            >
              <FileSpreadsheet size={15} />
              📊 Exportar Excel / CSV
            </button>
            <button
              type="button"
              onClick={handleExportPDF}
              disabled={!rows.length}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-sm transition disabled:opacity-50"
            >
              <FileText size={15} />
              📄 Exportar Reporte PDF
            </button>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Fecha Desde</label>
            <input
              type="date"
              value={from}
              onChange={e => setFrom(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Fecha Hasta</label>
            <input
              type="date"
              value={to}
              onChange={e => setTo(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Tipo de Vehículo</label>
            <select
              value={ft}
              onChange={e => setFt(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
            >
              <option value="todos">Todos los vehículos</option>
              <option value="moto">Motos</option>
              <option value="carro">Carros</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">Buscar por Placa / Tiquete</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Ej. ABC123 o 001"
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="w-full border border-slate-300 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none uppercase font-mono"
              />
              <Search size={14} className="absolute left-2.5 top-2 text-slate-400" />
            </div>
          </div>
        </div>
      </Card>

      {/* 3. Tabla de Movimientos y Facturación con Trazabilidad Humana */}
      <Card className="p-4 shadow-sm space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
          <div>
            <div className="font-bold text-base text-slate-900 flex items-center gap-1.5">
              <FileText size={18} className="text-indigo-600" />
              Movimientos y Facturación Certificada
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Trazabilidad humana completa de entradas, salidas y cobros
            </div>
          </div>
          <div className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
            {rows.length} transacciones · Recaudo: <b className="text-slate-900">{money(totalRangeAmount)} COP</b>
          </div>
        </div>

        <div className="overflow-auto max-h-[480px] border border-slate-200 rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="sticky top-0 bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[11px] z-10">
              <tr>
                <th className="px-3 py-2.5 whitespace-nowrap">Tiquete</th>
                <th className="px-3 py-2.5 whitespace-nowrap">Placa</th>
                <th className="px-3 py-2.5 whitespace-nowrap">Tipo</th>
                <th className="px-3 py-2.5 whitespace-nowrap">Entrada</th>
                <th className="px-3 py-2.5 whitespace-nowrap">Salida</th>
                <th className="px-3 py-2.5 whitespace-nowrap">Estadía</th>
                <th className="px-3 py-2.5 whitespace-nowrap">Operador / Responsable</th>
                <th className="px-3 py-2.5 whitespace-nowrap">Total</th>
                <th className="px-3 py-2.5 whitespace-nowrap">Pago</th>
                <th className="px-3 py-2.5 whitespace-nowrap text-center">Sync</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {rows.slice(0, 400).map(r => (
                <tr key={r.id} className="hover:bg-slate-50/80 transition">
                  <td className="px-3 py-2 font-mono font-bold text-slate-900 whitespace-nowrap">
                    #{r.ticket_code}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="font-mono font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                      {displayPlate(r.plate)}
                    </span>
                  </td>
                  <td className="px-3 py-2 capitalize font-medium whitespace-nowrap">
                    {r.vehicle_type}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap font-mono text-[11px] text-slate-700">
                    {fmtDT_CO(r.entry_time)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap font-mono text-[11px] text-slate-700">
                    {fmtDT_CO(r.exit_time)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap font-medium text-slate-600">
                    {r.total_minutes ?? 0} min
                  </td>
                  <td className="px-3 py-2 text-[11px] whitespace-nowrap">
                    <div className="text-slate-700">
                      <span className="text-slate-400">Ingresó:</span> <b>{getEmpName(r.created_by)}</b>
                    </div>
                    <div className="text-slate-700">
                      <span className="text-slate-400">Cobró:</span> <b>{getEmpName(r.closed_by)}</b>
                    </div>
                  </td>
                  <td className="px-3 py-2 font-black text-slate-900 whitespace-nowrap">
                    {money(r.total_amount)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        r.payment_method === 'efectivo'
                          ? 'bg-emerald-100 text-emerald-800'
                          : r.payment_method === 'transferencia'
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {r.payment_method || 'cortesía'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center whitespace-nowrap">
                    {r.sync_status === 'synced' ? (
                      <span className="text-emerald-600 font-bold" title="Sincronizado">✔</span>
                    ) : (
                      <span className="text-amber-500 font-bold" title="Pendiente">⏳</span>
                    )}
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={10} className="text-center text-slate-400 py-10">
                    No se encontraron transacciones en el rango o filtro seleccionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 4. Tabla de Auditoría de Caja (Turnos) */}
      <Card className="p-4 shadow-sm space-y-2">
        <div className="flex items-center justify-between pb-2">
          <div>
            <div className="font-bold text-base text-slate-900 flex items-center gap-1.5">
              <Banknote size={18} className="text-emerald-600" />
              Auditoría de Caja y Cierres de Turno
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Control de arqueos, trazabilidad y diferencias de efectivo por estación
            </div>
          </div>
        </div>

        <div className="overflow-auto max-h-80 border border-slate-200 rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="sticky top-0 bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[11px] z-10">
              <tr>
                <th className="px-3 py-2.5 whitespace-nowrap">Cajero Asignado & Estación</th>
                <th className="px-3 py-2.5 whitespace-nowrap">Trazabilidad de Cierre</th>
                <th className="px-3 py-2.5 whitespace-nowrap">Base Inicial</th>
                <th className="px-3 py-2.5 whitespace-nowrap">Cobrado</th>
                <th className="px-3 py-2.5 whitespace-nowrap">Esperado</th>
                <th className="px-3 py-2.5 whitespace-nowrap">Reportado</th>
                <th className="px-3 py-2.5 whitespace-nowrap">Diferencia</th>
                <th className="px-3 py-2.5 whitespace-nowrap">Estado del Turno</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {[...data.shifts]
                .sort((a, b) => b.opened_at.localeCompare(a.opened_at))
                .map(s => {
                  const cashierName = getEmpName(s.cashier_id);
                  const isClosed = s.status === 'cerrado';
                  const diff = s.difference ?? 0;
                  const isExact = isClosed && diff === 0;
                  const isMissing = isClosed && diff < 0;
                  const isSurplus = isClosed && diff > 0;

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{cashierName}</div>
                        <div className="text-[11px] text-slate-400 font-medium">Taquilla 1 (T1)</div>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-[11px] text-slate-700">
                        <div>
                          <span className="text-slate-400">Abrió:</span> <b>{cashierName}</b> · {fmtDT_CO(s.opened_at)}
                        </div>
                        <div>
                          <span className="text-slate-400">Cierre:</span>{' '}
                          {s.closed_at ? (
                            <>
                              <b>{cashierName}</b> · {fmtDT_CO(s.closed_at)}
                            </>
                          ) : (
                            <span className="text-emerald-600 font-bold">En operación activa</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap font-medium text-slate-700">
                        {money(s.initial_base_cash)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap font-medium text-slate-700">
                        {money(shiftTotals(s, data.records).total)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap font-medium text-slate-700">
                        {s.system_calculated_cash == null ? '—' : money(s.system_calculated_cash)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap font-medium text-slate-700">
                        {s.reported_cash == null ? '—' : money(s.reported_cash)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap font-bold">
                        {s.difference == null ? (
                          '—'
                        ) : (
                          <span
                            className={
                              diff === 0
                                ? 'text-slate-700'
                                : diff < 0
                                ? 'text-red-600'
                                : 'text-amber-600'
                            }
                          >
                            {money(diff)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {!isClosed ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-full">
                            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            🟢 En curso (Abierto)
                          </span>
                        ) : isExact ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full">
                            ⚪ Cerrado - Cuadrado
                          </span>
                        ) : isMissing ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-800 bg-red-100 border border-red-200 px-2.5 py-1 rounded-full">
                            🔴 Cerrado - Faltante ({money(diff)})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-full">
                            🟡 Cerrado - Sobrante (+{money(diff)})
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              {!data.shifts.length && (
                <tr>
                  <td colSpan={8} className="text-center text-slate-400 py-8">
                    No se han registrado turnos de caja en este período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
