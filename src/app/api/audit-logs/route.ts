import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";

export async function GET(req: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (!can(currentUser, "audit:view")) {
    return NextResponse.json(
      { error: "Acesso negado. Apenas administradores podem visualizar os registros de auditoria." },
      { status: 403 }
    );
  }

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get("limit") || "25", 10)));
  const userId = url.searchParams.get("userId") || "";
  const action = url.searchParams.get("action") || "";
  const startDateStr = url.searchParams.get("startDate");
  const endDateStr = url.searchParams.get("endDate");

  const where: any = {
    organizationId: currentUser.organizationId,
  };

  if (userId) {
    where.OR = [
      { userId: userId },
      { targetUserId: userId },
    ];
  }

  if (action && action !== "ALL") {
    where.action = action;
  }

  if (startDateStr || endDateStr) {
    where.createdAt = {};
    if (startDateStr) {
      const s = new Date(startDateStr);
      s.setUTCHours(0, 0, 0, 0);
      where.createdAt.gte = s;
    }
    if (endDateStr) {
      const e = new Date(endDateStr);
      e.setUTCHours(23, 59, 59, 999);
      where.createdAt.lte = e;
    }
  }

  const [totalCount, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return NextResponse.json({
    logs,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit) || 1,
    },
  });
}
