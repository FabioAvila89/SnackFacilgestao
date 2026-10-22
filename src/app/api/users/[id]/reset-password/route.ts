import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCurrentUser,
  hashPassword,
  generateSecureTemporaryPassword,
  createAuditLog,
  getClientIp,
} from "@/lib/auth";
import { can } from "@/lib/permissions";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (!can(currentUser, "user:reset_password")) {
    return NextResponse.json(
      { error: "Acesso negado. Apenas administradores podem redefinir senhas." },
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

    const temporaryPassword = generateSecureTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);

    // Invalida sessões anteriores, zera falhas e força troca no próximo login
    await prisma.user.update({
      where: { id: targetUser.id },
      data: {
        passwordHash,
        mustChangePassword: true,
        sessionVersion: targetUser.sessionVersion + 1,
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });

    const ip = getClientIp(req);
    await createAuditLog({
      action: "PASSWORD_RESET",
      userId: currentUser.userId,
      userName: currentUser.name,
      targetUserId: targetUser.id,
      targetUserName: targetUser.name,
      details: "Senha temporária redefinida pelo administrador. Sessões ativas canceladas e troca no próximo login exigida.",
      ipAddress: ip,
      organizationId: currentUser.organizationId,
    });

    return NextResponse.json({
      success: true,
      temporaryPassword,
      message: "Nova senha temporária gerada com sucesso. Copie e transmita ao usuário com segurança.",
    });
  } catch (error) {
    console.error("Erro ao redefinir senha do usuário:", error);
    return NextResponse.json(
      { error: "Erro interno no servidor ao redefinir senha." },
      { status: 500 }
    );
  }
}
