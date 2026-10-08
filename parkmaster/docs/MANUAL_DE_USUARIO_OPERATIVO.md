# CParkingSoft · Manual de Usuario y Guía Operativa

**Manual Oficial de Operaciones para Taquilleros, Supervisores y Administradores de Parqueadero**

---

## 1. Módulo del Cajero (Taquilla POS)

### 1.1 Inicio de Turno y Apertura de Caja
1. Inicie sesión con su usuario y contraseña en la pantalla de bienvenida.
2. Diríjase a la pestaña **Turno y Arqueo**.
3. Si el turno está cerrado, el sistema solicitará la **Base de Caja Inicial en Efectivo** (ej. $50.000 COP).
4. Digite el valor y haga clic en **Abrir Turno [Enter]**. 
> *Nota: Ninguna entrada o cobro podrá registrarse si el cajero no tiene un turno abierto.*

---

### 1.2 Registro Rápido de Entrada de Vehículos
La interfaz está optimizada para ingreso veloz sin tocar el ratón:
- **Atajos de Teclado:**
  - Presione `1` o `F1` para seleccionar **Moto**.
  - Presione `2` o `F2` para seleccionar **Carro**.
  - Presione `Escape` para limpiar el campo de placa.
- **Flujo:**
  1. Digite la placa en el campo central (admite formatos colombianos tradicionales y nuevos como `ABC12D`, `ABC123`, `CD0123`).
  2. Si la placa corresponde a un **Abonado / Mensualista Vigente**, aparecerá un banner verde indicando que el vehículo no genera cobro horario.
  3. Presione `Enter` para guardar e imprimir inmediatamente el tiquete térmico con código QR y fecha/hora exacta.

---

### 1.3 Cobro y Registro de Salida
1. Seleccione la pestaña **Salida y Cobro**.
2. Localice el vehículo escaneando el código QR del tiquete con el lector óptico o digitando las letras/números de la placa en la barra de búsqueda.
3. El sistema calculará automáticamente:
   - Tiempo total transcurrido.
   - Período de gracia gratuito (si aplica).
   - Tarifa plena calculada por hora o fracción.
4. **Convenios Comerciales (Smart Fit, Éxito, Locales):**
   - Si el cliente presenta factura o sello de un aliado comercial, despliegue el menú **Convenio Comercial / Descuento de Local**.
   - Seleccione el convenio correspondiente (ej. *Smart Fit 120 min gratis* o *Restaurante 20%*).
   - Si el convenio lo exige, digite el **Número de Factura o Consecutivo** en el campo solicitado para auditoría.
   - El sistema recalculará la tarifa plena, el descuento otorgado y el total neto a cobrar.
5. **Método de Pago:**
   - **Efectivo:** Ingrese el monto entregado por el cliente en `PAGA CON`. El sistema calcula el cambio/devuelta de inmediato.
   - **Transferencia:** Marque la casilla de verificación confirmando que el dinero ingresó a la cuenta del parqueadero.
6. Presione **Cobrar y Registrar Salida [Enter]** para imprimir el recibo térmico con el desglose de ahorro.

---

### 1.4 Liquidación por Tiquete Perdido
En caso de que el cliente haya extraviado su tiquete físico:
1. Haga clic en el botón superior **[ ⚠️ Liquidar Tiquete Perdido ]**.
2. Seleccione el tipo de vehículo (Moto / Carro).
3. Ingrese la **Placa del vehículo**.
4. Ingrese obligatoriamente:
   - **Nombre completo de quien retira el vehículo**.
   - **Cédula / Documento de identidad**.
5. Seleccione el método de pago y presione **Liquidar e Imprimir**.
6. Se cobrará la tarifa de sanción configurada ($15.000 COP u otro valor) y quedará el soporte legal del retiro.

---

### 1.5 Cierre de Turno y Arqueo Ciego con Vehículos en Patio
1. Diríjase a la pestaña **Turno y Arqueo**.
2. **Vehículos en Patio (Traspaso de Turno / Pernocta):**
   - Si hay vehículos dentro de las instalaciones, verá una tarjeta informativa indicando la cantidad de vehículos en patio.
   - **El cierre de caja NO se bloquea:** El cobro de esos vehículos se atribuirá al turno y cajero que registre su salida efectiva cuando el vehículo se retire.
   - El sistema guarda una auditoría de todos los tiquetes abiertos en el momento del cierre.
3. **Cierre Ciego:**
   - Cuente todo el efectivo físico en su gaveta (incluida la base inicial).
   - Digite el total en **EFECTIVO FÍSICO EN MANO (COP)**.
   - Presione **Cerrar Turno**.
4. El sistema emitirá el dictamen de caja:
   - *Caja Cuadrada Exacta*, *Faltante de Dinero* o *Sobrante de Dinero*.
5. Presione **Imprimir comprobante de arqueo** para firmar y entregar al supervisor.

---

## 2. Módulo de Administración (`/admin`)

### 2.1 Convenios & Locales Comerciales
- Permite crear alianzas con establecimientos del centro comercial o vecinos.
- **Tipos de beneficio:**
  - *Porcentaje:* Descuento porcentual (ej. 10%, 20%, 50%).
  - *Tiempo Gratis:* Minutos de gracia adicionales (ej. 60 o 120 minutos).
  - *Tarifa Fija:* Tarifa única subsidiada para clientes del local.
- Active la casilla **Exigir Factura o Código de Sello en caja** si requiere que el cajero digite el consecutivo del local para validar el beneficio.

### 2.2 Mensualidades & Abonados
- Registro de vehículos con contrato mensual o tarifa fija.
- Datos obligatorios: Nombre del titular, documento de identidad, teléfono, placa, tipo de vehículo, tarifa pactada y fechas de vigencia.
- Acción **Renovar Mes (+1):** Agrega un mes de cobertura automáticamente al vencerse el período.
- Durante la vigencia, el cajero puede registrar entrada y salida del abonado a costo $0 COP.

### 2.3 Reporte de Convenios y Cobro a Locales
- Muestra el consolidado de tiquetes sellados por cada local aliado.
- Calcula el subtotal de tarifa plena, los descuentos otorgados y el **Total a Cobrar al Local** a final de mes por concepto de subsidio de parqueo.

### 2.4 Gestión de Cajeros y Reseteo Rápido de Claves
- Crear nuevas cuentas para operarios de taquilla.
- Botón **[ 🔑 Clave & Datos ]**:
  - Permite asignar una nueva contraseña en segundos sin depender de confirmaciones por correo electrónico.
  - Botón **[ 📋 WhatsApp ]** para copiar y enviar al empleado sus credenciales listas para ingresar.
- **Protección de Turno:** El sistema impide desactivar a un cajero si tiene un turno de caja abierto.

### 2.5 Configuración del Negocio
- Personalización de tarifas por hora para Carro y Moto.
- Definición de minutos de gracia gratuita.
- Tarifa de sanción por tiquete perdido.
- Ancho de papel térmico (58mm o 80mm).
- Texto legal personalizado de custodia de vehículos.

---

## 3. Soporte y Asistencia Técnica
En caso de dudas operativas o fallas de hardware, comuníquese con el administrador del sistema o contacte a soporte técnico oficial:
- **WhatsApp Soporte:** +57 318 351 7802
- **Portal Web:** [https://c-paking-soft.vercel.app](https://c-paking-soft.vercel.app)
