"use client";

import { useEffect } from "react";
import { useCart } from "@/components/CartProvider";

export function ClearCartAfterCheckout() {
  const { clear } = useCart();

  useEffect(() => {
    clear();
  }, [clear]);

  return null;
}
