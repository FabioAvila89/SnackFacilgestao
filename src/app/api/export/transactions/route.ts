import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import ExcelJS from "exceljs";
import { formatCentsToBRL, formatDateToBR } from "@/lib/formatters";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const search = url.searchParams.get("search")?.trim() || "";
  const kind = url.searchParams.get("kind");
  const accountId = url.searchParams.get("accountId");
  const categoryId = url.searchParams.get("categoryId");
  const startDateStr = url.searchParams.get("startDate");
  const endDateStr = url.searchParams.get("endDate");

  const where: any = { organizationId: user.organizationId };

  if (kind === "INCOME" || kind === "EXPENSE") where.kind = kind;
  if (accountId) where.accountId = accountId;

  if (categoryId) {
    const cat = await prisma.category.findUnique({
      where: { id: categoryId },
      include: { children: { select: { id: true } } },
    });
    if (cat && cat.children.length > 0) {
      where.categoryId = { in: [cat.id, ...cat.children.map((c) => c.id)] };
    } else {
      where.categoryId = categoryId;
    }
  }

  if (startDateStr || endDateStr) {
    where.date = {};
    if (startDateStr) {
      const s = new Date(startDateStr);
      s.setUTCHours(0, 0, 0, 0);
      where.date.gte = s;
    }
    if (endDateStr) {
      const e = new Date(endDateStr);
      e.setUTCHours(23, 59, 59, 999);
      where.date.lte = e;
    }
  }

  if (search) {
    where.OR = [
      { description: { contains: search, mode: "insensitive" } },
      { notes: { contains: search, mode: "insensitive" } },
    ];
  }

  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: {
      account: true,
      category: {
        include: { parent: true },
      },
      createdBy: {
        select: { name: true, email: true },
      },
    },
  });

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Lançamentos");

  worksheet.columns = [
    { header: "Data", key: "date", width: 14 },
    { header: "Tipo", key: "kind", width: 12 },
    { header: "Valor (R$)", key: "amount", width: 16 },
    { header: "Descrição", key: "description", width: 35 },
    { header: "Categoria", key: "category", width: 25 },
    { header: "Subcategoria", key: "subcategory", width: 25 },
    { header: "Conta", key: "account", width: 20 },
    { header: "Lançado por", key: "createdBy", width: 24 },
    { header: "Observações", key: "notes", width: 30 },
  ];

  // Estiliza cabeçalho
  worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFEA580C" }, // Laranja brand-600
  };

  transactions.forEach((t) => {
    const isSub = !!t.category.parentId;
    const catName = isSub ? t.category.parent?.name || "" : t.category.name;
    const subName = isSub ? t.category.name : "";

    worksheet.addRow({
      date: formatDateToBR(t.date),
      kind: t.kind === "INCOME" ? "Entrada" : "Saída",
      amount: t.amountCents / 100,
      description: t.description,
      category: catName,
      subcategory: subName,
      account: t.account.name,
      createdBy: t.createdBy?.name || "Sistema",
      notes: t.notes || "",
    });
  });

  // Formata coluna de valores
  worksheet.getColumn(3).numFmt = "R$ #,##0.00";

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="lancamentos_snack_facil_${new Date().toISOString().split("T")[0]}.xlsx"`,
    },
  });
}
