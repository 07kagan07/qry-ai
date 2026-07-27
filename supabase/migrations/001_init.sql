-- QR Menü SaaS — başlangıç şeması
-- Çalıştırma: Supabase Dashboard > SQL Editor'e yapıştırın
-- veya: supabase db push

-- ============ TABLOLAR ============

create table public.cafes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  logo_url text,
  address text,
  phone text,
  instagram text,
  default_locale text not null default 'tr',
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  name text not null,
  description text,
  price numeric(10, 2) not null default 0,
  image_url text,
  -- Mevzuat alanları: kcal + 14 majör alerjen + alkol/domuz beyanı
  kcal int check (kcal is null or kcal >= 0),
  allergens text[] not null default '{}',
  contains_alcohol boolean not null default false,
  contains_pork boolean not null default false,
  -- AI önerisi (işletmeci onaylayana kadar burada bekler)
  ai_suggested jsonb,
  is_active boolean not null default true,
  sort_order int not null default 0,
  constraint valid_allergens check (
    allergens <@ array[
      'gluten','crustaceans','egg','fish','peanut','soy','milk',
      'nuts','celery','mustard','sesame','sulphites','lupin','molluscs'
    ]::text[]
  )
);

create table public.item_translations (
  item_id uuid not null references public.menu_items (id) on delete cascade,
  locale text not null,
  name text not null,
  description text,
  primary key (item_id, locale)
);

create index idx_categories_cafe on public.categories (cafe_id, sort_order);
create index idx_items_cafe on public.menu_items (cafe_id, category_id, sort_order);

-- ============ RLS ============

alter table public.cafes enable row level security;
alter table public.categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.item_translations enable row level security;

-- Sahiplik kontrolü için yardımcı fonksiyon
create or replace function public.owns_cafe(p_cafe_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.cafes c
    where c.id = p_cafe_id and c.owner_id = auth.uid()
  );
$$;

-- cafes: herkes okuyabilir (public menü için), sadece sahibi yazar
create policy "cafes_public_read" on public.cafes
  for select using (true);
create policy "cafes_owner_insert" on public.cafes
  for insert with check (owner_id = auth.uid());
create policy "cafes_owner_update" on public.cafes
  for update using (owner_id = auth.uid());
create policy "cafes_owner_delete" on public.cafes
  for delete using (owner_id = auth.uid());

-- categories: aktif olanlar herkese açık, tümü sahibine açık
create policy "categories_read" on public.categories
  for select using (is_active or public.owns_cafe(cafe_id));
create policy "categories_owner_write" on public.categories
  for insert with check (public.owns_cafe(cafe_id));
create policy "categories_owner_update" on public.categories
  for update using (public.owns_cafe(cafe_id));
create policy "categories_owner_delete" on public.categories
  for delete using (public.owns_cafe(cafe_id));

-- menu_items: aktif olanlar herkese açık, tümü sahibine açık
create policy "items_read" on public.menu_items
  for select using (is_active or public.owns_cafe(cafe_id));
create policy "items_owner_write" on public.menu_items
  for insert with check (public.owns_cafe(cafe_id));
create policy "items_owner_update" on public.menu_items
  for update using (public.owns_cafe(cafe_id));
create policy "items_owner_delete" on public.menu_items
  for delete using (public.owns_cafe(cafe_id));

-- item_translations: herkes okur, sahibi yazar
create policy "translations_read" on public.item_translations
  for select using (true);
create policy "translations_owner_write" on public.item_translations
  for insert with check (
    exists (select 1 from public.menu_items i
            where i.id = item_id and public.owns_cafe(i.cafe_id))
  );
create policy "translations_owner_update" on public.item_translations
  for update using (
    exists (select 1 from public.menu_items i
            where i.id = item_id and public.owns_cafe(i.cafe_id))
  );
create policy "translations_owner_delete" on public.item_translations
  for delete using (
    exists (select 1 from public.menu_items i
            where i.id = item_id and public.owns_cafe(i.cafe_id))
  );

-- ============ STORAGE ============

insert into storage.buckets (id, name, public)
values ('menu-images', 'menu-images', true)
on conflict (id) do nothing;

create policy "menu_images_public_read" on storage.objects
  for select using (bucket_id = 'menu-images');
create policy "menu_images_auth_write" on storage.objects
  for insert with check (bucket_id = 'menu-images' and auth.role() = 'authenticated');
create policy "menu_images_auth_update" on storage.objects
  for update using (bucket_id = 'menu-images' and auth.role() = 'authenticated');
create policy "menu_images_auth_delete" on storage.objects
  for delete using (bucket_id = 'menu-images' and auth.role() = 'authenticated');
