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

  // Executa queries otimizadas em paralelo
  const [accountsAgg, prevTotals, periodTransactions] = await Promise.all([
    // 1. Soma dos saldos iniciais de todas as contas da organização
    prisma.account.aggregate({
      where: { organizationId: user.organizationId },
      _sum: { initialBalanceCents: true },
    }),

    // 2. Soma de lançamentos anteriores ao período delegada ao PostgreSQL (evita Full Scan de histórico em memória)
    prisma.transaction.groupBy({
      by: ["kind"],
      where: {
        organizationId: user.organizationId,
        status: "PAID",
        date: { lt: startDate },
      },
      _sum: { amountCents: true },
    }),

    // 3. Lançamentos realizados dentro do período com select estrito
    prisma.transaction.findMany({
      where: {
        organizationId: user.organizationId,
        status: "PAID",
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
    }),
  ]);

  // Calcula saldo antes do período em O(1)
  const sumInitialBalances = accountsAgg._sum.initialBalanceCents || 0;
  let balanceBeforePeriod = sumInitialBalances;
  for (const t of prevTotals) {
    const sum = t._sum.amountCents || 0;
    if (t.kind === "INCOME") balanceBeforePeriod += sum;
    if (t.kind === "EXPENSE") balanceBeforePeriod -= sum;
  }

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
