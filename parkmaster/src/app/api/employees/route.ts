import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

interface Body { role?: string; tenant_id?: string; email?: string; full_name?: string; password?: string }

/**
 * Crea cuentas (cajero / tenant_admin) usando la service_role key, que NUNCA sale al navegador.
 * - tenant_admin del parqueadero: solo puede crear cajeros en SU tenant.
 * - superadmin: puede crear tenant_admin o cajero en cualquier tenant.
 */
export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service) return NextResponse.json({ error: 'Servidor sin configurar: falta SUPABASE_SERVICE_ROLE_KEY.' }, { status: 500 });

  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });

  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: u } = await admin.auth.getUser(token);
  if (!u.user) return NextResponse.json({ error: 'Sesión inválida.' }, { status: 401 });

  const { data: caller } = await admin.from('profiles').select('*').eq('id', u.user.id).maybeSingle();
  if (!caller || !caller.active) return NextResponse.json({ error: 'Usuario sin permisos.' }, { status: 403 });

  const b = (await req.json().catch(() => ({}))) as Body;
  const email = (b.email ?? '').trim().toLowerCase();
  const fullName = (b.full_name ?? '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || fullName.length < 3 || (b.password ?? '').length < 6)
    return NextResponse.json({ error: 'Datos inválidos: revise nombre, correo y contraseña (mín. 6 caracteres).' }, { status: 400 });

  let role: 'cajero' | 'tenant_admin';
  let tenantId: string;
  if (caller.role === 'tenant_admin' && caller.tenant_id) {
    role = 'cajero'; tenantId = caller.tenant_id;
  } else if (caller.role === 'superadmin') {
    if (!b.tenant_id || (b.role !== 'tenant_admin' && b.role !== 'cajero')) return NextResponse.json({ error: 'Indique tenant_id y rol válido.' }, { status: 400 });
    role = b.role; tenantId = b.tenant_id;
  } else return NextResponse.json({ error: 'Sin permisos para crear cuentas.' }, { status: 403 });

  const { data: created, error } = await admin.auth.admin.createUser({ email, password: b.password, email_confirm: true });
  if (error || !created.user) return NextResponse.json({ error: error?.message ?? 'No se pudo crear el usuario.' }, { status: 400 });

  const { error: pErr } = await admin.from('profiles').insert({ id: created.user.id, tenant_id: tenantId, full_name: fullName, email, role, active: true });
  if (pErr) {
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: `No se pudo crear el perfil: ${pErr.message}` }, { status: 400 });
  }
  return NextResponse.json({ ok: true, id: created.user.id });
}
