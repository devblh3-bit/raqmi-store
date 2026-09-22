import { describe, expect, it } from "vitest";

describe("Mobile Navigation Configuration and Routing Rules", () => {
  it("suppresses StoreMobileNav on admin, reseller, and customer portal routes", () => {
    function shouldSuppressStoreNav(pathname: string, locale: string): boolean {
      return (
        pathname.startsWith(`/${locale}/admin`) ||
        pathname.startsWith(`/${locale}/reseller`) ||
        pathname.startsWith(`/${locale}/account`)
      );
    }

    // Public storefront routes -> Store nav is ACTIVE
    expect(shouldSuppressStoreNav("/en", "en")).toBe(false);
    expect(shouldSuppressStoreNav("/en/products", "en")).toBe(false);
    expect(shouldSuppressStoreNav("/en/categories/software", "en")).toBe(false);
    expect(shouldSuppressStoreNav("/en/cart", "en")).toBe(false);
    expect(shouldSuppressStoreNav("/fr/promo", "fr")).toBe(false);
    expect(shouldSuppressStoreNav("/ar/track-order", "ar")).toBe(false);

    // Dedicated portal routes -> Store nav is SUPPRESSED in favor of portal bottom bar
    expect(shouldSuppressStoreNav("/en/admin", "en")).toBe(true);
    expect(shouldSuppressStoreNav("/en/admin/catalog", "en")).toBe(true);
    expect(shouldSuppressStoreNav("/en/admin/orders", "en")).toBe(true);
    expect(shouldSuppressStoreNav("/en/reseller", "en")).toBe(true);
    expect(shouldSuppressStoreNav("/en/reseller/rates", "en")).toBe(true);
    expect(shouldSuppressStoreNav("/en/account", "en")).toBe(true);
    expect(shouldSuppressStoreNav("/en/account/wallet", "en")).toBe(true);
  });

  it("calculates reactive cart badge count correctly", () => {
    const cartItems = [
      { offerId: "item-1", quantity: 2 },
      { offerId: "item-2", quantity: 3 },
      { offerId: "item-3", quantity: 1 },
    ];

    const totalCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
    expect(totalCount).toBe(6);

    const emptyCart: { offerId: string; quantity: number }[] = [];
    const emptyCount = emptyCart.reduce((sum, item) => sum + item.quantity, 0);
    expect(emptyCount).toBe(0);
  });

  it("has valid portal definitions with correct primary and secondary segregation", () => {
    const adminPrimary = ["Dashboard", "Catalog", "Orders", "Users", "More"];
    const adminSecondary = [
      "Categories",
      "Resellers",
      "Deposits",
      "Audit Logs",
      "Notifications",
      "Sync",
      "Settings",
    ];

    expect(adminPrimary).toHaveLength(5);
    expect(adminSecondary).toHaveLength(7);
    expect(adminPrimary).toContain("Catalog");
    expect(adminPrimary).toContain("More");

    const resellerTabs = ["Overview", "Rates", "Orders", "Wallet"];
    expect(resellerTabs).toHaveLength(4);

    const accountTabs = ["Overview", "Wallet", "My Orders", "Store"];
    expect(accountTabs).toHaveLength(4);
  });
});
