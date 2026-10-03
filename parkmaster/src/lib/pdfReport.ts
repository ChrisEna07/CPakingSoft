import { fmtDT_CO, money, durText } from './format';
import { displayPlate } from './validators';
import type { ParkingRecord, Tenant } from './types';

interface PdfReportOptions {
  tenant: Tenant;
  from: string;
  to: string;
  rows: ParkingRecord[];
  employeesMap: Record<string, string>;
}

export function printExecutiveReport({
  tenant,
  from,
  to,
  rows,
  employeesMap,
}: PdfReportOptions) {
  const totalAmount = rows.reduce((s, r) => s + (r.total_amount ?? 0), 0);
  const totalVehicles = rows.length;
  const totalCortesia = rows.filter(r => r.payment_method === 'cortesia' || (r.total_amount ?? 0) === 0).length;
  const avgMinutes = totalVehicles > 0
    ? Math.round(rows.reduce((s, r) => s + (r.total_minutes ?? 0), 0) / totalVehicles)
    : 0;

  const getEmpName = (id: string | null) => {
    if (!id) return 'Taquilla Principal';
    return employeesMap[id] || 'Taquilla / Cajero';
  };

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Reporte Ejecutivo de Auditoría · ${tenant.business_name}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 15mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    body {
      color: #1e293b;
      background: #ffffff;
      padding: 10px;
      font-size: 11px;
      line-height: 1.4;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #1E3A8A;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .logo {
      height: 52px;
      width: 52px;
      border-radius: 8px;
      object-fit: cover;
      border: 1px solid #cbd5e1;
    }
    .brand-title {
      font-size: 18px;
      font-weight: 800;
      color: #0f172a;
    }
    .brand-sub {
      font-size: 11px;
      color: #64748b;
      margin-top: 2px;
    }
    .header-right {
      text-align: right;
      font-size: 10px;
      color: #475569;
    }
    .header-right b {
      color: #0f172a;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 16px;
    }
    .card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px;
      background: #f8fafc;
    }
    .card-title {
      font-size: 9px;
      text-transform: uppercase;
      font-weight: 700;
      color: #64748b;
      letter-spacing: 0.5px;
    }
    .card-value {
      font-size: 16px;
      font-weight: 800;
      color: #1E3A8A;
      margin-top: 4px;
    }
    .card-sub {
      font-size: 9px;
      color: #94a3b8;
      margin-top: 2px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
      font-size: 9.5px;
    }
    thead th {
      background-color: #1E3A8A;
      color: #ffffff;
      text-align: left;
      padding: 6px 8px;
      font-weight: 700;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    tbody tr {
      border-bottom: 1px solid #e2e8f0;
    }
    tbody tr:nth-child(even) {
      background-color: #f8fafc;
    }
    tbody td {
      padding: 5px 8px;
      vertical-align: middle;
    }
    .plate-badge {
      font-family: monospace;
      font-weight: 800;
      background: #fef3c7;
      color: #92400e;
      padding: 1px 4px;
      border-radius: 4px;
      border: 1px solid #fde68a;
    }
    .footer {
      margin-top: 20px;
      border-top: 1px solid #e2e8f0;
      padding-top: 10px;
      text-align: center;
      font-size: 9px;
      color: #64748b;
    }
    .footer a {
      color: #d97706;
      text-decoration: none;
      font-weight: 600;
    }
    @media print {
      body {
        padding: 0;
      }
      .no-print {
        display: none !important;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <img src="/CparkingSoftLogo.jpg" alt="Logo" class="logo" />
      <div>
        <div class="brand-title">${tenant.business_name}</div>
        <div class="brand-sub">NIT: ${tenant.nit_rut || 'Sin registrar'} · Ciudad: ${tenant.city || 'No especificada'} · CParkingSoft SaaS</div>
      </div>
    </div>
    <div class="header-right">
      <div><b>Rango Consultado:</b> ${from} a ${to}</div>
      <div><b>Fecha de Emisión:</b> ${fmtDT_CO(new Date())}</div>
      <div><b>Estado de Auditoría:</b> Certificada / Inmutable</div>
    </div>
  </div>

  <div class="summary-grid">
    <div class="card">
      <div class="card-title">Total Recaudado</div>
      <div class="card-value">${money(totalAmount)}</div>
      <div class="card-sub">Facturación en el período</div>
    </div>
    <div class="card">
      <div class="card-title">Vehículos Atendidos</div>
      <div class="card-value">${totalVehicles}</div>
      <div class="card-sub">Transacciones completadas</div>
    </div>
    <div class="card">
      <div class="card-title">Cortesías / Gracia</div>
      <div class="card-value">${totalCortesia}</div>
      <div class="card-sub">Sin cobro / exonerados</div>
    </div>
    <div class="card">
      <div class="card-title">Promedio de Estadía</div>
      <div class="card-value">${durText(avgMinutes)}</div>
      <div class="card-sub">${avgMinutes} minutos promedio</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Tiquete</th>
        <th>Placa</th>
        <th>Tipo</th>
        <th>Entrada</th>
        <th>Salida</th>
        <th>Estadía</th>
        <th>Operador / Responsable</th>
        <th>Total COP</th>
        <th>Método</th>
      </tr>
    </thead>
    <tbody>
      ${rows.slice(0, 500).map(r => `
        <tr>
          <td><b>#${r.ticket_code}</b></td>
          <td><span class="plate-badge">${displayPlate(r.plate)}</span></td>
          <td style="text-transform: capitalize;">${r.vehicle_type}</td>
          <td>${fmtDT_CO(r.entry_time)}</td>
          <td>${fmtDT_CO(r.exit_time)}</td>
          <td>${r.total_minutes ?? 0} min</td>
          <td>
            <div><b>Entrada:</b> ${getEmpName(r.created_by)}</div>
            <div><b>Cobró:</b> ${getEmpName(r.closed_by)}</div>
          </td>
          <td style="font-weight: 700; color: #0f172a;">${money(r.total_amount)}</td>
          <td style="text-transform: capitalize;">${r.payment_method || 'efectivo'}</td>
        </tr>
      `).join('')}
      ${rows.length === 0 ? '<tr><td colspan="9" style="text-align: center; padding: 20px; color: #94a3b8;">No se registraron movimientos en el rango de fechas seleccionado.</td></tr>' : ''}
    </tbody>
  </table>

  <div class="footer">
    Generado por CParkingSoft · Auditoría Inmutable para ${tenant.business_name} · Desarrollado por Christian Romero (https://christian-romero.vercel.app/)
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 300);
    };
  </script>
</body>
</html>`;

  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }
}
