-- Patch: Nota fiscal manual na Ordem de Serviço e Portal Terceiro
-- Rode este arquivo no SQL Editor do Supabase antes do deploy desta versão.

alter table public.service_orders
  add column if not exists invoice_file_url text,
  add column if not exists invoice_file_name text,
  add column if not exists invoice_file_path text,
  add column if not exists invoice_uploaded_at timestamptz;

comment on column public.service_orders.invoice_file_url is 'Link público da nota fiscal anexada manualmente na OS.';
comment on column public.service_orders.invoice_file_name is 'Nome original do arquivo da nota fiscal.';
comment on column public.service_orders.invoice_file_path is 'Caminho do arquivo da nota fiscal no Supabase Storage.';
comment on column public.service_orders.invoice_uploaded_at is 'Data e hora do upload manual da nota fiscal.';
