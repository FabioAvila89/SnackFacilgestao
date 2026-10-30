import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, createAuditLog, getClientIp } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { z } from "zod";

const updateMachineSchema = z.object({
  name: z.string().min(1, "Nome da máquina é obrigatório").optional(),
  location: z.string().optional().nullable(),
  active: z.boolean().optional(),
});

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  if (!can(user, "machine:write")) {
    return NextResponse.json(
      { error: "Acesso negado. Perfil sem permissão para editar máquinas." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = updateMachineSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Dados inválidos" },
        { status: 400 }
      );
    }

    const existing = await prisma.machine.findFirst({
      where: { id: params.id, organizationId: user.organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Máquina não encontrada." }, { status: 404 });
    }

    const updateData: { name?: string; location?: string | null; active?: boolean } = {};
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name.trim();
    if (parsed.data.location !== undefined) {
      updateData.location = parsed.data.location ? parsed.data.location.trim() : null;
    }
    if (parsed.data.active !== undefined) updateData.active = parsed.data.active;

    const updated = await prisma.machine.update({
      where: { id: params.id },
      data: updateData,
    });

    await createAuditLog({
      action: "MACHINE_UPDATED",
      userId: user.userId,
      userName: user.name,
      details: `Atualizou a máquina "${updated.name}" (ID: ${updated.id})`,
      ipAddress: getClientIp(req),
      organizationId: user.organizationId,
    });

    return NextResponse.json({ machine: updated });
  } catch (error) {
    console.error("Erro ao atualizar máquina:", error);
    return NextResponse.json({ error: "Erro ao atualizar máquina." }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  if (!can(user, "machine:write")) {
    return NextResponse.json(
      { error: "Acesso negado. Perfil sem permissão para excluir máquinas." },
      { status: 403 }
    );
  }

  try {
    const existing = await prisma.machine.findFirst({
      where: { id: params.id, organizationId: user.organizationId },
      include: {
        _count: {
          select: { stockMovements: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Máquina não encontrada." }, { status: 404 });
    }

    // Se tiver movimentações vinculadas, realiza soft delete
    if (existing._count.stockMovements > 0) {
      await prisma.machine.update({
        where: { id: params.id },
        data: { active: false },
      });

      await createAuditLog({
        action: "MACHINE_UPDATED",
        userId: user.userId,
        userName: user.name,
        details: `Desativou a máquina "${existing.name}" (Soft Delete por possuir ${existing._count.stockMovements} movimentações)`,
        ipAddress: getClientIp(req),
        organizationId: user.organizationId,
      });

      return NextResponse.json({
        message: "Máquina desativada com sucesso para preservar o histórico de movimentações.",
        softDeleted: true,
      });
    }

    // Caso não tenha movimentações, pode excluir
    await prisma.machine.delete({
      where: { id: params.id },
    });

    await createAuditLog({
      action: "MACHINE_DELETED",
      userId: user.userId,
      userName: user.name,
      details: `Excluiu a máquina "${existing.name}" (ID: ${existing.id})`,
      ipAddress: getClientIp(req),
      organizationId: user.organizationId,
    });

    return NextResponse.json({ message: "Máquina removida com sucesso.", softDeleted: false });
  } catch (error) {
    console.error("Erro ao excluir máquina:", error);
    return NextResponse.json({ error: "Erro ao excluir máquina." }, { status: 500 });
  }
}

