import { sitePath } from "../lib/sitePath";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { Heading } from "@astryxdesign/core/Heading";
import { Button } from "@astryxdesign/core/Button";
import { Banner } from "@astryxdesign/core/Banner";
import { Badge } from "@astryxdesign/core/Badge";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { BellRinging, CalendarBlank, CalendarPlus, CheckCircle, GoogleLogo, NavigationArrow, Phone } from "@phosphor-icons/react";
import { useTenant } from "../components/TenantLayout";
import { api, ApiError } from "../lib/api";
import { fullDateTime, phoneLabel, rub, dayLabel, timeLabel } from "../lib/format";
import { forgetBooking, loadSaved } from "../lib/myBookings";
import { downloadIcs, enablePushReminder, googleCalendarUrl, pushSupport } from "../lib/reminders";
import type { BookingStatus, PublicBooking } from "../lib/types";

const statusText: Record<BookingStatus, { label: string; variant: "success" | "info" | "neutral" | "error" }> = {
  booked: { label: "Подтверждена", variant: "success" },
  arrived: { label: "Машина в работе", variant: "info" },
  done: { label: "Готово", variant: "neutral" },
  cancelled: { label: "Отменена", variant: "error" },
};

export function MyBookingPage() {
  const { slug, bundle } = useTenant();
  const [params] = useSearchParams();
  const saved = loadSaved(slug);
  const token = params.get("t") ?? saved.find((b) => new Date(b.startsAt) > new Date())?.token ?? saved[0]?.token ?? null;
  const isNew = params.get("new") === "1";

  return (
    <div className="container" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 28px)", maxWidth: 760 }}>
      <span className="eyebrow">{bundle.studio.name}</span>
      <h1 className="book-title">Моя запись</h1>
      {token ? (
        <BookingView token={token} isNew={isNew} />
      ) : (
        <div className="book-card" style={{ marginTop: 18 }}>
          <EmptyState
            icon={<CalendarBlank size={40} />}
            title="Записей пока нет"
            description="Запишитесь онлайн — запись появится здесь, на этом устройстве."
            actions={<Button label="Записаться" variant="primary" href={`/s/${slug}/book`} />}
          />
        </div>
      )}
      {saved.length > 1 && (
        <VStack gap={2}>
          <Heading level={3}>Другие записи на этом устройстве</Heading>
          {saved.filter((b) => b.token !== token).map((b) => (
            <Link key={b.token} to={`/s/${slug}/my?t=${b.token}`} className="option" style={{ textDecoration: "none" }}>
              <Text weight="semibold">{b.serviceName}</Text>
              <Text>{dayLabel(b.startsAt, bundle.studio.timezone)} {timeLabel(b.startsAt, bundle.studio.timezone)}</Text>
            </Link>
          ))}
        </VStack>
      )}
    </div>
  );
}

function BookingView({ token, isNew }: { token: string; isNew: boolean }) {
  const { slug } = useTenant();
  const qc = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const q = useQuery({ queryKey: ["booking", token], queryFn: () => api.booking(token).then((r) => r.booking), networkMode: "online" });
  const cancel = useMutation({
    mutationFn: () => api.cancel(token).then((r) => r.booking),
    onSuccess: (b) => {
      qc.setQueryData(["booking", token], b);
      qc.invalidateQueries({ queryKey: ["availability", slug] });
      setConfirmOpen(false);
    },
  });

  if (q.isLoading) return <div className="book-card" style={{ marginTop: 18 }}><VStack gap={3}><Skeleton height={28} /><Skeleton height={140} /></VStack></div>;
  if (q.isError || !q.data) {
    const notFound = q.error instanceof ApiError && q.error.status === 404;
    return (
      <div className="book-card" style={{ marginTop: 18 }}>
        <EmptyState
          title={notFound ? "Запись не найдена" : "Не удалось загрузить запись"}
          description={notFound ? "Ссылка устарела или запись удалена." : (q.error as Error)?.message}
          actions={
            notFound
              ? <Button label="Убрать с устройства" onClick={() => { forgetBooking(slug, token); window.location.replace(sitePath(`/s/${slug}/my`)); }} />
              : <Button label="Повторить" variant="primary" onClick={() => q.refetch()} />
          }
        />
      </div>
    );
  }

  const b = q.data;
  const tz = b.studio.timezone;
  const st = statusText[b.status];
  const upcoming = b.status === "booked" && new Date(b.startsAt) > new Date();

  return (
    <VStack gap={4}>
      {isNew && b.status === "booked" && (
        <div style={{ marginTop: 18 }}>
          <Banner status="success" icon={<CheckCircle size={20} weight="fill" />} title="Вы записаны!"
            description="Сохраните эту страницу — здесь всегда можно посмотреть или отменить запись." collapsible={false} />
        </div>
      )}
      <div className="book-card" style={{ marginTop: isNew ? 0 : 18 }}>
        <VStack gap={4}>
          <HStack justify="between" align="start" gap={3} wrap="wrap">
            <VStack gap={1}>
              <Text type="supporting">{dayLabel(b.startsAt, tz)}</Text>
              <Heading level={2}>{fullDateTime(b.startsAt, tz)}</Heading>
            </VStack>
            <Badge variant={st.variant} label={st.label} />
          </HStack>
          <dl className="summary">
            <div><dt>Услуга</dt><dd>{b.serviceName}</dd></div>
            <div><dt>Ориентировочно до</dt><dd>{fullDateTime(b.endsAt, tz)}</dd></div>
            <div><dt>Стоимость</dt><dd>от {rub(b.price)}</dd></div>
            {b.boxName && <div><dt>Бокс</dt><dd>{b.boxName}</dd></div>}
            <div><dt>Автомобиль</dt><dd>{b.car}</dd></div>
            <div><dt>Имя</dt><dd>{b.clientName}</dd></div>
            <div><dt>Телефон</dt><dd>{phoneLabel(b.clientPhone)}</dd></div>
            <div><dt>Адрес</dt><dd>{b.studio.address}</dd></div>
          </dl>
          <HStack gap={2} wrap="wrap">
            <Button label="Позвонить в студию" href={`tel:${b.studio.phone}`} icon={<Phone size={18} />} />
            {b.studio.lat != null && (
              <Button label="Маршрут" href={`https://yandex.ru/maps/?rtext=~${b.studio.lat},${b.studio.lon}&rtt=auto`} target="_blank" rel="noreferrer" icon={<NavigationArrow size={18} />} />
            )}
          </HStack>
        </VStack>
      </div>

      {upcoming && <ReminderCard booking={b} />}

      {b.status === "booked" && (
        <div className="book-card">
          <VStack gap={3}>
            <Heading level={3}>Планы изменились?</Heading>
            {b.canCancel ? (
              <>
                <Text type="supporting">
                  Отменить онлайн можно до {fullDateTime(b.cancelDeadline, tz)} — не позже чем за {b.cancelHours} ч до начала.
                </Text>
                <Button label="Отменить запись" variant="destructive" onClick={() => setConfirmOpen(true)} />
              </>
            ) : (
              <Text type="supporting">
                Онлайн-отмена закрылась за {b.cancelHours} ч до начала. Позвоните в студию: {phoneLabel(b.studio.phone)}.
              </Text>
            )}
            {cancel.isError && <Banner status="error" title={(cancel.error as Error).message} collapsible={false} />}
          </VStack>
        </div>
      )}
      <AlertDialog
        isOpen={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Отменить запись?"
        description={`${b.serviceName}, ${fullDateTime(b.startsAt, tz)}. Время освободится для других клиентов.`}
        actionLabel="Отменить запись"
        cancelLabel="Оставить"
        onAction={() => cancel.mutate()}
        isActionLoading={cancel.isPending}
      />
      {b.status !== "cancelled" && (
        <Button label="Записаться ещё" variant="ghost" href={`/s/${slug}/book`} icon={<CalendarPlus size={18} />} />
      )}
    </VStack>
  );
}

function ReminderCard({ booking }: { booking: PublicBooking }) {
  const support = pushSupport();
  const storeKey = `reminder:${booking.token}`;
  const [state, setState] = useState<"idle" | "on" | "error">(() => {
    try { return localStorage.getItem(storeKey) ? "on" : "idle"; } catch { return "idle"; }
  });
  const [error, setError] = useState<string | null>(null);
  const pageUrl = `${location.origin}/s/${booking.studio.slug}/my?t=${booking.token}`;
  const enable = useMutation({
    mutationFn: () => enablePushReminder(booking.token),
    onSuccess: () => {
      setState("on");
      try { localStorage.setItem(storeKey, "1"); } catch { /* ignore */ }
    },
    onError: (e) => { setState("error"); setError((e as Error).message); },
  });

  return (
    <div className="book-card">
      <VStack gap={3}>
        <HStack gap={2} align="center"><BellRinging size={22} aria-hidden /><Heading level={3}>Напомнить за сутки?</Heading></HStack>
        {support === "ok" && state !== "on" && (
          <>
            <Text type="supporting">Пришлём уведомление за 24 часа до записи.</Text>
            <Button label="Включить напоминание" variant="primary" onClick={() => enable.mutate()} isLoading={enable.isPending} icon={<BellRinging size={18} />} />
          </>
        )}
        {state === "on" && <Banner status="success" title="Напоминание включено" description="Уведомление придёт за сутки до записи." collapsible={false} />}
        {state === "error" && error && <Banner status="warning" title="Уведомления недоступны" description={`${error}. Добавьте запись в календарь — он напомнит сам.`} collapsible={false} />}
        {support === "needs-install" && (
          <Text type="supporting">
            На iPhone уведомления работают в установленном приложении: «Поделиться» → «На экран „Домой“». А пока добавьте запись в календарь — напоминание за сутки уже внутри.
          </Text>
        )}
        {support === "unsupported" && <Text type="supporting">В этом браузере уведомления недоступны. Добавьте запись в календарь — напоминание за сутки уже внутри.</Text>}
        <HStack gap={2} wrap="wrap">
          <Button label="Добавить в календарь" onClick={() => downloadIcs(booking, pageUrl)} icon={<CalendarPlus size={18} />} />
          <Button label="Google Календарь" variant="ghost" href={googleCalendarUrl(booking, pageUrl)} target="_blank" rel="noreferrer" icon={<GoogleLogo size={18} />} />
        </HStack>
      </VStack>
    </div>
  );
}
