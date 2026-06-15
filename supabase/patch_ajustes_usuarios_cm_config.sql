create extension if not exists "uuid-ossp";

create table if not exists profiles (
  id uuid primary key default uuid_generate_v4(),
  email text unique,
  name text,
  role text default 'Orçamento',
  created_at timestamptz default now()
);

create table if not exists company_settings (
  id int primary key default 1,
  company_name text default 'Garagem Comunicação Visual',
  cnpj text default '36.685.414/0001-49',
  address text default 'R. Califórnia, 287 - Guaraituba, Colombo - PR, 83410-140',
  phone text default '(41) 99267-5409',
  logo_url text default '/logo.png',
  monthly_goal numeric(12,2) default 35000,
  notify_os_new boolean default true,
  notify_os_ready boolean default true,
  notify_overdue boolean default true,
  notify_installation boolean default true,
  created_at timestamptz default now()
);

insert into company_settings (id) values (1) on conflict (id) do nothing;

alter table service_prices add column if not exists price_m2_partner numeric(10,2) default 0;
alter table service_prices add column if not exists price_m2_final numeric(10,2) default 0;
alter table service_prices add column if not exists active boolean default true;

alter table service_orders add column if not exists width_cm numeric(10,2);
alter table service_orders add column if not exists height_cm numeric(10,2);
alter table service_orders add column if not exists drive_file_id text;
alter table service_orders add column if not exists drive_file_name text;
alter table service_orders add column if not exists drive_folder_id text;
alter table service_orders add column if not exists priority text default 'Média';
alter table service_orders add column if not exists is_deleted boolean default false;
alter table service_orders add column if not exists due_date date;
alter table service_orders add column if not exists delivered_at date;
alter table service_orders add column if not exists designer_responsible text;
alter table service_orders add column if not exists printer_responsible text;

alter table public_quotes add column if not exists width_cm numeric(10,2);
alter table public_quotes add column if not exists height_cm numeric(10,2);
alter table public_quotes add column if not exists file_url text;
alter table public_quotes add column if not exists drive_file_id text;
alter table public_quotes add column if not exists drive_file_name text;
alter table public_quotes add column if not exists drive_folder_id text;

create table if not exists inventory (
  id uuid primary key default uuid_generate_v4(),
  material text not null,
  quantity numeric(10,2) default 0,
  unit text default 'm²',
  min_quantity numeric(10,2) default 0,
  notes text,
  created_at timestamptz default now()
);

create table if not exists installations (
  id uuid primary key default uuid_generate_v4(),
  service_order_id uuid references service_orders(id) on delete set null,
  team text,
  vehicle text,
  route text,
  address text,
  installation_date date,
  installation_time time,
  status text default 'Agendado',
  notes text,
  created_at timestamptz default now()
);

alter table accounts_receivable add column if not exists is_recurring boolean default false;
alter table accounts_payable add column if not exists is_recurring boolean default false;

alter table profiles enable row level security;
alter table company_settings enable row level security;
alter table inventory enable row level security;
alter table installations enable row level security;

drop policy if exists "auth all profiles" on profiles;
drop policy if exists "auth all company_settings" on company_settings;
drop policy if exists "anon read company_settings" on company_settings;
drop policy if exists "auth all inventory" on inventory;
drop policy if exists "auth all installations" on installations;

create policy "auth all profiles" on profiles for all to authenticated using (true) with check (true);
create policy "auth all company_settings" on company_settings for all to authenticated using (true) with check (true);
create policy "anon read company_settings" on company_settings for select to anon using (true);
create policy "auth all inventory" on inventory for all to authenticated using (true) with check (true);
create policy "auth all installations" on installations for all to authenticated using (true) with check (true);

insert into storage.buckets (id, name, public)
values ('os-files','os-files',true)
on conflict (id) do update set public = true;

-- Senha do admin:
-- Supabase > Authentication > Users > admin@garagem.com > reset password
-- Use a nova senha: garagem@2026
