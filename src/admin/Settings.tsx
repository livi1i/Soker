import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { VStack } from "@astryxdesign/core/VStack";
import { HStack } from "@astryxdesign/core/HStack";
import { Grid } from "@astryxdesign/core/Grid";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { Button } from "@astryxdesign/core/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import { TextArea } from "@astryxdesign/core/TextArea";
import { NumberInput } from "@astryxdesign/core/NumberInput";
import { Selector } from "@astryxdesign/core/Selector";
import { Switch } from "@astryxdesign/core/Switch";
import { TimeInput } from "@astryxdesign/core/TimeInput";
import { DateInput } from "@astryxdesign/core/DateInput";
import { FileInput } from "@astryxdesign/core/FileInput";
import { Banner } from "@astryxdesign/core/Banner";
import { Divider } from "@astryxdesign/core/Divider";
import { Badge } from "@astryxdesign/core/Badge";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { AlertDialog } from "@astryxdesign/core/AlertDialog";
import { Plus, Trash } from "@phosphor-icons/react";
import { normalizePhone } from "@shared/validation";
import { mediaUrl, supabase } from "../lib/supabase";
import { studioKey } from "../lib/api";
import { durationLabel, rub, weekdayNames } from "../lib/format";
import type { InfoCard, Service, StudioBundle } from "../lib/types";
import { cardIconLabels, cardIcons } from "../components/icons";
import { dbMessage, removeImage, uploadImage } from "./owner";
import { GallerySettings } from "./GallerySettings";

export function useSaver(slug: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: studioKey(slug) });
}

export function Block({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section id={id} style={{ scrollMarginTop: 120 }}>
      <VStack gap={4}>
        <VStack gap={1}>
          <Heading level={2}>{title}</Heading>
          {description && <Text type="supporting">{description}</Text>}
        </VStack>
        {children}
      </VStack>
      <div style={{ marginBlock: 28 }}><Divider /></div>
    </section>
  );
}

export function Result({ m }: { m: { isError: boolean; isSuccess: boolean; error: unknown } }) {
  if (m.isError) return <Banner status="error" title={dbMessage(m.error)} collapsible={false} />;
  if (m.isSuccess) return <Banner status="success" title="Сохранено" collapsible={false} />;
  return null;
}

const sections = [
  ["studio", "Студия"], ["media", "Логотип и фото"], ["cards", "Карточки"], ["services", "Услуги"],
  ["boxes", "Боксы"], ["hours", "Часы работы"], ["daysoff", "Выходные"], ["gallery", "Фото работ"],
] as const;

export function SettingsPage({ bundle }: { bundle: StudioBundle }) {
  return (
    <VStack gap={2}>
      <nav className="chips" aria-label="Разделы настроек" style={{ marginBottom: 16 }}>
        {sections.map(([id, label]) => (
          <a key={id} className="chip" href={`#${id}`} style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>{label}</a>
        ))}
      </nav>
      <StudioSettings bundle={bundle} />
      <MediaSettings bundle={bundle} />
      <CardsSettings bundle={bundle} />
      <ServicesSettings bundle={bundle} />
      <BoxesSettings bundle={bundle} />
      <HoursSettings bundle={bundle} />
      <DaysOffSettings bundle={bundle} />
      <GallerySettings bundle={bundle} />
    </VStack>
  );
}

// ───────── Студия ─────────
const studioSchema = z.object({
  name: z.string().trim().min(2, "Не короче 2 символов").max(60),
  tagline: z.string().trim().max(120),
  description: z.string().trim().max(600),
  address: z.string().trim().min(5, "Укажите адрес"),
  city: z.string().trim().max(60),
  phone: z.string().transform((v, ctx) => normalizePhone(v) ?? (ctx.addIssue({ code: "custom", message: "Телефон в формате +7…" }), z.NEVER)),
  lat: z.number().min(-90).max(90).nullable(),
  lon: z.number().min(-180).max(180).nullable(),
  slot_step_minutes: z.number().int().min(10).max(120),
  buffer_minutes: z.number().int().min(0).max(240),
  lead_minutes: z.number().int().min(0).max(2880),
  horizon_days: z.number().int().min(1).max(90),
  cancel_hours: z.number().int().min(0).max(168),
});

function StudioSettings({ bundle }: { bundle: StudioBundle }) {
  const s = bundle.studio;
  const refresh = useSaver(s.slug);
  const [v, setV] = useState({
    name: s.name, tagline: s.tagline, description: s.description, address: s.address, city: s.city, phone: s.phone,
    lat: s.lat, lon: s.lon, slot_step_minutes: s.slot_step_minutes, buffer_minutes: s.buffer_minutes,
    lead_minutes: s.lead_minutes, horizon_days: s.horizon_days, cancel_hours: s.cancel_hours,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: async () => {
      const r = studioSchema.safeParse(v);
      if (!r.success) {
        setErrors(Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message])));
        throw new Error("Проверьте поля");
      }
      setErrors({});
      const { error } = await supabase.from("studios").update(r.data).eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });
  const err = (k: string) => (errors[k] ? { type: "error" as const, message: errors[k] } : undefined);
  const num = (k: keyof typeof v) => (n: number) => setV({ ...v, [k]: n });

  return (
    <Block id="studio" title="Студия" description="Название, адрес и правила записи">
      <Grid columns={{ minWidth: 260 }} gap={4}>
        <TextInput label="Название" value={v.name} onChange={(x) => setV({ ...v, name: x })} status={err("name")} statusVariant="detached" />
        <TextInput label="Подзаголовок" value={v.tagline} onChange={(x) => setV({ ...v, tagline: x })} />
        <TextInput label="Телефон" type="tel" value={v.phone} onChange={(x) => setV({ ...v, phone: x })} status={err("phone")} statusVariant="detached" />
        <TextInput label="Адрес" value={v.address} onChange={(x) => setV({ ...v, address: x })} status={err("address")} statusVariant="detached" />
        <TextInput label="Город" value={v.city} onChange={(x) => setV({ ...v, city: x })} />
        <NumberInput label="Широта (для карты)" value={v.lat} onChange={num("lat")} step={0.0001} />
        <NumberInput label="Долгота (для карты)" value={v.lon} onChange={num("lon")} step={0.0001} />
      </Grid>
      <TextArea label="Описание на главной" value={v.description} onChange={(x) => setV({ ...v, description: x })} maxLength={600} rows={3} />
      <Grid columns={{ minWidth: 200 }} gap={4}>
        <NumberInput label="Шаг времени, мин" value={v.slot_step_minutes} onChange={num("slot_step_minutes")} min={10} max={120} step={5} />
        <NumberInput label="Подготовка бокса, мин" description="Пауза между машинами" value={v.buffer_minutes} onChange={num("buffer_minutes")} min={0} max={240} step={5} />
        <NumberInput label="Запись не раньше чем через, мин" value={v.lead_minutes} onChange={num("lead_minutes")} min={0} max={2880} step={15} />
        <NumberInput label="Открыта запись на, дней" value={v.horizon_days} onChange={num("horizon_days")} min={1} max={90} />
        <NumberInput label="Отмена клиентом не позже, ч" value={v.cancel_hours} onChange={num("cancel_hours")} min={0} max={168} />
      </Grid>
      <Result m={save} />
      <div><Button label="Сохранить" variant="primary" isLoading={save.isPending} onClick={() => save.mutate()} /></div>
    </Block>
  );
}

// ───────── Логотип и главное фото ─────────
function MediaSettings({ bundle }: { bundle: StudioBundle }) {
  const s = bundle.studio;
  const refresh = useSaver(s.slug);
  const replace = useMutation({
    mutationFn: async ({ field, file }: { field: "logo_path" | "hero_path"; file: File }) => {
      const path = await uploadImage(s.id, field === "logo_path" ? "logo" : "hero", file);
      const old = s[field];
      const { error } = await supabase.from("studios").update({ [field]: path }).eq("id", s.id);
      if (error) {
        await removeImage(s.id, path);
        throw error;
      }
      await removeImage(s.id, old);
    },
    onSuccess: refresh,
  });
  const [heroPos, setHeroPos] = useState(s.hero_position);
  const savePos = useMutation({
    mutationFn: async () => {
      if (!/^\d{1,3}% \d{1,3}%$/.test(heroPos)) throw new Error("Формат: «30% 50%»");
      const { error } = await supabase.from("studios").update({ hero_position: heroPos }).eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  return (
    <Block id="media" title="Логотип и главное фото" description="Фото уменьшается автоматически. Логотип лучше в PNG с прозрачным фоном.">
      <Grid columns={{ minWidth: 280 }} gap={6}>
        <VStack gap={3}>
          <Text type="label">Логотип</Text>
          <div style={{ background: "#000", borderRadius: 12, padding: 16, maxWidth: 320 }}>
            {s.logo_path ? <img src={mediaUrl(s.logo_path)} alt="Логотип" style={{ maxHeight: 80, maxWidth: "100%" }} /> : <Text type="supporting">Не загружен</Text>}
          </div>
          <FileInput label="Загрузить логотип" accept="image/png,image/jpeg,image/webp" value={null} maxSize={8_000_000}
            isLoading={replace.isPending && replace.variables?.field === "logo_path"}
            onChange={(f) => f && !Array.isArray(f) && replace.mutate({ field: "logo_path", file: f })} />
        </VStack>
        <VStack gap={3}>
          <Text type="label">Главное фото</Text>
          {s.hero_path && <img className="thumb" src={mediaUrl(s.hero_path)} alt="Главное фото" style={{ objectPosition: s.hero_position }} />}
          <FileInput label="Заменить главное фото" accept="image/jpeg,image/png,image/webp" value={null} maxSize={8_000_000}
            isLoading={replace.isPending && replace.variables?.field === "hero_path"}
            onChange={(f) => f && !Array.isArray(f) && replace.mutate({ field: "hero_path", file: f })} />
          <HStack gap={2} align="end">
            <TextInput label="Положение кадра" description="По горизонтали и вертикали, например «20% 50%»" value={heroPos} onChange={setHeroPos} />
            <Button label="Применить" onClick={() => savePos.mutate()} isLoading={savePos.isPending} />
          </HStack>
        </VStack>
      </Grid>
      <Result m={replace} />
      {savePos.isError && <Banner status="error" title={(savePos.error as Error).message} collapsible={false} />}
    </Block>
  );
}

// ───────── Три карточки ─────────
const cardSchema = z.object({ icon: z.string(), title: z.string().trim().min(2, "Заголовок короче 2 символов").max(40), text: z.string().trim().max(140) });

function CardsSettings({ bundle }: { bundle: StudioBundle }) {
  const s = bundle.studio;
  const refresh = useSaver(s.slug);
  const initial: InfoCard[] = [0, 1, 2].map((i) => s.info_cards[i] ?? { icon: "Sparkle", title: "", text: "" });
  const [cards, setCards] = useState(initial);
  const save = useMutation({
    mutationFn: async () => {
      const r = z.array(cardSchema).length(3).safeParse(cards);
      if (!r.success) throw new Error(r.error.issues[0].message);
      const { error } = await supabase.from("studios").update({ info_cards: r.data }).eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });
  const set = (i: number, patch: Partial<InfoCard>) => setCards(cards.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  return (
    <Block id="cards" title="Карточки на главной" description="Три коротких преимущества под главным фото">
      <Grid columns={{ minWidth: 260 }} gap={4}>
        {cards.map((c, i) => (
          <div className="booking-item" key={i}>
            <VStack gap={3}>
              <Text type="label">Карточка {i + 1}</Text>
              <Selector label="Иконка" value={c.icon} onChange={(v) => set(i, { icon: v ?? "Sparkle" })}
                options={Object.keys(cardIcons).map((k) => ({ value: k, label: cardIconLabels[k] ?? k }))} />
              <TextInput label="Заголовок" value={c.title} onChange={(v) => set(i, { title: v })} />
              <TextArea label="Текст" value={c.text} onChange={(v) => set(i, { text: v })} rows={2} maxLength={140} />
            </VStack>
          </div>
        ))}
      </Grid>
      {save.isError && <Banner status="error" title={save.error instanceof Error ? save.error.message : dbMessage(save.error)} collapsible={false} />}
      {save.isSuccess && <Banner status="success" title="Сохранено" collapsible={false} />}
      <div><Button label="Сохранить карточки" variant="primary" isLoading={save.isPending} onClick={() => save.mutate()} /></div>
    </Block>
  );
}

// ───────── Услуги ─────────
const serviceSchema = z.object({
  category: z.string().trim().min(2, "Укажите категорию").max(40),
  name: z.string().trim().min(2, "Укажите название").max(80),
  description: z.string().trim().max(300),
  price: z.number({ message: "Укажите цену" }).int().min(0),
  price_from: z.boolean(),
  duration_minutes: z.number().int().min(0).max(720),
  duration_days: z.number().int().min(0).max(30),
  is_active: z.boolean(),
}).refine((s) => s.duration_days > 0 || s.duration_minutes >= 10, { message: "Длительность — от 10 минут или в днях", path: ["duration_minutes"] });

function ServicesSettings({ bundle }: { bundle: StudioBundle }) {
  const [edit, setEdit] = useState<Service | "new" | null>(null);
  const [del, setDel] = useState<Service | null>(null);
  const refresh = useSaver(bundle.studio.slug);
  const remove = useMutation({
    mutationFn: async (s: Service) => {
      const { error } = await supabase.from("services").delete().eq("id", s.id).eq("studio_id", bundle.studio.id);
      if (error) throw error;
    },
    onSuccess: () => { setDel(null); refresh(); },
  });
  return (
    <Block id="services" title="Услуги и цены" description="Цена, длительность и видимость на сайте. Многодневные работы занимают бокс целиком.">
      <div><Button label="Добавить услугу" icon={<Plus size={16} />} onClick={() => setEdit("new")} /></div>
      <VStack gap={2}>
        {bundle.services.map((s) => (
          <button key={s.id} type="button" className="option" onClick={() => setEdit(s)}>
            <Text weight="semibold">{s.name} {!s.is_active && <Badge label="скрыта" />}</Text>
            <Text weight="bold">{s.price_from ? "от " : ""}{rub(s.price)}</Text>
            <Text type="supporting">{s.category} · {durationLabel(s.duration_minutes, s.duration_days)}</Text>
          </button>
        ))}
      </VStack>
      {edit && <ServiceDialog bundle={bundle} service={edit === "new" ? null : edit} onClose={() => setEdit(null)} onDelete={(s) => { setEdit(null); setDel(s); }} />}
      <AlertDialog isOpen={!!del} onOpenChange={(o) => !o && setDel(null)} title="Удалить услугу?"
        description={`«${del?.name}» исчезнет с сайта. Уже созданные записи сохранятся.`} actionLabel="Удалить" cancelLabel="Оставить"
        isActionLoading={remove.isPending} onAction={() => del && remove.mutate(del)} />
    </Block>
  );
}

function ServiceDialog({ bundle, service, onClose, onDelete }: { bundle: StudioBundle; service: Service | null; onClose: () => void; onDelete: (s: Service) => void }) {
  const refresh = useSaver(bundle.studio.slug);
  const categories = [...new Set(bundle.services.map((s) => s.category))];
  const [v, setV] = useState({
    category: service?.category ?? categories[0] ?? "", name: service?.name ?? "", description: service?.description ?? "",
    price: service?.price ?? 0, price_from: service?.price_from ?? true, duration_minutes: service?.duration_minutes ?? 60,
    duration_days: service?.duration_days ?? 0, is_active: service?.is_active ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: async () => {
      const r = serviceSchema.safeParse(v);
      if (!r.success) {
        setErrors(Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message])));
        throw new Error("Проверьте поля");
      }
      const q = service
        ? supabase.from("services").update(r.data).eq("id", service.id).eq("studio_id", bundle.studio.id)
        : supabase.from("services").insert({ ...r.data, studio_id: bundle.studio.id, sort: bundle.services.length });
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => { refresh(); onClose(); },
  });
  const err = (k: string) => (errors[k] ? { type: "error" as const, message: errors[k] } : undefined);
  const multi = v.duration_days > 0;
  return (
    <Dialog isOpen className="admin-form-dialog" onOpenChange={(o) => !o && onClose()} width={520} maxHeight="90dvh" purpose="form">
      <DialogHeader title={service ? "Услуга" : "Новая услуга"} onOpenChange={(o) => !o && onClose()} />
      <VStack gap={4} padding={4} className="admin-dialog-body">
        <TextInput label="Категория" value={v.category} onChange={(x) => setV({ ...v, category: x })} description={categories.length ? `Есть: ${categories.join(", ")}` : undefined} status={err("category")} statusVariant="detached" />
        <TextInput label="Название" value={v.name} onChange={(x) => setV({ ...v, name: x })} status={err("name")} statusVariant="detached" />
        <TextArea label="Описание" value={v.description} onChange={(x) => setV({ ...v, description: x })} rows={2} maxLength={300} />
        <HStack gap={3} wrap="wrap" align="end">
          <NumberInput label="Цена, ₽" value={v.price} onChange={(n) => setV({ ...v, price: n })} min={0} step={100} status={err("price")} />
          <Switch label="Цена «от»" value={v.price_from} onChange={(x) => setV({ ...v, price_from: x })} />
        </HStack>
        <Switch label="Работа на несколько дней" description="Бокс занят с открытия первого дня до закрытия последнего" value={multi}
          onChange={(x) => setV({ ...v, duration_days: x ? Math.max(1, v.duration_days) : 0, duration_minutes: x ? 0 : Math.max(10, v.duration_minutes) })} />
        {multi ? (
          <NumberInput label="Рабочих дней" value={v.duration_days} onChange={(n) => setV({ ...v, duration_days: n })} min={1} max={30} />
        ) : (
          <NumberInput label="Длительность, мин" value={v.duration_minutes} onChange={(n) => setV({ ...v, duration_minutes: n })} min={10} max={720} step={10} status={err("duration_minutes")} />
        )}
        <Switch label="Показывать на сайте" value={v.is_active} onChange={(x) => setV({ ...v, is_active: x })} />
        {save.isError && <Banner status="error" title={save.error instanceof Error && !("code" in save.error) ? save.error.message : dbMessage(save.error)} collapsible={false} />}
        <HStack gap={2} justify="between">
          {service ? <Button label="Удалить" variant="destructive" icon={<Trash size={16} />} onClick={() => onDelete(service)} /> : <span />}
          <HStack gap={2}>
            <Button label="Отмена" variant="ghost" onClick={onClose} />
            <Button label="Сохранить" variant="primary" isLoading={save.isPending} onClick={() => save.mutate()} />
          </HStack>
        </HStack>
      </VStack>
    </Dialog>
  );
}

// ───────── Боксы ─────────
function BoxesSettings({ bundle }: { bundle: StudioBundle }) {
  const refresh = useSaver(bundle.studio.slug);
  const [boxes, setBoxes] = useState(bundle.boxes.map((b) => ({ ...b })));
  const [newName, setNewName] = useState("");
  const save = useMutation({
    mutationFn: async () => {
      for (const b of boxes) {
        if (b.name.trim().length < 1) throw new Error("У бокса должно быть название");
        const { error } = await supabase.from("boxes").update({ name: b.name.trim(), is_active: b.is_active }).eq("id", b.id).eq("studio_id", bundle.studio.id);
        if (error) throw error;
      }
    },
    onSuccess: refresh,
  });
  const add = useMutation({
    mutationFn: async () => {
      const name = newName.trim();
      if (!name) throw new Error("Введите название");
      const { data, error } = await supabase.from("boxes").insert({ name, studio_id: bundle.studio.id, sort: boxes.length }).select("*").single();
      if (error) throw error;
      setBoxes([...boxes, data]);
      setNewName("");
    },
    onSuccess: refresh,
  });
  return (
    <Block id="boxes" title="Боксы" description="Свободное время считается по всем включённым боксам. Выключенный бокс не принимает новые записи.">
      <VStack gap={3}>
        {boxes.map((b, i) => (
          <HStack key={b.id} gap={3} align="end" wrap="wrap">
            <TextInput label={`Бокс ${i + 1}`} isLabelHidden value={b.name} onChange={(x) => setBoxes(boxes.map((y) => (y.id === b.id ? { ...y, name: x } : y)))} />
            <Switch label="Принимает записи" value={b.is_active} onChange={(x) => setBoxes(boxes.map((y) => (y.id === b.id ? { ...y, is_active: x } : y)))} />
          </HStack>
        ))}
        <HStack gap={2} align="end" wrap="wrap">
          <TextInput label="Новый бокс" value={newName} onChange={setNewName} placeholder="Например, Бокс 4" />
          <Button label="Добавить" icon={<Plus size={16} />} onClick={() => add.mutate()} isLoading={add.isPending} />
        </HStack>
      </VStack>
      {add.isError && <Banner status="error" title={add.error instanceof Error && !("code" in add.error) ? add.error.message : dbMessage(add.error)} collapsible={false} />}
      <Result m={save} />
      <div><Button label="Сохранить боксы" variant="primary" isLoading={save.isPending} onClick={() => save.mutate()} /></div>
    </Block>
  );
}

// ───────── Часы работы ─────────
function HoursSettings({ bundle }: { bundle: StudioBundle }) {
  const refresh = useSaver(bundle.studio.slug);
  const [days, setDays] = useState(
    [1, 2, 3, 4, 5, 6, 7].map((wd) => {
      const h = bundle.hours.find((x) => x.weekday === wd);
      return { weekday: wd, open: !!h, opens: h?.opens ?? "09:00", closes: h?.closes ?? "21:00" };
    }),
  );
  const save = useMutation({
    mutationFn: async () => {
      for (const d of days) if (d.open && !(d.closes > d.opens)) throw new Error(`${weekdayNames[d.weekday]}: закрытие должно быть позже открытия`);
      const sid = bundle.studio.id;
      const open = days.filter((d) => d.open).map((d) => ({ studio_id: sid, weekday: d.weekday, opens: d.opens, closes: d.closes }));
      const closed = days.filter((d) => !d.open).map((d) => d.weekday);
      if (open.length) {
        const { error } = await supabase.from("working_hours").upsert(open, { onConflict: "studio_id,weekday" });
        if (error) throw error;
      }
      if (closed.length) {
        const { error } = await supabase.from("working_hours").delete().eq("studio_id", sid).in("weekday", closed);
        if (error) throw error;
      }
    },
    onSuccess: refresh,
  });
  const set = (wd: number, patch: Partial<(typeof days)[number]>) => setDays(days.map((d) => (d.weekday === wd ? { ...d, ...patch } : d)));
  return (
    <Block id="hours" title="Часы работы" description="По ним считается свободное время для записи">
      <VStack gap={3}>
        {days.map((d) => (
          <HStack key={d.weekday} gap={3} align="center" wrap="wrap">
            <div style={{ width: 130 }}><Switch label={weekdayNames[d.weekday]} value={d.open} onChange={(x) => set(d.weekday, { open: x })} /></div>
            {d.open ? (
              <HStack gap={2} align="center" className="admin-hours-inputs">
                <TimeInput label="Открытие" isLabelHidden hourFormat="24h" value={d.opens as never} onChange={(x) => x && set(d.weekday, { opens: x.slice(0, 5) })} />
                <Text>—</Text>
                <TimeInput label="Закрытие" isLabelHidden hourFormat="24h" value={d.closes as never} onChange={(x) => x && set(d.weekday, { closes: x.slice(0, 5) })} />
              </HStack>
            ) : <Text type="supporting">Выходной</Text>}
          </HStack>
        ))}
      </VStack>
      {save.isError && <Banner status="error" title={save.error instanceof Error && !("code" in save.error) ? save.error.message : dbMessage(save.error)} collapsible={false} />}
      {save.isSuccess && <Banner status="success" title="Сохранено" collapsible={false} />}
      <div><Button label="Сохранить часы" variant="primary" isLoading={save.isPending} onClick={() => save.mutate()} /></div>
    </Block>
  );
}

// ───────── Выходные ─────────
function DaysOffSettings({ bundle }: { bundle: StudioBundle }) {
  const refresh = useSaver(bundle.studio.slug);
  const [day, setDay] = useState<string | undefined>();
  const [note, setNote] = useState("");
  const add = useMutation({
    mutationFn: async () => {
      if (!day) throw new Error("Выберите дату");
      const { error } = await supabase.from("days_off").upsert({ studio_id: bundle.studio.id, day, note: note.trim() });
      if (error) throw error;
      setDay(undefined);
      setNote("");
    },
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: async (d: string) => {
      const { error } = await supabase.from("days_off").delete().eq("studio_id", bundle.studio.id).eq("day", d);
      if (error) throw error;
    },
    onSuccess: refresh,
  });
  return (
    <Block id="daysoff" title="Выходные и праздники" description="В эти дни запись закрыта">
      <HStack gap={2} align="end" wrap="wrap">
        <DateInput label="Дата" value={day as never} onChange={(x) => setDay(x)} />
        <TextInput label="Причина" value={note} onChange={setNote} placeholder="Например, санитарный день" />
        <Button label="Добавить" icon={<Plus size={16} />} isLoading={add.isPending} onClick={() => add.mutate()} />
      </HStack>
      {add.isError && <Banner status="error" title={add.error instanceof Error && !("code" in add.error) ? add.error.message : dbMessage(add.error)} collapsible={false} />}
      <VStack gap={2}>
        {bundle.daysOff.length === 0 && <Text type="supporting">Выходных нет — студия работает по обычному графику.</Text>}
        {bundle.daysOff.map((d) => (
          <HStack key={d.day} gap={3} align="center" justify="between">
            <Text>{new Date(`${d.day}T12:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric", weekday: "short" })}{d.note ? ` · ${d.note}` : ""}</Text>
            <Button label="Удалить" variant="ghost" size="sm" isIconOnly icon={<Trash size={16} />} onClick={() => remove.mutate(d.day)} />
          </HStack>
        ))}
      </VStack>
    </Block>
  );
}
