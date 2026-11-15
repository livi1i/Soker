import { sitePath } from "../lib/sitePath";
import { useEffect, useState } from "react";
import { DownloadSimple, X, ShareNetwork } from "@phosphor-icons/react";
import { VStack } from "@astryxdesign/core/VStack";
import { Text } from "@astryxdesign/core/Text";

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
let pendingInstall: InstallEvent | null = null;
// Capture before the studio data finishes loading.
window.addEventListener("beforeinstallprompt", event => {
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (!mobile) return;
  event.preventDefault();
  pendingInstall = event as InstallEvent;
  window.dispatchEvent(new Event("soker-install-ready"));
});
const standalone = () => window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export function InstallPrompt({ slug, name }: { slug: string; name: string }) {
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(navigator.userAgent);
  const key = `install-dismissed:${slug}`;
  const [hidden, setHidden] = useState(() => {
    try { return standalone() || Date.now() - Number(localStorage.getItem(key) || 0) < 7 * 86400000; }
    catch { return standalone(); }
  });
  const [ready, setReady] = useState(!!pendingInstall);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const ready = () => setReady(!!pendingInstall);
    const installed = () => { pendingInstall = null; setHidden(true); };
    const display = window.matchMedia("(display-mode: standalone)");
    const changed = () => { if (standalone()) installed(); };
    window.addEventListener("soker-install-ready", ready);
    window.addEventListener("appinstalled", installed);
    display.addEventListener("change", changed);
    return () => {
      window.removeEventListener("soker-install-ready", ready);
      window.removeEventListener("appinstalled", installed);
      display.removeEventListener("change", changed);
    };
  }, []);
  if (hidden || (!ios && !android)) return null;
  const dismiss = () => {
    setHidden(true);
    try { localStorage.setItem(key, String(Date.now())); } catch { /* Storage can be unavailable in private mode. */ }
  };
  const install = async () => {
    const event = pendingInstall;
    if (!event) { setExpanded(true); return; }
    setBusy(true);
    try {
      await event.prompt();
      const choice = await event.userChoice;
      if (choice.outcome === "accepted") setHidden(true);
    } catch { setExpanded(true); }
    finally { pendingInstall = null; setReady(false); setBusy(false); }
  };
  const inApp = /Instagram|FBAN|FBAV|VKClient|; wv\)/i.test(navigator.userAgent);
  return (
    <aside className="install-prompt container" aria-label="Добавление на главный экран">
      <VStack gap={3} className="install-prompt__surface">
        <button className="install-prompt__close" type="button" aria-label="Закрыть подсказку установки" onClick={dismiss}><X size={20} aria-hidden /></button>
        <img className="install-prompt__icon" src={sitePath(`/s/${slug}/icon-192.png`)} alt="" width={48} height={48} />
        <Text as="p" weight="semibold">{name} на главном экране</Text>
        <Text as="p" type="supporting">Открывайте студию одним касанием — записывайтесь и смотрите свои записи.</Text>
        <button className="install-prompt__action" type="button" disabled={busy} onClick={android && ready ? install : () => setExpanded(!expanded)} aria-expanded={expanded} aria-controls={expanded ? "install-instructions" : undefined}>
          {android && ready ? <DownloadSimple size={18} aria-hidden /> : <ShareNetwork size={18} aria-hidden />}
          {android && ready ? "Установить приложение" : expanded ? "Свернуть инструкцию" : "Как добавить на экран"}
        </button>
        {expanded && <VStack id="install-instructions" gap={2} className="install-prompt__instructions">
          {ios ? <>
            <Text as="p">{inApp ? "Сначала откройте этот сайт в Safari через меню текущего приложения." : "Откройте сайт в Safari."}</Text>
            <ol><li>Откройте меню «Поделиться».</li><li>Выберите «На экран „Домой“».</li><li>Если есть переключатель «Открывать как веб-приложение», включите его и нажмите «Добавить».</li></ol>
          </> : <>
            <Text as="p">{inApp ? "Сначала откройте сайт в Chrome через меню текущего приложения." : "В Chrome на Android:"}</Text>
            <ol><li>Нажмите на три точки в меню браузера.</li><li>Выберите «Добавить на главный экран» или «Установить приложение».</li><li>Подтвердите добавление. Название пункта зависит от браузера.</li></ol>
          </>}
        </VStack>}
      </VStack>
    </aside>
  );
}
