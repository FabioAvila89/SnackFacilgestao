/**
 * Script de Migração SQLite -> PostgreSQL (Supabase)
 * 
 * Lê os dados do arquivo SQLite local (prisma/dev.db) em modo estritamente SOMENTE LEITURA
 * e importa para o PostgreSQL/Supabase preservando IDs, senhas, datas e relacionamentos.
 * É idempotente: pode ser executado mais de uma vez sem duplicar dados (usa upsert).
 * 
 * Execução:
 *   npx tsx scripts/migrate-sqlite-to-postgres.ts
 *   ou
 *   node scripts/migrate-sqlite-to-postgres.js
 */

import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';

const sqlitePath = path.join(__dirname, '..', 'prisma', 'dev.db');

if (!fs.existsSync(sqlitePath)) {
  console.error(`[ERRO] Arquivo SQLite não encontrado em: ${sqlitePath}`);
  process.exit(1);
}

const targetUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!targetUrl) {
  console.error('[ERRO] Nem DIRECT_URL nem DATABASE_URL foram definidas no ambiente.');
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: targetUrl,
    },
  },
});

async function main() {
  console.log('=== Iniciando Migração de Dados (SQLite -> PostgreSQL) ===');
  console.log(`Lendo SQLite (somente leitura): ${sqlitePath}`);

  // Abre SQLite explicitamente em modo somente leitura
  const sqliteDb = new DatabaseSync(sqlitePath, { readOnly: true });

  const orgs = sqliteDb.prepare('SELECT * FROM "Organization"').all() as any[];
  const users = sqliteDb.prepare('SELECT * FROM "User"').all() as any[];
  const accounts = sqliteDb.prepare('SELECT * FROM "Account"').all() as any[];
  const rootCategories = sqliteDb.prepare('SELECT * FROM "Category" WHERE parentId IS NULL').all() as any[];
  const childCategories = sqliteDb.prepare('SELECT * FROM "Category" WHERE parentId IS NOT NULL').all() as any[];
  const transactions = sqliteDb.prepare('SELECT * FROM "Transaction"').all() as any[];
  const auditLogs = sqliteDb.prepare('SELECT * FROM "AuditLog"').all() as any[];

  console.log(`Registros encontrados no SQLite:`);
  console.log(`- Organizações: ${orgs.length}`);
  console.log(`- Usuários: ${users.length}`);
  console.log(`- Contas: ${accounts.length}`);
  console.log(`- Categorias: ${rootCategories.length} raiz + ${childCategories.length} filhas`);
  console.log(`- Transações: ${transactions.length}`);
  console.log(`- Logs de Auditoria: ${auditLogs.length}`);

  console.log('\nGravando no PostgreSQL via transação atômica...');

  await prisma.$transaction(async (tx) => {
    // 1. Organizações
    for (const o of orgs) {
      await tx.organization.upsert({
        where: { id: o.id },
        update: {},
        create: {
          id: o.id,
          name: o.name,
          createdAt: new Date(o.createdAt),
          updatedAt: new Date(o.updatedAt),
        },
      });
    }

    // 2. Usuários
    for (const u of users) {
      await tx.user.upsert({
        where: { id: u.id },
        update: {},
        create: {
          id: u.id,
          email: u.email,
          passwordHash: u.passwordHash,
          name: u.name,
          role: u.role,
          active: Boolean(u.active),
          mustChangePassword: Boolean(u.mustChangePassword),
          lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt) : null,
          failedLoginCount: u.failedLoginCount || 0,
          lockedUntil: u.lockedUntil ? new Date(u.lockedUntil) : null,
          sessionVersion: u.sessionVersion || 1,
          organizationId: u.organizationId,
          createdAt: new Date(u.createdAt),
          updatedAt: new Date(u.updatedAt),
        },
      });
    }

    // 3. Contas
    for (const a of accounts) {
      await tx.account.upsert({
        where: { id: a.id },
        update: {},
        create: {
          id: a.id,
          name: a.name,
          type: a.type,
          initialBalanceCents: a.initialBalanceCents || 0,
          active: Boolean(a.active),
          organizationId: a.organizationId,
          createdAt: new Date(a.createdAt),
          updatedAt: new Date(a.updatedAt),
        },
      });
    }

    // 4. Categorias Raiz
    for (const c of rootCategories) {
      await tx.category.upsert({
        where: { id: c.id },
        update: {},
        create: {
          id: c.id,
          name: c.name,
          parentId: null,
          kind: c.kind,
          dreLine: c.dreLine,
          active: Boolean(c.active),
          sortOrder: c.sortOrder || 0,
          organizationId: c.organizationId,
          createdAt: new Date(c.createdAt),
          updatedAt: new Date(c.updatedAt),
        },
      });
    }

    // 5. Categorias Filhas
    for (const c of childCategories) {
      await tx.category.upsert({
        where: { id: c.id },
        update: {},
        create: {
          id: c.id,
          name: c.name,
          parentId: c.parentId,
          kind: c.kind,
          dreLine: c.dreLine,
          active: Boolean(c.active),
          sortOrder: c.sortOrder || 0,
          organizationId: c.organizationId,
          createdAt: new Date(c.createdAt),
          updatedAt: new Date(c.updatedAt),
        },
      });
    }

    // 6. Transações
    for (const t of transactions) {
      await tx.transaction.upsert({
        where: { id: t.id },
        update: {},
        create: {
          id: t.id,
          date: new Date(t.date),
          kind: t.kind,
          amountCents: t.amountCents,
          description: t.description,
          accountId: t.accountId,
          categoryId: t.categoryId,
          notes: t.notes || null,
          organizationId: t.organizationId,
          createdById: t.createdById,
          updatedById: t.updatedById || null,
          createdAt: new Date(t.createdAt),
          updatedAt: new Date(t.updatedAt),
        },
      });
    }

    // 7. Logs de Auditoria
    for (const l of auditLogs) {
      await tx.auditLog.upsert({
        where: { id: l.id },
        update: {},
        create: {
          id: l.id,
          action: l.action,
          userId: l.userId || null,
          userName: l.userName || null,
          targetUserId: l.targetUserId || null,
          targetUserName: l.targetUserName || null,
          details: l.details || null,
          ipAddress: l.ipAddress || null,
          organizationId: l.organizationId,
          createdAt: new Date(l.createdAt),
        },
      });
    }
  });

  console.log('\n[SUCESSO] Migração concluída com sucesso!');
}

main()
  .catch((err) => {
    console.error('[FALHA NA MIGRAÇÃO]:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
