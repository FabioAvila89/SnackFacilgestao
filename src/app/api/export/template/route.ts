import { NextResponse } from "next/server";
import ExcelJS from "exceljs";

export async function GET() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Modelo de Importacao");

  worksheet.columns = [
    { header: "data", key: "data", width: 14 },
    { header: "tipo", key: "tipo", width: 14 },
    { header: "valor", key: "valor", width: 16 },
    { header: "descricao", key: "descricao", width: 35 },
    { header: "categoria", key: "categoria", width: 30 },
    { header: "subcategoria", key: "subcategoria", width: 30 },
    { header: "conta", key: "conta", width: 22 },
  ];

  // Estiliza cabeçalho
  worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFEA580C" }, // Laranja brand-600
  };

  // Linhas de exemplo
  worksheet.addRow({
    data: "10/10/2026",
    tipo: "entrada",
    valor: "2.450,00",
    descricao: "Vendas máquinas ponto academia",
    categoria: "Vendas das máquinas",
    subcategoria: "Venda por cartão/pix",
    conta: "Conta Principal",
  });

  worksheet.addRow({
    data: "12/10/2026",
    tipo: "saida",
    valor: "450,00",
    descricao: "Aluguel ponto academia",
    categoria: "Ocupação (aluguel/energia do ponto, comissão do local)",
    subcategoria: "Aluguel e energia do ponto",
    conta: "Conta Principal",
  });

  worksheet.addRow({
    data: "15/10/2026",
    tipo: "saida",
    valor: "780,50",
    descricao: "Reposição salgadinhos e biscoitos",
    categoria: "Mercadoria para revenda",
    subcategoria: "Snacks e salgadinhos",
    conta: "Conta Principal",
  });

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="modelo_importacao_snack_facil.xlsx"`,
    },
  });
}
