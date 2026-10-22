import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { z } from "zod";

const rowSchema = z.object({
  date: z.string(),
  kind: z.enum(["INCOME", "EXPENSE"]),
  amountCents: z.number().int().positive(),
  description: z.string().min(1),
  accountId: z.string().min(1),
  categoryId: z.string().min(1),
  notes: z.string().nullable().optional(),
});

const confirmSchema = z.object({
  mode: z.enum(["ONLY_VALID", "ALL_OR_NOTHING"]),
  rows: z.array(rowSchema),
  hasErrors: z.boolean(),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { can } = await import("@/lib/permissions");
  if (!can(user, "import:execute")) {
    return NextResponse.json(
      { error: "Acesso negado. Usuários com perfil de Consulta (VIEWER) não possuem permissão para importar lançamentos." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const parsed = confirmSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Dados inválidos" },
        { status: 400 }
      );
    }

    const { mode, rows, hasErrors } = parsed.data;

    if (mode === "ALL_OR_NOTHING" && hasErrors) {
      return NextResponse.json(
        { error: "A importação foi cancelada pois continha linhas com erros e o modo 'Cancelar tudo em caso de erro' foi selecionado." },
        { status: 400 }
      );
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: "Nenhuma linha válida para importar." }, { status: 400 });
    }

    // Grava no banco de dados em transação única
    await prisma.$transaction(
      rows.map((r) => {
        const d = new Date(r.date);
        d.setUTCHours(12, 0, 0, 0);
        return prisma.transaction.create({
          data: {
            date: d,
            kind: r.kind,
            amountCents: r.amountCents,
            description: r.description.trim(),
            accountId: r.accountId,
            categoryId: r.categoryId,
            notes: r.notes || null,
            organizationId: user.organizationId,
            createdById: user.userId,
          },
        });
      })
    );

    return NextResponse.json({
      success: true,
      importedCount: rows.length,
      message: `${rows.length} lançamentos importados com sucesso!`,
    });
  } catch (error) {
    console.error("Erro ao confirmar importação:", error);
    return NextResponse.json({ error: "Erro ao gravar transações no banco." }, { status: 500 });
  }
}
