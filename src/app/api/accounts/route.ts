import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { z } from "zod";

const createAccountSchema = z.object({
  name: z.string().min(2, "Nome da conta deve ter pelo menos 2 caracteres"),
  type: z.enum(["BANK", "CASH", "CARD"]),
  initialBalanceCents: z.number().int(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  // Executa queries agregadas no banco em paralelo (evita carregar milhares de transações na memória)
  const [accounts, txAggregates] = await Promise.all([
    prisma.account.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.transaction.groupBy({
      by: ["accountId", "kind", "status"],
      where: { organizationId: user.organizationId },
      _sum: { amountCents: true },
      _count: { id: true },
    }),
  ]);

  // Indexa os totais por conta em O(1) usando um Map
  const accountTotalsMap = new Map<
    string,
    {
      income: number;
      expense: number;
      pendingIncome: number;
      pendingExpense: number;
      count: number;
    }
  >();

  for (const row of txAggregates) {
    let entry = accountTotalsMap.get(row.accountId);
    if (!entry) {
      entry = { income: 0, expense: 0, pendingIncome: 0, pendingExpense: 0, count: 0 };
      accountTotalsMap.set(row.accountId, entry);
    }
    const sum = row._sum.amountCents || 0;
    const count = row._count.id || 0;
    entry.count += count;

    if (row.status === "PENDING") {
      if (row.kind === "INCOME") entry.pendingIncome += sum;
      else if (row.kind === "EXPENSE") entry.pendingExpense += sum;
    } else {
      if (row.kind === "INCOME") entry.income += sum;
      else if (row.kind === "EXPENSE") entry.expense += sum;
    }
  }

  const accountsWithCalculations = accounts.map((acc) => {
    const t = accountTotalsMap.get(acc.id) || {
      income: 0,
      expense: 0,
      pendingIncome: 0,
      pendingExpense: 0,
      count: 0,
    };

    return {
      id: acc.id,
      name: acc.name,
      type: acc.type,
      initialBalanceCents: acc.initialBalanceCents,
      currentBalanceCents: acc.initialBalanceCents + t.income - t.expense,
      totalIncomeCents: t.income,
      totalExpenseCents: t.expense,
      pendingIncomeCents: t.pendingIncome,
      pendingExpenseCents: t.pendingExpense,
      active: acc.active,
      createdAt: acc.createdAt,
      updatedAt: acc.updatedAt,
      transactionCount: t.count,
    };
  });

  return NextResponse.json({ accounts: accountsWithCalculations });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { can } = await import("@/lib/permissions");
  if (!can(user, "account:write")) {
    return NextResponse.json(
      { error: "Acesso negado. Apenas administradores podem cadastrar novas contas." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = createAccountSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Dados inválidos" },
        { status: 400 }
      );
    }

    const { name, type, initialBalanceCents } = parsed.data;

    const account = await prisma.account.create({
      data: {
        name: name.trim(),
        type,
        initialBalanceCents,
        organizationId: user.organizationId,
        active: true,
      },
    });

    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar conta:", error);
    return NextResponse.json({ error: "Erro ao criar conta." }, { status: 500 });
  }
}
