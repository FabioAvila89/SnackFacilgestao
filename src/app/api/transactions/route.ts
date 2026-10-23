import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { z } from "zod";

const transactionSchema = z.object({
  date: z.string().min(1, "Data é obrigatória"),
  kind: z.enum(["INCOME", "EXPENSE"]),
  amountCents: z.number().int().positive("Valor deve ser maior que zero"),
  description: z.string().min(1, "Descrição é obrigatória"),
  accountId: z.string().min(1, "Conta é obrigatória"),
  categoryId: z.string().min(1, "Categoria é obrigatória"),
  notes: z.string().nullable().optional(),
});

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get("limit") || "25", 10)));
  const search = url.searchParams.get("search")?.trim() || "";
  const kind = url.searchParams.get("kind");
  const accountId = url.searchParams.get("accountId");
  const categoryId = url.searchParams.get("categoryId");
  const startDateStr = url.searchParams.get("startDate");
  const endDateStr = url.searchParams.get("endDate");

  const where: any = {
    organizationId: user.organizationId,
  };

  if (kind === "INCOME" || kind === "EXPENSE") {
    where.kind = kind;
  }

  if (accountId) {
    where.accountId = accountId;
  }

  if (categoryId) {
    // Busca se a categoria é pai; se for, filtra por ela e todos os seus filhos
    const cat = await prisma.category.findUnique({
      where: { id: categoryId },
      include: { children: { select: { id: true } } },
    });

    if (cat && cat.children.length > 0) {
      where.categoryId = {
        in: [cat.id, ...cat.children.map((c) => c.id)],
      };
    } else {
      where.categoryId = categoryId;
    }
  }

  if (startDateStr || endDateStr) {
    where.date = {};
    if (startDateStr) {
      const s = new Date(startDateStr);
      s.setUTCHours(0, 0, 0, 0);
      where.date.gte = s;
    }
    if (endDateStr) {
      const e = new Date(endDateStr);
      e.setUTCHours(23, 59, 59, 999);
      where.date.lte = e;
    }
  }

  if (search) {
    where.OR = [
      { description: { contains: search, mode: "insensitive" } },
      { notes: { contains: search, mode: "insensitive" } },
    ];
  }

  // Busca totais do filtro aplicado (agregação rápida)
  const totalsRaw = await prisma.transaction.groupBy({
    by: ["kind"],
    where,
    _sum: {
      amountCents: true,
    },
    _count: {
      id: true,
    },
  });

  let totalIncomeCents = 0;
  let totalExpenseCents = 0;
  let totalCount = 0;

  for (const t of totalsRaw) {
    const sum = t._sum.amountCents || 0;
    totalCount += t._count.id;
    if (t.kind === "INCOME") totalIncomeCents += sum;
    if (t.kind === "EXPENSE") totalExpenseCents += sum;
  }

  const resultCents = totalIncomeCents - totalExpenseCents;

  // Busca lista paginada
  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    skip: (page - 1) * limit,
    take: limit,
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
      createdBy: {
        select: { id: true, name: true, email: true },
      },
      updatedBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  return NextResponse.json({
    transactions,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit) || 1,
    },
    totals: {
      incomeCents: totalIncomeCents,
      expenseCents: totalExpenseCents,
      resultCents,
    },
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  // Validação de permissão no servidor
  const { can } = await import("@/lib/permissions");
  if (!can(user, "transaction:create")) {
    return NextResponse.json(
      { error: "Acesso negado. Usuários com perfil de Consulta (VIEWER) não possuem permissão para criar lançamentos." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = transactionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Dados inválidos" },
        { status: 400 }
      );
    }

    const { date, kind, amountCents, description, accountId, categoryId, notes } = parsed.data;

    // 1. Valida conta
    const account = await prisma.account.findFirst({
      where: { id: accountId, organizationId: user.organizationId },
    });
    if (!account) {
      return NextResponse.json({ error: "Conta não encontrada." }, { status: 400 });
    }
    if (!account.active) {
      return NextResponse.json({ error: "A conta selecionada está desativada." }, { status: 400 });
    }

    // 2. Valida categoria
    const category = await prisma.category.findFirst({
      where: { id: categoryId, organizationId: user.organizationId },
    });
    if (!category) {
      return NextResponse.json({ error: "Categoria não encontrada." }, { status: 400 });
    }
    if (!category.active) {
      return NextResponse.json({ error: "A categoria selecionada está desativada." }, { status: 400 });
    }

    // 3. Regra crítica: kind da transação deve bater com kind da categoria
    if (category.kind !== kind) {
      const catTipo = category.kind === "INCOME" ? "entrada" : "saída";
      const txTipo = kind === "INCOME" ? "entrada" : "saída";
      return NextResponse.json(
        {
          error: `Conflito de tipo: a categoria "${category.name}" é de ${catTipo}, mas o lançamento foi informado como ${txTipo}.`,
        },
        { status: 400 }
      );
    }

    // Converte data
    const dateObj = new Date(date);
    dateObj.setUTCHours(12, 0, 0, 0);

    const transaction = await prisma.transaction.create({
      data: {
        date: dateObj,
        kind,
        amountCents,
        description: description.trim(),
        accountId,
        categoryId,
        notes: notes ? notes.trim() : null,
        organizationId: user.organizationId,
        createdById: user.userId,
      },
      include: {
        account: true,
        category: true,
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ transaction }, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar lançamento:", error);
    return NextResponse.json({ error: "Erro ao criar lançamento." }, { status: 500 });
  }
}
