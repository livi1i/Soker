create table if not exists public.review_albums (
 id text primary key,
 studio_id uuid not null references public.studios(id) on delete cascade,
 author text not null,
 excerpt text not null,
 rating smallint not null check (rating between 1 and 5),
 reviewed_at text not null default '',
 source_url text not null,
 photo_urls text[] not null check (cardinality(photo_urls) > 0),
 sort int not null default 0,
 imported_at timestamptz not null default now()
);
alter table public.review_albums enable row level security;
drop policy if exists review_albums_read on public.review_albums;
create policy review_albums_read on public.review_albums for select using (true);
drop policy if exists review_albums_owner_write on public.review_albums;
create policy review_albums_owner_write on public.review_albums for all to authenticated using (public.is_studio_member(studio_id)) with check (public.is_studio_member(studio_id));
