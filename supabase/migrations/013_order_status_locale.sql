-- Bir önceki migration (012), ürün adını sipariş VERİLİRKEN aktif olan dile göre
-- item_translations'tan okuyup order_items.name'e "donduruyordu" — ama kullanıcı
-- test ederken, müşteri siparişi takip ederken diliği değiştirince (örn. İngilizce
-- siparişten sonra Almanca'ya geçince) kartın hâlâ İngilizce kaldığını fark etti.
-- Sipariş fiyatı gibi kalıcı bir makbuz değil, canlı bir durum ekranı olduğu için
-- ürün adı da her sorguda O ANKİ seçili dile göre okunmalı. get_order_status artık
-- p_locale alıyor ve item_translations'a menu_item_id üzerinden canlı join yapıyor;
-- çeviri yoksa (veya ürün silinmişse) order_items.name'e (sipariş anındaki ad) düşer.
-- Çalıştırma: Supabase Dashboard > SQL Editor'e yapıştırın veya: supabase db push

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
        jsonb_build_object('name', coalesce(it.name, oi.name), 'quantity', oi.quantity)
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
