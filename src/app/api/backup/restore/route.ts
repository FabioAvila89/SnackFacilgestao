import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 60 segundos na Vercel

export async function POST(req: Request) {
  // 1. Somente ADMIN pode restaurar backup
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Apenas administradores podem restaurar o banco de dados" },
      { status: 403 }
    );
  }

  try {
    const raw = await req.json();
    const { metadata, data } = raw;

    if (!metadata || !data) {
      return NextResponse.json(
        { error: "Arquivo de backup inválido: formato não reconhecido (necessário conter 'metadata' e 'data')" },
        { status: 400 }
      );
    }

    if (!Array.isArray(data.organizations) || !Array.isArray(data.transactions)) {
      return NextResponse.json(
        { error: "Estrutura de dados corrompida ou incompleta no arquivo de backup" },
        { status: 400 }
      );
    }

    // Helper para converter strings de data ISO em objetos Date reais
    const parseDates = (obj: any) => {
      const result: any = { ...obj };
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

    // 2. PRESERVAÇÃO DE SENHAS: Mapeia as senhas atuais do banco antes da limpeza
    const currentUsers = await prisma.user.findMany({
      select: {
        email: true,
        passwordHash: true,
        mustChangePassword: true,
      },
    });

    const existingPasswordMap = new Map<string, { hash: string; mustChange: boolean }>();
    for (const u of currentUsers) {
      if (u.email && u.passwordHash) {
        existingPasswordMap.set(u.email.toLowerCase().trim(), {
          hash: u.passwordHash,
          mustChange: !!u.mustChangePassword,
        });
      }
    }

    // 3. Prepara usuários garantindo preservação de senha
    const fallbackPassword = process.env.ADMIN_PASSWORD || "AdminSnack2026!";
    let fallbackHash: string | null = null;
    const usersToInsert = [];

    for (const row of data.users || []) {
      const userData = parseDates(row);
      const emailKey = (userData.email || "").toLowerCase().trim();
      const existing = existingPasswordMap.get(emailKey);

      if (userData.passwordHash) {
        // Caso 1: O backup já tem a senha salva -> usa a senha intacta do backup
      } else if (existing) {
        // Caso 2: O backup veio sem senha, MAS o usuário já existe no banco -> PRESERVA A SENHA ATUAL!
        userData.passwordHash = existing.hash;
        userData.mustChangePassword = existing.mustChange;
      } else {
        // Caso 3: Usuário novo e sem senha no backup -> aplica senha provisória padrão
        if (!fallbackHash) fallbackHash = await bcrypt.hash(fallbackPassword, 10);
        userData.passwordHash = fallbackHash;
        userData.mustChangePassword = true;
      }
      usersToInsert.push(userData);
    }

    // 4. Limpeza completa dos dados anteriores respeitando ordem de Foreign Keys
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

    // 5. INSERÇÃO EM LOTE RÁPIDA (createMany) — Execução em menos de 2 segundos!

    // 5.1 Organizations
    if (data.organizations?.length > 0) {
      await prisma.organization.createMany({ data: data.organizations.map(parseDates) });
    }

    // 5.2 Users (com senhas preservadas)
    if (usersToInsert.length > 0) {
      await prisma.user.createMany({ data: usersToInsert });
    }

    // 5.3 Accounts
    if (data.accounts?.length > 0) {
      await prisma.account.createMany({ data: data.accounts.map(parseDates) });
    }

    // 5.4 Categories (pais primeiro para manter integridade da hierarquia)
    const allCategories = (data.categories || []).map(parseDates);
    const parents = allCategories.filter((c: any) => !c.parentId);
    const children = allCategories.filter((c: any) => c.parentId);

    if (parents.length > 0) {
      await prisma.category.createMany({ data: parents });
    }
    if (children.length > 0) {
      await prisma.category.createMany({ data: children });
    }

    // 5.5 Suppliers
    if (data.suppliers?.length > 0) {
      await prisma.supplier.createMany({ data: data.suppliers.map(parseDates) });
    }

    // 5.6 Machines
    if (data.machines?.length > 0) {
      await prisma.machine.createMany({ data: data.machines.map(parseDates) });
    }

    // 5.7 Products
    if (data.products?.length > 0) {
      await prisma.product.createMany({ data: data.products.map(parseDates) });
    }

    // 5.8 Transactions
    if (data.transactions?.length > 0) {
      await prisma.transaction.createMany({ data: data.transactions.map(parseDates) });
    }

    // 5.9 Stock Movements
    if (data.stockMovements?.length > 0) {
      await prisma.stockMovement.createMany({ data: data.stockMovements.map(parseDates) });
    }

    // 5.10 Audit Logs históricos
    if (data.auditLogs?.length > 0) {
      await prisma.auditLog.createMany({ data: data.auditLogs.map(parseDates) });
    }

    // 6. Registra novo AuditLog referente a esta restauração
    const totalRestored = Object.values(
      (metadata.tables as Record<string, number>) || {}
    ).reduce((a, b) => a + b, 0);

    await prisma.auditLog.create({
      data: {
        action: "DATABASE_RESTORE",
        userId: user.userId,
        userName: user.name,
        details: `Restauração completa via Web pelo administrador ${user.email}. Backup original de ${metadata.createdAt} com ${totalRestored} registros. Senhas dos usuários preservadas.`,
        organizationId: user.organizationId,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Banco de dados restaurado com sucesso! Senhas dos usuários preservadas.",
      backupDate: metadata.createdAt,
      totalRecords: totalRestored,
      tables: metadata.tables,
    });
  } catch (error: any) {
    console.error("Erro crítico na restauração do backup:", error);
    return NextResponse.json(
      { error: `Falha ao restaurar banco de dados: ${error?.message || String(error)}` },
      { status: 500 }
    );
  }
}
