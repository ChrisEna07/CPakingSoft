'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Bike, Car, Printer, Search, LogOut, LogIn, Lock, Wallet, Ticket, Banknote, Landmark, Calculator, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { useStore } from '@/lib/store';
import { liquidate, shiftTotals } from '@/lib/billing';
import { displayPlate, normalizePlate, validatePlate, getPlateWarning } from '@/lib/validators';
import { durText, fmtDT, money } from '@/lib/format';
import type { CashShift, ParkingRecord, PaymentMethod, VehicleType } from '@/lib/types';
import { Btn, Card, DigitsInput } from './ui';
import { ThermalDoc, type PrintDocT } from './PrintDoc';

type Tab = 'entrada' | 'salida' | 'turno';

export function Cashier({ print }: { print: (d: PrintDocT) => void }) {
  const { data, session, openShiftOf, toast } = useStore();
  const [tab, setTab] = useState<Tab>('entrada');
  const tenant = session!.tenant!;
  const shift = openShiftOf();
  const inside = data.records.filter(r => r.status === 'dentro');
  const mo = inside.filter(r => r.vehicle_type === 'moto').length;
  const ca = inside.length - mo;
  const cfg = tenant.config_json;
  void toast;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[['Cupos Motos libres', cfg.cap_moto - mo, `${mo} dentro`], ['Cupos Carros libres', cfg.cap_carro - ca, `${ca} dentro`], ['Vehículos dentro', inside.length, 'en patio'],
          ['Turno', shift ? 'Abierto' : 'Sin abrir', shift ? `desde ${fmtDT(shift.opened_at)}` : 'Abra turno para operar']].map(([l, v, s]) => (
          <Card key={String(l)} className="px-4 py-3"><div className="text-xs text-slate-500">{l}</div><div className="text-2xl font-black text-slate-900">{v}</div><div className="text-[11px] text-slate-400">{s}</div></Card>
        ))}
      </div>
      <div className="flex gap-2 overflow-x-auto">
        {([['entrada', 'Entrada', Ticket], ['salida', 'Salida y Cobro', LogOut], ['turno', 'Turno y Arqueo', Wallet]] as const).map(([k, l, Ic]) => (
          <button key={k} onClick={() => setTab(k)} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm whitespace-nowrap ${tab === k ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}><Ic size={16} />{l}</button>
        ))}
      </div>
      {tab === 'entrada' && <Entry print={print} goTurno={() => setTab('turno')} />}
      {tab === 'salida' && <Exit print={print} goTurno={() => setTab('turno')} />}
      {tab === 'turno' && <ShiftPanel print={print} />}
    </div>
  );
}

function Entry({ print, goTurno }: { print: (d: PrintDocT) => void; goTurno: () => void }) {
  const { registerEntry, toast, session, openShiftOf } = useStore();
  const [type, setType] = useState<VehicleType>('moto');
  const [plate, setPlate] = useState('');
  const [last, setLast] = useState<ParkingRecord | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const tenant = session!.tenant!;

  // Auto-focus persistente
  useEffect(() => {
    ref.current?.focus();
    const interval = setInterval(() => {
      const activeTag = document.activeElement?.tagName;
      if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
        ref.current?.focus();
      }
    }, 800);
    return () => clearInterval(interval);
  }, []);

  // Atajos de teclado en taquilla POS
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        setType('moto');
        ref.current?.focus();
      } else if (e.key === 'F2') {
        e.preventDefault();
        setType('carro');
        ref.current?.focus();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setPlate('');
        ref.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const err = plate ? validatePlate(plate, type) : null;
  const warn = plate && !err ? getPlateWarning(plate, type) : null;

  const submit = () => {
    const r = registerEntry(plate, type);
    if (!r.ok) {
      toast(r.kind, r.message);
      if (r.kind === 'info' && !openShiftOf()) goTurno();
      ref.current?.focus();
      return;
    }
    const rec = r.data!;
    setLast(rec);
    setPlate('');
    toast('ok', r.message.replace('generado.', 'generado e impreso.'));
    print({ kind: 'ticket', record: rec });
    ref.current?.focus();
  };

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <Card className="p-5">
        <div className="grid grid-cols-2 gap-3 mb-3">
          {([['moto', 'Moto', Bike, tenant.config_json.rate_moto, 'F1 o 1'] as const, ['carro', 'Carro', Car, tenant.config_json.rate_carro, 'F2 o 2'] as const]).map(([k, l, Ic, rate, shortcut]) => (
            <button
              key={k}
              type="button"
              onClick={() => { setType(k); ref.current?.focus(); }}
              className={`rounded-xl border-2 p-3 flex flex-col items-center transition relative ${type === k ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
            >
              <span className="absolute top-1.5 right-2 text-[10px] font-mono font-bold bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                [{shortcut}]
              </span>
              <Ic size={28} />
              <b>{l}</b>
              <span className="text-sm font-semibold">{money(rate)}/h</span>
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase text-slate-500">
            Placa {type === 'moto' ? '(Motos: ABC12D, OLA92, ENB09H)' : '(Carros: ABC123, CD0123, OLA92)'}
          </label>
          <span className="text-[11px] text-slate-400 font-mono">
            [Esc] Limpiar · [Enter] Ingresar
          </span>
        </div>

        <input
          ref={ref}
          value={plate}
          autoComplete="off"
          spellCheck={false}
          maxLength={8}
          onChange={e => setPlate(normalizePlate(e.target.value))}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              setPlate('');
            } else if (e.key === '1' && plate === '') {
              e.preventDefault();
              setType('moto');
            } else if (e.key === '2' && plate === '') {
              e.preventDefault();
              setType('carro');
            }
          }}
          placeholder={type === 'moto' ? 'ABC12D' : 'ABC123'}
          className={`w-full mt-1 text-center text-4xl sm:text-5xl font-black font-mono tracking-widest uppercase rounded-xl border-4 py-3 sm:py-4 bg-amber-50 focus:outline-none focus:ring-4 focus:ring-emerald-300 ${err ? 'border-red-500' : warn ? 'border-amber-500' : 'border-slate-800'}`}
        />

        <div className="min-h-[24px] text-xs mt-1 text-center font-semibold flex items-center justify-center">
          {plate && (
            err ? (
              <span className="text-red-600 flex items-center gap-1">
                <AlertTriangle size={13} /> {err}
              </span>
            ) : warn ? (
              <span className="text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Info size={13} /> {warn}
              </span>
            ) : (
              <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 size={13} /> Formato válido: <b>{displayPlate(plate)}</b>
              </span>
            )
          )}
        </div>

        <Btn onClick={submit} className="w-full mt-2 bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 sm:py-4 text-base sm:text-lg font-bold shadow-md transition">
          <Printer size={22} /> Ingresar e Imprimir Tiquete [Enter]
        </Btn>
      </Card>
      <Card className="p-4">
        {last ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <b className="flex items-center gap-2"><Ticket size={18} />Último tiquete impreso</b>
              <Btn onClick={() => print({ kind: 'ticket', record: last })} className="bg-slate-800 text-white text-xs sm:text-sm px-3 py-1.5">
                <Printer size={16} /> Reimprimir
              </Btn>
            </div>
            <div className="bg-slate-100 p-3 rounded-lg overflow-auto">
              <div className="bg-white mx-auto shadow border">
                <ThermalDoc doc={{ kind: 'ticket', record: last }} tenant={tenant} />
              </div>
            </div>
          </>
        ) : (
          <div className="text-center text-slate-400 text-sm py-16">
            <Ticket className="mx-auto mb-2 opacity-40" size={36} />
            La vista previa del último tiquete aparecerá aquí
          </div>
        )}
      </Card>
    </div>
  );
}

function Exit({ print, goTurno }: { print: (d: PrintDocT) => void; goTurno: () => void }) {
  const { data, session, registerExit, toast, openShiftOf } = useStore();
  const tenant = session!.tenant!;
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('efectivo');
  const [given, setGiven] = useState('');
  const [verified, setVerified] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);

  const term = useMemo(() => {
    let t = q.trim();
    if (t.toUpperCase().startsWith('PF|')) t = t.split('|')[1] ?? '';
    return t.toUpperCase().replace(/[^A-Z0-9]/g, '');
  }, [q]);
  const list = useMemo(() => data.records.filter(r => r.status === 'dentro')
    .filter(r => !term || r.plate.includes(term) || r.ticket_code.replace(/-/g, '').includes(term))
    .sort((a, b) => new Date(a.entry_time).getTime() - new Date(b.entry_time).getTime()), [data.records, term]);

  const rec = list.find(r => r.id === sel) ?? data.records.find(r => r.id === sel && r.status === 'dentro') ?? null;
  const liq = rec ? liquidate(rec.entry_time, rec.vehicle_type, tenant.config_json, now) : null;
  const change = given === '' || !liq ? null : Number(given) - liq.amount;

  const pay = () => {
    if (!rec || !liq) return;
    if (liq.amount > 0 && method === 'efectivo' && given !== '' && Number(given) < liq.amount) { toast('err', `Efectivo insuficiente: faltan ${money(liq.amount - Number(given))} COP para completar el pago.`); return; }
    if (liq.amount > 0 && method === 'transferencia' && !verified) { toast('info', 'Confirme que la transferencia fue verificada en la app del banco antes de registrar la salida.'); return; }
    const r = registerExit(rec.id, method);
    if (!r.ok) { toast(r.kind, r.message); if (r.kind === 'info' && !openShiftOf()) goTurno(); return; }
    toast('ok', r.message);
    setSel(null); setGiven(''); setVerified(false); setQ('');
    if (r.data && r.data.total_amount) print({ kind: 'receipt', record: r.data });
  };

  return (
    <div className="grid lg:grid-cols-5 gap-5">
      <div className="lg:col-span-3 space-y-3">
        <Card className="p-3"><div className="relative">
          <Search size={18} className="absolute left-3 top-3 text-slate-400" />
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && list.length === 1) setSel(list[0].id); }}
            placeholder="Placa, código de tiquete o escanee el QR…" className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-slate-300 uppercase focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        </div></Card>
        <div className="text-xs text-slate-500 px-1">{list.length} vehículo(s) · mayor permanencia primero</div>
        <div className="space-y-2 max-h-[62vh] overflow-auto pr-1">
          {list.length === 0 && <Card className="p-8 text-center text-slate-400">No hay vehículos que coincidan.</Card>}
          {list.map(r => {
            const k = liquidate(r.entry_time, r.vehicle_type, tenant.config_json, now);
            return (
              <button key={r.id} onClick={() => { setSel(r.id); setGiven(''); setVerified(false); setMethod('efectivo'); }} className={`w-full text-left bg-white rounded-xl border-2 p-3 flex items-center gap-3 hover:shadow ${sel === r.id ? 'border-emerald-500' : 'border-slate-200'}`}>
                <div className="p-2 rounded-lg bg-indigo-50 text-indigo-700">{r.vehicle_type === 'moto' ? <Bike /> : <Car />}</div>
                <div className="flex-1 min-w-0"><div className="font-mono font-black text-lg">{displayPlate(r.plate)}</div><div className="text-xs text-slate-500">#{r.ticket_code} · {fmtDT(r.entry_time)}{r.sync_status === 'pending' ? ' · ⏳ pendiente de sync' : ''}</div></div>
                <div className="text-right"><div className="text-sm font-semibold">{durText(k.total_minutes)}</div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${k.free ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{k.free ? 'Gracia · $0' : money(k.amount)}</span></div>
              </button>
            );
          })}
        </div>
      </div>
      <div className="lg:col-span-2">
        <Card className="p-5 lg:sticky lg:top-4">
          <div className="flex items-center gap-2 font-bold mb-3"><Calculator size={20} />Tarjeta de Cobro</div>
          {!rec || !liq ? <div className="text-center text-slate-400 py-10 text-sm">Seleccione un vehículo para liquidar</div> : (
            <>
              <div className="flex items-center justify-between mb-3"><div className="font-mono font-black text-2xl">{displayPlate(rec.plate)}</div><span className="text-xs font-bold bg-slate-100 px-2 py-1 rounded uppercase">{rec.vehicle_type}</span></div>
              <dl className="text-sm space-y-2 border-y border-slate-200 py-3">
                <div className="flex justify-between"><dt className="text-slate-500">Tiempo total</dt><dd className="font-semibold">{durText(liq.total_minutes)}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Tarifa / hora</dt><dd className="font-semibold">{money(liq.rate)}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Gracia</dt><dd className="font-semibold">{tenant.config_json.grace_minutes} min</dd></div>
                {!liq.free && <div className="flex justify-between"><dt className="text-slate-500">Cobrado</dt><dd className="font-semibold">{liq.units} {liq.unit_label}</dd></div>}
              </dl>
              <div className="py-3 text-right"><div className="text-xs text-slate-500">TOTAL A PAGAR</div>
                <div className={`text-4xl font-black ${liq.free ? 'text-emerald-600' : ''}`}>{money(liq.amount)} <span className="text-base">COP</span></div>
                {liq.free && <div className="text-sm font-semibold text-emerald-600">Período de Gracia Gratuito</div>}</div>
              {!liq.free && (
                <>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {([['efectivo', 'Efectivo', Banknote], ['transferencia', 'Transferencia', Landmark]] as const).map(([k, l, Ic]) => (
                      <button key={k} onClick={() => setMethod(k)} className={`border-2 rounded-lg p-2 flex flex-col items-center text-sm font-semibold ${method === k ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 text-slate-600'}`}><Ic size={20} />{l}</button>
                    ))}
                  </div>
                  {method === 'efectivo' && (
                    <div className="mb-3 bg-slate-50 rounded-lg p-3">
                      <DigitsInput label="PAGA CON" value={given} onChange={setGiven} format placeholder="$0" />
                      {change !== null && (change >= 0 ? <div className="mt-2 text-lg font-black text-emerald-700">Devuelta: {money(change)}</div> : <div className="mt-2 text-lg font-black text-red-600">Faltan: {money(-change)}</div>)}
                    </div>
                  )}
                  {method === 'transferencia' && (
                    <label className="flex items-center gap-2 text-sm mb-3 bg-amber-50 border border-amber-200 rounded-lg p-3"><input type="checkbox" checked={verified} onChange={e => setVerified(e.target.checked)} />Transferencia verificada en la app del banco ({money(liq.amount)} COP)</label>
                  )}
                </>
              )}
              <Btn onClick={pay} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 text-lg"><LogOut size={20} />Cobrar y Registrar Salida</Btn>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function ShiftPanel({ print }: { print: (d: PrintDocT) => void }) {
  const { data, session, openShift, closeShift, openShiftOf, toast } = useStore();
  const [base, setBase] = useState('');
  const [real, setReal] = useState('');
  const [result, setResult] = useState<CashShift | null>(null);
  const shift = openShiftOf();
  const name = session!.profile.full_name;

  const open = () => {
    if (base === '') { toast('err', 'Error al abrir turno: debe digitar la base de efectivo inicial (puede ser 0).'); return; }
    const r = openShift(Number(base));
    toast(r.ok ? 'ok' : r.kind, r.message);
    if (r.ok) { setBase(''); setResult(null); }
  };
  const close = () => {
    if (real === '') { toast('err', 'Error al cerrar turno: digite el dinero físico que tiene en mano (cierre ciego).'); return; }
    if (!confirm('¿Cerrar el turno con el valor digitado? No se puede deshacer.')) return;
    const r = closeShift(Number(real));
    if (!r.ok) { toast(r.kind, r.message); return; }
    setResult(r.data!); setReal('');
    const d = r.data!.difference ?? 0;
    toast(d === 0 ? 'ok' : 'info', d === 0 ? 'Turno cerrado con éxito: caja cuadrada exacta.' : `Turno cerrado con diferencia de ${money(d)} COP. Se generó el comprobante de arqueo.`);
  };
  const totalsOf = (s: CashShift) => shiftTotals(s, data.records);

  return (
    <div className="grid lg:grid-cols-2 gap-5">
      <Card className="p-5">
        <div className="font-bold flex items-center gap-2 mb-3"><Wallet size={20} />Control de Turno</div>
        {!shift ? (
          <>
            <p className="text-sm text-slate-500 mb-3">No hay turno abierto. Registre la base de caja inicial para empezar a operar.</p>
            <DigitsInput label="BASE DE CAJA INICIAL (COP)" value={base} onChange={setBase} format placeholder="$0" className="text-2xl font-black" />
            <Btn onClick={open} className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white py-3"><LogIn size={20} />Abrir Turno</Btn>
          </>
        ) : (
          <>
            <div className="text-sm bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-4 space-y-1">
              <div className="flex justify-between"><span>Cajero</span><b>{name}</b></div>
              <div className="flex justify-between"><span>Abierto</span><b>{fmtDT(shift.opened_at)}</b></div>
              <div className="flex justify-between"><span>Base inicial</span><b>{money(shift.initial_base_cash)}</b></div>
            </div>
            <div className="font-semibold mb-1 flex items-center gap-2"><Lock size={16} />Cierre ciego</div>
            <p className="text-sm text-slate-500 mb-2">Cuente todo el efectivo (incluida la base) y digítelo. El sistema no muestra cuánto debería haber.</p>
            <DigitsInput label="EFECTIVO FÍSICO EN MANO (COP)" value={real} onChange={setReal} format placeholder="$0" className="text-2xl font-black" />
            <Btn onClick={close} className="w-full mt-4 bg-slate-800 hover:bg-slate-900 text-white py-3"><Lock size={20} />Cerrar Turno</Btn>
          </>
        )}
      </Card>
      <div>
        {result ? (() => {
          const t = totalsOf(result); const d = result.difference ?? 0;
          return (
            <Card className={`p-5 border-2 ${d === 0 ? 'border-emerald-500' : d < 0 ? 'border-red-500' : 'border-sky-500'}`}>
              <div className="text-xl font-black flex items-center gap-2 mb-3">
                {d === 0 && <><CheckCircle2 className="text-emerald-600" />✅ Caja Cuadrada Exacta</>}
                {d < 0 && <><AlertTriangle className="text-red-600" />⚠️ Faltante de Dinero: -{money(-d)} COP</>}
                {d > 0 && <><Info className="text-sky-600" />ℹ️ Sobrante de Dinero: +{money(d)} COP</>}
              </div>
              <div className="text-sm space-y-1">
                {[['Base inicial', result.initial_base_cash], ['Cobros en efectivo', t.cash], ['Cobros por transferencia', t.transfer], ['Motos', t.moto], ['Carros', t.carro], ['Efectivo esperado', result.system_calculated_cash], ['Efectivo reportado', result.reported_cash]].map(([l, v]) => (
                  <div key={String(l)} className="flex justify-between border-b border-slate-100 py-1"><span className="text-slate-500">{l}</span><b>{money(Number(v))}</b></div>))}
              </div>
              <Btn onClick={() => print({ kind: 'arqueo', shift: result, cashier: name, cash: t.cash, transfer: t.transfer, moto: t.moto, carro: t.carro })} className="w-full mt-4 bg-slate-800 text-white py-2.5"><Printer size={18} />Imprimir comprobante de arqueo</Btn>
            </Card>
          );
        })() : <Card className="p-8 text-center text-slate-400 text-sm"><Calculator className="mx-auto mb-2" size={32} />El veredicto del arqueo aparecerá aquí al cerrar el turno.</Card>}
      </div>
    </div>
  );
}
