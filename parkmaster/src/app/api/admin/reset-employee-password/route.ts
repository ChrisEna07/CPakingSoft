import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseUrl } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  userId?: string;
  user_id?: string;
  newPassword?: string;
  password?: string;
}

/**
 * Reseteo rápido de contraseña de empleados/cajeros:
 * - tenant_admin: solo puede resetear cajeros pertenecientes a su propio tenant.
 * - superadmin: puede resetear cualquier cuenta de empleado.
 */
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

    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'No autenticado: falta token de autorización.' }, { status: 401 });
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

    if (!caller || !caller.active || (caller.role !== 'tenant_admin' && caller.role !== 'superadmin')) {
      return NextResponse.json(
        { error: 'Acceso denegado: se requieren permisos de administrador para cambiar contraseñas.' },
        { status: 403 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as Body;
    const targetUserId = (body.userId || body.user_id || '').trim();
    const newPassword = (body.newPassword || body.password || '').trim();

    if (!targetUserId) {
      return NextResponse.json({ error: 'Falta el identificador del empleado (userId).' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'La nueva contraseña debe tener al menos 6 caracteres.' },
        { status: 400 }
      );
    }

    // Obtener datos del perfil objetivo
    const { data: targetProfile } = await admin
      .from('profiles')
      .select('id, full_name, email, role, tenant_id')
      .eq('id', targetUserId)
      .maybeSingle();

    if (!targetProfile) {
      return NextResponse.json({ error: 'El empleado especificado no existe.' }, { status: 404 });
    }

    // El tenant_admin solo puede modificar cajeros de su propio tenant
    if (caller.role === 'tenant_admin') {
      if (targetProfile.tenant_id !== caller.tenant_id) {
        return NextResponse.json(
          { error: 'No tiene permisos para modificar empleados de otro parqueadero.' },
          { status: 403 }
        );
      }
      if (targetProfile.role !== 'cajero') {
        return NextResponse.json(
          { error: 'Solo se permite restablecer contraseñas de cajeros.' },
          { status: 403 }
        );
      }
    }

    // Actualizar contraseña en auth.users con supabaseAdmin
    const { error: authError } = await admin.auth.admin.updateUserById(targetUserId, {
      password: newPassword,
    });

    if (authError) {
      return NextResponse.json(
        { error: `Error de Supabase Auth: ${authError.message}` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      ok: true,
      message: `Contraseña de ${targetProfile.full_name} actualizada exitosamente en el sistema.`,
      employee: {
        id: targetProfile.id,
        name: targetProfile.full_name,
        email: targetProfile.email,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno del servidor';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
