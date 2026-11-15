-- Запись в детейлинг-студии. У каждой студии свои данные; права проверяет сама база (RLS).
create extension if not exists btree_gist;
create extension if not exists pgcrypto;

-- ───────────── Студии и владельцы ─────────────
create table public.studios (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  -- draft: студия видна только как образец, запись закрыта; live: проверена и принимает записи.
  status text not null default 'draft' check (status in ('draft', 'live')),
  name text not null check (char_length(name) between 2 and 60),
  tagline text not null default '',
  description text not null default '',
  timezone text not null default 'Europe/Moscow',
  address text not null default '',
  city text not null default '',
  lat double precision,
  lon double precision,
  phone text not null default '',
  socials jsonb not null default '[]',
  rating jsonb,
  theme_color text not null default '#0b0b0c',
  accent text not null default '#f2c27b',
  logo_path text,
  hero_path text,
  hero_position text not null default '50% 50%',
  info_cards jsonb not null default '[]' check (jsonb_typeof(info_cards) = 'array' and jsonb_array_length(info_cards) <= 3),
  slot_step_minutes int not null default 30 check (slot_step_minutes between 10 and 120),
  buffer_minutes int not null default 15 check (buffer_minutes between 0 and 240),
  lead_minutes int not null default 60 check (lead_minutes between 0 and 2880),
  horizon_days int not null default 30 check (horizon_days between 1 and 90),
  cancel_hours int not null default 3 check (cancel_hours between 0 and 168),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.studio_members (
  studio_id uuid not null references public.studios(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner')),
  created_at timestamptz not null default now(),
  primary key (studio_id, user_id)
);

create or replace function public.is_studio_member(p_studio uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.studio_members m where m.studio_id = p_studio and m.user_id = (select auth.uid()));
$$;
revoke all on function public.is_studio_member(uuid) from public;
grant execute on function public.is_studio_member(uuid) to authenticated, anon;

-- ───────────── Справочники студии ─────────────
create table public.boxes (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  is_active boolean not null default true,
  sort int not null default 0,
  unique (id, studio_id)
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  category text not null default 'Услуги',
  name text not null check (char_length(name) between 2 and 80),
  description text not null default '',
  price int not null check (price >= 0),
  price_from boolean not null default true,
  duration_minutes int not null default 60 check (duration_minutes between 0 and 720),
  duration_days int not null default 0 check (duration_days between 0 and 30),
  is_active boolean not null default true,
  sort int not null default 0,
  check (duration_days > 0 or duration_minutes >= 10),
  unique (id, studio_id)
);

create table public.working_hours (
  studio_id uuid not null references public.studios(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7), -- 1 = понедельник
  opens time not null,
  closes time not null,
  check (closes > opens),
  primary key (studio_id, weekday)
);

create table public.days_off (
  studio_id uuid not null references public.studios(id) on delete cascade,
  day date not null,
  note text not null default '',
  primary key (studio_id, day)
);

create table public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  image_path text not null,
  caption text not null default '' check (char_length(caption) <= 120),
  sort int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ───────────── Записи и оплаты ─────────────
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  service_id uuid,
  box_id uuid not null,
  service_name text not null,
  price int not null default 0 check (price >= 0),
  client_name text not null check (char_length(client_name) between 2 and 60),
  client_phone text not null check (client_phone ~ '^\+7\d{10}$'),
  car text not null check (char_length(car) between 2 and 80),
  comment text not null default '' check (char_length(comment) <= 500),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  block_until timestamptz not null,
  status text not null default 'booked' check (status in ('booked', 'arrived', 'done', 'cancelled')),
  source text not null default 'online' check (source in ('online', 'manual')),
  access_token uuid not null default gen_random_uuid() unique,
  idempotency_key uuid,
  cancelled_at timestamptz,
  cancelled_by text check (cancelled_by in ('client', 'owner')),
  arrived_at timestamptz,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at and block_until >= ends_at),
  unique (id, studio_id),
  unique (studio_id, idempotency_key),
  foreign key (box_id, studio_id) references public.boxes(id, studio_id),
  foreign key (service_id, studio_id) references public.services(id, studio_id) on delete set null (service_id),
  -- Главная гарантия: в одном боксе не может быть двух пересекающихся записей.
  constraint bookings_no_overlap exclude using gist (
    box_id with =,
    tstzrange(starts_at, block_until, '[)') with &&
  ) where (status <> 'cancelled')
);
create index bookings_studio_time on public.bookings (studio_id, starts_at);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  studio_id uuid not null references public.studios(id) on delete cascade,
  booking_id uuid not null,
  kind text not null check (kind in ('payment', 'refund')),
  amount int not null check (amount > 0),
  method text not null default 'card' check (method in ('card', 'cash', 'sbp', 'transfer')),
  note text not null default '' check (char_length(note) <= 200),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (booking_id, studio_id) references public.bookings(id, studio_id) on delete cascade
);
create index payments_studio_time on public.payments (studio_id, created_at);

-- Напоминания за сутки (Web Push). Доступ только у сервера.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  remind_at timestamptz not null,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (booking_id, endpoint)
);

-- Ограничение частоты обращений. Доступ только у сервера.
create table public.rate_events (
  id bigint generated always as identity primary key,
  key text not null,
  action text not null,
  created_at timestamptz not null default now()
);
create index rate_events_lookup on public.rate_events (key, action, created_at);

-- ───────────── updated_at ─────────────
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger studios_touch before update on public.studios for each row execute function public.touch_updated_at();
create trigger bookings_touch before update on public.bookings for each row execute function public.touch_updated_at();
create trigger gallery_touch before update on public.gallery_items for each row execute function public.touch_updated_at();

-- Отметки времени смены статуса.
create or replace function public.booking_status_stamps() returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'arrived' and new.arrived_at is null then new.arrived_at = now(); end if;
    if new.status = 'done' and new.done_at is null then new.done_at = now(); end if;
    if new.status = 'cancelled' and new.cancelled_at is null then new.cancelled_at = now(); end if;
  end if;
  return new;
end $$;
create trigger bookings_status_stamps before update on public.bookings for each row execute function public.booking_status_stamps();

-- ───────────── RLS ─────────────
alter table public.studios enable row level security;
alter table public.studio_members enable row level security;
alter table public.boxes enable row level security;
alter table public.services enable row level security;
alter table public.working_hours enable row level security;
alter table public.days_off enable row level security;
alter table public.gallery_items enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.rate_events enable row level security;

-- Публичная витрина: читать может любой.
create policy studios_read on public.studios for select using (true);
create policy boxes_read on public.boxes for select using (true);
create policy services_read on public.services for select using (true);
create policy hours_read on public.working_hours for select using (true);
create policy days_off_read on public.days_off for select using (true);
create policy gallery_read on public.gallery_items for select using (true);

-- Владелец меняет только свою студию.
create policy studios_owner_update on public.studios for update to authenticated
  using (public.is_studio_member(id)) with check (public.is_studio_member(id));
create policy members_self_read on public.studio_members for select to authenticated using (user_id = (select auth.uid()));

create policy boxes_owner_write on public.boxes for all to authenticated
  using (public.is_studio_member(studio_id)) with check (public.is_studio_member(studio_id));
create policy services_owner_write on public.services for all to authenticated
  using (public.is_studio_member(studio_id)) with check (public.is_studio_member(studio_id));
create policy hours_owner_write on public.working_hours for all to authenticated
  using (public.is_studio_member(studio_id)) with check (public.is_studio_member(studio_id));
create policy days_off_owner_write on public.days_off for all to authenticated
  using (public.is_studio_member(studio_id)) with check (public.is_studio_member(studio_id));
create policy gallery_owner_write on public.gallery_items for all to authenticated
  using (public.is_studio_member(studio_id)) with check (public.is_studio_member(studio_id));

-- Записи и оплаты видит и меняет только владелец этой студии. Анонимного доступа нет вовсе.
create policy bookings_owner_all on public.bookings for all to authenticated
  using (public.is_studio_member(studio_id)) with check (public.is_studio_member(studio_id));
create policy payments_owner_read on public.payments for select to authenticated using (public.is_studio_member(studio_id));
create policy payments_owner_insert on public.payments for insert to authenticated with check (public.is_studio_member(studio_id));

-- Владелец не может сам перевести студию из образца в рабочий режим и сменить её адрес /s/<slug>/.
revoke update on public.studios from authenticated, anon;
grant update (name, tagline, description, timezone, address, city, lat, lon, phone, socials, rating, theme_color, accent,
  logo_path, hero_path, hero_position, info_cards, slot_step_minutes, buffer_minutes, lead_minutes, horizon_days, cancel_hours)
  on public.studios to authenticated;
-- Ключи доступа клиента и ключи идемпотентности не отдаются даже владельцу через API.
revoke all on public.bookings from anon;
revoke select, update on public.bookings from authenticated;
grant select (id, studio_id, service_id, box_id, service_name, price, client_name, client_phone, car, comment, starts_at, ends_at,
  block_until, status, source, cancelled_at, cancelled_by, arrived_at, done_at, created_at, updated_at) on public.bookings to authenticated;
grant update (service_id, box_id, service_name, price, client_name, client_phone, car, comment, starts_at, ends_at, block_until,
  status, cancelled_by) on public.bookings to authenticated;
revoke all on public.push_subscriptions, public.rate_events from anon, authenticated;
-- Оплаты не редактируются и не удаляются: ошибку исправляют возвратом.
revoke update, delete on public.payments from authenticated;

-- ───────────── Создание записи одной неделимой операцией ─────────────
-- Вызывается только серверной функцией. Перебирает подходящие боксы; пересечения отсекает ограничение bookings_no_overlap,
-- поэтому из двух одновременных запросов на одно время успешен будет только один.
-- Повторный запрос с тем же ключом идемпотентности возвращает уже созданную запись, а не копию.
create or replace function public.create_booking(
  p_studio uuid, p_service uuid, p_box_ids uuid[], p_starts timestamptz, p_ends timestamptz, p_block timestamptz,
  p_name text, p_phone text, p_car text, p_comment text, p_key uuid, p_source text default 'online'
) returns public.bookings
language plpgsql security definer set search_path = '' as $$
declare
  v_box uuid;
  v_row public.bookings;
  v_service public.services;
begin
  select * into v_row from public.bookings where studio_id = p_studio and idempotency_key = p_key;
  if found then return v_row; end if;

  select * into v_service from public.services where id = p_service and studio_id = p_studio and is_active;
  if not found then raise exception 'service_not_found' using errcode = 'P0002'; end if;

  foreach v_box in array p_box_ids loop
    begin
      insert into public.bookings (studio_id, service_id, box_id, service_name, price, client_name, client_phone, car, comment,
        starts_at, ends_at, block_until, source, idempotency_key)
      values (p_studio, p_service, v_box, v_service.name, v_service.price, p_name, p_phone, p_car, coalesce(p_comment, ''),
        p_starts, p_ends, p_block, p_source, p_key)
      returning * into v_row;
      return v_row;
    exception
      when exclusion_violation then
        continue; -- бокс успели занять, пробуем следующий
      when unique_violation then
        select * into v_row from public.bookings where studio_id = p_studio and idempotency_key = p_key;
        if found then return v_row; end if;
        raise;
    end;
  end loop;
  raise exception 'slot_taken' using errcode = 'P0001';
end $$;
revoke all on function public.create_booking from public, anon, authenticated;
grant execute on function public.create_booking to service_role;

-- Сводка для кабинета: заезды, завершённые работы и реально полученные деньги за период.
create or replace function public.owner_stats(p_studio uuid, p_from timestamptz, p_to timestamptz)
returns table (visits int, completed int, cancelled int, received int, refunded int)
language sql stable security invoker set search_path = '' as $$
  select
    (select count(*)::int from public.bookings b where b.studio_id = p_studio and b.starts_at >= p_from and b.starts_at < p_to and b.status <> 'cancelled'),
    (select count(*)::int from public.bookings b where b.studio_id = p_studio and b.starts_at >= p_from and b.starts_at < p_to and b.status = 'done'),
    (select count(*)::int from public.bookings b where b.studio_id = p_studio and b.starts_at >= p_from and b.starts_at < p_to and b.status = 'cancelled'),
    (select coalesce(sum(amount), 0)::int from public.payments p where p.studio_id = p_studio and p.kind = 'payment' and p.created_at >= p_from and p.created_at < p_to),
    (select coalesce(sum(amount), 0)::int from public.payments p where p.studio_id = p_studio and p.kind = 'refund' and p.created_at >= p_from and p.created_at < p_to);
$$;
grant execute on function public.owner_stats to authenticated;

-- ───────────── Фотографии ─────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Файлы студии лежат в папке <studio_id>/…; загружать и менять их может только владелец этой студии.
create policy media_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.is_studio_member(((storage.foldername(name))[1])::uuid));
create policy media_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.is_studio_member(((storage.foldername(name))[1])::uuid));
create policy media_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.is_studio_member(((storage.foldername(name))[1])::uuid));
