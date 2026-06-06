-- GARAGEM SAAS V5 COMPLETO
-- Rode no Supabase SQL Editor. Pode rodar por cima.

create extension if not exists "uuid-ossp";

create table if not exists company_settings (
 id int primary key default 1,
 company_name text default 'Garagem Comunicação Visual',
 cnpj text default '36.685.414/0001-49',
 address text default 'R. Califórnia, 287 - Guaraituba, Colombo - PR, 83410-140',
 phone text default '(41) 99267-5409',
 logo_url text default '/logo.png',
 created_at timestamptz default now()
);

insert into company_settings (id, company_name, cnpj, address, phone, logo_url)
values (1, 'Garagem Comunicação Visual', '36.685.414/0001-49', 'R. Califórnia, 287 - Guaraituba, Colombo - PR, 83410-140', '(41) 99267-5409', '/logo.png')
on conflict (id) do nothing;

create table if not exists profiles (
 id uuid primary key default uuid_generate_v4(),
 email text unique,
 name text,
 role text default 'Funcionário',
 created_at timestamptz default now()
);

create table if not exists monthly_goals (
 id uuid primary key default uuid_generate_v4(),
 month text not null unique,
 goal_amount numeric(10,2) default 0,
 created_at timestamptz default now()
);

alter table service_orders add column if not exists designer_responsible text;
alter table service_orders add column if not exists printer_responsible text;
alter table service_orders add column if not exists due_date date;
alter table service_orders add column if not exists delivered_at date;
alter table service_orders add column if not exists priority text default 'Média';

alter table accounts_receivable add column if not exists is_recurring boolean default false;
alter table accounts_payable add column if not exists is_recurring boolean default false;

alter table company_settings enable row level security;
alter table profiles enable row level security;
alter table monthly_goals enable row level security;

drop policy if exists "auth all company_settings" on company_settings;
drop policy if exists "auth all profiles" on profiles;
drop policy if exists "auth all goals" on monthly_goals;
drop policy if exists "anon read company_settings" on company_settings;

create policy "auth all company_settings" on company_settings for all to authenticated using (true) with check (true);
create policy "anon read company_settings" on company_settings for select to anon using (true);
create policy "auth all profiles" on profiles for all to authenticated using (true) with check (true);
create policy "auth all goals" on monthly_goals for all to authenticated using (true) with check (true);

insert into storage.buckets (id, name, public)
values ('os-files','os-files',true)
on conflict (id) do update set public = true;

drop policy if exists "Allow public read os-files" on storage.objects;
drop policy if exists "Allow public upload os-files" on storage.objects;
drop policy if exists "Allow public update os-files" on storage.objects;

create policy "Allow public read os-files"
on storage.objects
for select
to public
using (bucket_id = 'os-files');

create policy "Allow public upload os-files"
on storage.objects
for insert
to public
with check (bucket_id = 'os-files');

create policy "Allow public update os-files"
on storage.objects
for update
to public
using (bucket_id = 'os-files')
with check (bucket_id = 'os-files');
