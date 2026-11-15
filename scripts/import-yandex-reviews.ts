import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { loadEnv } from "./lib/tenants.ts";

loadEnv();
const slug = process.argv[2] || "soker";
const source = process.argv[3] || "https://yandex.ru/maps/org/soker/171311944507/reviews/";
if (slug !== "soker" && !process.argv[3]) throw new Error("Для другой студии укажите URL отзывов");
const response = await fetch(source + (source.includes("?") ? "&" : "?") + "lang=ru_RU");
if (!response.ok) throw new Error(`Яндекс вернул ${response.status}`);
const html = await response.text();
const browser = await chromium.launch();
let reviews;
try {
 const page = await browser.newPage();
 reviews = await page.evaluate(content => {
   const doc = new DOMParser().parseFromString(content, "text/html");
   const nodes = [...doc.querySelectorAll(".business-review-view")];
   return { total: nodes.length, expected: Number(doc.querySelector("[aria-setsize]")?.getAttribute("aria-setsize") || nodes.length), items: nodes.map(node => ({
     author: node.querySelector('[itemprop="author"] [itemprop="name"]')?.textContent?.trim() || "",
     body: node.querySelector(".spoiler-view__text-container")?.textContent?.trim() || node.querySelector('[itemprop="reviewBody"]')?.textContent?.trim() || "",
     date: node.querySelector('[itemprop="datePublished"]')?.getAttribute("content") || "",
     rating: Number(node.querySelector('[itemprop="ratingValue"]')?.getAttribute("content") || 0),
     photos: [...node.querySelectorAll("img.business-review-media__item-img")].map(image => image.getAttribute("src") || ""),
   })).filter(review => review.photos.length) };
 }, html);
} finally { await browser.close(); }
if (!reviews.total || reviews.total < reviews.expected) throw new Error(`Страница неполная: ${reviews.total} из ${reviews.expected}. Импорт остановлен`);
const db = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const studio = await db.from("studios").select("id").eq("slug", slug).single();
if (studio.error) throw studio.error;
const rows = [];
for (const [sort, review] of reviews.items.entries()) {
 if (!review.author || !review.body || !review.date || !review.rating) throw new Error("Неполные данные отзыва");
 const photos = [];
 for (const thumbnail of [...new Set(review.photos)]) {
   const url = new URL(thumbnail);
   if (url.hostname !== "avatars.mds.yandex.net" || !url.pathname.startsWith("/get-altay/")) throw new Error("Непроверенный адрес фотографии");
   const full = thumbnail.replace(/\/S$/, "/XXXL");
   const photo = await fetch(full);
   if (!photo.ok || !photo.headers.get("content-type")?.startsWith("image/")) throw new Error("Фото недоступно: " + full);
   const metadata = await sharp(Buffer.from(await photo.arrayBuffer())).metadata();
   if ((metadata.width || 0) < 300) throw new Error("Слишком маленькое фото: " + full);
   photos.push(full);
 }
 const words = review.body.split(/\s+/);
 rows.push({
   id: createHash("sha256").update(slug + review.author + review.date).digest("hex").slice(0, 24),
   studio_id: studio.data.id, author: review.author,
   excerpt: words.slice(0, 25).join(" ") + (words.length > 25 ? "…" : ""),
   rating: review.rating,
   reviewed_at: new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Moscow" }).format(new Date(review.date)),
   source_url: source, photo_urls: photos, sort, imported_at: new Date().toISOString(),
 });
}
if (!rows.length) throw new Error("Отзывов с фото не найдено; существующие альбомы сохранены");
const result = await db.from("review_albums").upsert(rows);
if (result.error) throw result.error;
console.log(`Проверено отзывов: ${reviews.total}. Альбомов: ${rows.length}. Фото: ${rows.reduce((n,r)=>n+r.photo_urls.length,0)}.`);
for (const row of rows) console.log(`  ${row.author}: ${row.photo_urls.length} фото, ${row.reviewed_at}`);
