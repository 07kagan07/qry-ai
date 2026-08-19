-- Dil Desteği. item_translations zaten vardı (001_init.sql, RLS de hazır) —
-- sadece kapalı bir dil seti kısıtı ekleniyor (allergen deseniyle aynı ilke).
-- Kategori çevirisi için yeni bir tablo, item_translations'la birebir aynı
-- RLS deseninde.
-- Çalıştırma: Supabase Dashboard > SQL Editor'e yapıştırın veya: supabase db push

alter table public.cafes
  add column if not exists enabled_locales text[] not null default '{}';

alter table public.cafes
  add constraint valid_enabled_locales check (
    enabled_locales <@ array['en','de','ru','ar','fr','fa','uk','es','it','zh']::text[]
  );

alter table public.item_translations
  add constraint valid_item_translation_locale
  check (locale in ('en','de','ru','ar','fr','fa','uk','es','it','zh'));

create table public.category_translations (
  category_id uuid not null references public.categories (id) on delete cascade,
  locale text not null,
  name text not null,
  primary key (category_id, locale),
  constraint valid_category_translation_locale
    check (locale in ('en','de','ru','ar','fr','fa','uk','es','it','zh'))
);

alter table public.category_translations enable row level security;

create policy "category_translations_read" on public.category_translations
  for select using (true);
create policy "category_translations_owner_write" on public.category_translations
  for insert with check (
    exists (select 1 from public.categories c where c.id = category_id and public.owns_cafe(c.cafe_id))
  );
create policy "category_translations_owner_update" on public.category_translations
  for update using (
    exists (select 1 from public.categories c where c.id = category_id and public.owns_cafe(c.cafe_id))
  );
create policy "category_translations_owner_delete" on public.category_translations
  for delete using (
    exists (select 1 from public.categories c where c.id = category_id and public.owns_cafe(c.cafe_id))
  );
