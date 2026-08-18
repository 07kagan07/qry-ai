-- Kafe başına tek para birimi (menü fotoğrafından içe aktarırken TL'ye
-- zorlamamak için) — Çalıştırma: Supabase Dashboard > SQL Editor'e yapıştırın
-- veya: supabase db push

alter table public.cafes
  add column if not exists currency text not null default 'TRY'
  check (currency in ('TRY', 'USD', 'EUR'));
