import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCurrentUser,
  hashPassword,
  createSessionToken,
  setSessionCookie,
  createAuditLog,
  getClientIp,
} from "@/lib/auth";
import { validatePasswordPolicy } from "@/lib/permissions";
import { z } from "zod";

const changePasswordSchema = z.object({
  newPassword: z.string().min(10, "A nova senha deve ter no mínimo 10 caracteres."),
  confirmPassword: z.string().min(10, "A confirmação da nova senha é obrigatória."),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = changePasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Dados inválidos." },
        { status: 400 }
      );
    }

    const { newPassword, confirmPassword } = parsed.data;

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: "A nova senha e a confirmação não coincidem." },
        { status: 400 }
      );
    }

    const policyCheck = validatePasswordPolicy(newPassword);
    if (!policyCheck.valid) {
      return NextResponse.json(
        { error: policyCheck.message || "A senha não atende aos requisitos mínimos de segurança." },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(newPassword);
    const newSessionVersion = user.sessionVersion + 1;

    await prisma.user.update({
      where: { id: user.userId },
      data: {
        passwordHash,
        mustChangePassword: false,
        sessionVersion: newSessionVersion,
      },
    });

    const ip = getClientIp(req);
    await createAuditLog({
      action: "PASSWORD_CHANGED",
      userId: user.userId,
      userName: user.name,
      targetUserId: user.userId,
      targetUserName: user.name,
      details: "Troca obrigatória de senha concluída no primeiro acesso",
      ipAddress: ip,
      organizationId: user.organizationId,
    });

    // Gera novo token com a nova versão de sessão e sem restrição de troca
    const token = await createSessionToken({
      userId: user.userId,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organizationId,
      sessionVersion: newSessionVersion,
      mustChangePassword: false,
    });

    await setSessionCookie(token);

    return NextResponse.json({
      success: true,
      message: "Senha atualizada com sucesso. Bem-vindo ao sistema!",
    });
  } catch (error) {
    console.error("Erro ao alterar senha obrigatória:", error);
    return NextResponse.json(
      { error: "Erro ao processar a troca de senha. Tente novamente." },
      { status: 500 }
    );
  }
}
