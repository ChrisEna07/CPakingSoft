'use client';
import { useState } from 'react';
import { ShieldCheck, AlertCircle, FileText, CheckSquare, Square, Lock } from 'lucide-react';
import { useStore } from '@/lib/store';
import { Btn } from './ui';

export function LegalModal() {
  const { session, recordLegalAcceptance, toast } = useStore();
  const [terms, setTerms] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [custody, setCustody] = useState(false);
  const [busy, setBusy] = useState(false);

  const allChecked = terms && privacy && custody;

  const handleAccept = async () => {
    if (!allChecked) {
      toast('err', 'Debe marcar las 3 casillas obligatorias para desbloquear el sistema.');
      return;
    }
    setBusy(true);
    const res = await recordLegalAcceptance(terms, privacy, custody);
    setBusy(false);
    if (res.ok) {
      toast('ok', 'Términos y acuerdos legales registrados con éxito. Acceso concedido a CParkingSoft.');
    } else {
      toast('err', res.message);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-title"
    >
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Cabecera */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 flex items-center gap-4 border-b border-slate-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/CparkingSoftLogo.jpg"
            alt="CParkingSoft"
            className="w-12 h-12 rounded-xl object-contain bg-white p-1 shadow-md shrink-0"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                Onboarding Mandatorio
              </span>
              <span className="text-xs font-mono text-slate-400">Versión v1.0.0</span>
            </div>
            <h2 id="legal-title" className="text-lg sm:text-xl font-bold text-white truncate mt-1">
              CParkingSoft · Términos Legales y Responsabilidad
            </h2>
            <p className="text-xs text-slate-300">
              {session?.tenant?.business_name ?? 'Panel de Control Principal'} · Usuario: {session?.profile.email}
            </p>
          </div>
        </div>

        {/* Cuerpo con cláusulas */}
        <div className="p-5 sm:p-6 space-y-4 max-h-[60vh] overflow-y-auto text-sm text-slate-700 leading-relaxed border-b border-slate-100">
          <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded-r-lg text-amber-950 text-xs sm:text-sm flex items-start gap-2.5">
            <AlertCircle className="shrink-0 text-amber-600 mt-0.5" size={18} />
            <div>
              <b>Aviso de Bloqueo Legal:</b> Este paso es de cumplimiento legal estricto. Su aceptación quedará registrada de forma inmutable con marca de tiempo, dirección IP y firma digital del dispositivo.
            </div>
          </div>

          {/* Cláusula 1 */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-1.5">
            <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm sm:text-base">
              <ShieldCheck className="text-indigo-600 shrink-0" size={18} />
              1. Exoneración de Responsabilidad sobre Custodia Vehicular
            </h3>
            <p className="text-xs sm:text-sm text-slate-600">
              <b>CParkingSoft</b> es exclusivamente una herramienta de software orientada a la liquidación tarifaria, auditoría contable y control de tiempos de permanencia. La administración del parqueadero mantiene la <b>responsabilidad exclusiva y directa</b> sobre la custodia física, vigilancia, salvaguarda y cualquier reclamación por pérdidas, daños, hurtos totales o parciales, o siniestros que ocurran sobre los vehículos estacionados o los objetos depositados en su interior.
            </p>
          </div>

          {/* Cláusula 2 */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-1.5">
            <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm sm:text-base">
              <FileText className="text-indigo-600 shrink-0" size={18} />
              2. Tratamiento de Datos Personales (Ley 1581 de 2012 de Colombia)
            </h3>
            <p className="text-xs sm:text-sm text-slate-600">
              En concordancia con el Régimen General de Protección de Datos Personales de Colombia (Ley Estatutaria 1581 de 2012 y Decretos Reglamentarios), se autoriza a CParkingSoft y al operador a recopilar, almacenar y procesar datos operativos (incluyendo placas vehiculares, registros fotográficos LPR de cámaras de acceso, marcas de tiempo y auditorías de operadores) con fines estrictamente operativos, de facturación, seguridad y auditoría tributaria.
            </p>
          </div>

          {/* Cláusula 3 */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-1.5">
            <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm sm:text-base">
              <Lock className="text-indigo-600 shrink-0" size={18} />
              3. Exoneración por Interrupciones Ajenas al Software
            </h3>
            <p className="text-xs sm:text-sm text-slate-600">
              CParkingSoft incorpora arquitectura <i>Offline-First</i> de alta resiliencia. No obstante, el desarrollador queda exonerado de responsabilidad por interrupciones totales derivadas de cortes imprevistos en el suministro eléctrico local, fallas del proveedor de internet (ISP), daños en hardware del cliente (impresoras térmicas, talanqueras) o fuerza mayor.
            </p>
          </div>

          {/* Checkboxes mandatorios */}
          <div className="pt-2 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Marque todas las casillas para confirmar su aceptación:
            </div>

            <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition select-none">
              <input
                type="checkbox"
                checked={terms}
                onChange={e => setTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <span className="text-xs sm:text-sm text-slate-800 font-medium">
                He leído, comprendo y acepto en su totalidad los <b>Términos y Condiciones Generales de Uso</b> de CParkingSoft (versión v1.0.0).
              </span>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition select-none">
              <input
                type="checkbox"
                checked={privacy}
                onChange={e => setPrivacy(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <span className="text-xs sm:text-sm text-slate-800 font-medium">
                Autorizo expresamente la <b>Política de Tratamiento de Datos Personales</b> en el marco de la <b>Ley 1581 de 2012 de Colombia</b>.
              </span>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition select-none">
              <input
                type="checkbox"
                checked={custody}
                onChange={e => setCustody(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <span className="text-xs sm:text-sm text-slate-800 font-medium">
                Acepto de manera irrevocable la <b>Cláusula de Exoneración de Custodia y Responsabilidad Vehicular</b> de la plataforma.
              </span>
            </label>
          </div>
        </div>

        {/* Footer del modal */}
        <div className="p-4 sm:p-5 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500 text-center sm:text-left">
            Al confirmar se generará un registro con firma criptográfica en el registro de auditoría.
          </div>
          <Btn
            onClick={handleAccept}
            disabled={!allChecked || busy}
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 font-bold text-sm shadow-md disabled:bg-slate-300 disabled:text-slate-500"
          >
            {busy ? 'Registrando aceptación...' : 'Aceptar Cláusulas y Acceder'}
          </Btn>
        </div>
      </div>
    </div>
  );
}
