"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryActive,
} from "./actions";

export type SerializedCategory = {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  nameFr: string;
  descriptionEn: string;
  descriptionAr: string;
  descriptionFr: string;
  image: string | null;
  sortOrder: number;
  isActive: boolean;
  productsCount: number;
  createdAt: string;
};

export function CategoryManager({
  categories: initialCategories,
}: {
  categories: SerializedCategory[];
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editCat, setEditCat] = useState<SerializedCategory | null>(null);

  // Form states for Create/Edit
  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [nameFr, setNameFr] = useState("");
  const [slug, setSlug] = useState("");
  const [descriptionEn, setDescriptionEn] = useState("");
  const [descriptionAr, setDescriptionAr] = useState("");
  const [descriptionFr, setDescriptionFr] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);

  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const resetForm = () => {
    setNameEn("");
    setNameAr("");
    setNameFr("");
    setSlug("");
    setDescriptionEn("");
    setDescriptionAr("");
    setDescriptionFr("");
    setSortOrder("0");
    setIsActive(true);
  };

  const openEditModal = (cat: SerializedCategory) => {
    setEditCat(cat);
    setNameEn(cat.nameEn);
    setNameAr(cat.nameAr);
    setNameFr(cat.nameFr);
    setSlug(cat.slug);
    setDescriptionEn(cat.descriptionEn);
    setDescriptionAr(cat.descriptionAr);
    setDescriptionFr(cat.descriptionFr);
    setSortOrder(cat.sortOrder.toString());
    setIsActive(cat.isActive);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("nameEn", nameEn.trim());
      fd.append("nameAr", nameAr.trim());
      fd.append("nameFr", nameFr.trim());
      if (slug.trim()) fd.append("slug", slug.trim());
      if (descriptionEn.trim()) fd.append("descriptionEn", descriptionEn.trim());
      if (descriptionAr.trim()) fd.append("descriptionAr", descriptionAr.trim());
      if (descriptionFr.trim()) fd.append("descriptionFr", descriptionFr.trim());
      fd.append("sortOrder", sortOrder || "0");
      fd.append("isActive", isActive ? "true" : "false");

      const res = await createCategory(fd);
      if ("error" in res && res.error) {
        setActionError(`Failed to create category: ${res.error}`);
      } else if ("ok" in res && res.ok) {
        setActionSuccess(`Category "${nameEn}" created successfully!`);
        setIsCreateOpen(false);
        resetForm();
      }
    });
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCat) return;
    setActionError(null);
    setActionSuccess(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("id", editCat.id);
      fd.append("nameEn", nameEn.trim());
      fd.append("nameAr", nameAr.trim());
      fd.append("nameFr", nameFr.trim());
      if (slug.trim()) fd.append("slug", slug.trim());
      if (descriptionEn.trim()) fd.append("descriptionEn", descriptionEn.trim());
      if (descriptionAr.trim()) fd.append("descriptionAr", descriptionAr.trim());
      if (descriptionFr.trim()) fd.append("descriptionFr", descriptionFr.trim());
      fd.append("sortOrder", sortOrder || "0");
      fd.append("isActive", isActive ? "true" : "false");

      const res = await updateCategory(fd);
      if ("error" in res && res.error) {
        setActionError(`Failed to update category: ${res.error}`);
      } else if ("ok" in res && res.ok) {
        setActionSuccess(`Category "${nameEn}" updated!`);
        setEditCat(null);
        resetForm();
      }
    });
  };

  const handleDelete = (cat: SerializedCategory) => {
    if (cat.productsCount > 0) {
      setActionError(`Cannot delete "${cat.nameEn}" because it has ${cat.productsCount} linked products.`);
      return;
    }
    if (!confirm(`Are you sure you want to delete category "${cat.nameEn}"?`)) return;

    setActionError(null);
    setActionSuccess(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("id", cat.id);
      const res = await deleteCategory(fd);
      if ("error" in res && res.error) {
        setActionError(`Delete failed: ${res.error}`);
      } else if ("ok" in res && res.ok) {
        setActionSuccess(`Category "${cat.nameEn}" deleted!`);
      }
    });
  };

  const handleToggleActive = (cat: SerializedCategory) => {
    setActionError(null);
    setActionSuccess(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("id", cat.id);
      const res = await toggleCategoryActive(fd);
      if ("error" in res && res.error) {
        setActionError(`Toggle failed: ${res.error}`);
      } else if ("ok" in res && res.ok) {
        setActionSuccess(`Category "${cat.nameEn}" ${res.isActive ? "enabled" : "hidden"}!`);
      }
    });
  };

  const filteredCategories = initialCategories.filter((cat) => {
    const q = searchQuery.toLowerCase();
    return (
      !q ||
      cat.nameEn.toLowerCase().includes(q) ||
      cat.nameAr.toLowerCase().includes(q) ||
      cat.nameFr.toLowerCase().includes(q) ||
      cat.slug.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Alert Banners */}
      {actionError && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-600 dark:text-rose-400 flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="font-bold text-xs opacity-80 hover:opacity-100">✕</button>
        </div>
      )}
      {actionSuccess && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
          <span>{actionSuccess}</span>
          <button onClick={() => setActionSuccess(null)} className="font-bold text-xs opacity-80 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Action Header & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search category, slug, translation..."
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs placeholder:text-[var(--fg-muted)] focus:border-emerald-500 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]"
            >
              ✕
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            resetForm();
            setIsCreateOpen(true);
          }}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 transition"
        >
          ➕ Create Category
        </button>
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCategories.map((cat) => (
          <div
            key={cat.id}
            className={`rounded-2xl border bg-[var(--surface)] p-5 shadow-sm space-y-4 flex flex-col justify-between transition ${
              cat.isActive ? "border-[var(--border)]" : "border-dashed border-[var(--border)] opacity-60"
            }`}
          >
            <div className="space-y-3">
              {/* Card Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-base text-[var(--fg)]">{cat.nameEn}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span dir="rtl" className="font-arabic text-xs text-[var(--fg-muted)]">
                      {cat.nameAr}
                    </span>
                    <span className="text-[10px] text-[var(--fg-muted)]">·</span>
                    <span className="text-xs text-[var(--fg-muted)]">{cat.nameFr}</span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleToggleActive(cat)}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold border transition ${
                    cat.isActive
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      : "bg-zinc-500/10 text-zinc-500 border-zinc-500/20"
                  }`}
                >
                  {cat.isActive ? "Active" : "Hidden"}
                </button>
              </div>

              {/* Slug & Metadata */}
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/50 p-3 space-y-1.5 text-xs font-mono">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[var(--fg-muted)]">Slug:</span>
                  <Link
                    href={`/categories/${cat.slug}`}
                    target="_blank"
                    className="text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    /{cat.slug} ↗
                  </Link>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[var(--fg-muted)]">Products:</span>
                  <span className="font-bold text-[var(--fg)]">{cat.productsCount} products</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[var(--fg-muted)]">Sort Order:</span>
                  <span>{cat.sortOrder}</span>
                </div>
              </div>

              {cat.descriptionEn && (
                <p className="text-xs text-[var(--fg-muted)] line-clamp-2">
                  {cat.descriptionEn}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => openEditModal(cat)}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-semibold hover:border-emerald-500 transition"
              >
                ✏️ Edit
              </button>
              <button
                type="button"
                disabled={cat.productsCount > 0 || isPending}
                onClick={() => handleDelete(cat)}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-500/10 transition disabled:opacity-30"
                title={cat.productsCount > 0 ? "Cannot delete category with linked products" : "Delete category"}
              >
                🗑️ Delete
              </button>
            </div>
          </div>
        ))}

        {filteredCategories.length === 0 && (
          <div className="col-span-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-12 text-center text-sm text-[var(--fg-muted)]">
            No categories found matching this filter.
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {(isCreateOpen || editCat) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <form
            onSubmit={editCat ? handleUpdate : handleCreate}
            className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-base font-bold text-[var(--fg)]">
                {editCat ? `✏️ Edit Category: ${editCat.nameEn}` : "➕ Create New Category"}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsCreateOpen(false);
                  setEditCat(null);
                }}
                className="text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]"
              >
                ✕
              </button>
            </div>

            {/* Localized Names */}
            <div className="space-y-3">
              <div className="text-xs font-bold text-[var(--fg-muted)] uppercase tracking-wider">
                Localized Category Names
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--fg)]">English Name:</label>
                <input
                  type="text"
                  required
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  placeholder="e.g. Streaming Services"
                  className="w-full text-xs rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-2.5 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--fg)]">
                  Arabic Name (العنوان بالعربية):
                </label>
                <input
                  type="text"
                  dir="rtl"
                  required
                  value={nameAr}
                  onChange={(e) => setNameAr(e.target.value)}
                  placeholder="مثال: خدمات البث المباشر"
                  className="w-full text-xs font-arabic rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-2.5 focus:border-emerald-500 focus:outline-none text-right"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--fg)]">French Name (Nom en Français):</label>
                <input
                  type="text"
                  required
                  value={nameFr}
                  onChange={(e) => setNameFr(e.target.value)}
                  placeholder="ex. Services de Streaming"
                  className="w-full text-xs rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-2.5 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Slug and Sort Order */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[var(--border)]">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--fg)]">Custom Slug (Optional):</label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="auto-derived from English"
                  className="w-full text-xs font-mono rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-2.5 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--fg)]">Sort Order (Lower = First):</label>
                <input
                  type="number"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="w-full text-xs font-mono rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-2.5 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Localized Descriptions */}
            <div className="space-y-2 pt-2 border-t border-[var(--border)]">
              <div className="text-xs font-bold text-[var(--fg-muted)] uppercase tracking-wider">
                Descriptions (Optional)
              </div>
              <div className="space-y-1">
                <textarea
                  rows={2}
                  value={descriptionEn}
                  onChange={(e) => setDescriptionEn(e.target.value)}
                  placeholder="English category description..."
                  className="w-full text-xs rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-2.5 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <textarea
                  rows={2}
                  dir="rtl"
                  value={descriptionAr}
                  onChange={(e) => setDescriptionAr(e.target.value)}
                  placeholder="الوصف بالعربية..."
                  className="w-full text-xs font-arabic rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-2.5 focus:border-emerald-500 focus:outline-none text-right"
                />
              </div>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center gap-2 pt-2 border-t border-[var(--border)]">
              <input
                type="checkbox"
                id="cat-is-active"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-[var(--border)] text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="cat-is-active" className="text-xs font-semibold text-[var(--fg)] cursor-pointer">
                Publish Category on Storefront (Active)
              </label>
            </div>

            {/* Footer buttons */}
            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => {
                  setIsCreateOpen(false);
                  setEditCat(null);
                }}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold hover:bg-[var(--surface-2)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending || !nameEn.trim() || !nameAr.trim() || !nameFr.trim()}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50"
              >
                {isPending ? "Saving..." : editCat ? "Update Category" : "Create Category"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

