# Garagem SaaS React Supabase V5 Completo

Esta versão inclui:

- Logo real no login, menu, portal e orçamento público
- PDF profissional com logo real
- Configurações da empresa
- Cadastro manual de OS no admin
- Upload de arquivo pelo admin
- Upload de arquivo pelo terceiro
- Converter lead em cliente + OS
- Usuários/perfis por função
- Permissões visuais por perfil
- Kanban premium
- Preços com editar, ativar/desativar e excluir
- Dashboard com metas e filtro mensal
- Financeiro completo
- Estoque
- Entregas
- Portal terceiro com rastreamento

## Arquivos importantes

- public/logo.png
- src/pages/Settings.tsx
- src/pages/Users.tsx
- src/pages/Orders.tsx
- src/pages/Leads.tsx
- src/components/Layout.tsx
- src/pages/Login.tsx
- src/App.tsx
- supabase/patch_v5_completo.sql

## Passo obrigatório

No Supabase, rode:

supabase/patch_v5_completo.sql

## Deploy

npm install
npm run build
git add .
git commit -m "v5 garagem saas completo"
git push

## Usuários

Crie o login real em:
Supabase > Authentication > Users

Depois cadastre o perfil em:
ERP > Usuários

Perfis disponíveis:
- Administrador
- Financeiro
- Produção
- Vendas
- Funcionário
