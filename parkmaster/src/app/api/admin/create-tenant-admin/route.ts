import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseUrl } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  tenantId?: string;
  tenant_id?: string;
  fullName?: string;
  full_name?: string;
  email?: string;
  password?: string;
}

export async function POST(req: Request) {
  try {
    const url = supabaseUrl;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !service) {
      return NextResponse.json(
        { error: 'Servidor sin configurar: falta SUPABASE_SERVICE_ROLE_KEY.' },
        { status: 500 }
      );
    }

    const admin = createClient(url, service, { auth: { persistSession: false } });

    // Verificación de autorización: solo SuperAdmin puede crear o asignar administradores de tenant
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
    }

    const { data: u } = await admin.auth.getUser(token);
    if (!u.user) {
      return NextResponse.json({ error: 'Sesión no válida o expirada.' }, { status: 401 });
    }

    const { data: caller } = await admin
      .from('profiles')
      .select('*')
      .eq('id', u.user.id)
      .maybeSingle();

    if (!caller || !caller.active || caller.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Acceso denegado: solo el Super-Admin puede crear o vincular administradores de parqueaderos.' },
        { status: 403 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as Body;
    const tenantId = (body.tenantId || body.tenant_id || '').trim();
    const fullName = (body.fullName || body.full_name || '').trim();
    const email = (body.email || '').trim().toLowerCase();
    const password = (body.password || '').trim();

    if (!tenantId) {
      return NextResponse.json({ error: 'Falta el identificador del parqueadero (tenantId).' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'El correo electrónico no es válido.' }, { status: 400 });
    }
    if (fullName.length < 3) {
      return NextResponse.json({ error: 'El nombre completo debe tener al menos 3 caracteres.' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'La contraseña inicial debe tener al menos 6 caracteres.' }, { status: 400 });
    }

    // Verificar que el tenant exista
    const { data: tenant, error: tErr } = await admin
      .from('tenants')
      .select('id, business_name')
      .eq('id', tenantId)
      .maybeSingle();

    if (tErr || !tenant) {
      return NextResponse.json({ error: 'El parqueadero especificado no existe.' }, { status: 404 });
    }

    // Intentar crear el usuario en Supabase Auth
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (created?.user) {
      // Usuario nuevo creado en auth.users -> insertar/upsert en profiles
      const { data: newProfile, error: profileErr } = await admin
        .from('profiles')
        .upsert({
          id: created.user.id,
          tenant_id: tenantId,
          full_name: fullName,
          email,
          role: 'tenant_admin',
          active: true,
        })
        .select()
        .single();

      if (profileErr) {
        // Rollback del usuario creado en Auth si falla el perfil
        await admin.auth.admin.deleteUser(created.user.id);
        return NextResponse.json(
          { error: `No se pudo registrar el perfil: ${profileErr.message}` },
          { status: 400 }
        );
      }

      return NextResponse.json({
        ok: true,
        message: 'Administrador principal creado y vinculado exitosamente.',
        user: newProfile || {
          id: created.user.id,
          tenant_id: tenantId,
          full_name: fullName,
          email,
          role: 'tenant_admin',
          active: true,
        },
      });
    }

    // Si falló createUser, verificar si ya existía el correo registrado
    let existingUserId: string | null = null;

    // 1. Buscar en tabla profiles
    const { data: pByEmail } = await admin
      .from('profiles')
      .select('id, email, full_name')
      .eq('email', email)
      .maybeSingle();

    if (pByEmail?.id) {
      existingUserId = pByEmail.id;
    } else {
      // 2. Buscar en auth.users
      const { data: listData } = await admin.auth.admin.listUsers();
      const foundAuth = listData?.users?.find(u => u.email?.toLowerCase() === email);
      if (foundAuth?.id) {
        existingUserId = foundAuth.id;
      }
    }

    if (existingUserId) {
      // Actualizar la contraseña si fue enviada
      if (password.length >= 6) {
        await admin.auth.admin.updateUserById(existingUserId, { password });
      }

      // Vincular el usuario actualizando su tenant_id y role = 'tenant_admin'
      const { data: updatedProfile, error: linkErr } = await admin
        .from('profiles')
        .upsert({
          id: existingUserId,
          tenant_id: tenantId,
          full_name: fullName || pByEmail?.full_name || email,
          email,
          role: 'tenant_admin',
          active: true,
        })
        .select()
        .single();

      if (linkErr) {
        return NextResponse.json(
          { error: `Error al vincular el usuario existente: ${linkErr.message}` },
          { status: 400 }
        );
      }

      return NextResponse.json({
        ok: true,
        message: 'Usuario existente vinculado con éxito como Administrador Principal.',
        user: updatedProfile || {
          id: existingUserId,
          tenant_id: tenantId,
          full_name: fullName || pByEmail?.full_name || email,
          email,
          role: 'tenant_admin',
          active: true,
        },
      });
    }

    // Si falló por otra razón y no existe el usuario
    return NextResponse.json(
      { error: createError?.message || 'No se pudo crear el administrador.' },
      { status: 400 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error inesperado al crear administrador';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
