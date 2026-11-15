import { useEffect, useState } from "react";
import { Outlet, useLocation, useOutletContext, useParams } from "react-router";
import { Banner } from "@astryxdesign/core/Banner";
import { Center } from "@astryxdesign/core/Center";
import { Spinner } from "@astryxdesign/core/Spinner";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Button } from "@astryxdesign/core/Button";
import { WifiSlash } from "@phosphor-icons/react";
import { useStudio } from "../lib/api";
import { loadSaved } from "../lib/myBookings";
import type { StudioBundle } from "../lib/types";
import { BottomNav } from "./BottomNav";


export interface TenantCtx {
  bundle: StudioBundle;
  slug: string;
  online: boolean;
}

export const useTenant = () => useOutletContext<TenantCtx>();

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export function TenantLayout() {
  const { slug = "" } = useParams();
  const { data, isLoading, isError, refetch } = useStudio(slug);
  const online = useOnline();
  const { pathname } = useLocation();
  const hasBooking = loadSaved(slug).some((b) => new Date(b.startsAt) > new Date());

  useEffect(() => {
    window.scrollTo({ top: 0 });

  }, [pathname]);

  useEffect(() => {
    if (data?.studio) {
      document.title = `${data.studio.name} — ${data.studio.tagline}`;

    }
  }, [data]);

  if (isLoading) {
    return <Center height="100dvh"><Spinner size="xl" label="Загружаем студию" /></Center>;
  }
  if (isError || data === undefined) {
    return (
      <Center height="100dvh">
        <EmptyState
          icon={<WifiSlash size={40} />}
          title={online ? "Не получилось загрузить" : "Нет подключения к интернету"}
          description="Проверьте подключение и попробуйте снова."
          actions={<Button label="Повторить" variant="primary" onClick={() => refetch()} />}
        />
      </Center>
    );
  }
  if (data === null) {
    return <Center height="100dvh"><EmptyState title="Студия не найдена" description="Проверьте адрес ссылки." /></Center>;
  }

  const ctx: TenantCtx = { bundle: data, slug, online };
  return (
    <>
      <div id="page-content" className="page">
        {data.studio.status === "draft" && (
          <div className="sample-note" role="note">Образец студии — запись откроется после проверки настроек</div>
        )}
        {!online && (
          <Banner status="info" container="section" collapsible={false} title="Вы не в сети"
            description="Показываем сохранённые данные. Записаться можно, когда появится интернет." />
        )}
        <Outlet context={ctx} />
      </div>
      <BottomNav slug={slug} hasBooking={hasBooking} />
    </>
  );
}
