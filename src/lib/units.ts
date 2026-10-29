export interface UnitMeasureOption {
  value: string;
  label: string;
  symbol: string;
}

export const UNIT_MEASURES: UnitMeasureOption[] = [
  { value: "UN", label: "Unidade (un)", symbol: "un" },
  { value: "KG", label: "Quilograma (kg)", symbol: "kg" },
  { value: "G", label: "Grama (g)", symbol: "g" },
  { value: "L", label: "Litro (L)", symbol: "L" },
  { value: "ML", label: "Mililitro (ml)", symbol: "ml" },
  { value: "M", label: "Metro (m)", symbol: "m" },
  { value: "M2", label: "Metro quadrado (m²)", symbol: "m²" },
  { value: "M3", label: "Metro cúbico (m³)", symbol: "m³" },
];

export function getUnitSymbol(unit?: string | null): string {
  if (!unit) return "un";
  const normalized = unit.trim().toUpperCase();
  const found = UNIT_MEASURES.find(
    (u) => u.value === normalized || u.symbol.toUpperCase() === normalized
  );
  return found ? found.symbol : unit.toLowerCase();
}

export function getUnitLabel(unit?: string | null): string {
  if (!unit) return "Unidade (un)";
  const normalized = unit.trim().toUpperCase();
  const found = UNIT_MEASURES.find(
    (u) => u.value === normalized || u.symbol.toUpperCase() === normalized
  );
  return found ? found.label : unit;
}

