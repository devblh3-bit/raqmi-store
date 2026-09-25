"use client";

import { useState } from "react";
import Link from "next/link";
import { CatalogTable, type CatalogProduct, type CategoryOption } from "./catalog-table";
import {
  UnlinkedOffersInbox,
  type UnlinkedProviderOffer,
  type ExistingProductOption,
} from "./unlinked-offers-inbox";

export function CatalogView({
  products,
  categories,
  unlinkedOffers,
  existingProductOptions,
  locale,
}: {
  products: CatalogProduct[];
  categories: CategoryOption[];
  unlinkedOffers: UnlinkedProviderOffer[];
  existingProductOptions: ExistingProductOption[];
  locale: string;
}) {
  const [activeTab, setActiveTab] = useState<"PRODUCTS" | "UNLINKED">("PRODUCTS");

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Catalog Management</h1>
          <p className="text-xs text-[var(--fg-muted)] mt-0.5">
            Full control over store products, wholesale supplier offers, variants, and pricing.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/${locale}/admin/sync`}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold text-[var(--fg)] hover:bg-[var(--surface-2)] transition"
          >
            Sync Suppliers 🔄
          </Link>
          <Link
            href={`/${locale}/admin/catalog/new`}
            className="rounded-full bg-[var(--accent)] px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-[var(--accent-hover)] transition"
          >
            + New Product
          </Link>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex border-b border-[var(--border)]">
        <button
          onClick={() => setActiveTab("PRODUCTS")}
          className={`relative pb-3 text-sm font-semibold transition ${
            activeTab === "PRODUCTS"
              ? "text-[var(--accent)]"
              : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
          }`}
        >
          Store Products ({products.length})
          {activeTab === "PRODUCTS" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)]" />
          )}
        </button>

        <button
          onClick={() => setActiveTab("UNLINKED")}
          className={`relative ml-6 pb-3 text-sm font-semibold transition flex items-center gap-2 ${
            activeTab === "UNLINKED"
              ? "text-[var(--accent)]"
              : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
          }`}
        >
          <span>Unlinked Supplier Offers</span>
          {unlinkedOffers.length > 0 ? (
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-600 dark:text-amber-400 animate-pulse">
              {unlinkedOffers.length} new
            </span>
          ) : (
            <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--fg-muted)]">
              0
            </span>
          )}
          {activeTab === "UNLINKED" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)]" />
          )}
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "PRODUCTS" ? (
        <CatalogTable products={products} categories={categories} locale={locale} />
      ) : (
        <UnlinkedOffersInbox
          offers={unlinkedOffers}
          categories={categories}
          existingProducts={existingProductOptions}
        />
      )}
    </div>
  );
}
