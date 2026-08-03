-- Opsiyonel karşılama sayfası: QR okutulduğunda menüden önce gösterilebilecek
-- kapak görseli + WiFi + web sitesi bilgileri. Varsayılan kapalı; işletme
-- panelden açmadıkça QR davranışı değişmez.
-- Çalıştırma: Supabase Dashboard > SQL Editor'e yapıştırın

alter table public.cafes
  add column if not exists menu_landing_enabled boolean not null default false,
  add column if not exists cover_image_url text,
  add column if not exists wifi_ssid text,
  add column if not exists wifi_password text,
  add column if not exists website_url text;
