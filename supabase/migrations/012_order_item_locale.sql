-- create_order() ürün adını her zaman menu_items'tan (yalnızca Türkçe) okuyordu,
-- müşterinin sipariş sırasında gördüğü çevrilmiş adı yok sayıyordu — bu yüzden
-- "Siparişlerim" ekranındaki ürün adları dil ne olursa olsun Türkçe kalıyordu.
-- p_locale eklenip item_translations'tan (varsa) okunuyor, yoksa Türkçe'ye düşer.
-- Çalıştırma: Supabase Dashboard > SQL Editor'e yapıştırın veya: supabase db push

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

    select coalesce(it.name, mi.name), mi.price into v_name, v_price
    from public.menu_items mi
    left join public.item_translations it
      on it.item_id = mi.id and it.locale = p_locale
    where mi.id = (v_item ->> 'menu_item_id')::uuid and mi.cafe_id = p_cafe_id and mi.is_active;

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
