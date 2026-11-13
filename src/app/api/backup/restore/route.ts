import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // 2 minutos para restaurações volumosas

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

    // 2. Limpeza completa dos dados anteriores respeitando ordem de Foreign Keys
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

    // 3. Inserção ordenada dos dados do backup

    // 3.1 Organizations
    for (const row of data.organizations || []) {
      await prisma.organization.create({ data: parseDates(row) });
    }

    // 3.2 Users
    const fallbackPassword = process.env.ADMIN_PASSWORD || "AdminSnack2026!";
    const fallbackHash = await bcrypt.hash(fallbackPassword, 10);

    for (const row of data.users || []) {
      const userData = parseDates(row);
      // Se não houver passwordHash no backup, aplica fallback e exige troca
      if (!userData.passwordHash) {
        userData.passwordHash = fallbackHash;
        userData.mustChangePassword = true;
      }
      await prisma.user.create({ data: userData });
    }

    // 3.3 Accounts
    for (const row of data.accounts || []) {
      await prisma.account.create({ data: parseDates(row) });
    }

    // 3.4 Categories (pais primeiro para manter hierarquia de chaves estrangeiras)
    const allCategories = data.categories || [];
    const parents = allCategories.filter((c: any) => !c.parentId);
    const children = allCategories.filter((c: any) => c.parentId);

    for (const row of parents) {
      await prisma.category.create({ data: parseDates(row) });
    }
    for (const row of children) {
      await prisma.category.create({ data: parseDates(row) });
    }

    // 3.5 Suppliers
    for (const row of data.suppliers || []) {
      await prisma.supplier.create({ data: parseDates(row) });
    }

    // 3.6 Machines
    for (const row of data.machines || []) {
      await prisma.machine.create({ data: parseDates(row) });
    }

    // 3.7 Products
    for (const row of data.products || []) {
      await prisma.product.create({ data: parseDates(row) });
    }

    // 3.8 Transactions
    for (const row of data.transactions || []) {
      await prisma.transaction.create({ data: parseDates(row) });
    }

    // 3.9 Stock Movements
    for (const row of data.stockMovements || []) {
      await prisma.stockMovement.create({ data: parseDates(row) });
    }

    // 3.10 Audit Logs históricos
    for (const row of data.auditLogs || []) {
      await prisma.auditLog.create({ data: parseDates(row) });
    }

    // 4. Registra novo AuditLog referente a esta restauração
    const totalRestored = Object.values(
      (metadata.tables as Record<string, number>) || {}
    ).reduce((a, b) => a + b, 0);

    await prisma.auditLog.create({
      data: {
        action: "DATABASE_RESTORE",
        userId: user.userId,
        userName: user.name,
        details: `Restauração completa via Web pelo administrador ${user.email}. Backup original de ${metadata.createdAt} com ${totalRestored} registros.`,
        organizationId: user.organizationId,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Banco de dados restaurado com sucesso!",
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

