-- Haftalık tekrar eden vardiyalar. Gerçek sonsuz döngü (cron) yerine bilinçli
-- olarak sınırlı bir ufuk (12 hafta) tercih edildi — kullanıcıyla konuşuldu:
-- ekstra zamanlanmış görev altyapısı gerektirmiyor, "Her hafta tekrarla"
-- işaretlendiğinde önümüzdeki 12 hafta için shifts satırları tek seferde
-- oluşturulur (bkz. src/pages/panel/Staff.tsx). Aynı seriye ait satırlar
-- ortak bir recurrence_id ile etiketlenir; "Tüm Tekrarı İptal Et" bu id'ye
-- sahip gelecekteki satırları toplu siler, tek bir günü silmek (izin günü)
-- ise mevcut tekil "Sil" ile zaten mümkündür.
-- Çalıştırma: Supabase Dashboard > SQL Editor'e yapıştırın veya: supabase db push

alter table public.shifts
  add column if not exists recurrence_id uuid;

create index idx_shifts_recurrence on public.shifts (recurrence_id) where recurrence_id is not null;
