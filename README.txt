PATCH - RESTAURAR MÓDULOS

Restaura:

/financeiro
/estoque
/entregas
/kanban

Substitua:

src/pages/Finance.tsx
src/pages/Inventory.tsx
src/pages/Deliveries.tsx
src/pages/Kanban.tsx

Rode no Supabase:

supabase/patch_restaurar_modulos.sql

Depois:

npm run build
git add .
git commit -m "restaura modulos"
git push
