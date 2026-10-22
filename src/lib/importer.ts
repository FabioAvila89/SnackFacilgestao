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
 * Lê arquivo CSV em texto bruto e converte em linhas candidatas
 */
export function parseCSVContent(csvText: string): ImportRowCandidate[] {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) =>
      h.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
  });

  return parsed.data.map((row, index) => {
    // Normalizar chaves comuns
    const dataRaw = row["data"] || row["date"] || "";
    const tipoRaw = row["tipo"] || row["type"] || "";
    const valorRaw = row["valor"] || row["amount"] || "";
    const descricaoRaw = row["descricao"] || row["description"] || "";
    const categoriaRaw = row["categoria"] || row["category"] || "";
    const subcategoriaRaw = row["subcategoria"] || row["subcategory"] || "";
    const contaRaw = row["conta"] || row["account"] || "";

    return {
      rowIndex: index + 2, // Considerando linha 1 como cabeçalho
      dataRaw: String(dataRaw).trim(),
      tipoRaw: String(tipoRaw).trim(),
      valorRaw: String(valorRaw).trim(),
      descricaoRaw: String(descricaoRaw).trim(),
      categoriaRaw: String(categoriaRaw).trim(),
      subcategoriaRaw: String(subcategoriaRaw).trim(),
      contaRaw: String(contaRaw).trim(),
    };
  });
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
      headers = values.slice(1).map((v) =>
        String(v || "")
          .trim()
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
      );
      return;
    }

    const rowObj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      const cellVal = values[idx + 1];
      if (cellVal instanceof Date) {
        // Formatar para dd/mm/aaaa
        const day = String(cellVal.getUTCDate()).padStart(2, "0");
        const month = String(cellVal.getUTCMonth() + 1).padStart(2, "0");
        const year = cellVal.getUTCFullYear();
        rowObj[h] = `${day}/${month}/${year}`;
      } else {
        rowObj[h] = cellVal !== undefined && cellVal !== null ? String(cellVal).trim() : "";
      }
    });

    const dataRaw = rowObj["data"] || rowObj["date"] || "";
    const tipoRaw = rowObj["tipo"] || rowObj["type"] || "";
    const valorRaw = rowObj["valor"] || rowObj["amount"] || "";
    const descricaoRaw = rowObj["descricao"] || rowObj["description"] || "";
    const categoriaRaw = rowObj["categoria"] || rowObj["category"] || "";
    const subcategoriaRaw = rowObj["subcategoria"] || rowObj["subcategory"] || "";
    const contaRaw = rowObj["conta"] || rowObj["account"] || "";

    if (dataRaw || tipoRaw || valorRaw || descricaoRaw) {
      candidates.push({
        rowIndex: rowNumber,
        dataRaw,
        tipoRaw,
        valorRaw,
        descricaoRaw,
        categoriaRaw,
        subcategoriaRaw,
        contaRaw,
      });
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

    // 3. Validar Valor
    const amountCents = parseBRLToCents(candidate.valorRaw);
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
      matchedAccount = knownAccounts.find(
        (a) => a.name.trim().toLowerCase() === candidate.contaRaw.trim().toLowerCase()
      );
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
        matchedCategory = knownCategories.find((c) => {
          if (c.parentId && c.name.toLowerCase() === subName) {
            return c.parentName?.toLowerCase() === catName;
          }
          return false;
        });

        if (!matchedCategory) {
          // Tenta achar subcategoria apenas pelo nome se não bater o pai
          matchedCategory = knownCategories.find(
            (c) => c.parentId && c.name.toLowerCase() === subName
          );
        }

        if (!matchedCategory) {
          errors.push(`Subcategoria "${candidate.subcategoriaRaw}" não encontrada para a categoria "${candidate.categoriaRaw}".`);
        }
      } else {
        // Busca categoria de nível 1 ou única correspondência
        matchedCategory = knownCategories.find(
          (c) => c.name.toLowerCase() === catName
        );
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
