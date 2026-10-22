export type AccountType = "BANK" | "CASH" | "CARD";

export type TransactionKind = "INCOME" | "EXPENSE";

export type DreLine =
  | "RECEITA_BRUTA"
  | "DEDUCOES"
  | "CMV"
  | "DESPESAS_OPERACIONAIS"
  | "RECEITAS_FINANCEIRAS"
  | "DESPESAS_FINANCEIRAS"
  | "IMPOSTOS_LUCRO"
  | "FORA_DRE";

export interface AccountWithBalance {
  id: string;
  name: string;
  type: AccountType;
  initialBalanceCents: number;
  currentBalanceCents: number;
  totalIncomeCents: number;
  totalExpenseCents: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  transactionCount?: number;
}

export interface CategoryTreeItem {
  id: string;
  name: string;
  parentId: string | null;
  kind: TransactionKind;
  dreLine: DreLine;
  active: boolean;
  sortOrder: number;
  subcategories?: CategoryTreeItem[];
  transactionCount?: number;
}

export interface MonthlyFlowItem {
  month: string; // YYYY-MM
  monthLabel: string; // ex: "jan/2026"
  incomeCents: number;
  expenseCents: number;
  resultCents: number;
  accumulatedBalanceCents: number;
}

export interface CategoryExpenseItem {
  categoryId: string;
  categoryName: string;
  amountCents: number;
  percentage: number; // 0 to 100
  subcategories: {
    id: string;
    name: string;
    amountCents: number;
    percentage: number;
  }[];
}

export interface DreItemDetail {
  id: string;
  description: string;
  date: string;
  amountCents: number;
  accountName: string;
}

export interface DreCategoryGroup {
  categoryId: string;
  categoryName: string;
  amountCents: number;
  items?: DreItemDetail[];
}

export interface DreRow {
  key: string;
  order?: number;
  name: string;
  isCalculated: boolean;
  isHeader?: boolean;
  isSummary?: boolean;
  currentCents: number;
  currentMarginPercent: number | null; // % sobre receita líquida
  previousCents: number;
  previousMarginPercent: number | null;
  changeCents: number;
  changePercent: number | null;
  categories?: DreCategoryGroup[];
}

export interface DreReport {
  periodLabel: string;
  previousPeriodLabel: string;
  rows: DreRow[];
  netRevenueCents: number;
  foraDreTotalCents: number;
  foraDreItems: DreCategoryGroup[];
  monthlyBreakdown?: {
    month: string;
    monthLabel: string;
    rows: { key: string; cents: number }[];
  }[];
}
