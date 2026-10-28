import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { calculateDRE, RawTransactionInput } from "@/lib/finance-engine";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const period = url.searchParams.get("period") || "month";
  const startDateParam = url.searchParams.get("startDate");
  const endDateParam = url.searchParams.get("endDate");

  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth();

  let curStart: Date;
  let curEnd: Date;
  let prevStart: Date;
  let prevEnd: Date;
  let curLabel = "";
  let prevLabel = "";

  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];

  if (period === "month") {
    curStart = new Date(Date.UTC(currentYear, currentMonth, 1));
    curEnd = new Date(Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59, 999));
    curLabel = `${monthNames[currentMonth]} / ${currentYear}`;

    prevStart = new Date(Date.UTC(currentYear, currentMonth - 1, 1));
    prevEnd = new Date(Date.UTC(currentYear, currentMonth, 0, 23, 59, 59, 999));
    const pMonth = prevStart.getUTCMonth();
    prevLabel = `${monthNames[pMonth]} / ${prevStart.getUTCFullYear()}`;
  } else if (period === "quarter") {
    const q = Math.floor(currentMonth / 3);
    curStart = new Date(Date.UTC(currentYear, q * 3, 1));
    curEnd = new Date(Date.UTC(currentYear, (q + 1) * 3, 0, 23, 59, 59, 999));
    curLabel = `${q + 1}º Trimestre / ${currentYear}`;

    prevStart = new Date(Date.UTC(currentYear, (q - 1) * 3, 1));
    prevEnd = new Date(Date.UTC(currentYear, q * 3, 0, 23, 59, 59, 999));
    const prevQ = (q - 1 + 4) % 4;
    prevLabel = `${prevQ + 1}º Trimestre / ${prevStart.getUTCFullYear()}`;
  } else if (period === "year") {
    curStart = new Date(Date.UTC(currentYear, 0, 1));
    curEnd = new Date(Date.UTC(currentYear, 11, 31, 23, 59, 59, 999));
    curLabel = `Ano ${currentYear}`;

    prevStart = new Date(Date.UTC(currentYear - 1, 0, 1));
    prevEnd = new Date(Date.UTC(currentYear - 1, 11, 31, 23, 59, 59, 999));
    prevLabel = `Ano ${currentYear - 1}`;
  } else if (period === "custom" && startDateParam && endDateParam) {
    curStart = new Date(startDateParam);
    curStart.setUTCHours(0, 0, 0, 0);
    curEnd = new Date(endDateParam);
    curEnd.setUTCHours(23, 59, 59, 999);
    curLabel = `${startDateParam} a ${endDateParam}`;

    const durationMs = curEnd.getTime() - curStart.getTime();
    prevEnd = new Date(curStart.getTime() - 1);
    prevStart = new Date(prevEnd.getTime() - durationMs);
    prevLabel = "Período Anterior Equivalente";
  } else {
    curStart = new Date(Date.UTC(currentYear, currentMonth, 1));
    curEnd = new Date(Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59, 999));
    curLabel = `${monthNames[currentMonth]} / ${currentYear}`;

    prevStart = new Date(Date.UTC(currentYear, currentMonth - 1, 1));
    prevEnd = new Date(Date.UTC(currentYear, currentMonth, 0, 23, 59, 59, 999));
    prevLabel = `${monthNames[prevStart.getUTCMonth()]} / ${prevStart.getUTCFullYear()}`;
  }

  // Busca lançamentos realizados dos dois períodos com select estrito
  const allTx = await prisma.transaction.findMany({
    where: {
      organizationId: user.organizationId,
      status: "PAID",
      date: {
        gte: prevStart,
        lte: curEnd,
      },
    },
    select: {
      id: true,
      date: true,
      kind: true,
      amountCents: true,
      description: true,
      accountId: true,
      account: { select: { name: true } },
      categoryId: true,
      category: {
        select: {
          name: true,
          parentId: true,
          parent: { select: { name: true } },
          dreLine: true,
        },
      },
    },
    orderBy: { date: "asc" },
  });

  const curTx: RawTransactionInput[] = [];
  const prevTx: RawTransactionInput[] = [];

  for (const t of allTx) {
    const raw: RawTransactionInput = {
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
      categoryDreLine: t.category.dreLine as any,
    };

    if (t.date >= curStart && t.date <= curEnd) {
      curTx.push(raw);
    } else if (t.date >= prevStart && t.date <= prevEnd) {
      prevTx.push(raw);
    }
  }

  const dre = calculateDRE(curTx, prevTx, curLabel, prevLabel);

  return NextResponse.json({
    dre,
    curStart: curStart.toISOString().split("T")[0],
    curEnd: curEnd.toISOString().split("T")[0],
    disclaimer:
      "DRE em regime de caixa. O custo das mercadorias reflete as compras do período, não o estoque consumido.",
  });
}
