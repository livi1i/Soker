import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";
import { readFileSync } from "node:fs";

const siteBase = process.env.SITE_BASE_PATH || "/";

/** В разработке подставляет в index.html данные студии по умолчанию. Для сборки это делает scripts/build-tenants.ts. */
function devTenantHtml() {
  return {
    name: "dev-tenant-html",
    apply: "serve" as const,
    transformIndexHtml(html: string) {
      const slug = process.env.VITE_DEFAULT_TENANT || "soker";
      const t = JSON.parse(readFileSync(`tenants/${slug}/tenant.json`, "utf8"));
      return html
        .replaceAll("%TENANT_TITLE%", `${t.name} — ${t.tagline}`)
        .replaceAll("%TENANT_DESCRIPTION%", t.description)
        .replaceAll("%TENANT_THEME%", t.brand.themeColor)
        .replaceAll("%TENANT_NAME%", t.name)
        .replaceAll("%TENANT_BASE%", `${siteBase}s/${slug}/`);
    },
  };
}

export default defineConfig({
  base: siteBase,
  resolve: {
    alias: { "@shared": fileURLToPath(new URL("./supabase/functions/_shared", import.meta.url)) },
  },
  plugins: [
    react(),
    devTenantHtml(),
    VitePWA({
      // У каждой студии свой manifest (/s/<название>/manifest.webmanifest) — его создаёт scripts/build-tenants.ts.
      manifest: false,
      registerType: "autoUpdate",
      injectRegister: false,
      workbox: {
        globPatterns: ["**/*.{js,css,woff2,svg}"],
        importScripts: [`${siteBase}push-sw.js`],
        navigateFallback: null,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Страницы студий: свежая версия из сети, без сети — сохранённая.
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: { cacheName: "pages", networkTimeoutSeconds: 4, expiration: { maxEntries: 30 } },
          },
          {
            // Услуги, цены, часы работы: без сети показываем последние сохранённые.
            urlPattern: ({ url, request }) => url.pathname.startsWith("/rest/v1/") && request.method === "GET",
            handler: "NetworkFirst",
            options: { cacheName: "studio-data", networkTimeoutSeconds: 4, expiration: { maxEntries: 80, maxAgeSeconds: 7 * 86400 } },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/storage/v1/object/public/"),
            handler: "CacheFirst",
            options: { cacheName: "photos", expiration: { maxEntries: 120, maxAgeSeconds: 30 * 86400 }, cacheableResponse: { statuses: [0, 200] } },
          },
          {
            urlPattern: ({ url }) => /\/s\/[a-z0-9-]+\/(icon|apple|og|manifest)/.test(url.pathname),
            handler: "StaleWhileRevalidate",
            options: { cacheName: "tenant-assets", expiration: { maxEntries: 60 } },
          },
        ],
      },
    }),
  ],
  build: { target: "es2022", chunkSizeWarningLimit: 1500 },
  server: { port: 5173 },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
  },
} as any);
