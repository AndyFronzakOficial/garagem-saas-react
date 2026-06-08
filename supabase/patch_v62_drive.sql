-- GARAGEM SAAS V6.2 GOOGLE DRIVE
-- Rode no Supabase SQL Editor. Pode rodar por cima.

alter table service_orders add column if not exists drive_file_id text;
alter table service_orders add column if not exists drive_file_name text;
alter table service_orders add column if not exists drive_folder_id text;
alter table service_orders add column if not exists external_file_link text;

-- O sistema continua usando print_file_url para o link do Drive,
-- assim as telas antigas continuam funcionando.
