import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseUrl } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ForceResetBody {
  userId?: string;
  user_id?: string;
  newPassword?: string;
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

    // Verificación de sesión y autorización: Solo SuperAdmin
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

    if (!caller || !caller.active || caller.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Acceso denegado: solo el Super-Admin puede forzar el cambio de contraseña de un tenant.' },
        { status: 403 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as ForceResetBody;
    const userId = (body.userId || body.user_id || '').trim();
    const newPassword = (body.newPassword || body.password || '').trim();

    if (!userId) {
      return NextResponse.json({ error: 'Falta el identificador del usuario (userId).' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'La nueva contraseña debe tener al menos 6 caracteres.' },
        { status: 400 }
      );
    }

    // Actualizar directamente la contraseña usando el API Admin de Supabase Auth
    const { data: updated, error: updateError } = await admin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (updateError || !updated.user) {
      return NextResponse.json(
        { error: updateError?.message || 'Error al actualizar contraseña en el proveedor de autenticación.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      ok: true,
      message: 'Contraseña actualizada correctamente en el sistema.',
      userId: updated.user.id,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error inesperado en reseteo forzado de contraseña';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
