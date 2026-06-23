-- PDV integrado aos clientes existentes
alter table public_quotes
  add column if not exists client_id uuid references clients(id) on delete set null;

create index if not exists idx_public_quotes_client_id on public_quotes(client_id);

-- Permite que o PDV público crie cliente novo quando necessário.
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='clients' and policyname='anon insert clients pdv'
  ) then
    create policy "anon insert clients pdv" on clients for insert to anon with check (true);
  end if;
end $$;
