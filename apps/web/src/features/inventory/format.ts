const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});
const INT = new Intl.NumberFormat("pt-BR");

export function formatPriceCents(cents: number): string {
  return BRL.format(Math.round(cents / 100));
}

export function formatKm(km: number): string {
  return `${INT.format(km)} km`;
}

export function formatYears(fab: number, model: number): string {
  return fab === model ? String(model) : `${fab}/${model}`;
}

/** "59.900", "59900", "59.900,50" → centavos; null se inválido. */
export function parseReaisToCents(value: string): number | null {
  const cleaned = value.replace(/r\$/gi, "").replace(/\s/g, "");
  if (!cleaned || !/^[0-9.,]+$/.test(cleaned)) return null;
  let normalized = cleaned;
  if (cleaned.includes(",")) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(".")) {
    const parts = cleaned.split(".");
    const last = parts[parts.length - 1];
    normalized = parts.length > 2 || last.length === 3 ? parts.join("") : cleaned;
  }
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

export function centsToReaisInput(cents: number): string {
  return INT.format(Math.round(cents / 100));
}

export function parseIntLoose(value: string): number | null {
  const digits = value.replace(/[\s.]/g, "").replace(/km/gi, "");
  if (!/^\d+$/.test(digits)) return null;
  return Number(digits);
}
