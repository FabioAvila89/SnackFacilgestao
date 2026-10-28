import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { z } from "zod";
import crypto from "crypto";

const installmentItemSchema = z.object({
  installmentNumber: z.number().int().positive(),
  totalInstallments: z.number().int().positive(),
  dueDate: z.string().min(1),
  amountCents: z.number().int().positive(),
  status: z.enum(["PAID", "PENDING"]).default("PENDING"),
});

const transactionSchema = z.object({
  date: z.string().min(1, "Data é obrigatória"),
  kind: z.enum(["INCOME", "EXPENSE"]),
  amountCents: z.number().int().positive("Valor deve ser maior que zero"),
  description: z.string().min(1, "Descrição é obrigatória"),
  accountId: z.string().min(1, "Conta é obrigatória"),
  categoryId: z.string().min(1, "Categoria é obrigatória"),
  notes: z.string().nullable().optional(),
  status: z.enum(["PAID", "PENDING"]).default("PAID"),
  dueDate: z.string().nullable().optional(),
  supplierId: z.string().nullable().optional(),
  isRecurring: z.boolean().default(false),
  recurrenceFrequency: z.enum(["MONTHLY", "WEEKLY", "YEARLY"]).nullable().optional(),
  isInstallment: z.boolean().default(false),
  totalInstallments: z.number().int().positive().nullable().optional(),
  installments: z.array(installmentItemSchema).optional(),
});

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.max(1, Math.min(200, parseInt(url.searchParams.get("limit") || "25", 10)));
  const search = url.searchParams.get("search")?.trim() || "";
  const kind = url.searchParams.get("kind");
  const status = url.searchParams.get("status"); // ALL | PAID | PENDING | RECURRING
  const isRecurring = url.searchParams.get("isRecurring");
  const accountId = url.searchParams.get("accountId");
  const categoryId = url.searchParams.get("categoryId");
  const supplierId = url.searchParams.get("supplierId");
  const startDateStr = url.searchParams.get("startDate");
  const endDateStr = url.searchParams.get("endDate");

  const where: any = {
    organizationId: user.organizationId,
  };

  if (kind === "INCOME" || kind === "EXPENSE") {
    where.kind = kind;
  }

  if (status === "PAID" || status === "PENDING") {
    where.status = status;
  }

  if (status === "RECURRING" || isRecurring === "true") {
    where.isRecurring = true;
  } else if (isRecurring === "false") {
    where.isRecurring = false;
  }

  if (accountId) {
    where.accountId = accountId;
  }

  if (supplierId) {
    where.supplierId = supplierId;
  }

  if (categoryId) {
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
      { supplier: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  // Executa em paralelo (Promise.all) no PostgreSQL:
  // 1. Busca paginada (findMany com skip e take)
  // 2. Contagem total de registros do filtro (count)
  // 3. Totais agregados de Entradas e Saídas de todo o filtro (groupBy)
  const [transactions, totalCount, totalsRaw] = await Promise.all([
    prisma.transaction.findMany({
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
        supplier: {
          select: { id: true, name: true, phone: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        updatedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    }),
    prisma.transaction.count({
      where,
    }),
    prisma.transaction.groupBy({
      by: ["kind", "status"],
      where,
      _sum: {
        amountCents: true,
      },
    }),
  ]);

  let totalIncomeCents = 0;
  let totalExpenseCents = 0;
  let pendingIncomeCents = 0;
  let pendingExpenseCents = 0;

  for (const t of totalsRaw) {
    const sum = t._sum.amountCents || 0;
    if (t.kind === "INCOME") {
      if (t.status === "PENDING") pendingIncomeCents += sum;
      else totalIncomeCents += sum;
    } else if (t.kind === "EXPENSE") {
      if (t.status === "PENDING") pendingExpenseCents += sum;
      else totalExpenseCents += sum;
    }
  }

  const resultCents = totalIncomeCents - totalExpenseCents;

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
      pendingIncomeCents,
      pendingExpenseCents,
      resultCents,
    },
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

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

    const {
      date,
      kind,
      amountCents,
      description,
      accountId,
      categoryId,
      notes,
      status,
      dueDate,
      supplierId,
      isRecurring,
      recurrenceFrequency,
      isInstallment,
      totalInstallments,
      installments,
    } = parsed.data;

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

    // 4. Valida fornecedor (se fornecido)
    if (supplierId) {
      const sup = await prisma.supplier.findFirst({
        where: { id: supplierId, organizationId: user.organizationId },
      });
      if (!sup) {
        return NextResponse.json({ error: "Fornecedor não encontrado." }, { status: 400 });
      }
    }

    // Converte data base
    const dateObj = new Date(date);
    dateObj.setUTCHours(12, 0, 0, 0);

    // =========================================================================
    // LANÇAMENTO PARCELADO (Cria N lançamentos vinculados em lote otimizado)
    // =========================================================================
    if (isInstallment && installments && installments.length > 1) {
      const installmentGroupId = crypto.randomUUID();
      const numInstallments = installments.length;

      const batchData = installments.map((inst) => {
        const dueObj = new Date(inst.dueDate);
        dueObj.setUTCHours(12, 0, 0, 0);

        return {
          date: dateObj,
          dueDate: dueObj,
          paidAt: inst.status === "PAID" ? new Date() : null,
          status: inst.status,
          kind,
          amountCents: inst.amountCents,
          description: `${description.trim()} (${inst.installmentNumber}/${numInstallments})`,
          accountId,
          categoryId,
          notes: notes ? notes.trim() : null,
          supplierId: supplierId || null,
          isInstallment: true,
          installmentNumber: inst.installmentNumber,
          totalInstallments: numInstallments,
          installmentGroupId,
          organizationId: user.organizationId,
          createdById: user.userId,
        };
      });

      // Grava todas as parcelas em uma única operação SQL em lote
      await prisma.transaction.createMany({
        data: batchData,
      });

      // Busca registros criados para manter formato de resposta da API
      const createdTransactions = await prisma.transaction.findMany({
        where: {
          installmentGroupId,
          organizationId: user.organizationId,
        },
        orderBy: { installmentNumber: "asc" },
        include: {
          account: true,
          category: true,
          supplier: true,
          createdBy: { select: { id: true, name: true, email: true } },
        },
      });

      return NextResponse.json(
        { transactions: createdTransactions, message: `${createdTransactions.length} parcelas criadas com sucesso.` },
        { status: 201 }
      );
    }

    // =========================================================================
    // LANÇAMENTO PADRÃO / RECORRENTE
    // =========================================================================
    let dueDateObj: Date | null = null;
    if (dueDate) {
      dueDateObj = new Date(dueDate);
      dueDateObj.setUTCHours(12, 0, 0, 0);
    }

    const transaction = await prisma.transaction.create({
      data: {
        date: dateObj,
        dueDate: dueDateObj,
        paidAt: status === "PAID" ? new Date() : null,
        status: status || "PAID",
        kind,
        amountCents,
        description: description.trim(),
        accountId,
        categoryId,
        notes: notes ? notes.trim() : null,
        supplierId: supplierId || null,
        isRecurring: !!isRecurring,
        recurrenceFrequency: isRecurring ? (recurrenceFrequency || "MONTHLY") : null,
        isInstallment: false,
        organizationId: user.organizationId,
        createdById: user.userId,
      },
      include: {
        account: true,
        category: true,
        supplier: true,
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ transaction }, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar lançamento:", error);
    return NextResponse.json({ error: "Erro ao criar lançamento." }, { status: 500 });
  }
}
