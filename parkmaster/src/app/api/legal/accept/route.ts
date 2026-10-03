import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseUrl } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      profile_id,
      tenant_id,
      version = 'v1.0.0',
      terms_accepted = true,
      privacy_accepted = true,
      custody_waiver_accepted = true,
    } = body;

    if (!profile_id) {
      return NextResponse.json({ error: 'profile_id es obligatorio' }, { status: 400 });
    }

    if (!terms_accepted || !privacy_accepted || !custody_waiver_accepted) {
      return NextResponse.json({ error: 'Todas las cláusulas legales son obligatorias' }, { status: 400 });
    }

    const forwarded = req.headers.get('x-forwarded-for');
    const ip_address = forwarded
      ? forwarded.split(',')[0].trim()
      : (req.headers.get('x-real-ip') ?? '127.0.0.1');
    const user_agent = req.headers.get('user-agent') ?? 'Desconocido';
    const accepted_at = new Date().toISOString();

    const record = {
      id: crypto.randomUUID(),
      profile_id,
      tenant_id: tenant_id || null,
      version,
      ip_address,
      user_agent,
      terms_accepted: Boolean(terms_accepted),
      privacy_accepted: Boolean(privacy_accepted),
      custody_waiver_accepted: Boolean(custody_waiver_accepted),
      accepted_at,
    };

    const url = supabaseUrl;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (url && service) {
      const admin = createClient(url, service, { auth: { persistSession: false } });
      const { data, error } = await admin.from('legal_acceptances').insert(record).select().single();
      if (error) {
        console.warn('Advertencia al insertar en legal_acceptances de Supabase:', error.message);
        // Si la tabla no existe en supabase cache todavía, retornamos el registro válido para almacenamiento local
        return NextResponse.json({ ok: true, data: record, warning: error.message });
      }
      return NextResponse.json({ ok: true, data });
    }

    return NextResponse.json({ ok: true, data: record });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error interno al registrar aceptación legal';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
