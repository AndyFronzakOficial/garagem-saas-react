  -- PATCH V30 - Financeiro completo, valores pagos, OS vinculada e relatório geral
  -- Rode este arquivo no Supabase SQL Editor antes de usar a nova versão.

  -- 1) Contas a receber: permite controle de valor recebido, pendente e vínculo com OS.
  alter table public.accounts_receivable
    add column if not exists paid_amount numeric(12,2) default 0,
    add column if not exists pending_amount numeric(12,2) default 0,
    add column if not exists service_order_id uuid references public.service_orders(id) on delete set null,
    add column if not exists is_recurring boolean default false,
    add column if not exists is_deleted boolean default false;

  -- 2) Contas a pagar: permite vínculo com cliente, OS e controle de valor já pago.
  alter table public.accounts_payable
    add column if not exists client_id uuid references public.clients(id) on delete set null,
    add column if not exists service_order_id uuid references public.service_orders(id) on delete set null,
    add column if not exists paid_amount numeric(12,2) default 0,
    add column if not exists pending_amount numeric(12,2) default 0,
    add column if not exists is_recurring boolean default false,
    add column if not exists is_deleted boolean default false;

  -- 3) Normaliza registros antigos para não ficarem com pendência nula.
  update public.accounts_receivable
  set
    paid_amount = coalesce(paid_amount, case when status = 'Recebido' then amount else 0 end, 0),
    pending_amount = greatest(coalesce(amount,0) - coalesce(paid_amount, case when status = 'Recebido' then amount else 0 end, 0),0)
  where paid_amount is null or pending_amount is null or pending_amount = 0;

  update public.accounts_payable
  set
    paid_amount = coalesce(paid_amount, case when status = 'Paga' then amount else 0 end, 0),
    pending_amount = greatest(coalesce(amount,0) - coalesce(paid_amount, case when status = 'Paga' then amount else 0 end, 0),0)
  where paid_amount is null or pending_amount is null or pending_amount = 0;

  -- 4) Atualiza status antigos conforme valor pago/recebido e vencimento.
  update public.accounts_receivable
  set status = case
    when coalesce(paid_amount,0) >= coalesce(amount,0) and coalesce(amount,0) > 0 then 'Recebido'
    when due_date < current_date and coalesce(paid_amount,0) < coalesce(amount,0) then 'Vencido'
    else coalesce(status,'Aberto')
  end;

  update public.accounts_payable
  set status = case
    when coalesce(paid_amount,0) >= coalesce(amount,0) and coalesce(amount,0) > 0 then 'Paga'
    when due_date < current_date and coalesce(paid_amount,0) < coalesce(amount,0) then 'Vencida'
    else coalesce(status,'A pagar')
  end;

  -- 5) Índices para melhorar filtros de vencimento, cliente e OS.
  create index if not exists idx_accounts_receivable_due_date on public.accounts_receivable(due_date);
  create index if not exists idx_accounts_receivable_client_id on public.accounts_receivable(client_id);
  create index if not exists idx_accounts_receivable_service_order_id on public.accounts_receivable(service_order_id);
  create index if not exists idx_accounts_payable_due_date on public.accounts_payable(due_date);
  create index if not exists idx_accounts_payable_client_id on public.accounts_payable(client_id);
  create index if not exists idx_accounts_payable_service_order_id on public.accounts_payable(service_order_id);
