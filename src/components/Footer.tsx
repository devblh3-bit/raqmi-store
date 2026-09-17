import Link from "next/link";
import type { Locale } from "@/i18n";

export default function Footer({ locale }: { locale: Locale }) {
  const p = `/${locale}`;
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--fg)] text-[10px] font-black text-white">RQ</span>
              <span className="text-sm font-bold">Raqmi</span>
            </div>
            <p className="mt-3 max-w-xs text-sm leading-6 text-[var(--fg-muted)]">
              Premium apps & digital licenses. One-time purchase, no subscription.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold">Explore</p>
            <div className="mt-3 flex flex-col gap-2 text-sm text-[var(--fg-muted)]">
              <Link href={`${p}/products`} className="hover:text-[var(--fg)]">Products</Link>
              <Link href={`${p}/categories`} className="hover:text-[var(--fg)]">Categories</Link>
              <Link href={`${p}/promo`} className="hover:text-[var(--fg)]">Promo</Link>
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold">Support</p>
            <div className="mt-3 flex flex-col gap-2 text-sm text-[var(--fg-muted)]">
              <Link href={`${p}/track-order`} className="hover:text-[var(--fg)]">Track order</Link>
              <a href="https://t.me/Devblh_bot" target="_blank" rel="noreferrer" className="hover:text-[var(--fg)]">Telegram</a>
            </div>
          </div>
        </div>
        <p className="mt-8 border-t border-[var(--border)] pt-6 text-xs text-[var(--fg-faint)]">
          © {new Date().getFullYear()} Raqmi. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
