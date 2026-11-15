/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module "liquid-gl" {
  const liquidGL: (options: Record<string, unknown>) => unknown;
  export default liquidGL;
}

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_VAPID_PUBLIC_KEY?: string;
  readonly VITE_DEFAULT_TENANT?: string;
}
