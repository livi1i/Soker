// Для каждой студии из tenants/ готовит адрес /s/<название>/ с собственной иконкой и настройками установки.
//   tsx scripts/build-tenants.ts assets  — иконки, manifest и картинка для соцсетей в public/s/<название>/
//   tsx scripts/build-tenants.ts html    — после vite build: dist/s/<название>/index.html со своим заголовком и manifest
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { loadEnv, readTenant, tenantSlugs, ROOT } from "./lib/tenants.ts";
import type { Tenant } from "./lib/tenant-schema.ts";

loadEnv();
const siteBase = process.env.SITE_BASE_PATH || "/";
const mode = process.argv[2] ?? "assets";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

async function icon(t: Tenant, dir: string, size: number, out: string, padding: number) {
  const inner = Math.round(size * (1 - padding * 2));
  const mark = await sharp(join(dir, t.brand.icon)).resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: t.brand.themeColor } })
    .composite([{ input: mark, gravity: "center" }])
    .png()
    .toFile(out);
}

async function assets(slug: string) {
  const { tenant: t, errors, dir } = readTenant(slug);
  if (!t || errors.length) throw new Error(`Студия ${slug}: ${errors.join("; ")}`);
  const out = join(ROOT, "public", "s", slug);
  mkdirSync(out, { recursive: true });
  await icon(t, dir, 192, join(out, "icon-192.png"), 0.16);
  await icon(t, dir, 512, join(out, "icon-512.png"), 0.16);
  await icon(t, dir, 512, join(out, "icon-maskable-512.png"), 0.26); // безопасная зона для круглых иконок Android
  await icon(t, dir, 180, join(out, "apple-touch-icon.png"), 0.16);
  await sharp(join(dir, t.brand.hero)).resize(1200, 630, { fit: "cover", position: "attention" }).jpeg({ quality: 80 }).toFile(join(out, "og.jpg"));

  const base = `${siteBase}s/${slug}/`;
  const manifest = {
    id: base,
    name: `${t.name} — ${t.tagline}`,
    short_name: t.name,
    description: t.description,
    lang: "ru",
    dir: "ltr",
    start_url: base,
    scope: base,
    display: "standalone",
    orientation: "portrait",
    background_color: t.brand.themeColor,
    theme_color: t.brand.themeColor,
    categories: ["lifestyle", "business"],
    icons: [
      { src: `${base}icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${base}icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `${base}icon-maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Записаться", url: `${base}book`, icons: [{ src: `${base}icon-192.png`, sizes: "192x192" }] },
      { name: "Моя запись", url: `${base}my`, icons: [{ src: `${base}icon-192.png`, sizes: "192x192" }] },
    ],
  };
  writeFileSync(join(out, "manifest.webmanifest"), JSON.stringify(manifest, null, 2));
  console.log(`✓ ${slug}: иконки и manifest в public/s/${slug}/`);
}

function html(slug: string, template: string) {
  const { tenant: t } = readTenant(slug);
  if (!t) throw new Error(`Студия ${slug} не прошла проверку`);
  const page = template
    .replaceAll("%TENANT_TITLE%", esc(`${t.name} — ${t.tagline}`))
    .replaceAll("%TENANT_DESCRIPTION%", esc(t.description))
    .replaceAll("%TENANT_THEME%", t.brand.themeColor)
    .replaceAll("%TENANT_NAME%", esc(t.name))
    .replaceAll("%TENANT_BASE%", `${siteBase}s/${slug}/`);
  const out = join(ROOT, "dist", "s", slug);
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "index.html"), page);
  for (const route of ["services", "book", "my", "admin", "admin/settings"]) {
    const routeDir = join(out, route);
    mkdirSync(routeDir, { recursive: true });
    writeFileSync(join(routeDir, "index.html"), page);
  }
  return page;
}

const slugs = tenantSlugs();
if (slugs.length === 0) throw new Error("В папке tenants/ нет ни одной студии");

if (mode === "assets") {
  for (const s of slugs) await assets(s);
} else if (mode === "html") {
  const indexPath = join(ROOT, "dist", "index.html");
  if (!existsSync(indexPath)) throw new Error("Сначала vite build");
  const template = readFileSync(indexPath, "utf8");
  const def = process.env.VITE_DEFAULT_TENANT && slugs.includes(process.env.VITE_DEFAULT_TENANT) ? process.env.VITE_DEFAULT_TENANT : slugs[0];
  for (const s of slugs) html(s, template);
  // Корень сайта открывает студию по умолчанию.
  writeFileSync(indexPath, html(def, template));
  console.log(`✓ Страницы: ${slugs.map((s) => `/s/${s}/`).join(", ")}`);
} else {
  throw new Error(`Неизвестный режим ${mode}`);
}
