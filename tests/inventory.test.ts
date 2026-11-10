import { describe, it, expect } from "vitest";
import {
  calculateStockBalance,
  validateStockOutput,
  calculatePackConversion,
  calculateUnitCostFromPack,
  calculateMovementTotalCost,
  calculateFinancialExpenseCents,
  calculateProfitMargin,
  isStockBelowMinimum,
  isBatchExpiringSoon,
  calculateRevertStockBalance,
  calculateStockEditDelta,
} from "../src/lib/inventory-engine";
import { can } from "../src/lib/permissions";

describe("1. Entradas de Compra no Depósito", () => {
  it("Entrada de compra soma corretamente as unidades ao saldo existente e calcula delta", () => {
    const previousStock = 45; // 45 latas no depósito
    const quantityBought = 24; // compra de 24 latas (2 fardos de 12)

    const result = calculateStockBalance(previousStock, "IN", quantityBought);

    expect(result.previousStock).toBe(45);
    expect(result.newStock).toBe(69);
    expect(result.delta).toBe(24);
  });

  it("Entrada em lote partindo de estoque zerado", () => {
    const result = calculateStockBalance(0, "IN", 100);

    expect(result.previousStock).toBe(0);
    expect(result.newStock).toBe(100);
    expect(result.delta).toBe(100);
  });

  it("Conversão de Fardos para Unidades Base", () => {
    // 5 fardos de refrigerante com 12 latas cada
    const units12 = calculatePackConversion(5, 12);
    expect(units12).toBe(60);

    // 3 caixas de salgadinho com 20 pacotes cada
    const units20 = calculatePackConversion(3, 20);
    expect(units20).toBe(60);
  });

  it("Cálculo de custo unitário a partir do preço do fardo", () => {
    // Fardo de 12 latas por R$ 36,00 -> R$ 3,00 por lata
    const unitCost = calculateUnitCostFromPack(36.0, 12);
    expect(unitCost).toBe(3.0);
  });
});

describe("2. Integração Financeira Automática na Compra (createFinancialTransaction)", () => {
  it("Calcula exatamente o valor total da despesa financeira em centavos a partir da quantidade e custo unitário", () => {
    const quantity = 48; // 48 unidades
    const unitCost = 3.25; // R$ 3,25 por unidade

    const totalCostReais = calculateMovementTotalCost(quantity, unitCost);
    const amountCents = calculateFinancialExpenseCents(quantity, unitCost);

    expect(totalCostReais).toBe(156.0); // R$ 156,00
    expect(amountCents).toBe(15600); // 15600 centavos
  });

  it("Garante precisão sem dízimas no valor em centavos para o financeiro", () => {
    const quantity = 7;
    const unitCost = 2.99; // R$ 2,99

    const amountCents = calculateFinancialExpenseCents(quantity, unitCost);

    // 7 * 2.99 = 20.93 -> 2093 centavos
    expect(amountCents).toBe(2093);
  });

  it("Simulação da transação conjunta de Compra + Despesa Financeira", () => {
    const initialStock = 10;
    const initialAccountBalanceCents = 100000; // R$ 1.000,00 em conta

    // Parâmetros da compra
    const purchaseQty = 30;
    const unitCost = 4.5; // R$ 4,50
    const createFinancial = true;

    // 1. Atualização do estoque
    const stockResult = calculateStockBalance(initialStock, "IN", purchaseQty);
    expect(stockResult.newStock).toBe(40);

    // 2. Criação da transação de despesa (EXPENSE)
    let financialTx: { kind: "EXPENSE"; amountCents: number } | null = null;
    if (createFinancial) {
      financialTx = {
        kind: "EXPENSE",
        amountCents: calculateFinancialExpenseCents(purchaseQty, unitCost),
      };
    }

    expect(financialTx).not.toBeNull();
    expect(financialTx?.amountCents).toBe(13500); // R$ 135,00

    // 3. Saldo resultante na conta bancária
    const finalBalanceCents = initialAccountBalanceCents - (financialTx?.amountCents || 0);
    expect(finalBalanceCents).toBe(86500); // R$ 865,00
  });
});

describe("3. Saídas para Abastecimento da Máquina 01 e Bloqueio de Estoque Negativo", () => {
  it("Abastecimento da Máquina 01 subtrai estoque corretamente quando há saldo disponível", () => {
    const currentStock = 50;
    const refillQuantity = 18; // levar 18 latas para abastecer a Máquina 01

    const validation = validateStockOutput(currentStock, refillQuantity);
    expect(validation.valid).toBe(true);

    const result = calculateStockBalance(currentStock, "OUT", refillQuantity);
    expect(result.previousStock).toBe(50);
    expect(result.newStock).toBe(32);
    expect(result.delta).toBe(-18);
  });

  it("BLOQUEIA saída quando a quantidade solicitada é maior que o currentStock disponível", () => {
    const currentStock = 10;
    const refillQuantity = 15; // tentativa de retirar mais do que existe

    const validation = validateStockOutput(currentStock, refillQuantity);
    expect(validation.valid).toBe(false);
    expect(validation.error).toContain("Saldo insuficiente no depósito central");

    // Lança exceção de proteção contra concorrência e estoque negativo
    expect(() => {
      calculateStockBalance(currentStock, "OUT", refillQuantity);
    }).toThrow("Saldo insuficiente no depósito");
  });

  it("Permite retirada exata de todo o saldo disponível deixando o estoque zerado", () => {
    const currentStock = 20;
    const refillQuantity = 20;

    const validation = validateStockOutput(currentStock, refillQuantity);
    expect(validation.valid).toBe(true);

    const result = calculateStockBalance(currentStock, "OUT", refillQuantity);
    expect(result.newStock).toBe(0);
  });
});

describe("4. Baixa por Perda / Avaria e Ajuste Físico de Inventário", () => {
  it("Baixa por perda/vencimento subtrai quantidade do saldo", () => {
    const currentStock = 30;
    const expiredQty = 3;

    const result = calculateStockBalance(currentStock, "OUT", expiredQty);
    expect(result.newStock).toBe(27);
  });

  it("Ajuste de inventário substitui o saldo físico pela contagem real", () => {
    const systemStock = 25;
    const physicallyCountedStock = 28; // Encontrou 3 a mais no depósito

    const result = calculateStockBalance(systemStock, "ADJUST", physicallyCountedStock);
    expect(result.previousStock).toBe(25);
    expect(result.newStock).toBe(28);
    expect(result.delta).toBe(3);
  });
});

describe("5. Margem de Lucro e Alertas Operacionais", () => {
  it("Calcula margem de lucro bruta unitária em R$ e %", () => {
    const salePrice = 7.0; // Vende a R$ 7,00 na máquina
    const costPrice = 3.5; // Custo de compra R$ 3,50

    const { marginBRL, marginPercent } = calculateProfitMargin(salePrice, costPrice);

    expect(marginBRL).toBe(3.5);
    expect(marginPercent).toBe(50); // 50% de margem
  });

  it("Dispara alerta quando o estoque está menor ou igual ao mínimo configurado", () => {
    expect(isStockBelowMinimum(5, 10)).toBe(true); // Crítico
    expect(isStockBelowMinimum(10, 10)).toBe(true); // No limite exato
    expect(isStockBelowMinimum(11, 10)).toBe(false); // Seguro
  });

  it("Identifica lotes vencendo dentro dos próximos 30 dias para priorização (FEFO)", () => {
    const today = new Date("2026-10-28T12:00:00Z");

    const batchIn15Days = new Date("2026-11-12T12:00:00Z");
    const batchIn45Days = new Date("2026-12-12T12:00:00Z");
    const batchAlreadyExpired = new Date("2026-10-20T12:00:00Z");

    expect(isBatchExpiringSoon(batchIn15Days, 30, today)).toBe(true);
    expect(isBatchExpiringSoon(batchAlreadyExpired, 30, today)).toBe(true);
    expect(isBatchExpiringSoon(batchIn45Days, 30, today)).toBe(false);
  });
});

describe("6. Permissões RBAC para o Módulo de Estoque e Produtos", () => {
  it("ADMIN possui permissão total de leitura e escrita em produtos, estoque e máquinas", () => {
    const admin = { role: "ADMIN" as const, active: true };

    expect(can(admin, "product:read")).toBe(true);
    expect(can(admin, "product:write")).toBe(true);
    expect(can(admin, "stock:read")).toBe(true);
    expect(can(admin, "stock:write")).toBe(true);
    expect(can(admin, "machine:read")).toBe(true);
    expect(can(admin, "machine:write")).toBe(true);
  });

  it("EDITOR pode operar estoque e produtos normalmente", () => {
    const editor = { role: "EDITOR" as const, active: true };

    expect(can(editor, "product:read")).toBe(true);
    expect(can(editor, "product:write")).toBe(true);
    expect(can(editor, "stock:read")).toBe(true);
    expect(can(editor, "stock:write")).toBe(true);
    expect(can(editor, "machine:read")).toBe(true);
    expect(can(editor, "machine:write")).toBe(true);
  });

  it("VIEWER pode apenas consultar, sendo bloqueado para escrita", () => {
    const viewer = { role: "VIEWER" as const, active: true };

    expect(can(viewer, "product:read")).toBe(true);
    expect(can(viewer, "stock:read")).toBe(true);
    expect(can(viewer, "machine:read")).toBe(true);

    expect(can(viewer, "product:write")).toBe(false);
    expect(can(viewer, "stock:write")).toBe(false);
    expect(can(viewer, "machine:write")).toBe(false);
  });
});

describe("7. Reversão e Edição de Movimentações de Estoque", () => {
  it("Exclusão de Entrada (Compra) reverte saldo deduzindo as unidades", () => {
    const currentStock = 50;
    const movementQty = 20;

    const reverted = calculateRevertStockBalance(currentStock, "IN", movementQty);
    expect(reverted.newStock).toBe(30);
  });

  it("Exclusão de Entrada bloqueia se o saldo restante for ficar negativo", () => {
    const currentStock = 10;
    const movementQty = 20; // tentou excluir compra de 20, mas só tem 10 no depósito

    expect(() => {
      calculateRevertStockBalance(currentStock, "IN", movementQty);
    }).toThrow("deixaria o estoque negativo");
  });

  it("Exclusão de Saída (Abastecimento ou Perda) devolve as unidades ao estoque", () => {
    const currentStock = 15;
    const refillQty = 25;

    const reverted = calculateRevertStockBalance(currentStock, "OUT", refillQty);
    expect(reverted.newStock).toBe(40);
  });

  it("Exclusão de Ajuste Físico restaura o saldo anterior", () => {
    const currentStock = 60; // ajuste tinha colocado 60
    const previousStock = 45; // antes do ajuste era 45

    const reverted = calculateRevertStockBalance(currentStock, "ADJUST", 60, previousStock);
    expect(reverted.newStock).toBe(45);
  });

  it("Edição de Entrada: aumentar quantidade adiciona a diferença ao estoque", () => {
    const currentStock = 30;
    const oldQty = 10;
    const newQty = 25; // aumentou em 15

    const result = calculateStockEditDelta(currentStock, "IN", oldQty, newQty);
    expect(result.newStock).toBe(45);
    expect(result.delta).toBe(15);
  });

  it("Edição de Entrada: diminuir quantidade reduz estoque e bloqueia se for insuficiente", () => {
    const currentStock = 5;
    const oldQty = 20;
    const newQty = 10; // quer diminuir 10 da compra, mas só tem 5 em estoque

    expect(() => {
      calculateStockEditDelta(currentStock, "IN", oldQty, newQty);
    }).toThrow("Saldo insuficiente no depósito para esta redução");
  });

  it("Edição de Saída: aumentar saída reduz estoque e bloqueia se insuficiente", () => {
    const currentStock = 10;
    const oldQty = 5;
    const newQty = 20; // quer sair mais 15, mas só tem 10 disponível

    expect(() => {
      calculateStockEditDelta(currentStock, "OUT", oldQty, newQty);
    }).toThrow("Saldo insuficiente no depósito para aumentar a saída");
  });

  it("Edição de Saída: diminuir saída devolve unidades ao estoque", () => {
    const currentStock = 10;
    const oldQty = 15;
    const newQty = 5; // errou para mais, saiu só 5 ao invés de 15 -> devolve 10

    const result = calculateStockEditDelta(currentStock, "OUT", oldQty, newQty);
    expect(result.newStock).toBe(20);
    expect(result.delta).toBe(10);
  });
});


