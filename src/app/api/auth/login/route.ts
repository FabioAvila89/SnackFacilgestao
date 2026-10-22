import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyPassword,
  createSessionToken,
  setSessionCookie,
  createAuditLog,
  getClientIp,
} from "@/lib/auth";
import { Role } from "@/lib/permissions";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "A senha é obrigatória"),
});

// Rate limiter em memória por IP (caso o e-mail não exista ou seja spoofado)
const ipAttempts = new Map<string, { count: number; lockedUntil?: number }>();

function checkIpRateLimit(ip: string): { blocked: boolean; minutesRemaining?: number } {
  const now = Date.now();
  const entry = ipAttempts.get(ip);
  if (!entry) return { blocked: false };

  if (entry.lockedUntil && entry.lockedUntil > now) {
    const minutesRemaining = Math.ceil((entry.lockedUntil - now) / (60 * 1000));
    return { blocked: true, minutesRemaining };
  }

  if (entry.lockedUntil && entry.lockedUntil <= now) {
    ipAttempts.delete(ip);
    return { blocked: false };
  }

  return { blocked: false };
}

function registerIpFailure(ip: string) {
  const now = Date.now();
  const entry = ipAttempts.get(ip) || { count: 0 };
  entry.count += 1;

  if (entry.count >= 5) {
    entry.lockedUntil = now + 15 * 60 * 1000; // 15 minutos
  }
  ipAttempts.set(ip, entry);
}

function resetIpAttempts(ip: string) {
  ipAttempts.delete(ip);
}

export async function POST(req: Request) {
  const ip = getClientIp(req);

  try {
    const ipCheck = checkIpRateLimit(ip);
    if (ipCheck.blocked) {
      return NextResponse.json(
        {
          error: `Muitas tentativas incorretas deste endereço. Tente novamente em ${ipCheck.minutesRemaining} minuto(s).`,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "E-mail ou senha inválidos." },
        { status: 400 }
      );
    }

    const normalizedEmail = parsed.data.email.toLowerCase().trim();
    const { password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Se o usuário não existir: registra falha no IP e mensagem genérica
    if (!user) {
      registerIpFailure(ip);
      await createAuditLog({
        action: "LOGIN_FAILED",
        userName: normalizedEmail,
        details: "Tentativa de login com e-mail não cadastrado",
        ipAddress: ip,
      });

      return NextResponse.json(
        { error: "E-mail ou senha inválidos." },
        { status: 401 }
      );
    }

    // Verifica bloqueio por tentativas no usuário
    const now = new Date();
    if (user.lockedUntil && user.lockedUntil > now) {
      const remainingMinutes = Math.ceil((user.lockedUntil.getTime() - now.getTime()) / (60 * 1000));
      return NextResponse.json(
        {
          error: `Conta temporariamente bloqueada por excesso de tentativas. Tente novamente em ${remainingMinutes} minuto(s).`,
        },
        { status: 429 }
      );
    }

    // Verifica se usuário está inativo
    if (!user.active) {
      await createAuditLog({
        action: "LOGIN_FAILED",
        userId: user.id,
        userName: user.name,
        targetUserId: user.id,
        targetUserName: user.name,
        details: "Tentativa de login de usuário inativo/desativado",
        ipAddress: ip,
        organizationId: user.organizationId,
      });

      return NextResponse.json(
        { error: "Usuário desativado. Entre em contato com o administrador." },
        { status: 403 }
      );
    }

    // Valida senha
    const isValid = await verifyPassword(password, user.passwordHash);

    if (!isValid) {
      const nextFailedCount = user.failedLoginCount + 1;
      registerIpFailure(ip);

      if (nextFailedCount >= 5) {
        const lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos de bloqueio
        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginCount: nextFailedCount,
            lockedUntil,
          },
        });

        await createAuditLog({
          action: "LOGIN_LOCKED",
          userId: user.id,
          userName: user.name,
          targetUserId: user.id,
          targetUserName: user.name,
          details: "Conta bloqueada por 15 minutos após 5 tentativas de senha incorreta",
          ipAddress: ip,
          organizationId: user.organizationId,
        });

        return NextResponse.json(
          {
            error: "Muitas tentativas incorretas. Conta bloqueada por 15 minutos.",
          },
          { status: 429 }
        );
      } else {
        await prisma.user.update({
          where: { id: user.id },
          data: { failedLoginCount: nextFailedCount },
        });

        await createAuditLog({
          action: "LOGIN_FAILED",
          userId: user.id,
          userName: user.name,
          targetUserId: user.id,
          targetUserName: user.name,
          details: `Senha incorreta (tentativa ${nextFailedCount} de 5)`,
          ipAddress: ip,
          organizationId: user.organizationId,
        });

        return NextResponse.json(
          { error: "E-mail ou senha inválidos." },
          { status: 401 }
        );
      }
    }

    // Sucesso: reseta contadores de falhas e atualiza lastLoginAt
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    resetIpAttempts(ip);

    await createAuditLog({
      action: "LOGIN_SUCCESS",
      userId: user.id,
      userName: user.name,
      targetUserId: user.id,
      targetUserName: user.name,
      details: "Login efetuado com sucesso",
      ipAddress: ip,
      organizationId: user.organizationId,
    });

    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Role,
      organizationId: user.organizationId,
      sessionVersion: user.sessionVersion,
      mustChangePassword: user.mustChangePassword,
    });

    await setSessionCookie(token);

    return NextResponse.json({
      success: true,
      mustChangePassword: user.mustChangePassword,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Erro no login:", error);
    return NextResponse.json(
      { error: "Erro interno no servidor ao tentar autenticar." },
      { status: 500 }
    );
  }
}
