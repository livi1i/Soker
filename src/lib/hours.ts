import { formatInTimeZone } from "date-fns-tz";
import type { DayOff, WorkingHours } from "./types";

/** «Открыто до 21:00» / «Закрыто · откроется завтра в 09:00». */
export function openStatus(hours: WorkingHours[], daysOff: DayOff[], tz: string, now = new Date()) {
  const today = formatInTimeZone(now, tz, "yyyy-MM-dd");
  const time = formatInTimeZone(now, tz, "HH:mm");
  const isoDay = Number(formatInTimeZone(now, tz, "i"));
  const off = new Set(daysOff.map((d) => d.day));
  const h = hours.find((x) => x.weekday === isoDay);
  if (h && !off.has(today) && time >= h.opens && time < h.closes) {
    return { open: true, text: `Открыто до ${h.closes}` };
  }
  if (h && !off.has(today) && time < h.opens) return { open: false, text: `Закрыто · откроется сегодня в ${h.opens}` };
  for (let i = 1; i <= 14; i++) {
    const d = new Date(now.getTime() + i * 86400_000);
    const date = formatInTimeZone(d, tz, "yyyy-MM-dd");
    const wd = Number(formatInTimeZone(d, tz, "i"));
    const next = hours.find((x) => x.weekday === wd);
    if (next && !off.has(date)) {
      const when = i === 1 ? "завтра" : formatInTimeZone(d, tz, "dd.MM");
      return { open: false, text: `Закрыто · откроется ${when} в ${next.opens}` };
    }
  }
  return { open: false, text: "Закрыто" };
}

/** Строки расписания, одинаковые дни склеиваются: «Ежедневно 09:00–21:00». */
export function hoursRows(hours: WorkingHours[]): { label: string; value: string; days: number[] }[] {
  const short = ["", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  const byDay = new Map(hours.map((h) => [h.weekday, `${h.opens}–${h.closes}`]));
  const rows: { label: string; value: string; days: number[] }[] = [];
  for (let d = 1; d <= 7; d++) {
    const v = byDay.get(d) ?? "Выходной";
    const last = rows.at(-1);
    if (last && last.value === v) last.days.push(d);
    else rows.push({ label: "", value: v, days: [d] });
  }
  for (const r of rows) {
    r.label = r.days.length === 7 ? "Ежедневно" : r.days.length === 1 ? short[r.days[0]] : `${short[r.days[0]]}–${short[r.days.at(-1)!]}`;
  }
  return rows;
}
