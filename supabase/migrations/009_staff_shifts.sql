-- Vardiya Yönetimi. Personelin Supabase Auth hesabı/şifresi yok — kişisel,
-- tahmin edilemez bir link ilkesi kullanılıyor (staff.id = /vardiya/<id>),
-- reservations/orders'taki "id'yi bilmek = erişim" ilkesiyle aynı.
-- Çalıştırma: Supabase Dashboard > SQL Editor'e yapıştırın veya: supabase db push

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes (id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes (id) on delete cascade,
  staff_id uuid not null references public.staff (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  note text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index idx_shifts_cafe on public.shifts (cafe_id, starts_at);
create index idx_shifts_staff on public.shifts (staff_id, starts_at);

-- ============ RLS ============

alter table public.staff enable row level security;
alter table public.shifts enable row level security;

-- Sadece işletmeci (owns_cafe) panelden okur/yazar. Personelin genel bir public
-- select izni YOK — kendi kaydı dahil her şeye get_staff_shifts() RPC'siyle erişir.
create policy "staff_owner_read" on public.staff for select using (public.owns_cafe(cafe_id));
create policy "staff_owner_insert" on public.staff for insert with check (public.owns_cafe(cafe_id));
create policy "staff_owner_update" on public.staff for update using (public.owns_cafe(cafe_id));
create policy "staff_owner_delete" on public.staff for delete using (public.owns_cafe(cafe_id));

create policy "shifts_owner_read" on public.shifts for select using (public.owns_cafe(cafe_id));
create policy "shifts_owner_insert" on public.shifts for insert with check (public.owns_cafe(cafe_id));
create policy "shifts_owner_update" on public.shifts for update using (public.owns_cafe(cafe_id));
create policy "shifts_owner_delete" on public.shifts for delete using (public.owns_cafe(cafe_id));

-- ============ FONKSİYONLAR ============

-- Personelin kendi linkinden (staff.id) yaklaşan vardiyalarını sorgulaması için.
create or replace function public.get_staff_shifts(p_staff_id uuid)
returns table (
  staff_name text,
  is_active boolean,
  shift_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  note text
)
language sql
security definer
set search_path = public
stable
as $$
  select s.name, s.is_active, sh.id, sh.starts_at, sh.ends_at, sh.note
  from public.staff s
  left join public.shifts sh on sh.staff_id = s.id and sh.ends_at >= now() - interval '1 day'
  where s.id = p_staff_id
  order by sh.starts_at asc
  limit 30;
$$;
