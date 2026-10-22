import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { calculateExpensesByCategory } from "@/lib/finance-engine";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const kind = (url.searchParams.get("kind") === "INCOME" ? "INCOME" : "EXPENSE") as "INCOME" | "EXPENSE";
  const period = url.searchParams.get("period") || "month";
  const startDateParam = url.searchParams.get("startDate");
  const endDateParam = url.searchParams.get("endDate");

  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth();

  let startDate: Date;
  let endDate: Date;

  if (period === "month") {
    startDate = new Date(Date.UTC(currentYear, currentMonth, 1));
    endDate = new Date(Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59, 999));
  } else if (period === "quarter") {
    const qMonth = Math.floor(currentMonth / 3) * 3;
    startDate = new Date(Date.UTC(currentYear, qMonth, 1));
    endDate = new Date(Date.UTC(currentYear, qMonth + 3, 0, 23, 59, 59, 999));
  } else if (period === "year") {
    startDate = new Date(Date.UTC(currentYear, 0, 1));
    endDate = new Date(Date.UTC(currentYear, 11, 31, 23, 59, 59, 999));
  } else if (period === "custom" && startDateParam && endDateParam) {
    startDate = new Date(startDateParam);
    startDate.setUTCHours(0, 0, 0, 0);
    endDate = new Date(endDateParam);
    endDate.setUTCHours(23, 59, 59, 999);
  } else {
    startDate = new Date(Date.UTC(currentYear, currentMonth, 1));
    endDate = new Date(Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59, 999));
  }

  const transactions = await prisma.transaction.findMany({
    where: {
      organizationId: user.organizationId,
      kind,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      account: { select: { id: true, name: true } },
      category: {
        select: {
          id: true,
          name: true,
          parentId: true,
          parent: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { date: "desc" },
  });

  const rawTx = transactions.map((t) => ({
    id: t.id,
    date: t.date,
    kind: t.kind as "INCOME" | "EXPENSE",
    amountCents: t.amountCents,
    description: t.description,
    accountId: t.accountId,
    accountName: t.account.name,
    categoryId: t.categoryId,
    categoryName: t.category.name,
    categoryParentId: t.category.parentId,
    categoryParentName: t.category.parent?.name || null,
  }));

  const { items, totalCents } = calculateExpensesByCategory(rawTx, kind);

  return NextResponse.json({
    kind,
    period,
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
    totalCents,
    categories: items,
    transactions: rawTx, // Para permitir expansão e visualização de lançamentos detalhados
  });
}
