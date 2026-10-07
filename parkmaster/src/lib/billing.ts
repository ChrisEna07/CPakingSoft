import type {
  ParkingRecord, TenantConfig, VehicleType, CashShift, CommercialAgreement, MonthlySubscription, SubscriptionStatus,
} from './types';

export interface Liquidation {
  minutes: number;
  total_minutes: number;
  rate: number;
  free: boolean;
  billed_hours: number;
  units: number;
  unit_label: string;
  amount: number;
}

/** Cobro por minutos facturables SIN aplicar gracia (hora/fracción o bloques de 30 min). */
function chargeFor(minutes: number, rate: number, cfg: TenantConfig) {
  if (minutes <= 0) return { units: 0, billed_hours: 0, amount: 0, unit_label: '' };
  if (cfg.billing_mode === 'media') {
    const blocks = Math.ceil(minutes / 30);
    return { units: blocks, billed_hours: Math.ceil(blocks / 2), unit_label: 'bloques de 30 min', amount: Math.round((blocks * rate) / 2 / 50) * 50 };
  }
  const hours = Math.ceil(minutes / 60);
  return { units: hours, billed_hours: hours, unit_label: hours === 1 ? 'hora' : 'horas', amount: hours * rate };
}

/** Liquidación exacta: gracia gratuita; luego hora o fracción iniciada (o bloques de 30 min). */
export function liquidate(entryISO: string, type: VehicleType, cfg: TenantConfig, nowMs: number): Liquidation {
  const minutes = Math.max(0, (nowMs - new Date(entryISO).getTime()) / 60000);
  const rate = type === 'moto' ? cfg.rate_moto : cfg.rate_carro;
  const base = { minutes, total_minutes: Math.floor(minutes), rate };
  if (minutes <= cfg.grace_minutes) return { ...base, free: true, billed_hours: 0, units: 0, unit_label: '', amount: 0 };
  return { ...base, free: false, ...chargeFor(minutes, rate, cfg) };
}

// ---------------------------------------------------------------------------
// Mensualistas
// ---------------------------------------------------------------------------
const todayKey = (ms = Date.now()) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Estado real considerando la fecha de vencimiento (un 'vigente' con fecha pasada es 'vencido'). */
export function effectiveSubStatus(s: MonthlySubscription, nowMs = Date.now()): SubscriptionStatus {
  if (s.status === 'suspendido') return 'suspendido';
  if (s.end_date < todayKey(nowMs)) return 'vencido';
  return s.status === 'vencido' ? 'vencido' : 'vigente';
}

export function daysUntil(dateKey: string, nowMs = Date.now()): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  const target = new Date(y, m - 1, d).getTime();
  const t = new Date(nowMs); const today = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
  return Math.round((target - today) / 86400000);
}

/** Suma meses a una fecha YYYY-MM-DD (ajusta fin de mes) y resta un día para obtener el último día cubierto. */
export function addMonthsKey(dateKey: string, months: number, minusOneDay = true): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const target = new Date(y, m - 1 + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d, lastDay));
  if (minusOneDay) target.setDate(target.getDate() - 1);
  return todayKey(target.getTime());
}

export function findSubscription(subs: MonthlySubscription[], plate: string): MonthlySubscription | null {
  return subs.find(s => s.plate === plate) ?? null;
}

// ---------------------------------------------------------------------------
// Convenios comerciales
// ---------------------------------------------------------------------------
export function agreementApplies(a: CommercialAgreement, type: VehicleType): boolean {
  return a.active && (a.vehicle_type_applicable === 'todos' || a.vehicle_type_applicable === type);
}

export function agreementLabel(a: CommercialAgreement): string {
  if (a.agreement_type === 'porcentaje') return `${a.name} ${a.discount_value}%`;
  if (a.agreement_type === 'tiempo_gratis') return `${a.name} · ${a.discount_value} min gratis`;
  return `${a.name} · tarifa fija $${Math.round(a.discount_value).toLocaleString('es-CO')}`;
}

export interface ExitQuote extends Liquidation {
  gross: number;      // tarifa plena
  discount: number;   // ahorro por convenio / mensualidad
  net: number;        // total a pagar
  agreement: CommercialAgreement | null;
  subscription: MonthlySubscription | null;
}

/**
 * Cotización única de salida (usada por la pantalla POS y por el store al registrar la salida).
 *  - Mensualista vigente → $0.
 *  - porcentaje    → descuento sobre la tarifa plena (redondeado a $50).
 *  - tiempo_gratis → los primeros N minutos no se cobran; el excedente se cobra con tarifa regular.
 *  - tarifa_fija   → tarifa única; nunca supera la tarifa plena (si está en gracia, sigue en $0).
 */
export function quoteExit(
  rec: ParkingRecord, cfg: TenantConfig, nowMs: number,
  agreement: CommercialAgreement | null, subscription: MonthlySubscription | null,
): ExitQuote {
  const L = liquidate(rec.entry_time, rec.vehicle_type, cfg, nowMs);
  const gross = L.amount;
  const base = { ...L, gross, agreement: null, subscription: null };

  if (subscription && effectiveSubStatus(subscription, nowMs) === 'vigente') {
    return { ...base, subscription, discount: gross, net: 0 };
  }
  if (!agreement || !agreementApplies(agreement, rec.vehicle_type) || gross === 0) {
    return { ...base, discount: 0, net: gross };
  }

  let net = gross;
  if (agreement.agreement_type === 'porcentaje') {
    const pct = Math.min(100, Math.max(0, agreement.discount_value));
    net = gross - Math.round((gross * pct) / 100 / 50) * 50;
  } else if (agreement.agreement_type === 'tiempo_gratis') {
    net = chargeFor(L.minutes - Math.max(0, agreement.discount_value), L.rate, cfg).amount;
  } else {
    net = Math.min(gross, Math.max(0, agreement.discount_value));
  }
  net = Math.max(0, Math.min(gross, net));
  return { ...base, agreement, discount: gross - net, net };
}

// ---------------------------------------------------------------------------
// Arqueo de caja: SOLO lo que cobró este cajero durante su turno
// ---------------------------------------------------------------------------
export function shiftTotals(shift: CashShift, records: ParkingRecord[]) {
  const t = { cash: 0, transfer: 0, total: 0, moto: 0, carro: 0, count: 0, discounts: 0 };
  const from = new Date(shift.opened_at).getTime();
  const to = shift.closed_at ? new Date(shift.closed_at).getTime() : Infinity;
  records.forEach(r => {
    if (r.status !== 'cobrado' || r.closed_by !== shift.cashier_id || !r.exit_time) return;
    const x = new Date(r.exit_time).getTime();
    if (x < from || x > to) return;
    const a = r.total_amount ?? 0;
    t.count++; t.total += a; t[r.vehicle_type] += a; t.discounts += r.discount_applied_cop ?? 0;
    if (r.payment_method === 'transferencia') t.transfer += a; else if (r.payment_method === 'efectivo') t.cash += a;
  });
  return t;
}
