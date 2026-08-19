-- Paket Sipariş (gel-al) özelliği. Rezervasyon/garson-çağırma'dan farklı olarak
-- sipariş oluşturma tek bir RPC fonksiyonu üzerinden yapılır (create_order),
-- doğrudan tablo insert RLS policy'leri ile değil: bir sipariş = 1 orders satırı
-- + N order_items satırı, atomik olmalı ve fiyat sunucuda hesaplanmalı (istemcinin
-- gönderdiği fiyata güvenilmez — menu_items.price'tan o an okunur).
-- Çalıştırma: Supabase Dashboard > SQL Editor'e yapıştırın veya: supabase db push

alter table public.cafes
  add column if not exists order_enabled boolean not null default false;

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes (id) on delete cascade,
  phone text not null,
  name text not null,
  first_seen_at timestamptz not null default now(),
  last_order_at timestamptz not null default now(),
  total_orders int not null default 0,
  unique (cafe_id, phone)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes (id) on delete cascade,
  customer_name text not null,
  phone text not null,
  note text,
  status text not null default 'pending'
    check (status in ('pending', 'preparing', 'ready', 'completed', 'cancelled')),
  total numeric(10, 2) not null default 0,
  created_at timestamptz not null default now()
);

-- menu_item_id silinebilir/değişebilir; name+price o anki hâliyle burada
-- "donmuş" kalır (fiyat sonradan değişse de geçmiş sipariş doğru görünsün diye).
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  menu_item_id uuid references public.menu_items (id) on delete set null,
  name text not null,
  price numeric(10, 2) not null,
  quantity int not null check (quantity > 0)
);

create index idx_orders_cafe on public.orders (cafe_id, status, created_at);
create index idx_order_items_order on public.order_items (order_id);
create index idx_customers_cafe on public.customers (cafe_id, last_order_at desc);

-- ============ RLS ============

alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- customers/orders/order_items: hiçbir public insert/select policy YOK — tüm
-- yazma create_order() üzerinden (aşağıda), tüm müşteri-tarafı okuma
-- get_order_status() RPC'si üzerinden (id bilmek = erişim, table_sessions'taki
-- ilkeyle aynı). Sadece işletmeci (owns_cafe) panelden okur/günceller.
create policy "customers_owner_read" on public.customers
  for select using (public.owns_cafe(cafe_id));

create policy "orders_owner_read" on public.orders
  for select using (public.owns_cafe(cafe_id));
create policy "orders_owner_update" on public.orders
  for update using (public.owns_cafe(cafe_id));

create policy "order_items_owner_read" on public.order_items
  for select using (
    exists (select 1 from public.orders o where o.id = order_id and public.owns_cafe(o.cafe_id))
  );

-- Panelde anlık bildirim için realtime
alter publication supabase_realtime add table public.orders;

-- ============ FONKSİYONLAR ============

-- Sipariş oluşturma: tek RPC, atomik, fiyatı sunucuda hesaplar.
-- p_items: [{"menu_item_id": "uuid", "quantity": 2}, ...]
create or replace function public.create_order(
  p_cafe_id uuid,
  p_customer_name text,
  p_phone text,
  p_note text,
  p_items jsonb
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

    select name, price into v_name, v_price
    from public.menu_items
    where id = (v_item ->> 'menu_item_id')::uuid and cafe_id = p_cafe_id and is_active;

    if v_name is null then
      raise exception 'Ürün bulunamadı.';
    end if;

    insert into public.order_items (order_id, menu_item_id, name, price, quantity)
    values (v_order_id, (v_item ->> 'menu_item_id')::uuid, v_name, v_price, v_qty);

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

-- Müşterinin kendi sipariş durumunu (id'sini bildiği için) sorgulayabilmesi için
-- — reservations'taki get_reservation_status ile aynı ilke.
create or replace function public.get_order_status(p_id uuid)
returns table (status text, total numeric, created_at timestamptz, items jsonb)
language sql
security definer
set search_path = public
stable
as $$
  select o.status, o.total, o.created_at,
    coalesce(
      jsonb_agg(jsonb_build_object('name', oi.name, 'quantity', oi.quantity))
        filter (where oi.id is not null),
      '[]'::jsonb
    )
  from public.orders o
  left join public.order_items oi on oi.order_id = o.id
  where o.id = p_id
  group by o.status, o.total, o.created_at;
$$;
