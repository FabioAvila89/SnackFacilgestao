import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import ExcelJS from "exceljs";
import { calculateDRE, RawTransactionInput } from "@/lib/finance-engine";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const period = url.searchParams.get("period") || "month";
  const startDateParam = url.searchParams.get("startDate");
  const endDateParam = url.searchParams.get("endDate");

  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth();

  let curStart: Date;
  let curEnd: Date;
  let prevStart: Date;
  let prevEnd: Date;
  let curLabel = "";
  let prevLabel = "";

  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];

  if (period === "month") {
    curStart = new Date(Date.UTC(currentYear, currentMonth, 1));
    curEnd = new Date(Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59, 999));
    curLabel = `${monthNames[currentMonth]}/${currentYear}`;

    prevStart = new Date(Date.UTC(currentYear, currentMonth - 1, 1));
    prevEnd = new Date(Date.UTC(currentYear, currentMonth, 0, 23, 59, 59, 999));
    prevLabel = `${monthNames[prevStart.getUTCMonth()]}/${prevStart.getUTCFullYear()}`;
  } else if (period === "quarter") {
    const q = Math.floor(currentMonth / 3);
    curStart = new Date(Date.UTC(currentYear, q * 3, 1));
    curEnd = new Date(Date.UTC(currentYear, (q + 1) * 3, 0, 23, 59, 59, 999));
    curLabel = `${q + 1}º Trim/${currentYear}`;

    prevStart = new Date(Date.UTC(currentYear, (q - 1) * 3, 1));
    prevEnd = new Date(Date.UTC(currentYear, q * 3, 0, 23, 59, 59, 999));
    const prevQ = (q - 1 + 4) % 4;
    prevLabel = `${prevQ + 1}º Trim/${prevStart.getUTCFullYear()}`;
  } else if (period === "year") {
    curStart = new Date(Date.UTC(currentYear, 0, 1));
    curEnd = new Date(Date.UTC(currentYear, 11, 31, 23, 59, 59, 999));
    curLabel = `Ano ${currentYear}`;

    prevStart = new Date(Date.UTC(currentYear - 1, 0, 1));
    prevEnd = new Date(Date.UTC(currentYear - 1, 11, 31, 23, 59, 59, 999));
    prevLabel = `Ano ${currentYear - 1}`;
  } else if (period === "custom" && startDateParam && endDateParam) {
    curStart = new Date(startDateParam);
    curStart.setUTCHours(0, 0, 0, 0);
    curEnd = new Date(endDateParam);
    curEnd.setUTCHours(23, 59, 59, 999);
    curLabel = `${startDateParam} a ${endDateParam}`;

    const durationMs = curEnd.getTime() - curStart.getTime();
    prevEnd = new Date(curStart.getTime() - 1);
    prevStart = new Date(prevEnd.getTime() - durationMs);
    prevLabel = "Período Anterior";
  } else {
    curStart = new Date(Date.UTC(currentYear, currentMonth, 1));
    curEnd = new Date(Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59, 999));
    curLabel = `${monthNames[currentMonth]}/${currentYear}`;
    prevStart = new Date(Date.UTC(currentYear, currentMonth - 1, 1));
    prevEnd = new Date(Date.UTC(currentYear, currentMonth, 0, 23, 59, 59, 999));
    prevLabel = `${monthNames[prevStart.getUTCMonth()]}/${prevStart.getUTCFullYear()}`;
  }

  const allTx = await prisma.transaction.findMany({
    where: {
      organizationId: user.organizationId,
      date: { gte: prevStart, lte: curEnd },
    },
    include: {
      account: { select: { name: true } },
      category: {
        select: {
          id: true,
          name: true,
          parentId: true,
          parent: { select: { name: true } },
          dreLine: true,
        },
      },
    },
  });

  const curTx: RawTransactionInput[] = [];
  const prevTx: RawTransactionInput[] = [];

  for (const t of allTx) {
    const raw: RawTransactionInput = {
      id: t.id,
      date: t.date,
      kind: t.kind as "INCOME" | "EXPENSE",
      amountCents: t.amountCents,
      description: t.description,
      accountId: t.accountId,
      accountName: t.account.name,
      categoryId: t.categoryId,
      categoryName: t.category.name,
      categoryParentId: t.category.parentId,
      categoryParentName: t.category.parent?.name || null,
      categoryDreLine: t.category.dreLine as any,
    };
    if (t.date >= curStart && t.date <= curEnd) curTx.push(raw);
    else if (t.date >= prevStart && t.date <= prevEnd) prevTx.push(raw);
  }

  const dre = calculateDRE(curTx, prevTx, curLabel, prevLabel);

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("DRE");

  worksheet.columns = [
    { header: "Linha / Descrição", key: "line", width: 45 },
    { header: `Atual (${curLabel})`, key: "curVal", width: 22 },
    { header: "Margem Atual (%)", key: "curMargin", width: 18 },
    { header: `Anterior (${prevLabel})`, key: "prevVal", width: 22 },
    { header: "Margem Ant. (%)", key: "prevMargin", width: 18 },
    { header: "Variação (R$)", key: "changeVal", width: 20 },
    { header: "Variação (%)", key: "changePct", width: 16 },
  ];

  worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0F172A" }, // Slate 900
  };

  dre.rows.forEach((row) => {
    const r = worksheet.addRow({
      line: row.name,
      curVal: row.currentCents / 100,
      curMargin: row.currentMarginPercent !== null ? row.currentMarginPercent / 100 : "—",
      prevVal: row.previousCents / 100,
      prevMargin: row.previousMarginPercent !== null ? row.previousMarginPercent / 100 : "—",
      changeVal: row.changeCents / 100,
      changePct: row.changePercent !== null ? row.changePercent / 100 : "—",
    });

    if (row.isCalculated) {
      r.font = { bold: true };
      r.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF1F5F9" }, // Slate 100
      };
    }
  });

  // Linha em branco
  worksheet.addRow({});

  // Seção Fora do DRE
  const foraRow = worksheet.addRow({
    line: "FORA DO DRE (Investimentos / Aquisições de máquinas)",
    curVal: dre.foraDreTotalCents / 100,
  });
  foraRow.font = { bold: true, italic: true };

  // Aviso legal no rodapé
  worksheet.addRow({});
  const noteRow = worksheet.addRow({
    line: "Aviso: DRE em regime de caixa. O custo das mercadorias reflete as compras do período, não o estoque consumido.",
  });
  noteRow.font = { italic: true, color: { argb: "FF64748B" } };

  worksheet.getColumn(2).numFmt = "R$ #,##0.00";
  worksheet.getColumn(4).numFmt = "R$ #,##0.00";
  worksheet.getColumn(6).numFmt = "R$ #,##0.00";

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="dre_snack_facil_${period}.xlsx"`,
    },
  });
}
