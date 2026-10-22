import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { z } from "zod";

const updateAccountSchema = z.object({
  name: z.string().min(2).optional(),
  type: z.enum(["BANK", "CASH", "CARD"]).optional(),
  initialBalanceCents: z.number().int().optional(),
  active: z.boolean().optional(),
});

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { can } = await import("@/lib/permissions");
  if (!can(user, "account:write")) {
    return NextResponse.json(
      { error: "Acesso negado. Apenas administradores podem alterar contas." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = updateAccountSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Dados inválidos" },
        { status: 400 }
      );
    }

    const existing = await prisma.account.findFirst({
      where: { id: params.id, organizationId: user.organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
    }

    const updated = await prisma.account.update({
      where: { id: params.id },
      data: parsed.data,
    });

    return NextResponse.json({ account: updated });
  } catch (error) {
    console.error("Erro ao atualizar conta:", error);
    return NextResponse.json({ error: "Erro ao atualizar conta." }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { can } = await import("@/lib/permissions");
  if (!can(user, "account:write")) {
    return NextResponse.json(
      { error: "Acesso negado. Apenas administradores podem desativar ou excluir contas." },
      { status: 403 }
    );
  }

  try {
    const existing = await prisma.account.findFirst({
      where: { id: params.id, organizationId: user.organizationId },
      include: {
        _count: {
          select: { transactions: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
    }

    // Regra crítica: se já tem lançamentos, não pode ser excluída, só desativada
    if (existing._count.transactions > 0) {
      const deactivated = await prisma.account.update({
        where: { id: params.id },
        data: { active: false },
      });
      return NextResponse.json({
        message: "A conta possui lançamentos históricos e foi desativada em vez de excluída.",
        account: deactivated,
        deactivated: true,
      });
    }

    await prisma.account.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      message: "Conta excluída com sucesso.",
      deleted: true,
    });
  } catch (error) {
    console.error("Erro ao remover conta:", error);
    return NextResponse.json({ error: "Erro ao remover conta." }, { status: 500 });
  }
}
