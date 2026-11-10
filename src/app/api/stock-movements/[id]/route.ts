import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, createAuditLog, getClientIp } from "@/lib/auth";
import { can } from "@/lib/permissions";
import {
  MovementType,
  calculateRevertStockBalance,
  calculateStockEditDelta,
} from "@/lib/inventory-engine";
import { z } from "zod";

const updateStockMovementSchema = z.object({
  quantity: z.number().int().min(1, "Quantidade deve ser de pelo menos 1 unidade").optional(),
  unitCost: z.number().min(0, "Custo unitário deve ser positivo ou zero").optional().nullable(),
  expirationDate: z.string().optional().nullable(),
  machineId: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  if (!can(user, "stock:read")) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  try {
    const movement = await prisma.stockMovement.findFirst({
      where: { id: params.id, organizationId: user.organizationId },
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
          select: { id: true, amountCents: true, status: true, date: true, accountId: true, categoryId: true },
        },
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!movement) {
      return NextResponse.json({ error: "Movimentação de estoque não encontrada." }, { status: 404 });
    }

    return NextResponse.json({ movement });
  } catch (error) {
    console.error("Erro ao buscar movimentação de estoque:", error);
    return NextResponse.json({ error: "Erro ao buscar movimentação de estoque." }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  if (!can(user, "stock:write")) {
    return NextResponse.json(
      { error: "Acesso negado. Usuários sem permissão não podem alterar movimentações de estoque." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = updateStockMovementSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Dados inválidos" },
        { status: 400 }
      );
    }

    const { quantity, unitCost, expirationDate, machineId, supplierId, notes } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Busca a movimentação existente com seus relacionamentos
      const existing = await tx.stockMovement.findFirst({
        where: { id: params.id, organizationId: user.organizationId },
        include: {
          product: true,
          transaction: true,
        },
      });

      if (!existing) {
        throw new Error("NOT_FOUND:Movimentação de estoque não encontrada.");
      }

      const product = existing.product;
      const oldQuantity = existing.quantity;
      const targetQuantity = quantity !== undefined ? quantity : oldQuantity;

      // 2. Cálculo do estoque físico se a quantidade mudou
      let updatedProductStock = product.currentStock;
      if (quantity !== undefined && quantity !== oldQuantity) {
        try {
          const deltaCalc = calculateStockEditDelta(
            product.currentStock,
            existing.type as MovementType,
            oldQuantity,
            targetQuantity
          );
          updatedProductStock = deltaCalc.newStock;
        } catch (calcErr: any) {
          throw new Error(`STOCK_ERROR:${calcErr.message || "Erro no recálculo de estoque"}`);
        }
      }

      // Validação de máquina de destino se for abastecimento
      if (existing.reason === "MACHINE_REFILL") {
        const targetMachineId = machineId !== undefined ? machineId : existing.machineId;
        if (!targetMachineId) {
          throw new Error("VALIDATION_ERROR:Máquina de destino é obrigatória para abastecimentos.");
        }
      }

      // 3. Custos e valores
      const targetUnitCost = unitCost !== undefined ? unitCost : existing.unitCost;
      const effectiveUnitCost = targetUnitCost !== null && targetUnitCost !== undefined ? Number(targetUnitCost) : null;
      const newTotalCost =
        effectiveUnitCost !== null
          ? Math.round(targetQuantity * effectiveUnitCost * 100) / 100
          : null;

      // 4. Atualização da transação financeira vinculada (se houver)
      if (existing.transactionId && existing.transaction) {
        const txUpdateData: any = {};

        if (
          (quantity !== undefined && quantity !== oldQuantity) ||
          (unitCost !== undefined && unitCost !== existing.unitCost)
        ) {
          if (effectiveUnitCost && effectiveUnitCost > 0) {
            const newAmountCents = Math.round(targetQuantity * effectiveUnitCost * 100);
            txUpdateData.amountCents = newAmountCents;
            txUpdateData.description = `Compra de estoque: ${product.name} (${targetQuantity} un)`;
          }
        }

        if (supplierId !== undefined) {
          txUpdateData.supplierId = supplierId || null;
        }

        if (Object.keys(txUpdateData).length > 0) {
          await tx.transaction.update({
            where: { id: existing.transactionId },
            data: txUpdateData,
          });
        }
      }

      // 5. Atualiza o produto (saldo físico e custo unitário de compra)
      const productUpdateData: { currentStock: number; costPrice?: number } = {
        currentStock: updatedProductStock,
      };

      if (
        existing.type === "IN" &&
        existing.reason === "PURCHASE" &&
        effectiveUnitCost !== null &&
        effectiveUnitCost > 0
      ) {
        productUpdateData.costPrice = effectiveUnitCost;
      }

      await tx.product.update({
        where: { id: product.id },
        data: productUpdateData,
      });

      // 6. Atualiza a movimentação em StockMovement
      const movementUpdateData: any = {};
      if (quantity !== undefined) {
        movementUpdateData.quantity = targetQuantity;
        // Recalcula newStock da movimentação baseado no previousStock
        if (existing.type === "IN") {
          movementUpdateData.newStock = existing.previousStock + targetQuantity;
        } else if (existing.type === "OUT") {
          movementUpdateData.newStock = existing.previousStock - targetQuantity;
        } else if (existing.type === "ADJUST") {
          movementUpdateData.newStock = targetQuantity;
        }
      }
      if (unitCost !== undefined) {
        movementUpdateData.unitCost = effectiveUnitCost;
      }
      movementUpdateData.totalCost = newTotalCost;

      if (expirationDate !== undefined) {
        movementUpdateData.expirationDate = expirationDate ? new Date(expirationDate) : null;
      }
      if (machineId !== undefined) {
        movementUpdateData.machineId = machineId || null;
      }
      if (supplierId !== undefined) {
        movementUpdateData.supplierId = supplierId || null;
      }
      if (notes !== undefined) {
        movementUpdateData.notes = notes ? notes.trim() : null;
      }

      const updatedMovement = await tx.stockMovement.update({
        where: { id: params.id },
        data: movementUpdateData,
        include: {
          product: { select: { id: true, name: true, sku: true, currentStock: true, unit: true, unitPerPack: true } },
          machine: { select: { id: true, name: true } },
          supplier: { select: { id: true, name: true } },
          transaction: { select: { id: true, amountCents: true, status: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      });

      return {
        movement: updatedMovement,
        productName: product.name,
        oldQuantity,
        newQuantity: targetQuantity,
      };
    });

    // 7. Auditoria
    await createAuditLog({
      action: "STOCK_MOVEMENT_UPDATED",
      userId: user.userId,
      userName: user.name,
      details: `Movimentação "${result.movement.type} (${result.movement.reason})" de "${result.productName}" alterada (Qtd: ${result.oldQuantity} -> ${result.newQuantity})`,
      ipAddress: getClientIp(req),
      organizationId: user.organizationId,
    });

    return NextResponse.json({
      success: true,
      movement: result.movement,
      message: "Movimentação de estoque atualizada com sucesso.",
    });
  } catch (error: any) {
    console.error("Erro ao atualizar movimentação de estoque:", error);
    const message = error.message || "";
    if (message.startsWith("NOT_FOUND:")) {
      return NextResponse.json({ error: message.replace("NOT_FOUND:", "") }, { status: 404 });
    }
    if (message.startsWith("STOCK_ERROR:")) {
      return NextResponse.json({ error: message.replace("STOCK_ERROR:", "") }, { status: 400 });
    }
    if (message.startsWith("VALIDATION_ERROR:")) {
      return NextResponse.json({ error: message.replace("VALIDATION_ERROR:", "") }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro interno ao atualizar movimentação de estoque." }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  if (!can(user, "stock:write")) {
    return NextResponse.json(
      { error: "Acesso negado. Usuários sem permissão não podem excluir movimentações de estoque." },
      { status: 403 }
    );
  }

  try {
    const url = new URL(req.url);
    // Permite que o cliente decida se exclui também o lançamento financeiro vinculado (padrão: true)
    const deleteFinancialTx = url.searchParams.get("deleteFinancialTransaction") !== "false";

    const result = await prisma.$transaction(async (tx) => {
      // 1. Busca a movimentação com produto e transação
      const existing = await tx.stockMovement.findFirst({
        where: { id: params.id, organizationId: user.organizationId },
        include: {
          product: true,
          transaction: true,
        },
      });

      if (!existing) {
        throw new Error("NOT_FOUND:Movimentação de estoque não encontrada.");
      }

      const product = existing.product;

      // 2. Calcula a reversão do saldo de estoque
      let newStock = product.currentStock;
      try {
        const revertCalc = calculateRevertStockBalance(
          product.currentStock,
          existing.type as MovementType,
          existing.quantity,
          existing.previousStock
        );
        newStock = revertCalc.newStock;
      } catch (revertErr: any) {
        throw new Error(`STOCK_ERROR:${revertErr.message || "Erro ao reverter saldo de estoque"}`);
      }

      // 3. Atualiza o saldo físico do produto
      await tx.product.update({
        where: { id: product.id },
        data: { currentStock: newStock },
      });

      // 4. Trata a transação financeira vinculada
      let deletedTransactionId: string | null = null;
      if (existing.transactionId) {
        if (deleteFinancialTx) {
          deletedTransactionId = existing.transactionId;
          // Primeiro remove o vínculo na movimentação para não violar foreign key caso exista
          await tx.stockMovement.update({
            where: { id: existing.id },
            data: { transactionId: null },
          });
          // Exclui a transação financeira
          await tx.transaction.delete({
            where: { id: existing.transactionId },
          });
        } else {
          // Desvincula mantendo a transação financeira independente
          await tx.stockMovement.update({
            where: { id: existing.id },
            data: { transactionId: null },
          });
        }
      }

      // 5. Exclui a movimentação
      await tx.stockMovement.delete({
        where: { id: existing.id },
      });

      return {
        productName: product.name,
        quantity: existing.quantity,
        type: existing.type,
        reason: existing.reason,
        previousStock: product.currentStock,
        restoredStock: newStock,
        deletedTransactionId,
      };
    });

    // 6. Auditoria
    await createAuditLog({
      action: "STOCK_MOVEMENT_DELETED",
      userId: user.userId,
      userName: user.name,
      details: `Movimentação "${result.type} (${result.reason})" de ${result.quantity} un de "${result.productName}" excluída. Saldo físico restaurado: ${result.previousStock} -> ${result.restoredStock}${result.deletedTransactionId ? ` [Lançamento financeiro ${result.deletedTransactionId} também excluído]` : ""}`,
      ipAddress: getClientIp(req),
      organizationId: user.organizationId,
    });

    return NextResponse.json({
      success: true,
      message: "Movimentação excluída e saldo de estoque restaurado com sucesso.",
      restoredStock: result.restoredStock,
      deletedFinancialTransaction: !!result.deletedTransactionId,
    });
  } catch (error: any) {
    console.error("Erro ao excluir movimentação de estoque:", error);
    const message = error.message || "";
    if (message.startsWith("NOT_FOUND:")) {
      return NextResponse.json({ error: message.replace("NOT_FOUND:", "") }, { status: 404 });
    }
    if (message.startsWith("STOCK_ERROR:")) {
      return NextResponse.json({ error: message.replace("STOCK_ERROR:", "") }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro interno ao excluir movimentação de estoque." }, { status: 500 });
  }
}

