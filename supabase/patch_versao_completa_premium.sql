-- Patch Garagem ERP - versão completa premium
-- Rode no Supabase SQL Editor depois dos patches anteriores.

alter table public.company_settings
  add column if not exists whatsapp text,
  add column if not exists email text,
  add column if not exists pdf_footer text;

alter table public.inventory
  add column if not exists unit_cost numeric default 0,
  add column if not exists total_cost numeric default 0;

alter table public.service_orders
  add column if not exists material_cost numeric default 0,
  add column if not exists installation_cost numeric default 0,
  add column if not exists designer_cost numeric default 0,
  add column if not exists other_cost numeric default 0,
  add column if not exists art_approval_status text default 'Pendente',
  add column if not exists art_approved_at timestamptz,
  add column if not exists art_revision_requested_at timestamptz,
  add column if not exists art_revision_note text,
  add column if not exists art_approval_signature text;

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  user_email text,
  action text not null,
  table_name text,
  record_id text,
  details jsonb,
  created_at timestamptz default now()
);

alter table public.audit_logs enable row level security;

do $$ begin
  create policy "audit_logs_select_authenticated" on public.audit_logs
    for select using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "audit_logs_insert_authenticated" on public.audit_logs
    for insert with check (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;

update public.company_settings
set whatsapp = coalesce(whatsapp, phone),
    pdf_footer = coalesce(pdf_footer, company_name)
where id = 1;
