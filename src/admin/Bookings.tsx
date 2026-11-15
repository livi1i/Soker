import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addDays, formatISO } from "date-fns";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { Heading } from "@astryxdesign/core/Heading";
import { Button } from "@astryxdesign/core/Button";
import { Badge } from "@astryxdesign/core/Badge";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { Banner } from "@astryxdesign/core/Banner";
import { CaretLeft, CaretRight, CarProfile, CheckCircle, DotsThreeVertical, Plus } from "@phosphor-icons/react";
import { supabase } from "../lib/supabase";
import { fmt, phoneLabel, rub } from "../lib/format";
import type { BookingStatus, OwnerBooking, StudioBundle } from "../lib/types";
import { dbMessage, periodRange, todayIn, useOwnerBookings, usePayments, useStats } from "./owner";
import { BookingFormDialog, PaymentDialog } from "./BookingDialogs";

const statusInfo: Record<BookingStatus, { label: string; variant: "info" | "warning" | "success" | "error" }> = {
  booked: { label: "Ожидаем", variant: "info" },
  arrived: { label: "Принята", variant: "warning" },
  done: { label: "Готова", variant: "success" },
  cancelled: { label: "Отменена", variant: "error" },
};

export function BookingsPage({ bundle }: { bundle: StudioBundle }) {
  const tz = bundle.studio.timezone;
  const studioId = bundle.studio.id;
  const [period, setPeriod] = useState<"day" | "week">("day");
  const [date, setDate] = useState(todayIn(tz));
  const range = useMemo(() => periodRange(date, period, tz), [date, period, tz]);
  const bookings = useOwnerBookings(studioId, range.from, range.to);
  const stats = useStats(studioId, range.from, range.to);
  const ids = (bookings.data ?? []).map((b) => b.id);
  const payments = usePayments(studioId, ids);
  const qc = useQueryClient();

  const [formFor, setFormFor] = useState<OwnerBooking | "new" | null>(null);
  const [payFor, setPayFor] = useState<OwnerBooking | null>(null);
  const [cancelFor, setCancelFor] = useState<OwnerBooking | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["owner-bookings", studioId] });
    qc.invalidateQueries({ queryKey: ["owner-stats", studioId] });
    qc.invalidateQueries({ queryKey: ["owner-payments", studioId] });
  };

  const setStatus = useMutation({
    mutationFn: async ({ b, status }: { b: OwnerBooking; status: BookingStatus }) => {
      const patch: Record<string, unknown> = { status };
      if (status === "cancelled") patch.cancelled_by = "owner";
      const { error } = await supabase.from("bookings").update(patch).eq("id", b.id).eq("studio_id", studioId);
      if (error) throw error;
    },
    onSuccess: () => { setCancelFor(null); refresh(); },
  });

  const shift = (dir: number) => {
    const d = addDays(new Date(`${date}T12:00:00`), dir * (period === "day" ? 1 : 7));
    setDate(formatISO(d, { representation: "date" }));
  };

  const boxName = (id: string) => bundle.boxes.find((b) => b.id === id)?.name ?? "—";
  const paidFor = (id: string) =>
    (payments.data ?? []).filter((p) => p.booking_id === id).reduce((s, p) => s + (p.kind === "payment" ? p.amount : -p.amount), 0);

  const grouped = useMemo(() => {
    const map = new Map<string, OwnerBooking[]>();
    for (const b of bookings.data ?? []) {
      const key = fmt(b.starts_at, tz, "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(b);
    }
    return [...map.entries()];
  }, [bookings.data, tz]);

  const title = period === "day"
    ? fmt(`${range.startDate}T12:00:00Z`, "UTC", "EEEE, d MMMM")
    : `${fmt(`${range.startDate}T12:00:00Z`, "UTC", "d MMM")} — ${fmt(`${formatISO(addDays(new Date(`${range.endDate}T12:00:00`), -1), { representation: "date" })}T12:00:00Z`, "UTC", "d MMM")}`;

  return (
    <VStack gap={5}>
      <HStack justify="between" align="center" wrap="wrap" gap={3}>
        <SegmentedControl label="Период" value={period} onChange={(v) => setPeriod(v as "day" | "week")}>
          <SegmentedControlItem value="day" label="День" />
          <SegmentedControlItem value="week" label="Неделя" />
        </SegmentedControl>
        <Button label="Добавить запись" variant="primary" icon={<Plus size={18} weight="bold" />} onClick={() => setFormFor("new")} />
      </HStack>

      <HStack align="center" gap={2} wrap="wrap" className="admin-date-navigation">
        <Button label="Назад" isIconOnly variant="ghost" icon={<CaretLeft size={18} />} onClick={() => shift(-1)} />
        <Heading level={2}>{title}</Heading>
        <Button label="Вперёд" isIconOnly variant="ghost" icon={<CaretRight size={18} />} onClick={() => shift(1)} />
        <Button label="Сегодня" size="sm" variant="ghost" onClick={() => setDate(todayIn(tz))} />
      </HStack>

      <div className="stats" aria-live="polite">
        <div className="stat"><Text type="supporting">Заездов</Text><b>{stats.data?.visits ?? "—"}</b></div>
        <div className="stat"><Text type="supporting">Завершено работ</Text><b>{stats.data?.completed ?? "—"}</b></div>
        <div className="stat"><Text type="supporting">Получено</Text><b>{stats.data ? rub(stats.data.received - stats.data.refunded) : "—"}</b></div>
        <div className="stat">
          <Text type="supporting">Возвраты / отмены</Text>
          <b>{stats.data ? `${rub(stats.data.refunded)} · ${stats.data.cancelled}` : "—"}</b>
        </div>
      </div>

      {bookings.isError && <Banner status="error" title={dbMessage(bookings.error)} collapsible={false} />}
      {bookings.isLoading && <VStack gap={2}><Skeleton height={96} /><Skeleton height={96} /></VStack>}
      {bookings.data && bookings.data.length === 0 && (
        <EmptyState icon={<CarProfile size={40} />} title="Записей нет" description="На этот период пока никто не записался."
          actions={<Button label="Добавить запись" onClick={() => setFormFor("new")} />} />
      )}

      {grouped.map(([day, list]) => (
        <VStack gap={2} key={day}>
          {period === "week" && <Text type="label" color="secondary">{fmt(`${day}T12:00:00Z`, "UTC", "EEEE, d MMMM")}</Text>}
          {list.map((b) => {
            const st = statusInfo[b.status];
            const paid = paidFor(b.id);
            return (
              <div className="booking-item" data-status={b.status} key={b.id}>
                <HStack gap={3} align="start" justify="between">
                  <VStack gap={1}>
                    <HStack gap={2} align="center" wrap="wrap">
                      <span className="booking-time">{fmt(b.starts_at, tz, "HH:mm")}–{fmt(b.ends_at, tz, fmt(b.ends_at, tz, "yyyy-MM-dd") === day ? "HH:mm" : "d MMM HH:mm")}</span>
                      <Badge variant={st.variant} label={st.label} />
                      {b.source === "manual" && <Badge label="вручную" />}
                    </HStack>
                    <Text weight="semibold">{b.service_name}</Text>
                    <Text type="supporting">
                      {b.client_name} · <a href={`tel:${b.client_phone}`} style={{ color: "inherit" }}>{phoneLabel(b.client_phone)}</a> · {b.car} · {boxName(b.box_id)}
                    </Text>
                    {b.comment && <Text type="supporting">«{b.comment}»</Text>}
                    <Text type="supporting">Цена от {rub(b.price)} · оплачено {rub(paid)}</Text>
                  </VStack>
                  <DropdownMenu
                    alignment="end"
                    presentation="adaptive"
                    button={{ label: `Действия: ${b.client_name}`, isIconOnly: true, variant: "ghost", icon: <DotsThreeVertical size={20} weight="bold" /> }}
                    items={[
                      { label: "Машина принята", isDisabled: b.status !== "booked", onClick: () => setStatus.mutate({ b, status: "arrived" }) },
                      { label: "Машина готова", isDisabled: b.status === "done" || b.status === "cancelled", onClick: () => setStatus.mutate({ b, status: "done" }) },
                      { label: "Перенести", isDisabled: b.status === "cancelled" || b.status === "done", onClick: () => setFormFor(b) },
                      { label: "Оплата или возврат", onClick: () => setPayFor(b) },
                      { label: "Отменить запись", variant: "destructive", isDisabled: b.status === "cancelled" || b.status === "done", onClick: () => setCancelFor(b) },
                    ]}
                  />
                </HStack>
                {b.status === "booked" && (
                  <HStack gap={2} wrap="wrap">
                    <div style={{ marginTop: 10 }}>
                      <Button label="Принять машину" size="sm" onClick={() => setStatus.mutate({ b, status: "arrived" })} isLoading={setStatus.isPending && setStatus.variables?.b.id === b.id} />
                    </div>
                  </HStack>
                )}
                {b.status === "arrived" && (
                  <div style={{ marginTop: 10 }}>
                    <Button label="Готово" size="sm" variant="primary" icon={<CheckCircle size={16} />} onClick={() => setStatus.mutate({ b, status: "done" })} />
                  </div>
                )}
              </div>
            );
          })}
        </VStack>
      ))}
      {setStatus.isError && <Banner status="error" title={dbMessage(setStatus.error)} collapsible={false} />}

      {formFor && (
        <BookingFormDialog bundle={bundle} booking={formFor === "new" ? null : formFor} defaultDate={date}
          onClose={() => setFormFor(null)} onSaved={() => { setFormFor(null); refresh(); }} />
      )}
      {payFor && <PaymentDialog booking={payFor} paid={paidFor(payFor.id)} onClose={() => setPayFor(null)} onSaved={() => { setPayFor(null); refresh(); }} />}
      <AlertDialog
        isOpen={!!cancelFor}
        onOpenChange={(o) => !o && setCancelFor(null)}
        title="Отменить запись?"
        description={cancelFor ? `${cancelFor.client_name}, ${cancelFor.service_name}, ${fmt(cancelFor.starts_at, tz, "d MMMM HH:mm")}. Время освободится.` : ""}
        actionLabel="Отменить запись"
        cancelLabel="Не отменять"
        isActionLoading={setStatus.isPending}
        onAction={() => cancelFor && setStatus.mutate({ b: cancelFor, status: "cancelled" })}
      />
    </VStack>
  );
}
