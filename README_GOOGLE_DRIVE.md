# Garagem SaaS - Upload Google Drive

Esta versão prepara upload de arquivos grandes para Google Drive.

## Importante

Não é API Key. Para upload no Drive precisa de OAuth Client ID.

## Google Cloud

1. Acesse Google Cloud Console
2. Crie um projeto
3. Ative Google Drive API
4. Crie OAuth Client ID
5. Tipo: Web application
6. Authorized JavaScript origins:
   - http://localhost:5173
   - https://SEU-PROJETO.vercel.app

## .env

Adicione:

VITE_GOOGLE_CLIENT_ID=SEU_CLIENT_ID.apps.googleusercontent.com
VITE_GOOGLE_DRIVE_ROOT_FOLDER=Garagem SaaS

## Supabase

Rode:

supabase/patch_v62_drive.sql

## Rodar

npm install
npm run dev

## Deploy

npm run build
git add .
git commit -m "google drive upload"
git push

## Como funciona

Portal terceiro/admin envia arquivo para:
Google Drive > Garagem SaaS > Cliente > OS

O link fica salvo em print_file_url.
