import type { CurrencyType } from "@/lib/validations/schemas";

export interface ExchangeRatesMap {
  USD: number;
  COP: number;
  VES: number;
}

export const DEFAULT_EXCHANGE_RATES: ExchangeRatesMap = {
  USD: 1,
  COP: 4200,
  VES: 46.8,
};

/**
 * Normaliza el mapa de tasas de cambio de un Tenant.
 * Todas las tasas están expresadas respecto a 1 USD (1 USD = X COP, 1 USD = Y VES).
 */
export function resolveExchangeRates(
  rawRates?: Partial<ExchangeRatesMap> | null
): ExchangeRatesMap {
  return {
    USD: 1,
    COP:
      rawRates?.COP && Number(rawRates.COP) > 0
        ? Number(rawRates.COP)
        : DEFAULT_EXCHANGE_RATES.COP,
    VES:
      rawRates?.VES && Number(rawRates.VES) > 0
        ? Number(rawRates.VES)
        : DEFAULT_EXCHANGE_RATES.VES,
  };
}

/**
 * Convierte un monto desde `fromCurrency` hacia `toCurrency` usando las tasas del Tenant.
 */
export function convertCurrency(
  amount: number,
  fromCurrency: CurrencyType | string,
  toCurrency: CurrencyType | string,
  rawRates?: Partial<ExchangeRatesMap> | null
): number {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const from = (fromCurrency || "USD").toUpperCase();
  const to = (toCurrency || "USD").toUpperCase();

  if (from === to) {
    return Number(safeAmount.toFixed(to === "COP" ? 0 : 2));
  }

  const rates = resolveExchangeRates(rawRates);

  // 1. Llevar primero a USD base
  let amountInUsd = safeAmount;
  if (from === "COP") {
    amountInUsd = safeAmount / rates.COP;
  } else if (from === "VES") {
    amountInUsd = safeAmount / rates.VES;
  }

  // 2. Convertir de USD a la moneda destino
  let result = amountInUsd;
  if (to === "COP") {
    result = amountInUsd * rates.COP;
    return Math.round(result);
  }
  if (to === "VES") {
    result = amountInUsd * rates.VES;
    return Number(result.toFixed(2));
  }

  return Number(result.toFixed(2));
}

/**
 * Formatea un monto con símbolo y código de moneda claro:
 * - COP: "$ 85.000 COP"
 * - USD: "$19.50 USD"
 * - VES: "Bs. 912,60 VES"
 */
export function formatMoney(
  amount: number,
  currency: CurrencyType | string = "USD",
  includeCode = true
): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const code = (currency || "USD").toUpperCase();

  if (code === "COP") {
    const formatted = Math.round(safeAmount).toLocaleString("es-CO");
    return includeCode ? `$ ${formatted} COP` : `$ ${formatted}`;
  }

  if (code === "VES") {
    const formatted = safeAmount.toLocaleString("es-VE", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return includeCode ? `Bs. ${formatted} VES` : `Bs. ${formatted}`;
  }

  const formatted = safeAmount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return includeCode ? `$${formatted} USD` : `$${formatted}`;
}

/**
 * Devuelve un texto compacto con las equivalencias en las otras monedas
 * (ej. si el pedido está en COP, muestra su equivalente en USD y VES).
 */
export function formatEquivalentSummary(
  amount: number,
  primaryCurrency: CurrencyType | string,
  rawRates?: Partial<ExchangeRatesMap> | null
): string {
  const code = (primaryCurrency || "USD").toUpperCase();
  const rates = resolveExchangeRates(rawRates);

  if (code === "COP") {
    const inUsd = convertCurrency(amount, "COP", "USD", rates);
    const inVes = convertCurrency(amount, "COP", "VES", rates);
    return `≈ ${formatMoney(inUsd, "USD")} • ${formatMoney(inVes, "VES")}`;
  }

  if (code === "USD") {
    const inCop = convertCurrency(amount, "USD", "COP", rates);
    const inVes = convertCurrency(amount, "USD", "VES", rates);
    return `≈ ${formatMoney(inCop, "COP")} • ${formatMoney(inVes, "VES")}`;
  }

  const inUsd = convertCurrency(amount, "VES", "USD", rates);
  const inCop = convertCurrency(amount, "VES", "COP", rates);
  return `≈ ${formatMoney(inUsd, "USD")} • ${formatMoney(inCop, "COP")}`;
}

/**
 * Formatea una entrada numérica aplicando la máscara según la moneda y formato del país:
 * - COP: Enteros con separador de miles '.' (ej: 65000 -> "65.000")
 * - USD: Separador de miles ',' y decimales '.' hasta 2 dígitos (ej: 1250.5 -> "1,250.5")
 * - VES: Separador de miles '.' y decimales ',' hasta 2 dígitos (ej: 1250,5 -> "1.250,5")
 */
export function formatCurrencyInput(
  rawInput: string | number | null | undefined,
  currency: CurrencyType | string = "USD"
): string {
  if (rawInput === null || rawInput === undefined || rawInput === "") return "";
  const code = (currency || "USD").toUpperCase();
  const str = String(rawInput);

  if (code === "COP") {
    const cleanDigits = str.replace(/\D/g, "");
    if (!cleanDigits) return "";
    const num = Number.parseInt(cleanDigits, 10);
    if (!Number.isFinite(num)) return "";
    return num.toLocaleString("es-CO");
  }

  if (code === "VES") {
    // Si el usuario escribió un punto decimal en lugar de coma, reemplazarlo
    let sanitized = str.replace(/[^0-9,]/g, "");
    if (str.includes(".") && !str.includes(",")) {
      sanitized = str.replace(/[^0-9.]/g, "").replace(".", ",");
    }
    const parts = sanitized.split(",");
    const intDigits = parts[0]?.replace(/\D/g, "") || "";
    const decDigits = parts.length > 1 ? parts.slice(1).join("").slice(0, 2) : null;

    if (!intDigits && decDigits === null) return "";
    const intNum = intDigits ? Number.parseInt(intDigits, 10) : 0;
    const formattedInt = intDigits ? intNum.toLocaleString("es-VE") : "0";

    return decDigits !== null ? `${formattedInt},${decDigits}` : formattedInt;
  }

  // USD (formato estándar internacional con coma de miles y punto decimal)
  let sanitized = str.replace(/[^0-9.]/g, "");
  if (str.includes(",") && !str.includes(".")) {
    sanitized = str.replace(/[^0-9,]/g, "").replace(",", ".");
  }
  const parts = sanitized.split(".");
  const intDigits = parts[0]?.replace(/\D/g, "") || "";
  const decDigits = parts.length > 1 ? parts.slice(1).join("").slice(0, 2) : null;

  if (!intDigits && decDigits === null) return "";
  const intNum = intDigits ? Number.parseInt(intDigits, 10) : 0;
  const formattedInt = intDigits ? intNum.toLocaleString("en-US") : "0";

  return decDigits !== null ? `${formattedInt}.${decDigits}` : formattedInt;
}

/**
 * Parsea el valor con máscara de moneda a un número flotante estándar de JavaScript.
 */
export function parseCurrencyInput(
  displayValue: string | number | null | undefined,
  currency: CurrencyType | string = "USD"
): number {
  if (displayValue === null || displayValue === undefined || displayValue === "") return 0;
  if (typeof displayValue === "number") return Number.isFinite(displayValue) ? displayValue : 0;

  const code = (currency || "USD").toUpperCase();
  const str = String(displayValue).trim();

  if (code === "COP") {
    const cleanDigits = str.replace(/\D/g, "");
    return cleanDigits ? Number.parseInt(cleanDigits, 10) : 0;
  }

  if (code === "VES") {
    // Quitar puntos de miles y sustituir coma decimal por punto
    const normalized = str.replace(/\./g, "").replace(",", ".");
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  // USD: quitar comas de miles
  const normalized = str.replace(/,/g, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

