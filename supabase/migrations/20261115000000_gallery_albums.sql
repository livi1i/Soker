alter table public.gallery_items add column if not exists album_title text not null default '' check (char_length(album_title) <= 120);
comment on column public.gallery_items.album_title is 'Photos with the same non-empty album title form one portfolio album within a studio';
