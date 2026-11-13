import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  // Somente ADMIN pode fazer backup
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Apenas administradores podem realizar backups" },
      { status: 403 }
    );
  }

  try {
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
      exportedBy: user.email,
      type: "api-export",
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

    // Registra no audit log
    const totalRecords = Object.values(tables).reduce((a, b) => a + b, 0);
    await prisma.auditLog.create({
      data: {
        action: "DATABASE_BACKUP",
        userId: user.userId,
        userName: user.name,
        details: `Backup completo via API: ${totalRecords} registros exportados (${Object.entries(tables).map(([k, v]) => `${k}: ${v}`).join(", ")})`,
        organizationId: user.organizationId,
      },
    });

    const dateStr = new Date().toISOString().split("T")[0];
    const json = JSON.stringify(backup, null, 2);

    return new NextResponse(json, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="backup_snack_facil_${dateStr}.json"`,
      },
    });
  } catch (error: any) {
    console.error("Erro ao criar backup:", error);
    return NextResponse.json(
      { error: "Erro interno ao criar backup" },
      { status: 500 }
    );
  }
}

