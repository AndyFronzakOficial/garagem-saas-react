create extension if not exists "uuid-ossp";

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

alter table service_orders add column if not exists designer_responsible text;
alter table service_orders add column if not exists printer_responsible text;
alter table service_orders add column if not exists due_date date;
alter table service_orders add column if not exists delivered_at date;
alter table service_orders add column if not exists priority text default 'Média';
alter table service_orders add column if not exists is_deleted boolean default false;
alter table service_orders add column if not exists drive_file_name text;
alter table service_orders add column if not exists drive_file_id text;
alter table service_orders add column if not exists drive_folder_id text;

alter table inventory enable row level security;
alter table installations enable row level security;

drop policy if exists "auth all inventory" on inventory;
drop policy if exists "auth all installations" on installations;

create policy "auth all inventory" on inventory for all to authenticated using (true) with check (true);
create policy "auth all installations" on installations for all to authenticated using (true) with check (true);
