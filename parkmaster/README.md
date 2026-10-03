# ParkMaster SaaS / CParkingSoft (Fase 1)

Next.js 14 (App Router) + TypeScript + Tailwind + Supabase (PostgreSQL + RLS + Auth + Realtime). Offline-first con IndexedDB.

## Arranque rápido (modo local, sin Supabase)
```
npm install
npm run dev      # http://localhost:3000
```
Sin variables de entorno la app corre en **modo local** con cuentas demo (se muestran en el login):
- Super-Admin `superadmin@parkmaster.local` / `superadmin123`
- Administrador `admin@fabricato.local` / `admin123`
- Cajero `cajero@fabricato.local` / `cajero123`

## Conectar Supabase
1. Cree el proyecto en Supabase y ejecute `public/schema.sql` en el SQL Editor.
2. Cree su usuario maestro en Authentication > Users y ejecute el bloque de semilla (al final de `schema.sql`) con su UUID, para crear el perfil `superadmin` y el tenant Parque Fabricato.
3. Copie `.env.example` a `.env.local` y complete `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` (esta última solo en servidor; en Vercel agréguela como variable de entorno sin prefijo `NEXT_PUBLIC`).
4. Desde el panel Super-Admin cree el parqueadero y su administrador; el administrador crea los cajeros.

## Despliegue en Vercel
Importe la carpeta `parkmaster/` como proyecto Next.js, defina las 3 variables de entorno y despliegue. `npm run build` compila sin errores.

## Arquitectura offline
- Todas las entradas, cobros y turnos se escriben primero en IndexedDB y en una **cola** (`queue`) con upserts idempotentes por UUID generado en el cliente.
- Con `online` la cola se envía a Supabase (también cada 20 s); los cambios llegan a otros cajeros por `supabase.channel('tenant_parking')`.
- Entre pestañas del mismo equipo se sincroniza con `BroadcastChannel`.
- Un índice único parcial en la base (`one_active_plate_per_tenant`) impide placas duplicadas dentro aunque dos cajas operen offline a la vez; en ese caso la sincronización de ese registro mostrará "Error de sincronización".

## Limitaciones conocidas de la Fase 1
- Los números de tiquete se calculan por equipo; con dos cajas offline simultáneas pueden chocar (`unique tenant_id, ticket_code`). Recomendado: una caja por bahía o prefijo distinto por caja.
- Las operaciones administrativas (config, empleados, panel Super-Admin) requieren internet en modo Supabase.
- El envío a WhatsApp abre `wa.me` con el mensaje y copia la captura al portapapeles para pegarla; WhatsApp no permite adjuntar archivos por enlace. El ticket de soporte queda registrado y marca `support_ticket_active`.
- No se ha probado contra un proyecto Supabase real (no hay credenciales): el esquema SQL y las llamadas deben validarse en el primer despliegue.
