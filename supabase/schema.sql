create extension if not exists "uuid-ossp";

create table if not exists clients (
 id uuid primary key default uuid_generate_v4(),
 name text not null,
 company text,
 phone text,
 email text,
 address text,
 notes text,
 created_at timestamptz default now()
);

create table if not exists service_prices (
 id uuid primary key default uuid_generate_v4(),
 name text not null,
 price_m2_partner numeric(10,2) default 0,
 price_m2_final numeric(10,2) default 0,
 active boolean default true,
 created_at timestamptz default now()
);

create table if not exists accounts_receivable (
 id uuid primary key default uuid_generate_v4(),
 client_id uuid references clients(id) on delete set null,
 title text not null,
 due_date date default current_date,
 amount numeric(10,2) default 0,
 reference text,
 status text default 'Aberto',
 created_at timestamptz default now()
);

create table if not exists accounts_payable (
 id uuid primary key default uuid_generate_v4(),
 title text not null,
 supplier text,
 due_date date default current_date,
 amount numeric(10,2) default 0,
 reference text,
 status text default 'A pagar',
 created_at timestamptz default now()
);

create table if not exists service_orders (
 id uuid primary key default uuid_generate_v4(),
 os_number text not null unique,
 client_id uuid not null references clients(id),
 service text not null,
 service_price_id uuid references service_prices(id) on delete set null,
 service_type text,
 width_m numeric(10,2),
 height_m numeric(10,2),
 area_m2 numeric(10,2),
 price_m2 numeric(10,2),
 estimated_price numeric(10,2),
 measures text,
 finishing text default 'Sem acabamento',
 description text,
 print_file_url text,
 source text default 'Interno',
 status text default 'Entrada',
 created_at timestamptz default now()
);

create table if not exists public_quotes (
 id uuid primary key default uuid_generate_v4(),
 quote_number text not null unique,
 client_name text not null,
 company text,
 phone text not null,
 email text,
 address text,
 service_price_id uuid references service_prices(id) on delete set null,
 service_name text not null,
 width_m numeric(10,2) default 0,
 height_m numeric(10,2) default 0,
 area_m2 numeric(10,2) default 0,
 price_m2 numeric(10,2) default 0,
 estimated_price numeric(10,2) default 0,
 finishing text default 'Sem acabamento',
 description text,
 status text default 'Novo',
 created_at timestamptz default now()
);

create table if not exists inventory (
 id uuid primary key default uuid_generate_v4(),
 material text not null,
 quantity numeric(10,2) default 0,
 unit text default 'un',
 min_quantity numeric(10,2) default 0,
 notes text,
 created_at timestamptz default now()
);

create table if not exists installations (
 id uuid primary key default uuid_generate_v4(),
 service_order_id uuid references service_orders(id) on delete set null,
 team text not null,
 vehicle text,
 route text,
 address text not null,
 installation_date date not null,
 installation_time time,
 status text default 'Agendado',
 reschedule_reason text,
 notes text,
 created_at timestamptz default now()
);

insert into service_prices (name, price_m2_partner, price_m2_final, active) values
('Adesivo',90,120,true),('Lona',80,110,true),('Banner',95,130,true),('Faixa',75,100,true),
('Plotagem',110,150,true),('Placa',140,190,true),('ACM',280,380,true),('PVC',180,250,true),
('Letra caixa alta',350,480,true);

alter table clients enable row level security;
alter table service_prices enable row level security;
alter table accounts_receivable enable row level security;
alter table accounts_payable enable row level security;
alter table service_orders enable row level security;
alter table public_quotes enable row level security;
alter table inventory enable row level security;
alter table installations enable row level security;

create policy "auth all clients" on clients for all to authenticated using (true) with check (true);
create policy "auth all prices" on service_prices for all to authenticated using (true) with check (true);
create policy "auth all receivable" on accounts_receivable for all to authenticated using (true) with check (true);
create policy "auth all payable" on accounts_payable for all to authenticated using (true) with check (true);
create policy "auth all orders" on service_orders for all to authenticated using (true) with check (true);
create policy "auth all quotes" on public_quotes for all to authenticated using (true) with check (true);
create policy "auth all inventory" on inventory for all to authenticated using (true) with check (true);
create policy "auth all installations" on installations for all to authenticated using (true) with check (true);

create policy "anon read prices" on service_prices for select to anon using (active = true);
create policy "anon insert quotes" on public_quotes for insert to anon with check (true);
create policy "anon read clients portal" on clients for select to anon using (true);
create policy "anon insert orders portal" on service_orders for insert to anon with check (true);
create policy "anon insert receivable portal" on accounts_receivable for insert to anon with check (true);
