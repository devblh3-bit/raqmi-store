"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { autoTranslateStoreText, cleanProviderDescription } from "@/lib/catalog/translation";
import { formatProviderCostDisplay } from "@/lib/money";
import { createProductWithInitialOffer } from "../actions";

export type CategoryItem = {
  id: string;
  slug: string;
  nameEn: string;
};

export type SupplierOfferSnippet = {
  id: string;
  rawName: string;
  rawNameEn: string | null;
  providerSku: string;
  costMinor: string;
  currency: string;
  rawDescription?: string | null;
  rawDescriptionEn?: string | null;
  rawWarranty?: string | null;
  provider: { displayName: string };
};

export function NewProductForm({
  categories,
  supplierPool,
  locale,
}: {
  categories: CategoryItem[];
  supplierPool: SupplierOfferSnippet[];
  locale: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [nameFr, setNameFr] = useState("");
  const [slug, setSlug] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  const [descEn, setDescEn] = useState("");
  const [descAr, setDescAr] = useState("");
  const [descFr, setDescFr] = useState("");
  const [activeLangTab, setActiveLangTab] = useState<"EN" | "AR" | "FR">("EN");

  // Initial variant state
  const [addVariant, setAddVariant] = useState(true);
  const [variantLabel, setVariantLabel] = useState("");
  const [variantMarkup, setVariantMarkup] = useState("15");
  const [selectedProviderOfferId, setSelectedProviderOfferId] = useState("");

  // Auto-translate handler
  const handleAutoTranslate = () => {
    if (!nameEn.trim()) return;
    const titleTrans = autoTranslateStoreText(nameEn);
    setNameAr(titleTrans.ar);
    setNameFr(titleTrans.fr);

    if (descEn.trim()) {
      const descTrans = autoTranslateStoreText(descEn);
      setDescAr(descTrans.ar);
      setDescFr(descTrans.fr);
    }
  };

  // When picking a supplier item from pool
  const handlePickSupplierItem = (offerId: string) => {
    setSelectedProviderOfferId(offerId);
    const offer = supplierPool.find((o) => o.id === offerId);
    if (offer) {
      const cleanName = offer.rawNameEn || offer.rawName;
      if (!nameEn) {
        setNameEn(cleanName);
        const auto = autoTranslateStoreText(cleanName);
        setNameAr(auto.ar);
        setNameFr(auto.fr);
      }
      if (!variantLabel) {
        setVariantLabel(cleanName);
      }
      const desc = cleanProviderDescription(
        offer.rawDescriptionEn || offer.rawDescription || offer.rawWarranty || ""
      );
      if (desc && !descEn) {
        setDescEn(desc);
        const autoDesc = autoTranslateStoreText(desc);
        setDescAr(autoDesc.ar);
        setDescFr(autoDesc.fr);
      }
    }
  };

  // Submit
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set("nameEn", nameEn);
    formData.set("nameAr", nameAr || autoTranslateStoreText(nameEn).ar || nameEn);
    formData.set("nameFr", nameFr || autoTranslateStoreText(nameEn).fr || nameEn);
    if (slug) formData.set("slug", slug);
    formData.set("categoryId", categoryId);
    if (descEn) formData.set("descriptionEn", descEn);
    if (descAr) formData.set("descriptionAr", descAr);
    if (descFr) formData.set("descriptionFr", descFr);
    formData.set("isActive", "on");

    if (addVariant && variantLabel.trim()) {
      formData.set("variantLabel", variantLabel);
      formData.set("variantMarkup", variantMarkup);
      if (selectedProviderOfferId) {
        formData.set("providerOfferId", selectedProviderOfferId);
      }
    }

    startTransition(async () => {
      const res = await createProductWithInitialOffer(formData);
      if ("error" in res) {
        setError(`Failed to create product: ${res.error}`);
        return;
      }
      router.push(`/${locale}/admin/catalog/${res.id}`);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm font-semibold text-rose-600 dark:text-rose-400">
          ✕ {error}
        </div>
      )}

      {/* Step 1: Product Basics */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <div>
            <h2 className="text-base font-bold tracking-tight">1. Product Information</h2>
            <p className="text-xs text-[var(--fg-muted)]">
              Enter product title and category. Translations can be auto-filled in 1 click.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAutoTranslate}
            className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 transition"
          >
            ✨ Auto-Translate AR & FR
          </button>
        </div>

        {/* Name EN */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)] mb-1">
            Product Title (EN) <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Free Fire Diamonds, Netflix Subscription, Steam Card"
            value={nameEn}
            onChange={(e) => {
              setNameEn(e.target.value);
              // Auto fill AR and FR if empty
              const auto = autoTranslateStoreText(e.target.value);
              setNameAr(auto.ar);
              setNameFr(auto.fr);
            }}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm outline-none transition focus:border-[var(--accent)]"
          />
        </div>

        {/* Category & Custom Slug */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)] mb-1">
              Category <span className="text-rose-500">*</span>
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameEn}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)] mb-1">
              Custom Slug (optional)
            </label>
            <input
              type="text"
              placeholder="auto-derived from title"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-mono outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>

        {/* Language Tabs for Arabic & French */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 border-b border-[var(--border)] pb-2 text-xs font-semibold">
            <span className="text-[var(--fg-muted)] mr-2">Translations:</span>
            <button
              type="button"
              onClick={() => setActiveLangTab("EN")}
              className={`rounded-lg px-2.5 py-1 transition ${
                activeLangTab === "EN"
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
              }`}
            >
              🇬🇧 English
            </button>
            <button
              type="button"
              onClick={() => setActiveLangTab("AR")}
              className={`rounded-lg px-2.5 py-1 transition ${
                activeLangTab === "AR"
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
              }`}
            >
              🇩🇿 Arabic ({nameAr ? "✓" : "empty"})
            </button>
            <button
              type="button"
              onClick={() => setActiveLangTab("FR")}
              className={`rounded-lg px-2.5 py-1 transition ${
                activeLangTab === "FR"
                  ? "bg-[var(--accent)] text-white"
                  : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
              }`}
            >
              🇫🇷 French ({nameFr ? "✓" : "empty"})
            </button>
          </div>

          {activeLangTab === "EN" && (
            <div>
              <label className="block text-xs text-[var(--fg-muted)] mb-1">Description (EN)</label>
              <textarea
                rows={2}
                value={descEn}
                onChange={(e) => setDescEn(e.target.value)}
                placeholder="Product description in English…"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-xs outline-none focus:border-[var(--accent)]"
              />
            </div>
          )}

          {activeLangTab === "AR" && (
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-[var(--fg-muted)] mb-1">Name (Arabic)</label>
                <input
                  type="text"
                  dir="rtl"
                  value={nameAr}
                  onChange={(e) => setNameAr(e.target.value)}
                  placeholder="اسم المنتج بالعربية…"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--fg-muted)] mb-1">Description (Arabic)</label>
                <textarea
                  rows={2}
                  dir="rtl"
                  value={descAr}
                  onChange={(e) => setDescAr(e.target.value)}
                  placeholder="وصف المنتج بالعربية…"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-xs outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>
          )}

          {activeLangTab === "FR" && (
            <div className="space-y-2">
              <div>
                <label className="block text-xs text-[var(--fg-muted)] mb-1">Name (French)</label>
                <input
                  type="text"
                  value={nameFr}
                  onChange={(e) => setNameFr(e.target.value)}
                  placeholder="Nom du produit en français…"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div>
                <label className="block text-xs text-[var(--fg-muted)] mb-1">Description (French)</label>
                <textarea
                  rows={2}
                  value={descFr}
                  onChange={(e) => setDescFr(e.target.value)}
                  placeholder="Description en français…"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-xs outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Step 2: Initial Variant & Supplier Connection */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
          <div>
            <h2 className="text-base font-bold tracking-tight">2. Initial Variant & Supplier Link</h2>
            <p className="text-xs text-[var(--fg-muted)]">
              Optionally create the first denomination / variant right now, or link an upstream supplier offer.
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
            <input
              type="checkbox"
              checked={addVariant}
              onChange={(e) => setAddVariant(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--border)] accent-[var(--accent)]"
            />
            Add first variant
          </label>
        </div>

        {addVariant && (
          <div className="space-y-4 pt-2">
            {/* Quick pick from supplier pool if available */}
            {supplierPool.length > 0 && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)] mb-1">
                  Optional: Link from Unlinked Supplier Offer
                </label>
                <select
                  value={selectedProviderOfferId}
                  onChange={(e) => handlePickSupplierItem(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs outline-none focus:border-[var(--accent)]"
                >
                  <option value="">-- None (Manual Variant) --</option>
                  {supplierPool.map((s) => {
                    const costDisplay = formatProviderCostDisplay(s.costMinor, s.currency);
                    return (
                      <option key={s.id} value={s.id}>
                        {s.provider.displayName}: {s.rawNameEn || s.rawName} ({costDisplay.primary}{costDisplay.secondary ? ` · ${costDisplay.secondary}` : ""})
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)] mb-1">
                  Variant Label (e.g. 100 Diamonds)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 100 Diamonds / 1 Month"
                  value={variantLabel}
                  onChange={(e) => setVariantLabel(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)] mb-1">
                  Profit Margin (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="500"
                  value={variantMarkup}
                  onChange={(e) => setVariantMarkup(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-2">
        <Link
          href={`/${locale}/admin/catalog`}
          className="rounded-full border border-[var(--border)] px-5 py-2 text-xs font-semibold hover:bg-[var(--surface-2)]"
        >
          ← Cancel
        </Link>
        <button
          type="submit"
          disabled={!nameEn.trim() || isPending}
          className="rounded-full bg-[var(--accent)] px-7 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[var(--accent-hover)] transition disabled:opacity-50"
        >
          {isPending ? "Creating Product…" : "Publish Product 🚀"}
        </button>
      </div>
    </form>
  );
}

