-- Menü görünüm temaları: her kafe 4 hazır temadan birini seçebilir.
-- Çalıştırma: Supabase Dashboard > SQL Editor'e yapıştırın

alter table public.cafes
  add column if not exists menu_theme text not null default 'classic'
  check (menu_theme in ('classic', 'grid', 'elegant', 'compact'));
