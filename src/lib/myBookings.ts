// Клиент без регистрации: ссылки на свои записи храним на устройстве.
const key = (slug: string) => `my-bookings:${slug}`;

export interface SavedBooking {
  token: string;
  startsAt: string;
  serviceName: string;
}

export function loadSaved(slug: string): SavedBooking[] {
  try {
    const raw = localStorage.getItem(key(slug));
    const list = raw ? (JSON.parse(raw) as SavedBooking[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveBooking(slug: string, b: SavedBooking) {
  try {
    const list = loadSaved(slug).filter((x) => x.token !== b.token);
    list.unshift(b);
    localStorage.setItem(key(slug), JSON.stringify(list.slice(0, 20)));
  } catch {
    /* хранилище недоступно — запись всё равно создана, ссылка показана на экране */
  }
}

export function forgetBooking(slug: string, token: string) {
  try {
    localStorage.setItem(key(slug), JSON.stringify(loadSaved(slug).filter((x) => x.token !== token)));
  } catch {
    /* ignore */
  }
}
