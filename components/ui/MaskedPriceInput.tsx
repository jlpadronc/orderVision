"use client";

import React, { useEffect, useState } from "react";
import type { CurrencyType } from "@/lib/validations/schemas";
import { formatCurrencyInput, parseCurrencyInput } from "@/lib/utils/currency";

export interface MaskedPriceInputProps {
  value: number | string | null | undefined;
  currency: CurrencyType | string;
  onChange: (numericValue: number, displayString: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  name?: string;
  autoFocus?: boolean;
  min?: number;
}

export function MaskedPriceInput({
  value,
  currency = "USD",
  onChange,
  placeholder,
  className = "",
  style,
  required = false,
  disabled = false,
  id,
  name,
  autoFocus = false,
}: MaskedPriceInputProps) {
  const code = (currency || "USD").toUpperCase();

  // Inicializar el valor formateado
  const [displayValue, setDisplayValue] = useState<string>(() => {
    if (value === null || value === undefined || value === "") return "";
    return formatCurrencyInput(value, code);
  });

  // Sincronizar si cambia el prop `value` desde el exterior (ej. al resetear formulario)
  useEffect(() => {
    if (value === null || value === undefined || value === "") {
      setDisplayValue("");
      return;
    }
    const currentNum = parseCurrencyInput(displayValue, code);
    const propNum = typeof value === "number" ? value : parseCurrencyInput(value, code);
    if (currentNum !== propNum) {
      setDisplayValue(formatCurrencyInput(value, code));
    }
  }, [value, code]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const formatted = formatCurrencyInput(raw, code);
    setDisplayValue(formatted);
    const numeric = parseCurrencyInput(formatted, code);
    onChange(numeric, formatted);
  }

  function handleBlur() {
    // Limpiar separadores colgantes como "25." o "1250,"
    if (displayValue.endsWith(".") || displayValue.endsWith(",")) {
      const clean = displayValue.slice(0, -1);
      setDisplayValue(clean);
      const numeric = parseCurrencyInput(clean, code);
      onChange(numeric, clean);
    }
  }

  const defaultPlaceholder =
    placeholder ||
    (code === "COP"
      ? "Ej. 65.000"
      : code === "VES"
      ? "Ej. 1.250,50"
      : "Ej. 19.50");

  return (
    <input
      type="text"
      inputMode={code === "COP" ? "numeric" : "decimal"}
      autoComplete="off"
      id={id}
      name={name}
      required={required}
      disabled={disabled}
      autoFocus={autoFocus}
      placeholder={defaultPlaceholder}
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      style={style}
      className={className}
    />
  );
}
