'use client';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { CashShift, ParkingRecord, Tenant } from '@/lib/types';
import { durText, fmtDate, fmtDT, fmtTime, money } from '@/lib/format';
import { displayPlate } from '@/lib/validators';
import { Logo } from './Logo';

export type PrintDocT =
  | { kind: 'ticket'; record: ParkingRecord }
  | { kind: 'receipt'; record: ParkingRecord }
  | { kind: 'arqueo'; shift: CashShift; cashier: string; cash: number; transfer: number; moto: number; carro: number };

function QR({ text, size }: { text: string; size: number }) {
  const [svg, setSvg] = useState('');
  useEffect(() => { QRCode.toString(text, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' }).then(setSvg).catch(() => setSvg('')); }, [text]);
  return <div className="qr" style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function qrData(r: ParkingRecord) { return `PF|${r.ticket_code}|${r.plate}|${r.entry_time}`; }

export function ThermalDoc({ doc, tenant }: { doc: PrintDocT; tenant: Tenant }) {
  const cfg = tenant.config_json;
  const width = cfg.paper_width === 58 ? '52mm' : '72mm';
  const Wrap = ({ children }: { children: React.ReactNode }) => <div className="thermal" style={{ width }}>{children}</div>;
  const Head = () => (
    <>
      <div style={{ textAlign: 'center', marginBottom: 4 }}>
        <Logo variant="ticket" size={36} className="mx-auto block" />
        <div style={{ fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5, marginTop: 2 }}>CParkingSoft</div>
      </div>
      <div className="c b" style={{ fontSize: 12 }}>{tenant.business_name.toUpperCase()}</div>
      {tenant.nit_rut && <div className="c small">NIT {tenant.nit_rut}</div>}
      <hr />
    </>
  );

  if (doc.kind === 'ticket') {
    const r = doc.record;
    return (
      <Wrap>
        <Head />
        <div className="c b">TIQUETE DE PARQUEO</div>
        <div className="code">#{r.ticket_code}</div>
        <div className="plate">{displayPlate(r.plate)}</div>
        <div className="row"><span>Vehículo</span><b>{r.vehicle_type.toUpperCase()}</b></div>
        <div className="row"><span>Fecha</span><b>{fmtDate(r.entry_time)}</b></div>
        <div className="row"><span>Hora</span><b>{fmtTime(r.entry_time)}</b></div>
        <div className="row"><span>Tarifa</span><b>{money(r.vehicle_type === 'moto' ? cfg.rate_moto : cfg.rate_carro)}/h</b></div>
        <div className="row"><span>Gracia</span><b>{cfg.grace_minutes} min</b></div>
        <div style={{ display: 'flex', justifyContent: 'center', margin: '6px 0' }}><QR text={qrData(r)} size={cfg.paper_width === 58 ? 110 : 140} /></div>
        <div className="c small">{qrData(r)}</div>
        <hr />
        <div className="small">{cfg.legal_text}</div>
      </Wrap>
    );
  }
  if (doc.kind === 'receipt') {
    const r = doc.record;
    return (
      <Wrap>
        <Head />
        <div className="c b">RECIBO DE PAGO</div>
        <div className="code">#{r.ticket_code}</div>
        <div className="plate">{displayPlate(r.plate)}</div>
        <div className="row"><span>Entrada</span><b>{fmtDT(r.entry_time)}</b></div>
        <div className="row"><span>Salida</span><b>{r.exit_time ? fmtDT(r.exit_time) : '-'}</b></div>
        <div className="row"><span>Tiempo</span><b>{durText(r.total_minutes ?? 0)}</b></div>
        <div className="row"><span>Horas cobradas</span><b>{r.billed_hours ?? 0}</b></div>
        <hr />
        <div className="row b" style={{ fontSize: 15 }}><span>TOTAL</span><span>{money(r.total_amount)} COP</span></div>
        <div className="row"><span>Pago</span><b>{r.payment_method}</b></div>
        <hr /><div className="c small">Gracias por su visita</div>
      </Wrap>
    );
  }
  const s = doc.shift;
  const diff = s.difference ?? 0;
  return (
    <Wrap>
      <Head />
      <div className="c b">COMPROBANTE DE ARQUEO</div>
      <div className="row"><span>Cajero</span><b>{doc.cashier}</b></div>
      <div className="row"><span>Apertura</span><b>{fmtDT(s.opened_at)}</b></div>
      <div className="row"><span>Cierre</span><b>{s.closed_at ? fmtDT(s.closed_at) : '-'}</b></div>
      <hr />
      <div className="row"><span>Base inicial</span><b>{money(s.initial_base_cash)}</b></div>
      <div className="row"><span>Cobros efectivo</span><b>{money(doc.cash)}</b></div>
      <div className="row"><span>Cobros transfer.</span><b>{money(doc.transfer)}</b></div>
      <div className="row"><span>Motos / Carros</span><b>{money(doc.moto)} / {money(doc.carro)}</b></div>
      <hr />
      <div className="row"><span>Efectivo esperado</span><b>{money(s.system_calculated_cash)}</b></div>
      <div className="row"><span>Efectivo reportado</span><b>{money(s.reported_cash)}</b></div>
      <div className="row b"><span>Diferencia</span><span>{diff > 0 ? '+' : ''}{money(diff)}</span></div>
      <div className="c b" style={{ margin: '6px 0', border: '2px solid #000', padding: 3 }}>{diff === 0 ? 'CAJA CUADRADA EXACTA' : diff < 0 ? 'FALTANTE DE DINERO' : 'SOBRANTE DE DINERO'}</div>
      <div style={{ marginTop: 22 }} className="small">Firma cajero: ____________________</div>
      <div style={{ marginTop: 22 }} className="small">Firma supervisor: __________________</div>
    </Wrap>
  );
}

export function PrintArea({ doc, tenant }: { doc: PrintDocT | null; tenant: Tenant | null }) {
  if (!doc || !tenant) return null;
  return (
    <div id="print-area">
      <style>{`@page { size: ${tenant.config_json.paper_width}mm auto; margin: 0; }`}</style>
      <ThermalDoc doc={doc} tenant={tenant} />
    </div>
  );
}
