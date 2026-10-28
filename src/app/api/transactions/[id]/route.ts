import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, createAuditLog, getClientIp } from "@/lib/auth";
import { z } from "zod";

const updateTransactionSchema = z.object({
  date: z.string().min(1).optional(),
  kind: z.enum(["INCOME", "EXPENSE"]).optional(),
  amountCents: z.number().int().positive().optional(),
  description: z.string().min(1).optional(),
  accountId: z.string().min(1).optional(),
  categoryId: z.string().min(1).optional(),
  notes: z.string().nullable().optional(),
  status: z.enum(["PAID", "PENDING"]).optional(),
  dueDate: z.string().nullable().optional(),
  supplierId: z.string().nullable().optional(),
  isRecurring: z.boolean().optional(),
  recurrenceFrequency: z.enum(["MONTHLY", "WEEKLY", "YEARLY"]).nullable().optional(),
});

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { can } = await import("@/lib/permissions");
  if (!can(user, "transaction:edit")) {
    return NextResponse.json(
      { error: "Acesso negado. Usuários com perfil de Consulta (VIEWER) não possuem permissão para alterar lançamentos." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = updateTransactionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Dados inválidos" },
        { status: 400 }
      );
    }

    const existing = await prisma.transaction.findFirst({
      where: { id: params.id, organizationId: user.organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Lançamento não encontrado." }, { status: 404 });
    }

    const updateData: any = {
      updatedById: user.userId,
    };
    if (parsed.data.description) updateData.description = parsed.data.description.trim();
    if (parsed.data.amountCents) updateData.amountCents = parsed.data.amountCents;
    if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;

    if (parsed.data.status !== undefined) {
      updateData.status = parsed.data.status;
      if (parsed.data.status === "PAID") {
        updateData.paidAt = new Date();
      } else {
        updateData.paidAt = null;
      }
    }

    if (parsed.data.dueDate !== undefined) {
      if (parsed.data.dueDate) {
        const d = new Date(parsed.data.dueDate);
        d.setUTCHours(12, 0, 0, 0);
        updateData.dueDate = d;
      } else {
        updateData.dueDate = null;
      }
    }

    if (parsed.data.supplierId !== undefined) {
      updateData.supplierId = parsed.data.supplierId || null;
    }

    if (parsed.data.isRecurring !== undefined) {
      updateData.isRecurring = parsed.data.isRecurring;
      updateData.recurrenceFrequency = parsed.data.isRecurring ? (parsed.data.recurrenceFrequency || "MONTHLY") : null;
    }

    if (parsed.data.date) {
      const d = new Date(parsed.data.date);
      d.setUTCHours(12, 0, 0, 0);
      updateData.date = d;
    }

    const targetKind = parsed.data.kind || existing.kind;
    const targetCategoryId = parsed.data.categoryId || existing.categoryId;

    if (parsed.data.accountId) {
      const account = await prisma.account.findFirst({
        where: { id: parsed.data.accountId, organizationId: user.organizationId },
      });
      if (!account) return NextResponse.json({ error: "Conta não encontrada" }, { status: 400 });
      updateData.accountId = parsed.data.accountId;
    }

    if (parsed.data.categoryId || parsed.data.kind) {
      const category = await prisma.category.findFirst({
        where: { id: targetCategoryId, organizationId: user.organizationId },
      });
      if (!category) return NextResponse.json({ error: "Categoria não encontrada" }, { status: 400 });

      if (category.kind !== targetKind) {
        return NextResponse.json(
          {
            error: `Conflito de tipo: categoria é de ${category.kind === "INCOME" ? "entrada" : "saída"}, mas o lançamento é de ${targetKind === "INCOME" ? "entrada" : "saída"}.`,
          },
          { status: 400 }
        );
      }
      updateData.kind = targetKind;
      updateData.categoryId = targetCategoryId;
    }

    const updated = await prisma.transaction.update({
      where: { id: params.id },
      data: updateData,
      include: {
        account: true,
        category: true,
        supplier: true,
        createdBy: { select: { id: true, name: true, email: true } },
        updatedBy: { select: { id: true, name: true, email: true } },
      },
    });

    await createAuditLog({
      action: "USER_UPDATED",
      userId: user.userId,
      userName: user.name,
      details: `Lançamento "${updated.description}" atualizado${
        parsed.data.isRecurring !== undefined
          ? ` (recorrência: ${parsed.data.isRecurring ? "ativada" : "encerrada"})`
          : ""
      }`,
      organizationId: user.organizationId,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ transaction: updated });
  } catch (error) {
    console.error("Erro ao atualizar lançamento:", error);
    return NextResponse.json({ error: "Erro ao atualizar lançamento." }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  // Reutiliza o fluxo do PUT
  return PUT(req, { params });
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { can } = await import("@/lib/permissions");
  if (!can(user, "transaction:delete")) {
    return NextResponse.json(
      { error: "Acesso negado. Usuários com perfil de Consulta (VIEWER) não possuem permissão para excluir lançamentos." },
      { status: 403 }
    );
  }

  try {
    const existing = await prisma.transaction.findFirst({
      where: { id: params.id, organizationId: user.organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Lançamento não encontrado." }, { status: 404 });
    }

    await prisma.transaction.delete({
      where: { id: params.id },
    });

    await createAuditLog({
      action: "USER_UPDATED",
      userId: user.userId,
      userName: user.name,
      details: `Lançamento "${existing.description}" excluído`,
      organizationId: user.organizationId,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true, message: "Lançamento excluído com sucesso." });
  } catch (error) {
    console.error("Erro ao excluir lançamento:", error);
    return NextResponse.json({ error: "Erro ao excluir lançamento." }, { status: 500 });
  }
}
