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

  const accounts = await prisma.account.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { createdAt: "asc" },
    include: {
      transactions: {
        select: {
          kind: true,
          amountCents: true,
        },
      },
    },
  });

  const accountsWithCalculations = accounts.map((acc) => {
    let income = 0;
    let expense = 0;
    for (const t of acc.transactions) {
      if (t.kind === "INCOME") income += t.amountCents;
      else if (t.kind === "EXPENSE") expense += t.amountCents;
    }

    return {
      id: acc.id,
      name: acc.name,
      type: acc.type,
      initialBalanceCents: acc.initialBalanceCents,
      currentBalanceCents: acc.initialBalanceCents + income - expense,
      totalIncomeCents: income,
      totalExpenseCents: expense,
      active: acc.active,
      createdAt: acc.createdAt,
      updatedAt: acc.updatedAt,
      transactionCount: acc.transactions.length,
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
