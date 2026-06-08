-- GARAGEM SAAS - PATCH GOOGLE DRIVE CORRIGIDO
-- Rode no Supabase SQL Editor. Pode rodar por cima.

alter table service_orders add column if not exists drive_file_id text;
alter table service_orders add column if not exists drive_file_name text;
alter table service_orders add column if not exists drive_folder_id text;
alter table service_orders add column if not exists print_file_url text;
alter table service_orders add column if not exists priority text default 'Média';

alter table public_quotes add column if not exists file_url text;
alter table public_quotes add column if not exists drive_file_id text;
alter table public_quotes add column if not exists drive_file_name text;
alter table public_quotes add column if not exists drive_folder_id text;
