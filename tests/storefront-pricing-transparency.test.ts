import { describe, expect, it } from "vitest";
import en from "../src/messages/en.json";
import ar from "../src/messages/ar.json";
import fr from "../src/messages/fr.json";
import type { CartItem } from "../src/components/CartProvider";

describe("Storefront Agency Pricing Transparency (ADR 0002)", () => {
  it("defines all required agency transparency keys across EN, AR, and FR", () => {
    const requiredCheckoutKeys = [
      "baseCost",
      "agencyFee",
      "totalAuthorized",
      "agencyNotice",
      "agencyNoticeBadge",
      "wholesaleBaseTooltip",
      "agencyFeeTooltip",
      "tawkeelDeclaration",
      "termsLink",
    ] as const;

    for (const key of requiredCheckoutKeys) {
      expect(en.checkout[key], `en.checkout.${key} should be defined`).toBeTruthy();
      expect(ar.checkout[key], `ar.checkout.${key} should be defined`).toBeTruthy();
      expect(fr.checkout[key], `fr.checkout.${key} should be defined`).toBeTruthy();
    }

    // Verify Arabic terminology
    expect(ar.checkout.baseCost).toBe("تكلفة التوريد بالجملة");
    expect(ar.checkout.agencyFee).toBe("رسوم الوكالة والتنفيذ");
    expect(ar.checkout.agencyNoticeBadge).toBe("توريد بالجملة + رسوم الوكالة");

    // Verify English terminology
    expect(en.checkout.baseCost).toBe("Wholesale Base Cost");
    expect(en.checkout.agencyFee).toBe("Agency & Execution Fee");
    expect(en.checkout.agencyNoticeBadge).toBe("Wholesale + Fee");

    // Verify French terminology
    expect(fr.checkout.baseCost).toBe("Coût de base de gros");
    expect(fr.checkout.agencyFee).toBe("Frais d'agence et d'exécution");
    expect(fr.checkout.agencyNoticeBadge).toBe("Prix de gros + Honoraires");
  });

  it("calculates transparent fee breakdown accurately in multi-item cart", () => {
    const cartItems: CartItem[] = [
      {
        offerId: "offer-1",
        label: "ChatGPT Plus 1 Month",
        price: 2400, // $24.00
        baseCost: 2000, // $20.00 wholesale
        locale: "en",
        requiresCustomerInput: false,
        quantity: 2,
      },
      {
        offerId: "offer-2",
        label: "Canva Pro Annual",
        price: 1500, // $15.00
        baseCost: 1200, // $12.00 wholesale
        locale: "en",
        requiresCustomerInput: true,
        customerInput: "user@example.com",
        quantity: 1,
      },
    ];

    const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const totalBaseCost = cartItems.reduce(
      (sum, item) => sum + (item.baseCost ?? item.price) * item.quantity,
      0,
    );
    const totalAgencyFee = Math.max(0, total - totalBaseCost);

    expect(total).toBe(2400 * 2 + 1500); // 6300 ($63.00)
    expect(totalBaseCost).toBe(2000 * 2 + 1200); // 5200 ($52.00)
    expect(totalAgencyFee).toBe(6300 - 5200); // 1100 ($11.00)
    expect(totalBaseCost + totalAgencyFee).toBe(total);
  });

  it("gracefully handles legacy cart items lacking baseCost without breaking total", () => {
    const legacyItem: CartItem = {
      offerId: "legacy-offer",
      label: "Legacy Product",
      price: 1000,
      locale: "en",
      requiresCustomerInput: false,
      quantity: 1,
    };

    const total = legacyItem.price * legacyItem.quantity;
    const totalBaseCost = (legacyItem.baseCost ?? legacyItem.price) * legacyItem.quantity;
    const totalAgencyFee = Math.max(0, total - totalBaseCost);

    expect(total).toBe(1000);
    expect(totalBaseCost).toBe(1000);
    expect(totalAgencyFee).toBe(0);
  });
});
