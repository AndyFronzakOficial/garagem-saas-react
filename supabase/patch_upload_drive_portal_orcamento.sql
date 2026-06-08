-- Rode no Supabase SQL Editor
-- Campos para salvar links do Google Drive

alter table service_orders add column if not exists drive_file_id text;
alter table service_orders add column if not exists drive_file_name text;
alter table service_orders add column if not exists drive_folder_id text;

alter table public_quotes add column if not exists file_url text;
alter table public_quotes add column if not exists drive_file_id text;
alter table public_quotes add column if not exists drive_file_name text;
alter table public_quotes add column if not exists drive_folder_id text;
