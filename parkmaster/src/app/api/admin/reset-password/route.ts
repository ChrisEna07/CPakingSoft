import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseUrl } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  user_id?: string;
  password?: string;
  new_password?: string;
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

    // Verificación de autorización de SuperAdmin
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (token) {
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
          { error: 'Acceso denegado: solo el Super-Admin puede cambiar contraseñas de tenants.' },
          { status: 403 }
        );
      }
    }

    const body = (await req.json().catch(() => ({}))) as Body;
    const userId = body.user_id?.trim();
    const newPassword = (body.password || body.new_password || '').trim();

    if (!userId) {
      return NextResponse.json({ error: 'Falta el ID del usuario (user_id).' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'La nueva contraseña debe tener al menos 6 caracteres.' },
        { status: 400 }
      );
    }

    // Actualiza la contraseña en Supabase Auth usando el cliente Admin con service_role
    const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      message: 'Contraseña actualizada con éxito.',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error inesperado al resetear contraseña';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
