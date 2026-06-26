create extension if not exists "pgcrypto";

create table if not exists public.store_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  store_name text not null default 'Bazar Eletrônicos',
  cnpj text,
  phone text,
  address text,
  logo_url text,
  theme text default 'dark',
  created_at timestamptz default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  product_code text,
  barcode text,
  brand text,
  cost_price numeric(12,2) default 0,
  sale_price numeric(12,2) default 0,
  stock integer default 0,
  min_stock integer default 0,
  created_at timestamptz default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  document text,
  phone text,
  address text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  document text,
  phone text,
  contact_name text,
  address text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  opened_at timestamptz default now(),
  closed_at timestamptz,
  opening_amount numeric(12,2) default 0,
  closing_amount numeric(12,2) default 0,
  expected_amount numeric(12,2) default 0,
  difference numeric(12,2) default 0,
  status text default 'aberto',
  created_at timestamptz default now()
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  cash_session_id uuid references public.cash_sessions(id) on delete set null,
  status text default 'finalizada',
  payment_method text,
  seller_name text,
  employee_name text,
  subtotal numeric(12,2) default 0,
  discount numeric(12,2) default 0,
  addition numeric(12,2) default 0,
  total numeric(12,2) default 0,
  profit numeric(12,2) default 0,
  created_at timestamptz default now()
);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  sale_id uuid references public.sales(id) on delete cascade,
  product_id uuid references public.products(id) on delete restrict,
  quantity numeric(12,2) default 1,
  unit_price numeric(12,2) default 0,
  cost_price numeric(12,2) default 0,
  discount numeric(12,2) default 0,
  total numeric(12,2) default 0,
  profit numeric(12,2) default 0,
  created_at timestamptz default now()
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  movement_type text not null,
  quantity numeric(12,2) not null,
  reason text,
  created_at timestamptz default now()
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  status text default 'aberto',
  subtotal numeric(12,2) default 0,
  freight numeric(12,2) default 0,
  extra_costs numeric(12,2) default 0,
  total numeric(12,2) default 0,
  due_date date,
  received_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  purchase_id uuid references public.purchases(id) on delete cascade,
  product_id uuid references public.products(id) on delete restrict,
  quantity numeric(12,2) default 1,
  cost_price numeric(12,2) default 0,
  sale_price numeric(12,2) default 0,
  total numeric(12,2) default 0,
  created_at timestamptz default now()
);

create table if not exists public.service_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  customer_name text not null,
  instagram text,
  whatsapp text,
  order_date date not null default current_date,
  payment_method text default 'Pix',
  payment_status text not null default 'pendente' check (payment_status in ('pendente', 'pago')),
  paid_at timestamptz,
  delivered boolean not null default false,
  delivered_at timestamptz,
  subtotal numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  notes text,
  pix_key text not null default '41-98464-8144',
  pix_holder text not null default 'Abquella Carmo de Lima',
  pix_bank text not null default 'Banco Itaú',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.service_order_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  service_order_id uuid references public.service_orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  product_code text,
  quantity numeric(12,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  created_at timestamptz default now()
);

create table if not exists public.financial_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  sale_id uuid references public.sales(id) on delete set null,
  purchase_id uuid references public.purchases(id) on delete set null,
  service_order_id uuid references public.service_orders(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  cash_session_id uuid references public.cash_sessions(id) on delete set null,
  description text not null,
  type text not null,
  payment_method text,
  amount numeric(12,2) default 0,
  due_date date,
  paid_at timestamptz,
  created_at timestamptz default now()
);

-- Compatibilidade com bancos de versões anteriores.
alter table public.store_settings add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.products add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.products add column if not exists product_code text;
alter table public.products add column if not exists barcode text;
alter table public.products add column if not exists brand text;
alter table public.products add column if not exists cost_price numeric(12,2) default 0;
alter table public.products add column if not exists sale_price numeric(12,2) default 0;
alter table public.products add column if not exists stock integer default 0;
alter table public.products add column if not exists min_stock integer default 0;
alter table public.customers add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.suppliers add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.cash_sessions add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.sales add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.sales add column if not exists cash_session_id uuid references public.cash_sessions(id) on delete set null;
alter table public.sales add column if not exists seller_name text;
alter table public.sales add column if not exists employee_name text;
alter table public.sale_items add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.stock_movements add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.purchases add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.purchase_items add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.financial_entries add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.financial_entries add column if not exists cash_session_id uuid references public.cash_sessions(id) on delete set null;
alter table public.financial_entries add column if not exists service_order_id uuid references public.service_orders(id) on delete set null;

alter table public.store_settings enable row level security;
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.suppliers enable row level security;
alter table public.cash_sessions enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.service_orders enable row level security;
alter table public.service_order_items enable row level security;
alter table public.financial_entries enable row level security;

-- Remove políticas antigas amplas e políticas da versão anterior.
drop policy if exists store_settings_authenticated_all on public.store_settings;
drop policy if exists products_authenticated_all on public.products;
drop policy if exists customers_authenticated_all on public.customers;
drop policy if exists suppliers_authenticated_all on public.suppliers;
drop policy if exists cash_sessions_authenticated_all on public.cash_sessions;
drop policy if exists sales_authenticated_all on public.sales;
drop policy if exists sale_items_authenticated_all on public.sale_items;
drop policy if exists stock_movements_authenticated_all on public.stock_movements;
drop policy if exists purchases_authenticated_all on public.purchases;
drop policy if exists purchase_items_authenticated_all on public.purchase_items;
drop policy if exists financial_entries_authenticated_all on public.financial_entries;

drop policy if exists store_settings_owner_all on public.store_settings;
drop policy if exists products_owner_all on public.products;
drop policy if exists customers_owner_all on public.customers;
drop policy if exists suppliers_owner_all on public.suppliers;
drop policy if exists cash_sessions_owner_all on public.cash_sessions;
drop policy if exists sales_owner_all on public.sales;
drop policy if exists sale_items_owner_all on public.sale_items;
drop policy if exists stock_movements_owner_all on public.stock_movements;
drop policy if exists purchases_owner_all on public.purchases;
drop policy if exists purchase_items_owner_all on public.purchase_items;
drop policy if exists service_orders_owner_all on public.service_orders;
drop policy if exists service_order_items_owner_all on public.service_order_items;
drop policy if exists financial_entries_owner_all on public.financial_entries;

create policy store_settings_owner_all on public.store_settings for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy products_owner_all on public.products for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy customers_owner_all on public.customers for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy suppliers_owner_all on public.suppliers for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy cash_sessions_owner_all on public.cash_sessions for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy sales_owner_all on public.sales for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy sale_items_owner_all on public.sale_items for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy stock_movements_owner_all on public.stock_movements for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy purchases_owner_all on public.purchases for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy purchase_items_owner_all on public.purchase_items for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy service_orders_owner_all on public.service_orders for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy service_order_items_owner_all on public.service_order_items for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy financial_entries_owner_all on public.financial_entries for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_service_orders_user_date on public.service_orders(user_id, order_date desc);
create index if not exists idx_service_orders_payment on public.service_orders(user_id, payment_status);
create index if not exists idx_service_order_items_order on public.service_order_items(service_order_id);
create index if not exists idx_financial_service_order on public.financial_entries(service_order_id);
