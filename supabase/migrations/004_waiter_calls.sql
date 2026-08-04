-- Garson çağırma özelliği — kalıcı masa kimliği + 10 dakika geçerli geçici oturum
-- Çalıştırma: Supabase Dashboard > SQL Editor'e yapıştırın
-- veya: supabase db push

alter table public.cafes
  add column if not exists waiter_call_enabled boolean not null default false;

-- Kalıcı masa kimliği — QR koda basılan tek şey bu tablonun id'sidir, hiç değişmez.
create table public.tables (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes (id) on delete cascade,
  label text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Geçici oturum — ?masa= değeri budur, 10 dakikada expired olur, kalıcı id'yi barındırmaz.
create table public.table_sessions (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.tables (id) on delete cascade,
  cafe_id uuid not null references public.cafes (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index idx_table_sessions_lookup on public.table_sessions (table_id, expires_at);

create table public.waiter_calls (
  id uuid primary key default gen_random_uuid(),
  cafe_id uuid not null references public.cafes (id) on delete cascade,
  table_id uuid not null references public.tables (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'acknowledged', 'resolved')),
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz
);

-- Anti-spam: aynı masa için aynı anda yalnızca 1 "pending" çağrı olabilir
create unique index one_pending_call_per_table
  on public.waiter_calls (table_id) where (status = 'pending');

create index idx_waiter_calls_cafe on public.waiter_calls (cafe_id, status, created_at);

-- ============ RLS ============

alter table public.tables enable row level security;
alter table public.table_sessions enable row level security;
alter table public.waiter_calls enable row level security;

create policy "tables_read" on public.tables
  for select using (is_active or public.owns_cafe(cafe_id));
create policy "tables_owner_write" on public.tables
  for insert with check (public.owns_cafe(cafe_id));
create policy "tables_owner_update" on public.tables
  for update using (public.owns_cafe(cafe_id));
create policy "tables_owner_delete" on public.tables
  for delete using (public.owns_cafe(cafe_id));

-- Oturumlar: rastgele id + expires_at zaten erişim kontrolüdür, içerikte hassas veri yok
create policy "table_sessions_read" on public.table_sessions
  for select using (true);
create policy "table_sessions_public_insert" on public.table_sessions
  for insert with check (
    exists (select 1 from public.tables t
            where t.id = table_id and t.cafe_id = table_sessions.cafe_id and t.is_active)
  );
create policy "table_sessions_owner_delete" on public.table_sessions
  for delete using (public.owns_cafe(cafe_id));

-- Müşteri (anon) sadece gerçek/aktif bir masaya, VE o masa için hâlâ süresi
-- dolmamış bir oturum varken çağrı oluşturabilir; okuyamaz/güncelleyemez.
-- Bu ikinci koşul, istemcinin (sekme açık kalıp arka planda tekrar kontrol
-- etmediği için) süresi geçmiş bir oturumla yine de çağrı göndermeye
-- çalışmasına karşı asıl güvenlik sınırıdır — istemci tarafı kontrol yalnızca
-- kullanıcı deneyimi içindir, buradaki kontrol olmadan atlatılabilirdi.
create policy "waiter_calls_public_insert" on public.waiter_calls
  for insert with check (
    exists (select 1 from public.tables t
            where t.id = table_id and t.cafe_id = waiter_calls.cafe_id and t.is_active)
    and exists (select 1 from public.table_sessions s
                where s.table_id = waiter_calls.table_id and s.expires_at > now())
  );
create policy "waiter_calls_owner_read" on public.waiter_calls
  for select using (public.owns_cafe(cafe_id));

-- Müşteri kendi masasının çağrı durumunu görebilmeli (zaten çağrılmış mı,
-- personel "geldi" dedi mi) — hem tekil sorgu hem realtime abonelik için gerekir.
create policy "waiter_calls_public_read" on public.waiter_calls
  for select using (
    exists (select 1 from public.tables t where t.id = table_id and t.is_active)
  );
create policy "waiter_calls_owner_update" on public.waiter_calls
  for update using (public.owns_cafe(cafe_id));

-- Panelde anlık bildirim için realtime
alter publication supabase_realtime add table public.waiter_calls;
