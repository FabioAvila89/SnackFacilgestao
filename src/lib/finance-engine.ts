import {
  DreLine,
  DreReport,
  DreRow,
  MonthlyFlowItem,
  CategoryExpenseItem,
} from "./types";

export interface RawTransactionInput {
  id: string;
  date: Date;
  kind: "INCOME" | "EXPENSE";
  amountCents: number;
  description: string;
  accountId: string;
  accountName?: string;
  categoryId: string;
  categoryName?: string;
  categoryParentId?: string | null;
  categoryParentName?: string | null;
  categoryDreLine?: DreLine;
}

export interface RawAccountInput {
  id: string;
  name: string;
  type: string;
  initialBalanceCents: number;
  active: boolean;
}

/**
 * Calcula saldo de uma conta a partir do saldo inicial e transações
 * Lançamentos com status "PENDING" não afetam o saldo realizado em conta/caixa.
 */
export function calculateAccountBalance(
  initialBalanceCents: number,
  transactions: { kind: "INCOME" | "EXPENSE"; amountCents: number; status?: string }[]
) {
  let income = 0;
  let expense = 0;
  let pendingIncome = 0;
  let pendingExpense = 0;

  for (const t of transactions) {
    if (t.status === "PENDING") {
      if (t.kind === "INCOME") pendingIncome += t.amountCents;
      else if (t.kind === "EXPENSE") pendingExpense += t.amountCents;
      continue;
    }
    if (t.kind === "INCOME") {
      income += t.amountCents;
    } else if (t.kind === "EXPENSE") {
      expense += t.amountCents;
    }
  }

  return {
    initialBalanceCents,
    totalIncomeCents: income,
    totalExpenseCents: expense,
    pendingIncomeCents: pendingIncome,
    pendingExpenseCents: pendingExpense,
    currentBalanceCents: initialBalanceCents + income - expense,
  };
}

/**
 * Calcula variação percentual entre valor atual e anterior de forma segura (evita divisão por zero)
 */
export function calculateSafeVariationPercent(
  current: number,
  previous: number
): number | null {
  if (previous === 0) {
    if (current === 0) return 0;
    return null; // Divisão por zero -> retorna null ("—")
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}

/**
 * Calcula margem percentual em relação à receita líquida de forma segura
 */
export function calculateSafeMarginPercent(
  value: number,
  netRevenue: number
): number | null {
  if (netRevenue <= 0) return null;
  return (value / netRevenue) * 100;
}

/**
 * Gera fluxo mensal de entradas, saídas, resultado e saldo acumulado
 * Preenche todos os meses do intervalo, inclusive os sem movimentação com 0.
 */
export function calculateMonthlyFlow(
  transactions: { date: Date; kind: "INCOME" | "EXPENSE"; amountCents: number }[],
  startDate: Date,
  endDate: Date,
  startingBalanceBeforePeriodCents = 0
): MonthlyFlowItem[] {
  // Gera todos os meses entre startDate e endDate
  const monthsMap = new Map<string, { income: number; expense: number }>();

  const cur = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1));
  const end = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1));

  while (cur <= end) {
    const key = `${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, "0")}`;
    monthsMap.set(key, { income: 0, expense: 0 });
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }

  // Agrega as transações
  for (const t of transactions) {
    const d = new Date(t.date);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    if (monthsMap.has(key)) {
      const entry = monthsMap.get(key)!;
      if (t.kind === "INCOME") {
        entry.income += t.amountCents;
      } else {
        entry.expense += t.amountCents;
      }
    }
  }

  const monthNames = [
    "jan", "fev", "mar", "abr", "mai", "jun",
    "jul", "ago", "set", "out", "nov", "dez",
  ];

  let accumulated = startingBalanceBeforePeriodCents;
  const result: MonthlyFlowItem[] = [];

  for (const [monthKey, data] of Array.from(monthsMap.entries()).sort()) {
    const [year, monthNum] = monthKey.split("-");
    const label = `${monthNames[parseInt(monthNum, 10) - 1]}/${year}`;
    const monthResult = data.income - data.expense;
    accumulated += monthResult;

    result.push({
      month: monthKey,
      monthLabel: label,
      incomeCents: data.income,
      expenseCents: data.expense,
      resultCents: monthResult,
      accumulatedBalanceCents: accumulated,
    });
  }

  return result;
}

/**
 * Agrega despesas por categoria de nível 1 com detalhamento de subcategorias e percentuais
 */
export function calculateExpensesByCategory(
  transactions: RawTransactionInput[],
  kindFilter: "EXPENSE" | "INCOME" = "EXPENSE"
): { items: CategoryExpenseItem[]; totalCents: number } {
  const filtered = transactions.filter((t) => t.kind === kindFilter);
  const totalCents = filtered.reduce((acc, t) => acc + t.amountCents, 0);

  // Mapeia por Categoria Pai
  const groupMap = new Map<
    string,
    {
      categoryId: string;
      categoryName: string;
      amountCents: number;
      subcategories: Map<string, { id: string; name: string; amountCents: number }>;
    }
  >();

  for (const t of filtered) {
    // Se a categoria tem pai, a categoria pai é a principal e ela é a subcategoria
    const isSubcategory = !!t.categoryParentId;
    const parentId = isSubcategory ? t.categoryParentId! : t.categoryId;
    const parentName = isSubcategory ? t.categoryParentName || "Categoria" : t.categoryName || "Categoria";

    if (!groupMap.has(parentId)) {
      groupMap.set(parentId, {
        categoryId: parentId,
        categoryName: parentName,
        amountCents: 0,
        subcategories: new Map(),
      });
    }

    const group = groupMap.get(parentId)!;
    group.amountCents += t.amountCents;

    if (isSubcategory) {
      const subId = t.categoryId;
      const subName = t.categoryName || "Subcategoria";
      if (!group.subcategories.has(subId)) {
        group.subcategories.set(subId, { id: subId, name: subName, amountCents: 0 });
      }
      group.subcategories.get(subId)!.amountCents += t.amountCents;
    }
  }

  const items: CategoryExpenseItem[] = Array.from(groupMap.values())
    .map((g) => {
      const pct = totalCents > 0 ? (g.amountCents / totalCents) * 100 : 0;
      const subList = Array.from(g.subcategories.values())
        .map((sub) => ({
          id: sub.id,
          name: sub.name,
          amountCents: sub.amountCents,
          percentage: g.amountCents > 0 ? (sub.amountCents / g.amountCents) * 100 : 0,
        }))
        .sort((a, b) => b.amountCents - a.amountCents);

      return {
        categoryId: g.categoryId,
        categoryName: g.categoryName,
        amountCents: g.amountCents,
        percentage: Number(pct.toFixed(2)),
        subcategories: subList,
      };
    })
    .sort((a, b) => b.amountCents - a.amountCents);

  return { items, totalCents };
}

/**
 * Agrupador auxiliar de linhas do DRE
 */
interface DreLineAccumulator {
  totalCents: number;
  categories: Map<
    string,
    {
      categoryId: string;
      categoryName: string;
      amountCents: number;
      items: {
        id: string;
        description: string;
        date: string;
        amountCents: number;
        accountName: string;
      }[];
    }
  >;
}

function createEmptyDreLineAccumulator(): DreLineAccumulator {
  return {
    totalCents: 0,
    categories: new Map(),
  };
}

function addTransactionToLineAcc(
  acc: DreLineAccumulator,
  t: RawTransactionInput,
  dateFormatted: string
) {
  acc.totalCents += t.amountCents;

  const parentId = t.categoryParentId || t.categoryId;
  const parentName = t.categoryParentName || t.categoryName || "Geral";

  if (!acc.categories.has(parentId)) {
    acc.categories.set(parentId, {
      categoryId: parentId,
      categoryName: parentName,
      amountCents: 0,
      items: [],
    });
  }

  const catGroup = acc.categories.get(parentId)!;
  catGroup.amountCents += t.amountCents;
  catGroup.items.push({
    id: t.id,
    description: t.description,
    date: dateFormatted,
    amountCents: t.amountCents,
    accountName: t.accountName || "Conta",
  });
}

/**
 * Calcula DRE completo com comparativo do período anterior
 */
export function calculateDRE(
  currentTransactions: RawTransactionInput[],
  previousTransactions: RawTransactionInput[],
  currentPeriodLabel: string,
  previousPeriodLabel: string
): DreReport {
  const lineKeys: DreLine[] = [
    "RECEITA_BRUTA",
    "DEDUCOES",
    "CMV",
    "DESPESAS_OPERACIONAIS",
    "RECEITAS_FINANCEIRAS",
    "DESPESAS_FINANCEIRAS",
    "IMPOSTOS_LUCRO",
    "FORA_DRE",
  ];

  const currentAccumulators = new Map<DreLine, DreLineAccumulator>();
  const previousAccumulators = new Map<DreLine, DreLineAccumulator>();

  lineKeys.forEach((key) => {
    currentAccumulators.set(key, createEmptyDreLineAccumulator());
    previousAccumulators.set(key, createEmptyDreLineAccumulator());
  });

  // Processa período atual
  for (const t of currentTransactions) {
    const line = t.categoryDreLine || "DESPESAS_OPERACIONAIS";
    const acc = currentAccumulators.get(line) || currentAccumulators.get("DESPESAS_OPERACIONAIS")!;
    const d = new Date(t.date);
    const day = String(d.getUTCDate()).padStart(2, "0");
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const year = d.getUTCFullYear();
    addTransactionToLineAcc(acc, t, `${day}/${month}/${year}`);
  }

  // Processa período anterior
  for (const t of previousTransactions) {
    const line = t.categoryDreLine || "DESPESAS_OPERACIONAIS";
    const acc = previousAccumulators.get(line) || previousAccumulators.get("DESPESAS_OPERACIONAIS")!;
    const d = new Date(t.date);
    const day = String(d.getUTCDate()).padStart(2, "0");
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const year = d.getUTCFullYear();
    addTransactionToLineAcc(acc, t, `${day}/${month}/${year}`);
  }

  // Valores atuais
  const curReceitaBruta = currentAccumulators.get("RECEITA_BRUTA")!.totalCents;
  const curDeducoes = currentAccumulators.get("DEDUCOES")!.totalCents;
  const curReceitaLiquida = curReceitaBruta - curDeducoes;
  const curCmv = currentAccumulators.get("CMV")!.totalCents;
  const curLucroBruto = curReceitaLiquida - curCmv;
  const curDespOperacionais = currentAccumulators.get("DESPESAS_OPERACIONAIS")!.totalCents;
  const curResOperacional = curLucroBruto - curDespOperacionais;
  const curRecFinanceiras = currentAccumulators.get("RECEITAS_FINANCEIRAS")!.totalCents;
  const curDespFinanceiras = currentAccumulators.get("DESPESAS_FINANCEIRAS")!.totalCents;
  const curResAntesImpostos = curResOperacional + curRecFinanceiras - curDespFinanceiras;
  const curImpostosLucro = currentAccumulators.get("IMPOSTOS_LUCRO")!.totalCents;
  const curResultadoLiquido = curResAntesImpostos - curImpostosLucro;

  // Valores anteriores
  const prevReceitaBruta = previousAccumulators.get("RECEITA_BRUTA")!.totalCents;
  const prevDeducoes = previousAccumulators.get("DEDUCOES")!.totalCents;
  const prevReceitaLiquida = prevReceitaBruta - prevDeducoes;
  const prevCmv = previousAccumulators.get("CMV")!.totalCents;
  const prevLucroBruto = prevReceitaLiquida - prevCmv;
  const prevDespOperacionais = previousAccumulators.get("DESPESAS_OPERACIONAIS")!.totalCents;
  const prevResOperacional = prevLucroBruto - prevDespOperacionais;
  const prevRecFinanceiras = previousAccumulators.get("RECEITAS_FINANCEIRAS")!.totalCents;
  const prevDespFinanceiras = previousAccumulators.get("DESPESAS_FINANCEIRAS")!.totalCents;
  const prevResAntesImpostos = prevResOperacional + prevRecFinanceiras - prevDespFinanceiras;
  const prevImpostosLucro = previousAccumulators.get("IMPOSTOS_LUCRO")!.totalCents;
  const prevResultadoLiquido = prevResAntesImpostos - prevImpostosLucro;

  function buildRow(
    key: string,
    name: string,
    curVal: number,
    prevVal: number,
    isCalculated: boolean,
    order?: number,
    categoriesMap?: Map<string, any>
  ): DreRow {
    const changeCents = curVal - prevVal;
    const changePercent = calculateSafeVariationPercent(curVal, prevVal);
    const curMargin = calculateSafeMarginPercent(curVal, curReceitaLiquida);
    const prevMargin = calculateSafeMarginPercent(prevVal, prevReceitaLiquida);

    return {
      key,
      order,
      name,
      isCalculated,
      currentCents: curVal,
      currentMarginPercent: curMargin,
      previousCents: prevVal,
      previousMarginPercent: prevMargin,
      changeCents,
      changePercent,
      categories: categoriesMap ? Array.from(categoriesMap.values()) : undefined,
    };
  }

  const rows: DreRow[] = [
    buildRow(
      "RECEITA_BRUTA",
      "1. Receita Bruta",
      curReceitaBruta,
      prevReceitaBruta,
      false,
      1,
      currentAccumulators.get("RECEITA_BRUTA")!.categories
    ),
    buildRow(
      "DEDUCOES",
      "2. (-) Deduções sobre vendas",
      curDeducoes,
      prevDeducoes,
      false,
      2,
      currentAccumulators.get("DEDUCOES")!.categories
    ),
    buildRow(
      "RECEITA_LIQUIDA",
      "(=) Receita Líquida (1 − 2)",
      curReceitaLiquida,
      prevReceitaLiquida,
      true
    ),
    buildRow(
      "CMV",
      "3. (-) Custo das mercadorias vendidas (CMV)",
      curCmv,
      prevCmv,
      false,
      3,
      currentAccumulators.get("CMV")!.categories
    ),
    buildRow(
      "LUCRO_BRUTO",
      "(=) Lucro Bruto",
      curLucroBruto,
      prevLucroBruto,
      true
    ),
    buildRow(
      "DESPESAS_OPERACIONAIS",
      "4. (-) Despesas operacionais",
      curDespOperacionais,
      prevDespOperacionais,
      false,
      4,
      currentAccumulators.get("DESPESAS_OPERACIONAIS")!.categories
    ),
    buildRow(
      "RESULTADO_OPERACIONAL",
      "(=) Resultado Operacional",
      curResOperacional,
      prevResOperacional,
      true
    ),
    buildRow(
      "RECEITAS_FINANCEIRAS",
      "5. (+) Receitas financeiras",
      curRecFinanceiras,
      prevRecFinanceiras,
      false,
      5,
      currentAccumulators.get("RECEITAS_FINANCEIRAS")!.categories
    ),
    buildRow(
      "DESPESAS_FINANCEIRAS",
      "6. (-) Despesas financeiras",
      curDespFinanceiras,
      prevDespFinanceiras,
      false,
      6,
      currentAccumulators.get("DESPESAS_FINANCEIRAS")!.categories
    ),
    buildRow(
      "RESULTADO_ANTES_IMPOSTOS",
      "(=) Resultado antes dos impostos",
      curResAntesImpostos,
      prevResAntesImpostos,
      true
    ),
    buildRow(
      "IMPOSTOS_LUCRO",
      "7. (-) Impostos sobre o lucro (IRPJ/CSLL)",
      curImpostosLucro,
      prevImpostosLucro,
      false,
      7,
      currentAccumulators.get("IMPOSTOS_LUCRO")!.categories
    ),
    buildRow(
      "RESULTADO_LIQUIDO",
      "(=) Resultado Líquido do Exercício",
      curResultadoLiquido,
      prevResultadoLiquido,
      true
    ),
  ];

  const foraDreTotalCents = currentAccumulators.get("FORA_DRE")!.totalCents;
  const foraDreItems = Array.from(currentAccumulators.get("FORA_DRE")!.categories.values());

  return {
    periodLabel: currentPeriodLabel,
    previousPeriodLabel,
    rows,
    netRevenueCents: curReceitaLiquida,
    foraDreTotalCents,
    foraDreItems,
  };
}
