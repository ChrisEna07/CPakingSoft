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

export type SyncTable = 'parking_records' | 'cash_shifts' | 'support_tickets';
export interface QueueItem {
  id: string;
  table: SyncTable;
  row: ParkingRecord | CashShift | SupportTicket;
}

export interface TenantData {
  records: ParkingRecord[];
  shifts: CashShift[];
  tickets: SupportTicket[];
  queue: QueueItem[];
  counters: { moto: number; carro: number };
}

export const EMPTY_DATA: TenantData = { records: [], shifts: [], tickets: [], queue: [], counters: { moto: 0, carro: 0 } };

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
};
