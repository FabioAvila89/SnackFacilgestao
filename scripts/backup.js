const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

const prisma = new PrismaClient();

async function createBackup() {
  console.log("🔄 Iniciando backup do banco de dados Snack Fácil...\n");

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(process.cwd(), "backups");
  const backupFile = path.join(backupDir, `backup_${timestamp}.json`);

  // Cria diretório se não existe
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  // Exporta todas as tabelas em paralelo
  const [
    organizations,
    users,
    accounts,
    categories,
    transactions,
    suppliers,
    machines,
    products,
    stockMovements,
    auditLogs,
  ] = await Promise.all([
    prisma.organization.findMany(),
    prisma.user.findMany(),
    prisma.account.findMany(),
    prisma.category.findMany(),
    prisma.transaction.findMany(),
    prisma.supplier.findMany(),
    prisma.machine.findMany(),
    prisma.product.findMany(),
    prisma.stockMovement.findMany(),
    prisma.auditLog.findMany(),
  ]);

  const tables = {
    organizations: organizations.length,
    users: users.length,
    accounts: accounts.length,
    categories: categories.length,
    transactions: transactions.length,
    suppliers: suppliers.length,
    machines: machines.length,
    products: products.length,
    stockMovements: stockMovements.length,
    auditLogs: auditLogs.length,
  };

  const metadata = {
    version: "1.0.0",
    createdAt: new Date().toISOString(),
    appName: "Snack Fácil",
    type: "local-backup",
    tables,
  };

  const backup = {
    metadata,
    data: {
      organizations,
      users,
      accounts,
      categories,
      suppliers,
      machines,
      products,
      transactions,
      stockMovements,
      auditLogs,
    },
  };

  fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2), "utf-8");

  // Rotação: manter apenas os últimos 30 backups
  const files = fs
    .readdirSync(backupDir)
    .filter((f) => f.startsWith("backup_") && f.endsWith(".json"))
    .sort()
    .reverse();

  let removedCount = 0;
  if (files.length > 30) {
    for (const old of files.slice(30)) {
      fs.unlinkSync(path.join(backupDir, old));
      removedCount++;
    }
  }

  const totalRecords = Object.values(tables).reduce((a, b) => a + b, 0);
  const fileSizeKB = (fs.statSync(backupFile).size / 1024).toFixed(1);

  console.log("✅ Backup concluído com sucesso!");
  console.log(`📁 Arquivo: ${backupFile}`);
  console.log(`📊 Total de registros: ${totalRecords}`);
  console.log(`💾 Tamanho: ${fileSizeKB} KB`);
  if (removedCount > 0) {
    console.log(`🗑️  ${removedCount} backup(s) antigo(s) removido(s) (rotação: máx 30)`);
  }
  console.log("\n📋 Detalhamento por tabela:");
  for (const [table, count] of Object.entries(tables)) {
    console.log(`   ${table}: ${count} registros`);
  }
}

createBackup()
  .catch((e) => {
    console.error("❌ Erro no backup:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

