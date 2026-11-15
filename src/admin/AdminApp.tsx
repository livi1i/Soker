import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { Center } from "@astryxdesign/core/Center";
import { Spinner } from "@astryxdesign/core/Spinner";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { Tab, TabList } from "@astryxdesign/core/TabList";
import { ArrowSquareOut, SignOut } from "@phosphor-icons/react";
import { supabase } from "../lib/supabase";
import { useStudio } from "../lib/api";
import { LoginPage } from "./Login";
import { BookingsPage } from "./Bookings";
import { SettingsPage } from "./Settings";

export default function AdminApp() {
  const { slug = "" } = useParams();
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    document.title = "Кабинет владельца";
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <Center height="100dvh"><Spinner size="xl" /></Center>;
  if (!session) return <LoginPage slug={slug} />;
  return <OwnerArea slug={slug} userId={session.user.id} email={session.user.email ?? ""} />;
}

function OwnerArea({ slug, userId, email }: { slug: string; userId: string; email: string }) {
  const studio = useStudio(slug);
  const membership = useQuery({
    queryKey: ["membership", slug, userId],
    enabled: !!studio.data,
    queryFn: async () => {
      // Право доступа проверяет база (RLS): чужая студия просто не вернётся.
      const { data, error } = await supabase.from("studio_members").select("role").eq("studio_id", studio.data!.studio.id).eq("user_id", userId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const tab = pathname.includes("/admin/settings") ? "settings" : "bookings";

  if (studio.isLoading || membership.isLoading) return <Center height="100dvh"><Spinner size="xl" /></Center>;
  if (!studio.data) return <Center height="100dvh"><EmptyState title="Студия не найдена" /></Center>;
  if (!membership.data) {
    return (
      <Center height="100dvh">
        <EmptyState
          title="Нет доступа к этой студии"
          description={`Аккаунт ${email} не является владельцем «${studio.data.studio.name}».`}
          actions={<Button label="Выйти" onClick={() => supabase.auth.signOut()} />}
        />
      </Center>
    );
  }

  const bundle = studio.data;
  return (
    <div className="admin-shell">
      <div className="admin-top">
        <div className="container admin-top__inner">
          <Text weight="bold" type="large" maxLines={1}>{bundle.studio.name}</Text>
          <div style={{ flex: 1 }} />
          <HStack gap={1}>
            <Button label="Сайт" variant="ghost" size="sm" href={`/s/${slug}/`} icon={<ArrowSquareOut size={16} />} />
            <Button label="Выйти" variant="ghost" size="sm" isIconOnly icon={<SignOut size={18} />} tooltip="Выйти" onClick={() => supabase.auth.signOut()} />
          </HStack>
        </div>
        <div className="container">
          <TabList value={tab} onChange={(v) => navigate(v === "settings" ? `/s/${slug}/admin/settings` : `/s/${slug}/admin`)}>
            <Tab value="bookings" label="Записи" />
            <Tab value="settings" label="Настройки" />
          </TabList>
        </div>
      </div>
      <main className="container" style={{ paddingBlock: 20, paddingBottom: 60 }}>
        {tab === "bookings" ? <BookingsPage bundle={bundle} /> : <SettingsPage bundle={bundle} />}
      </main>
    </div>
  );
}
