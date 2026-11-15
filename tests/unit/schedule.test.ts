import { describe, expect, it } from "vitest";
import {
  computeEnd,
  daySlots,
  findSlot,
  type BusyInterval,
  type Calendar,
  type StudioRules,
} from "../../supabase/functions/_shared/schedule";

const tz = "Europe/Moscow";
const rules: StudioRules = { timezone: tz, slotStepMinutes: 30, bufferMinutes: 15, leadMinutes: 60, horizonDays: 30 };
const everyDay = ([1, 2, 3, 4, 5, 6, 7] as const).map((weekday) => ({ weekday, opens: "09:00", closes: "21:00" }));
const cal: Calendar = { hours: everyDay, daysOff: [] };
const boxes = ["b1", "b2"];
// 2026-11-16 — понедельник. «Сейчас» — воскресенье, поэтому ограничение «не раньше чем через час» не мешает.
const now = new Date("2026-11-15T06:00:00Z");
const msk = (s: string) => new Date(`${s}+03:00`);

describe("расчёт свободного времени", () => {
  it("предлагает время с шагом и не выходит за закрытие", () => {
    const day = daySlots({ date: "2026-11-16", service: { durationMinutes: 80, durationDays: 0 }, rules, cal, boxIds: boxes, busy: [], now });
    expect(day.isOpen).toBe(true);
    expect(day.slots[0].start).toEqual(msk("2026-11-16T09:00:00"));
    const last = day.slots.at(-1)!;
    expect(last.end.getTime()).toBeLessThanOrEqual(msk("2026-11-16T21:00:00").getTime());
    expect(last.start).toEqual(msk("2026-11-16T19:30:00"));
  });

  it("время занято, только когда заняты все боксы, с учётом подготовки", () => {
    const busy: BusyInterval[] = [
      { boxId: "b1", start: msk("2026-11-16T10:00:00"), blockUntil: msk("2026-11-16T11:35:00") },
    ];
    const s = { durationMinutes: 60, durationDays: 0 };
    let day = daySlots({ date: "2026-11-16", service: s, rules, cal, boxIds: boxes, busy, now });
    const at10 = day.slots.find((x) => x.start.getTime() === msk("2026-11-16T10:00:00").getTime())!;
    expect(at10.freeBoxIds).toEqual(["b2"]);

    busy.push({ boxId: "b2", start: msk("2026-11-16T09:30:00"), blockUntil: msk("2026-11-16T11:15:00") });
    day = daySlots({ date: "2026-11-16", service: s, rules, cal, boxIds: boxes, busy, now });
    const byTime = (t: string) => day.slots.find((x) => x.start.getTime() === msk(`2026-11-16T${t}:00`).getTime())!;
    expect(byTime("10:00").freeBoxIds).toEqual([]);
    // 09:00–10:00 и ещё 15 минут подготовки: в b2 с 09:30 уже машина, а в b1 работа начинается в 10:00 — раньше 10:15.
    expect(byTime("09:00").freeBoxIds).toEqual([]);
    // 11:30: b2 освободился в 11:15, b1 — только в 11:35.
    expect(byTime("11:30").freeBoxIds).toEqual(["b2"]);
  });

  it("многодневная работа занимает бокс до закрытия последнего дня", () => {
    const s = { durationMinutes: 0, durationDays: 2 };
    const end = computeEnd(msk("2026-11-16T09:00:00"), s, cal, tz);
    expect(end).toEqual(msk("2026-11-17T21:00:00"));
  });

  it("многодневная работа пропускает выходной", () => {
    const withDayOff: Calendar = { hours: everyDay, daysOff: ["2026-11-17"] };
    const end = computeEnd(msk("2026-11-16T09:00:00"), { durationMinutes: 0, durationDays: 2 }, withDayOff, tz);
    expect(end).toEqual(msk("2026-11-18T21:00:00"));
  });

  it("если машина стоит в боксе два дня, второй день этого бокса тоже занят", () => {
    const twoDay = { durationMinutes: 0, durationDays: 2 };
    const first = daySlots({ date: "2026-11-16", service: twoDay, rules, cal, boxIds: ["b1"], busy: [], now });
    const slot = first.slots[0];
    const busy: BusyInterval[] = [{ boxId: "b1", start: slot.start, blockUntil: slot.blockUntil }];
    const nextDay = daySlots({ date: "2026-11-17", service: { durationMinutes: 60, durationDays: 0 }, rules, cal, boxIds: ["b1"], busy, now });
    expect(nextDay.slots.length).toBeGreaterThan(0);
    expect(nextDay.slots.every((x) => x.freeBoxIds.length === 0)).toBe(true);
    const thirdDay = daySlots({ date: "2026-11-18", service: { durationMinutes: 60, durationDays: 0 }, rules, cal, boxIds: ["b1"], busy, now });
    expect(thirdDay.slots[0].freeBoxIds).toEqual(["b1"]);
  });

  it("выходной и нерабочий день не дают времени", () => {
    const noSunday: Calendar = { hours: everyDay.filter((d) => d.weekday !== 7), daysOff: ["2026-11-16"] };
    expect(daySlots({ date: "2026-11-16", service: { durationMinutes: 60, durationDays: 0 }, rules, cal: noSunday, boxIds: boxes, busy: [], now }).isOpen).toBe(false);
    expect(daySlots({ date: "2026-11-22", service: { durationMinutes: 60, durationDays: 0 }, rules, cal: noSunday, boxIds: boxes, busy: [], now }).isOpen).toBe(false);
  });

  it("не предлагает время раньше, чем через заданный запас от текущего момента", () => {
    const at = msk("2026-11-16T12:10:00");
    const day = daySlots({ date: "2026-11-16", service: { durationMinutes: 60, durationDays: 0 }, rules, cal, boxIds: boxes, busy: [], now: at });
    expect(day.slots[0].start).toEqual(msk("2026-11-16T13:30:00"));
  });

  it("findSlot отклоняет время не по сетке", () => {
    const base = { date: "2026-11-16", service: { durationMinutes: 60, durationDays: 0 }, rules, cal, boxIds: boxes, busy: [], now };
    expect(findSlot({ ...base, start: msk("2026-11-16T10:00:00") })).not.toBeNull();
    expect(findSlot({ ...base, start: msk("2026-11-16T10:10:00") })).toBeNull();
    expect(findSlot({ ...base, start: msk("2026-11-16T03:00:00") })).toBeNull();
  });
});
