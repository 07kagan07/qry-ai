// Menünün çevrilebileceği kapalı dil seti — allergens.ts/currency.ts ile aynı
// ilke. Bu set, supabase/functions/ai-translate/index.ts'teki LOCALE_NAMES ve
// 011_translations.sql'deki check kısıtlarıyla senkron tutulmalı; biri
// değişirse üçü de güncellenmeli (allergen'deki "3 yerde birden" notuyla aynı).

export const LOCALE_KEYS = ['en', 'de', 'ru', 'ar', 'fr', 'fa', 'uk', 'es', 'it', 'zh'] as const

export type LocaleKey = (typeof LOCALE_KEYS)[number]

// Panelde (işletmeci Türkçe arayüzde) gösterilen etiketler.
export const LOCALE_LABELS: Record<LocaleKey, string> = {
  en: 'İngilizce',
  de: 'Almanca',
  ru: 'Rusça',
  ar: 'Arapça',
  fr: 'Fransızca',
  fa: 'Farsça',
  uk: 'Ukraynaca',
  es: 'İspanyolca',
  it: 'İtalyanca',
  zh: 'Çince',
}

// Müşteri tarafındaki dil seçicide her dilin KENDİ dilindeki adı (endonim)
// gösterilir — dil seçicilerde evrensel kural budur ("Almanca" değil "Deutsch").
export const LOCALE_NATIVE_NAMES: Record<LocaleKey, string> = {
  en: 'English',
  de: 'Deutsch',
  ru: 'Русский',
  ar: 'العربية',
  fr: 'Français',
  fa: 'فارسی',
  uk: 'Українська',
  es: 'Español',
  it: 'Italiano',
  zh: '中文',
}

export const LOCALE_FLAGS: Record<LocaleKey, string> = {
  en: '🇬🇧',
  de: '🇩🇪',
  ru: '🇷🇺',
  ar: '🇸🇦',
  fr: '🇫🇷',
  fa: '🇮🇷',
  uk: '🇺🇦',
  es: '🇪🇸',
  it: '🇮🇹',
  zh: '🇨🇳',
}

/** Sağdan sola yazılan diller — dil seçiciyle birlikte `dir="rtl"` uygulanır. */
export const RTL_LOCALES: readonly LocaleKey[] = ['ar', 'fa']

export function isLocaleKey(v: string): v is LocaleKey {
  return (LOCALE_KEYS as readonly string[]).includes(v)
}
