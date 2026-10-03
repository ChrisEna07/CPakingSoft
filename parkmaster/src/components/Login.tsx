'use client';
import { useState } from 'react';
import { LogIn } from 'lucide-react';
import { useStore } from '@/lib/store';
import { isEmail } from '@/lib/validators';
import { Btn, Card, TextInput } from './ui';

export function Login() {
  const { login, mode, toast } = useStore();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEmail(email.trim())) { toast('err', 'Correo inválido: escríbalo con el formato usuario@dominio.com'); return; }
    if (pw.length < 6) { toast('err', 'La contraseña debe tener al menos 6 caracteres.'); return; }
    setBusy(true);
    const err = await login(email, pw);
    setBusy(false);
    if (err) toast('err', err);
  };

  return (
    <div className="min-h-screen grid place-items-center p-4">
      <Card className="w-full max-w-md p-6">
        <div className="text-center mb-5">
          <div className="text-2xl font-black text-slate-900">ParkMaster SaaS</div>
          <div className="text-sm text-slate-500">CParkingSoft · Control Integral de Parqueaderos</div>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <TextInput label="Correo electrónico" value={email} onChange={setEmail} autoComplete="username" autoFocus />
          <label className="block text-xs text-slate-500 font-medium">Contraseña
            <input type="password" value={pw} onChange={e => setPw(e.target.value)} autoComplete="current-password" className="block w-full border border-slate-300 rounded-lg px-3 py-2 text-base text-slate-900" /></label>
          <Btn type="submit" disabled={busy} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3"><LogIn size={18} />{busy ? 'Ingresando…' : 'Iniciar sesión'}</Btn>
        </form>
        {mode === 'local' && (
          <div className="mt-5 text-xs bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-900 space-y-1">
            <b>MODO LOCAL (demo sin Supabase)</b> — cuentas de prueba:
            <div>Super-Admin: <code>superadmin@parkmaster.local</code> / <code>superadmin123</code></div>
            <div>Administrador: <code>admin@fabricato.local</code> / <code>admin123</code></div>
            <div>Cajero: <code>cajero@fabricato.local</code> / <code>cajero123</code></div>
          </div>
        )}
      </Card>
    </div>
  );
}
