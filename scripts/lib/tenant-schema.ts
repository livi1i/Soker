// Описание файла tenants/<название>/tenant.json. Его проверяет команда `pnpm tenant:check`.
import { z } from "zod";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Время в формате ЧЧ:ММ");
const day = z.object({ opens: time, closes: time }).refine((d) => d.closes > d.opens, "Закрытие позже открытия").nullable();
const photo = z.string().regex(/^photos\/[\w.-]+\.(jpe?g|png|webp)$/i, "Путь вида photos/имя.jpg");

export const tenantSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{2,40}$/, "Латиница, цифры и дефис"),
  name: z.string().min(2).max(60),
  tagline: z.string().max(120),
  description: z.string().max(600),
  timezone: z.string().refine((tz) => {
    try {
      new Intl.DateTimeFormat("ru", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "Неизвестный часовой пояс"),
  address: z.object({ text: z.string().min(5), city: z.string(), lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) }),
  phone: z.string().regex(/^\+7\d{10}$/, "Телефон в формате +7XXXXXXXXXX"),
  socials: z.array(z.object({ label: z.string(), url: z.string().url() })).max(6),
  rating: z.object({ value: z.number().min(0).max(5), count: z.number().int().min(0), source: z.string(), url: z.string().url() }).nullable(),
  brand: z.object({
    themeColor: z.string().regex(/^#[0-9a-f]{6}$/i),
    accent: z.string().regex(/^#[0-9a-f]{6}$/i),
    logo: photo,
    icon: photo,
    hero: photo,
    heroPosition: z.string().default("50% 50%"),
  }),
  booking: z.object({
    slotStepMinutes: z.number().int().min(10).max(120),
    bufferMinutes: z.number().int().min(0).max(240),
    leadMinutes: z.number().int().min(0).max(2880),
    horizonDays: z.number().int().min(1).max(90),
    cancelHoursBefore: z.number().int().min(0).max(168),
  }),
  hours: z.object({ mon: day, tue: day, wed: day, thu: day, fri: day, sat: day, sun: day }),
  daysOff: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  boxes: z.array(z.string().min(1).max(40)).min(1).max(20),
  infoCards: z.array(z.object({ icon: z.string(), title: z.string().min(2).max(40), text: z.string().max(140) })).length(3, "Ровно три карточки"),
  services: z
    .array(
      z.object({
        category: z.string().min(2).max(40),
        name: z.string().min(2).max(80),
        description: z.string().max(300).default(""),
        price: z.number().int().min(0),
        priceFrom: z.boolean().default(true),
        durationMinutes: z.number().int().min(0).max(720),
        durationDays: z.number().int().min(0).max(30).default(0),
      }).refine((s) => s.durationDays > 0 || s.durationMinutes >= 10, "Укажите длительность в минутах или днях"),
    )
    .min(1),
  gallery: z.array(z.object({ photo, caption: z.string().max(120) })).max(40),
  owner: z.object({ email: z.string().email() }),
});

export type Tenant = z.infer<typeof tenantSchema>;
export const weekdayKeys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
