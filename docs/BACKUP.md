# Guia de Backup e Restauração — Sistema Snack Fácil

Este documento explica detalhadamente como funciona a política de cópia de segurança do banco de dados (PostgreSQL / Supabase) do **Sistema Snack Fácil**, como realizar backups manuais e como restaurar os dados caso necessário.

---

## 🛡️ As 3 Camadas de Proteção

| Camada | Tipo | Onde os arquivos são salvos | Consome espaço no Supabase? |
|---|---|---|:---:|
| **1. Script Local** | Manual via Terminal | Pasta `backups/` no seu computador | ❌ Não |
| **2. Painel Web** | Manual via Navegador | Pasta de `Downloads` da sua máquina | ❌ Não |
| **3. GitHub Actions** | Automático Diário (00:00 BRT) | Artefatos protegidos no repositório GitHub | ❌ Não |

---

## 💻 Camada 1: Execução Manual via Terminal

Ideal para quando você estiver desenvolvendo ou antes de rodar migrações/alterações manuais no banco.

### Como gerar um backup:
Na raiz do projeto, execute no terminal:
```bash
npm run backup
```

**O que o script faz:**
1. Conecta-se com segurança ao banco de dados Supabase via Prisma.
2. Extrai os dados completos de todas as 10 tabelas do sistema.
3. Cria um arquivo com timestamp na pasta:
   ```
   backups/backup_AAAA-MM-DDTHH-MM-SS-sssZ.json
   ```
4. Aplica rotação automática mantendo apenas os **30 backups mais recentes** (removendo backups antigos para não encher o disco da máquina).
5. Exibe no terminal a contagem exata de registros por tabela e o tamanho em KB do arquivo.

### Como restaurar um backup:
Para restaurar um backup específico caso precise recuperar dados:

1. **Se o backup foi baixado pelo navegador (pasta Downloads):**
   - **Opção Direta:** Passe o caminho do arquivo baixado no comando:
     ```bash
     npm run restore -- "C:\Users\fabio\Downloads\backup_snack_facil_2026-11-13.json"
     ```
   - **Opção Organizada:** Mova o arquivo baixado para a pasta `backups/` dentro do projeto e execute:
     ```bash
     npm run restore
     ```
     O script listará os backups disponíveis e mostrará o comando pronto.

2. **Se o backup foi gerado localmente pelo terminal:**
   - Execute para ver a lista:
     ```bash
     npm run restore
     ```
   - Execute passando o arquivo desejado:
     ```bash
     npm run restore -- backups/backup_2026-11-13T14-50-00-000Z.json
     ```

3. O script solicitará que você digite `sim` para confirmar a restauração, garantindo que ninguém sobrescreva dados acidentalmente.

---

## 🌐 Camada 2: Execução e Restauração via Navegador (Painel Administrativo)

Ideal para o dia a dia do operador ou administrador sem precisar abrir o terminal.

### 1. Como Baixar o Backup:
1. Acesse o sistema e faça login com uma conta com perfil **ADMIN**.
2. No menu lateral, clique em **Importar/Exportar**.
3. Na seção superior de cards, localize o card **Backup Completo** (com ícone dourado de disco/escudo).
4. Clique no botão **"Baixar Backup (.json)"**.
5. O sistema irá gerar o snapshot em tempo real e iniciar o download diretamente para a pasta de **Downloads** do seu computador:
   ```
   backup_snack_facil_AAAA-MM-DD.json
   ```
6. O download é registrado automaticamente no log de auditoria (`AuditLog`) para controle de segurança.

### 2. Como Restaurar o Backup pelo Navegador:
1. No mesmo card **Backup Completo**, clique no botão **"Restaurar Backup (.json)"**.
2. Selecione o arquivo `.json` de backup salvo no seu computador.
3. O sistema abrirá uma janela com a **Pré-Visualização e Confirmação de Segurança**:
   - Exibe o nome do arquivo, a data em que o backup foi gerado e a quantidade de registros em cada tabela (lançamentos, produtos, categorias, etc.).
   - Exibe o alerta em vermelho sobre a substituição dos dados.
4. Para destravar o botão de confirmação, digite a palavra **`RESTAURAR`** no campo de texto.
5. Clique em **"Confirmar Restauração Completa"**.
6. O sistema substituirá todos os registros de forma ordenada e registrará a ação de restauração no log de auditoria.

---

## ⏰ Camada 3: Automação Diária (GitHub Actions)

Configurada em [`.github/workflows/backup-database.yml`](../.github/workflows/backup-database.yml).

### Funcionamento:
- **Horário:** Todos os dias às **00:00 (horário de Brasília)** (03:00 UTC).
- **Disparo manual:** Pode ser executado sob demanda acessando a aba **Actions** no GitHub e clicando em **Run workflow**.
- **Ferramenta:** Utiliza o `pg_dump` oficial do PostgreSQL para gerar dois arquivos:
  - Arquivo binário comprimido (`.dump`) com schema e dados completos.
  - Arquivo SQL legível (`.sql`) com comandos `INSERT` prontos.
- **Armazenamento:** Salvo como **GitHub Artifact** com retenção de **90 dias**.
- **Configuração no GitHub necessária:**
  1. No seu repositório no GitHub, acesse: `Settings` > `Secrets and variables` > `Actions`.
  2. Adicione um novo secret chamado: `SUPABASE_DIRECT_URL`.
  3. Cole o valor da conexão direta do banco (porta 5432, que está no seu `.env` como `POSTGRES_URL_NON_POOLING` ou `DIRECT_URL`).

---

## 📁 Onde os arquivos ficam guardados

- **Backups Locais do Terminal:** salvos dentro do projeto na pasta `backups/` (essa pasta está adicionada no `.gitignore` e nunca é enviada ao repositório por questões de privacidade e segurança).
- **Backups pelo Navegador:** salvos na pasta padrão de `Downloads` do seu sistema operacional.
- **Backups Automáticos:** ficam na nuvem do **GitHub** (aba *Actions* > clique na execução do dia > baixe a seção *Artifacts*).

> ⚠️ **Atenção:** Nenhum arquivo de backup é guardado dentro do Supabase, preservando o limite de armazenamento do plano gratuito (Free Tier).

