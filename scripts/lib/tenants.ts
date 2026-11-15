import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tenantSchema, type Tenant } from "./tenant-schema.ts";

export const ROOT = process.cwd();
export const TENANTS_DIR = join(ROOT, "tenants");

export function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    if (existsSync(join(ROOT, f))) {
      try {
        process.loadEnvFile(join(ROOT, f));
      } catch {
        /* уже загружено */
      }
    }
  }
}

export function tenantSlugs(): string[] {
  if (!existsSync(TENANTS_DIR)) return [];
  return readdirSync(TENANTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_") && existsSync(join(TENANTS_DIR, d.name, "tenant.json")))
    .map((d) => d.name);
}

export function readTenant(slug: string): { tenant?: Tenant; errors: string[]; dir: string } {
  const dir = join(TENANTS_DIR, slug);
  const file = join(dir, "tenant.json");
  if (!existsSync(file)) return { errors: [`Нет файла ${file}`], dir };
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    return { errors: [`tenant.json — неверный JSON: ${(e as Error).message}`], dir };
  }
  const r = tenantSchema.safeParse(raw);
  if (!r.success) {
    return { errors: r.error.issues.map((i) => `${i.path.join(".") || "(файл)"}: ${i.message}`), dir };
  }
  const errors: string[] = [];
  if (r.data.slug !== slug) errors.push(`slug в файле («${r.data.slug}») должен совпадать с названием папки («${slug}»)`);
  const photos = [r.data.brand.logo, r.data.brand.icon, r.data.brand.hero, ...r.data.gallery.map((g) => g.photo)];
  for (const p of photos) if (!existsSync(join(dir, p))) errors.push(`Нет файла ${p}`);
  return { tenant: r.data, errors, dir };
}

export const ok = (s: string) => console.log(`  ✓ ${s}`);
export const bad = (s: string) => console.log(`  ✗ ${s}`);
export const warn = (s: string) => console.log(`  ! ${s}`);
