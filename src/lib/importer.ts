import Papa from "papaparse";
import ExcelJS from "exceljs";
import { parseBRLToCents, parseBRDateToDate } from "./formatters";
import { TransactionKind } from "./types";

export interface ImportRowCandidate {
  rowIndex: number;
  dataRaw: string;
  tipoRaw: string;
  valorRaw: string;
  descricaoRaw: string;
  categoriaRaw: string;
  subcategoriaRaw?: string;
  contaRaw: string;
  observacoesRaw?: string;
}

export interface ValidatedImportRow {
  rowIndex: number;
  isValid: boolean;
  errors: string[];
  // Campos normalizados se válidos
  date?: Date;
  dateFormatted?: string;
  kind?: TransactionKind;
  amountCents?: number;
  description?: string;
  categoryName?: string;
  subcategoryName?: string;
  accountName?: string;
  notes?: string;
  // Resolved IDs
  accountId?: string;
  categoryId?: string;
}

export interface ImportPreviewResult {
  totalRows: number;
  validRowsCount: number;
  invalidRowsCount: number;
  rows: ValidatedImportRow[];
}

export interface KnownCategoryLookup {
  id: string;
  name: string;
  kind: "INCOME" | "EXPENSE";
  parentId: string | null;
  parentName?: string | null;
}

export interface KnownAccountLookup {
  id: string;
  name: string;
  active: boolean;
}

/**
 * Normaliza uma string de cabeçalho removendo BOM, acentos e caracteres de controle
 */
export function normalizeHeaderKey(key: string): string {
  return String(key || "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Busca o valor de uma coluna a partir de uma lista de aliases ou fallback regex
 */
export function getColumnValue(
  rowObj: Record<string, any>,
  aliases: string[],
  regexFallback?: RegExp
): string {
  // 1. Busca exata nas chaves normalizadas
  for (const alias of aliases) {
    const val = rowObj[alias];
    if (val !== undefined && val !== null && String(val).trim() !== "") {
      return String(val).trim();
    }
  }

  const keys = Object.keys(rowObj);

  // 2. Busca ignorando caracteres especiais (espaços, parênteses, cifrões, pontuação)
  for (const key of keys) {
    const cleanKey = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
    for (const alias of aliases) {
      const cleanAlias = alias.replace(/[^a-z0-9]/gi, "").toLowerCase();
      if (cleanKey === cleanAlias) {
        const val = rowObj[key];
        if (val !== undefined && val !== null && String(val).trim() !== "") {
          return String(val).trim();
        }
      }
    }
  }

  // 3. Fallback com expressão regular
  if (regexFallback) {
    for (const key of keys) {
      if (regexFallback.test(key)) {
        const val = rowObj[key];
        if (val !== undefined && val !== null && String(val).trim() !== "") {
          return String(val).trim();
        }
      }
    }
  }

  return "";
}

/**
 * Extrai o valor de uma célula do ExcelJS considerando datas, fórmulas, textos ricos etc.
 */
export function formatExcelCellValue(cellVal: any): string {
  if (cellVal === null || cellVal === undefined) return "";
  if (cellVal instanceof Date) {
    const day = String(cellVal.getUTCDate()).padStart(2, "0");
    const month = String(cellVal.getUTCMonth() + 1).padStart(2, "0");
    const year = cellVal.getUTCFullYear();
    return `${day}/${month}/${year}`;
  }
  if (typeof cellVal === "object") {
    if ("result" in cellVal && cellVal.result !== undefined && cellVal.result !== null) {
      return String(cellVal.result).trim();
    }
    if (Array.isArray(cellVal.richText)) {
      return cellVal.richText.map((t: any) => t.text || "").join("").trim();
    }
    if ("text" in cellVal && typeof cellVal.text === "string") {
      return cellVal.text.trim();
    }
  }
  return String(cellVal).trim();
}

/**
 * Extrai e normaliza as colunas de uma linha para ImportRowCandidate
 */
export function extractRowCandidate(
  rowObj: Record<string, any>,
  rowIndex: number
): ImportRowCandidate | null {
  const dataRaw = getColumnValue(
    rowObj,
    [
      "data",
      "date",
      "dt",
      "dt_lancamento",
      "data_lancamento",
      "data lancamento",
      "data transacao",
      "data_transacao",
      "data movimento",
      "data_movimento",
    ],
    /^(data|date|dt)($|[^a-z])/i
  );

  const tipoRaw = getColumnValue(
    rowObj,
    [
      "tipo",
      "type",
      "natureza",
      "tipo de lancamento",
      "tipo_lancamento",
      "tipo transacao",
      "tipo_transacao",
      "operacao",
      "kind",
      "d/c",
      "debito/credito",
    ],
    /^(tipo|type|natureza|operacao|kind)/i
  );

  const valorRaw = getColumnValue(
    rowObj,
    [
      "valor",
      "valor (r$)",
      "valor(r$)",
      "valor r$",
      "valor_r$",
      "valor (brl)",
      "valor(brl)",
      "valor brl",
      "valor_brl",
      "valor total",
      "valor_total",
      "valor liquido",
      "valor_liquido",
      "amount",
      "amount (r$)",
      "amount(r$)",
      "amount r$",
      "preco",
      "price",
      "total",
      "quantia",
    ],
    /^(valor|amount|preco|price|quantia)/i
  );

  const descricaoRaw = getColumnValue(
    rowObj,
    [
      "descricao",
      "description",
      "desc",
      "historico",
      "detalhes",
      "detalhe",
      "titulo",
      "memo",
    ],
    /^(desc|historico|memo|detalhe)/i
  );

  const categoriaRaw = getColumnValue(
    rowObj,
    ["categoria", "category", "cat", "categoria principal"],
    /^(categoria|category)/i
  );

  const subcategoriaRaw = getColumnValue(
    rowObj,
    [
      "subcategoria",
      "subcategory",
      "sub_categoria",
      "sub categoria",
      "sub-categoria",
      "subcat",
    ],
    /(subcategoria|subcategory|sub_categoria|subcat)/i
  );

  const contaRaw = getColumnValue(
    rowObj,
    [
      "conta",
      "account",
      "banco",
      "conta bancaria",
      "conta_bancaria",
      "carteira",
      "conta destino",
      "conta origem",
    ],
    /^(conta|account|banco|carteira)/i
  );

  const observacoesRaw = getColumnValue(
    rowObj,
    [
      "observacoes",
      "observacao",
      "obs",
      "notes",
      "nota",
      "notas",
      "comentario",
      "comentarios",
    ],
    /^(observac|obs|notes|nota|coment)/i
  );

  if (dataRaw || tipoRaw || valorRaw || descricaoRaw) {
    return {
      rowIndex,
      dataRaw,
      tipoRaw,
      valorRaw,
      descricaoRaw,
      categoriaRaw,
      subcategoriaRaw: subcategoriaRaw || undefined,
      contaRaw,
      observacoesRaw: observacoesRaw || undefined,
    };
  }

  return null;
}

/**
 * Lê arquivo CSV em texto bruto e converte em linhas candidatas
 */
export function parseCSVContent(csvText: string): ImportRowCandidate[] {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => normalizeHeaderKey(h),
  });

  const candidates: ImportRowCandidate[] = [];
  parsed.data.forEach((row, index) => {
    const candidate = extractRowCandidate(row, index + 2); // Considerando linha 1 como cabeçalho
    if (candidate) {
      candidates.push(candidate);
    }
  });

  return candidates;
}

/**
 * Lê buffer XLSX e converte em linhas candidatas
 */
export async function parseXLSXBuffer(buffer: ArrayBuffer | Buffer): Promise<ImportRowCandidate[]> {
  const workbook = new ExcelJS.Workbook();
  // @ts-ignore
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.worksheets[0];

  if (!worksheet) return [];

  const candidates: ImportRowCandidate[] = [];
  let headers: string[] = [];

  worksheet.eachRow((row, rowNumber) => {
    const values = (row.values as any[]) || [];
    if (rowNumber === 1) {
      headers = values.slice(1).map((v) => normalizeHeaderKey(String(v || "")));
      return;
    }

    const rowObj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rowObj[h] = formatExcelCellValue(values[idx + 1]);
    });

    const candidate = extractRowCandidate(rowObj, rowNumber);
    if (candidate) {
      candidates.push(candidate);
    }
  });

  return candidates;
}

/**
 * Valida candidatos contra as contas e categorias existentes no sistema
 */
export function validateImportCandidates(
  candidates: ImportRowCandidate[],
  knownAccounts: KnownAccountLookup[],
  knownCategories: KnownCategoryLookup[]
): ImportPreviewResult {
  const validatedRows: ValidatedImportRow[] = [];

  // Otimização O(1) de Lookups com Maps indexados por chave normalizada
  const accountMap = new Map<string, KnownAccountLookup>();
  for (let i = 0; i < knownAccounts.length; i++) {
    const a = knownAccounts[i];
    accountMap.set(a.name.trim().toLowerCase(), a);
  }

  const catMap = new Map<string, KnownCategoryLookup>();
  const subCatWithParentMap = new Map<string, KnownCategoryLookup>();
  const subCatNameMap = new Map<string, KnownCategoryLookup>();

  for (let i = 0; i < knownCategories.length; i++) {
    const c = knownCategories[i];
    const nameLow = c.name.trim().toLowerCase();
    if (!catMap.has(nameLow)) {
      catMap.set(nameLow, c);
    }
    if (c.parentId) {
      if (!subCatNameMap.has(nameLow)) {
        subCatNameMap.set(nameLow, c);
      }
      if (c.parentName) {
        const key = `${c.parentName.trim().toLowerCase()}|${nameLow}`;
        subCatWithParentMap.set(key, c);
      }
    }
  }

  for (const candidate of candidates) {
    const errors: string[] = [];

    // 1. Validar Data
    const parsedDate = parseBRDateToDate(candidate.dataRaw);
    if (!parsedDate) {
      errors.push("Data inválida. Use o formato dd/mm/aaaa ou aaaa-mm-dd.");
    }

    // 2. Validar Tipo (Entrada ou Saída)
    const tipoNorm = candidate.tipoRaw
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    let kind: TransactionKind | undefined;
    if (tipoNorm === "entrada" || tipoNorm === "income" || tipoNorm === "receita") {
      kind = "INCOME";
    } else if (tipoNorm === "saida" || tipoNorm === "expense" || tipoNorm === "despesa") {
      kind = "EXPENSE";
    } else {
      errors.push("Tipo inválido. Use 'entrada' ou 'saída'.");
    }

    // 3. Validar Valor (sempre positivo internamente)
    const amountCents = Math.abs(parseBRLToCents(candidate.valorRaw));
    if (amountCents <= 0) {
      errors.push("Valor deve ser maior que zero.");
    }

    // 4. Validar Descrição
    if (!candidate.descricaoRaw) {
      errors.push("Descrição é obrigatória.");
    }

    // 5. Validar Conta
    let matchedAccount: KnownAccountLookup | undefined;
    if (!candidate.contaRaw) {
      errors.push("Conta é obrigatória.");
    } else {
      matchedAccount = accountMap.get(candidate.contaRaw.trim().toLowerCase());
      if (!matchedAccount) {
        errors.push(`Conta "${candidate.contaRaw}" não encontrada.`);
      } else if (!matchedAccount.active) {
        errors.push(`Conta "${candidate.contaRaw}" está desativada.`);
      }
    }

    // 6. Validar Categoria e Subcategoria
    let matchedCategory: KnownCategoryLookup | undefined;
    if (!candidate.categoriaRaw) {
      errors.push("Categoria é obrigatória.");
    } else {
      const catName = candidate.categoriaRaw.trim().toLowerCase();
      const subName = candidate.subcategoriaRaw ? candidate.subcategoriaRaw.trim().toLowerCase() : "";

      if (subName) {
        // Procurar por subcategoria cujo pai tenha o nome da categoria
        const key = `${catName}|${subName}`;
        matchedCategory = subCatWithParentMap.get(key) || subCatNameMap.get(subName);

        if (!matchedCategory) {
          errors.push(`Subcategoria "${candidate.subcategoriaRaw}" não encontrada para a categoria "${candidate.categoriaRaw}".`);
        }
      } else {
        // Busca categoria de nível 1 ou única correspondência
        matchedCategory = catMap.get(catName);
        if (!matchedCategory) {
          errors.push(`Categoria "${candidate.categoriaRaw}" não encontrada.`);
        }
      }

      // Validar tipo da categoria com o tipo do lançamento
      if (matchedCategory && kind && matchedCategory.kind !== kind) {
        const expected = matchedCategory.kind === "INCOME" ? "entrada" : "saída";
        const actual = kind === "INCOME" ? "entrada" : "saída";
        errors.push(
          `Conflito de tipo: Categoria "${matchedCategory.name}" é de ${expected}, mas o lançamento é de ${actual}.`
        );
      }
    }

    const isValid = errors.length === 0;

    validatedRows.push({
      rowIndex: candidate.rowIndex,
      isValid,
      errors,
      date: parsedDate || undefined,
      dateFormatted: parsedDate
        ? `${String(parsedDate.getUTCDate()).padStart(2, "0")}/${String(parsedDate.getUTCMonth() + 1).padStart(2, "0")}/${parsedDate.getUTCFullYear()}`
        : candidate.dataRaw,
      kind,
      amountCents,
      description: candidate.descricaoRaw,
      categoryName: candidate.categoriaRaw,
      subcategoryName: candidate.subcategoriaRaw || undefined,
      accountName: candidate.contaRaw,
      notes: candidate.observacoesRaw || undefined,
      accountId: matchedAccount?.id,
      categoryId: matchedCategory?.id,
    });
  }

  const validRowsCount = validatedRows.filter((r) => r.isValid).length;
  const invalidRowsCount = validatedRows.length - validRowsCount;

  return {
    totalRows: validatedRows.length,
    validRowsCount,
    invalidRowsCount,
    rows: validatedRows,
  };
}
