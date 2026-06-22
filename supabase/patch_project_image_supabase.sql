-- Imagem do projeto no orçamento público e na OS
-- Rode no Supabase > SQL Editor antes do deploy.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('os-files', 'os-files', true, 52428800, array['image/jpeg','image/png','image/webp','image/gif','image/svg+xml','application/pdf','application/octet-stream'])
on conflict (id) do update set
  public = true,
  file_size_limit = 52428800;

alter table public_quotes add column if not exists project_image_url text;
alter table public_quotes add column if not exists project_image_name text;
alter table public_quotes add column if not exists project_image_path text;

alter table service_orders add column if not exists project_image_url text;
alter table service_orders add column if not exists project_image_name text;
alter table service_orders add column if not exists project_image_path text;

drop policy if exists "public read os files" on storage.objects;
create policy "public read os files"
on storage.objects
for select
to anon
using (bucket_id = 'os-files');

drop policy if exists "anon upload os files" on storage.objects;
create policy "anon upload os files"
on storage.objects
for insert
to anon
with check (bucket_id = 'os-files');

drop policy if exists "anon update os files" on storage.objects;
create policy "anon update os files"
on storage.objects
for update
to anon
using (bucket_id = 'os-files')
with check (bucket_id = 'os-files');
