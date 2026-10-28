export type AccountType = "BANK" | "CASH" | "CARD";

export type TransactionKind = "INCOME" | "EXPENSE";

export type TransactionStatus = "PAID" | "PENDING";

export type RecurrenceFrequency = "MONTHLY" | "WEEKLY" | "YEARLY";

export type DreLine =
  | "RECEITA_BRUTA"
  | "DEDUCOES"
  | "CMV"
  | "DESPESAS_OPERACIONAIS"
  | "RECEITAS_FINANCEIRAS"
  | "DESPESAS_FINANCEIRAS"
  | "IMPOSTOS_LUCRO"
  | "FORA_DRE";

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  document?: string | null;
  notes?: string | null;
  active: boolean;
  organizationId: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  transactionCount?: number;
}

export interface AccountWithBalance {
  id: string;
  name: string;
  type: AccountType;
  initialBalanceCents: number;
  currentBalanceCents: number;
  totalIncomeCents: number;
  totalExpenseCents: number;
  pendingIncomeCents?: number;
  pendingExpenseCents?: number;
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

export interface TransactionItem {
  id: string;
  date: string | Date;
  dueDate?: string | Date | null;
  paidAt?: string | Date | null;
  status: TransactionStatus;
  kind: TransactionKind;
  amountCents: number;
  description: string;
  accountId: string;
  categoryId: string;
  supplierId?: string | null;
  notes?: string | null;
  isRecurring: boolean;
  recurrenceFrequency?: RecurrenceFrequency | null;
  isInstallment: boolean;
  installmentNumber?: number | null;
  totalInstallments?: number | null;
  installmentGroupId?: string | null;
  account?: { id: string; name: string };
  category?: { id: string; name: string; parentId?: string | null; parent?: { id: string; name: string } | null };
  supplier?: Supplier | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  createdBy?: { id: string; name: string; email?: string } | null;
  updatedBy?: { id: string; name: string; email?: string } | null;
}

