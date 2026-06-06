-- Rode este SQL no Supabase > SQL Editor

insert into storage.buckets (id, name, public)
values ('os-files', 'os-files', true)
on conflict (id) do update set public = true;

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
