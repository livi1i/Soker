import { useQuery } from "@tanstack/react-query";
import { addDays, formatISO, startOfWeek } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { computeEnd, daySlots, type Calendar, type IsoWeekday } from "@shared/schedule";
import { supabase } from "../lib/supabase";
import type { OwnerBooking, Payment, Service, StudioBundle } from "../lib/types";

export const BOOKING_COLUMNS =
  "id, studio_id, service_id, box_id, service_name, price, client_name, client_phone, car, comment, starts_at, ends_at, block_until, status, source, created_at";

export function calendarOf(bundle: StudioBundle): Calendar {
  return {
    hours: bundle.hours.map((h) => ({ weekday: h.weekday as IsoWeekday, opens: h.opens, closes: h.closes })),
    daysOff: bundle.daysOff.map((d) => d.day),
  };
}

export function rulesOf(bundle: StudioBundle) {
  const s = bundle.studio;
  return { timezone: s.timezone, slotStepMinutes: s.slot_step_minutes, bufferMinutes: s.buffer_minutes, leadMinutes: 0, horizonDays: 365 };
}

/** Границы дня или недели (с понедельника) по времени студии, в UTC. */
export function periodRange(date: string, period: "day" | "week", tz: string) {
  const start = period === "day" ? date : formatISO(startOfWeek(new Date(`${date}T12:00:00`), { weekStartsOn: 1 }), { representation: "date" });
  const end = formatISO(addDays(new Date(`${start}T12:00:00`), period === "day" ? 1 : 7), { representation: "date" });
  return { startDate: start, endDate: end, from: fromZonedTime(`${start}T00:00:00`, tz), to: fromZonedTime(`${end}T00:00:00`, tz) };
}

export function todayIn(tz: string) {
  return formatISO(toZonedTime(new Date(), tz), { representation: "date" });
}

export function useOwnerBookings(studioId: string, from: Date, to: Date) {
  return useQuery({
    queryKey: ["owner-bookings", studioId, from.toISOString(), to.toISOString()],
    queryFn: async () => {
      // Многодневные работы, начатые раньше периода, тоже показываем.
      const { data, error } = await supabase.from("bookings").select(BOOKING_COLUMNS).eq("studio_id", studioId)
        .lt("starts_at", to.toISOString()).gt("ends_at", from.toISOString()).order("starts_at");
      if (error) throw error;
      return data as OwnerBooking[];
    },
    refetchInterval: 30_000,
  });
}

export function usePayments(studioId: string, bookingIds: string[]) {
  return useQuery({
    queryKey: ["owner-payments", studioId, bookingIds.join(",")],
    enabled: bookingIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("payments").select("id, booking_id, kind, amount, method, note, created_at")
        .eq("studio_id", studioId).in("booking_id", bookingIds).order("created_at");
      if (error) throw error;
      return data as Payment[];
    },
  });
}

export function useStats(studioId: string, from: Date, to: Date) {
  return useQuery({
    queryKey: ["owner-stats", studioId, from.toISOString(), to.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("owner_stats", { p_studio: studioId, p_from: from.toISOString(), p_to: to.toISOString() });
      if (error) throw error;
      const r = (Array.isArray(data) ? data[0] : data) as { visits: number; completed: number; cancelled: number; received: number; refunded: number };
      return r;
    },
    refetchInterval: 30_000,
  });
}

/** Варианты времени для ручной записи и переноса — тот же расчёт, что и для клиентов. */
export async function ownerSlots(bundle: StudioBundle, service: Service, date: string, excludeBookingId?: string) {
  const tz = bundle.studio.timezone;
  const from = fromZonedTime(`${date}T00:00:00`, tz);
  const { data, error } = await supabase.from("bookings").select("id, box_id, starts_at, block_until").eq("studio_id", bundle.studio.id)
    .neq("status", "cancelled").lt("starts_at", new Date(from.getTime() + 40 * 86400_000).toISOString())
    .gt("block_until", new Date(from.getTime() - 31 * 86400_000).toISOString());
  if (error) throw error;
  const busy = (data ?? []).filter((b) => b.id !== excludeBookingId)
    .map((b) => ({ boxId: b.box_id, start: new Date(b.starts_at), blockUntil: new Date(b.block_until) }));
  const boxIds = bundle.boxes.filter((b) => b.is_active).map((b) => b.id);
  return daySlots({
    date,
    service: { durationMinutes: service.duration_minutes, durationDays: service.duration_days },
    rules: rulesOf(bundle),
    cal: calendarOf(bundle),
    boxIds,
    busy,
    now: new Date(),
  });
}

export function endFor(bundle: StudioBundle, service: Service, start: Date) {
  const end = computeEnd(start, { durationMinutes: service.duration_minutes, durationDays: service.duration_days }, calendarOf(bundle), bundle.studio.timezone);
  return { end, blockUntil: new Date(end.getTime() + bundle.studio.buffer_minutes * 60_000) };
}

/** Понятный текст ошибки базы для владельца. */
export function dbMessage(e: unknown): string {
  const err = e as { code?: string; message?: string };
  if (err?.code === "23P01") return "Это время в выбранном боксе уже занято. Выберите другое время или бокс.";
  if (err?.code === "42501") return "Недостаточно прав для этого действия.";
  if (err?.code === "23514") return "Проверьте значения: одно из полей заполнено неверно.";
  return err?.message ?? "Не получилось сохранить";
}

// ───── Фото ─────

/** Уменьшаем фото в браузере до 1920 px и сохраняем в WebP — быстрее загрузка у клиентов. */
export async function prepareImage(file: File, max = 1920): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Нужен файл изображения");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const isPng = file.type === "image/png";
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, isPng ? "image/png" : "image/webp", 0.86));
  if (!blob) throw new Error("Не получилось обработать фото");
  return blob;
}

export async function uploadImage(studioId: string, folder: string, file: File): Promise<string> {
  const blob = await prepareImage(file, folder === "logo" ? 800 : 1920);
  const ext = blob.type === "image/png" ? "png" : "webp";
  const path = `${studioId}/${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("media").upload(path, blob, { contentType: blob.type, cacheControl: "31536000", upsert: false });
  if (error) throw error;
  return path;
}

/** Старый файл удаляем только из папки этой студии. */
export async function removeImage(studioId: string, path: string | null | undefined) {
  if (path && path.startsWith(`${studioId}/`)) await supabase.storage.from("media").remove([path]);
}
