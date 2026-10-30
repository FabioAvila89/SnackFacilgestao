/**
 * Motor de Regras de Negócio do Módulo de Estoque e Vending Machines
 * Snack Fácil
 */

export type MovementType = "IN" | "OUT" | "ADJUST";

export type MovementReason =
  | "PURCHASE"
  | "MACHINE_REFILL"
  | "LOSS_EXPIRED"
  | "LOSS_DAMAGE"
  | "INVENTORY_ADJUSTMENT";

export interface CalculateStockResult {
  previousStock: number;
  newStock: number;
  delta: number;
}

/**
 * Calcula o novo saldo físico de estoque no depósito central
 */
export function calculateStockBalance(
  previousStock: number,
  movementType: MovementType,
  quantity: number
): CalculateStockResult {
  if (quantity < 0) {
    throw new Error("A quantidade movimentada não pode ser negativa.");
  }

  const roundedPrevious = Math.round(previousStock);
  const roundedQty = Math.round(quantity);

  if (movementType === "IN") {
    return {
      previousStock: roundedPrevious,
      newStock: roundedPrevious + roundedQty,
      delta: roundedQty,
    };
  }

  if (movementType === "OUT") {
    if (roundedPrevious < roundedQty) {
      throw new Error(
        `Saldo insuficiente no depósito: disponível ${roundedPrevious} un, solicitado ${roundedQty} un.`
      );
    }
    return {
      previousStock: roundedPrevious,
      newStock: roundedPrevious - roundedQty,
      delta: -roundedQty,
    };
  }

  if (movementType === "ADJUST") {
    return {
      previousStock: roundedPrevious,
      newStock: roundedQty,
      delta: roundedQty - roundedPrevious,
    };
  }

  throw new Error(`Tipo de movimentação desconhecido: ${movementType}`);
}

/**
 * Valida se uma saída solicitada pode ser atendida pelo saldo atual
 */
export function validateStockOutput(
  currentStock: number,
  requestedQuantity: number
): { valid: boolean; error?: string } {
  if (requestedQuantity <= 0) {
    return { valid: false, error: "A quantidade solicitada deve ser maior que zero." };
  }
  if (currentStock < requestedQuantity) {
    return {
      valid: false,
      error: `Saldo insuficiente no depósito central. Saldo atual: ${currentStock} un, Quantidade solicitada: ${requestedQuantity} un.`,
    };
  }
  return { valid: true };
}

/**
 * Converte caixas/fardos para unidades base
 */
export function calculatePackConversion(packs: number, unitPerPack: number): number {
  const p = Math.max(0, Math.round(packs));
  const u = Math.max(1, Math.round(unitPerPack));
  return p * u;
}

/**
 * Converte custo por fardo para custo unitário
 */
export function calculateUnitCostFromPack(packCost: number, unitPerPack: number): number {
  if (packCost <= 0 || unitPerPack <= 0) return 0;
  const raw = packCost / unitPerPack;
  return Math.round(raw * 100) / 100;
}

/**
 * Calcula o custo total da movimentação em reais
 */
export function calculateMovementTotalCost(quantity: number, unitCost: number): number {
  if (quantity <= 0 || unitCost <= 0) return 0;
  return Math.round(quantity * unitCost * 100) / 100;
}

/**
 * Calcula o valor exato em centavos inteiros para criação de transação financeira
 */
export function calculateFinancialExpenseCents(quantity: number, unitCost: number): number {
  if (quantity <= 0 || unitCost <= 0) return 0;
  return Math.round(quantity * unitCost * 100);
}

/**
 * Calcula a margem de lucro bruta unitária em R$ e %
 */
export function calculateProfitMargin(
  salePrice: number,
  costPrice: number
): { marginBRL: number; marginPercent: number } {
  const marginBRL = Math.round((salePrice - costPrice) * 100) / 100;
  if (salePrice <= 0) {
    return { marginBRL, marginPercent: 0 };
  }
  const marginPercent = Math.round(((salePrice - costPrice) / salePrice) * 10000) / 100;
  return { marginBRL, marginPercent };
}

/**
 * Verifica se um produto está em situação de alerta de estoque mínimo
 */
export function isStockBelowMinimum(currentStock: number, minStock: number): boolean {
  return currentStock <= minStock;
}

/**
 * Verifica se um lote está vencendo nos próximos X dias (padrão: 30 dias)
 */
export function isBatchExpiringSoon(
  expirationDate: Date | string,
  daysThreshold = 30,
  referenceDate = new Date()
): boolean {
  const exp = typeof expirationDate === "string" ? new Date(expirationDate) : expirationDate;
  if (isNaN(exp.getTime())) return false;

  const thresholdDate = new Date(referenceDate);
  thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

  return exp.getTime() <= thresholdDate.getTime();
}

