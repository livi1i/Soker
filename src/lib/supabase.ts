import { createClient } from "@supabase/supabase-js";

// В код сайта попадают только публичный адрес и публичный ключ (anon). Права проверяет база.
const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anonKey) {
  console.error("Не заданы VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY");
}

export const supabase = createClient(url ?? "http://localhost", anonKey ?? "missing", {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: "studio-owner-session" },
});

export function mediaUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//.test(path)) return path;
  return `${url}/storage/v1/object/public/media/${path}`;
}

export const functionsUrl = `${url}/functions/v1`;
export const publicAnonKey = anonKey;
