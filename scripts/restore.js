const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

function askConfirmation(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function restore(backupPath) {
  if (!backupPath) {
    // Se nenhum caminho foi passado, lista os backups disponíveis
    const backupDir = path.join(process.cwd(), "backups");
    if (fs.existsSync(backupDir)) {
      const files = fs
        .readdirSync(backupDir)
        .filter((f) => f.startsWith("backup_") && f.endsWith(".json"))
        .sort()
        .reverse();

      if (files.length > 0) {
        console.log("\n📁 Backups disponíveis:\n");
        files.forEach((f, i) => {
          const stats = fs.statSync(path.join(backupDir, f));
          const sizeKB = (stats.size / 1024).toFixed(1);
          console.log(`   ${i + 1}. ${f}  (${sizeKB} KB)`);
        });
        console.log(`\n💡 Uso: npm run restore -- backups/${files[0]}\n`);
      } else {
        console.log("❌ Nenhum backup encontrado na pasta backups/");
      }
    } else {
      console.log("❌ Pasta backups/ não encontrada. Execute 'npm run backup' primeiro.");
    }
    process.exit(0);
  }

  const fullPath = path.resolve(backupPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Arquivo não encontrado: ${fullPath}`);
    process.exit(1);
  }

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
  } catch (e) {
    console.error(`❌ Erro ao ler arquivo JSON: ${e.message}`);
    process.exit(1);
  }

  const { metadata, data } = raw;

  if (!metadata || !data) {
    console.error("❌ Formato de backup inválido. O arquivo deve conter 'metadata' e 'data'.");
    process.exit(1);
  }

  const totalRecords = Object.values(metadata.tables).reduce((a, b) => a + b, 0);

  console.log("\n🔄 Restauração de Backup — Snack Fácil");
  console.log("═══════════════════════════════════════════");
  console.log(`📅 Backup criado em: ${metadata.createdAt}`);
  console.log(`📊 Total de registros: ${totalRecords}`);
  console.log(`🏷️  Versão: ${metadata.version}`);
  console.log("\n📋 Conteúdo:");
  for (const [table, count] of Object.entries(metadata.tables)) {
    console.log(`   ${table}: ${count} registros`);
  }

  console.log("\n⚠️  ATENÇÃO: Isso vai SUBSTITUIR todos os dados atuais do banco!");
  console.log("   Esta operação é IRREVERSÍVEL.\n");

  const answer = await askConfirmation("   Deseja continuar? (digite 'sim' para confirmar): ");
  if (answer !== "sim") {
    console.log("\n❌ Restauração cancelada pelo usuário.\n");
    process.exit(0);
  }

  console.log("\n🗑️  Limpando dados atuais...");

  // Ordem de deleção respeitando foreign keys
  await prisma.$transaction([
    prisma.stockMovement.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.transaction.deleteMany(),
    prisma.product.deleteMany(),
    prisma.machine.deleteMany(),
    prisma.supplier.deleteMany(),
    prisma.category.deleteMany(),
    prisma.account.deleteMany(),
    prisma.user.deleteMany(),
    prisma.organization.deleteMany(),
  ]);

  console.log("📥 Inserindo dados do backup...\n");

  // Helpers para converter datas de string para Date
  const parseDates = (obj) => {
    const result = { ...obj };
    for (const key of Object.keys(result)) {
      if (
        result[key] &&
        typeof result[key] === "string" &&
        /^\d{4}-\d{2}-\d{2}T/.test(result[key])
      ) {
        result[key] = new Date(result[key]);
      }
    }
    return result;
  };

  // 1. Organizations
  for (const row of data.organizations || []) {
    await prisma.organization.create({ data: parseDates(row) });
  }
  console.log(`   ✅ Organizations: ${(data.organizations || []).length}`);

  // 2. Users
  for (const row of data.users || []) {
    const userData = parseDates(row);
    // Caso o backup tenha sido feito sem hash de senha, aplica uma temporária e exige troca
    if (!userData.passwordHash) {
      const tempPass = process.env.ADMIN_PASSWORD || "SnackFacil2026!";
      userData.passwordHash = await bcrypt.hash(tempPass, 10);
      userData.mustChangePassword = true;
    }
    await prisma.user.create({ data: userData });
  }
  console.log(`   ✅ Users: ${(data.users || []).length}`);

  // 3. Accounts
  for (const row of data.accounts || []) {
    await prisma.account.create({ data: parseDates(row) });
  }
  console.log(`   ✅ Accounts: ${(data.accounts || []).length}`);

  // 4. Categories (pais primeiro, depois filhas — respeita hierarquia)
  const allCategories = data.categories || [];
  const parents = allCategories.filter((c) => !c.parentId);
  const children = allCategories.filter((c) => c.parentId);
  for (const row of parents) {
    await prisma.category.create({ data: parseDates(row) });
  }
  for (const row of children) {
    await prisma.category.create({ data: parseDates(row) });
  }
  console.log(`   ✅ Categories: ${allCategories.length}`);

  // 5. Suppliers
  for (const row of data.suppliers || []) {
    await prisma.supplier.create({ data: parseDates(row) });
  }
  console.log(`   ✅ Suppliers: ${(data.suppliers || []).length}`);

  // 6. Machines
  for (const row of data.machines || []) {
    await prisma.machine.create({ data: parseDates(row) });
  }
  console.log(`   ✅ Machines: ${(data.machines || []).length}`);

  // 7. Products
  for (const row of data.products || []) {
    await prisma.product.create({ data: parseDates(row) });
  }
  console.log(`   ✅ Products: ${(data.products || []).length}`);

  // 8. Transactions
  for (const row of data.transactions || []) {
    await prisma.transaction.create({ data: parseDates(row) });
  }
  console.log(`   ✅ Transactions: ${(data.transactions || []).length}`);

  // 9. Stock Movements
  for (const row of data.stockMovements || []) {
    await prisma.stockMovement.create({ data: parseDates(row) });
  }
  console.log(`   ✅ StockMovements: ${(data.stockMovements || []).length}`);

  // 10. Audit Logs
  for (const row of data.auditLogs || []) {
    await prisma.auditLog.create({ data: parseDates(row) });
  }
  console.log(`   ✅ AuditLogs: ${(data.auditLogs || []).length}`);

  console.log("\n✅ Restauração concluída com sucesso!\n");
}

restore(process.argv[2])
  .catch((e) => {
    console.error("❌ Erro na restauração:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

