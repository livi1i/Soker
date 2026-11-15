// Настройка студий без изменения исходного кода.
//   pnpm tenant:new <название>              — создать папку tenants/<название>/ из образца
//   pnpm tenant:check <название>            — проверить tenant.json и фотографии
//   pnpm tenant:publish <название> [--sync] [--no-deploy]
//                                           — загрузить данные и фото в базу, создать вход владельца, опубликовать сайт.
//                                             Новая студия публикуется как ОБРАЗЕЦ: запись закрыта до проверки.
//   pnpm tenant:verify <название> [--url https://…]
//                                           — проверить готовую ссылку; если всё в порядке, открыть запись.
import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { execSync } from "node:child_process";
import sharp from "sharp";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { bad, loadEnv, ok, readTenant, ROOT, TENANTS_DIR, warn } from "./lib/tenants.ts";
import { weekdayKeys, type Tenant } from "./lib/tenant-schema.ts";

loadEnv();
const [cmd, slug, ...rest] = process.argv.slice(2);
const flag = (name: string) => rest.includes(name);
const option = (name: string) => {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : undefined;
};

function die(msg: string): never {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
}

function admin(): SupabaseClient {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) die("Нужны VITE_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в .env.local (ключ сервера в код сайта не попадает)");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// ───────── new ─────────
function cmdNew() {
  if (!slug || !/^[a-z0-9-]{2,40}$/.test(slug)) die("Укажите название латиницей: pnpm tenant:new my-studio");
  const dir = join(TENANTS_DIR, slug);
  if (existsSync(dir)) die(`Папка ${dir} уже есть`);
  cpSync(join(TENANTS_DIR, "_template"), dir, { recursive: true });
  const file = join(dir, "tenant.json");
  writeFileSync(file, readFileSync(file, "utf8").replace('"slug": "my-studio"', `"slug": "${slug}"`));
  console.log(`✓ Создана папка tenants/${slug}/

Дальше:
  1. Заполните tenants/${slug}/tenant.json (название, адрес, телефон, часы, услуги, почта владельца).
  2. Положите фотографии в tenants/${slug}/photos/ (logo.png, mark.png, hero.jpg и фото работ).
  3. pnpm tenant:check ${slug}
  4. pnpm tenant:publish ${slug}
  5. pnpm tenant:verify ${slug}`);
}

// ───────── check ─────────
async function cmdCheck(quiet = false): Promise<Tenant> {
  if (!slug) die("Укажите студию: pnpm tenant:check <название>");
  console.log(`Проверка tenants/${slug}/`);
  const { tenant, errors, dir } = readTenant(slug);
  for (const e of errors) bad(e);
  if (!tenant || errors.length) die(`Найдено ошибок: ${errors.length}`);
  ok("tenant.json соответствует схеме");

  const hero = await sharp(join(dir, tenant.brand.hero)).metadata();
  if ((hero.width ?? 0) < 1000) warn(`Главное фото узкое (${hero.width}px) — лучше от 1200px`);
  else ok(`Главное фото ${hero.width}×${hero.height}`);
  const icon = await sharp(join(dir, tenant.brand.icon)).metadata();
  if (!icon.hasAlpha) warn("Иконка без прозрачного фона — на иконке приложения будет виден прямоугольник");
  else ok("Иконка с прозрачным фоном");
  const open = weekdayKeys.filter((k) => tenant.hours[k]);
  if (open.length === 0) die("Студия закрыта все дни недели — записаться будет нельзя");
  ok(`Рабочих дней в неделе: ${open.length}`);
  ok(`Услуг: ${tenant.services.length}, боксов: ${tenant.boxes.length}, фото работ: ${tenant.gallery.length}`);
  if (tenant.owner.email.endsWith(".example")) warn(`Почта владельца ${tenant.owner.email} — пример. Укажите настоящую, чтобы владелец мог сменить пароль.`);
  if (!quiet) console.log("\n✓ Настройки в порядке");
  return tenant;
}

// ───────── publish ─────────
async function uploadPhoto(db: SupabaseClient, studioId: string, dir: string, rel: string, kind: string): Promise<string> {
  const src = join(dir, rel);
  const isPng = rel.endsWith(".png");
  const img = sharp(src).rotate().resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true });
  const buf = isPng ? await img.png().toBuffer() : await img.webp({ quality: 84 }).toBuffer();
  const path = `${studioId}/${kind}/${randomUUID()}.${isPng ? "png" : "webp"}`;
  const { error } = await db.storage.from("media").upload(path, buf, { contentType: isPng ? "image/png" : "image/webp", cacheControl: "31536000" });
  if (error) die(`Загрузка ${rel}: ${error.message}`);
  return path;
}

async function cmdPublish() {
  const t = await cmdCheck(true);
  const { dir } = readTenant(slug);
  const db = admin();
  console.log("\nПубликация данных");

  const { data: existing } = await db.from("studios").select("id, status").eq("slug", slug).maybeSingle();
  const sync = !existing || flag("--sync");
  let studioId = existing?.id as string | undefined;

  const studioRow = {
    slug,
    name: t.name,
    tagline: t.tagline,
    description: t.description,
    timezone: t.timezone,
    address: t.address.text,
    city: t.address.city,
    lat: t.address.lat,
    lon: t.address.lon,
    phone: t.phone,
    socials: t.socials,
    rating: t.rating,
    theme_color: t.brand.themeColor,
    accent: t.brand.accent,
    hero_position: t.brand.heroPosition,
    info_cards: t.infoCards,
    slot_step_minutes: t.booking.slotStepMinutes,
    buffer_minutes: t.booking.bufferMinutes,
    lead_minutes: t.booking.leadMinutes,
    horizon_days: t.booking.horizonDays,
    cancel_hours: t.booking.cancelHoursBefore,
  };

  if (!existing) {
    const { data, error } = await db.from("studios").insert({ ...studioRow, status: "draft" }).select("id").single();
    if (error) die(`Студия: ${error.message}`);
    studioId = data.id;
    ok(`Студия создана как образец (запись закрыта до pnpm tenant:verify ${slug})`);
  } else if (sync) {
    const { error } = await db.from("studios").update(studioRow).eq("id", studioId!);
    if (error) die(`Студия: ${error.message}`);
    ok("Данные студии обновлены из tenant.json");
  } else {
    warn("Студия уже есть — данные из tenant.json не перезаписаны (владелец мог их изменить). Добавьте --sync, чтобы перезаписать.");
  }

  if (sync) {
    const id = studioId!;
    // Фото
    const logo = await uploadPhoto(db, id, dir, t.brand.logo, "logo");
    const hero = await uploadPhoto(db, id, dir, t.brand.hero, "hero");
    await db.from("studios").update({ logo_path: logo, hero_path: hero }).eq("id", id);
    ok("Логотип и главное фото загружены");

    // Боксы: по названию, существующие не удаляем (на них могут быть записи)
    const { data: boxes } = await db.from("boxes").select("id, name").eq("studio_id", id);
    for (const [i, name] of t.boxes.entries()) {
      const found = boxes?.find((b) => b.name === name);
      if (found) await db.from("boxes").update({ sort: i, is_active: true }).eq("id", found.id);
      else await db.from("boxes").insert({ studio_id: id, name, sort: i });
    }
    ok(`Боксов: ${t.boxes.length}`);

    // Услуги: по названию
    const { data: services } = await db.from("services").select("id, name").eq("studio_id", id);
    for (const [i, s] of t.services.entries()) {
      const row = {
        studio_id: id, category: s.category, name: s.name, description: s.description, price: s.price, price_from: s.priceFrom,
        duration_minutes: s.durationMinutes, duration_days: s.durationDays, is_active: true, sort: i,
      };
      const found = services?.find((x) => x.name === s.name);
      const { error } = found ? await db.from("services").update(row).eq("id", found.id) : await db.from("services").insert(row);
      if (error) die(`Услуга «${s.name}»: ${error.message}`);
    }
    ok(`Услуг: ${t.services.length}`);

    // Часы и выходные
    await db.from("working_hours").delete().eq("studio_id", id);
    const hours = weekdayKeys.flatMap((k, i) => (t.hours[k] ? [{ studio_id: id, weekday: i + 1, opens: t.hours[k]!.opens, closes: t.hours[k]!.closes }] : []));
    const { error: hErr } = await db.from("working_hours").insert(hours);
    if (hErr) die(`Часы работы: ${hErr.message}`);
    await db.from("days_off").delete().eq("studio_id", id);
    if (t.daysOff.length) await db.from("days_off").insert(t.daysOff.map((day) => ({ studio_id: id, day })));
    ok(`Часы работы: ${hours.length} дн. в неделю, выходных дат: ${t.daysOff.length}`);

    // Фото работ
    const { data: oldGallery } = await db.from("gallery_items").select("id, image_path").eq("studio_id", id);
    if (oldGallery?.length) {
      await db.from("gallery_items").delete().eq("studio_id", id);
      await db.storage.from("media").remove(oldGallery.map((g) => g.image_path));
    }
    for (const [i, g] of t.gallery.entries()) {
      const path = await uploadPhoto(db, id, dir, g.photo, "gallery");
      await db.from("gallery_items").insert({ studio_id: id, image_path: path, caption: g.caption, sort: i });
    }
    ok(`Фото работ: ${t.gallery.length}`);
  }

  // Владелец
  const email = t.owner.email.toLowerCase();
  let userId: string | undefined;
  for (let page = 1; page < 50 && !userId; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) die(`Пользователи: ${error.message}`);
    userId = data.users.find((u) => u.email?.toLowerCase() === email)?.id;
    if (data.users.length < 200) break;
  }
  let password: string | null = null;
  if (!userId) {
    password = randomBytes(9).toString("base64url");
    const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) die(`Владелец: ${error.message}`);
    userId = data.user.id;
  }
  await db.from("studio_members").upsert({ studio_id: studioId!, user_id: userId, role: "owner" });
  ok(`Владелец: ${email}`);

  if (!flag("--no-deploy")) {
    console.log("\nПубликация сайта (Vercel)");
    execSync("vercel deploy --prod --yes", { stdio: "inherit", cwd: ROOT });
  }

  console.log(`\n✓ Готово. Студия опубликована как образец: /s/${slug}/`);
  if (password) console.log(`\n  Вход в кабинет: /s/${slug}/admin\n  Почта: ${email}\n  Пароль: ${password}\n  (сохраните пароль — он показывается один раз)`);
  console.log(`\nДальше: pnpm tenant:verify ${slug}`);
}

// ───────── verify ─────────
async function cmdVerify() {
  const t = await cmdCheck(true);
  const site = (option("--url") ?? process.env.SITE_URL ?? "").replace(/\/$/, "");
  if (!site) die("Укажите адрес сайта: --url https://… или SITE_URL в .env.local");
  const base = `${site}/s/${slug}/`;
  console.log(`\nПроверка ${base}`);
  let failed = 0;
  const check = async (name: string, fn: () => Promise<string | true>) => {
    try {
      const r = await fn();
      if (r === true) ok(name);
      else { bad(`${name}: ${r}`); failed++; }
    } catch (e) {
      bad(`${name}: ${(e as Error).message}`);
      failed++;
    }
  };

  await check("Страница студии открывается", async () => {
    const r = await fetch(base);
    if (!r.ok) return `HTTP ${r.status}`;
    const html = await r.text();
    if (!html.includes(`/s/${slug}/manifest.webmanifest`)) return "в странице нет ссылки на manifest студии";
    if (!html.includes(t.name)) return "в заголовке нет названия студии";
    return true;
  });
  await check("Глубокая ссылка /book открывается", async () => ((await fetch(`${base}book`)).ok ? true : "не 200"));
  let manifest: any = null;
  await check("Manifest для установки на телефон", async () => {
    const r = await fetch(`${base}manifest.webmanifest`);
    if (!r.ok) return `HTTP ${r.status}`;
    manifest = await r.json();
    if (manifest.start_url !== `/s/${slug}/` || manifest.scope !== `/s/${slug}/`) return "неверные start_url/scope";
    if (manifest.display !== "standalone") return "display должен быть standalone";
    return true;
  });
  await check("Иконки приложения", async () => {
    for (const i of manifest?.icons ?? []) {
      const r = await fetch(new URL(i.src, site));
      if (!r.ok || !(r.headers.get("content-type") ?? "").includes("image")) return `${i.src} не открывается`;
    }
    return (manifest?.icons?.length ?? 0) >= 2 ? true : "иконок меньше двух";
  });
  await check("Service worker (работа без сети)", async () => ((await fetch(`${site}/sw.js`)).ok ? true : "нет /sw.js"));

  const url = process.env.VITE_SUPABASE_URL!;
  const anon = process.env.VITE_SUPABASE_ANON_KEY!;
  let serviceId: string | null = null;
  await check("Данные студии в базе", async () => {
    const r = await fetch(`${url}/rest/v1/studios?slug=eq.${slug}&select=id,name`, { headers: { apikey: anon } });
    const rows = await r.json();
    if (!rows[0]) return "студия не найдена — сначала pnpm tenant:publish";
    const s = await fetch(`${url}/rest/v1/services?studio_id=eq.${rows[0].id}&is_active=eq.true&duration_days=eq.0&select=id&limit=1`, { headers: { apikey: anon } });
    serviceId = (await s.json())[0]?.id ?? null;
    return serviceId ? true : "нет активных услуг";
  });
  await check("Свободное время считается", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const r = await fetch(`${url}/functions/v1/public-api`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anon },
      body: JSON.stringify({ action: "availability", slug, serviceId, from: today, days: 7 }),
    });
    if (!r.ok) return `HTTP ${r.status}: ${await r.text()}`;
    const d = await r.json();
    return d.days?.some((x: any) => x.slots.length > 0) ? true : "на неделю вперёд нет ни одного времени — проверьте часы работы";
  });
  await check("Записи клиентов закрыты от посторонних", async () => {
    const r = await fetch(`${url}/rest/v1/bookings?select=id&limit=1`, { headers: { apikey: anon } });
    const body = await r.json().catch(() => null);
    return !r.ok || (Array.isArray(body) && body.length === 0) ? true : "анонимный запрос вернул записи!";
  });

  if (failed) die(`Проверок не пройдено: ${failed}. Студия остаётся образцом.`);
  const db = admin();
  const { error } = await db.from("studios").update({ status: "live" }).eq("slug", slug);
  if (error) die(`Не получилось открыть запись: ${error.message}`);
  console.log(`\n✓ Все проверки пройдены. Запись открыта: ${base}`);
}

switch (cmd) {
  case "new": cmdNew(); break;
  case "check": await cmdCheck(); break;
  case "publish": await cmdPublish(); break;
  case "verify": await cmdVerify(); break;
  default:
    console.log("Команды: new | check | publish | verify. Например: pnpm tenant:check soker");
    process.exit(1);
}
