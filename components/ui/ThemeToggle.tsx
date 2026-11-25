"use client";

import React, { useEffect, useState } from "react";
import { Laptop, Moon, Sun } from "lucide-react";

export type ThemePreference = "system" | "light" | "dark";

interface ThemeToggleProps {
  className?: string;
  compact?: boolean;
}

export function ThemeToggle({ className = "", compact = false }: ThemeToggleProps) {
  const [preference, setPreference] = useState<ThemePreference>("system");
  const [systemIsDark, setSystemIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Leer preferencia guardada
    try {
      const saved = localStorage.getItem("ordervision_theme_preference") as ThemePreference | null;
      if (saved === "light" || saved === "dark" || saved === "system") {
        setPreference(saved);
      }
    } catch {
      // Ignorar restricciones de almacenamiento local
    }

    // Escuchar preferencia del dispositivo / sistema
    if (typeof window !== "undefined" && window.matchMedia) {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      setSystemIsDark(mediaQuery.matches);

      const listener = (e: MediaQueryListEvent) => {
        setSystemIsDark(e.matches);
      };

      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener("change", listener);
        return () => mediaQuery.removeEventListener("change", listener);
      }
    }
  }, []);

  function applyTheme(next: ThemePreference) {
    setPreference(next);
    try {
      if (next === "system") {
        localStorage.removeItem("ordervision_theme_preference");
        document.documentElement.removeAttribute("data-theme");
      } else {
        localStorage.setItem("ordervision_theme_preference", next);
        document.documentElement.setAttribute("data-theme", next);
      }
    } catch {
      // Ignorar restricciones
    }
  }

  function cycleTheme() {
    if (preference === "system") {
      applyTheme("light");
    } else if (preference === "light") {
      applyTheme("dark");
    } else {
      applyTheme("system");
    }
  }

  // Prevenir desajuste de hidratación en SSR
  if (!mounted) {
    return (
      <div
        className={`inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-800/60 px-2 text-xs font-semibold text-slate-300 opacity-60 ${className}`}
        aria-hidden="true"
      >
        <Laptop className="h-3.5 w-3.5" />
        {!compact && <span className="hidden sm:inline">Tema</span>}
      </div>
    );
  }

  const effectiveTheme = preference === "system" ? (systemIsDark ? "dark" : "light") : preference;

  let label = "Dispositivo";
  let title = "Tema del Dispositivo (Automático según tu sistema)";
  let Icon = Laptop;

  if (preference === "light") {
    label = "Claro";
    title = "Modo Claro forzado (Clic para cambiar a Oscuro)";
    Icon = Sun;
  } else if (preference === "dark") {
    label = "Oscuro";
    title = "Modo Oscuro forzado (Clic para cambiar a Dispositivo)";
    Icon = Moon;
  } else {
    title = `Tema: Dispositivo (${systemIsDark ? "Oscuro" : "Claro"}) (Clic para alternar)`;
  }

  return (
    <button
      type="button"
      onClick={cycleTheme}
      title={title}
      aria-label={title}
      className={`group inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-800/80 px-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition-all shadow-xs ${className}`}
    >
      <Icon
        className={`h-3.5 w-3.5 transition-transform group-hover:scale-110 ${
          preference === "light"
            ? "text-amber-400"
            : preference === "dark"
            ? "text-purple-400"
            : "text-blue-400"
        }`}
      />
      {!compact && (
        <span className="hidden sm:inline">
          {preference === "system" ? "Dispositivo" : label}
        </span>
      )}
    </button>
  );
}
