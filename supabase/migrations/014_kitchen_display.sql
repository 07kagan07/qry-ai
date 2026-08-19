-- Faz 7 — Mutfak Yönetimi (Kitchen Display System). Personel vardiya linkiyle
-- aynı ilke: mutfak ekranı, işletmeci hesabına giriş yapmadan tahmin edilemez
-- bir link ile (/mutfak/<token>) açılır. ÖNEMLİ: bu token'ı cafes tablosuna
-- kolon olarak eklemek GÜVENLİ DEĞİL — cafes'te "cafes_public_read using (true)"
-- politikası var (public menü için herkes tüm kolonları okuyabiliyor), token da
-- oradan sızardı. Bunun yerine staff/shifts ile aynı desende, ayrı ve RLS'i
-- tamamen sahibe kilitli bir tabloda tutuluyor; anonim erişim sadece aşağıdaki
-- SECURITY DEFINER RPC'ler üzerinden.
-- Çalıştırma: Supabase Dashboard > SQL Editor'e yapıştırın veya: supabase db push

-- ============ Ürün bazlı özel istek notu ============

alter table public.order_items
  add column if not exists note text;

alter table public.order_items
  add constraint order_items_note_length check (note is null or char_length(note) <= 200);

-- ============ Mutfak ekranı linki ============

create table public.kitchen_links (
  cafe_id uuid primary key references public.cafes (id) on delete cascade,
  token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now()
);

alter table public.kitchen_links enable row level security;

create policy "kitchen_links_owner_read" on public.kitchen_links
  for select using (public.owns_cafe(cafe_id));
create policy "kitchen_links_owner_insert" on public.kitchen_links
  for insert with check (public.owns_cafe(cafe_id));
create policy "kitchen_links_owner_update" on public.kitchen_links
  for update using (public.owns_cafe(cafe_id));

-- ============ create_order: ürün notunu da kaydet ============

create or replace function public.create_order(
  p_cafe_id uuid,
  p_customer_name text,
  p_phone text,
  p_note text,
  p_items jsonb,
  p_locale text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_total numeric(10, 2) := 0;
  v_item jsonb;
  v_price numeric(10, 2);
  v_name text;
  v_qty int;
  v_item_note text;
begin
  if not exists (select 1 from public.cafes where id = p_cafe_id and order_enabled) then
    raise exception 'Paket sipariş bu kafede aktif değil.';
  end if;

  insert into public.orders (cafe_id, customer_name, phone, note, status, total)
  values (p_cafe_id, p_customer_name, p_phone, p_note, 'pending', 0)
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_qty := (v_item ->> 'quantity')::int;
    if v_qty is null or v_qty < 1 then
      raise exception 'Geçersiz miktar.';
    end if;
    v_item_note := nullif(trim(both from (v_item ->> 'note')), '');
    if v_item_note is not null and char_length(v_item_note) > 200 then
      v_item_note := left(v_item_note, 200);
    end if;

    select coalesce(it.name, mi.name), mi.price into v_name, v_price
    from public.menu_items mi
    left join public.item_translations it
      on it.item_id = mi.id and it.locale = p_locale
    where mi.id = (v_item ->> 'menu_item_id')::uuid and mi.cafe_id = p_cafe_id and mi.is_active;

    if v_name is null then
      raise exception 'Ürün bulunamadı.';
    end if;

    insert into public.order_items (order_id, menu_item_id, name, price, quantity, note)
    values (v_order_id, (v_item ->> 'menu_item_id')::uuid, v_name, v_price, v_qty, v_item_note);

    v_total := v_total + v_price * v_qty;
  end loop;

  if v_total <= 0 then
    raise exception 'Sepet boş olamaz.';
  end if;

  update public.orders set total = v_total where id = v_order_id;

  insert into public.customers (cafe_id, phone, name, last_order_at, total_orders)
  values (p_cafe_id, p_phone, p_customer_name, now(), 1)
  on conflict (cafe_id, phone) do update
    set last_order_at = now(),
        total_orders = customers.total_orders + 1,
        name = excluded.name;

  return v_order_id;
end;
$$;

-- ============ get_order_status: ürün notunu da döndür ============

create or replace function public.get_order_status(p_id uuid, p_locale text default null)
returns table (status text, total numeric, created_at timestamptz, items jsonb)
language sql
security definer
set search_path = public
stable
as $$
  select o.status, o.total, o.created_at,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'name', coalesce(it.name, oi.name),
          'quantity', oi.quantity,
          'note', oi.note
        )
      ) filter (where oi.id is not null),
      '[]'::jsonb
    )
  from public.orders o
  left join public.order_items oi on oi.order_id = o.id
  left join public.item_translations it
    on it.item_id = oi.menu_item_id and it.locale = p_locale
  where o.id = p_id
  group by o.status, o.total, o.created_at;
$$;

-- ============ Mutfak ekranı RPC'leri ============

-- Sayfa açılışında bir kere: token geçerli mi + işletme adı nedir. Boş sonuç =
-- geçersiz/silinmiş link (aktif sipariş olmaması ile karıştırılmasın diye
-- get_kitchen_orders'tan ayrı tutuldu).
create or replace function public.get_kitchen_cafe(p_token uuid)
returns table (cafe_id uuid, cafe_name text)
language sql
security definer
set search_path = public
stable
as $$
  select c.id, c.name
  from public.kitchen_links kl
  join public.cafes c on c.id = kl.cafe_id
  where kl.token = p_token;
$$;

-- Aktif siparişler (bekliyor/hazırlanıyor/hazır), ürünleri ve varsa özel
-- istek notlarıyla — mutfak ekranı bunu birkaç saniyede bir çeker (poll).
create or replace function public.get_kitchen_orders(p_token uuid)
returns table (
  id uuid,
  customer_name text,
  note text,
  status text,
  created_at timestamptz,
  items jsonb
)
language sql
security definer
set search_path = public
stable
as $$
  select o.id, o.customer_name, o.note, o.status, o.created_at,
    coalesce(
      jsonb_agg(
        jsonb_build_object('name', oi.name, 'quantity', oi.quantity, 'note', oi.note)
        order by oi.id
      ) filter (where oi.id is not null),
      '[]'::jsonb
    )
  from public.orders o
  join public.kitchen_links kl on kl.token = p_token
  join public.cafes c on c.id = kl.cafe_id and c.id = o.cafe_id
  left join public.order_items oi on oi.order_id = o.id
  where o.status in ('pending', 'preparing', 'ready')
  group by o.id, o.customer_name, o.note, o.status, o.created_at
  order by o.created_at asc;
$$;

-- Mutfak ekranından tek dokunuşla durum ilerletme/iptal. "pending"e geri
-- dönüş kasıtlı olarak yok (kitchen sadece ileri gider ya da iptal eder).
create or replace function public.update_kitchen_order_status(
  p_token uuid,
  p_order_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('preparing', 'ready', 'completed', 'cancelled') then
    raise exception 'Geçersiz durum.';
  end if;

  update public.orders o
  set status = p_status
  from public.kitchen_links kl
  where o.id = p_order_id
    and o.cafe_id = kl.cafe_id
    and kl.token = p_token;

  if not found then
    raise exception 'Sipariş bulunamadı ya da yetkisiz erişim.';
  end if;
end;
$$;
