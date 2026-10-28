import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, createAuditLog, getClientIp } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { z } from "zod";

const supplierSchema = z.object({
  name: z.string().min(1, "Nome do fornecedor é obrigatório"),
  phone: z.string().min(1, "Telefone é obrigatório"),
  email: z.string().email("E-mail inválido").optional().nullable().or(z.literal("")),
  document: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  active: z.boolean().optional().default(true),
});

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  if (!can(user, "supplier:read")) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  const url = new URL(req.url);
  const search = url.searchParams.get("search")?.trim() || "";
  const status = url.searchParams.get("status") || "ALL"; // ALL | ACTIVE | INACTIVE

  const where: any = {
    organizationId: user.organizationId,
  };

  if (status === "ACTIVE") {
    where.active = true;
  } else if (status === "INACTIVE") {
    where.active = false;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { document: { contains: search, mode: "insensitive" } },
      { notes: { contains: search, mode: "insensitive" } },
    ];
  }

  try {
    const suppliers = await prisma.supplier.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { transactions: true },
        },
      },
    });

    const formatted = suppliers.map((s) => ({
      ...s,
      transactionCount: s._count.transactions,
    }));

    return NextResponse.json({ suppliers: formatted });
  } catch (error) {
    console.error("Erro ao listar fornecedores:", error);
    return NextResponse.json({ error: "Erro ao buscar fornecedores." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  if (!can(user, "supplier:write")) {
    return NextResponse.json(
      { error: "Acesso negado. Usuários com perfil de Consulta não podem cadastrar fornecedores." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = supplierSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Dados inválidos" },
        { status: 400 }
      );
    }

    const { name, phone, email, document, notes, active } = parsed.data;

    const supplier = await prisma.supplier.create({
      data: {
        name: name.trim(),
        phone: phone.trim(),
        email: email ? email.trim() : null,
        document: document ? document.trim() : null,
        notes: notes ? notes.trim() : null,
        active: active ?? true,
        organizationId: user.organizationId,
      },
    });

    await createAuditLog({
      action: "USER_UPDATED",
      userId: user.userId,
      userName: user.name,
      details: `Fornecedor cadastrado: "${supplier.name}" (${supplier.phone})`,
      organizationId: user.organizationId,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ supplier }, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar fornecedor:", error);
    return NextResponse.json({ error: "Erro ao criar fornecedor." }, { status: 500 });
  }
}
