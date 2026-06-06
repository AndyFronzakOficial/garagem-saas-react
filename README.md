# Garagem SaaS React Supabase v2

Inclui correção do 404 no Vercel com `vercel.json`, portal terceiro com login por empresa/telefone, upload de arquivo, OS, PDF, financeiro, estoque, entregas, metas mensais, filtro de mês e dashboard com produção semanal.

## Depois de substituir os arquivos

Rode no VS Code:

```bash
npm install
npm run build
```

Depois envie para o GitHub:

```bash
git add .
git commit -m "v2 garagem saas completo"
git push
```

## Supabase

Rode novamente no SQL Editor:

```txt
supabase/schema.sql
```

Ele cria/atualiza tabelas, bucket `os-files`, políticas e permissões.

## Vercel

Variáveis:

```txt
VITE_SUPABASE_URL=https://seuprojeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua anon key
```

Não coloque `/rest/v1/`, pelo bem da humanidade.
