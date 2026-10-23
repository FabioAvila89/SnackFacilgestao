# Sistema Snack Fácil — Controle Financeiro

Sistema web de uso interno de controle financeiro sob medida para a **Snack Fácil**, operadora de máquinas de vending (venda automática de snacks e bebidas) no Brasil.

O sistema substitui com precisão planilhas manuais e genéricas de Excel, garantindo integridade matemática, DRE automático em regime de caixa, análise de entradas e saídas e controle de despesas por categoria com drill-down.

---

## 🚀 Tecnologias Utilizadas

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router) + TypeScript
- **Estilização**: Tailwind CSS com design responsivo (otimizado para celular e desktop)
- **Banco de Dados**: SQLite (em desenvolvimento local) e compatível com PostgreSQL para produção
- **ORM**: [Prisma](https://www.prisma.io/)
- **Gráficos**: [Recharts](https://recharts.org/)
- **Importação/Exportação**: `exceljs` e `papaparse`
- **Autenticação**: Sessão segura em cookie `httpOnly` assinado via JWT (`jose`), senhas com hash `bcryptjs`
- **Validação**: [Zod](https://zod.dev/)
- **Testes**: [Vitest](https://vitest.dev/)

---

## ⚙️ Regras de Negócio Críticas Implementadas

1. **Moeda em Centavos**: Todos os valores monetários são estritamente armazenados no banco como **inteiros em centavos** (`amountCents`). Nunca usamos `float` para dinheiro, garantindo zero erro de arredondamento.
2. **Formatação Brasileira**: Padrão pt-BR com separador de milhar ponto e decimal vírgula (`R$ 1.234,56`), datas em `dd/mm/aaaa` e fuso horário `America/Sao_Paulo`.
3. **Consistência de Tipos**: O `kind` de um lançamento (`INCOME` ou `EXPENSE`) deve obrigatoriamente ser idêntico ao `kind` da categoria associada.
4. **Preservação de Histórico**: Contas ou categorias que já possuem lançamentos vinculados **não podem ser excluídas fisicamente**, apenas **desativadas** (deixam de aparecer para novos lançamentos, mas permanecem nos relatórios passados).
5. **DRE em Regime de Caixa**:
   - `RECEITA_BRUTA` (Entrada)
   - `(-) DEDUCOES` (Taxas de cartão, tributos sobre vendas)
   - `(=) Receita Líquida`
   - `(-) CMV` (Custo das mercadorias compradas no período)
   - `(=) Lucro Bruto` (com margem % sobre a receita líquida)
   - `(-) DESPESAS_OPERACIONAIS` (Ocupação, telemetria, combustível, pró-labore, manutenção)
   - `(=) Resultado Operacional`
   - `(+) RECEITAS_FINANCEIRAS`
   - `(-) DESPESAS_FINANCEIRAS`
   - `(=) Resultado antes dos impostos`
   - `(-) IMPOSTOS_LUCRO` (IRPJ/CSLL)
   - `(=) Resultado Líquido` (com margem % sobre a receita líquida)
   - `FORA_DRE`: Investimentos de capital (compra de novas máquinas) são apresentados em seção separada sem distorcer o resultado líquido.
   - Tratamento de divisão por zero (retorna `—` em vez de `NaN` ou `Infinity`).

---

## 📋 Pré-requisitos

- **Node.js** v18+ (testado no Node.js v24)
- **npm** v9+

---

## 🛠️ Passo a Passo para Rodar Localmente

### 1. Clonar ou Acessar a Pasta do Projeto
```bash
cd "sistema Snack Facil"
```

### 2. Configurar as Variáveis de Ambiente
Copie o arquivo `.env.example` para `.env`:
```bash
cp .env.example .env
```
*(No Windows PowerShell: `Copy-Item .env.example .env`)*

Variáveis no `.env`:
```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="gere-um-segredo-longo-e-aleatorio-para-producao-2026"
ADMIN_EMAIL="seu-email-admin@suaempresa.com.br"
ADMIN_PASSWORD="SuaSenhaSeguraMin10Chars!"
ADMIN_NAME="Nome do Administrador"
```

### 3. Instalar Dependências
```bash
npm install
```

### 4. Inicializar o Banco e Executar o Seed
Gera o cliente Prisma, cria a base SQLite `dev.db` e cadastra o usuário admin, as contas e o plano de categorias:
```bash
npx prisma db push
node prisma/seed.js
```

> 💡 **Dica (Dados de Demonstração)**: Para carregar lançamentos fictícios dos últimos meses e já ver os gráficos cheios, execute:
> ```bash
> npm run prisma:seed:demo
> ```

### 5. Iniciar o Servidor de Desenvolvimento
```bash
npm run dev
```
### 6. Acesso Inicial e Troca de Senha Obrigatória
- Faça login com o e-mail e a senha definidos no seu `.env` (`ADMIN_EMAIL` e `ADMIN_PASSWORD`).
- **Primeiro Acesso**: O sistema força a definição imediata de uma nova senha pessoal (mínimo 10 caracteres) antes de liberar o acesso às funcionalidades.

### 7. Cadastrar o Sócio da Empresa
1. Como **ADMIN**, acesse o menu lateral **Gestão de Acesso** (ou no menu superior no mobile).
2. Clique no botão **"+ Cadastrar Novo Usuário"**.
3. Preencha o nome e o e-mail do sócio. O perfil virá preenchido como **ADMIN** por padrão (podendo ser ajustado para EDITOR ou VIEWER se desejado).
4. O sistema gerará automaticamente uma **senha temporária aleatória e segura** exibida **uma única vez** com o botão "Copiar".
5. Copie a senha e envie-a com segurança ao sócio.
6. Ao realizar o primeiro login com essa senha temporária, o sócio será automaticamente direcionado para cadastrar sua própria senha definitiva pessoal.

---

## 🔒 Segurança, Controle de Acesso e Perfis (RBAC)

O sistema conta com matriz centralizada de permissões (`src/lib/permissions.ts`) verificada rigorosamente no servidor em todas as requisições:

| Perfil | Descrição | Lançamentos | Categorias e Contas | Importar / Exportar | Gestão de Acesso & Auditoria |
|---|---|:---:|:---:|:---:|:---:|
| **ADMIN** (Administrador) | Acesso irrestrito a todos os dados e configurações da empresa | Criar, Editar, Excluir | Criar, Editar, Desativar | Importar e Exportar | Acesso total |
| **EDITOR** (Operador) | Operação financeira diária, relatórios e DRE | Criar, Editar, Excluir | Apenas Visualização | Importar e Exportar | Sem acesso |
| **VIEWER** (Consulta) | Visualização gerencial e auditoria de relatórios e DRE | Apenas Visualização | Apenas Visualização | Apenas Exportar | Sem acesso |

### Regras de Segurança Implementadas:
- **Proteção contra Força Bruta**: Bloqueio temporário de 15 minutos após 5 tentativas de senha incorretas consecutivas. Mensagens genéricas de erro ("E-mail ou senha inválidos") para mitigar enumeração de contas.
- **Invalidação Imediata de Sessões**: Ao desativar um usuário, alterar seu perfil ou redefinir sua senha, o campo `sessionVersion` é incrementado no banco, derrubando imediatamente todas as sessões abertas daquele usuário.
- **Proteção do Administrador**: O sistema bloqueia a desativação ou o rebaixamento do último administrador ativo da empresa e impede que um administrador desative a si próprio.
- **Preservação de Histórico e Auditoria**: Usuários não são excluídos fisicamente (apenas desativados), garantindo a integridade dos registros de autoria ("Lançado por" e "Última alteração por").
- **Cookies Seguros**: Cookies assinados (`httpOnly`, `SameSite: Lax`, flag `secure` ativa automaticamente em produção sob HTTPS).

---

## 💾 Backup do Banco de Dados e Migração Segura

Antes de realizar qualquer atualização ou migração de versão, faça sempre uma cópia de segurança dos dados:

### 1. Como Fazer Backup (Ambiente SQLite)
Certifique-se de salvar uma cópia do arquivo `dev.db` localizado na pasta `prisma/`:
```bash
# Windows PowerShell:
Copy-Item prisma/dev.db prisma/dev.db.backup-$(Get-Date -Format "yyyyMMdd-HHmmss")

# Linux / macOS:
cp prisma/dev.db prisma/dev.db.backup-$(date +%Y%m%d_%H%M%S)
```

*(Em produção com PostgreSQL, utilize o comando `pg_dump seu_banco > backup.sql`)*

### 2. Executar a Migração e Atualização de Autoria
Após atualizar o código ou o esquema do Prisma:
```bash
npx prisma db push
node prisma/seed.js
```
O script `prisma/seed.js` executa uma rotina automática e segura que vincula lançamentos históricos existentes sem autor diretamente ao administrador principal da organização, garantindo continuidade sem perda de dados.

---

## 🧪 Como Rodar os Testes Automatizados

O sistema inclui testes automatizados com Vitest cobrindo:
- Cálculo de saldo de conta
- Agregação mensal com meses vazios preenchidos com zero
- Despesas por categoria e percentuais
- Todas as linhas e margens do DRE, itens FORA_DRE e divisão por zero
- Validação e parsing de importações CSV/XLSX
- Formatação de datas e moeda brasileira

Para executar a suíte de testes:
```bash
npm test
```

---

## 📱 Funcionalidades do Sistema

### 1. Dashboard (Visão Geral)
- Seletor de mês dinâmico.
- Cards: Saldo total atual de todas as contas, Entradas do mês, Saídas do mês e Resultado do mês.
- Gráfico de barras de Entradas × Saídas dos últimos 12 meses.
- Top 5 maiores categorias de gasto do mês com percentuais e barra de progresso.
- Botão de atalho rápido para "+ Novo Lançamento".

### 2. Lançamentos
- Tabela paginada ordenada por data decrescente.
- Filtros por: busca textual na descrição, tipo (Entrada/Saída), conta, categoria/subcategoria e intervalo de datas.
- Totais em tempo real do filtro aplicado (entradas, saídas e resultado).
- Modal responsivo com teclado numérico amigável para celular.
- Exclusão com modal de confirmação.
- Exportação dos lançamentos filtrados para `.xlsx`.

### 3. Relatório Entradas × Saídas (Fluxo de Caixa)
- Filtro por mês, trimestre, ano ou período livre.
- Gráfico composto de barras (entradas e saídas) com linha de tendência do saldo acumulado.
- Tabela mês a mês com linha de total do período.

### 4. Relatório de Gastos por Categoria
- Gráfico Donut com participação percentual de cada categoria.
- Gráfico de ranking horizontal.
- Tabela com drill-down: clique na categoria para ver as subcategorias e todos os lançamentos individuais associados.
- Alternância rápida entre "Saídas" e "Receitas".

### 5. DRE (Demonstração do Resultado do Exercício)
- Comparativo automático com o período anterior de mesmo tamanho.
- Análise vertical (margem % sobre a receita líquida).
- Variação nominal em R$ e variação percentual.
- Expansão de categorias e lançamentos em cada linha do DRE.
- Seção separada de investimentos (`FORA_DRE`).
- Exportação do DRE formatado para `.xlsx`.

### 6. Cadastro de Contas
- Visualização de saldos atuais e iniciais.
- Criação e edição de contas bancárias, caixas e cartões.
- Proteção de histórico: desativação automática se possuir lançamentos.

### 7. Plano de Categorias
- Árvore de 2 níveis (categorias principais e subcategorias).
- Vinculação direta da categoria de nível 1 a uma linha do DRE.
- Herança automática de tipo e linha do DRE para subcategorias.

### 8. Importar / Exportar
- Download da planilha modelo oficial `.xlsx`.
- Upload de arquivos `.csv` e `.xlsx`.
- Pré-visualização com validação destacada (linhas válidas e inválidas com o motivo do erro).
- Opção de importar apenas as válidas ou cancelar tudo se houver erro.
- Exportação de lançamentos e DRE para Excel.

---

## ☁️ Guia de Publicação e Produção (Supabase + VPS / Cloud)

O sistema utiliza PostgreSQL gerenciado no **Supabase** com Prisma ORM e Row Level Security (RLS) ativo em todas as tabelas.

### 1. Variáveis de Ambiente Necessárias em Produção
No servidor de produção (ou painel da VPS), configure as seguintes variáveis no arquivo `.env` (ou variáveis de sistema):

```env
# Banco de Dados (Supabase PostgreSQL)
# DATABASE_URL: Pooler Supavisor em modo TRANSACTION (porta 6543) para a aplicação
DATABASE_URL="postgresql://postgres.[PROJECT_REF]:[SENHA]@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require"

# DIRECT_URL: Pooler em modo SESSION (porta 5432) ou conexão direta, usado para migrações
DIRECT_URL="postgresql://postgres.[PROJECT_REF]:[SENHA]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres?sslmode=require"

# Autenticação
JWT_SECRET="string-aleatoria-longa-e-segura-minimo-32-caracteres"

# Aplicação e Fuso Horário
NEXT_PUBLIC_APP_NAME="Snack Fácil"
TZ="America/Sao_Paulo"
```

> ⚠️ **Atenção a IPv6**: A conexão direta do Supabase (`db.[PROJECT_REF].supabase.co`) frequentemente só opera em IPv6. Se a sua VPS não tiver conectividade IPv6 nativa habilitada, utilize obrigatoriamente o host do pooler na porta `5432` tanto para o `DIRECT_URL` quanto para o `DATABASE_URL` (na porta `6543`), pois o pooler possui resolução IPv4 estável.

---

### 2. Executar Migrações em Produção
Em produção, **NUNCA** execute `prisma migrate dev` nem `prisma migrate reset` (eles são destrutivos). Execute estritamente:

```bash
npx prisma migrate deploy
```
Esse comando aplica as migrações versionadas pendentes (`prisma/migrations/`) utilizando a conexão segura `DIRECT_URL`.

---

### 3. Publicação em VPS (Node.js + PM2 + Nginx)

#### A. Pré-requisitos na VPS
- Ubuntu 22.04 LTS ou 24.04 LTS
- Node.js 20 LTS ou 22 LTS
- Nginx e Certbot (Let's Encrypt para HTTPS gratuito)
- PM2 (`npm install -g pm2`)

#### B. Instalação e Build
```bash
# 1. Clonar o repositório
git clone <url-do-repositorio> /var/www/snack-facil
cd /var/www/snack-facil

# 2. Configurar o .env de produção
cp .env.example .env
nano .env # Insira as credenciais do Supabase e o JWT_SECRET

# 3. Instalar dependências e compilar
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build

# 4. Iniciar com PM2
pm2 start npm --name "snack-facil" -- start
pm2 save
pm2 startup
```

#### C. Proxy Reverso Nginx (com SSL)
Exemplo de bloco de configuração do Nginx (`/etc/nginx/sites-available/snack-facil`):
```nginx
server {
    server_name financeiro.suaempresa.com.br;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
Ative o certificado SSL com:
```bash
sudo certbot --nginx -d financeiro.suaempresa.com.br
```

---

### 4. Observações sobre Publicação no Firebase
- O **Firebase Hosting tradicional** serve apenas páginas estáticas (HTML/CSS/JS compilados).
- Como este sistema é uma aplicação full-stack Next.js com rotas API, middleware dinâmico e banco de dados, sua hospedagem no Firebase requer o **Firebase App Hosting** (ou Cloud Run com contêiner Node.js), que suporta computação no lado do servidor.
- Para uma gestão mais simples e com menor atrito em Next.js, uma **VPS com PM2/Nginx** ou plataformas como **Vercel** / **Railway** são recomendadas.

---

### 5. Rotina de Backup e Restauração do Banco de Dados

#### A. Gerar Backup Manual via `pg_dump`
Utilize a string `DIRECT_URL` (conexão direta/porta 5432):
```bash
pg_dump "postgresql://postgres.[PROJECT_REF]:[SENHA]@aws-0-sa-east-1.pooler.supabase.com:5432/postgres?sslmode=require" -Fc -f backup_snackfacil_$(date +%Y%m%d_%H%M%S).dump
```

#### B. Sugestão de Rotina Automatizada (Cron Diário)
Na VPS, você pode configurar um agendamento no `crontab` para gerar cópias diárias e reter os últimos 30 dias:
```bash
0 3 * * * pg_dump "DIRECT_URL" -Fc -f /backups/snack_$(date +\%F).dump && find /backups -name "snack_*.dump" -mtime +30 -delete
```

#### C. Alertas Importantes sobre o Supabase
- **Pausa por Inatividade (Plano Gratuito)**: Projetos gratuitos no Supabase são automaticamente pausados após 7 dias de inatividade de requisições. Para um sistema financeiro em produção contínua, recomenda-se manter o projeto ativo ou considerar o plano Pro.
- **Restauração Pontual (Point-in-Time Recovery - PITR)**: O plano gratuito não inclui PITR. Portanto, backups externos rotineiros (`pg_dump`) são indispensáveis para garantir a salvaguarda dos dados financeiros da empresa.

---

## 🔮 Preparação para o Futuro (Arquitetura)

O sistema foi desenhado de forma extensível:
- Entidade `Organization` já presente no banco para suporte multi-sócio / multi-empresa.
- Lógica financeira completamente isolada em `src/lib/finance-engine.ts`, desacoplada de telas e bibliotecas visuais.
- Módulo de importação reutilizável em `src/lib/importer.ts`.
- Esquema pronto para adição futura de:
  - Vendas por máquina / ponto (`machineId`, `locationId`)
  - Contas a pagar/receber com vencimento e baixa (`dueDate`, `status`)
  - Controle de estoque e reposições.
