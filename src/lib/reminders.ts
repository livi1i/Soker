import { api } from "./api";
import type { PublicBooking } from "./types";

const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

/** Можно ли включить уведомления на этом устройстве (на iPhone — только в установленном приложении). */
export function pushSupport(): "ok" | "needs-install" | "unsupported" {
  if (!vapidKey) return "unsupported";
  const hasApi = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const isIos = /iP(hone|ad|od)/.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
  if (isIos && !standalone) return "needs-install";
  return hasApi ? "ok" : "unsupported";
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function enablePushReminder(token: string): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Уведомления запрещены в настройках браузера");
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidKey!) }));
  await api.subscribe(token, sub.toJSON());
}

const icsDate = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/[,;]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");

/** Файл календаря с напоминанием за сутки — работает и там, где уведомлений нет. */
export function icsFile(b: PublicBooking, pageUrl: string): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//studio-booking//RU",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${b.id}@studio-booking`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(b.startsAt)}`,
    `DTEND:${icsDate(b.endsAt)}`,
    `SUMMARY:${icsText(`${b.studio.name}: ${b.serviceName}`)}`,
    `LOCATION:${icsText(b.studio.address)}`,
    `DESCRIPTION:${icsText(`Автомобиль: ${b.car}\nТелефон студии: ${b.studio.phone}\nЗапись: ${pageUrl}`)}`,
    `URL:${pageUrl}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Завтра запись в студию",
    "TRIGGER:-P1D",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadIcs(b: PublicBooking, pageUrl: string) {
  const blob = new Blob([icsFile(b, pageUrl)], { type: "text/calendar;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "zapis.ics";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function googleCalendarUrl(b: PublicBooking, pageUrl: string): string {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: `${b.studio.name}: ${b.serviceName}`,
    dates: `${icsDate(b.startsAt)}/${icsDate(b.endsAt)}`,
    location: b.studio.address,
    details: `Автомобиль: ${b.car}. Запись: ${pageUrl}`,
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}
