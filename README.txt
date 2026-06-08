PATCH BUILD VERCEL

Substitua:

src/lib/utils.ts
src/pages/Kanban.tsx
src/pages/Users.tsx

Depois rode:

pnpm run build

Se passar:

git add .
git commit -m "corrige exports utils e build"
git push origin main

Na Vercel:
Redeploy com Clear Build Cache.
