Garagem SaaS

Sistema de gestão para oficinas e centros automotivos desenvolvido com React, TypeScript e Supabase.

Tecnologias utilizadas

- React
- TypeScript
- Vite
- Tailwind CSS
- Supabase (Autenticação e Banco de Dados)
- PostgreSQL
- jsPDF

---

Instalação

Clone o projeto e instale as dependências:

npm install

---

Configuração do Supabase

1. Criar um projeto

Acesse o site do Supabase e crie um novo projeto:

https://supabase.com

2. Importar a estrutura do banco

No painel do Supabase, abra o SQL Editor e execute o conteúdo do arquivo:

supabase/schema.sql

3. Criar usuário administrador

Acesse:

Authentication > Users

Crie um usuário para acessar o sistema:

E-mail: admin@garagem.com
Senha: 123456

4. Configurar variáveis de ambiente

Copie o arquivo de exemplo:

cp .env.example .env

Preencha os dados do seu projeto:

VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

Essas informações podem ser encontradas em:

Project Settings > API

---

Executando o projeto

Para iniciar o ambiente de desenvolvimento:

npm run dev

Após iniciar, o sistema ficará disponível no endereço exibido pelo Vite.

---

Estrutura de páginas

O sistema possui as seguintes rotas principais:

Rota| Descrição
"/login"| Tela de acesso
"/"| Dashboard principal
"/clientes"| Cadastro e gerenciamento de clientes
"/leads"| Controle de oportunidades
"/ordens"| Ordens de serviço
"/precos"| Tabela de preços
"/financeiro"| Controle financeiro
"/estoque"| Gestão de estoque
"/entregas"| Controle de entregas
"/portal-terceiro"| Portal de parceiros/terceiros
"/orcamento-rapido"| Geração rápida de orçamentos

---

Hospedagem

O projeto pode ser hospedado gratuitamente utilizando:

Front-end

- Vercel
- Cloudflare Pages

Banco de dados e autenticação

- Supabase (Plano Free)

---

Status do projeto

A versão atual já possui integração funcional com:

- Autenticação
- Dashboard
- Cadastro de clientes
- Leads
- Ordens de serviço
- Tabela de preços
- Orçamento rápido
- Geração de PDF

Os módulos de financeiro, estoque e entregas já contam com estrutura inicial de banco de dados e telas base, podendo ser expandidos conforme a necessidade do negócio.

---

Licença

Projeto desenvolvido para uso interno e comercial. Adapte livremente conforme as necessidades da sua operação.