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

  // 1. PRESERVAÇÃO DE SENHAS: Lê usuários atuais antes de limpar
  const currentUsers = await prisma.user.findMany({
    select: { email: true, passwordHash: true, mustChangePassword: true },
  });
  const existingPasswordMap = new Map();
  for (const u of currentUsers) {
    if (u.email && u.passwordHash) {
      existingPasswordMap.set(u.email.toLowerCase().trim(), {
        hash: u.passwordHash,
        mustChange: !!u.mustChangePassword,
      });
    }
  }

  // 2. Prepara usuários do backup
  const fallbackPassword = process.env.ADMIN_PASSWORD || "AdminSnack2026!";
  let fallbackHash = null;
  const usersToInsert = [];

  for (const row of data.users || []) {
    const userData = parseDates(row);
    const emailKey = (userData.email || "").toLowerCase().trim();
    const existing = existingPasswordMap.get(emailKey);

    if (userData.passwordHash) {
      // Usa a senha do backup
    } else if (existing) {
      // PRESERVA A SENHA ATUAL QUE O USUÁRIO JÁ TEM NO BANCO!
      userData.passwordHash = existing.hash;
      userData.mustChangePassword = existing.mustChange;
    } else {
      // Usuário novo e sem senha
      if (!fallbackHash) fallbackHash = await bcrypt.hash(fallbackPassword, 10);
      userData.passwordHash = fallbackHash;
      userData.mustChangePassword = true;
    }
    usersToInsert.push(userData);
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

  console.log("📥 Inserindo dados do backup em lote (alta performance)...\n");

  // 1. Organizations
  if (data.organizations?.length > 0) {
    await prisma.organization.createMany({ data: data.organizations.map(parseDates) });
  }
  console.log(`   ✅ Organizations: ${(data.organizations || []).length}`);

  // 2. Users (com senhas preservadas)
  if (usersToInsert.length > 0) {
    await prisma.user.createMany({ data: usersToInsert });
  }
  console.log(`   ✅ Users: ${usersToInsert.length} (senhas preservadas)`);

  // 3. Accounts
  if (data.accounts?.length > 0) {
    await prisma.account.createMany({ data: data.accounts.map(parseDates) });
  }
  console.log(`   ✅ Accounts: ${(data.accounts || []).length}`);

  // 4. Categories (pais primeiro, depois filhas)
  const allCategories = (data.categories || []).map(parseDates);
  const parents = allCategories.filter((c) => !c.parentId);
  const children = allCategories.filter((c) => c.parentId);

  if (parents.length > 0) {
    await prisma.category.createMany({ data: parents });
  }
  if (children.length > 0) {
    await prisma.category.createMany({ data: children });
  }
  console.log(`   ✅ Categories: ${allCategories.length}`);

  // 5. Suppliers
  if (data.suppliers?.length > 0) {
    await prisma.supplier.createMany({ data: data.suppliers.map(parseDates) });
  }
  console.log(`   ✅ Suppliers: ${(data.suppliers || []).length}`);

  // 6. Machines
  if (data.machines?.length > 0) {
    await prisma.machine.createMany({ data: data.machines.map(parseDates) });
  }
  console.log(`   ✅ Machines: ${(data.machines || []).length}`);

  // 7. Products
  if (data.products?.length > 0) {
    await prisma.product.createMany({ data: data.products.map(parseDates) });
  }
  console.log(`   ✅ Products: ${(data.products || []).length}`);

  // 8. Transactions
  if (data.transactions?.length > 0) {
    await prisma.transaction.createMany({ data: data.transactions.map(parseDates) });
  }
  console.log(`   ✅ Transactions: ${(data.transactions || []).length}`);

  // 9. Stock Movements
  if (data.stockMovements?.length > 0) {
    await prisma.stockMovement.createMany({ data: data.stockMovements.map(parseDates) });
  }
  console.log(`   ✅ StockMovements: ${(data.stockMovements || []).length}`);

  // 10. Audit Logs
  if (data.auditLogs?.length > 0) {
    await prisma.auditLog.createMany({ data: data.auditLogs.map(parseDates) });
  }
  console.log(`   ✅ AuditLogs: ${(data.auditLogs || []).length}`);

  console.log("\n✅ Restauração concluída com sucesso em alta velocidade!\n");
}

restore(process.argv[2])
  .catch((e) => {
    console.error("❌ Erro na restauração:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
