import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCurrentUser,
  verifyPassword,
  hashPassword,
  createSessionToken,
  setSessionCookie,
  createAuditLog,
  getClientIp,
  invalidateUserSessionCache,
} from "@/lib/auth";
import { validatePasswordPolicy } from "@/lib/permissions";
import { z } from "zod";

const updateMeSchema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().optional(),
  confirmPassword: z.string().optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  // Retorna diretamente dados autenticados já validados pelo getCurrentUser (com cache)
  return NextResponse.json({
    user: {
      id: user.userId,
      name: user.name,
      email: user.email,
      role: user.role,
      active: user.active,
      mustChangePassword: user.mustChangePassword,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    },
  });
}

export async function PUT(req: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = updateMeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Dados inválidos." },
        { status: 400 }
      );
    }

    const { name, currentPassword, newPassword, confirmPassword } = parsed.data;

    const userInDb = await prisma.user.findUnique({
      where: { id: currentUser.userId },
    });

    if (!userInDb) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    const updateData: any = {};
    const auditChanges: string[] = [];
    let sessionVersion = userInDb.sessionVersion;

    if (name && name.trim() !== userInDb.name) {
      updateData.name = name.trim();
      auditChanges.push(`Nome alterado de "${userInDb.name}" para "${name.trim()}"`);
    }

    // Se o usuário solicitou alteração de senha
    if (newPassword || currentPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: "Informe sua senha atual para definir uma nova senha." },
          { status: 400 }
        );
      }

      if (!newPassword) {
        return NextResponse.json(
          { error: "A nova senha não pode ser vazia." },
          { status: 400 }
        );
      }

      const isValidCurrent = await verifyPassword(currentPassword, userInDb.passwordHash);
      if (!isValidCurrent) {
        return NextResponse.json(
          { error: "A senha atual está incorreta." },
          { status: 400 }
        );
      }

      if (newPassword !== confirmPassword) {
        return NextResponse.json(
          { error: "A nova senha e a confirmação não coincidem." },
          { status: 400 }
        );
      }

      const policyCheck = validatePasswordPolicy(newPassword);
      if (!policyCheck.valid) {
        return NextResponse.json(
          { error: policyCheck.message },
          { status: 400 }
        );
      }

      updateData.passwordHash = await hashPassword(newPassword);
      updateData.mustChangePassword = false;
      // Incrementa sessionVersion para invalidar outras sessões abertas
      sessionVersion = userInDb.sessionVersion + 1;
      updateData.sessionVersion = sessionVersion;
      auditChanges.push("Senha alterada pelo próprio usuário (demais sessões encerradas)");
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({
        user: {
          id: userInDb.id,
          name: userInDb.name,
          email: userInDb.email,
          role: userInDb.role,
        },
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userInDb.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        mustChangePassword: true,
      },
    });

    const ip = getClientIp(req);
    await createAuditLog({
      action: newPassword ? "PASSWORD_CHANGED" : "USER_UPDATED",
      userId: currentUser.userId,
      userName: updatedUser.name,
      targetUserId: currentUser.userId,
      targetUserName: updatedUser.name,
      details: auditChanges.join("; "),
      ipAddress: ip,
      organizationId: currentUser.organizationId,
    });

    // Invalida cache de sessão em memória
    invalidateUserSessionCache(currentUser.userId);

    // Se a versão da sessão mudou (troca de senha) ou o nome mudou, renova o cookie do usuário corrente
    const newToken = await createSessionToken({
      userId: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      role: updatedUser.role as any,
      organizationId: currentUser.organizationId,
      sessionVersion,
      mustChangePassword: updatedUser.mustChangePassword,
    });
    await setSessionCookie(newToken);

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message: "Dados atualizados com sucesso.",
    });
  } catch (error) {
    console.error("Erro ao atualizar perfil do usuário:", error);
    return NextResponse.json(
      { error: "Erro interno no servidor ao atualizar perfil." },
      { status: 500 }
    );
  }
}
