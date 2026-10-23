const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'prisma', 'dev.db');
const db = new DatabaseSync(dbPath, { readOnly: true });

function escapeSql(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return val.toString();
  if (val instanceof Date) return `'${val.toISOString()}'`;
  // string: escape single quotes
  return `'${String(val).replace(/'/g, "''")}'`;
}

function formatDate(isoOrTs) {
  if (!isoOrTs) return 'NULL';
  const d = new Date(isoOrTs);
  return `'${d.toISOString()}'`;
}

const fs = require('fs');

const sqlLines = [];
sqlLines.push("BEGIN;");

// 1. Organization
const orgs = db.prepare('SELECT * FROM "Organization"').all();
for (const o of orgs) {
  sqlLines.push(`INSERT INTO "Organization" ("id", "name", "createdAt", "updatedAt") VALUES (${escapeSql(o.id)}, ${escapeSql(o.name)}, ${formatDate(o.createdAt)}, ${formatDate(o.updatedAt)}) ON CONFLICT ("id") DO NOTHING;`);
}

// 2. User
const users = db.prepare('SELECT * FROM "User"').all();
for (const u of users) {
  sqlLines.push(`INSERT INTO "User" ("id", "email", "passwordHash", "name", "role", "active", "mustChangePassword", "lastLoginAt", "failedLoginCount", "lockedUntil", "sessionVersion", "organizationId", "createdAt", "updatedAt") VALUES (${escapeSql(u.id)}, ${escapeSql(u.email)}, ${escapeSql(u.passwordHash)}, ${escapeSql(u.name)}, ${escapeSql(u.role)}, ${u.active ? 'TRUE' : 'FALSE'}, ${u.mustChangePassword ? 'TRUE' : 'FALSE'}, ${formatDate(u.lastLoginAt)}, ${u.failedLoginCount || 0}, ${formatDate(u.lockedUntil)}, ${u.sessionVersion || 1}, ${escapeSql(u.organizationId)}, ${formatDate(u.createdAt)}, ${formatDate(u.updatedAt)}) ON CONFLICT ("id") DO NOTHING;`);
}

// 3. Account
const accounts = db.prepare('SELECT * FROM "Account"').all();
for (const a of accounts) {
  sqlLines.push(`INSERT INTO "Account" ("id", "name", "type", "initialBalanceCents", "active", "organizationId", "createdAt", "updatedAt") VALUES (${escapeSql(a.id)}, ${escapeSql(a.name)}, ${escapeSql(a.type)}, ${a.initialBalanceCents || 0}, ${a.active ? 'TRUE' : 'FALSE'}, ${escapeSql(a.organizationId)}, ${formatDate(a.createdAt)}, ${formatDate(a.updatedAt)}) ON CONFLICT ("id") DO NOTHING;`);
}

// 4. Category (Pais primeiro: parentId IS NULL, depois subcategorias: parentId IS NOT NULL)
const parentCats = db.prepare('SELECT * FROM "Category" WHERE parentId IS NULL').all();
for (const c of parentCats) {
  sqlLines.push(`INSERT INTO "Category" ("id", "name", "parentId", "kind", "dreLine", "active", "sortOrder", "organizationId", "createdAt", "updatedAt") VALUES (${escapeSql(c.id)}, ${escapeSql(c.name)}, NULL, ${escapeSql(c.kind)}, ${escapeSql(c.dreLine)}, ${c.active ? 'TRUE' : 'FALSE'}, ${c.sortOrder || 0}, ${escapeSql(c.organizationId)}, ${formatDate(c.createdAt)}, ${formatDate(c.updatedAt)}) ON CONFLICT ("id") DO NOTHING;`);
}

const childCats = db.prepare('SELECT * FROM "Category" WHERE parentId IS NOT NULL').all();
for (const c of childCats) {
  sqlLines.push(`INSERT INTO "Category" ("id", "name", "parentId", "kind", "dreLine", "active", "sortOrder", "organizationId", "createdAt", "updatedAt") VALUES (${escapeSql(c.id)}, ${escapeSql(c.name)}, ${escapeSql(c.parentId)}, ${escapeSql(c.kind)}, ${escapeSql(c.dreLine)}, ${c.active ? 'TRUE' : 'FALSE'}, ${c.sortOrder || 0}, ${escapeSql(c.organizationId)}, ${formatDate(c.createdAt)}, ${formatDate(c.updatedAt)}) ON CONFLICT ("id") DO NOTHING;`);
}

// 5. Transaction
const txs = db.prepare('SELECT * FROM "Transaction"').all();
for (const t of txs) {
  sqlLines.push(`INSERT INTO "Transaction" ("id", "date", "kind", "amountCents", "description", "accountId", "categoryId", "notes", "organizationId", "createdById", "updatedById", "createdAt", "updatedAt") VALUES (${escapeSql(t.id)}, ${formatDate(t.date)}, ${escapeSql(t.kind)}, ${t.amountCents}, ${escapeSql(t.description)}, ${escapeSql(t.accountId)}, ${escapeSql(t.categoryId)}, ${escapeSql(t.notes)}, ${escapeSql(t.organizationId)}, ${escapeSql(t.createdById)}, ${escapeSql(t.updatedById)}, ${formatDate(t.createdAt)}, ${formatDate(t.updatedAt)}) ON CONFLICT ("id") DO NOTHING;`);
}

// 6. AuditLog
const logs = db.prepare('SELECT * FROM "AuditLog"').all();
for (const l of logs) {
  sqlLines.push(`INSERT INTO "AuditLog" ("id", "action", "userId", "userName", "targetUserId", "targetUserName", "details", "ipAddress", "organizationId", "createdAt") VALUES (${escapeSql(l.id)}, ${escapeSql(l.action)}, ${escapeSql(l.userId)}, ${escapeSql(l.userName)}, ${escapeSql(l.targetUserId)}, ${escapeSql(l.targetUserName)}, ${escapeSql(l.details)}, ${escapeSql(l.ipAddress)}, ${escapeSql(l.organizationId)}, ${formatDate(l.createdAt)}) ON CONFLICT ("id") DO NOTHING;`);
}

sqlLines.push("COMMIT;");

const outputPath = path.join(__dirname, 'dump.sql');
fs.writeFileSync(outputPath, sqlLines.join('\n'), 'utf8');
console.log(`Generated ${sqlLines.length} lines to ${outputPath}`);
