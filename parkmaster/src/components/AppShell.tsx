'use client';
import { useEffect, useState } from 'react';
import { LogOut, Cloud, WifiOff, ShieldAlert, RefreshCw } from 'lucide-react';
import { useStore } from '@/lib/store';
import { fmtDate, fmtTime } from '@/lib/format';
import { Login } from './Login';
import { Cashier } from './Cashier';
import { Admin } from './Admin';
import { SuperAdmin } from './SuperAdmin';
import { SupportButton } from './SupportButton';
import { PrintArea, type PrintDocT } from './PrintDoc';
import { Toasts } from './ui';

function Clock() {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => { setN(Date.now()); const i = setInterval(() => setN(Date.now()), 1000); return () => clearInterval(i); }, []);
  if (n === null) return null;
  return <div className="text-right text-white"><div className="text-xl font-mono font-bold">{fmtTime(n)}</div><div className="text-xs text-slate-300">{fmtDate(n)}</div></div>;
}

export function AppShell() {
  const { ready, session, logout, online, mode, syncing, syncError, data } = useStore();
  const [doc, setDoc] = useState<PrintDocT | null>(null);

  const print = (d: PrintDocT) => { setDoc(d); setTimeout(() => { try { window.print(); } catch { /* sin impresora */ } }, 400); };

  if (!ready) return <div className="min-h-screen grid place-items-center text-slate-500">Cargando ParkMaster…</div>;
  if (!session) return <><Toasts /><Login /></>;

  const { profile, tenant } = session;
  const suspended = tenant?.status === 'suspendido';
  const pending = data.queue.length;
  const roleLabel = { superadmin: 'Super-Admin', tenant_admin: 'Administrador', cajero: 'Cajero' }[profile.role];

  return (
    <>
      <div id="app-root" className="min-h-screen">
        <Toasts />
        <header className="bg-slate-900 shadow-lg">
          <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-lg sm:text-2xl font-bold text-white">{tenant ? tenant.business_name : 'ParkMaster SaaS · Panel de Desarrollador'}</h1>
              <div className="flex flex-wrap gap-2 mt-1.5 text-xs font-semibold">
                {online
                  ? <span className="bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded-full flex items-center gap-1"><Cloud size={12} />{mode === 'supabase' ? 'En línea · Supabase' : 'En línea · Modo demo local'}</span>
                  : <span className="bg-amber-500/20 text-amber-300 px-2 py-1 rounded-full flex items-center gap-1"><WifiOff size={12} />Modo Local / Desconectado</span>}
                {mode === 'supabase' && profile.role !== 'superadmin' && (
                  <span className={`px-2 py-1 rounded-full flex items-center gap-1 ${syncError ? 'bg-red-500/20 text-red-300' : 'bg-indigo-500/30 text-indigo-200'}`} title={syncError ?? ''}>
                    <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />{syncError ? 'Error de sincronización' : pending ? `${pending} pendientes de sincronizar` : 'Sincronizado'}
                  </span>
                )}
                <span className="bg-white/10 text-slate-200 px-2 py-1 rounded-full">{roleLabel}: {profile.full_name}</span>
                {tenant?.status === 'piloto' && <span className="bg-indigo-500/30 text-indigo-200 px-2 py-1 rounded-full">Piloto{tenant.next_payment_date ? ` hasta ${tenant.next_payment_date}` : ''}</span>}
              </div>
            </div>
            <div className="flex items-center gap-4"><Clock />
              <button onClick={logout} className="text-slate-300 hover:text-white flex items-center gap-1 text-sm"><LogOut size={16} />Salir</button></div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-5">
          {suspended ? (
            <div className="max-w-md mx-auto bg-white border border-red-300 rounded-xl p-6 text-center">
              <ShieldAlert className="mx-auto text-red-600 mb-2" size={40} />
              <div className="font-bold text-lg">Servicio suspendido</div>
              <p className="text-sm text-slate-600 mt-1">Este parqueadero está suspendido por el proveedor del servicio. Use el botón de Soporte para comunicarse con ChrizDev.</p>
            </div>
          ) : profile.role === 'superadmin' ? <SuperAdmin />
            : profile.role === 'tenant_admin' ? <Admin />
            : <Cashier print={print} />}
        </main>
        {profile.role !== 'superadmin' && tenant && <SupportButton />}
      </div>
      <PrintArea doc={doc} tenant={tenant} />
    </>
  );
}
