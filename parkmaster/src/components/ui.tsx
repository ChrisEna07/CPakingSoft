'use client';
import { useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, X } from 'lucide-react';
import { useStore } from '@/lib/store';
import { NAME_CHAR, onlyDigits, onlyLetters } from '@/lib/validators';

export const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-slate-200 ${className}`}>{children}</div>
);

export const Btn = ({ className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button {...p} className={`inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed ${className}`} />
);

const inputCls = 'block w-full border border-slate-300 rounded-lg px-3 py-2 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-400';
const Warn = ({ children }: { children: ReactNode }) => <p className="text-xs font-semibold text-red-600 mt-1">⚠ {children}</p>;

type Base = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & { label?: string; value: string; onChange: (v: string) => void };

/** Solo letras: bloquea números en tiempo real y avisa debajo. */
export function TextOnlyInput({ label, value, onChange, onKeyDown, ...rest }: Base) {
  const [warn, setWarn] = useState(false);
  return (
    <label className="block text-xs text-slate-500 font-medium">{label}
      <input {...rest} type="text" value={value} className={`${inputCls} ${warn ? 'border-red-500' : ''}`}
        onKeyDown={e => {
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && NAME_CHAR.test(e.key)) { e.preventDefault(); setWarn(true); }
          onKeyDown?.(e);
        }}
        onChange={e => { const c = onlyLetters(e.target.value); setWarn(c !== e.target.value); onChange(c); }}
        onBlur={() => setWarn(false)} />
      {warn && <Warn>Este campo solo admite letras</Warn>}
    </label>
  );
}

/** Solo dígitos 0-9 (sin e, +, -, ., letras). */
export function DigitsInput({ label, value, onChange, onKeyDown, maxLength = 12, format = false, ...rest }: Base & { maxLength?: number; format?: boolean }) {
  const [warn, setWarn] = useState(false);
  return (
    <label className="block text-xs text-slate-500 font-medium">{label}
      <input {...rest} type="text" inputMode="numeric" autoComplete="off" maxLength={maxLength + (format ? 4 : 0)}
        value={format && value !== '' ? Number(value).toLocaleString('es-CO') : value} className={`${inputCls} ${warn ? 'border-red-500' : ''}`}
        onKeyDown={e => {
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !/^\d$/.test(e.key)) { e.preventDefault(); setWarn(true); }
          onKeyDown?.(e);
        }}
        onChange={e => { const c = onlyDigits(e.target.value).slice(0, maxLength); setWarn(c !== e.target.value.replace(/\./g, '')); onChange(c); }}
        onBlur={() => setWarn(false)} />
      {warn && <Warn>Este campo solo admite números</Warn>}
    </label>
  );
}

export function TextInput({ label, value, onChange, ...rest }: Base) {
  return (
    <label className="block text-xs text-slate-500 font-medium">{label}
      <input {...rest} type="text" value={value} onChange={e => onChange(e.target.value)} className={inputCls} />
    </label>
  );
}

export function Toasts() {
  const { toasts, dismissToast } = useStore();
  const st = { ok: ['bg-emerald-600', CheckCircle2], err: ['bg-red-600', XCircle], info: ['bg-amber-500', AlertTriangle] } as const;
  return (
    <div id="toasts" className="fixed top-4 right-4 z-[60] space-y-2 w-[min(94vw,26rem)]">
      {toasts.map(t => {
        const [c, Ic] = st[t.kind];
        return (
          <div key={t.id} role="alert" className={`${c} text-white rounded-lg shadow-xl px-4 py-3 flex items-start gap-3`}>
            <Ic size={22} className="shrink-0 mt-0.5" />
            <div className="flex-1 text-sm leading-snug">{t.msg}</div>
            <button onClick={() => dismissToast(t.id)} aria-label="Cerrar"><X size={16} /></button>
          </div>
        );
      })}
    </div>
  );
}
