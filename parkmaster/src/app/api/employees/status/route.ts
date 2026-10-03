import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseUrl } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface StatusBody {
  id?: string;
  active?: boolean;
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

    // Verificación de autenticación
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

    if (!caller || !caller.active || (caller.role !== 'tenant_admin' && caller.role !== 'superadmin')) {
      return NextResponse.json(
        { error: 'Acceso denegado: solo administradores pueden cambiar el estado de un empleado.' },
        { status: 403 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as StatusBody;
    const id = body.id?.trim();
    const active = Boolean(body.active);

    if (!id) {
      return NextResponse.json({ error: 'Falta el identificador del empleado (id).' }, { status: 400 });
    }

    // Obtener datos del empleado objetivo
    const { data: targetUser } = await admin
      .from('profiles')
      .select('id, full_name, role, tenant_id')
      .eq('id', id)
      .maybeSingle();

    if (!targetUser) {
      return NextResponse.json({ error: 'El empleado especificado no existe.' }, { status: 404 });
    }

    // Si el llamante es tenant_admin, solo puede modificar usuarios de su propio tenant
    if (caller.role === 'tenant_admin' && targetUser.tenant_id !== caller.tenant_id) {
      return NextResponse.json(
        { error: 'No tiene permisos para modificar empleados de otro parqueadero.' },
        { status: 403 }
      );
    }

    // BLOQUEO DE SEGURIDAD: Si se va a desactivar (active = false), verificar si tiene turno abierto
    if (!active) {
      const { data: openShift } = await admin
        .from('cash_shifts')
        .select('id, opened_at, initial_base_cash')
        .eq('cashier_id', id)
        .eq('status', 'abierto')
        .maybeSingle();

      if (openShift) {
        return NextResponse.json(
          {
            error: `⚠️ Operación Denegada: ${targetUser.full_name} tiene un turno de caja abierto en la estación Taquilla 1 (T1). Debe realizar el arqueo y cierre de caja antes de poder ser desactivado.`,
            openShift: true,
            shiftId: openShift.id,
          },
          { status: 400 }
        );
      }
    }

    // Proceder con la actualización del estado
    const { error: upErr } = await admin
      .from('profiles')
      .update({ active })
      .eq('id', id);

    if (upErr) {
      return NextResponse.json({ error: `Error al actualizar estado: ${upErr.message}` }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      active,
      message: active
        ? `Cajero ${targetUser.full_name} activado con éxito.`
        : `Cajero ${targetUser.full_name} desactivado con éxito.`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error inesperado al cambiar estado del empleado';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
