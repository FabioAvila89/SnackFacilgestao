import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, createAuditLog, getClientIp } from "@/lib/auth";
import { can, Role } from "@/lib/permissions";
import { z } from "zod";

const updateUserSchema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").optional(),
  email: z.string().email("E-mail inválido").optional(),
  role: z.enum(["ADMIN", "EDITOR", "VIEWER"]).optional(),
});

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (!can(currentUser, "user:update")) {
    return NextResponse.json(
      { error: "Acesso negado. Apenas administradores podem editar usuários." },
      { status: 403 }
    );
  }

  try {
    const targetUser = await prisma.user.findUnique({
      where: { id: params.id },
    });

    if (!targetUser || targetUser.organizationId !== currentUser.organizationId) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    const body = await req.json();
    const parsed = updateUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Dados inválidos." },
        { status: 400 }
      );
    }

    const { name, email, role } = parsed.data;
    const updateData: any = {};
    const changes: string[] = [];

    if (name && name.trim() !== targetUser.name) {
      updateData.name = name.trim();
      changes.push(`Nome alterado de "${targetUser.name}" para "${name.trim()}"`);
    }

    if (email) {
      const normalizedEmail = email.toLowerCase().trim();
      if (normalizedEmail !== targetUser.email) {
        // Valida unicidade
        const existing = await prisma.user.findUnique({
          where: { email: normalizedEmail },
        });
        if (existing && existing.id !== targetUser.id) {
          return NextResponse.json(
            { error: "Já existe outro usuário cadastrado com este e-mail." },
            { status: 400 }
          );
        }
        updateData.email = normalizedEmail;
        changes.push(`E-mail alterado de "${targetUser.email}" para "${normalizedEmail}"`);
      }
    }

    if (role && role !== targetUser.role) {
      // Regra crítica: Não é permitido rebaixar o último administrador ativo
      if (targetUser.role === "ADMIN" && role !== "ADMIN") {
        const activeAdmins = await prisma.user.count({
          where: {
            organizationId: currentUser.organizationId,
            role: "ADMIN",
            active: true,
          },
        });

        if (activeAdmins <= 1 && targetUser.active) {
          return NextResponse.json(
            {
              error: "Não é permitido alterar o perfil do único administrador ativo da empresa.",
            },
            { status: 400 }
          );
        }
      }

      updateData.role = role as Role;
      // Invalida sessões ativas do usuário ao alterar seu perfil
      updateData.sessionVersion = targetUser.sessionVersion + 1;
      changes.push(`Perfil alterado de "${targetUser.role}" para "${role}"`);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({
        user: {
          id: targetUser.id,
          name: targetUser.name,
          email: targetUser.email,
          role: targetUser.role,
          active: targetUser.active,
        },
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: targetUser.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        mustChangePassword: true,
        updatedAt: true,
      },
    });

    const ip = getClientIp(req);
    await createAuditLog({
      action: "USER_UPDATED",
      userId: currentUser.userId,
      userName: currentUser.name,
      targetUserId: updatedUser.id,
      targetUserName: updatedUser.name,
      details: changes.join("; "),
      ipAddress: ip,
      organizationId: currentUser.organizationId,
    });

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    console.error("Erro ao atualizar usuário:", error);
    return NextResponse.json(
      { error: "Erro interno no servidor ao atualizar usuário." },
      { status: 500 }
    );
  }
}

const toggleStatusSchema = z.object({
  active: z.boolean(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (!can(currentUser, "user:toggle_status")) {
    return NextResponse.json(
      { error: "Acesso negado. Apenas administradores podem ativar ou desativar contas." },
      { status: 403 }
    );
  }

  try {
    const targetUser = await prisma.user.findUnique({
      where: { id: params.id },
    });

    if (!targetUser || targetUser.organizationId !== currentUser.organizationId) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    const body = await req.json();
    const parsed = toggleStatusSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Parâmetro 'active' inválido." }, { status: 400 });
    }

    const { active } = parsed.data;

    // Regra 1: Administrador não pode desativar a si mesmo
    if (targetUser.id === currentUser.userId && !active) {
      return NextResponse.json(
        { error: "Você não pode desativar o seu próprio usuário." },
        { status: 400 }
      );
    }

    // Regra 2: Não desativar o último administrador ativo
    if (targetUser.role === "ADMIN" && !active && targetUser.active) {
      const activeAdmins = await prisma.user.count({
        where: {
          organizationId: currentUser.organizationId,
          role: "ADMIN",
          active: true,
        },
      });

      if (activeAdmins <= 1) {
        return NextResponse.json(
          { error: "Não é permitido desativar o único administrador ativo do sistema." },
          { status: 400 }
        );
      }
    }

    // Ao desativar ou reativar, incrementa sessionVersion para derrubar sessões abertas
    const updated = await prisma.user.update({
      where: { id: targetUser.id },
      data: {
        active,
        sessionVersion: targetUser.sessionVersion + 1,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
      },
    });

    const ip = getClientIp(req);
    await createAuditLog({
      action: active ? "USER_ACTIVATED" : "USER_DEACTIVATED",
      userId: currentUser.userId,
      userName: currentUser.name,
      targetUserId: targetUser.id,
      targetUserName: targetUser.name,
      details: active ? "Conta ativada" : "Conta desativada e sessões ativas canceladas",
      ipAddress: ip,
      organizationId: currentUser.organizationId,
    });

    return NextResponse.json({
      success: true,
      user: updated,
      message: active ? "Usuário ativado com sucesso." : "Usuário desativado com sucesso.",
    });
  } catch (error) {
    console.error("Erro ao alterar status do usuário:", error);
    return NextResponse.json(
      { error: "Erro interno no servidor ao alterar status do usuário." },
      { status: 500 }
    );
  }
}

// Exclusão definitiva de usuário com validação de perfil e auditoria
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (!can(currentUser, "user:delete")) {
    return NextResponse.json(
      { error: "Acesso negado. Apenas administradores podem excluir usuários." },
      { status: 403 }
    );
  }

  try {
    const targetUser = await prisma.user.findUnique({
      where: { id: params.id },
    });

    if (!targetUser || targetUser.organizationId !== currentUser.organizationId) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    // Regra 1: Administrador não pode excluir a si mesmo
    if (targetUser.id === currentUser.userId) {
      return NextResponse.json(
        { error: "Você não pode excluir o seu próprio usuário." },
        { status: 400 }
      );
    }

    // Regra 2: Não excluir o único administrador ativo
    if (targetUser.role === "ADMIN" && targetUser.active) {
      const activeAdmins = await prisma.user.count({
        where: {
          organizationId: currentUser.organizationId,
          role: "ADMIN",
          active: true,
        },
      });

      if (activeAdmins <= 1) {
        return NextResponse.json(
          { error: "Não é permitido excluir o único administrador ativo do sistema." },
          { status: 400 }
        );
      }
    }

    // Executa a exclusão definitiva do usuário
    await prisma.user.delete({
      where: { id: targetUser.id },
    });

    const ip = getClientIp(req);
    await createAuditLog({
      action: "USER_DELETED",
      userId: currentUser.userId,
      userName: currentUser.name,
      targetUserId: targetUser.id,
      targetUserName: targetUser.name,
      details: `Usuário ${targetUser.name} (${targetUser.email}) excluído permanentemente do sistema`,
      ipAddress: ip,
      organizationId: currentUser.organizationId,
    });

    return NextResponse.json({
      success: true,
      message: "Usuário excluído com sucesso.",
    });
  } catch (error) {
    console.error("Erro ao excluir usuário:", error);
    return NextResponse.json(
      { error: "Erro interno no servidor ao excluir usuário." },
      { status: 500 }
    );
  }
}
