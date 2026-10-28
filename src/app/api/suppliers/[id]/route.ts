import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, createAuditLog, getClientIp } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { z } from "zod";

const updateSupplierSchema = z.object({
  name: z.string().min(1, "Nome do fornecedor é obrigatório").optional(),
  phone: z.string().min(1, "Telefone é obrigatório").optional(),
  email: z.string().email("E-mail inválido").optional().nullable().or(z.literal("")),
  document: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  active: z.boolean().optional(),
});

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  if (!can(user, "supplier:read")) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  try {
    const supplier = await prisma.supplier.findFirst({
      where: { id: params.id, organizationId: user.organizationId },
      include: {
        _count: { select: { transactions: true } },
      },
    });

    if (!supplier) {
      return NextResponse.json({ error: "Fornecedor não encontrado." }, { status: 404 });
    }

    return NextResponse.json({
      supplier: {
        ...supplier,
        transactionCount: supplier._count.transactions,
      },
    });
  } catch (error) {
    console.error("Erro ao buscar fornecedor:", error);
    return NextResponse.json({ error: "Erro ao buscar fornecedor." }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  if (!can(user, "supplier:write")) {
    return NextResponse.json(
      { error: "Acesso negado. Usuários com perfil de Consulta não podem editar fornecedores." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = updateSupplierSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Dados inválidos" },
        { status: 400 }
      );
    }

    const existing = await prisma.supplier.findFirst({
      where: { id: params.id, organizationId: user.organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Fornecedor não encontrado." }, { status: 404 });
    }

    const updateData: any = {};
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name.trim();
    if (parsed.data.phone !== undefined) updateData.phone = parsed.data.phone.trim();
    if (parsed.data.email !== undefined) updateData.email = parsed.data.email ? parsed.data.email.trim() : null;
    if (parsed.data.document !== undefined) updateData.document = parsed.data.document ? parsed.data.document.trim() : null;
    if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes ? parsed.data.notes.trim() : null;
    if (parsed.data.active !== undefined) updateData.active = parsed.data.active;

    const updated = await prisma.supplier.update({
      where: { id: params.id },
      data: updateData,
    });

    await createAuditLog({
      action: "USER_UPDATED",
      userId: user.userId,
      userName: user.name,
      details: `Fornecedor atualizado: "${updated.name}" (${updated.phone})`,
      organizationId: user.organizationId,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ supplier: updated });
  } catch (error) {
    console.error("Erro ao atualizar fornecedor:", error);
    return NextResponse.json({ error: "Erro ao atualizar fornecedor." }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  if (!can(user, "supplier:write")) {
    return NextResponse.json(
      { error: "Acesso negado. Usuários com perfil de Consulta não podem excluir fornecedores." },
      { status: 403 }
    );
  }

  try {
    const existing = await prisma.supplier.findFirst({
      where: { id: params.id, organizationId: user.organizationId },
      include: {
        _count: { select: { transactions: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Fornecedor não encontrado." }, { status: 404 });
    }

    // Se tiver transações associadas, desativa em vez de deletar para manter integridade
    if (existing._count.transactions > 0) {
      const deactivated = await prisma.supplier.update({
        where: { id: params.id },
        data: { active: false },
      });

      await createAuditLog({
        action: "USER_DEACTIVATED",
        userId: user.userId,
        userName: user.name,
        details: `Fornecedor desativado (possui ${existing._count.transactions} lançamentos): "${deactivated.name}"`,
        organizationId: user.organizationId,
        ipAddress: getClientIp(req),
      });

      return NextResponse.json({
        success: true,
        deactivated: true,
        message: "O fornecedor possui lançamentos vinculados e foi desativado para preservar o histórico.",
      });
    }

    // Sem lançamentos vinculados: exclusão permanente
    await prisma.supplier.delete({
      where: { id: params.id },
    });

    await createAuditLog({
      action: "USER_UPDATED",
      userId: user.userId,
      userName: user.name,
      details: `Fornecedor excluído: "${existing.name}"`,
      organizationId: user.organizationId,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true, message: "Fornecedor excluído com sucesso." });
  } catch (error) {
    console.error("Erro ao excluir fornecedor:", error);
    return NextResponse.json({ error: "Erro ao excluir fornecedor." }, { status: 500 });
  }
}
