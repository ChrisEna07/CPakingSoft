'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn } from 'lucide-react';
import { useStore } from '@/lib/store';
import { isEmail } from '@/lib/validators';
import { Btn, Card, TextInput } from './ui';
import { Footer } from './Footer';

export function Login() {
  const router = useRouter();
  const { login, toast } = useStore();
  const [identifier, setIdentifier] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawInput = identifier.trim();
    if (!rawInput) {
      toast('err', 'Por favor ingrese su usuario o correo electrónico.');
      return;
    }

    // 1. MAPEO DE CREDENCIALES:
    // Permite "ChrizDev07" o correo. Si es ChrizDev07 (case-insensitive), se transforma internamente a christianjoroce@gmail.com
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

    // 3. REDIRECCIÓN TRAS LOGIN:
    // Al autenticar con éxito, consulta el role asociado a user.id y redirige según corresponda:
    if (res.role === 'superadmin') {
      router.push('/superadmin');
    } else if (res.role === 'tenant_admin') {
      router.push('/admin');
    } else {
      router.push('/pos');
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between p-4 bg-slate-50">
      <div className="flex-1 grid place-items-center">
        <Card className="w-full max-w-md p-6 sm:p-8 shadow-xl border-slate-200 bg-white">
          <div className="text-center mb-6">
            <img
              src="/CparkingSoftLogo.jpg"
              alt="CParkingSoft Logo"
              className="h-16 w-16 mx-auto rounded-2xl object-cover shadow-md border border-slate-100 mb-3"
            />
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">CParkingSoft</h1>
            <p className="text-xs font-medium text-slate-500 mt-1">Control Integral de Parqueaderos · SaaS Multi-Tenant</p>
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
            <label className="block text-xs text-slate-500 font-medium">Contraseña
              <input
                type="password"
                value={pw}
                onChange={e => setPw(e.target.value)}
                autoComplete="current-password"
                className="block w-full border border-slate-300 rounded-lg px-3 py-2 text-base text-slate-900 mt-1 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
              />
            </label>
            <Btn type="submit" disabled={busy} className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 shadow font-semibold">
              <LogIn size={18} />{busy ? 'Ingresando…' : 'Iniciar sesión'}
            </Btn>
          </form>
        </Card>
      </div>
      <Footer className="py-4" />
    </div>
  );
}
