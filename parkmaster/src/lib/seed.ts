import type { Profile, Tenant } from './types';
import { DEFAULT_CONFIG } from './types';

export interface LocalUser extends Profile { password: string }

export const T_FABRICATO = '00000000-0000-4000-8000-000000000001';
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);

export function seedTenants(): Tenant[] {
  const base = (over: Partial<Tenant> & Pick<Tenant, 'id' | 'business_name' | 'slug'>): Tenant => ({
    nit_rut: '900000000', city: 'Medellín', address: null, phone: '3000000000', plan_type: 'mensual_saas', monthly_fee_cop: 220000,
    billing_due_day: 5, last_payment_date: null, next_payment_date: null, status: 'activo', is_online: false, last_seen_at: null,
    support_ticket_active: false, config_json: { ...DEFAULT_CONFIG }, created_at: new Date().toISOString(), ...over,
  });
  return [
    base({ id: T_FABRICATO, business_name: 'Centro Comercial Parque Fabricato', slug: 'parque-fabricato', nit_rut: '811000000', city: 'Bello', address: 'Bello, Antioquia', phone: '3183517802',
      plan_type: 'piloto_7dias', status: 'piloto', monthly_fee_cop: 220000, billing_due_day: 10, next_payment_date: iso(7) }),
    base({ id: '00000000-0000-4000-8000-000000000002', business_name: 'Parqueadero El Poblado (demo)', slug: 'el-poblado', plan_type: 'mensual_saas', status: 'activo', last_payment_date: iso(-20), next_payment_date: iso(10), billing_due_day: 20 }),
    base({ id: '00000000-0000-4000-8000-000000000003', business_name: 'Parqueadero Centro Itagüí (demo)', slug: 'centro-itagui', city: 'Itagüí', plan_type: 'mensual_saas', status: 'mora', last_payment_date: iso(-40), next_payment_date: iso(-10), billing_due_day: 1 }),
    base({ id: '00000000-0000-4000-8000-000000000004', business_name: 'Parqueadero Laureles (demo)', slug: 'laureles', plan_type: 'licencia_definitiva', status: 'activo', monthly_fee_cop: 0, last_payment_date: iso(-90), next_payment_date: null, billing_due_day: 1 }),
  ];
}

export function seedUsers(): LocalUser[] {
  return [
    { id: 'u-super', tenant_id: null, full_name: 'ChrizDev', email: 'superadmin@parkmaster.local', role: 'superadmin', active: true, password: 'superadmin123' },
    { id: 'u-admin', tenant_id: T_FABRICATO, full_name: 'Administrador Fabricato', email: 'admin@fabricato.local', role: 'tenant_admin', active: true, password: 'admin123' },
    { id: 'u-cajero', tenant_id: T_FABRICATO, full_name: 'Taquillero Uno', email: 'cajero@fabricato.local', role: 'cajero', active: true, password: 'cajero123' },
  ];
}
