GARAGEM SAAS - VERSÃO FINAL CORRIGIDA

Build testado com:
npm install --legacy-peer-deps
npm run build

Rotas corrigidas:
/dashboard
/clientes
/leads
/ordens
/precos
/financeiro
/estoque
/entregas
/kanban
/portal-terceiro
/orcamento-rapido

Importante:
1. Suba estes arquivos para o GitHub.
2. Na Vercel use:
   Install Command: npm install --legacy-peer-deps
   Build Command: npm run build
   Output Directory: dist
3. Rode no Supabase:
   supabase/garagem_saas_tudo_corrigido.sql

Google Drive:
No .env coloque:
VITE_GOOGLE_CLIENT_ID=SEU_CLIENT_ID.apps.googleusercontent.com
VITE_GOOGLE_DRIVE_ROOT_FOLDER=Garagem SaaS
