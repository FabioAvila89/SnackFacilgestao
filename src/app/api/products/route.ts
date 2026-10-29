import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, createAuditLog, getClientIp } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { z } from "zod";

const productSchema = z.object({
  name: z.string().min(1, "Nome do produto é obrigatório"),
  description: z.string().optional().nullable(),
  sku: z.string().min(1, "SKU é obrigatório"),
  barcode: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  salePrice: z.number().min(0, "Preço de venda não pode ser negativo").default(0),
  costPrice: z.number().min(0, "Preço de custo não pode ser negativo").default(0),
  unit: z.string().optional().default("UN"),
  unitPerPack: z.number().int().min(1, "Unidades por fardo/caixa deve ser pelo menos 1").default(1),
  minStock: z.number().int().min(0, "Estoque mínimo não pode ser negativo").default(0),
  currentStock: z.number().int().default(0),
  active: z.boolean().optional().default(true),
});

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  if (!can(user, "product:read")) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const url = new URL(req.url);
  const search = url.searchParams.get("search")?.trim() || "";
  const categoryId = url.searchParams.get("categoryId");
  const supplierId = url.searchParams.get("supplierId");
  const status = url.searchParams.get("status") || "ALL"; // ALL | ACTIVE | INACTIVE
  const lowStock = url.searchParams.get("lowStock") === "true";
  const minimal = url.searchParams.get("minimal") === "true";

  const where: any = {
    organizationId: user.organizationId,
  };

  if (status === "ACTIVE") {
    where.active = true;
  } else if (status === "INACTIVE") {
    where.active = false;
  }

  if (categoryId) {
    where.categoryId = categoryId;
  }

  if (supplierId) {
    where.supplierId = supplierId;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { sku: { contains: search, mode: "insensitive" } },
      { barcode: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  try {
    // Modo otimizado e ultrarrápido para selects e filtros auxiliares
    if (minimal) {
      const products = await prisma.product.findMany({
        where,
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          sku: true,
          barcode: true,
          currentStock: true,
          minStock: true,
          costPrice: true,
          salePrice: true,
          unit: true,
          unitPerPack: true,
          supplierId: true,
          categoryId: true,
          active: true,
        },
      });

      return NextResponse.json({
        products: products.map((p) => ({
          ...p,
          isLowStock: p.currentStock <= p.minStock,
        })),
      });
    }

    const products = await prisma.product.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        category: {
          select: { id: true, name: true },
        },
        supplier: {
          select: { id: true, name: true },
        },
        _count: {
          select: { stockMovements: true },
        },
      },
    });

    // Se solicitado lowStock, filtramos onde currentStock <= minStock
    const filteredProducts = lowStock
      ? products.filter((p) => p.currentStock <= p.minStock)
      : products;

    // Métricas para KPI Cards
    const allOrgProducts = await prisma.product.findMany({
      where: { organizationId: user.organizationId, active: true },
      select: {
        currentStock: true,
        costPrice: true,
        minStock: true,
      },
    });

    const totalActiveProducts = allOrgProducts.length;
    let totalStockUnits = 0;
    let totalStockValue = 0;
    let lowStockCount = 0;

    for (const p of allOrgProducts) {
      totalStockUnits += p.currentStock;
      totalStockValue += p.currentStock * p.costPrice;
      if (p.currentStock <= p.minStock) {
        lowStockCount++;
      }
    }

    const formatted = filteredProducts.map((p) => ({
      ...p,
      movementCount: p._count.stockMovements,
      isLowStock: p.currentStock <= p.minStock,
    }));

    return NextResponse.json({
      products: formatted,
      summary: {
        totalActiveProducts,
        totalStockUnits,
        totalStockValue,
        lowStockCount,
      },
    });
  } catch (error) {
    console.error("Erro ao buscar produtos:", error);
    return NextResponse.json({ error: "Erro ao buscar produtos." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  if (!can(user, "product:write")) {
    return NextResponse.json(
      { error: "Acesso negado. Perfil sem permissão para cadastrar produtos." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = productSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Dados inválidos" },
        { status: 400 }
      );
    }

    const {
      name,
      description,
      sku,
      barcode,
      categoryId,
      supplierId,
      salePrice,
      costPrice,
      unit,
      unitPerPack,
      minStock,
      currentStock,
      active,
    } = parsed.data;

    // Valida unicidade de SKU
    const existingSku = await prisma.product.findFirst({
      where: { sku: sku.trim() },
    });

    if (existingSku) {
      return NextResponse.json(
        { error: `Já existe um produto cadastrado com o SKU "${sku}".` },
        { status: 400 }
      );
    }

    // Valida categoria se informada
    if (categoryId) {
      const cat = await prisma.category.findFirst({
        where: { id: categoryId, organizationId: user.organizationId },
      });
      if (!cat) {
        return NextResponse.json({ error: "Categoria selecionada não encontrada." }, { status: 400 });
      }
    }

    // Valida fornecedor se informado
    if (supplierId) {
      const sup = await prisma.supplier.findFirst({
        where: { id: supplierId, organizationId: user.organizationId },
      });
      if (!sup) {
        return NextResponse.json({ error: "Fornecedor selecionado não encontrado." }, { status: 400 });
      }
    }

    const product = await prisma.product.create({
      data: {
        name: name.trim(),
        description: description ? description.trim() : null,
        sku: sku.trim().toUpperCase(),
        barcode: barcode ? barcode.trim() : null,
        categoryId: categoryId || null,
        supplierId: supplierId || null,
        salePrice: Number(salePrice) || 0,
        costPrice: Number(costPrice) || 0,
        unit: unit ? unit.trim().toUpperCase() : "UN",
        unitPerPack: Number(unitPerPack) || 1,
        minStock: Number(minStock) || 0,
        currentStock: Number(currentStock) || 0,
        active: active ?? true,
        organizationId: user.organizationId,
      },
      include: {
        category: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
      },
    });

    await createAuditLog({
      action: "PRODUCT_CREATED",
      userId: user.userId,
      userName: user.name,
      details: `Cadastrou o produto "${product.name}" (SKU: ${product.sku})`,
      ipAddress: getClientIp(req),
      organizationId: user.organizationId,
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error) {
    console.error("Erro ao cadastrar produto:", error);
    return NextResponse.json({ error: "Erro interno ao cadastrar produto." }, { status: 500 });
  }
}

