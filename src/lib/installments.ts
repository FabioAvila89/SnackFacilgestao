/**
 * Módulo de cálculo de desdobramento de parcelas financeiras.
 * 
 * Regras de Negócio:
 * 1. Projeção baseada em Âncora Absoluta da data de vencimento informada (Data Inicial + N meses).
 * 2. Regra de Fim de Mês: se o dia inicial for 31, meses mais curtos (fev, abr, etc) usam o último dia válido,
 *    e os meses subsequentes de 31 dias retornam obrigatoriamente para o dia 31, sem deslizamento cumulativo.
 * 3. Rateio exato de centavos: qualquer sobra da divisão inteira é somada integralmente na 1ª parcela.
 * 4. Regra de Status: se a data de vencimento da parcela for futura (> hoje), status = "PENDING".
 *    Se for na data atual ou retroativa (<= hoje), status = "PAID".
 */

export interface ParcelaDesdobrada {
  numeroParcela: number;
  valorParcela: number;
  valorCents: number;
  dataVencimento: Date;
  dataVencimentoStr: string; // formato YYYY-MM-DD para inputs HTML e APIs
  statusSugerido: "PAID" | "PENDING";
}

/**
 * Retorna a data atual local no formato "YYYY-MM-DD".
 */
export function getHojeFormatado(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Determina o status da parcela com base na data de vencimento:
 * - Data futura (> referência/hoje) -> "PENDING"
 * - Data atual ou passada (<= referência/hoje) -> "PAID"
 */
export function determinarStatusPorVencimento(
  dataVencimentoStr: string,
  dataReferenciaStr: string = getHojeFormatado()
): "PAID" | "PENDING" {
  return dataVencimentoStr > dataReferenciaStr ? "PENDING" : "PAID";
}

/**
 * Normaliza datas (Date ou string YYYY-MM-DD / ISO / pt-BR) extraindo ano, mês e dia com precisão,
 * imune a interferências de Timezone UTC vs local.
 */
export function extrairComponentesData(input: Date | string): { ano: number; mes: number; dia: number } {
  if (input instanceof Date) {
    if (isNaN(input.getTime())) {
      throw new Error("Data de vencimento inválida.");
    }
    return {
      ano: input.getUTCFullYear(),
      mes: input.getUTCMonth(),
      dia: input.getUTCDate(),
    };
  }

  if (typeof input === "string") {
    const trimmed = input.trim();

    // Formato YYYY-MM-DD ou ISO
    const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
    if (isoMatch) {
      return {
        ano: parseInt(isoMatch[1], 10),
        mes: parseInt(isoMatch[2], 10) - 1,
        dia: parseInt(isoMatch[3], 10),
      };
    }

    // Formato DD/MM/YYYY
    const brMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(trimmed);
    if (brMatch) {
      return {
        ano: parseInt(brMatch[3], 10),
        mes: parseInt(brMatch[2], 10) - 1,
        dia: parseInt(brMatch[1], 10),
      };
    }

    const d = new Date(trimmed);
    if (isNaN(d.getTime())) {
      throw new Error("Data de vencimento inválida.");
    }
    return {
      ano: d.getUTCFullYear(),
      mes: d.getUTCMonth(),
      dia: d.getUTCDate(),
    };
  }

  throw new Error("Formato de data inválido. Esperado Date ou string.");
}

/**
 * Calcula o desdobramento de parcelas financeiras.
 *
 * @param valorTotal Valor total em reais/moeda corrente (ex: 1000 ou 1000.50)
 * @param quantidadeParcelas Número de parcelas (inteiro >= 1)
 * @param dataVencimentoInicial Data de vencimento âncora (Date ou string YYYY-MM-DD)
 * @param dataReferenciaHoje Data de referência para verificação de hoje/futuro (default: hoje formatado)
 * @returns Array de parcelas desdobradas
 */
export function desdobrarParcelas(
  valorTotal: number,
  quantidadeParcelas: number,
  dataVencimentoInicial: Date | string,
  dataReferenciaHoje: string = getHojeFormatado()
): ParcelaDesdobrada[] {
  if (!Number.isFinite(valorTotal)) {
    throw new TypeError("O valor total deve ser um número finito e válido.");
  }

  const n = Math.max(1, Math.floor(quantidadeParcelas));

  const { ano: anoAncora, mes: mesAncora, dia: diaAncora } = extrairComponentesData(dataVencimentoInicial);

  // Tratamento monetário em centavos inteiros para evitar imprecisões de ponto flutuante
  const totalCentavos = Math.round(valorTotal * 100);
  const baseCentavos = Math.trunc(totalCentavos / n);
  const sobraCentavos = totalCentavos - (baseCentavos * n);

  const parcelas: ParcelaDesdobrada[] = [];

  for (let i = 0; i < n; i++) {
    const numeroParcela = i + 1;

    // Regra dos centavos: sobra é somada na primeira parcela
    const valorCents = i === 0 ? baseCentavos + sobraCentavos : baseCentavos;
    const valorParcela = valorCents / 100;

    // Projeção absoluta da data: Data Inicial + N meses (evita acúmulo de deslizamento)
    const mesAlvoTotal = mesAncora + i;
    const anoAlvo = anoAncora + Math.floor(mesAlvoTotal / 12);
    const mesAlvo = ((mesAlvoTotal % 12) + 12) % 12;

    // Obtém o último dia do mês alvo via Date.UTC (dia 0 do mês seguinte é o último dia do mês alvo)
    const ultimoDiaValidoMes = new Date(Date.UTC(anoAlvo, mesAlvo + 1, 0, 12, 0, 0)).getUTCDate();

    // Regra do Fim de Mês: usa o dia âncora ou o último dia válido daquele mês
    const diaEfetivo = Math.min(diaAncora, ultimoDiaValidoMes);

    const dataVencimento = new Date(Date.UTC(anoAlvo, mesAlvo, diaEfetivo, 12, 0, 0));
    const dataVencimentoStr = `${anoAlvo}-${String(mesAlvo + 1).padStart(2, "0")}-${String(diaEfetivo).padStart(2, "0")}`;

    // Regra de status por vencimento: futura = PENDING; hoje ou passada = PAID
    const statusSugerido = determinarStatusPorVencimento(dataVencimentoStr, dataReferenciaHoje);

    parcelas.push({
      numeroParcela,
      valorParcela,
      valorCents,
      dataVencimento,
      dataVencimentoStr,
      statusSugerido,
    });
  }

  return parcelas;
}
