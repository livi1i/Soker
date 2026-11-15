// Расчёт свободного времени студии.
// Один и тот же модуль используется серверной функцией (Deno) и кабинетом владельца (браузер),
// поэтому здесь нет обращений к сети и к базе: только чистые функции.
import { addDays, formatISO, parseISO } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

/** ISO-день недели: 1 = понедельник … 7 = воскресенье. */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface DayHours {
  weekday: IsoWeekday;
  opens: string; // "09:00"
  closes: string; // "21:00"
}

export interface StudioRules {
  timezone: string;
  slotStepMinutes: number;
  bufferMinutes: number;
  leadMinutes: number;
  horizonDays: number;
}

export interface ServiceRule {
  durationMinutes: number;
  /** 0 — услуга укладывается в один день; N > 0 — машина занимает бокс N рабочих дней целиком. */
  durationDays: number;
}

export interface BusyInterval {
  boxId: string;
  start: Date;
  /** Конец работы плюс время на подготовку бокса. */
  blockUntil: Date;
}

export interface Calendar {
  hours: DayHours[];
  /** Даты выходных в формате YYYY-MM-DD (по времени студии). */
  daysOff: string[];
}

export interface Slot {
  start: Date;
  end: Date;
  blockUntil: Date;
  /** Боксы, в которых это время свободно. Пустой массив — время занято. */
  freeBoxIds: string[];
}

export interface DayAvailability {
  date: string;
  isOpen: boolean;
  slots: Slot[];
}

const MINUTE = 60_000;

export function isoWeekday(date: string): IsoWeekday {
  // Полдень по UTC, чтобы день недели не «съехал» из-за часового пояса машины.
  const d = new Date(`${date}T12:00:00Z`).getUTCDay();
  return (d === 0 ? 7 : d) as IsoWeekday;
}

export function addDaysToDate(date: string, days: number): string {
  return formatISO(addDays(parseISO(date), days), { representation: "date" });
}

/** Окно работы студии в конкретный день или null, если день нерабочий. */
export function dayWindow(date: string, cal: Calendar, tz: string): { open: Date; close: Date } | null {
  if (cal.daysOff.includes(date)) return null;
  const h = cal.hours.find((x) => x.weekday === isoWeekday(date));
  if (!h) return null;
  const open = fromZonedTime(`${date}T${h.opens}:00`, tz);
  const close = fromZonedTime(`${date}T${h.closes}:00`, tz);
  if (!(close > open)) return null;
  return { open, close };
}

export function studioDate(at: Date, tz: string): string {
  return formatInTimeZone(at, tz, "yyyy-MM-dd");
}

/**
 * Когда закончится работа, начатая в `start`.
 * Многодневная услуга занимает бокс с открытия первого дня до закрытия N-го рабочего дня:
 * машина стоит в боксе и ночью, поэтому весь этот интервал занят.
 */
export function computeEnd(start: Date, service: ServiceRule, cal: Calendar, tz: string): Date {
  if (service.durationDays <= 0) {
    return new Date(start.getTime() + service.durationMinutes * MINUTE);
  }
  let date = studioDate(start, tz);
  let counted = 0;
  let lastClose: Date | null = null;
  // Предохранитель от бесконечного цикла, если студия закрыта все дни подряд.
  for (let i = 0; i < 366 && counted < service.durationDays; i++) {
    const w = dayWindow(date, cal, tz);
    if (w) {
      counted++;
      lastClose = w.close;
    }
    date = addDaysToDate(date, 1);
  }
  if (!lastClose) throw new Error("Нет рабочих дней для многодневной услуги");
  return lastClose;
}

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function freeBoxesFor(start: Date, blockUntil: Date, boxIds: string[], busy: BusyInterval[]): string[] {
  return boxIds.filter(
    (id) => !busy.some((b) => b.boxId === id && overlaps(start, blockUntil, b.start, b.blockUntil)),
  );
}

/** Все варианты времени начала на дату с пометкой, свободно ли оно. */
export function daySlots(params: {
  date: string;
  service: ServiceRule;
  rules: StudioRules;
  cal: Calendar;
  boxIds: string[];
  busy: BusyInterval[];
  now: Date;
}): DayAvailability {
  const { date, service, rules, cal, boxIds, busy, now } = params;
  const tz = rules.timezone;
  const w = dayWindow(date, cal, tz);
  if (!w) return { date, isOpen: false, slots: [] };

  const earliest = new Date(now.getTime() + rules.leadMinutes * MINUTE);
  const buffer = rules.bufferMinutes * MINUTE;
  const slots: Slot[] = [];

  if (service.durationDays > 0) {
    // Многодневная работа начинается только с открытия.
    if (w.open >= earliest) {
      const end = computeEnd(w.open, service, cal, tz);
      const blockUntil = new Date(end.getTime() + buffer);
      slots.push({ start: w.open, end, blockUntil, freeBoxIds: freeBoxesFor(w.open, blockUntil, boxIds, busy) });
    }
    return { date, isOpen: true, slots };
  }

  const step = Math.max(5, rules.slotStepMinutes) * MINUTE;
  const duration = service.durationMinutes * MINUTE;
  for (let t = w.open.getTime(); t + duration <= w.close.getTime(); t += step) {
    const start = new Date(t);
    if (start < earliest) continue;
    const end = new Date(t + duration);
    const blockUntil = new Date(end.getTime() + buffer);
    slots.push({ start, end, blockUntil, freeBoxIds: freeBoxesFor(start, blockUntil, boxIds, busy) });
  }
  return { date, isOpen: true, slots };
}

/** Проверка конкретного времени при создании записи: оно должно быть одним из допустимых вариантов. */
export function findSlot(params: Parameters<typeof daySlots>[0] & { start: Date }): Slot | null {
  const day = daySlots(params);
  return day.slots.find((s) => s.start.getTime() === params.start.getTime()) ?? null;
}
