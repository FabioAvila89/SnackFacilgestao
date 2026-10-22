import { describe, it, expect } from "vitest";
import {
  calculateAccountBalance,
  calculateMonthlyFlow,
  calculateExpensesByCategory,
  calculateDRE,
  calculateSafeVariationPercent,
  calculateSafeMarginPercent,
  RawTransactionInput,
} from "../src/lib/finance-engine";
import {
  formatCentsToBRL,
  parseBRLToCents,
  parseBRDateToDate,
  formatDateToBR,
} from "../src/lib/formatters";
import { validateImportCandidates, ImportRowCandidate } from "../src/lib/importer";

describe("1. Cálculo de saldo de conta", () => {
  it("calcula saldo correto com entradas e saídas sobre saldo inicial", () => {
    const initialBalance = 100000; // R$ 1.000,00
    const transactions = [
      { kind: "INCOME" as const, amountCents: 50000 }, // + R$ 500,00
      { kind: "EXPENSE" as const, amountCents: 30000 }, // - R$ 300,00
      { kind: "INCOME" as const, amountCents: 2500 }, // + R$ 25,00
    ];

    const result = calculateAccountBalance(initialBalance, transactions);

    expect(result.initialBalanceCents).toBe(100000);
    expect(result.totalIncomeCents).toBe(52500);
    expect(result.totalExpenseCents).toBe(30000);
    expect(result.currentBalanceCents).toBe(122500); // R$ 1.225,00
  });

  it("retorna saldo inicial quando não há movimentação", () => {
    const result = calculateAccountBalance(50000, []);
    expect(result.currentBalanceCents).toBe(50000);
  });
});

describe("2. Agregação Entradas x Saídas por mês (com meses vazios preenchidos com zero)", () => {
  it("gera todos os meses do intervalo e preenche meses vazios com 0", () => {
    const startDate = new Date(Date.UTC(2026, 0, 1)); // jan/2026
    const endDate = new Date(Date.UTC(2026, 2, 31)); // mar/2026

    // Apenas lançamentos em janeiro e março, fevereiro vazio
    const transactions = [
      { date: new Date(Date.UTC(2026, 0, 15)), kind: "INCOME" as const, amountCents: 10000 },
      { date: new Date(Date.UTC(2026, 0, 20)), kind: "EXPENSE" as const, amountCents: 4000 },
      { date: new Date(Date.UTC(2026, 2, 5)), kind: "INCOME" as const, amountCents: 8000 },
    ];

    const flow = calculateMonthlyFlow(transactions, startDate, endDate, 0);

    expect(flow).toHaveLength(3);

    // Janeiro
    expect(flow[0].month).toBe("2026-01");
    expect(flow[0].incomeCents).toBe(10000);
    expect(flow[0].expenseCents).toBe(4000);
    expect(flow[0].resultCents).toBe(6000);
    expect(flow[0].accumulatedBalanceCents).toBe(6000);

    // Fevereiro (deve existir com zero)
    expect(flow[1].month).toBe("2026-02");
    expect(flow[1].incomeCents).toBe(0);
    expect(flow[1].expenseCents).toBe(0);
    expect(flow[1].resultCents).toBe(0);
    expect(flow[1].accumulatedBalanceCents).toBe(6000);

    // Março
    expect(flow[2].month).toBe("2026-03");
    expect(flow[2].incomeCents).toBe(8000);
    expect(flow[2].expenseCents).toBe(0);
    expect(flow[2].resultCents).toBe(8000);
    expect(flow[2].accumulatedBalanceCents).toBe(14000);
  });
});

describe("3. Gastos por categoria com subcategorias e percentuais", () => {
  it("agrega categorias e subcategorias e calcula percentuais com precisão", () => {
    const transactions: RawTransactionInput[] = [
      {
        id: "1",
        date: new Date(Date.UTC(2026, 0, 10)),
        kind: "EXPENSE",
        amountCents: 60000, // R$ 600,00
        description: "Refrigerantes",
        accountId: "acc1",
        categoryId: "sub1",
        categoryName: "Bebidas",
        categoryParentId: "cat1",
        categoryParentName: "Mercadoria para revenda",
      },
      {
        id: "2",
        date: new Date(Date.UTC(2026, 0, 12)),
        kind: "EXPENSE",
        amountCents: 40000, // R$ 400,00
        description: "Snacks",
        accountId: "acc1",
        categoryId: "sub2",
        categoryName: "Salgados",
        categoryParentId: "cat1",
        categoryParentName: "Mercadoria para revenda",
      },
      {
        id: "3",
        date: new Date(Date.UTC(2026, 0, 15)),
        kind: "EXPENSE",
        amountCents: 100000, // R$ 1.000,00
        description: "Aluguel ponto",
        accountId: "acc1",
        categoryId: "cat2",
        categoryName: "Ocupação",
        categoryParentId: null,
      },
    ];

    const { items, totalCents } = calculateExpensesByCategory(transactions, "EXPENSE");

    expect(totalCents).toBe(200000); // Total: R$ 2.000,00
    expect(items).toHaveLength(2);

    // Ocupação: 100.000 / 200.000 = 50%
    // Mercadoria: 100.000 / 200.000 = 50%
    const mercadoria = items.find((i) => i.categoryName === "Mercadoria para revenda")!;
    expect(mercadoria).toBeDefined();
    expect(mercadoria.amountCents).toBe(100000);
    expect(mercadoria.percentage).toBe(50);
    expect(mercadoria.subcategories).toHaveLength(2);
    expect(mercadoria.subcategories[0].name).toBe("Bebidas");
    expect(mercadoria.subcategories[0].percentage).toBe(60); // 60000 / 100000
    expect(mercadoria.subcategories[1].name).toBe("Salgados");
    expect(mercadoria.subcategories[1].percentage).toBe(40);
  });
});

describe("4. DRE (Demonstração do Resultado do Exercício)", () => {
  it("calcula todas as linhas do DRE, margens, variação e exclui FORA_DRE do resultado líquido", () => {
    const currentTx: RawTransactionInput[] = [
      // 1. Receita Bruta = R$ 10.000
      {
        id: "c1",
        date: new Date(Date.UTC(2026, 0, 10)),
        kind: "INCOME",
        amountCents: 1000000,
        description: "Vendas máquinas",
        accountId: "a1",
        categoryId: "cat-vendas",
        categoryDreLine: "RECEITA_BRUTA",
      },
      // 2. Deduções = R$ 500
      {
        id: "c2",
        date: new Date(Date.UTC(2026, 0, 12)),
        kind: "EXPENSE",
        amountCents: 50000,
        description: "Taxas cartão",
        accountId: "a1",
        categoryId: "cat-taxas",
        categoryDreLine: "DEDUCOES",
      },
      // 3. CMV = R$ 3.000
      {
        id: "c3",
        date: new Date(Date.UTC(2026, 0, 14)),
        kind: "EXPENSE",
        amountCents: 300000,
        description: "Estoque salgadinhos",
        accountId: "a1",
        categoryId: "cat-cmv",
        categoryDreLine: "CMV",
      },
      // 4. Despesas Operacionais = R$ 2.000
      {
        id: "c4",
        date: new Date(Date.UTC(2026, 0, 15)),
        kind: "EXPENSE",
        amountCents: 200000,
        description: "Aluguel ponto",
        accountId: "a1",
        categoryId: "cat-operacional",
        categoryDreLine: "DESPESAS_OPERACIONAIS",
      },
      // 5. Receitas Financeiras = R$ 100
      {
        id: "c5",
        date: new Date(Date.UTC(2026, 0, 20)),
        kind: "INCOME",
        amountCents: 10000,
        description: "Rendimento CDB",
        accountId: "a1",
        categoryId: "cat-rec-fin",
        categoryDreLine: "RECEITAS_FINANCEIRAS",
      },
      // 6. Despesas Financeiras = R$ 50
      {
        id: "c6",
        date: new Date(Date.UTC(2026, 0, 22)),
        kind: "EXPENSE",
        amountCents: 5000,
        description: "Tarifa bancária",
        accountId: "a1",
        categoryId: "cat-desp-fin",
        categoryDreLine: "DESPESAS_FINANCEIRAS",
      },
      // 7. Impostos sobre o Lucro = R$ 200
      {
        id: "c7",
        date: new Date(Date.UTC(2026, 0, 25)),
        kind: "EXPENSE",
        amountCents: 20000,
        description: "IRPJ/CSLL",
        accountId: "a1",
        categoryId: "cat-imp-lucro",
        categoryDreLine: "IMPOSTOS_LUCRO",
      },
      // Item FORA_DRE = R$ 5.000 (Aquisição de máquina)
      {
        id: "c8",
        date: new Date(Date.UTC(2026, 0, 28)),
        kind: "EXPENSE",
        amountCents: 500000,
        description: "Compra de nova máquina",
        accountId: "a1",
        categoryId: "cat-invest",
        categoryDreLine: "FORA_DRE",
      },
    ];

    const prevTx: RawTransactionInput[] = [
      {
        id: "p1",
        date: new Date(Date.UTC(2025, 11, 10)),
        kind: "INCOME",
        amountCents: 800000, // R$ 8.000
        description: "Vendas mês anterior",
        accountId: "a1",
        categoryId: "cat-vendas",
        categoryDreLine: "RECEITA_BRUTA",
      },
    ];

    const dre = calculateDRE(currentTx, prevTx, "jan/2026", "dez/2025");

    const rowMap = new Map(dre.rows.map((r) => [r.key, r]));

    // Receita Bruta = 1.000.000
    expect(rowMap.get("RECEITA_BRUTA")?.currentCents).toBe(1000000);
    // Deduções = 50.000
    expect(rowMap.get("DEDUCOES")?.currentCents).toBe(50000);
    // Receita Líquida = 1.000.000 - 50.000 = 950.000
    const recLiq = rowMap.get("RECEITA_LIQUIDA")!;
    expect(recLiq.currentCents).toBe(950000);

    // CMV = 300.000
    // Lucro Bruto = 950.000 - 300.000 = 650.000
    const lucroBruto = rowMap.get("LUCRO_BRUTO")!;
    expect(lucroBruto.currentCents).toBe(650000);
    // Margem Lucro Bruto: (650.000 / 950.000) * 100 = 68.42%
    expect(lucroBruto.currentMarginPercent).toBeCloseTo(68.42, 1);

    // Desp. Operacionais = 200.000
    // Resultado Operacional = 650.000 - 200.000 = 450.000
    const resOp = rowMap.get("RESULTADO_OPERACIONAL")!;
    expect(resOp.currentCents).toBe(450000);

    // Rec. Fin (10.000) - Desp. Fin (5.000) = +5.000
    // Resultado Antes Impostos = 450.000 + 5.000 = 455.000
    const resAntesImp = rowMap.get("RESULTADO_ANTES_IMPOSTOS")!;
    expect(resAntesImp.currentCents).toBe(455000);

    // Impostos Lucro = 20.000
    // Resultado Líquido = 455.000 - 20.000 = 435.000
    const resLiq = rowMap.get("RESULTADO_LIQUIDO")!;
    expect(resLiq.currentCents).toBe(435000);
    // Margem líquida: (435.000 / 950.000) * 100 = 45.78%
    expect(resLiq.currentMarginPercent).toBeCloseTo(45.78, 1);

    // Itens FORA_DRE não devem interferir no Resultado Líquido (435.000 mantido)
    expect(dre.foraDreTotalCents).toBe(500000);
    expect(dre.foraDreItems.length).toBeGreaterThan(0);
  });

  it("trata divisão por zero nas margens e variações sem gerar NaN ou Infinity", () => {
    // Variação com base anterior zerada
    const varZero = calculateSafeVariationPercent(100, 0);
    expect(varZero).toBeNull(); // Deve ser nulo ("—")

    // Margem sobre receita líquida zerada ou negativa
    const marginZero = calculateSafeMarginPercent(500, 0);
    expect(marginZero).toBeNull();
    const marginNeg = calculateSafeMarginPercent(500, -100);
    expect(marginNeg).toBeNull();
  });
});

describe("5. Formatação e parsing de Moeda e Datas Brasileiras", () => {
  it("converte valores em moeda brasileira para centavos inteiros", () => {
    expect(parseBRLToCents("1.234,56")).toBe(123456);
    expect(parseBRLToCents("R$ 1.234,56")).toBe(123456);
    expect(parseBRLToCents("1234,50")).toBe(123450);
    expect(parseBRLToCents("100")).toBe(10000);
    expect(parseBRLToCents(50.25)).toBe(5025);
  });

  it("formata centavos para moeda BRL (R$ 1.234,56)", () => {
    expect(formatCentsToBRL(123456)).toBe("R$ 1.234,56");
    expect(formatCentsToBRL(50)).toBe("R$ 0,50");
    expect(formatCentsToBRL(-15000)).toBe("-R$ 150,00");
  });

  it("converte datas dd/mm/aaaa e formata corretamente", () => {
    const d = parseBRDateToDate("21/10/2026");
    expect(d).not.toBeNull();
    expect(d?.getUTCFullYear()).toBe(2026);
    expect(d?.getUTCMonth()).toBe(9); // 0-indexed, 9 = outubro
    expect(d?.getUTCDate()).toBe(21);
    expect(formatDateToBR(d!)).toBe("21/10/2026");
  });
});

describe("6. Validação e Importação de Lançamentos", () => {
  const knownAccounts = [
    { id: "acc1", name: "Conta Principal", active: true },
    { id: "acc2", name: "Conta Inativa", active: false },
  ];

  const knownCategories = [
    {
      id: "cat1",
      name: "Vendas das máquinas",
      kind: "INCOME" as const,
      parentId: null,
    },
    {
      id: "sub1",
      name: "Venda por cartão/pix",
      kind: "INCOME" as const,
      parentId: "cat1",
      parentName: "Vendas das máquinas",
    },
    {
      id: "cat2",
      name: "Mercadoria para revenda",
      kind: "EXPENSE" as const,
      parentId: null,
    },
  ];

  it("valida linhas corretas e detecta linhas com erros específicos", () => {
    const candidates: ImportRowCandidate[] = [
      // Linha 1: Válida
      {
        rowIndex: 2,
        dataRaw: "15/10/2026",
        tipoRaw: "entrada",
        valorRaw: "1.500,00",
        descricaoRaw: "Venda final de semana",
        categoriaRaw: "Vendas das máquinas",
        subcategoriaRaw: "Venda por cartão/pix",
        contaRaw: "Conta Principal",
      },
      // Linha 2: Data inválida
      {
        rowIndex: 3,
        dataRaw: "99/99/2026",
        tipoRaw: "saída",
        valorRaw: "200,00",
        descricaoRaw: "Compra teste",
        categoriaRaw: "Mercadoria para revenda",
        contaRaw: "Conta Principal",
      },
      // Linha 3: Valor zero / negativo
      {
        rowIndex: 4,
        dataRaw: "10/10/2026",
        tipoRaw: "saída",
        valorRaw: "0,00",
        descricaoRaw: "Teste valor",
        categoriaRaw: "Mercadoria para revenda",
        contaRaw: "Conta Principal",
      },
      // Linha 4: Conflito de tipo (entrada x categoria de despesa)
      {
        rowIndex: 5,
        dataRaw: "10/10/2026",
        tipoRaw: "entrada",
        valorRaw: "300,00",
        descricaoRaw: "Conflito",
        categoriaRaw: "Mercadoria para revenda",
        contaRaw: "Conta Principal",
      },
      // Linha 5: Conta inativa
      {
        rowIndex: 6,
        dataRaw: "10/10/2026",
        tipoRaw: "entrada",
        valorRaw: "300,00",
        descricaoRaw: "Conta inativa",
        categoriaRaw: "Vendas das máquinas",
        contaRaw: "Conta Inativa",
      },
    ];

    const result = validateImportCandidates(candidates, knownAccounts, knownCategories);

    expect(result.totalRows).toBe(5);
    expect(result.validRowsCount).toBe(1);
    expect(result.invalidRowsCount).toBe(4);

    // Linha 1 válida
    expect(result.rows[0].isValid).toBe(true);
    expect(result.rows[0].amountCents).toBe(150000);
    expect(result.rows[0].accountId).toBe("acc1");
    expect(result.rows[0].categoryId).toBe("sub1");

    // Linha 2 com erro de data
    expect(result.rows[1].isValid).toBe(false);
    expect(result.rows[1].errors.some((e) => e.includes("Data inválida"))).toBe(true);

    // Linha 3 com erro de valor
    expect(result.rows[2].isValid).toBe(false);
    expect(result.rows[2].errors.some((e) => e.includes("maior que zero"))).toBe(true);

    // Linha 4 com conflito de kind
    expect(result.rows[3].isValid).toBe(false);
    expect(result.rows[3].errors.some((e) => e.includes("Conflito de tipo"))).toBe(true);

    // Linha 5 com conta inativa
    expect(result.rows[4].isValid).toBe(false);
    expect(result.rows[4].errors.some((e) => e.includes("desativada"))).toBe(true);
  });
});
