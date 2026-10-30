import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, createAuditLog, getClientIp } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { z } from "zod";

const updateProductSchema = z.object({
  name: z.string().min(1, "Nome do produto é obrigatório").optional(),
  description: z.string().optional().nullable(),
  sku: z.string().min(1, "SKU é obrigatório").optional(),
  barcode: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  salePrice: z.number().min(0, "Preço de venda não pode ser negativo").optional(),
  costPrice: z.number().min(0, "Preço de custo não pode ser negativo").optional(),
  unit: z.string().optional(),
  unitPerPack: z.number().int().min(1, "Unidades por fardo/caixa deve ser pelo menos 1").optional(),
  minStock: z.number().int().min(0, "Estoque mínimo não pode ser negativo").optional(),
  currentStock: z.number().int().optional(),
  active: z.boolean().optional(),
});

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  if (!can(user, "product:read")) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  try {
    const product = await prisma.product.findFirst({
      where: { id: params.id, organizationId: user.organizationId },
      include: {
        category: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        _count: { select: { stockMovements: true } },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 });
    }

    return NextResponse.json({
      product: {
        ...product,
        movementCount: product._count.stockMovements,
        isLowStock: product.currentStock <= product.minStock,
      },
    });
  } catch (error) {
    console.error("Erro ao buscar produto:", error);
    return NextResponse.json({ error: "Erro ao buscar produto." }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  if (!can(user, "product:write")) {
    return NextResponse.json(
      { error: "Acesso negado. Perfil sem permissão para editar produtos." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = updateProductSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Dados inválidos" },
        { status: 400 }
      );
    }

    const existing = await prisma.product.findFirst({
      where: { id: params.id, organizationId: user.organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 });
    }

    // Se SKU alterado, valida unicidade
    if (parsed.data.sku && parsed.data.sku.trim().toUpperCase() !== existing.sku) {
      const duplicateSku = await prisma.product.findFirst({
        where: {
          sku: parsed.data.sku.trim().toUpperCase(),
          NOT: { id: params.id },
        },
      });

      if (duplicateSku) {
        return NextResponse.json(
          { error: `Já existe outro produto cadastrado com o SKU "${parsed.data.sku}".` },
          { status: 400 }
        );
      }
    }

    // Valida categoria se informada
    if (parsed.data.categoryId) {
      const cat = await prisma.category.findFirst({
        where: { id: parsed.data.categoryId, organizationId: user.organizationId },
      });
      if (!cat) {
        return NextResponse.json({ error: "Categoria selecionada não encontrada." }, { status: 400 });
      }
    }

    // Valida fornecedor se informado
    if (parsed.data.supplierId) {
      const sup = await prisma.supplier.findFirst({
        where: { id: parsed.data.supplierId, organizationId: user.organizationId },
      });
      if (!sup) {
        return NextResponse.json({ error: "Fornecedor selecionado não encontrado." }, { status: 400 });
      }
    }

    const updateData: any = {};
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name.trim();
    if (parsed.data.description !== undefined) {
      updateData.description = parsed.data.description ? parsed.data.description.trim() : null;
    }
    if (parsed.data.sku !== undefined) updateData.sku = parsed.data.sku.trim().toUpperCase();
    if (parsed.data.barcode !== undefined) {
      updateData.barcode = parsed.data.barcode ? parsed.data.barcode.trim() : null;
    }
    if (parsed.data.categoryId !== undefined) updateData.categoryId = parsed.data.categoryId || null;
    if (parsed.data.supplierId !== undefined) updateData.supplierId = parsed.data.supplierId || null;
    if (parsed.data.salePrice !== undefined) updateData.salePrice = Number(parsed.data.salePrice);
    if (parsed.data.costPrice !== undefined) updateData.costPrice = Number(parsed.data.costPrice);
    if (parsed.data.unit !== undefined) updateData.unit = parsed.data.unit ? parsed.data.unit.trim().toUpperCase() : "UN";
    if (parsed.data.unitPerPack !== undefined) updateData.unitPerPack = Number(parsed.data.unitPerPack);
    if (parsed.data.minStock !== undefined) updateData.minStock = Number(parsed.data.minStock);
    if (parsed.data.currentStock !== undefined) updateData.currentStock = Number(parsed.data.currentStock);
    if (parsed.data.active !== undefined) updateData.active = parsed.data.active;

    const updated = await prisma.product.update({
      where: { id: params.id },
      data: updateData,
      include: {
        category: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
      },
    });

    await createAuditLog({
      action: "PRODUCT_UPDATED",
      userId: user.userId,
      userName: user.name,
      details: `Atualizou o produto "${updated.name}" (SKU: ${updated.sku})`,
      ipAddress: getClientIp(req),
      organizationId: user.organizationId,
    });

    return NextResponse.json({ product: updated });
  } catch (error) {
    console.error("Erro ao atualizar produto:", error);
    return NextResponse.json({ error: "Erro interno ao atualizar produto." }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  if (!can(user, "product:write")) {
    return NextResponse.json(
      { error: "Acesso negado. Perfil sem permissão para excluir produtos." },
      { status: 403 }
    );
  }

  try {
    const existing = await prisma.product.findFirst({
      where: { id: params.id, organizationId: user.organizationId },
      include: {
        _count: {
          select: { stockMovements: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 });
    }

    // Se já tiver movimentações em StockMovement, realiza soft delete
    if (existing._count.stockMovements > 0) {
      await prisma.product.update({
        where: { id: params.id },
        data: { active: false },
      });

      await createAuditLog({
        action: "PRODUCT_UPDATED",
        userId: user.userId,
        userName: user.name,
        details: `Desativou o produto "${existing.name}" (Soft Delete por possuir ${existing._count.stockMovements} movimentações)`,
        ipAddress: getClientIp(req),
        organizationId: user.organizationId,
      });

      return NextResponse.json({
        message: "Produto desativado com sucesso para preservar o histórico de estoque.",
        softDeleted: true,
      });
    }

    // Caso contrário, deleção física
    await prisma.product.delete({
      where: { id: params.id },
    });

    await createAuditLog({
      action: "PRODUCT_DELETED",
      userId: user.userId,
      userName: user.name,
      details: `Excluiu o produto "${existing.name}" (SKU: ${existing.sku})`,
      ipAddress: getClientIp(req),
      organizationId: user.organizationId,
    });

    return NextResponse.json({ message: "Produto excluído com sucesso.", softDeleted: false });
  } catch (error) {
    console.error("Erro ao excluir produto:", error);
    return NextResponse.json({ error: "Erro ao excluir produto." }, { status: 500 });
  }
}

