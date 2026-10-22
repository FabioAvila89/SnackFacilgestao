import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { calculateMonthlyFlow, calculateAccountBalance } from "@/lib/finance-engine";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const period = url.searchParams.get("period") || "year"; // month, quarter, year, custom
  const startDateParam = url.searchParams.get("startDate");
  const endDateParam = url.searchParams.get("endDate");

  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth(); // 0 a 11

  let startDate: Date;
  let endDate: Date;

  if (period === "month") {
    startDate = new Date(Date.UTC(currentYear, currentMonth, 1));
    endDate = new Date(Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59, 999));
  } else if (period === "quarter") {
    const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
    startDate = new Date(Date.UTC(currentYear, quarterStartMonth, 1));
    endDate = new Date(Date.UTC(currentYear, quarterStartMonth + 3, 0, 23, 59, 59, 999));
  } else if (period === "custom" && startDateParam && endDateParam) {
    startDate = new Date(startDateParam);
    startDate.setUTCHours(0, 0, 0, 0);
    endDate = new Date(endDateParam);
    endDate.setUTCHours(23, 59, 59, 999);
  } else {
    // year (default: ano atual completo)
    startDate = new Date(Date.UTC(currentYear, 0, 1));
    endDate = new Date(Date.UTC(currentYear, 11, 31, 23, 59, 59, 999));
  }

  // 1. Calcula saldo acumulado antes do início do período
  const accounts = await prisma.account.findMany({
    where: { organizationId: user.organizationId },
    select: { initialBalanceCents: true },
  });
  const sumInitialBalances = accounts.reduce((acc, a) => acc + a.initialBalanceCents, 0);

  const prevTransactions = await prisma.transaction.findMany({
    where: {
      organizationId: user.organizationId,
      date: { lt: startDate },
    },
    select: { kind: true, amountCents: true },
  });

  let balanceBeforePeriod = sumInitialBalances;
  for (const t of prevTransactions) {
    if (t.kind === "INCOME") balanceBeforePeriod += t.amountCents;
    if (t.kind === "EXPENSE") balanceBeforePeriod -= t.amountCents;
  }

  // 2. Busca lançamentos dentro do período
  const periodTransactions = await prisma.transaction.findMany({
    where: {
      organizationId: user.organizationId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      date: true,
      kind: true,
      amountCents: true,
    },
    orderBy: { date: "asc" },
  });

  const monthlyFlow = calculateMonthlyFlow(
    periodTransactions as any,
    startDate,
    endDate,
    balanceBeforePeriod
  );

  let totalIncomeCents = 0;
  let totalExpenseCents = 0;

  for (const m of monthlyFlow) {
    totalIncomeCents += m.incomeCents;
    totalExpenseCents += m.expenseCents;
  }

  const totalResultCents = totalIncomeCents - totalExpenseCents;
  const finalAccumulatedBalanceCents =
    monthlyFlow.length > 0
      ? monthlyFlow[monthlyFlow.length - 1].accumulatedBalanceCents
      : balanceBeforePeriod;

  return NextResponse.json({
    period,
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
    monthlyFlow,
    totals: {
      totalIncomeCents,
      totalExpenseCents,
      totalResultCents,
      finalAccumulatedBalanceCents,
    },
  });
}
