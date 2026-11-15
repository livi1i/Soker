import { useQuery } from "@tanstack/react-query";
import { functionsUrl, publicAnonKey, supabase } from "./supabase";
import type { Availability, PublicBooking, StudioBundle } from "./types";

export async function fetchStudioBundle(slug: string): Promise<StudioBundle | null> {
  const { data: studio, error } = await supabase.from("studios").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  if (!studio) return null;
  const id = studio.id;
  const [services, boxes, hours, daysOff, gallery, reviews] = await Promise.all([
    supabase.from("services").select("*").eq("studio_id", id).order("sort"),
    supabase.from("boxes").select("*").eq("studio_id", id).order("sort"),
    supabase.from("working_hours").select("*").eq("studio_id", id).order("weekday"),
    supabase.from("days_off").select("*").eq("studio_id", id).order("day"),
    supabase.from("gallery_items").select("*").eq("studio_id", id).order("sort").order("created_at"),
    supabase.from("review_albums").select("*").eq("studio_id", id).order("sort"),
  ]);
  for (const r of [services, boxes, hours, daysOff, gallery, reviews]) if (r.error) throw r.error;
  return {
    studio,
    services: services.data!,
    boxes: boxes.data!,
    hours: hours.data!.map((h) => ({ ...h, opens: h.opens.slice(0, 5), closes: h.closes.slice(0, 5) })),
    daysOff: daysOff.data!,
    gallery: gallery.data!,
    reviewAlbums: reviews.data!,
  };
}

export const studioKey = (slug: string) => ["studio", slug] as const;

export function useStudio(slug: string) {
  return useQuery({ queryKey: studioKey(slug), queryFn: () => fetchStudioBundle(slug), staleTime: 60_000 });
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

async function call<T>(action: string, body: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${functionsUrl}/public-api`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: publicAnonKey },
      body: JSON.stringify({ action, ...body }),
    });
  } catch {
    throw new ApiError(0, "offline", "Нет связи с интернетом. Проверьте подключение и попробуйте снова.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = data?.error ?? {};
    throw new ApiError(res.status, e.code ?? "server", e.message ?? "Ошибка сервера", e.fields);
  }
  return data as T;
}

export const api = {
  availability: (slug: string, serviceId: string, from: string, days: number) =>
    call<Availability>("availability", { slug, serviceId, from, days }),
  book: (input: {
    slug: string;
    serviceId: string;
    start: string;
    idempotencyKey: string;
    client: { name: string; phone: string; car: string; comment?: string };
  }) => call<{ booking: PublicBooking; repeated?: boolean }>("book", input),
  booking: (token: string) => call<{ booking: PublicBooking }>("booking", { token }),
  cancel: (token: string) => call<{ booking: PublicBooking }>("cancel", { token }),
  subscribe: (token: string, subscription: PushSubscriptionJSON) =>
    call<{ ok: true; remindAt: string }>("subscribe", { token, subscription }),
};
