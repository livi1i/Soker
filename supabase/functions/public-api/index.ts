// Публичные действия клиента: свободное время, запись, просмотр и отмена своей записи, напоминание.
// Работает с ключом сервера, который хранится только в Supabase и никогда не попадает в код сайта.
// Клиент видит только свою запись по секретной ссылке; список клиентов студии не отдаётся никогда.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.119.0";
import {
  addDaysToDate,
  daySlots,
  findSlot,
  studioDate,
  type BusyInterval,
  type Calendar,
  type IsoWeekday,
  type StudioRules,
} from "../_shared/schedule.ts";
import {
  availabilityRequestSchema,
  bookRequestSchema,
  fieldErrors,
  pushSubscribeSchema,
  tokenRequestSchema,
} from "../_shared/validation.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const fail = (status: number, code: string, message: string, extra: Record<string, unknown> = {}) =>
  json({ error: { code, message, ...extra } }, status);

const db: SupabaseClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

// Пределы частоты: [число запросов, окно в секундах].
const LIMITS: Record<string, [number, number]> = {
  availability: [90, 60],
  book: [6, 600],
  booking: [60, 60],
  cancel: [10, 600],
  subscribe: [10, 600],
};

async function clientKey(req: Request): Promise<string> {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "unknown";
  const data = new TextEncoder().encode(`${ip}|${Deno.env.get("RATE_SALT") ?? "soker"}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash).slice(0, 12), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function rateLimited(key: string, action: string): Promise<boolean> {
  const [max, windowSec] = LIMITS[action];
  const since = new Date(Date.now() - windowSec * 1000).toISOString();
  const { count } = await db.from("rate_events").select("id", { count: "exact", head: true })
    .eq("key", key).eq("action", action).gte("created_at", since);
  if ((count ?? 0) >= max) return true;
  await db.from("rate_events").insert({ key, action });
  // Изредка чистим старые отметки.
  if (Math.random() < 0.02) await db.from("rate_events").delete().lt("created_at", new Date(Date.now() - 86400_000).toISOString());
  return false;
}

interface StudioCtx {
  studio: Record<string, any>;
  rules: StudioRules & { cancelHours: number };
  cal: Calendar;
  boxIds: string[];
}

async function loadStudio(slug: string): Promise<StudioCtx | null> {
  const { data: studio } = await db.from("studios").select("*").eq("slug", slug).maybeSingle();
  if (!studio) return null;
  const [hours, daysOff, boxes] = await Promise.all([
    db.from("working_hours").select("weekday, opens, closes").eq("studio_id", studio.id),
    db.from("days_off").select("day").eq("studio_id", studio.id),
    db.from("boxes").select("id").eq("studio_id", studio.id).eq("is_active", true).order("sort"),
  ]);
  return {
    studio,
    rules: {
      timezone: studio.timezone,
      slotStepMinutes: studio.slot_step_minutes,
      bufferMinutes: studio.buffer_minutes,
      leadMinutes: studio.lead_minutes,
      horizonDays: studio.horizon_days,
      cancelHours: studio.cancel_hours,
    },
    cal: {
      hours: (hours.data ?? []).map((h) => ({ weekday: h.weekday as IsoWeekday, opens: h.opens.slice(0, 5), closes: h.closes.slice(0, 5) })),
      daysOff: (daysOff.data ?? []).map((d) => d.day),
    },
    boxIds: (boxes.data ?? []).map((b) => b.id),
  };
}

async function loadBusy(studioId: string, from: Date, to: Date): Promise<BusyInterval[]> {
  const { data } = await db.from("bookings").select("box_id, starts_at, block_until")
    .eq("studio_id", studioId).neq("status", "cancelled")
    .lt("starts_at", to.toISOString()).gt("block_until", from.toISOString());
  return (data ?? []).map((b) => ({ boxId: b.box_id, start: new Date(b.starts_at), blockUntil: new Date(b.block_until) }));
}

async function loadService(studioId: string, serviceId: string) {
  const { data } = await db.from("services").select("id, name, price, price_from, duration_minutes, duration_days, is_active")
    .eq("studio_id", studioId).eq("id", serviceId).maybeSingle();
  return data && data.is_active ? data : null;
}

function publicBooking(b: Record<string, any>, ctx: StudioCtx, boxName: string | null) {
  const deadline = new Date(new Date(b.starts_at).getTime() - ctx.rules.cancelHours * 3600_000);
  return {
    id: b.id,
    token: b.access_token,
    status: b.status,
    serviceName: b.service_name,
    price: b.price,
    startsAt: b.starts_at,
    endsAt: b.ends_at,
    boxName,
    clientName: b.client_name,
    clientPhone: b.client_phone,
    car: b.car,
    comment: b.comment,
    canCancel: b.status === "booked" && Date.now() < deadline.getTime(),
    cancelDeadline: deadline.toISOString(),
    cancelHours: ctx.rules.cancelHours,
    studio: {
      slug: ctx.studio.slug,
      name: ctx.studio.name,
      address: ctx.studio.address,
      phone: ctx.studio.phone,
      timezone: ctx.studio.timezone,
      lat: ctx.studio.lat,
      lon: ctx.studio.lon,
    },
  };
}

async function boxName(id: string): Promise<string | null> {
  const { data } = await db.from("boxes").select("name").eq("id", id).maybeSingle();
  return data?.name ?? null;
}

async function bookingByToken(token: string) {
  const { data } = await db.from("bookings").select("*, studios!inner(slug)").eq("access_token", token).maybeSingle();
  return data;
}

// ───────────── Действия ─────────────

async function availability(body: unknown) {
  const p = availabilityRequestSchema.safeParse(body);
  if (!p.success) return fail(400, "bad_request", "Неверный запрос", { fields: fieldErrors(p.error) });
  const ctx = await loadStudio(p.data.slug);
  if (!ctx) return fail(404, "not_found", "Студия не найдена");
  const service = await loadService(ctx.studio.id, p.data.serviceId);
  if (!service) return fail(404, "service_not_found", "Услуга не найдена");

  const now = new Date();
  const today = studioDate(now, ctx.rules.timezone);
  const lastDay = addDaysToDate(today, ctx.rules.horizonDays);
  const dates: string[] = [];
  for (let i = 0; i < p.data.days; i++) {
    const d = addDaysToDate(p.data.from, i);
    if (d >= today && d <= lastDay) dates.push(d);
  }
  // Многодневные работы могут начаться раньше окна, поэтому берём занятость с запасом.
  const from = new Date(`${addDaysToDate(p.data.from, -31)}T00:00:00Z`);
  const to = new Date(`${addDaysToDate(p.data.from, p.data.days + 31)}T00:00:00Z`);
  const busy = await loadBusy(ctx.studio.id, from, to);
  const svc = { durationMinutes: service.duration_minutes, durationDays: service.duration_days };

  const days = dates.map((date) => {
    const day = daySlots({ date, service: svc, rules: ctx.rules, cal: ctx.cal, boxIds: ctx.boxIds, busy, now });
    return {
      date,
      isOpen: day.isOpen,
      slots: day.slots.map((s) => ({ start: s.start.toISOString(), end: s.end.toISOString(), free: s.freeBoxIds.length > 0 })),
    };
  });
  return json({ timezone: ctx.rules.timezone, bookable: ctx.studio.status === "live", days });
}

async function book(body: unknown) {
  const p = bookRequestSchema.safeParse(body);
  if (!p.success) return fail(400, "validation", "Проверьте данные", { fields: fieldErrors(p.error) });
  const ctx = await loadStudio(p.data.slug);
  if (!ctx) return fail(404, "not_found", "Студия не найдена");
  if (ctx.studio.status !== "live") {
    return fail(403, "sample", "Это образец студии: запись откроется после проверки настроек.");
  }

  // Повторное нажатие «Подтвердить»: возвращаем уже созданную запись.
  const { data: existing } = await db.from("bookings").select("*").eq("studio_id", ctx.studio.id)
    .eq("idempotency_key", p.data.idempotencyKey).maybeSingle();
  if (existing) return json({ booking: publicBooking(existing, ctx, await boxName(existing.box_id)), repeated: true });

  const service = await loadService(ctx.studio.id, p.data.serviceId);
  if (!service) return fail(404, "service_not_found", "Услуга не найдена");

  const start = new Date(p.data.start);
  const date = studioDate(start, ctx.rules.timezone);
  const today = studioDate(new Date(), ctx.rules.timezone);
  if (date > addDaysToDate(today, ctx.rules.horizonDays)) return fail(400, "too_far", "Запись открыта только на ближайшие дни");
  const busy = await loadBusy(ctx.studio.id, new Date(start.getTime() - 31 * 86400_000), new Date(start.getTime() + 62 * 86400_000));
  const slot = findSlot({
    date,
    start,
    service: { durationMinutes: service.duration_minutes, durationDays: service.duration_days },
    rules: ctx.rules,
    cal: ctx.cal,
    boxIds: ctx.boxIds,
    busy,
    now: new Date(),
  });
  if (!slot) return fail(409, "slot_invalid", "Это время недоступно. Выберите другое.");
  if (slot.freeBoxIds.length === 0) return fail(409, "slot_taken", "Это время только что заняли. Выберите другое.");

  const c = p.data.client;
  const { data, error } = await db.rpc("create_booking", {
    p_studio: ctx.studio.id,
    p_service: service.id,
    p_box_ids: slot.freeBoxIds,
    p_starts: slot.start.toISOString(),
    p_ends: slot.end.toISOString(),
    p_block: slot.blockUntil.toISOString(),
    p_name: c.name,
    p_phone: c.phone,
    p_car: c.car,
    p_comment: c.comment ?? "",
    p_key: p.data.idempotencyKey,
    p_source: "online",
  });
  if (error) {
    if (error.message.includes("slot_taken")) return fail(409, "slot_taken", "Это время только что заняли. Выберите другое.");
    console.error("create_booking", error);
    return fail(500, "server", "Не получилось создать запись. Попробуйте ещё раз.");
  }
  const row = data as Record<string, any>;
  return json({ booking: publicBooking(row, ctx, await boxName(row.box_id)) }, 201);
}

async function getBooking(body: unknown) {
  const p = tokenRequestSchema.safeParse(body);
  if (!p.success) return fail(400, "bad_request", "Неверная ссылка");
  const b = await bookingByToken(p.data.token);
  if (!b) return fail(404, "not_found", "Запись не найдена");
  const ctx = await loadStudio(b.studios.slug);
  return json({ booking: publicBooking(b, ctx!, await boxName(b.box_id)) });
}

async function cancel(body: unknown) {
  const p = tokenRequestSchema.safeParse(body);
  if (!p.success) return fail(400, "bad_request", "Неверная ссылка");
  const b = await bookingByToken(p.data.token);
  if (!b) return fail(404, "not_found", "Запись не найдена");
  const ctx = (await loadStudio(b.studios.slug))!;
  const view = publicBooking(b, ctx, null);
  if (b.status === "cancelled") return json({ booking: { ...view, boxName: await boxName(b.box_id) } });
  if (!view.canCancel) {
    return fail(409, "too_late", `Отменить онлайн можно не позже чем за ${ctx.rules.cancelHours} ч до начала. Позвоните в студию.`);
  }
  const { data, error } = await db.from("bookings").update({ status: "cancelled", cancelled_by: "client" })
    .eq("id", b.id).eq("status", "booked").select("*").maybeSingle();
  if (error || !data) return fail(409, "conflict", "Статус записи изменился. Обновите страницу.");
  return json({ booking: publicBooking(data, ctx, await boxName(data.box_id)) });
}

async function subscribe(body: unknown) {
  const p = pushSubscribeSchema.safeParse(body);
  if (!p.success) return fail(400, "bad_request", "Неверные данные подписки");
  const b = await bookingByToken(p.data.token);
  if (!b || b.status !== "booked") return fail(404, "not_found", "Запись не найдена");
  const remindAt = new Date(new Date(b.starts_at).getTime() - 24 * 3600_000);
  const { error } = await db.from("push_subscriptions").upsert({
    booking_id: b.id,
    endpoint: p.data.subscription.endpoint,
    p256dh: p.data.subscription.keys.p256dh,
    auth: p.data.subscription.keys.auth,
    remind_at: (remindAt.getTime() < Date.now() ? new Date() : remindAt).toISOString(),
    sent_at: null,
  }, { onConflict: "booking_id,endpoint" });
  if (error) return fail(500, "server", "Не получилось включить напоминание");
  return json({ ok: true, remindAt: remindAt.toISOString() });
}

const handlers: Record<string, (body: unknown) => Promise<Response>> = {
  availability,
  book,
  booking: getBooking,
  cancel,
  subscribe,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail(405, "method", "Только POST");
  let payload: { action?: string; [k: string]: unknown };
  try {
    payload = await req.json();
  } catch {
    return fail(400, "bad_json", "Неверный запрос");
  }
  const action = String(payload.action ?? "");
  const handler = handlers[action];
  if (!handler) return fail(404, "unknown_action", "Неизвестное действие");
  if (await rateLimited(await clientKey(req), action)) {
    return fail(429, "rate_limited", "Слишком много запросов. Подождите немного и попробуйте снова.");
  }
  try {
    return await handler(payload);
  } catch (e) {
    console.error(action, e);
    return fail(500, "server", "Ошибка сервера. Попробуйте ещё раз.");
  }
});
