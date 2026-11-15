import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Theme } from "@astryxdesign/core/theme";
import { InternationalizationProvider } from "@astryxdesign/core/i18n";
import ruRU from "@astryxdesign/core/locales/ru-RU.generated.js";
import { registerSW } from "virtual:pwa-register";
import { appTheme } from "./theme";
import { AppRouter } from "./router";
import "./styles/global.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, networkMode: "offlineFirst" },
    mutations: { retry: 0 },
  },
});

registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <InternationalizationProvider locale="ru-RU" messages={{ "ru-RU": ruRU }}>
    <Theme theme={appTheme} mode="dark">
      <QueryClientProvider client={queryClient}>
        <AppRouter />
      </QueryClientProvider>
    </Theme>
    </InternationalizationProvider>
  </StrictMode>,
);
