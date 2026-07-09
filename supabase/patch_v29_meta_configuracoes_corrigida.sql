-- PATCH V29 - Meta mensal das configurações corrigida
-- Rode no Supabase SQL Editor para garantir que bancos antigos tenham os campos necessários.

create extension if not exists "uuid-ossp";

create table if not exists public.company_settings (
  id int primary key default 1,
  company_name text default 'Garagem Comunicação Visual',
  cnpj text default '36.685.414/0001-49',
  address text default 'R. Califórnia, 287 - Guaraituba, Colombo - PR, 83410-140',
  phone text default '(41) 99267-5409',
  logo_url text default '/logo.png',
  created_at timestamptz default now()
);

alter table public.company_settings
  add column if not exists whatsapp text,
  add column if not exists email text,
  add column if not exists pdf_footer text,
  add column if not exists monthly_goal numeric(12,2) default 35000,
  add column if not exists notify_os_new boolean default true,
  add column if not exists notify_os_ready boolean default true,
  add column if not exists notify_overdue boolean default true,
  add column if not exists notify_installation boolean default true;

insert into public.company_settings (id, monthly_goal)
values (1, 35000)
on conflict (id) do update
set monthly_goal = coalesce(public.company_settings.monthly_goal, excluded.monthly_goal);

create table if not exists public.monthly_goals (
  id uuid primary key default uuid_generate_v4(),
  month text not null unique,
  goal_amount numeric(12,2) default 0,
  created_at timestamptz default now()
);

insert into public.monthly_goals (month, goal_amount)
values (to_char(now(), 'YYYY-MM'), coalesce((select monthly_goal from public.company_settings where id = 1), 35000))
on conflict (month) do update
set goal_amount = excluded.goal_amount;

alter table public.company_settings enable row level security;
alter table public.monthly_goals enable row level security;

drop policy if exists "auth all company_settings" on public.company_settings;
drop policy if exists "anon read company_settings" on public.company_settings;
drop policy if exists "auth all goals" on public.monthly_goals;

create policy "auth all company_settings" on public.company_settings for all to authenticated using (true) with check (true);
create policy "anon read company_settings" on public.company_settings for select to anon using (true);
create policy "auth all goals" on public.monthly_goals for all to authenticated using (true) with check (true);
