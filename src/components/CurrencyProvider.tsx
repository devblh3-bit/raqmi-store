"use client";

import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { formatPrice, formatDZD } from "@/lib/format";

export type Currency = "DZD" | "USD";

interface CurrencyContextValue {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  dzdRate: number;
  formatAmount: (usdCents: number, locale: string) => {
    primary: string;
    secondary: string;
    rawDzd: number;
    rawUsd: number;
  };
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

const STORAGE_KEY = "store_currency";

export function CurrencyProvider({
  children,
  dzdRate = 240,
  initialCurrency = "DZD",
}: {
  children: React.ReactNode;
  dzdRate?: number;
  initialCurrency?: Currency;
}) {
  const [currency, setCurrencyState] = useState<Currency>(initialCurrency);

  // Synchronize with client storage (localStorage / cookie) on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Currency | null;
      if (stored === "DZD" || stored === "USD") {
        setCurrencyState(stored);
        return;
      }
      // Check document.cookie
      const match = document.cookie.match(/(?:^|; )store_currency=(DZD|USD)(?:;|$)/);
      if (match && (match[1] === "DZD" || match[1] === "USD")) {
        setCurrencyState(match[1] as Currency);
      }
    } catch {
      // Ignore storage access errors in restricted environments
    }
  }, []);

  const setCurrency = (c: Currency) => {
    setCurrencyState(c);
    try {
      localStorage.setItem(STORAGE_KEY, c);
      document.cookie = `${STORAGE_KEY}=${c}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {
      // Ignore storage access errors
    }
  };

  const value = useMemo<CurrencyContextValue>(() => {
    const rate = Number.isFinite(dzdRate) && dzdRate > 0 ? dzdRate : 240;

    return {
      currency,
      setCurrency,
      dzdRate: rate,
      formatAmount: (usdCents: number, locale: string) => {
        const rawDzd = Math.round((usdCents / 100) * rate);
        const rawUsd = usdCents / 100;
        const dzdFormatted = formatDZD(usdCents, rate, locale);
        const usdFormatted = formatPrice(usdCents, locale, "USD");

        if (currency === "DZD") {
          return {
            primary: dzdFormatted,
            secondary: `≈ ${usdFormatted} USD`,
            rawDzd,
            rawUsd,
          };
        } else {
          return {
            primary: usdFormatted,
            secondary: `≈ ${dzdFormatted}`,
            rawDzd,
            rawUsd,
          };
        }
      },
    };
  }, [currency, dzdRate]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    // Graceful fallback if rendered outside provider
    return {
      currency: "DZD",
      setCurrency: () => {},
      dzdRate: 240,
      formatAmount: (usdCents: number, locale: string) => {
        const dzd = formatDZD(usdCents, 240, locale);
        const usd = formatPrice(usdCents, locale, "USD");
        return {
          primary: dzd,
          secondary: `≈ ${usd} USD`,
          rawDzd: Math.round((usdCents / 100) * 240),
          rawUsd: usdCents / 100,
        };
      },
    };
  }
  return ctx;
}
