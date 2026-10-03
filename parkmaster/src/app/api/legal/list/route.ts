import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseUrl } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = supabaseUrl;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !service) {
      return NextResponse.json({ ok: true, data: [] });
    }

    const admin = createClient(url, service, { auth: { persistSession: false } });

    // Consultamos aceptaciones
    const { data: acceptances, error } = await admin
      .from('legal_acceptances')
      .select('*')
      .order('accepted_at', { ascending: false });

    if (error) {
      console.warn('Error consultando legal_acceptances:', error.message);
      return NextResponse.json({ ok: true, data: [], warning: error.message });
    }

    // Enriquecemos con información de profiles y tenants
    const [profilesRes, tenantsRes] = await Promise.all([
      admin.from('profiles').select('id, full_name, email, role'),
      admin.from('tenants').select('id, business_name'),
    ]);

    const profileMap = new Map((profilesRes.data ?? []).map(p => [p.id, p]));
    const tenantMap = new Map((tenantsRes.data ?? []).map(t => [t.id, t.business_name]));

    const enriched = (acceptances ?? []).map(a => {
      const p = profileMap.get(a.profile_id);
      return {
        ...a,
        profile_name: p?.full_name ?? 'Usuario',
        profile_email: p?.email ?? '',
        profile_role: p?.role ?? 'N/A',
        tenant_name: a.tenant_id ? (tenantMap.get(a.tenant_id) ?? 'Parqueadero') : 'Sistema Central (SuperAdmin)',
      };
    });

    return NextResponse.json({ ok: true, data: enriched });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al listar auditoría legal';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
