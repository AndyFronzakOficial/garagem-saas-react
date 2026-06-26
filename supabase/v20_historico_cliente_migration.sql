create extension if not exists "pgcrypto";

create table if not exists product_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  customer_id uuid references customers(id) on delete cascade,
  product_id uuid references products(id),
  product_name text,
  quantity numeric(12,2) default 1,
  status text default 'reservado',
  notes text,
  created_at timestamptz default now()
);

create table if not exists customer_returns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  customer_id uuid references customers(id) on delete cascade,
  sale_id uuid references sales(id),
  product_id uuid references products(id),
  product_name text,
  reason text,
  amount numeric(12,2) default 0,
  status text default 'registrado',
  created_at timestamptz default now()
);

create table if not exists warranties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  customer_id uuid references customers(id) on delete cascade,
  sale_id uuid references sales(id),
  product_id uuid references products(id),
  product_name text,
  serial_number text,
  imei text,
  start_date date,
  end_date date,
  status text default 'ativa',
  notes text,
  created_at timestamptz default now()
);

alter table product_reservations enable row level security;
alter table customer_returns enable row level security;
alter table warranties enable row level security;

drop policy if exists product_reservations_owner_all on product_reservations;
drop policy if exists customer_returns_owner_all on customer_returns;
drop policy if exists warranties_owner_all on warranties;

create policy product_reservations_owner_all
on product_reservations for all to authenticated
using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy customer_returns_owner_all
on customer_returns for all to authenticated
using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy warranties_owner_all
on warranties for all to authenticated
using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Melhora compatibilidade caso sua tabela service_orders ainda não tenha customer_id.
alter table service_orders add column if not exists customer_id uuid references customers(id);
alter table service_orders add column if not exists customer_name text;
alter table service_orders add column if not exists customer_whatsapp text;
