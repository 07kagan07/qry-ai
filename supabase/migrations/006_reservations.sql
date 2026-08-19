-- Rezervasyon özelliği — müşteri kendi kendine talep gönderir, işletmeci
-- panelden onaylar/reddeder. Belirli bir masaya bağlı değildir (sadece kişi
-- sayısı + tarih/saat); hangi masaya oturacağına personel o gün karar verir.
-- Çalıştırma: Supabase Dashboard > SQL Editor'e yapıştırın veya: supabase db push

alter table public.cafes
  add column if not exists reservation_enabled boolean not null default false;

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes (id) on delete cascade,
  customer_name text not null,
  phone text not null,
  party_size int not null check (party_size > 0),
  reservation_at timestamptz not null,
  note text,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'rejected', 'cancelled')),
  created_at timestamptz not null default now()
);

create index idx_reservations_cafe on public.reservations (cafe_id, status, reservation_at);

-- ============ RLS ============

alter table public.reservations enable row level security;

-- Müşteri (anon) sadece rezervasyon özelliği açık bir kafeye talep gönderebilir;
-- kendi/başkasının rezervasyonunu okuyamaz (telefon/isim sızıntısı olmasın diye
-- public select policy yok — onay/red işletmeci tarafından telefonla iletilir).
create policy "reservations_public_insert" on public.reservations
  for insert with check (
    exists (select 1 from public.cafes c where c.id = cafe_id and c.reservation_enabled)
  );

create policy "reservations_owner_read" on public.reservations
  for select using (public.owns_cafe(cafe_id));
create policy "reservations_owner_update" on public.reservations
  for update using (public.owns_cafe(cafe_id));
create policy "reservations_owner_delete" on public.reservations
  for delete using (public.owns_cafe(cafe_id));

-- Panelde anlık bildirim için realtime
alter publication supabase_realtime add table public.reservations;
