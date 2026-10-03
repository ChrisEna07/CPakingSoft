-- =====================================================================
--  ParkMaster SaaS / CParkingSoft  -  Esquema Supabase (PostgreSQL)
--  Multi-tenant con Row Level Security. Ejecutar en: Supabase > SQL Editor
-- =====================================================================
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. TABLAS
-- ---------------------------------------------------------------------
create table if not exists public.tenants (
  id                    uuid primary key default gen_random_uuid(),
  business_name         text not null,
  nit_rut               text,
  slug                  text not null unique,
  city                  text,
  address               text,
  phone                 text,
  plan_type             text not null default 'piloto_7dias'
                          check (plan_type in ('mensual_saas','licencia_definitiva','piloto_7dias')),
  monthly_fee_cop       numeric(12,0) not null default 0,
  billing_due_day       int  not null default 1 check (billing_due_day between 1 and 31),
  last_payment_date     date,
  next_payment_date     date,
  status                text not null default 'piloto'
                          check (status in ('activo','suspendido','piloto','mora')),
  is_online             boolean not null default false,
  last_seen_at          timestamptz,            -- heartbeat
  support_ticket_active boolean not null default false,
  config_json           jsonb not null default '{
    "rate_moto":1500,"rate_carro":3500,"grace_minutes":15,"billing_mode":"hora",
    "legal_text":"Conserve este tiquete: es indispensable para retirar su vehiculo.",
    "ticket_prefix":"PF","cap_moto":150,"cap_carro":400,"paper_width":80,
    "barrier_enabled":false,"barrier_open_seconds":5}'::jsonb,
  created_at            timestamptz not null default now()
);

create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  tenant_id  uuid references public.tenants(id) on delete cascade,   -- NULL = superadmin
  full_name  text not null,
  email      text not null,
  role       text not null check (role in ('superadmin','tenant_admin','cajero')),
  active     boolean not null default true,
  constraint superadmin_sin_tenant check ((role = 'superadmin') = (tenant_id is null))
);
create index if not exists profiles_tenant_idx on public.profiles(tenant_id);

create table if not exists public.parking_records (
  id             uuid primary key,                        -- generado en el cliente (offline-first)
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  ticket_code    text not null,
  plate          varchar(10) not null,
  vehicle_type   text not null check (vehicle_type in ('moto','carro')),
  entry_time     timestamptz not null,
  exit_time      timestamptz,
  status         text not null default 'dentro' check (status in ('dentro','cobrado','anulado')),
  total_minutes  int,
  billed_hours   int,
  total_amount   numeric(12,0),
  payment_method text check (payment_method in ('efectivo','transferencia','cortesia')),
  created_by     uuid references public.profiles(id),
  closed_by      uuid references public.profiles(id),
  sync_status    text not null default 'synced' check (sync_status in ('synced','pending')),
  constraint ticket_unico_por_tenant unique (tenant_id, ticket_code)
);
-- Integridad: una placa no puede tener dos entradas activas en el mismo parqueadero
create unique index if not exists one_active_plate_per_tenant
  on public.parking_records(tenant_id, plate) where status = 'dentro';
create index if not exists records_tenant_entry_idx on public.parking_records(tenant_id, entry_time desc);

create table if not exists public.cash_shifts (
  id                     uuid primary key,
  tenant_id              uuid not null references public.tenants(id) on delete cascade,
  cashier_id             uuid not null references public.profiles(id),
  opened_at              timestamptz not null,
  closed_at              timestamptz,
  initial_base_cash      numeric(12,0) not null default 0,
  system_calculated_cash numeric(12,0),
  reported_cash          numeric(12,0),
  difference             numeric(12,0),
  status                 text not null default 'abierto' check (status in ('abierto','cerrado'))
);
create index if not exists shifts_tenant_idx on public.cash_shifts(tenant_id, opened_at desc);

create table if not exists public.support_tickets (
  id                uuid primary key,
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  reported_by       uuid references public.profiles(id),
  issue_description text not null,
  screenshot_url    text,
  created_at        timestamptz not null default now(),
  resolved          boolean not null default false
);

-- ---------------------------------------------------------------------
-- 2. FUNCIONES AUXILIARES (security definer evita recursión en RLS)
-- ---------------------------------------------------------------------
create or replace function public.auth_tenant_id() returns uuid
language sql stable security definer set search_path = public as $$
  select tenant_id from public.profiles where id = auth.uid() and active
$$;

create or replace function public.auth_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and active
$$;

create or replace function public.is_superadmin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.auth_role() = 'superadmin', false)
$$;

-- Latido: cada cliente en línea lo invoca cada minuto
create or replace function public.heartbeat() returns void
language sql security definer set search_path = public as $$
  update public.tenants set is_online = true, last_seen_at = now()
  where id = public.auth_tenant_id()
$$;

-- Al crear un ticket de soporte se marca el tenant para el panel del desarrollador
create or replace function public.flag_support_ticket() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.tenants set support_ticket_active = true where id = new.tenant_id;
  return new;
end $$;
drop trigger if exists trg_flag_support on public.support_tickets;
create trigger trg_flag_support after insert on public.support_tickets
  for each row execute function public.flag_support_ticket();

-- Un tenant_admin solo puede modificar datos de negocio y config_json, NUNCA facturación/estado
create or replace function public.protect_tenant_billing() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_superadmin() or auth.uid() is null then return new; end if;
  new.plan_type := old.plan_type;
  new.monthly_fee_cop := old.monthly_fee_cop;
  new.billing_due_day := old.billing_due_day;
  new.last_payment_date := old.last_payment_date;
  new.next_payment_date := old.next_payment_date;
  new.status := old.status;
  new.slug := old.slug;
  new.support_ticket_active := old.support_ticket_active;
  new.is_online := old.is_online;
  new.last_seen_at := old.last_seen_at;
  return new;
end $$;
drop trigger if exists trg_protect_tenant on public.tenants;
create trigger trg_protect_tenant before update on public.tenants
  for each row execute function public.protect_tenant_billing();

-- ---------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
alter table public.tenants          enable row level security;
alter table public.profiles         enable row level security;
alter table public.parking_records  enable row level security;
alter table public.cash_shifts      enable row level security;
alter table public.support_tickets  enable row level security;

-- tenants
drop policy if exists tenants_select on public.tenants;
create policy tenants_select on public.tenants for select
  using (public.is_superadmin() or id = public.auth_tenant_id());
drop policy if exists tenants_insert on public.tenants;
create policy tenants_insert on public.tenants for insert
  with check (public.is_superadmin());
drop policy if exists tenants_update on public.tenants;
create policy tenants_update on public.tenants for update
  using (public.is_superadmin() or (id = public.auth_tenant_id() and public.auth_role() = 'tenant_admin'))
  with check (public.is_superadmin() or (id = public.auth_tenant_id() and public.auth_role() = 'tenant_admin'));
drop policy if exists tenants_delete on public.tenants;
create policy tenants_delete on public.tenants for delete using (public.is_superadmin());

-- profiles (la creación de cuentas se hace desde el servidor con service_role)
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.is_superadmin()
         or (tenant_id = public.auth_tenant_id() and public.auth_role() = 'tenant_admin'));
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
  using (public.is_superadmin()
         or (tenant_id = public.auth_tenant_id() and public.auth_role() = 'tenant_admin' and role = 'cajero'))
  with check (public.is_superadmin()
         or (tenant_id = public.auth_tenant_id() and public.auth_role() = 'tenant_admin' and role = 'cajero'));

-- parking_records: cualquier usuario activo del tenant; sin DELETE (se anula, no se borra)
drop policy if exists records_select on public.parking_records;
create policy records_select on public.parking_records for select
  using (public.is_superadmin() or tenant_id = public.auth_tenant_id());
drop policy if exists records_insert on public.parking_records;
create policy records_insert on public.parking_records for insert
  with check (tenant_id = public.auth_tenant_id());
drop policy if exists records_update on public.parking_records;
create policy records_update on public.parking_records for update
  using (tenant_id = public.auth_tenant_id()) with check (tenant_id = public.auth_tenant_id());

-- cash_shifts
drop policy if exists shifts_select on public.cash_shifts;
create policy shifts_select on public.cash_shifts for select
  using (public.is_superadmin() or tenant_id = public.auth_tenant_id());
drop policy if exists shifts_insert on public.cash_shifts;
create policy shifts_insert on public.cash_shifts for insert
  with check (tenant_id = public.auth_tenant_id() and cashier_id = auth.uid());
drop policy if exists shifts_update on public.cash_shifts;
create policy shifts_update on public.cash_shifts for update
  using (tenant_id = public.auth_tenant_id() and (cashier_id = auth.uid() or public.auth_role() = 'tenant_admin'))
  with check (tenant_id = public.auth_tenant_id());

-- support_tickets
drop policy if exists support_select on public.support_tickets;
create policy support_select on public.support_tickets for select
  using (public.is_superadmin() or tenant_id = public.auth_tenant_id());
drop policy if exists support_insert on public.support_tickets;
create policy support_insert on public.support_tickets for insert
  with check (tenant_id = public.auth_tenant_id());
drop policy if exists support_update on public.support_tickets;
create policy support_update on public.support_tickets for update
  using (public.is_superadmin()) with check (public.is_superadmin());

-- ---------------------------------------------------------------------
-- 4. REALTIME (supabase.channel('tenant_parking'))
-- ---------------------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table public.parking_records;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.cash_shifts;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.tenants;
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 5. SEMILLA: primer cliente (piloto) y super-admin
--    1) Cree el usuario maestro en Authentication > Users (su correo).
--    2) Reemplace el UUID y correo abajo y ejecute este bloque.
-- ---------------------------------------------------------------------
-- insert into public.tenants (business_name, nit_rut, slug, city, address, phone, plan_type, monthly_fee_cop, billing_due_day, status)
-- values ('Centro Comercial Parque Fabricato','000000000','parque-fabricato','Bello','Bello, Antioquia','3000000000','piloto_7dias',220000,5,'piloto');
-- insert into public.profiles (id, tenant_id, full_name, email, role)
-- values ('<UUID-AUTH-USER>', null, 'ChrizDev', '<correo-maestro>', 'superadmin');
