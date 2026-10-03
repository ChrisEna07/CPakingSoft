import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseUrl } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ResetBody {
  tenantId?: string;
  tenant_id?: string;
  confirmation?: string;
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

    // Verificación de autenticación de SuperAdmin
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
        { error: 'Acceso denegado: solo el Super-Admin puede ejecutar el restablecimiento a modo fábrica.' },
        { status: 403 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as ResetBody;
    const tenantId = (body.tenantId || body.tenant_id || '').trim();
    const confirmation = (body.confirmation || '').trim();

    if (confirmation !== 'RESETEAR') {
      return NextResponse.json(
        { error: 'Palabra clave de confirmación incorrecta. Debe escribir exactamente "RESETEAR" en mayúsculas.' },
        { status: 400 }
      );
    }

    // Purgar únicamente transacciones operativas: parking_records, cash_shifts, support_tickets
    if (tenantId && tenantId !== 'global') {
      const [r1, r2, r3] = await Promise.all([
        admin.from('parking_records').delete().eq('tenant_id', tenantId),
        admin.from('cash_shifts').delete().eq('tenant_id', tenantId),
        admin.from('support_tickets').delete().eq('tenant_id', tenantId),
      ]);

      if (r1.error || r2.error || r3.error) {
        const errMsg = r1.error?.message || r2.error?.message || r3.error?.message;
        return NextResponse.json({ error: `Error al purgar datos del tenant: ${errMsg}` }, { status: 400 });
      }

      return NextResponse.json({
        ok: true,
        message: 'Datos de prueba purgados exitosamente para el parqueadero seleccionado. Tarifas y administradores conservados intactos.',
      });
    } else {
      // Purgado global de pruebas (conservando tenants, profiles, auth)
      const [r1, r2, r3] = await Promise.all([
        admin.from('parking_records').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
        admin.from('cash_shifts').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
        admin.from('support_tickets').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      ]);

      if (r1.error || r2.error || r3.error) {
        const errMsg = r1.error?.message || r2.error?.message || r3.error?.message;
        return NextResponse.json({ error: `Error al purgar datos globales: ${errMsg}` }, { status: 400 });
      }

      return NextResponse.json({
        ok: true,
        message: 'Restablecimiento a modo fábrica global completado. Estructura, cuentas y tarifas conservadas.',
      });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error inesperado al purgar datos';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
