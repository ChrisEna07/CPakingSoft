'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, Eye, EyeOff, KeyRound, Mail, X } from 'lucide-react';
import { useStore } from '@/lib/store';
import { isEmail } from '@/lib/validators';
import { supabase } from '@/lib/supabase';
import { Btn, Card, TextInput } from './ui';
import { Footer } from './Footer';

export function Login() {
  const router = useRouter();
  const { login, toast } = useStore();

  const [identifier, setIdentifier] = useState('');
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  // Modal de recuperación de contraseña
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [sendingRecovery, setSendingRecovery] = useState(false);

  // 3. Log de debug temporal
  useEffect(() => {
    console.log('Supabase URL cargada:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawInput = identifier.trim();
    if (!rawInput) {
      toast('err', 'Por favor ingrese su usuario o correo electrónico.');
      return;
    }

    // Mapeo transparente: ChrizDev07 -> christianjoroce@gmail.com
    let resolvedEmail = rawInput;
    if (rawInput.toLowerCase() === 'chrizdev07') {
      resolvedEmail = 'christianjoroce@gmail.com';
    } else if (!isEmail(rawInput)) {
      toast('err', 'Ingrese un usuario válido (ChrizDev07) o un correo electrónico válido.');
      return;
    }

    if (pw.length < 6) {
      toast('err', 'La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setBusy(true);
    const res = await login(resolvedEmail, pw);
    setBusy(false);

    if (res.error) {
      toast('err', res.error);
      return;
    }

    // Redirección inmediata según el rol
    if (res.role === 'superadmin') {
      router.push('/superadmin');
    } else if (res.role === 'tenant_admin') {
      router.push('/admin');
    } else {
      router.push('/pos');
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const mail = recoveryEmail.trim();
    if (!isEmail(mail)) {
      toast('err', 'Ingrese un correo electrónico válido para enviar el enlace.');
      return;
    }

    setSendingRecovery(true);
    try {
      const rawEnv = process.env.NEXT_PUBLIC_SITE_URL;
      const cleanEnv = rawEnv ? rawEnv.match(/https?:\/\/[^\s\]\)\"\'\,]+/)?.[0]?.replace(/\/$/, '') || rawEnv.trim().replace(/\/$/, '') : '';
      const siteUrl = cleanEnv
        || (typeof window !== 'undefined' ? window.location.origin : 'https://c-paking-soft.vercel.app');

      const { error } = await supabase.auth.resetPasswordForEmail(mail, {
        redirectTo: `${siteUrl}/reset-password`,
      });

      if (error) {
        toast('err', `Error al restablecer contraseña: ${error.message}`);
      } else {
        toast('ok', 'Enlace enviado. Por favor revisa tu bandeja de entrada o la carpeta de spam.');
        setShowRecovery(false);
        setRecoveryEmail('');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error de conexión';
      toast('err', `Falla inesperada: ${msg}`);
    } finally {
      setSendingRecovery(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between p-4 bg-slate-50">
      <div className="flex-1 grid place-items-center">
        <Card className="w-full max-w-md p-6 sm:p-8 shadow-xl border-slate-200 bg-white">
          {/* 1. Logo oficial de CParkingSoft */}
          <div className="flex flex-col items-center mb-6 text-center">
            <img
              src="/CparkingSoftLogo.jpg"
              alt="CParkingSoft Logo"
              className="h-16 w-auto mx-auto object-contain mb-3"
            />
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              CParkingSoft
            </h1>
            <p className="text-xs font-medium text-slate-500 mt-1">
              Control Integral de Parqueaderos · SaaS Multi-Tenant
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <TextInput
              label="Correo electrónico / Usuario"
              value={identifier}
              onChange={setIdentifier}
              autoComplete="username"
              autoFocus
              placeholder="ChrizDev07 o usuario@dominio.com"
            />

            <div>
              <label className="block text-xs text-slate-500 font-medium">Contraseña</label>
              <div className="relative mt-1">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={pw}
                  onChange={e => setPw(e.target.value)}
                  autoComplete="current-password"
                  className="block w-full border border-slate-300 rounded-lg pl-3 pr-10 py-2 text-base text-slate-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                  aria-label={showPw ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* Enlace de recuperación de contraseña */}
              <div className="flex justify-end mt-1.5">
                <button
                  type="button"
                  onClick={() => setShowRecovery(true)}
                  className="text-xs font-semibold text-amber-600 hover:text-amber-700 hover:underline transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            </div>

            <Btn
              type="submit"
              disabled={busy}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 shadow font-semibold"
            >
              <LogIn size={18} />
              {busy ? 'Ingresando…' : 'Iniciar sesión'}
            </Btn>
          </form>
        </Card>
      </div>

      {/* Modal de Recuperación de Contraseña */}
      {showRecovery && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm grid place-items-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 border border-slate-100">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <KeyRound size={20} />
                </div>
                <h2 className="text-base font-bold text-slate-900">
                  Recuperar Contraseña · CParkingSoft
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowRecovery(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Ingresa tu correo electrónico registrado y te enviaremos un enlace seguro para restablecer tu acceso.
            </p>

            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Correo electrónico
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={recoveryEmail}
                    onChange={e => setRecoveryEmail(e.target.value)}
                    required
                    placeholder="usuario@dominio.com"
                    className="block w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                  <Mail className="absolute left-3 top-2.5 text-slate-400" size={16} />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Btn
                  type="button"
                  onClick={() => setShowRecovery(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs px-3 py-2"
                >
                  Cancelar
                </Btn>
                <Btn
                  type="submit"
                  disabled={sendingRecovery}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs px-4 py-2 font-semibold"
                >
                  {sendingRecovery ? 'Enviando enlace…' : 'Enviar Enlace'}
                </Btn>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer Oficial */}
      <Footer className="py-4" />
    </div>
  );
}
