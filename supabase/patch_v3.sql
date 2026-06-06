-- GARAGEM SAAS V3 PATCH
-- Rode no Supabase SQL Editor. Pode rodar por cima.

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

alter table monthly_goals enable row level security;

drop policy if exists "auth all goals" on monthly_goals;
create policy "auth all goals" on monthly_goals for all to authenticated using (true) with check (true);

-- Ajustar status Designer se você usa enum/text não precisa fazer nada. Aqui status é text.

insert into storage.buckets (id, name, public)
values ('os-files','os-files',true)
on conflict (id) do update set public = true;

drop policy if exists "public read os files" on storage.objects;
drop policy if exists "anon upload os files" on storage.objects;
drop policy if exists "anon update os files" on storage.objects;
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
