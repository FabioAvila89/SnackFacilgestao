import { describe, it, expect } from "vitest";
import { desdobrarParcelas, determinarStatusPorVencimento } from "../src/lib/installments";

describe("desdobrarParcelas (Regras de Vencimento, Centavos e Status)", () => {
  const hojeMock = "2026-10-31";

  it("deve definir status PENDING se a primeira parcela for futura em relação a hoje", () => {
    // Vencimento em 04/11/2026 quando hoje é 31/10/2026
    const parcelas = desdobrarParcelas(1000, 2, "2026-11-04", hojeMock);

    expect(parcelas).toHaveLength(2);
    expect(parcelas[0].dataVencimentoStr).toBe("2026-11-04");
    expect(parcelas[0].statusSugerido).toBe("PENDING");

    expect(parcelas[1].dataVencimentoStr).toBe("2026-12-04");
    expect(parcelas[1].statusSugerido).toBe("PENDING");
  });

  it("deve definir status PAID se a primeira parcela for na data de hoje e PENDING nas futuras", () => {
    // Vencimento em 31/10/2026 quando hoje é 31/10/2026
    const parcelas = desdobrarParcelas(1000, 2, "2026-10-31", hojeMock);

    expect(parcelas[0].dataVencimentoStr).toBe("2026-10-31");
    expect(parcelas[0].statusSugerido).toBe("PAID"); // Data atual

    expect(parcelas[1].dataVencimentoStr).toBe("2026-11-30");
    expect(parcelas[1].statusSugerido).toBe("PENDING"); // Futura
  });

  it("deve definir status PAID se a parcela for em data passada (retroativa)", () => {
    // Vencimento em 15/10/2026 quando hoje é 31/10/2026
    const parcelas = desdobrarParcelas(1000, 2, "2026-10-15", hojeMock);

    expect(parcelas[0].dataVencimentoStr).toBe("2026-10-15");
    expect(parcelas[0].statusSugerido).toBe("PAID");
  });

  it("deve somar sobra de centavos na primeira parcela (ex: R$ 1000 em 3x)", () => {
    const parcelas = desdobrarParcelas(1000, 3, "2026-11-10", hojeMock);

    expect(parcelas).toHaveLength(3);
    expect(parcelas[0].valorParcela).toBe(333.34);
    expect(parcelas[1].valorParcela).toBe(333.33);
    expect(parcelas[2].valorParcela).toBe(333.33);

    const total = parcelas.reduce((acc, p) => acc + p.valorParcela, 0);
    expect(Number(total.toFixed(2))).toBe(1000.0);
  });

  it("deve aplicar a regra de âncora de fim de mês e retornar para o dia 31 (31/01 -> 28/02 -> 31/03)", () => {
    const parcelas = desdobrarParcelas(300, 3, "2026-01-31", hojeMock);

    expect(parcelas[0].dataVencimentoStr).toBe("2026-01-31");
    expect(parcelas[1].dataVencimentoStr).toBe("2026-02-28");
    expect(parcelas[2].dataVencimentoStr).toBe("2026-03-31");
  });
});
