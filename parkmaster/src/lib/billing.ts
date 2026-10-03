import type { ParkingRecord, TenantConfig, VehicleType, CashShift } from './types';

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

/** Liquidación exacta: gracia gratuita; luego hora o fracción iniciada (o bloques de 30 min). */
export function liquidate(entryISO: string, type: VehicleType, cfg: TenantConfig, nowMs: number): Liquidation {
  const minutes = Math.max(0, (nowMs - new Date(entryISO).getTime()) / 60000);
  const rate = type === 'moto' ? cfg.rate_moto : cfg.rate_carro;
  const base = { minutes, total_minutes: Math.floor(minutes), rate };
  if (minutes <= cfg.grace_minutes) return { ...base, free: true, billed_hours: 0, units: 0, unit_label: '', amount: 0 };
  if (cfg.billing_mode === 'media') {
    const blocks = Math.ceil(minutes / 30);
    return { ...base, free: false, billed_hours: Math.ceil(blocks / 2), units: blocks, unit_label: 'bloques de 30 min', amount: Math.round((blocks * rate) / 2 / 50) * 50 };
  }
  const hours = Math.ceil(minutes / 60);
  return { ...base, free: false, billed_hours: hours, units: hours, unit_label: hours === 1 ? 'hora' : 'horas', amount: hours * rate };
}

export function shiftTotals(shift: CashShift, records: ParkingRecord[]) {
  const t = { cash: 0, transfer: 0, total: 0, moto: 0, carro: 0, count: 0 };
  const from = new Date(shift.opened_at).getTime();
  const to = shift.closed_at ? new Date(shift.closed_at).getTime() : Infinity;
  records.forEach(r => {
    if (r.status !== 'cobrado' || r.closed_by !== shift.cashier_id || !r.exit_time) return;
    const x = new Date(r.exit_time).getTime();
    if (x < from || x > to) return;
    const a = r.total_amount ?? 0;
    t.count++; t.total += a; t[r.vehicle_type] += a;
    if (r.payment_method === 'transferencia') t.transfer += a; else if (r.payment_method === 'efectivo') t.cash += a;
  });
  return t;
}
