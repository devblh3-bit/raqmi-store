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
  const [isInboxOpen, setIsInboxOpen] = useState(false);

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

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsInboxOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 text-xs font-semibold text-[var(--fg)] hover:bg-[var(--surface-2)] transition shadow-2xs"
          >
            <span>Inbox 📥</span>
            {unlinkedOffers.length > 0 && (
              <span className="flex h-5 items-center justify-center rounded-full bg-amber-500/15 px-1.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                {unlinkedOffers.length}
              </span>
            )}
          </button>
          <Link
            href={`/${locale}/admin/sync`}
            className="inline-flex h-9 items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3.5 text-xs font-semibold text-[var(--fg)] hover:bg-[var(--surface-2)] transition shadow-2xs"
          >
            Sync 🔄
          </Link>
          <Link
            href={`/${locale}/admin/catalog/new`}
            className="inline-flex h-9 items-center rounded-full bg-[var(--accent)] px-4 text-xs font-bold text-white shadow-xs hover:bg-[var(--accent-hover)] transition"
          >
            + New Product
          </Link>
        </div>
      </div>

      {/* Main Table Content */}
      <CatalogTable products={products} categories={categories} locale={locale} />

      {/* Inbox Slide-over Drawer */}
      {isInboxOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity">
          {/* Click away overlay */}
          <div className="absolute inset-0" onClick={() => setIsInboxOpen(false)} />
          
          {/* Drawer panel */}
          <div className="relative flex w-full max-w-4xl flex-col bg-[var(--surface)] shadow-2xl animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
              <h2 className="text-lg font-bold">Supplier Offers Inbox</h2>
              <button
                onClick={() => setIsInboxOpen(false)}
                className="rounded-full p-2 text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)] transition"
              >
                ✕ Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <UnlinkedOffersInbox
                offers={unlinkedOffers}
                categories={categories}
                existingProducts={existingProductOptions}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
