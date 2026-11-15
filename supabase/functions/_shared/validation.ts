// Проверка того, что вводят люди. Одни и те же правила работают в форме записи и на сервере.
import { z } from "zod";

const trimmed = (min: number, max: number, msg: string) =>
  z.string().trim().min(min, msg).max(max, `Не длиннее ${max} символов`);

/** Приводит российский номер к виду +7XXXXXXXXXX. Возвращает null, если номер не похож на настоящий. */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && (digits.startsWith("7") || digits.startsWith("8"))) return `+7${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith("9")) return `+7${digits}`;
  return null;
}

export const phoneSchema = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const p = normalizePhone(v);
    if (!p) {
      ctx.addIssue({ code: "custom", message: "Введите номер в формате +7 900 000-00-00" });
      return z.NEVER;
    }
    return p;
  });

export const clientSchema = z.object({
  name: trimmed(2, 60, "Как к вам обращаться?").regex(/^[\p{L}\s'.-]+$/u, "Только буквы, пробел и дефис"),
  phone: phoneSchema,
  car: trimmed(2, 80, "Укажите марку и модель"),
  comment: z.string().trim().max(500, "Не длиннее 500 символов").optional().default(""),
});
export type ClientInput = z.input<typeof clientSchema>;

export const bookRequestSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{2,40}$/),
  serviceId: z.string().uuid(),
  start: z.string().datetime({ offset: true }),
  idempotencyKey: z.string().uuid(),
  client: clientSchema,
});
export type BookRequest = z.input<typeof bookRequestSchema>;

export const availabilityRequestSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{2,40}$/),
  serviceId: z.string().uuid(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  days: z.number().int().min(1).max(31),
});

export const tokenRequestSchema = z.object({ token: z.string().uuid() });

export const pushSubscribeSchema = z.object({
  token: z.string().uuid(),
  subscription: z.object({
    endpoint: z.string().url().max(1000),
    keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }),
  }),
});

/** Ошибки Zod в виде { поле: текст } для показа рядом с полем. */
export function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
