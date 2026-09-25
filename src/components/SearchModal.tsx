"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { Locale } from "@/i18n";
import { PriceCompact } from "@/components/Price";
import { ProductArt } from "@/lib/product-images";
import type { SearchProductResult } from "@/app/api/search/route";

function SearchIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx={11} cy={11} r={8} />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

const POPULAR_SEARCHES = [
  "ChatGPT Plus",
  "Canva Pro",
  "YouTube Premium",
  "Netflix",
  "Windows 11",
  "NordVPN",
];

export function SearchModal({
  isOpen,
  onClose,
  locale,
}: {
  isOpen: boolean;
  onClose: () => void;
  locale: Locale;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchProductResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Fetch results (debounced)
  const fetchResults = useCallback(async (q: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&locale=${locale}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      }
    } catch (e) {
      console.error("Search fetch failed", e);
    } finally {
      setIsLoading(false);
    }
  }, [locale]);

  const handleClose = useCallback(() => {
    setQuery("");
    setSelectedIndex(-1);
    onClose();
  }, [onClose]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle query typing with debounce
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      fetchResults(query);
    }, 150);
    return () => clearTimeout(timer);
  }, [query, isOpen, fetchResults]);

  // Handle keyboard events (Escape, ArrowUp, ArrowDown, Enter)
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (selectedIndex >= 0 && results[selectedIndex]) {
          router.push(`/${locale}/products/${results[selectedIndex].slug}`);
          handleClose();
        } else if (query.trim()) {
          router.push(`/${locale}/products?q=${encodeURIComponent(query.trim())}`);
          handleClose();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, results, selectedIndex, query, locale, router, handleClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search Catalog"
      className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6 sm:pt-20"
    >
      {/* Backdrop */}
      <div
        onClick={handleClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in"
      />

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--elev-3)] transition-all animate-in fade-in zoom-in-95 duration-200">
        {/* Search Header Input */}
        <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3 sm:px-5">
          <SearchIcon className="h-5 w-5 text-[var(--fg-muted)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(-1);
            }}
            placeholder={
              locale === "ar"
                ? "ابحث عن حسابات، اشتراكات، برامج..."
                : locale === "fr"
                ? "Rechercher des produits, abonnements..."
                : "Search products, licenses, subscriptions..."
            }
            className="flex-1 bg-transparent text-sm sm:text-base font-semibold text-[var(--fg)] outline-none placeholder:text-[var(--fg-faint)]"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setSelectedIndex(-1);
                inputRef.current?.focus();
              }}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--surface-2)] text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-mono text-[var(--fg-muted)] hover:bg-[var(--surface-3)]"
          >
            ESC
          </button>
        </div>

        {/* Content Body */}
        <div className="max-h-[60vh] overflow-y-auto p-2 sm:p-3">
          {/* Popular Search Pills when query is empty */}
          {!query && (
            <div className="p-2 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--fg-faint)]">
                {locale === "ar" ? "عمليات بحث شائعة" : "Popular Searches"}
              </span>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {POPULAR_SEARCHES.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => {
                      setQuery(term);
                      inputRef.current?.focus();
                    }}
                    className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-semibold text-[var(--fg-muted)] transition hover:border-[var(--accent)] hover:text-[var(--fg)] active:scale-95"
                  >
                    🔍 {term}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Results List */}
          <div className="space-y-1">
            <div className="px-2 pt-2 pb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--fg-faint)]">
                {query
                  ? locale === "ar"
                    ? `النتائج المطابقة (${results.length})`
                    : `Matching Products (${results.length})`
                  : locale === "ar"
                  ? "منتجات مميزة"
                  : "Trending Products"}
              </span>
            </div>

            {isLoading && results.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--fg-muted)]">
                Loading products...
              </div>
            ) : results.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <p className="text-sm font-semibold text-[var(--fg)]">
                  {locale === "ar" ? `لم يتم العثور على “${query}”` : `No products found for “${query}”`}
                </p>
                <p className="text-xs text-[var(--fg-muted)]">
                  {locale === "ar"
                    ? "جرّب كتابة اسم البرنامج أو الخدمة بكلمات أخرى"
                    : "Try searching with different keywords or browse our full catalog."}
                </p>
                <Link
                  href={`/${locale}/products`}
                  onClick={onClose}
                  className="inline-block mt-2 rounded-full bg-[var(--accent)] px-4 py-1.5 text-xs font-bold text-white shadow-xs"
                >
                  Browse all products
                </Link>
              </div>
            ) : (
              results.map((item, idx) => {
                const isSelected = selectedIndex === idx;
                return (
                  <Link
                    key={item.slug}
                    href={`/${locale}/products/${item.slug}`}
                    onClick={onClose}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`flex items-center justify-between gap-3 rounded-2xl p-2.5 transition-all duration-150 ${
                      isSelected
                        ? "bg-[var(--accent)] text-white shadow-sm"
                        : "hover:bg-[var(--surface-2)] text-[var(--fg)]"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="shrink-0">
                        {item.image && (item.image.startsWith("http://") || item.image.startsWith("https://") || item.image.startsWith("/")) ? (
                          <div className="relative h-10 w-10 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-2)]">
                            <Image
                              src={item.image}
                              alt={item.name}
                              fill
                              sizes="40px"
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="rounded-xl overflow-hidden ring-1 ring-black/[0.04] dark:ring-white/10">
                            <ProductArt id={item.image || item.slug} size={40} />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold truncate ${isSelected ? "text-white" : "text-[var(--fg)]"}`}>
                            {item.name}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                              isSelected
                                ? "bg-white/20 text-white"
                                : "bg-[var(--surface-2)] text-[var(--fg-muted)]"
                            }`}
                          >
                            {item.category}
                          </span>
                        </div>
                        <span className={`text-xs ${isSelected ? "text-white/80" : "text-[var(--fg-muted)]"}`}>
                          {item.offersCount} variant{item.offersCount > 1 ? "s" : ""} available
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs font-bold ${isSelected ? "text-white" : "text-[var(--accent)]"}`}>
                        from <PriceCompact cents={item.minPrice} locale={locale} />
                      </span>
                      <span className={`text-xs ${isSelected ? "text-white" : "text-[var(--fg-muted)]"}`}>
                        →
                      </span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* Modal Footer */}
        {query && results.length > 0 && (
          <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--surface-2)]/60 px-4 py-2.5 text-xs text-[var(--fg-muted)]">
            <span className="hidden sm:inline">
              Press <kbd className="font-mono font-bold text-[var(--fg)]">↵ Enter</kbd> to view in full page
            </span>
            <Link
              href={`/${locale}/products?q=${encodeURIComponent(query)}`}
              onClick={onClose}
              className="font-bold text-[var(--accent)] hover:underline ml-auto"
            >
              See all results in Products ↗
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

