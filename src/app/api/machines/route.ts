import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, createAuditLog, getClientIp } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { z } from "zod";

const machineSchema = z.object({
  name: z.string().min(1, "Nome da máquina é obrigatório"),
  location: z.string().optional().nullable(),
  active: z.boolean().optional().default(true),
});

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  if (!can(user, "machine:read")) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  try {
    let machines = await prisma.machine.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { stockMovements: true },
        },
      },
    });

    // Se não houver nenhuma máquina, cria e retorna automaticamente a "Máquina 01" padrão
    if (machines.length === 0) {
      const defaultMachine = await prisma.machine.create({
        data: {
          id: "default-machine-01",
          name: "Máquina 01 - Padrão",
          location: "Ponto Principal",
          active: true,
          organizationId: user.organizationId,
        },
        include: {
          _count: {
            select: { stockMovements: true },
          },
        },
      });
      machines = [defaultMachine];
    }

    const formatted = machines.map((m) => ({
      ...m,
      movementCount: m._count.stockMovements,
    }));

    return NextResponse.json({ machines: formatted });
  } catch (error) {
    console.error("Erro ao listar máquinas:", error);
    return NextResponse.json({ error: "Erro ao buscar máquinas." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  if (!can(user, "machine:write")) {
    return NextResponse.json(
      { error: "Acesso negado. Perfil sem permissão para cadastrar máquinas." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = machineSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Dados inválidos" },
        { status: 400 }
      );
    }

    const { name, location, active } = parsed.data;

    const machine = await prisma.machine.create({
      data: {
        name: name.trim(),
        location: location ? location.trim() : null,
        active: active ?? true,
        organizationId: user.organizationId,
      },
    });

    await createAuditLog({
      action: "MACHINE_CREATED",
      userId: user.userId,
      userName: user.name,
      details: `Criou a máquina "${machine.name}" (ID: ${machine.id})`,
      ipAddress: getClientIp(req),
      organizationId: user.organizationId,
    });

    return NextResponse.json({ machine }, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar máquina:", error);
    return NextResponse.json({ error: "Erro interno ao cadastrar máquina." }, { status: 500 });
  }
}

