import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { calculateAccountBalance, calculateExpensesByCategory } from "@/lib/finance-engine";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const monthParam = url.searchParams.get("month"); // YYYY-MM

  const now = new Date();
  let targetYear = now.getUTCFullYear();
  let targetMonth = now.getUTCMonth(); // 0 a 11

  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    targetYear = y;
    targetMonth = m - 1;
  }

  // Datas do mês selecionado
  const monthStart = new Date(Date.UTC(targetYear, targetMonth, 1, 0, 0, 0));
  const monthEnd = new Date(Date.UTC(targetYear, targetMonth + 1, 0, 23, 59, 59, 999));
  const twelveMonthsAgo = new Date(Date.UTC(targetYear, targetMonth - 11, 1, 0, 0, 0));

  // Executa queries otimizadas em paralelo no PostgreSQL
  const [accountsAgg, txTotals, monthTransactions, recentTransactions] = await Promise.all([
    // 1. Soma dos saldos iniciais de todas as contas da organização
    prisma.account.aggregate({
      where: { organizationId: user.organizationId },
      _sum: { initialBalanceCents: true },
    }),

    // 2. Soma agregada de todas as transações realizadas (evita carregar milhares de transações na memória)
    prisma.transaction.groupBy({
      by: ["kind"],
      where: {
        organizationId: user.organizationId,
        status: "PAID",
      },
      _sum: { amountCents: true },
    }),

    // 3. Transações do mês selecionado com select estrito (sem campos pesados não utilizados)
    prisma.transaction.findMany({
      where: {
        organizationId: user.organizationId,
        date: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      select: {
        id: true,
        date: true,
        kind: true,
        amountCents: true,
        description: true,
        accountId: true,
        status: true,
        categoryId: true,
        category: {
          select: {
            id: true,
            name: true,
            parentId: true,
            parent: { select: { id: true, name: true } },
            dreLine: true,
          },
        },
      },
    }),

    // 4. Últimos 12 meses para gráfico de barras com select estrito
    prisma.transaction.findMany({
      where: {
        organizationId: user.organizationId,
        status: "PAID",
        date: {
          gte: twelveMonthsAgo,
          lte: monthEnd,
        },
      },
      select: {
        date: true,
        kind: true,
        amountCents: true,
      },
    }),
  ]);

  // Calcula Saldo Total Atual em O(1) a partir das somas agregadas
  const sumInitialBalances = accountsAgg._sum.initialBalanceCents || 0;
  let totalIncomeAllTime = 0;
  let totalExpenseAllTime = 0;
  for (const t of txTotals) {
    const sum = t._sum.amountCents || 0;
    if (t.kind === "INCOME") totalIncomeAllTime += sum;
    if (t.kind === "EXPENSE") totalExpenseAllTime += sum;
  }
  const totalBalanceCents = sumInitialBalances + totalIncomeAllTime - totalExpenseAllTime;

  // Processa dados do mês em passagem única O(N)
  let monthIncomeCents = 0;
  let monthExpenseCents = 0;
  let monthPendingIncomeCents = 0;
  let monthPendingExpenseCents = 0;
  const rawTxForExpenses: any[] = [];

  for (let i = 0; i < monthTransactions.length; i++) {
    const t = monthTransactions[i];
    if (t.status === "PENDING") {
      if (t.kind === "INCOME") monthPendingIncomeCents += t.amountCents;
      if (t.kind === "EXPENSE") monthPendingExpenseCents += t.amountCents;
      continue;
    }
    if (t.kind === "INCOME") monthIncomeCents += t.amountCents;
    if (t.kind === "EXPENSE") {
      monthExpenseCents += t.amountCents;
      rawTxForExpenses.push({
        id: t.id,
        date: t.date,
        kind: t.kind as "INCOME" | "EXPENSE",
        amountCents: t.amountCents,
        description: t.description,
        accountId: t.accountId,
        categoryId: t.categoryId,
        categoryName: t.category.name,
        categoryParentId: t.category.parentId,
        categoryParentName: t.category.parent?.name || null,
      });
    }
  }

  const monthResultCents = monthIncomeCents - monthExpenseCents;

  // Top 5 categorias de despesas do mês selecionado
  const { items: expenseCategories } = calculateExpensesByCategory(
    rawTxForExpenses,
    "EXPENSE"
  );
  const top5Expenses = expenseCategories.slice(0, 5);

  const monthNames = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez",
  ];

  const last12MonthsMap = new Map<string, { income: number; expense: number; label: string }>();

  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(targetYear, targetMonth - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const label = `${monthNames[d.getUTCMonth()]}/${String(d.getUTCFullYear()).slice(2)}`;
    last12MonthsMap.set(key, { income: 0, expense: 0, label });
  }

  for (const t of recentTransactions) {
    const key = `${t.date.getUTCFullYear()}-${String(t.date.getUTCMonth() + 1).padStart(2, "0")}`;
    if (last12MonthsMap.has(key)) {
      const item = last12MonthsMap.get(key)!;
      if (t.kind === "INCOME") item.income += t.amountCents;
      if (t.kind === "EXPENSE") item.expense += t.amountCents;
    }
  }

  const chartLast12Months = Array.from(last12MonthsMap.entries()).map(([month, data]) => ({
    month,
    label: data.label,
    incomeCents: data.income,
    expenseCents: data.expense,
    resultCents: data.income - data.expense,
  }));

  const selectedMonthStr = `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}`;

  return NextResponse.json({
    selectedMonth: selectedMonthStr,
    cards: {
      totalBalanceCents,
      monthIncomeCents,
      monthExpenseCents,
      monthResultCents,
      monthPendingIncomeCents,
      monthPendingExpenseCents,
    },
    chartLast12Months,
    top5Expenses,
  });
}
