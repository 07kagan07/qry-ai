-- Müşterinin kendi rezervasyon durumunu (onaylandı mı, reddedildi mi) sonradan
-- sorgulayabilmesi için. reservations tablosunda genel bir public select policy
-- YOK (isim/telefon içeriyor, sızdırılmamalı) — bunun yerine bu fonksiyon sadece
-- verilen id'ye ait, hassas olmayan alanları döner. id rastgele bir UUID olduğu
-- için "id'yi bilmek" tek başına yeterli bir erişim kontrolüdür (table_sessions'ta
-- kullanılan "rastgele id = erişim" ilkesiyle aynı mantık).
-- Çalıştırma: Supabase Dashboard > SQL Editor'e yapıştırın veya: supabase db push

create or replace function public.get_reservation_status(p_id uuid)
returns table (
  status text,
  party_size int,
  reservation_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select status, party_size, reservation_at
  from public.reservations
  where id = p_id;
$$;
