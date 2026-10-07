export type Role = 'superadmin' | 'tenant_admin' | 'cajero';
export type VehicleType = 'moto' | 'carro';
export type PlanType = 'mensual_saas' | 'licencia_definitiva' | 'piloto_7dias';
export type TenantStatus = 'activo' | 'suspendido' | 'piloto' | 'mora';
export type RecordStatus = 'dentro' | 'cobrado' | 'anulado';
export type PaymentMethod = 'efectivo' | 'transferencia' | 'cortesia';

export interface TenantConfig {
  rate_moto: number;
  rate_carro: number;
  grace_minutes: number;
  billing_mode: 'hora' | 'media';
  legal_text: string;
  ticket_prefix: string;
  cap_moto: number;
  cap_carro: number;
  paper_width: 58 | 80;
  barrier_enabled: boolean;
  barrier_open_seconds: number;
  lost_ticket_fee: number;        // tarifa penalizadora si no existe registro de entrada
  lost_ticket_surcharge: number;  // recargo adicional cuando sí existe entrada pero se perdió el tiquete
}

export interface Tenant {
  id: string;
  business_name: string;
  nit_rut: string | null;
  slug: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  plan_type: PlanType;
  monthly_fee_cop: number;
  billing_due_day: number;
  last_payment_date: string | null;
  next_payment_date: string | null;
  status: TenantStatus;
  is_online: boolean;
  last_seen_at: string | null;
  support_ticket_active: boolean;
  config_json: TenantConfig;
  created_at: string;
}

export interface Profile {
  id: string;
  tenant_id: string | null;
  full_name: string;
  email: string;
  role: Role;
  active: boolean;
}

export interface ParkingRecord {
  id: string;
  tenant_id: string;
  ticket_code: string;
  plate: string;
  vehicle_type: VehicleType;
  entry_time: string;
  exit_time: string | null;
  status: RecordStatus;
  total_minutes: number | null;
  billed_hours: number | null;
  total_amount: number | null;
  payment_method: PaymentMethod | null;
  created_by: string | null;
  closed_by: string | null;
  sync_status: 'synced' | 'pending';
  // --- Convenios comerciales ---
  agreement_id?: string | null;
  agreement_name?: string | null;
  gross_amount?: number | null;          // tarifa plena antes de descuentos
  discount_applied_cop?: number | null;  // ahorro otorgado por el convenio
  validation_code?: string | null;       // código de factura / sello del local
  // --- Mensualistas ---
  subscription_id?: string | null;
  // --- Tiquete perdido ---
  lost_ticket?: boolean | null;
  lost_ticket_holder_name?: string | null;
  lost_ticket_holder_doc?: string | null;
}

export interface OpenTicketAudit {
  ticket_code: string;
  plate: string;
  vehicle_type: VehicleType;
  entry_time: string;
}

export interface CashShift {
  id: string;
  tenant_id: string;
  cashier_id: string;
  opened_at: string;
  closed_at: string | null;
  initial_base_cash: number;
  system_calculated_cash: number | null;
  reported_cash: number | null;
  difference: number | null;
  status: 'abierto' | 'cerrado';
  // Inventario nocturno / traspaso de patio
  vehicles_in_patio_at_close?: number | null;
  open_tickets_audit?: OpenTicketAudit[] | null;
}

export type AgreementType = 'porcentaje' | 'tiempo_gratis' | 'tarifa_fija';

export interface CommercialAgreement {
  id: string;
  tenant_id: string;
  name: string;
  agreement_type: AgreementType;
  discount_value: number;             // % | minutos gratis | tarifa fija COP
  vehicle_type_applicable: 'todos' | VehicleType;
  requires_validation_code: boolean;
  active: boolean;
  created_at: string;
}

export type SubscriptionStatus = 'vigente' | 'vencido' | 'suspendido';

export interface MonthlySubscription {
  id: string;
  tenant_id: string;
  customer_name: string;
  document_id: string;
  phone: string | null;
  plate: string;
  vehicle_type: VehicleType;
  monthly_rate_cop: number;
  start_date: string;   // YYYY-MM-DD
  end_date: string;     // YYYY-MM-DD
  status: SubscriptionStatus;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  tenant_id: string;
  reported_by: string | null;
  issue_description: string;
  screenshot_url: string | null;
  created_at: string;
  resolved: boolean;
}

export type SyncTable = 'parking_records' | 'cash_shifts' | 'support_tickets' | 'commercial_agreements' | 'monthly_subscriptions';
export interface QueueItem {
  id: string;
  table: SyncTable;
  row: ParkingRecord | CashShift | SupportTicket | CommercialAgreement | MonthlySubscription;
}

export interface TenantData {
  records: ParkingRecord[];
  shifts: CashShift[];
  tickets: SupportTicket[];
  agreements: CommercialAgreement[];
  subscriptions: MonthlySubscription[];
  queue: QueueItem[];
  counters: { moto: number; carro: number };
}

export const EMPTY_DATA: TenantData = { records: [], shifts: [], tickets: [], agreements: [], subscriptions: [], queue: [], counters: { moto: 0, carro: 0 } };

export const DEFAULT_CONFIG: TenantConfig = {
  rate_moto: 1500,
  rate_carro: 3500,
  grace_minutes: 15,
  billing_mode: 'hora',
  legal_text: 'Conserve este tiquete: es indispensable para retirar su vehículo. Pérdida del tiquete: presente documento y tarjeta de propiedad. La administración no responde por objetos dejados en el vehículo.',
  ticket_prefix: 'PF',
  cap_moto: 150,
  cap_carro: 400,
  paper_width: 80,
  barrier_enabled: false,
  barrier_open_seconds: 5,
  lost_ticket_fee: 15000,
  lost_ticket_surcharge: 0,
};

export interface LegalAcceptance {
  id: string;
  profile_id: string;
  tenant_id: string | null;
  role?: string;
  profile_role?: Role;
  version?: string;
  agreement_version: string;
  ip_address: string | null;
  user_agent: string | null;
  terms_accepted: boolean;
  privacy_accepted: boolean;
  custody_waiver_accepted: boolean;
  accepted_at: string;
  // Auxiliares para auditoría visual
  profile_name?: string;
  profile_email?: string;
  tenant_name?: string;
  profile?: { full_name: string; email: string };
  tenant?: { business_name: string };
}
