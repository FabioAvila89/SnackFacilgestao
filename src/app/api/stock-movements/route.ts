import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, createAuditLog, getClientIp } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { z } from "zod";

const stockMovementSchema = z.object({
  productId: z.string().min(1, "Produto é obrigatório"),
  type: z.enum(["IN", "OUT", "ADJUST"]),
  reason: z.enum([
    "PURCHASE",
    "MACHINE_REFILL",
    "LOSS_EXPIRED",
    "LOSS_DAMAGE",
    "INVENTORY_ADJUSTMENT",
  ]),
  quantity: z.number().int().min(1, "Quantidade deve ser de pelo menos 1 unidade"),
  unitCost: z.number().min(0).optional().nullable(),
  expirationDate: z.string().optional().nullable(),
  machineId: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),

  // Campos de integração financeira opcional (apenas para IN + PURCHASE)
  createFinancialTransaction: z.boolean().optional().default(false),
  accountId: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  paymentStatus: z.enum(["PAID", "PENDING"]).optional().default("PAID"),
  dueDate: z.string().optional().nullable(),
  paymentDate: z.string().optional().nullable(),
});

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  if (!can(user, "stock:read")) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const url = new URL(req.url);
  const productId = url.searchParams.get("productId");
  const type = url.searchParams.get("type");
  const reason = url.searchParams.get("reason");
  const machineId = url.searchParams.get("machineId");
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.max(1, Math.min(200, parseInt(url.searchParams.get("limit") || "50", 10)));

  const where: any = {
    organizationId: user.organizationId,
  };

  if (productId) where.productId = productId;
  if (type) where.type = type;
  if (reason) where.reason = reason;
  if (machineId) where.machineId = machineId;

  try {
    const [movements, totalCount] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          product: {
            select: { id: true, name: true, sku: true, barcode: true, currentStock: true, unit: true, unitPerPack: true },
          },
          machine: {
            select: { id: true, name: true, location: true },
          },
          supplier: {
            select: { id: true, name: true },
          },
          transaction: {
            select: { id: true, amountCents: true, status: true, date: true },
          },
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      prisma.stockMovement.count({ where }),
    ]);

    // Resumo de lotes com vencimento nos próximos 30 dias
    const now = new Date();
    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);

    const expiringBatches = await prisma.stockMovement.findMany({
      where: {
        organizationId: user.organizationId,
        type: "IN",
        expirationDate: {
          not: null,
          lte: in30Days,
        },
      },
      orderBy: { expirationDate: "asc" },
      take: 10,
      include: {
        product: { select: { id: true, name: true, sku: true, currentStock: true } },
      },
    });

    return NextResponse.json({
      movements,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit) || 1,
      },
      expiringBatches,
    });
  } catch (error) {
    console.error("Erro ao listar movimentações de estoque:", error);
    return NextResponse.json({ error: "Erro ao buscar histórico de estoque." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  if (!can(user, "stock:write")) {
    return NextResponse.json(
      { error: "Acesso negado. Perfil sem permissão para realizar movimentações de estoque." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = stockMovementSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Dados inválidos" },
        { status: 400 }
      );
    }

    const {
      productId,
      type,
      reason,
      quantity,
      unitCost,
      expirationDate,
      machineId,
      supplierId,
      notes,
      createFinancialTransaction,
      accountId,
      categoryId,
      paymentStatus,
      dueDate,
      paymentDate,
    } = parsed.data;

    // Se reason for MACHINE_REFILL, machineId deve ser validado
    if (reason === "MACHINE_REFILL" && !machineId) {
      return NextResponse.json(
        { error: "Para abastecimento de máquina, a máquina de destino é obrigatória." },
        { status: 400 }
      );
    }

    // Se for integração financeira, valida os campos necessários
    if (createFinancialTransaction) {
      if (type !== "IN" || reason !== "PURCHASE") {
        return NextResponse.json(
          { error: "Lançamento financeiro automático só é permitido para entradas do tipo Compra (IN + PURCHASE)." },
          { status: 400 }
        );
      }

      if (!unitCost || unitCost <= 0) {
        return NextResponse.json(
          { error: "Para gerar lançamento financeiro, o custo unitário pago deve ser maior que zero." },
          { status: 400 }
        );
      }

      if (!accountId) {
        return NextResponse.json(
          { error: "Selecione a conta bancária/caixa para o lançamento financeiro." },
          { status: 400 }
        );
      }
    }

    // Execução Atômica via prisma.$transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Busca o produto atual
      const product = await tx.product.findFirst({
        where: { id: productId, organizationId: user.organizationId },
      });

      if (!product) {
        throw new Error("PROD_NOT_FOUND:Produto não encontrado.");
      }

      const previousStock = product.currentStock;
      let newStock = previousStock;

      // 2. Validação e cálculo de novo estoque
      if (type === "IN") {
        newStock = previousStock + quantity;
      } else if (type === "OUT") {
        if (previousStock < quantity) {
          throw new Error(
            `INSUFFICIENT_STOCK:Saldo insuficiente no depósito. Saldo atual: ${previousStock} un, Quantidade de saída solicitada: ${quantity} un.`
          );
        }
        newStock = previousStock - quantity;
      } else if (type === "ADJUST") {
        // No ajuste manual de inventário, a quantidade enviada é a contagem física final
        newStock = quantity;
      }

      // 3. Cálculos de custo
      const effectiveUnitCost = unitCost !== undefined && unitCost !== null ? Number(unitCost) : null;
      const totalCost = effectiveUnitCost !== null ? Math.round(quantity * effectiveUnitCost * 100) / 100 : null;

      // 4. Integração Financeira (se solicitado)
      let createdTransactionId: string | null = null;

      if (createFinancialTransaction && effectiveUnitCost && effectiveUnitCost > 0) {
        // Valida conta
        const account = await tx.account.findFirst({
          where: { id: accountId!, organizationId: user.organizationId },
        });

        if (!account) {
          throw new Error("ACCOUNT_NOT_FOUND:Conta financeira não encontrada.");
        }
        if (!account.active) {
          throw new Error("ACCOUNT_INACTIVE:A conta financeira selecionada está inativa.");
        }

        // Determina a categoria de despesa (enviada ou a do produto ou fallback para Mercadoria de Revenda)
        let resolvedCategoryId = categoryId;

        if (!resolvedCategoryId && product.categoryId) {
          resolvedCategoryId = product.categoryId;
        }

        if (!resolvedCategoryId) {
          // Busca uma categoria de despesa existente (CMV / Mercadoria para revenda)
          const fallbackCategory = await tx.category.findFirst({
            where: {
              organizationId: user.organizationId,
              kind: "EXPENSE",
            },
            orderBy: { sortOrder: "asc" },
          });

          if (!fallbackCategory) {
            throw new Error("CAT_REQUIRED:Nenhuma categoria de despesa encontrada para vincular à transação financeira.");
          }
          resolvedCategoryId = fallbackCategory.id;
        }

        // Valida que a categoria é realmente de despesa (EXPENSE)
        const category = await tx.category.findFirst({
          where: { id: resolvedCategoryId, organizationId: user.organizationId },
        });

        if (!category) {
          throw new Error("CAT_NOT_FOUND:Categoria financeira informada não foi encontrada.");
        }
        if (category.kind !== "EXPENSE") {
          throw new Error("CAT_INVALID:A categoria financeira de uma compra deve ser do tipo Despesa/Saída.");
        }

        const totalCents = Math.round(quantity * effectiveUnitCost * 100);
        const txDate = paymentDate ? new Date(paymentDate) : new Date();
        const txDueDate = dueDate ? new Date(dueDate) : null;

        const effectiveSupplierId = supplierId || product.supplierId || null;

        const financialTransaction = await tx.transaction.create({
          data: {
            date: txDate,
            kind: "EXPENSE",
            amountCents: totalCents,
            description: `Compra de estoque: ${product.name} (${quantity} un)`,
            accountId: account.id,
            categoryId: category.id,
            status: paymentStatus || "PAID",
            dueDate: txDueDate,
            paidAt: (paymentStatus || "PAID") === "PAID" ? txDate : null,
            supplierId: effectiveSupplierId,
            notes: notes ? `Lançamento automático via Estoque. Obs: ${notes}` : "Lançamento automático gerado na entrada de estoque.",
            organizationId: user.organizationId,
            createdById: user.userId,
          },
        });

        createdTransactionId = financialTransaction.id;
      }

      // 5. Criação da Movimentação em StockMovement
      const movement = await tx.stockMovement.create({
        data: {
          productId: product.id,
          type,
          reason,
          quantity,
          previousStock,
          newStock,
          unitCost: effectiveUnitCost,
          totalCost,
          expirationDate: expirationDate ? new Date(expirationDate) : null,
          machineId: machineId || null,
          supplierId: supplierId || (reason === "PURCHASE" ? product.supplierId : null),
          transactionId: createdTransactionId,
          notes: notes ? notes.trim() : null,
          userId: user.userId,
          organizationId: user.organizationId,
        },
        include: {
          product: { select: { id: true, name: true, sku: true } },
          machine: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true } },
          transaction: { select: { id: true, amountCents: true, status: true } },
        },
      });

      // 6. Atualização de Product (saldo atual e novo custo unitário se compra)
      const productUpdateData: { currentStock: number; costPrice?: number } = {
        currentStock: newStock,
      };

      if (type === "IN" && reason === "PURCHASE" && effectiveUnitCost !== null && effectiveUnitCost > 0) {
        productUpdateData.costPrice = effectiveUnitCost;
      }

      const updatedProduct = await tx.product.update({
        where: { id: product.id },
        data: productUpdateData,
      });

      return {
        movement,
        product: updatedProduct,
        transactionId: createdTransactionId,
      };
    });

    // 7. Auditoria
    await createAuditLog({
      action: "STOCK_MOVEMENT_CREATED",
      userId: user.userId,
      userName: user.name,
      details: `${result.movement.type} (${result.movement.reason}): ${result.movement.quantity} un de "${result.product.name}" (Saldo: ${result.movement.previousStock} -> ${result.movement.newStock})${result.transactionId ? ` [Despesa gerada: ${result.transactionId}]` : ""}`,
      ipAddress: getClientIp(req),
      organizationId: user.organizationId,
    });

    return NextResponse.json(
      {
        movement: result.movement,
        product: result.product,
        financialTransactionCreated: !!result.transactionId,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Erro ao registrar movimentação de estoque:", error);

    const message = error.message || "";
    if (message.startsWith("INSUFFICIENT_STOCK:")) {
      return NextResponse.json({ error: message.replace("INSUFFICIENT_STOCK:", "") }, { status: 400 });
    }
    if (message.startsWith("PROD_NOT_FOUND:")) {
      return NextResponse.json({ error: message.replace("PROD_NOT_FOUND:", "") }, { status: 404 });
    }
    if (message.startsWith("ACCOUNT_NOT_FOUND:") || message.startsWith("ACCOUNT_INACTIVE:")) {
      return NextResponse.json({ error: message.split(":")[1] }, { status: 400 });
    }
    if (message.startsWith("CAT_NOT_FOUND:") || message.startsWith("CAT_INVALID:") || message.startsWith("CAT_REQUIRED:")) {
      return NextResponse.json({ error: message.split(":")[1] }, { status: 400 });
    }

    return NextResponse.json({ error: "Erro interno ao processar movimentação de estoque." }, { status: 500 });
  }
}

