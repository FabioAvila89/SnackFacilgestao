import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getCurrentUser,
  hashPassword,
  generateSecureTemporaryPassword,
  createAuditLog,
  getClientIp,
} from "@/lib/auth";
import { can, Role } from "@/lib/permissions";
import { z } from "zod";

const createUserSchema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  email: z.string().email("E-mail inválido"),
  role: z.enum(["ADMIN", "EDITOR", "VIEWER"]),
});

export async function GET(req: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (!can(currentUser, "access_management:view")) {
    return NextResponse.json(
      { error: "Acesso negado. Recurso restrito a administradores." },
      { status: 403 }
    );
  }

  const url = new URL(req.url);
  const search = url.searchParams.get("search")?.toLowerCase().trim() || "";
  const status = url.searchParams.get("status") || "ALL";

  const where: any = {
    organizationId: currentUser.organizationId,
  };

  if (status === "ACTIVE") {
    where.active = true;
  } else if (status === "INACTIVE") {
    where.active = false;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  const users = await prisma.user.findMany({
    where,
    orderBy: [{ role: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      mustChangePassword: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ users });
}

export async function POST(req: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  if (!can(currentUser, "user:create")) {
    return NextResponse.json(
      { error: "Acesso negado. Apenas administradores podem cadastrar novos usuários." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = createUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Dados inválidos." },
        { status: 400 }
      );
    }

    const { name, role } = parsed.data;
    const normalizedEmail = parsed.data.email.toLowerCase().trim();

    // Verifica se já existe usuário com o e-mail
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Já existe um usuário cadastrado com este endereço de e-mail." },
        { status: 400 }
      );
    }

    // Gera senha temporária aleatória de alta entropia
    const temporaryPassword = generateSecureTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);

    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        role: role as Role,
        active: true,
        mustChangePassword: true,
        sessionVersion: 1,
        organizationId: currentUser.organizationId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        mustChangePassword: true,
        createdAt: true,
      },
    });

    const ip = getClientIp(req);
    await createAuditLog({
      action: "USER_CREATED",
      userId: currentUser.userId,
      userName: currentUser.name,
      targetUserId: newUser.id,
      targetUserName: newUser.name,
      details: `Usuário cadastrado com o perfil "${role}". Senha temporária gerada pelo sistema.`,
      ipAddress: ip,
      organizationId: currentUser.organizationId,
    });

    return NextResponse.json(
      {
        user: newUser,
        temporaryPassword,
        message: "Usuário cadastrado com sucesso. A senha temporária deve ser informada ao usuário para troca no primeiro acesso.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erro ao cadastrar usuário:", error);
    return NextResponse.json(
      { error: "Erro interno no servidor ao criar usuário." },
      { status: 500 }
    );
  }
}
