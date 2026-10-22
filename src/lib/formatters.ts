/**
 * Utilitários de formatação e parsing em padrão Brasileiro (BRL / pt-BR)
 */

/**
 * Converte centavos (inteiro) em string formatada em Real (ex: 125050 -> "R$ 1.250,50")
 */
export function formatCentsToBRL(cents: number, showSymbol = true): string {
  if (isNaN(cents)) return showSymbol ? "R$ 0,00" : "0,00";
  const isNegative = cents < 0;
  const absValue = Math.abs(cents) / 100;
  const formatted = absValue.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const prefix = isNegative ? "-" : "";
  return showSymbol ? `${prefix}R$ ${formatted}` : `${prefix}${formatted}`;
}

/**
 * Converte string brasileira (ex: "1.234,56", "R$ 1.234,56", "1234.56", "1234") para centavos inteiros
 */
export function parseBRLToCents(val: string | number): number {
  if (typeof val === "number") {
    return Math.round(val * 100);
  }
  if (!val || typeof val !== "string") return 0;

  // Remove espaços, "R$", tabs etc.
  let clean = val.replace(/R\$/gi, "").trim();

  // Se tiver tanto ponto quanto vírgula (ex: 1.234,56), remove os pontos de milhar e troca a vírgula por ponto
  if (clean.includes(".") && clean.includes(",")) {
    clean = clean.replace(/\./g, "").replace(",", ".");
  } else if (clean.includes(",")) {
    // Apenas vírgula decimal (ex: 1234,56)
    clean = clean.replace(",", ".");
  }

  const parsed = parseFloat(clean);
  if (isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
}

/**
 * Formata data Date ou ISO string para "dd/mm/aaaa"
 */
export function formatDateToBR(dateInput: Date | string): string {
  if (!dateInput) return "";
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return "";

  // Usar fuso horário America/Sao_Paulo ou UTC sem desvio de dia
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Converte data local (YYYY-MM-DD ou dd/mm/aaaa) para objeto Date com UTC 00:00:00
 */
export function parseBRDateToDate(str: string): Date | null {
  if (!str) return null;
  const trimmed = str.trim();

  // Formato dd/mm/aaaa
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
    const [day, month, year] = trimmed.split("/").map(Number);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    return isNaN(d.getTime()) ? null : d;
  }

  // Formato YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split("-").map(Number);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    return isNaN(d.getTime()) ? null : d;
  }

  const parsed = new Date(trimmed);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Formata Date para valor de input HTML <input type="date"> ("YYYY-MM-DD")
 */
export function formatDateToInput(dateInput: Date | string): string {
  if (!dateInput) return "";
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return "";
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Formata percentual com 1 ou 2 casas decimais (ex: 25.4 -> "25,4%")
 */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) {
    return "—";
  }
  return (
    value.toLocaleString("pt-BR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }) + "%"
  );
}
