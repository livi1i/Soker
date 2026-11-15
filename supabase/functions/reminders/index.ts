// Рассылка напоминаний за сутки до записи (Web Push).
// Вызывается планировщиком базы (pg_cron) раз в 10 минут с секретным заголовком.
import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import webpush from "npm:web-push@3.6.7";
import { formatInTimeZone } from "date-fns-tz";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:noreply@example.com",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) {
    return new Response("forbidden", { status: 403 });
  }
  const { data: due } = await db
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, bookings!inner(id, status, starts_at, service_name, access_token, studios!inner(slug, name, address, timezone))")
    .is("sent_at", null)
    .lte("remind_at", new Date().toISOString())
    .limit(200);

  let sent = 0;
  for (const s of due ?? []) {
    const b = (s as any).bookings;
    if (b.status !== "booked" || new Date(b.starts_at) < new Date()) {
      await db.from("push_subscriptions").update({ sent_at: new Date().toISOString(), last_error: "skipped" }).eq("id", s.id);
      continue;
    }
    const when = formatInTimeZone(new Date(b.starts_at), b.studios.timezone, "dd.MM 'в' HH:mm");
    const payload = JSON.stringify({
      title: `${b.studios.name}: запись завтра`,
      body: `${b.service_name}, ${when}. ${b.studios.address}`,
      url: `/s/${b.studios.slug}/my?t=${b.access_token}`,
    });
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600 });
      await db.from("push_subscriptions").update({ sent_at: new Date().toISOString(), last_error: null }).eq("id", s.id);
      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      // 404/410 — подписка больше не существует.
      const final = status === 404 || status === 410;
      await db.from("push_subscriptions").update({
        last_error: String(status ?? e),
        sent_at: final ? new Date().toISOString() : null,
      }).eq("id", s.id);
    }
  }
  return new Response(JSON.stringify({ sent, checked: due?.length ?? 0 }), { headers: { "Content-Type": "application/json" } });
});
