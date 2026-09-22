"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ProductArt } from "@/lib/product-images";
import { autoTranslateStoreText } from "@/lib/catalog/translation";
import { updateProduct } from "../actions";
import { OfferStudio, type SerializedOffer, type SerializedProviderOffer } from "./offers/offer-studio";

export type ProductStudioProps = {
  product: {
    id: string;
    slug: string;
    categoryId: string;
    nameEn: string;
    nameAr: string;
    nameFr: string;
    descriptionEn: string;
    descriptionAr: string;
    descriptionFr: string;
    shortEn: string;
    shortAr: string;
    shortFr: string;
    image: string | null;
    isActive: boolean;
    isFeatured: boolean;
    isNew: boolean;
    contentLocked: boolean;
    sortOrder: number;
    category: {
      id: string;
      nameEn: string;
      slug: string;
    };
  };
  categories: { id: string; nameEn: string; slug: string }[];
  offers: SerializedOffer[];
  pool: SerializedProviderOffer[];
  providers: { code: string; displayName: string }[];
  locale: string;
  initialTab?: "VARIANTS" | "DETAILS";
};

export function ProductStudio({
  product,
  categories,
  offers,
  pool,
  providers,
  locale,
  initialTab = "VARIANTS",
}: ProductStudioProps) {
  const [activeTab, setActiveTab] = useState<"VARIANTS" | "DETAILS">(initialTab);
  const [isPending, startTransition] = useTransition();
  const [detailsSaved, setDetailsSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [nameEn, setNameEn] = useState(product.nameEn);
  const [nameAr, setNameAr] = useState(product.nameAr);
  const [nameFr, setNameFr] = useState(product.nameFr);
  const [slug, setSlug] = useState(product.slug);
  const [categoryId, setCategoryId] = useState(product.categoryId);
  const [descEn, setDescEn] = useState(product.descriptionEn);
  const [descAr, setDescAr] = useState(product.descriptionAr);
  const [descFr, setDescFr] = useState(product.descriptionFr);
  const [shortEn, setShortEn] = useState(product.shortEn);
  const [shortAr, setShortAr] = useState(product.shortAr);
  const [shortFr, setShortFr] = useState(product.shortFr);
  const [image, setImage] = useState(product.image ?? "");
  const [sortOrder, setSortOrder] = useState(String(product.sortOrder));
  const [isActive, setIsActive] = useState(product.isActive);
  const [isFeatured, setIsFeatured] = useState(product.isFeatured);
  const [isNew, setIsNew] = useState(product.isNew);
  const [contentLocked, setContentLocked] = useState(product.contentLocked);

  // Language switcher for Tab 2
  const [langTab, setLangTab] = useState<"EN" | "AR" | "FR">("EN");

  // Auto-translate handler
  const handleAutoTranslate = () => {
    if (!nameEn.trim()) return;
    const nameTrans = autoTranslateStoreText(nameEn);
    setNameAr(nameTrans.ar);
    setNameFr(nameTrans.fr);

    if (descEn.trim()) {
      const descTrans = autoTranslateStoreText(descEn);
      setDescAr(descTrans.ar);
      setDescFr(descTrans.fr);
    }
    if (shortEn.trim()) {
      const shortTrans = autoTranslateStoreText(shortEn);
      setShortAr(shortTrans.ar);
      setShortFr(shortTrans.fr);
    }
  };

  const handleSaveDetails = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setDetailsSaved(false);

    const formData = new FormData();
    formData.set("nameEn", nameEn);
    formData.set("nameAr", nameAr || autoTranslateStoreText(nameEn).ar || nameEn);
    formData.set("nameFr", nameFr || autoTranslateStoreText(nameEn).fr || nameEn);
    formData.set("slug", slug);
    formData.set("categoryId", categoryId);
    formData.set("descriptionEn", descEn);
    formData.set("descriptionAr", descAr);
    formData.set("descriptionFr", descFr);
    formData.set("shortEn", shortEn);
    formData.set("shortAr", shortAr);
    formData.set("shortFr", shortFr);
    formData.set("image", image);
    formData.set("sortOrder", sortOrder);
    if (isActive) formData.set("isActive", "on");
    if (isFeatured) formData.set("isFeatured", "on");
    if (isNew) formData.set("isNew", "on");
    if (contentLocked) formData.set("contentLocked", "on");

    startTransition(async () => {
      const res = await updateProduct(product.id, formData);
      if ("error" in res) {
        setError(`Failed to update: ${res.error}`);
        return;
      }
      setDetailsSaved(true);
      setTimeout(() => setDetailsSaved(false), 4000);
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Product Header */}
      <div className="flex flex-col gap-4 border-b border-[var(--border)] pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/${locale}/admin/catalog`}
            className="rounded-full border border-[var(--border)] p-2 text-xs font-semibold text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)] transition"
            title="Back to Catalog"
          >
            ←
          </Link>
          <ProductArt id={product.slug} size={50} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-[var(--fg)]">
                {product.nameEn}
              </h1>
              <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-0.5 text-xs font-semibold text-[var(--fg-muted)]">
                {product.category.nameEn}
              </span>
              {isActive ? (
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  Active
                </span>
              ) : (
                <span className="rounded-full bg-zinc-500/10 px-2 py-0.5 text-xs font-bold text-zinc-500">
                  Paused
                </span>
              )}
            </div>
            <p className="font-mono text-xs text-[var(--fg-muted)] mt-0.5">
              Slug: {product.slug}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/${locale}/products/${product.slug}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-1.5 text-xs font-semibold hover:bg-[var(--surface-2)] transition"
          >
            View on Store ↗
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--border)]">
        <button
          onClick={() => setActiveTab("VARIANTS")}
          className={`relative pb-3 text-sm font-semibold transition ${
            activeTab === "VARIANTS"
              ? "text-[var(--accent)]"
              : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
          }`}
        >
          ⚡ Variants & Supplier Links ({offers.length})
          {activeTab === "VARIANTS" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)]" />
          )}
        </button>

        <button
          onClick={() => setActiveTab("DETAILS")}
          className={`relative ml-6 pb-3 text-sm font-semibold transition ${
            activeTab === "DETAILS"
              ? "text-[var(--accent)]"
              : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
          }`}
        >
          📝 Product Details & Content
          {activeTab === "DETAILS" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)]" />
          )}
        </button>
      </div>

      {/* Tab 1: Variant & Supplier Studio */}
      {activeTab === "VARIANTS" && (
        <OfferStudio
          productId={product.id}
          productNameEn={product.nameEn}
          productSlug={product.slug}
          locale={locale}
          offers={offers}
          pool={pool}
          providers={providers}
        />
      )}

      {/* Tab 2: Product Details & Translations */}
      {activeTab === "DETAILS" && (
        <form onSubmit={handleSaveDetails} className="max-w-3xl space-y-6">
          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm font-semibold text-rose-600 dark:text-rose-400">
              ✕ {error}
            </div>
          )}
          {detailsSaved && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              ✓ Product details updated successfully!
            </div>
          )}

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div>
                <h3 className="text-base font-bold">General Information</h3>
                <p className="text-xs text-[var(--fg-muted)]">
                  Primary title, category assignment, and URL slug.
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

            {/* Title EN */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)] mb-1">
                Product Title (EN) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm outline-none focus:border-[var(--accent)]"
              />
            </div>

            {/* Category & Slug */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)] mb-1">
                  Category
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nameEn} ({c.slug})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)] mb-1">
                  Slug
                </label>
                <input
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-mono outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>

            {/* Image URL & Sort Order */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)] mb-1">
                  Logo / Image URL (optional)
                </label>
                <input
                  type="text"
                  placeholder="https://… or /logos/…"
                  value={image}
                  onChange={(e) => setImage(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--fg-muted)] mb-1">
                  Sort Order
                </label>
                <input
                  type="number"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>

            {/* Language Tabs for Descriptions */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2 border-b border-[var(--border)] pb-2 text-xs font-semibold">
                <span className="text-[var(--fg-muted)] mr-2">Language Content:</span>
                <button
                  type="button"
                  onClick={() => setLangTab("EN")}
                  className={`rounded-lg px-2.5 py-1 transition ${
                    langTab === "EN" ? "bg-[var(--accent)] text-white" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
                  }`}
                >
                  🇬🇧 English
                </button>
                <button
                  type="button"
                  onClick={() => setLangTab("AR")}
                  className={`rounded-lg px-2.5 py-1 transition ${
                    langTab === "AR" ? "bg-[var(--accent)] text-white" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
                  }`}
                >
                  🇩🇿 Arabic
                </button>
                <button
                  type="button"
                  onClick={() => setLangTab("FR")}
                  className={`rounded-lg px-2.5 py-1 transition ${
                    langTab === "FR" ? "bg-[var(--accent)] text-white" : "text-[var(--fg-muted)] hover:text-[var(--fg)]"
                  }`}
                >
                  🇫🇷 French
                </button>
              </div>

              {langTab === "EN" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-[var(--fg-muted)] mb-1">Short Tagline (EN)</label>
                    <input
                      type="text"
                      value={shortEn}
                      onChange={(e) => setShortEn(e.target.value)}
                      placeholder="Brief highlight…"
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--fg-muted)] mb-1">Full Description (EN)</label>
                    <textarea
                      rows={4}
                      value={descEn}
                      onChange={(e) => setDescEn(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-xs outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                </div>
              )}

              {langTab === "AR" && (
                <div className="space-y-3" dir="rtl">
                  <div>
                    <label className="block text-xs text-[var(--fg-muted)] mb-1">اسم المنتج (بالعربية)</label>
                    <input
                      type="text"
                      value={nameAr}
                      onChange={(e) => setNameAr(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--fg-muted)] mb-1">وصف موجز (بالعربية)</label>
                    <input
                      type="text"
                      value={shortAr}
                      onChange={(e) => setShortAr(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--fg-muted)] mb-1">الوصف الكامل (بالعربية)</label>
                    <textarea
                      rows={4}
                      value={descAr}
                      onChange={(e) => setDescAr(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-xs outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                </div>
              )}

              {langTab === "FR" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-[var(--fg-muted)] mb-1">Nom du produit (Français)</label>
                    <input
                      type="text"
                      value={nameFr}
                      onChange={(e) => setNameFr(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--fg-muted)] mb-1">Courte description (Français)</label>
                    <input
                      type="text"
                      value={shortFr}
                      onChange={(e) => setShortFr(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[var(--fg-muted)] mb-1">Description complète (Français)</label>
                    <textarea
                      rows={4}
                      value={descFr}
                      onChange={(e) => setDescFr(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-xs outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Flags */}
            <div className="flex flex-wrap gap-4 border-t border-[var(--border)] pt-4 text-xs font-semibold">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-[var(--border)] accent-[var(--accent)]"
                />
                Active (visible on store)
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="h-4 w-4 rounded border-[var(--border)] accent-amber-500"
                />
                Featured (highlight on homepage)
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isNew}
                  onChange={(e) => setIsNew(e.target.checked)}
                  className="h-4 w-4 rounded border-[var(--border)] accent-[var(--accent)]"
                />
                New badge
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={contentLocked}
                  onChange={(e) => setContentLocked(e.target.checked)}
                  className="h-4 w-4 rounded border-[var(--border)] accent-[var(--accent)]"
                />
                Content locked (protect from sync override)
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-full bg-[var(--accent)] px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[var(--accent-hover)] transition disabled:opacity-50"
            >
              {isPending ? "Saving Changes…" : "Save Product Details"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
