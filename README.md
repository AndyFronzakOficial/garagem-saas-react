# Bazar Eletrônicos ERP — V19 Ordens de Serviço

Versão criada sobre a **V18 corrigida com caixa, cupom e menu recolhível**.

## Novidades

- Nova tela **Ordens de Serviço**.
- Cadastro com nome, Instagram, WhatsApp e data.
- Seleção de produtos cadastrados com preço unitário automático.
- Quantidade, valor unitário e total por item.
- PDF A4 profissional inspirado no modelo enviado.
- Dados PIX no PDF:
  - Chave: `41-98464-8144`
  - Titular: `Abquella Carmo de Lima`
  - Banco: `Banco Itaú`
- Histórico organizado em tabela.
- Controle de pago/pendente.
- Controle de entregue/não entregue.
- Integração automática com o financeiro.
- Ordens pagas entram como receita.
- Ordens pendentes entram em contas a receber.
- Dashboard mostra ordens do mês e valor a receber.
- Botão para abrir conversa no WhatsApp da cliente.
- Botão para gerar novamente o PDF.

## Supabase

No SQL Editor, execute:

```txt
supabase/v19_ordens_servico_migration.sql
```

O mesmo conteúdo também está em `supabase/schema.sql`.

## Instalação

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

A pasta `dist` será criada automaticamente.

## Vercel

O projeto inclui `vercel.json` para forçar:

- instalação com npm;
- build com `npm run build`;
- saída em `dist`.

Configure as variáveis:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```


## V20 — Histórico Completo do Cliente

Incluído:

- Nova tela "Histórico Cliente"
- Todas as compras do cliente
- Itens comprados
- Ordens de serviço vinculadas
- Produtos reservados
- Fiado / contas a receber
- Pagamentos
- Trocas e devoluções
- Garantias
- Total gasto
- Última compra
- Botão direto para WhatsApp

Antes de usar, rode no Supabase:

```txt
supabase/v20_historico_cliente_migration.sql
```

## V21 — Ordem de Serviço Completa

Incluído:
- Número automático da OS
- Data e hora da entrada
- Cliente
- Aparelho
- Defeito relatado pelo cliente
- Condição visual do aparelho
- Serviço solicitado
- Técnico responsável
- Prioridade
- Prazo estimado
- Valor estimado
- Valor final
- Entrada paga
- Saldo restante
- Forma de pagamento
- Status do serviço
- Observações internas
- Termos da assistência
- Assinatura do cliente
- Fotos anexadas
- PDF profissional
- Envio pelo WhatsApp
- Consultar, alterar e excluir OS
- Sincronização com financeiro

Antes de usar, rode no Supabase:

```txt
supabase/v21_ordem_servico_completa_migration.sql
```
