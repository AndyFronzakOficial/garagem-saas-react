create extension if not exists "pgcrypto";

create sequence if not exists service_orders_os_number_seq start 1;

create table if not exists service_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  os_number bigint not null default nextval('service_orders_os_number_seq'),
  customer_id uuid references customers(id),
  customer_name text,
  instagram text,
  whatsapp text,
  device text,
  reported_defect text,
  visual_condition text,
  requested_service text,
  technician text,
  priority text default 'Normal',
  estimated_deadline date,
  estimated_value numeric(12,2) default 0,
  final_value numeric(12,2) default 0,
  paid_entry numeric(12,2) default 0,
  remaining_balance numeric(12,2) default 0,
  payment_method text,
  service_status text default 'Recebido',
  internal_notes text,
  assistance_terms text,
  customer_signature text,
  photos text,
  product_id uuid references products(id),
  product_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table service_orders add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table service_orders add column if not exists os_number bigint default nextval('service_orders_os_number_seq');
alter table service_orders add column if not exists customer_id uuid references customers(id);
alter table service_orders add column if not exists customer_name text;
alter table service_orders add column if not exists instagram text;
alter table service_orders add column if not exists whatsapp text;
alter table service_orders add column if not exists device text;
alter table service_orders add column if not exists reported_defect text;
alter table service_orders add column if not exists visual_condition text;
alter table service_orders add column if not exists requested_service text;
alter table service_orders add column if not exists technician text;
alter table service_orders add column if not exists priority text default 'Normal';
alter table service_orders add column if not exists estimated_deadline date;
alter table service_orders add column if not exists estimated_value numeric(12,2) default 0;
alter table service_orders add column if not exists final_value numeric(12,2) default 0;
alter table service_orders add column if not exists paid_entry numeric(12,2) default 0;
alter table service_orders add column if not exists remaining_balance numeric(12,2) default 0;
alter table service_orders add column if not exists payment_method text;
alter table service_orders add column if not exists service_status text default 'Recebido';
alter table service_orders add column if not exists internal_notes text;
alter table service_orders add column if not exists assistance_terms text;
alter table service_orders add column if not exists customer_signature text;
alter table service_orders add column if not exists photos text;
alter table service_orders add column if not exists product_id uuid references products(id);
alter table service_orders add column if not exists product_name text;
alter table service_orders add column if not exists updated_at timestamptz default now();

alter table financial_entries add column if not exists service_order_id uuid references service_orders(id);

alter table service_orders enable row level security;
drop policy if exists service_orders_owner_all on service_orders;
create policy service_orders_owner_all on service_orders for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_service_orders_user_id on service_orders(user_id);
create index if not exists idx_service_orders_customer_id on service_orders(customer_id);
create index if not exists idx_financial_entries_service_order_id on financial_entries(service_order_id);
