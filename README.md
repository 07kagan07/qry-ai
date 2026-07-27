# QR Menü — Mevzuata Uyumlu, AI Destekli Dijital Menü

Kafeler için çok kiracılı (multi-tenant) QR menü SaaS'ı. Türk Gıda Kodeksi Gıda Etiketleme ve
Tüketicileri Bilgilendirme Yönetmeliği'nin menülerde zorunlu kıldığı **14 majör alerjen**,
**enerji (kcal)**, **alkol** ve **domuz ürünü** beyanlarını yapay zeka ile otomatikleştirir.

## Özellikler

- **AI ile alerjen + kalori tahmini** — ürün adı ve malzemelerden 14 majör alerjeni, kcal
  aralığını, alkol/domuz içeriğini önerir; işletmeci onaylar (Gemini API, JSON şemalı çıktı)
- **Menü fotoğrafından içe aktarma** — eski menünün fotoğrafını yükle, ürünler/fiyatlar/kategoriler
  otomatik çıkarılsın (vision)
- **Açıklama üretme** ve **çok dilli çeviri** altyapısı
- **Public menü** — mobil öncelikli, alerjen ikonları, alerjen filtresi, mevzuat lejantı
- **QR kod** üretimi (masa numaralı varyant) + mevzuatın istediği **yazdırılabilir yazılı menü**
- Supabase Auth + Postgres RLS ile kiracı (kafe) izolasyonu

## Teknolojiler

React + Vite + TypeScript + Tailwind CSS · Supabase (Auth, Postgres, Storage, Edge Functions) ·
Gemini API (`gemini-2.5-flash`, ücretsiz katman) · qrcode.react

## Kurulum

### 1. Supabase projesi

1. [app.supabase.com](https://app.supabase.com) üzerinden ücretsiz bir proje oluşturun.
2. **SQL Editor**'de `supabase/migrations/001_init.sql` dosyasının içeriğini çalıştırın
   (tablolar, RLS politikaları ve storage bucket oluşur).
3. **Project Settings → API**'den `Project URL` ve `anon public` anahtarını alın.

### 2. Ortam değişkenleri

```bash
cp .env.example .env
# .env dosyasına Supabase URL ve anon key değerlerini yazın
```

### 3. Frontend'i çalıştırma

```bash
npm install
npm run dev          # sadece bu bilgisayardan erişim
npm run dev -- --host  # aynı ağdaki telefonla test için (Network adresini kullanın)
```

> **QR kod ve adres:** QR kodun içine gömülen adres uygulamanın açıldığı adrestir. `localhost`
> üzerinden üretilen QR telefonda açılmaz. Telefonla test için uygulamayı `--host` ile başlatıp
> paneli **Network** adresinden (örn. `http://192.168.x.x:5173`) açın. Canlıya çıkınca `.env`
> içinde `VITE_PUBLIC_SITE_URL=https://siteniz.com` tanımlayın — QR kodlar her zaman bu adresi
> kullanır.

### 4. AI Edge Functions (Supabase CLI gerekir)

```bash
# Supabase CLI: https://supabase.com/docs/guides/cli
supabase login
supabase link --project-ref <PROJE_REF>

# Gemini API anahtarını secret olarak ekleyin (frontend'e asla konmaz)
# Ücretsiz anahtar: https://aistudio.google.com/apikey
supabase secrets set GEMINI_API_KEY=AIza...

# Fonksiyonları deploy edin
supabase functions deploy ai-analyze
supabase functions deploy ai-import-menu
supabase functions deploy ai-describe
supabase functions deploy ai-translate
```

> Edge Functions varsayılan olarak JWT doğrulaması yapar; yalnızca giriş yapmış işletmeciler
> çağırabilir.

## Kullanım Akışı

1. `/kayit` ile hesap açın → kafe adı ve menü adresi (slug) belirleyin
2. **Menü Yönetimi**'nde kategori ve ürün ekleyin; her üründe **"AI ile Doldur"** butonu alerjen +
   kcal önerir — kaydetmeden önce kontrol edin (kaydetme = beyan onayı)
3. Veya **AI ile İçe Aktar** sayfasından mevcut menünüzün fotoğrafını yükleyin
4. **QR Kod** sayfasından QR'ı indirin, masalara yapıştırın; yazılı alternatif için
   yazdırılabilir menüyü kullanın
5. Müşteriler `/menu/<slug>` adresinde menüyü görür, alerjen filtresi uygulayabilir

## Mevzuat Notları

- Dayanak: Türk Gıda Kodeksi Gıda Etiketleme ve Tüketicileri Bilgilendirme Yönetmeliği
  (RG 26.01.2017/29960) ve Tarım ve Orman Bakanlığı'nın güncellenen menü düzenlemesi
- Uyum takvimi: ulusal zincirler **1 Temmuz 2026** · aynı ilde 3+ şube **31 Aralık 2026** ·
  kalori beyanı tüm işletmeler için en geç **31 Aralık 2027**
- AI önerileri **tahmindir**; beyanın doğruluğundan işletme sorumludur. Uygulama bu nedenle
  önerileri işletmeci onayından geçirir ve `ai_suggested` alanında izlenebilirlik sağlar.

## Proje Yapısı

```
src/
  lib/            allergens (14 alerjen tanımı), types, supabase client, ai istemcisi
  context/        AuthContext (oturum + kafe)
  components/     ui, AllergenPicker, ItemFormModal
  pages/          Landing, Login, Register
    panel/        PanelLayout, Dashboard, MenuManager, ImportMenu, QrPage, CreateCafe
    public/       PublicMenu (/menu/:slug), PrintMenu (/menu/:slug/yazdir)
supabase/
  migrations/     001_init.sql (şema + RLS + storage)
  functions/      ai-analyze, ai-import-menu, ai-describe, ai-translate (Deno)
```

## Yol Haritası (MVP sonrası)

- Ürün görseli yükleme (storage bucket hazır)
- Çok dilli menünün public arayüzde dil seçiciyle sunulması (çeviri altyapısı hazır)
- Abonelik/ödeme (iyzico/Stripe)
- Şube desteği (aynı hesapta birden çok kafe)
