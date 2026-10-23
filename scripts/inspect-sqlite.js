const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'prisma', 'dev.db');
const db = new DatabaseSync(dbPath, { readOnly: true });

const tables = ['Organization', 'User', 'Account', 'Category', 'Transaction', 'AuditLog'];

console.log("=== CONTAGEM DE REGISTROS NO SQLITE (ORIGEM) ===");
for (const t of tables) {
  const row = db.prepare(`SELECT count(*) as count FROM "${t}"`).get();
  console.log(`${t}: ${row.count}`);
}

const txSummary = db.prepare(`
  SELECT 
    kind, 
    COUNT(*) as total_count, 
    SUM(amountCents) as total_cents 
  FROM "Transaction" 
  GROUP BY kind
`).all();

console.log("\n=== TOTAIS DE TRANSAÇÕES NO SQLITE ===");
console.log(txSummary);

const accounts = db.prepare(`SELECT id, name, initialBalanceCents FROM "Account"`).all();
console.log("\n=== CONTAS NO SQLITE ===");
for (const acc of accounts) {
  const tx = db.prepare(`
    SELECT 
      SUM(CASE WHEN kind = 'INCOME' THEN amountCents ELSE 0 END) as income,
      SUM(CASE WHEN kind = 'EXPENSE' THEN amountCents ELSE 0 END) as expense
    FROM "Transaction" WHERE accountId = ?
  `).get(acc.id);
  const inc = tx.income || 0;
  const exp = tx.expense || 0;
  const balance = acc.initialBalanceCents + inc - exp;
  console.log(`Conta: ${acc.name} | Saldo Inicial: ${acc.initialBalanceCents} | Entradas: ${inc} | Saídas: ${exp} | Saldo Atual: ${balance}`);
}
