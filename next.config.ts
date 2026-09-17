import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n.ts");

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/:locale/aplikasi", destination: "/:locale/products" },
      { source: "/:locale/aplikasi/:slug", destination: "/:locale/products/:slug" },
      { source: "/:locale/kategori", destination: "/:locale/categories" },
      { source: "/:locale/kategori/:slug", destination: "/:locale/categories/:slug" },
      { source: "/:locale/cek-pesanan", destination: "/:locale/track-order" },
      { source: "/:locale/keranjang", destination: "/:locale/cart" },
    ];
  },
};

export default withNextIntl(nextConfig);
