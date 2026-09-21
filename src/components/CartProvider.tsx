"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type CartItem = {
  offerId: string;
  label: string;
  price: number;
  locale: string;
  requiresCustomerInput: boolean;
  customerPrompt?: string;
  customerInput?: string;
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">) => void;
  removeItem: (offerId: string) => void;
  updateInput: (offerId: string, customerInput: string) => void;
  clear: () => void;
};

const STORAGE_KEY = "raqmi-cart";
const CartContext = createContext<CartContextValue | null>(null);

function readCart(): CartItem[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter(
      (item): item is CartItem =>
        typeof item === "object" &&
        item !== null &&
        typeof item.offerId === "string" &&
        typeof item.label === "string" &&
        typeof item.price === "number" &&
        Number.isFinite(item.price) &&
        item.price >= 0 &&
        typeof item.locale === "string" &&
        typeof item.requiresCustomerInput === "boolean" &&
        typeof item.quantity === "number" &&
        Number.isInteger(item.quantity) &&
        item.quantity >= 1 &&
        item.quantity <= 100,
    );
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Cart data is browser-only; defer loading it until hydration to keep SSR markup stable.
  useEffect(() => {
    const cart = readCart();
    queueMicrotask(() => {
      setItems(cart);
      setHydrated(true);
    });
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // The cart remains usable for this page view when browser storage is unavailable.
    }
  }, [hydrated, items]);

  const addItem = useCallback((item: Omit<CartItem, "quantity">) => {
    const customerInput = item.customerInput?.trim() || undefined;
    setItems((current) => {
      const existing = current.find((entry) => entry.offerId === item.offerId);
      if (existing) {
        return current.map((entry) =>
          entry.offerId === item.offerId
            ? {
                ...entry,
                quantity: Math.min(entry.quantity + 1, 100),
                customerInput: entry.customerInput?.trim() || customerInput,
              }
            : entry,
        );
      }
      return [...current, { ...item, customerInput, quantity: 1 }];
    });
  }, []);

  const removeItem = useCallback((offerId: string) => {
    setItems((current) => current.filter((item) => item.offerId !== offerId));
  }, []);

  const updateInput = useCallback((offerId: string, customerInput: string) => {
    setItems((current) => current.map((item) => (item.offerId === offerId ? { ...item, customerInput } : item)));
  }, []);

  const clear = useCallback(() => setItems([]), []);
  const value = useMemo(() => ({ items, addItem, removeItem, updateInput, clear }), [items, addItem, removeItem, updateInput, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used within CartProvider");
  return value;
}
