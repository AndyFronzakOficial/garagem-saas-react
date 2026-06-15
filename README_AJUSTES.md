# Garagem SaaS - Versão ajustes solicitados

Inclui:

- Perfil Orçamento
- Orçamento não vê Financeiro, Estoque e Preços por m²
- Tela Usuários e Perfis
- Configurações com meta, nome, logo e notificações
- Preço por m² com alterar, remover, ativar/desativar
- Portal e orçamento público usando centímetros
- Conversão automática cm para m²
- Orçamento público/terceiro entra como status Orçamento
- Removida escolha de acabamento nos formulários públicos/terceiro
- Senha padrão visual no login: garagem@2026
- App.tsx com rotas corretas

## Supabase

Rode:

supabase/patch_ajustes_usuarios_cm_config.sql

## Senha admin

O Supabase não altera senha por SQL comum.
No painel:

Authentication > Users > admin@garagem.com > Reset password

Nova senha: garagem@2026

## Build

npm install --legacy-peer-deps
npm run build
