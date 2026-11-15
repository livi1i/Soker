import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { Button } from "@astryxdesign/core/Button";
import { Selector } from "@astryxdesign/core/Selector";
import { DateInput } from "@astryxdesign/core/DateInput";
import { TextInput } from "@astryxdesign/core/TextInput";
import { TextArea } from "@astryxdesign/core/TextArea";
import { NumberInput } from "@astryxdesign/core/NumberInput";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Banner } from "@astryxdesign/core/Banner";
import { Spinner } from "@astryxdesign/core/Spinner";
import { z } from "zod";
import { clientSchema, fieldErrors } from "@shared/validation";
import { supabase } from "../lib/supabase";
import { durationLabel, fmt, rub } from "../lib/format";
import type { OwnerBooking, StudioBundle } from "../lib/types";
import { dbMessage, endFor, ownerSlots } from "./owner";

export function BookingFormDialog({ bundle, booking, defaultDate, onClose, onSaved }: {
  bundle: StudioBundle;
  booking: OwnerBooking | null;
  defaultDate: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const tz = bundle.studio.timezone;
  const services = bundle.services.filter((s) => s.is_active || s.id === booking?.service_id);
  const [serviceId, setServiceId] = useState(booking?.service_id ?? services[0]?.id ?? "");
  const [date, setDate] = useState(booking ? fmt(booking.starts_at, tz, "yyyy-MM-dd") : defaultDate);
  const [start, setStart] = useState<string | null>(booking?.starts_at ?? null);
  const [box, setBox] = useState<string>("auto");
  const [form, setForm] = useState({
    name: booking?.client_name ?? "",
    phone: booking?.client_phone ?? "",
    car: booking?.car ?? "",
    comment: booking?.comment ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const service = services.find((s) => s.id === serviceId);

  const slots = useQuery({
    queryKey: ["owner-slots", serviceId, date, booking?.id],
    enabled: !!service && !!date,
    queryFn: () => ownerSlots(bundle, service!, date, booking?.id),
  });
  const chosen = slots.data?.slots.find((s) => s.start.toISOString() === (start && new Date(start).toISOString()));
  useEffect(() => setBox("auto"), [start]);

  const save = useMutation({
    mutationFn: async () => {
      if (!service || !chosen) throw new Error("Выберите время");
      const client = clientSchema.parse(form);
      const boxes = box === "auto" ? chosen.freeBoxIds : [box];
      if (boxes.length === 0) throw new Error("В это время все боксы заняты");
      const { end, blockUntil } = endFor(bundle, service, chosen.start);
      const base = {
        service_id: service.id,
        service_name: service.name,
        price: service.price,
        client_name: client.name,
        client_phone: client.phone,
        car: client.car,
        comment: client.comment ?? "",
        starts_at: chosen.start.toISOString(),
        ends_at: end.toISOString(),
        block_until: blockUntil.toISOString(),
      };
      // Если бокс успели занять, база отклонит запись (ограничение bookings_no_overlap) — пробуем следующий свободный.
      let lastError: unknown = null;
      for (const boxId of boxes) {
        const q = booking
          ? supabase.from("bookings").update({ ...base, box_id: boxId }).eq("id", booking.id).eq("studio_id", bundle.studio.id)
          : supabase.from("bookings").insert({ ...base, box_id: boxId, studio_id: bundle.studio.id, source: "manual", status: "booked" });
        const { error } = await q;
        if (!error) return;
        lastError = error;
        if ((error as { code?: string }).code !== "23P01") break;
      }
      throw lastError;
    },
    onSuccess: onSaved,
  });

  const submit = () => {
    const r = clientSchema.safeParse(form);
    if (!r.success) return setErrors(fieldErrors(r.error));
    setErrors({});
    save.mutate();
  };

  return (
    <Dialog isOpen className="admin-form-dialog" onOpenChange={(o) => !o && onClose()} width={560} maxHeight="90dvh" purpose="form">
      <DialogHeader title={booking ? "Перенести запись" : "Новая запись"} subtitle={booking ? `${booking.client_name} · ${booking.service_name}` : "Запись по телефону или на месте"} onOpenChange={(o) => !o && onClose()} />
      <VStack gap={4} padding={4} className="admin-dialog-body">
        <Selector label="Услуга" value={serviceId} hasSearch searchPlaceholder="Найти услугу"
          onChange={(v) => { setServiceId(v ?? ""); setStart(null); }}
          options={services.map((s) => ({ value: s.id, label: s.name, description: `${rub(s.price)} · ${durationLabel(s.duration_minutes, s.duration_days)}` }))} />
        <DateInput label="Дата" value={date as never} onChange={(v) => { if (v) { setDate(v); setStart(null); } }} />
        <VStack gap={2}>
          <Text type="label">Время</Text>
          {slots.isLoading && <Spinner />}
          {slots.data && !slots.data.isOpen && <Text type="supporting">Студия в этот день не работает.</Text>}
          {slots.data?.isOpen && slots.data.slots.length === 0 && <Text type="supporting">На этот день времени не осталось.</Text>}
          <div className="slots" role="group" aria-label="Время">
            {slots.data?.slots.map((s) => {
              const iso = s.start.toISOString();
              const busy = s.freeBoxIds.length === 0;
              return (
                <button key={iso} type="button" className="slot" data-busy={busy} aria-disabled={busy}
                  aria-pressed={!!start && new Date(start).toISOString() === iso}
                  onClick={() => !busy && setStart(iso)}>
                  <span className="slot__time">{fmt(s.start, tz, "HH:mm")}</span>
                  {busy && <small>занято</small>}
                </button>
              );
            })}
          </div>
        </VStack>
        {chosen && (
          <Selector label="Бокс" value={box} onChange={(v) => setBox(v ?? "auto")}
            options={[{ value: "auto", label: "Любой свободный" }, ...bundle.boxes.filter((b) => chosen.freeBoxIds.includes(b.id)).map((b) => ({ value: b.id, label: b.name }))]} />
        )}
        <TextInput label="Имя клиента" value={form.name} onChange={(v) => setForm({ ...form, name: v })}
          status={errors.name ? { type: "error", message: errors.name } : undefined} statusVariant="detached" />
        <TextInput label="Телефон" type="tel" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} inputMode="tel"
          status={errors.phone ? { type: "error", message: errors.phone } : undefined} statusVariant="detached" />
        <TextInput label="Автомобиль" value={form.car} onChange={(v) => setForm({ ...form, car: v })}
          status={errors.car ? { type: "error", message: errors.car } : undefined} statusVariant="detached" />
        <TextArea label="Комментарий" rows={2} value={form.comment} onChange={(v) => setForm({ ...form, comment: v })} />
        {save.isError && <Banner status="error" title={save.error instanceof Error && !("code" in save.error) ? save.error.message : dbMessage(save.error)} collapsible={false} />}
        <HStack gap={2} justify="end">
          <Button label="Отмена" variant="ghost" onClick={onClose} />
          <Button label={booking ? "Перенести" : "Записать"} variant="primary" isDisabled={!chosen} isLoading={save.isPending} onClick={submit} />
        </HStack>
      </VStack>
    </Dialog>
  );
}

const paymentSchema = z.object({
  kind: z.enum(["payment", "refund"]),
  amount: z.number({ message: "Введите сумму" }).int("Целое число рублей").positive("Сумма больше нуля").max(10_000_000),
  method: z.enum(["card", "cash", "sbp", "transfer"]),
  note: z.string().max(200),
});

export function PaymentDialog({ booking, paid, onClose, onSaved }: { booking: OwnerBooking; paid: number; onClose: () => void; onSaved: () => void }) {
  const [kind, setKind] = useState<"payment" | "refund">("payment");
  const [amount, setAmount] = useState<number | null>(Math.max(0, booking.price - paid) || null);
  const [method, setMethod] = useState<"card" | "cash" | "sbp" | "transfer">("card");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const r = paymentSchema.safeParse({ kind, amount: amount ?? undefined, method, note });
      if (!r.success) throw new Error(r.error.issues[0].message);
      if (r.data.kind === "refund" && r.data.amount > paid) throw new Error(`Вернуть можно не больше полученного: ${rub(paid)}`);
      const { error } = await supabase.from("payments").insert({ ...r.data, booking_id: booking.id, studio_id: booking.studio_id });
      if (error) throw new Error(dbMessage(error));
    },
    onSuccess: onSaved,
    onError: (e) => setError((e as Error).message),
  });

  return (
    <Dialog isOpen className="admin-form-dialog" onOpenChange={(o) => !o && onClose()} width={460} maxHeight="90dvh" purpose="form">
      <DialogHeader title="Оплата или возврат" subtitle={`${booking.client_name} · ${booking.service_name} · получено ${rub(paid)}`} onOpenChange={(o) => !o && onClose()} />
      <VStack gap={4} padding={4} className="admin-dialog-body">
        <SegmentedControl label="Тип" value={kind} onChange={(v) => setKind(v as "payment" | "refund")} layout="fill">
          <SegmentedControlItem value="payment" label="Оплата" />
          <SegmentedControlItem value="refund" label="Возврат" />
        </SegmentedControl>
        <NumberInput label="Сумма, ₽" value={amount} onChange={setAmount} min={1} step={100} />
        <Selector label="Способ" value={method} onChange={(v) => setMethod((v ?? "card") as typeof method)}
          options={[{ value: "card", label: "Карта" }, { value: "sbp", label: "СБП" }, { value: "cash", label: "Наличные" }, { value: "transfer", label: "Перевод" }]} />
        <TextInput label="Примечание" value={note} onChange={setNote} />
        {error && <Banner status="error" title={error} collapsible={false} />}
        <HStack gap={2} justify="end">
          <Button label="Отмена" variant="ghost" onClick={onClose} />
          <Button label={kind === "payment" ? "Внести оплату" : "Оформить возврат"} variant={kind === "payment" ? "primary" : "destructive"} isLoading={save.isPending} onClick={() => { setError(null); save.mutate(); }} />
        </HStack>
      </VStack>
    </Dialog>
  );
}
