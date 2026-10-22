import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { z } from "zod";

const updateCategorySchema = z.object({
  name: z.string().min(2).optional(),
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
  active: z.boolean().optional(),
});

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { can } = await import("@/lib/permissions");
  if (!can(user, "category:write")) {
    return NextResponse.json(
      { error: "Acesso negado. Apenas administradores podem alterar categorias." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = updateCategorySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Dados inválidos" },
        { status: 400 }
      );
    }

    const existing = await prisma.category.findFirst({
      where: { id: params.id, organizationId: user.organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Categoria não encontrada" }, { status: 404 });
    }

    const updated = await prisma.category.update({
      where: { id: params.id },
      data: parsed.data,
    });

    // Se alterou a linha de DRE de uma categoria pai, propaga para as subcategorias
    if (parsed.data.dreLine && existing.parentId === null) {
      await prisma.category.updateMany({
        where: { parentId: existing.id },
        data: { dreLine: parsed.data.dreLine },
      });
    }

    // Se desativou categoria pai, desativa também as subcategorias
    if (parsed.data.active === false && existing.parentId === null) {
      await prisma.category.updateMany({
        where: { parentId: existing.id },
        data: { active: false },
      });
    }

    return NextResponse.json({ category: updated });
  } catch (error) {
    console.error("Erro ao atualizar categoria:", error);
    return NextResponse.json({ error: "Erro ao atualizar categoria." }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { can } = await import("@/lib/permissions");
  if (!can(user, "category:write")) {
    return NextResponse.json(
      { error: "Acesso negado. Apenas administradores podem excluir ou desativar categorias." },
      { status: 403 }
    );
  }

  try {
    const existing = await prisma.category.findFirst({
      where: { id: params.id, organizationId: user.organizationId },
      include: {
        children: {
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

    if (!existing) {
      return NextResponse.json({ error: "Categoria não encontrada" }, { status: 404 });
    }

    const totalTransactions =
      existing._count.transactions +
      existing.children.reduce((acc, child) => acc + child._count.transactions, 0);

    // Regra: se tem lançamentos históricos, não excluir fisicamente, apenas desativar
    if (totalTransactions > 0) {
      await prisma.category.update({
        where: { id: params.id },
        data: { active: false },
      });

      // Desativa também filhos
      if (existing.children.length > 0) {
        await prisma.category.updateMany({
          where: { parentId: existing.id },
          data: { active: false },
        });
      }

      return NextResponse.json({
        message: "Categoria possui lançamentos vinculados e foi desativada.",
        deactivated: true,
      });
    }

    // Sem transações: pode deletar com segurança
    if (existing.children.length > 0) {
      await prisma.category.deleteMany({
        where: { parentId: existing.id },
      });
    }

    await prisma.category.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      message: "Categoria excluída com sucesso.",
      deleted: true,
    });
  } catch (error) {
    console.error("Erro ao excluir categoria:", error);
    return NextResponse.json({ error: "Erro ao excluir categoria." }, { status: 500 });
  }
}
