import { ru } from "date-fns/locale";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { isSameDay } from "date-fns";

export const rub = (n: number) => `${new Intl.NumberFormat("ru-RU").format(n)} ₽`;

export const priceLabel = (price: number, from: boolean) => (from ? `от ${rub(price)}` : rub(price));

export function durationLabel(minutes: number, days: number): string {
  if (days > 0) return days === 1 ? "1 день" : days < 5 ? `${days} дня` : `${days} дней`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h} ч ${m} мин`;
  if (h) return `${h} ч`;
  return `${m} мин`;
}

export const fmt = (iso: string | Date, tz: string, pattern: string) =>
  formatInTimeZone(typeof iso === "string" ? new Date(iso) : iso, tz, pattern, { locale: ru });

export const timeLabel = (iso: string, tz: string) => fmt(iso, tz, "HH:mm");

/** «Сегодня», «Завтра» или «пн, 16 ноября». */
export function dayLabel(iso: string | Date, tz: string): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const now = toZonedTime(new Date(), tz);
  const z = toZonedTime(d, tz);
  if (isSameDay(z, now)) return "Сегодня";
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (isSameDay(z, tomorrow)) return "Завтра";
  return fmt(d, tz, "EEEEEE, d MMMM");
}

export const fullDateTime = (iso: string, tz: string) => fmt(iso, tz, "d MMMM, EEEE, HH:mm");

export function phoneLabel(p: string): string {
  const m = p.match(/^\+7(\d{3})(\d{3})(\d{2})(\d{2})$/);
  return m ? `+7 ${m[1]} ${m[2]}-${m[3]}-${m[4]}` : p;
}

export const weekdayNames = ["", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];
export const weekdayShort = ["", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
