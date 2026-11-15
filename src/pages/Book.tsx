import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatInTimeZone } from "date-fns-tz";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { Heading } from "@astryxdesign/core/Heading";
import { Button } from "@astryxdesign/core/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import { TextArea } from "@astryxdesign/core/TextArea";
import { Banner } from "@astryxdesign/core/Banner";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { ArrowLeft, CheckCircle } from "@phosphor-icons/react";
import { clientSchema, fieldErrors } from "@shared/validation";
import { useTenant } from "../components/TenantLayout";
import { api, ApiError } from "../lib/api";
import { dayLabel, durationLabel, fmt, fullDateTime, priceLabel, timeLabel } from "../lib/format";
import { saveBooking } from "../lib/myBookings";
import type { AvailabilitySlot, Service } from "../lib/types";
import { groupByCategory } from "./Home";

type Step = "service" | "time" | "contacts" | "confirm";
const STEPS: Step[] = ["service", "time", "contacts", "confirm"];
const DRAFT_KEY = "booking-contacts";

export function BookPage({ embedded = false }: { embedded?: boolean }) {
  const { bundle, slug, online } = useTenant();
  const { studio } = bundle;
  const tz = studio.timezone;
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const services = bundle.services.filter((s) => s.is_active);
  const [modalServiceId, setModalServiceId] = useState<string | null>(null);
  const service = services.find((s) => s.id === (embedded ? modalServiceId : params.get("service"))) ?? null;
  const [step, setStep] = useState<Step>(service ? "time" : "service");
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<AvailabilitySlot | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState(() => {
    try {
      return { name: "", phone: "", car: "", comment: "", ...JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}") };
    } catch {
      return { name: "", phone: "", car: "", comment: "" };
    }
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Один ключ на одну попытку записи: повторное нажатие «Подтвердить» вернёт ту же запись, а не создаст копию.
  const attemptKey = useRef<string>(crypto.randomUUID());

  const today = formatInTimeZone(new Date(), tz, "yyyy-MM-dd");
  const days = Math.min(31, studio.horizon_days + 1);
  const availability = useQuery({
    queryKey: ["availability", slug, service?.id, today, days],
    queryFn: () => api.availability(slug, service!.id, today, days),
    enabled: !!service && step !== "service",
    staleTime: 20_000,
    refetchInterval: step === "time" ? 60_000 : false,
    networkMode: "online",
  });

  const dayList = availability.data?.days ?? [];
  const firstFree = dayList.find((d) => d.slots.some((s) => s.free))?.date ?? null;
  useEffect(() => {
    if (!date && firstFree) setDate(firstFree);
  }, [firstFree, date]);
  const currentDay = dayList.find((d) => d.date === date);

  const book = useMutation({
    mutationFn: () => {
      const parsed = clientSchema.parse(form);
      return api.book({ slug, serviceId: service!.id, start: slot!.start, idempotencyKey: attemptKey.current, client: parsed });
    },
    onSuccess: ({ booking }) => {
      saveBooking(slug, { token: booking.token, startsAt: booking.startsAt, serviceName: booking.serviceName });
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify({ name: form.name, phone: form.phone, car: form.car }));
      } catch { /* необязательно */ }
      qc.invalidateQueries({ queryKey: ["availability", slug] });
      navigate(`/s/${slug}/my?t=${booking.token}&new=1`, { replace: true });
    },
    onError: (e) => {
      if (e instanceof ApiError && (e.code === "slot_taken" || e.code === "slot_invalid")) {
        setNotice(e.message);
        setSlot(null);
        attemptKey.current = crypto.randomUUID();
        setStep("time");
        availability.refetch();
      } else if (e instanceof ApiError && e.fields) {
        setErrors(Object.fromEntries(Object.entries(e.fields).map(([k, v]) => [k.replace(/^client\./, ""), v])));
        setStep("contacts");
      }
    },
  });

  const chooseService = (s: Service) => {
    if (embedded) setModalServiceId(s.id);
    else setParams({ service: s.id }, { replace: true });
    setDate(null);
    setSlot(null);
    setNotice(null);
    attemptKey.current = crypto.randomUUID();
    setStep("time");
  };

  const goContacts = () => {
    if (!slot) return;
    setStep("contacts");
  };

  const submitContacts = () => {
    const r = clientSchema.safeParse(form);
    if (!r.success) {
      setErrors(fieldErrors(r.error));
      return;
    }
    setErrors({});
    setStep("confirm");
  };

  const back = () => {
    const i = STEPS.indexOf(step);
    if (i > 0) setStep(STEPS[i - 1]);
  };

  const stepIndex = STEPS.indexOf(step);
  const multiDay = service ? service.duration_days > 0 : false;

  return (
    <div className="container" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 28px)", maxWidth: 760 }}>
      {!embedded && <nav className="page-back-links" aria-label="Вернуться">
        <Link to={`/s/${slug}/services${service ? "?c=" + encodeURIComponent(service.category) : ""}`}><ArrowLeft size={18} aria-hidden />Назад к услугам</Link>
        <Link to={`/s/${slug}/`}>На главную</Link>
      </nav>}
      <span className="eyebrow">{studio.name}</span>
      {/* Заметный заголовок над карточкой записи */}
      <h1 className="book-title">Запись в студию</h1>
      <Text type="supporting" as="p" display="block">
        {studio.address} · без регистрации, подтверждение сразу
      </Text>

      <div className="book-card" style={{ marginTop: 18 }}>
        <div className="steps" aria-hidden>
          {STEPS.map((s, i) => <span key={s} data-done={i <= stepIndex} />)}
        </div>

        {step !== "service" && (
          <HStack gap={2} align="center" justify="between" wrap="wrap">
            <Button label="Назад" variant="ghost" size="sm" icon={<ArrowLeft size={16} />} onClick={back} />
            <Text type="supporting">Шаг {stepIndex + 1} из 4</Text>
          </HStack>
        )}

        {/* ── 1. Услуга ── */}
        {step === "service" && (
          <VStack gap={4}>
            <Heading level={2}>Выберите услугу</Heading>
            {groupByCategory(services).map(([cat, list]) => (
              <VStack gap={2} key={cat}>
                <Text type="label" color="secondary">{cat}</Text>
                <div className="option-list">
                  {list.map((s) => (
                    <button key={s.id} type="button" className="option" aria-pressed={service?.id === s.id} onClick={() => chooseService(s)}>
                      <Text weight="semibold">{s.name}</Text>
                      <Text weight="bold">{priceLabel(s.price, s.price_from)}</Text>
                      <Text type="supporting">{durationLabel(s.duration_minutes, s.duration_days)}</Text>
                    </button>
                  ))}
                </div>
              </VStack>
            ))}
          </VStack>
        )}

        {/* ── 2. Дата и время ── */}
        {step === "time" && service && (
          <VStack gap={4}>
            <VStack gap={1}>
              <Heading level={2}>Дата и время</Heading>
              <Text type="supporting">
                {service.name} · {durationLabel(service.duration_minutes, service.duration_days)} · {priceLabel(service.price, service.price_from)}
              </Text>
            </VStack>
            {notice && <Banner status="warning" title={notice} collapsible={false} />}
            {!online && <Banner status="info" title="Нет интернета" description="Свободное время появится, когда устройство подключится к сети." collapsible={false} />}
            {availability.isError && (
              <Banner status="error" title="Не удалось загрузить время" description={(availability.error as Error).message}
                endContent={<Button label="Повторить" size="sm" onClick={() => availability.refetch()} />} collapsible={false} />
            )}
            {availability.isLoading && (
              <VStack gap={3}>
                <Skeleton height={72} />
                <Skeleton height={120} />
              </VStack>
            )}
            {availability.data && (
              <>
                {!availability.data.bookable && (
                  <Banner status="warning" title="Это образец студии" description="Время показано для примера, запись откроется после проверки." collapsible={false} />
                )}
                <div className="days" role="group" aria-label="Дата">
                  {dayList.map((d) => {
                    const free = d.slots.filter((s) => s.free).length;
                    const disabled = !d.isOpen || d.slots.length === 0;
                    return (
                      <button
                        key={d.date}
                        type="button"
                        className="day"
                        aria-pressed={d.date === date}
                        disabled={disabled}
                        onClick={() => { setDate(d.date); setSlot(null); }}
                        aria-label={`${fmt(`${d.date}T12:00:00Z`, "UTC", "EEEE, d MMMM")}${!d.isOpen ? ", выходной" : free ? `, свободно ${free}` : ", всё занято"}`}
                      >
                        <small>{fmt(`${d.date}T12:00:00Z`, "UTC", "EEEEEE")}</small>
                        <b>{Number(d.date.slice(8))}</b>
                        {free > 0 ? <span className="free-dot" aria-hidden /> : <small aria-hidden>{d.isOpen ? "занято" : "вых."}</small>}
                      </button>
                    );
                  })}
                </div>
                {currentDay && (
                  <VStack gap={3}>
                    <HStack justify="between" align="center" wrap="wrap" gap={2}>
                      <Text weight="semibold">{dayLabel(`${currentDay.date}T12:00:00Z`, tz)}, {fmt(`${currentDay.date}T12:00:00Z`, "UTC", "d MMMM")}</Text>
                      <div className="legend" aria-hidden>
                        <span><i /> свободно</span>
                        <span><i className="busy" /> занято</span>
                      </div>
                    </HStack>
                    {currentDay.slots.length === 0 ? (
                      <Text type="supporting">На этот день записаться уже нельзя. Выберите другую дату.</Text>
                    ) : (
                      <div className="slots" role="group" aria-label="Время">
                        {currentDay.slots.map((s) => (
                          <button
                            key={s.start}
                            type="button"
                            className="slot"
                            data-busy={!s.free}
                            aria-pressed={slot?.start === s.start}
                            aria-disabled={!s.free}
                            aria-label={`${timeLabel(s.start, tz)}${s.free ? "" : ", занято"}`}
                            onClick={() => s.free && setSlot(s)}
                          >
                            <span className="slot__time">{timeLabel(s.start, tz)}</span>
                            {!s.free && <small>занято</small>}
                          </button>
                        ))}
                      </div>
                    )}
                    {multiDay && slot && (
                      <Text type="supporting">Машина останется в боксе до {fullDateTime(slot.end, tz)}.</Text>
                    )}
                  </VStack>
                )}
                {!firstFree && dayList.length > 0 && (
                  <Text type="supporting">Свободного времени на ближайшие дни нет. Позвоните нам — постараемся помочь.</Text>
                )}
              </>
            )}
            <div className="sticky-actions">
              <Button label={slot ? `Дальше: ${timeLabel(slot.start, tz)}` : "Выберите время"} variant="primary" size="lg" width="100%" isDisabled={!slot} onClick={goContacts} />
            </div>
          </VStack>
        )}

        {/* ── 3. Контакты ── */}
        {step === "contacts" && (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              submitContacts();
            }}
          >
            <VStack gap={4}>
              <Heading level={2}>Ваши данные</Heading>
              <TextInput label="Имя" value={form.name} onChange={(v) => setForm({ ...form, name: v })} autoComplete="name" autoCapitalize="words"
                isRequired status={errors.name ? { type: "error", message: errors.name } : undefined} statusVariant="detached" enterKeyHint="next" />
              <TextInput label="Телефон" type="tel" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} autoComplete="tel"
                inputMode="tel" placeholder="+7 900 000-00-00" isRequired description="Позвоним, если что-то изменится"
                status={errors.phone ? { type: "error", message: errors.phone } : undefined} statusVariant="detached" enterKeyHint="next" />
              <TextInput label="Автомобиль" value={form.car} onChange={(v) => setForm({ ...form, car: v })} placeholder="Например, Kia Rio, белый"
                isRequired status={errors.car ? { type: "error", message: errors.car } : undefined} statusVariant="detached" enterKeyHint="next" />
              <TextArea label="Комментарий" value={form.comment} onChange={(v) => setForm({ ...form, comment: v })} rows={2} maxLength={500}
                placeholder="Пожелания к работе" status={errors.comment ? { type: "error", message: errors.comment } : undefined} />
              <Button label="Проверить запись" type="submit" variant="primary" size="lg" width="100%" />
            </VStack>
          </form>
        )}

        {/* ── 4. Подтверждение ── */}
        {step === "confirm" && service && slot && (
          <VStack gap={4}>
            <Heading level={2}>Проверьте и подтвердите</Heading>
            <dl className="summary">
              <div><dt>Услуга</dt><dd>{service.name}</dd></div>
              <div><dt>Когда</dt><dd>{fullDateTime(slot.start, tz)}</dd></div>
              {multiDay && <div><dt>Готово</dt><dd>{fullDateTime(slot.end, tz)}</dd></div>}
              <div><dt>Стоимость</dt><dd>{priceLabel(service.price, service.price_from)}</dd></div>
              <div><dt>Имя</dt><dd>{form.name}</dd></div>
              <div><dt>Телефон</dt><dd>{form.phone}</dd></div>
              <div><dt>Автомобиль</dt><dd>{form.car}</dd></div>
              {form.comment && <div><dt>Комментарий</dt><dd>{form.comment}</dd></div>}
              <div><dt>Адрес</dt><dd>{studio.address}</dd></div>
            </dl>
            <Text type="supporting">
              Отменить запись онлайн можно не позже чем за {studio.cancel_hours} ч до начала.
            </Text>
            {book.isError && !(book.error instanceof ApiError && ["slot_taken", "slot_invalid"].includes(book.error.code)) && (
              <Banner status="error" title={(book.error as Error).message} collapsible={false} />
            )}
            <Button
              label="Подтвердить запись"
              variant="primary"
              size="lg"
              width="100%"
              icon={<CheckCircle size={20} weight="bold" />}
              isLoading={book.isPending}
              isDisabled={!online}
              onClick={() => { if (!book.isPending) book.mutate(); }}
            />
          </VStack>
        )}
      </div>
    </div>
  );
}

export function useServiceById(id: string | null) {
  const { bundle } = useTenant();
  return useMemo(() => bundle.services.find((s) => s.id === id) ?? null, [bundle, id]);
}
