# V30 - Financeiro completo, saldo real e relatório geral

## Antes de usar

Rode no Supabase SQL Editor:

```sql
supabase/patch_v30_financeiro_relatorio.sql
```

Esse patch cria os campos necessários para:

- valor já recebido em contas a receber;
- valor já pago em contas a pagar;
- saldo pendente;
- vínculo com cliente;
- vínculo com ordem de serviço;
- exclusão e edição segura dos registros financeiros.

## O que foi alterado

### Dashboard

O painel agora separa:

- faturamento previsto;
- recebido real;
- despesas previstas;
- pago real;
- saldo real;
- falta receber;
- falta pagar;
- meta mensal usando o recebido real.

O saldo real é calculado assim:

```txt
saldo real = recebido real - pago real
```

### Financeiro

Foram adicionados:

- cadastro de contas a receber;
- cadastro de contas a pagar;
- edição de lançamentos;
- exclusão de lançamentos;
- campo de valor já recebido;
- campo de valor já pago;
- vínculo com cliente;
- vínculo com ordem de serviço;
- atualização automática de status conforme pagamento parcial ou total;
- relatório geral em PDF.

### Relatório geral em PDF

No módulo Financeiro, clique em:

```txt
Relatório geral PDF
```

O PDF contém:

- resumo financeiro;
- todas as contas a receber;
- todas as contas a pagar;
- clientes que faltam pagar;
- valor total, valor já pago e valor pendente;
- contas para vencer nos próximos 7 dias.

## Código documentado

Os arquivos principais receberam comentários no formato:

```ts
// Explica o que a função, cálculo ou bloco faz.
```

Arquivos principais alterados:

- `src/pages/Finance.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/Quotes.tsx`
- `supabase/patch_v30_financeiro_relatorio.sql`
- `package.json`

## Build

Build testado com sucesso:

```bash
npm run build
```
