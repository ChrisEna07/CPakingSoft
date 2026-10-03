'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Lock, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Btn, Card } from '@/components/ui';
import { Logo } from '@/components/Logo';
import { Footer } from '@/components/Footer';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (newPassword.length < 6) {
      setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('Las contraseñas no coinciden.');
      return;
    }

    setBusy(true);
    try {
      if (!supabase) {
        throw new Error('Supabase no configurado en este entorno.');
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setErrorMsg(error.message);
      } else {
        setSuccess(true);
        setTimeout(() => {
          router.push('/');
        }, 2500);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al actualizar contraseña');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between p-4 bg-slate-50">
      <div className="flex-1 grid place-items-center">
        <Card className="w-full max-w-md p-6 sm:p-8 shadow-xl border-slate-200 bg-white">
          <div className="flex flex-col items-center mb-6 text-center">
            <Logo variant="icon" size={54} className="mb-2 shadow-md rounded-2xl" />
            <h1 className="text-2xl font-black tracking-tight" style={{ color: '#1E3A8A' }}>
              CParking<span style={{ color: '#D97706' }}>Soft</span>
            </h1>
            <p className="text-xs font-medium text-slate-500 mt-1">
              Restablecer Contraseña
            </p>
          </div>

          {success ? (
            <div className="text-center py-6 space-y-3">
              <CheckCircle2 size={48} className="text-emerald-600 mx-auto" />
              <div className="text-base font-bold text-slate-900">¡Contraseña actualizada!</div>
              <p className="text-xs text-slate-600">
                Tu contraseña ha sido modificada con éxito. Redirigiendo a la pantalla de inicio de sesión…
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {errorMsg && (
                <div className="p-3 text-xs bg-red-50 text-red-700 rounded-lg border border-red-200">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-xs text-slate-500 font-medium">Nueva Contraseña</label>
                <div className="relative mt-1">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                    placeholder="Mínimo 6 caracteres"
                    className="block w-full border border-slate-300 rounded-lg pl-3 pr-10 py-2 text-base text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                  >
                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-500 font-medium">Confirmar Nueva Contraseña</label>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Repita la nueva contraseña"
                  className="block w-full border border-slate-300 rounded-lg px-3 py-2 text-base text-slate-900 mt-1 focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <Btn
                type="submit"
                disabled={busy}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 shadow font-semibold"
              >
                <KeyRound size={18} />
                {busy ? 'Actualizando…' : 'Guardar Nueva Contraseña'}
              </Btn>
            </form>
          )}
        </Card>
      </div>
      <Footer className="py-4" />
    </div>
  );
}
