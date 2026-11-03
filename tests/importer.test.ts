import { describe, it, expect } from "vitest";
import {
  parseCSVContent,
  parseXLSXBuffer,
  validateImportCandidates,
  normalizeHeaderKey,
  getColumnValue,
  KnownAccountLookup,
  KnownCategoryLookup,
} from "../src/lib/importer";
import ExcelJS from "exceljs";

describe("importer tests", () => {
  const mockAccounts: KnownAccountLookup[] = [
    { id: "acc-1", name: "Conta Principal", active: true },
    { id: "acc-2", name: "Inter", active: true },
    { id: "acc-3", name: "Conta Inativa", active: false },
  ];

  const mockCategories: KnownCategoryLookup[] = [
    {
      id: "cat-1",
      name: "Vendas das máquinas",
      kind: "INCOME",
      parentId: null,
      parentName: null,
    },
    {
      id: "sub-1",
      name: "Venda em dinheiro",
      kind: "INCOME",
      parentId: "cat-1",
      parentName: "Vendas das máquinas",
    },
    {
      id: "cat-2",
      name: "Impostos sobre vendas",
      kind: "EXPENSE",
      parentId: null,
      parentName: null,
    },
    {
      id: "sub-2",
      name: "Simples Nacional",
      kind: "EXPENSE",
      parentId: "cat-2",
      parentName: "Impostos sobre vendas",
    },
  ];

  it("normaliza chaves de cabeçalho corretamente", () => {
    expect(normalizeHeaderKey("Valor (R$)")).toBe("valor (r$)");
    expect(normalizeHeaderKey("Descrição")).toBe("descricao");
    expect(normalizeHeaderKey("Lançado por")).toBe("lancado por");
    expect(normalizeHeaderKey("Observações")).toBe("observacoes");
  });

  it("extrai valores com diferentes variações de nomes de coluna", () => {
    const rowObj = {
      "valor (r$)": "1.500,00",
      descricao: "Venda teste",
    };

    const valor = getColumnValue(
      rowObj,
      ["valor", "valor (r$)", "amount", "total"],
      /^(valor|amount)/i
    );
    expect(valor).toBe("1.500,00");
  });

  it("processa CSV com cabeçalhos exportados como 'Valor (R$)' e 'Descrição'", () => {
    const csv = `Data,Vencimento,Status,Tipo,Valor (R$),Descrição,Fornecedor,Categoria,Subcategoria,Conta,Lançado por,Observações
01/11/2026,01/11/2026,Recebido,Entrada,8765,Teste,,Vendas das máquinas,Venda em dinheiro,Inter,Sócio Snack Fácil,Primeira venda
31/10/2026,,Recebido,Entrada,1000,teste,,Vendas das máquinas,,Conta Principal,Sócio Snack Fácil,`;

    const candidates = parseCSVContent(csv);
    expect(candidates).toHaveLength(2);
    expect(candidates[0].valorRaw).toBe("8765");
    expect(candidates[0].descricaoRaw).toBe("Teste");
    expect(candidates[0].contaRaw).toBe("Inter");
    expect(candidates[0].categoriaRaw).toBe("Vendas das máquinas");
    expect(candidates[0].subcategoriaRaw).toBe("Venda em dinheiro");
    expect(candidates[0].observacoesRaw).toBe("Primeira venda");

    const result = validateImportCandidates(candidates, mockAccounts, mockCategories);
    expect(result.invalidRowsCount).toBe(0);
    expect(result.validRowsCount).toBe(2);
    expect(result.rows[0].amountCents).toBe(876500);
    expect(result.rows[0].notes).toBe("Primeira venda");
    expect(result.rows[1].amountCents).toBe(100000);
  });

  it("processa XLSX com cabeçalho 'Valor (R$)' e formato numérico", async () => {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet("Lançamentos");

    ws.columns = [
      { header: "Data", key: "date" },
      { header: "Vencimento", key: "dueDate" },
      { header: "Status", key: "status" },
      { header: "Tipo", key: "kind" },
      { header: "Valor (R$)", key: "amount" },
      { header: "Descrição", key: "description" },
      { header: "Fornecedor", key: "supplier" },
      { header: "Categoria", key: "category" },
      { header: "Subcategoria", key: "subcategory" },
      { header: "Conta", key: "account" },
      { header: "Lançado por", key: "createdBy" },
      { header: "Observações", key: "notes" },
    ];

    ws.addRow({
      date: "01/11/2026",
      dueDate: "01/11/2026",
      status: "Recebido",
      kind: "Entrada",
      amount: 8765,
      description: "Teste",
      category: "Vendas das máquinas",
      subcategory: "Venda em dinheiro",
      account: "Inter",
    });

    ws.addRow({
      date: "31/10/2026",
      dueDate: "23/10/2026",
      status: "A Pagar",
      kind: "Saída",
      amount: 10000,
      description: "teste (1/5)",
      category: "Impostos sobre vendas",
      subcategory: "Simples Nacional",
      account: "Conta Principal",
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const candidates = await parseXLSXBuffer(buffer);

    expect(candidates).toHaveLength(2);
    expect(candidates[0].valorRaw).toBe("8765");
    expect(candidates[1].valorRaw).toBe("10000");

    const result = validateImportCandidates(candidates, mockAccounts, mockCategories);
    expect(result.invalidRowsCount).toBe(0);
    expect(result.validRowsCount).toBe(2);
    expect(result.rows[0].amountCents).toBe(876500);
    expect(result.rows[1].amountCents).toBe(1000000);
  });

  it("valida conflito de tipos de categoria (receita vs despesa)", () => {
    const candidates = [
      {
        rowIndex: 2,
        dataRaw: "01/11/2026",
        tipoRaw: "Entrada",
        valorRaw: "150,00",
        descricaoRaw: "Tentando lançar despesa como entrada",
        categoriaRaw: "Impostos sobre vendas",
        contaRaw: "Inter",
      },
    ];

    const result = validateImportCandidates(candidates, mockAccounts, mockCategories);
    expect(result.invalidRowsCount).toBe(1);
    expect(result.rows[0].errors[0]).toContain("Conflito de tipo");
  });

  it("valida contas inativas ou não encontradas", () => {
    const candidates = [
      {
        rowIndex: 2,
        dataRaw: "01/11/2026",
        tipoRaw: "Entrada",
        valorRaw: "150,00",
        descricaoRaw: "Conta fantasma",
        categoriaRaw: "Vendas das máquinas",
        contaRaw: "Banco Inexistente",
      },
      {
        rowIndex: 3,
        dataRaw: "01/11/2026",
        tipoRaw: "Entrada",
        valorRaw: "150,00",
        descricaoRaw: "Conta desativada",
        categoriaRaw: "Vendas das máquinas",
        contaRaw: "Conta Inativa",
      },
    ];

    const result = validateImportCandidates(candidates, mockAccounts, mockCategories);
    expect(result.invalidRowsCount).toBe(2);
    expect(result.rows[0].errors[0]).toContain("não encontrada");
    expect(result.rows[1].errors[0]).toContain("está desativada");
  });
});

