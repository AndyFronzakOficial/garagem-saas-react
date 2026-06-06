# Garagem SaaS React + Supabase

Projeto convertido para:

- React
- TypeScript
- Tailwind CSS
- Vite
- Supabase Auth
- Supabase PostgreSQL
- jsPDF

## Instalar

```bash
npm install
```

## Supabase

1. Crie projeto em https://supabase.com
2. Vá em SQL Editor
3. Rode:

```txt
supabase/schema.sql
```

4. Vá em Authentication > Users
5. Crie usuário:

```txt
admin@garagem.com
123456
```

6. Copie `.env.example` para `.env`
7. Preencha:

```txt
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

## Rodar

```bash
npm run dev
```

## Hospedar grátis

- Vercel ou Cloudflare Pages para frontend
- Supabase Free para banco

## Rotas

- `/login`
- `/`
- `/clientes`
- `/leads`
- `/ordens`
- `/precos`
- `/financeiro`
- `/estoque`
- `/entregas`
- `/portal-terceiro`
- `/orcamento-rapido`

## Observação

Esta é uma versão inicial funcional da conversão. Clientes, preços, orçamento público, leads, OS, dashboard e PDF já estão conectados. Financeiro, estoque e entregas têm tabelas prontas e telas base para expansão.
