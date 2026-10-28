import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { Role } from "./permissions";
import crypto from "crypto";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "snack-facil-segredo-super-seguro-troque-em-producao-2026"
);

export const COOKIE_NAME = "snack_auth_session";

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  role: Role;
  organizationId: string;
  sessionVersion: number;
  mustChangePassword?: boolean;
}

export interface AuthenticatedUser extends SessionPayload {
  active: boolean;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(JWT_SECRET);
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      name: payload.name as string,
      role: (payload.role as Role) || "EDITOR",
      organizationId: payload.organizationId as string,
      sessionVersion: typeof payload.sessionVersion === "number" ? payload.sessionVersion : 1,
      mustChangePassword: !!payload.mustChangePassword,
    };
  } catch (err) {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const cookieStore = cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 dias
  });
}

export async function clearSessionCookie() {
  const cookieStore = cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Retorna o usuário autenticado na requisição.
 * Invalida imediatamente se o usuário foi desativado ou se sua sessão foi revogada (sessionVersion incompatível).
 */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;

    const payload = await verifySessionToken(token);
    if (!payload) return null;

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        mustChangePassword: true,
        sessionVersion: true,
        organizationId: true,
      },
    });

    if (!user) return null;
    // Invalidação imediata para usuário inativo
    if (!user.active) return null;
    // Invalidação de sessão quando alterado perfil, redefinida senha ou desativado
    if (user.sessionVersion !== payload.sessionVersion) return null;

    return {
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Role,
      active: user.active,
      mustChangePassword: user.mustChangePassword,
      sessionVersion: user.sessionVersion,
      organizationId: user.organizationId,
    };
  } catch (e) {
    return null;
  }
}

/**
 * Gera senha temporária aleatória e segura (14 caracteres)
 */
export function generateSecureTemporaryPassword(): string {
  const lettersUpper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lettersLower = "abcdefghijkmnpqrstuvwxyz";
  const numbers = "23456789";
  const symbols = "!@#$%&*";
  const allChars = lettersUpper + lettersLower + numbers + symbols;

  let pwd = "";
  pwd += lettersUpper[crypto.randomInt(0, lettersUpper.length)];
  pwd += lettersLower[crypto.randomInt(0, lettersLower.length)];
  pwd += numbers[crypto.randomInt(0, numbers.length)];
  pwd += symbols[crypto.randomInt(0, symbols.length)];

  for (let i = 0; i < 10; i++) {
    pwd += allChars[crypto.randomInt(0, allChars.length)];
  }

  // Embaralha
  return pwd
    .split("")
    .sort(() => crypto.randomInt(-1, 2))
    .join("");
}

export interface AuditLogInput {
  action:
    | "LOGIN_SUCCESS"
    | "LOGIN_FAILED"
    | "LOGIN_LOCKED"
    | "USER_CREATED"
    | "USER_UPDATED"
    | "USER_ACTIVATED"
    | "USER_DEACTIVATED"
    | "USER_DELETED"
    | "PASSWORD_RESET"
    | "PASSWORD_CHANGED";
  userId?: string | null;
  userName?: string | null;
  targetUserId?: string | null;
  targetUserName?: string | null;
  details?: string | null;
  ipAddress?: string | null;
  organizationId?: string;
}

/**
 * Registra atividade no log de auditoria
 */
export async function createAuditLog(entry: AuditLogInput) {
  try {
    await prisma.auditLog.create({
      data: {
        action: entry.action,
        userId: entry.userId || null,
        userName: entry.userName || null,
        targetUserId: entry.targetUserId || null,
        targetUserName: entry.targetUserName || null,
        details: entry.details || null,
        ipAddress: entry.ipAddress || null,
        organizationId: entry.organizationId || "default-org",
      },
    });
  } catch (err) {
    console.error("Falha ao registrar log de auditoria:", err);
  }
}

/**
 * Extrai IP da requisição
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "127.0.0.1";
}
