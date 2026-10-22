import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { z } from "zod";

const createCategorySchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  parentId: z.string().nullable().optional(),
  kind: z.enum(["INCOME", "EXPENSE"]).optional(),
  dreLine: z
    .enum([
      "RECEITA_BRUTA",
      "DEDUCOES",
      "CMV",
      "DESPESAS_OPERACIONAIS",
      "RECEITAS_FINANCEIRAS",
      "DESPESAS_FINANCEIRAS",
      "IMPOSTOS_LUCRO",
      "FORA_DRE",
    ])
    .optional(),
  sortOrder: z.number().int().optional(),
});

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const includeInactive = url.searchParams.get("includeInactive") === "true";

  const categories = await prisma.category.findMany({
    where: {
      organizationId: user.organizationId,
      ...(includeInactive ? {} : { active: true }),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      parent: true,
      children: {
        where: includeInactive ? {} : { active: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: {
          _count: {
            select: { transactions: true },
          },
        },
      },
      _count: {
        select: { transactions: true },
      },
    },
  });

  // Separa em árvore: categorias de nível 1 (parentId === null) com suas subcategorias
  const tree = categories
    .filter((c) => c.parentId === null)
    .map((cat) => ({
      id: cat.id,
      name: cat.name,
      parentId: null,
      kind: cat.kind,
      dreLine: cat.dreLine,
      active: cat.active,
      sortOrder: cat.sortOrder,
      transactionCount: cat._count.transactions,
      subcategories: cat.children.map((sub) => ({
        id: sub.id,
        name: sub.name,
        parentId: cat.id,
        kind: sub.kind,
        dreLine: sub.dreLine,
        active: sub.active,
        sortOrder: sub.sortOrder,
        transactionCount: sub._count.transactions,
      })),
    }));

  // Lista plana de todas as categorias ativas para selects rápidos
  const flat = categories.map((c) => ({
    id: c.id,
    name: c.name,
    parentId: c.parentId,
    parentName: c.parent?.name || null,
    kind: c.kind,
    dreLine: c.dreLine,
    active: c.active,
    transactionCount: c._count.transactions,
  }));

  return NextResponse.json({ tree, flat });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { can } = await import("@/lib/permissions");
  if (!can(user, "category:write")) {
    return NextResponse.json(
      { error: "Acesso negado. Apenas administradores podem cadastrar categorias." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = createCategorySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Dados inválidos" },
        { status: 400 }
      );
    }

    const { name, parentId, kind, dreLine, sortOrder } = parsed.data;

    let finalKind = kind;
    let finalDreLine = dreLine;

    // Se tiver parentId, herda kind e dreLine do pai
    if (parentId) {
      const parent = await prisma.category.findFirst({
        where: { id: parentId, organizationId: user.organizationId },
      });
      if (!parent) {
        return NextResponse.json({ error: "Categoria pai não encontrada" }, { status: 404 });
      }
      finalKind = parent.kind as any;
      finalDreLine = parent.dreLine as any;
    } else {
      if (!finalKind) {
        return NextResponse.json({ error: "Tipo (entrada/saída) é obrigatório" }, { status: 400 });
      }
      if (!finalDreLine) {
        finalDreLine = finalKind === "INCOME" ? "RECEITA_BRUTA" : "DESPESAS_OPERACIONAIS";
      }
    }

    const category = await prisma.category.create({
      data: {
        name: name.trim(),
        parentId: parentId || null,
        kind: finalKind!,
        dreLine: finalDreLine!,
        sortOrder: sortOrder ?? 0,
        organizationId: user.organizationId,
        active: true,
      },
    });

    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar categoria:", error);
    return NextResponse.json({ error: "Erro ao criar categoria." }, { status: 500 });
  }
}
