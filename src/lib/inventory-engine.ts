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

/**
 * Calcula a reversão de estoque ao excluir uma movimentação
 */
export function calculateRevertStockBalance(
  currentStock: number,
  movementType: MovementType,
  movementQuantity: number,
  previousStock?: number
): { newStock: number } {
  if (movementQuantity < 0) {
    throw new Error("A quantidade da movimentação não pode ser negativa.");
  }

  const roundedCurrent = Math.round(currentStock);
  const roundedQty = Math.round(movementQuantity);

  if (movementType === "IN") {
    const resultingStock = roundedCurrent - roundedQty;
    if (resultingStock < 0) {
      throw new Error(
        `Não é possível excluir esta entrada pois deixaria o estoque negativo (${resultingStock} un). Saldo atual: ${roundedCurrent} un, quantidade a reverter: ${roundedQty} un.`
      );
    }
    return { newStock: resultingStock };
  }

  if (movementType === "OUT") {
    return { newStock: roundedCurrent + roundedQty };
  }

  if (movementType === "ADJUST") {
    if (previousStock !== undefined && previousStock !== null) {
      return { newStock: Math.round(previousStock) };
    }
    return { newStock: roundedCurrent };
  }

  throw new Error(`Tipo de movimentação desconhecido: ${movementType}`);
}

/**
 * Calcula o ajuste de estoque ao alterar a quantidade de uma movimentação
 */
export function calculateStockEditDelta(
  currentStock: number,
  movementType: MovementType,
  oldQuantity: number,
  newQuantity: number
): { newStock: number; delta: number } {
  if (newQuantity < 0 || oldQuantity < 0) {
    throw new Error("As quantidades não podem ser negativas.");
  }

  const roundedCurrent = Math.round(currentStock);
  const oldQty = Math.round(oldQuantity);
  const newQty = Math.round(newQuantity);
  const diff = newQty - oldQty;

  if (movementType === "IN") {
    const resultingStock = roundedCurrent + diff;
    if (resultingStock < 0) {
      throw new Error(
        `Saldo insuficiente no depósito para esta redução de entrada. Saldo atual: ${roundedCurrent} un, redução solicitada: ${Math.abs(diff)} un.`
      );
    }
    return { newStock: resultingStock, delta: diff };
  }

  if (movementType === "OUT") {
    const resultingStock = roundedCurrent - diff;
    if (resultingStock < 0) {
      throw new Error(
        `Saldo insuficiente no depósito para aumentar a saída. Saldo disponível: ${roundedCurrent} un, acréscimo solicitado: ${diff} un.`
      );
    }
    return { newStock: resultingStock, delta: -diff };
  }

  if (movementType === "ADJUST") {
    return { newStock: newQty, delta: diff };
  }

  throw new Error(`Tipo de movimentação desconhecido: ${movementType}`);
}


