import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  parseCSVContent,
  parseXLSXBuffer,
  validateImportCandidates,
  ImportRowCandidate,
} from "@/lib/importer";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
    }

    // Limite de tamanho: 10MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Arquivo muito grande. Limite de 10MB." }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    let candidates: ImportRowCandidate[] = [];

    if (fileName.endsWith(".csv")) {
      const text = await file.text();
      candidates = parseCSVContent(text);
    } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      const arrayBuffer = await file.arrayBuffer();
      candidates = await parseXLSXBuffer(Buffer.from(arrayBuffer));
    } else {
      return NextResponse.json(
        { error: "Formato não suportado. Por favor envie um arquivo .csv ou .xlsx." },
        { status: 400 }
      );
    }

    if (candidates.length === 0) {
      return NextResponse.json(
        { error: "O arquivo enviado não contém nenhuma linha de dados legível." },
        { status: 400 }
      );
    }

    // Carrega contas e categorias do banco
    const accounts = await prisma.account.findMany({
      where: { organizationId: user.organizationId },
      select: { id: true, name: true, active: true },
    });

    const categories = await prisma.category.findMany({
      where: { organizationId: user.organizationId },
      select: {
        id: true,
        name: true,
        kind: true,
        parentId: true,
        parent: { select: { name: true } },
      },
    });

    const knownAccounts = accounts.map((a) => ({
      id: a.id,
      name: a.name,
      active: a.active,
    }));

    const knownCategories = categories.map((c) => ({
      id: c.id,
      name: c.name,
      kind: c.kind as "INCOME" | "EXPENSE",
      parentId: c.parentId,
      parentName: c.parent?.name || null,
    }));

    const preview = validateImportCandidates(candidates, knownAccounts, knownCategories);

    return NextResponse.json({ preview });
  } catch (error) {
    console.error("Erro na pré-visualização de importação:", error);
    return NextResponse.json(
      { error: "Falha ao processar o arquivo para importação." },
      { status: 500 }
    );
  }
}
