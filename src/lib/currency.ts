// Kafe başına tek para birimi. Menüyü içe aktarırken tespit edilen para
// birimi buraya kaydedilir; DB'deki fiyat sayıları her zaman bu birimdedir
// (₺'ye çevrilmez) — bkz. supabase/functions/ai-import-menu.

export const CURRENCIES = ['TRY', 'USD', 'EUR'] as const

export type Currency = (typeof CURRENCIES)[number]

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  TRY: '₺',
  USD: '$',
  EUR: '€',
}

export const CURRENCY_LABELS: Record<Currency, string> = {
  TRY: 'Türk Lirası (₺)',
  USD: 'Amerikan Doları ($)',
  EUR: 'Euro (€)',
}

export function isCurrency(v: string): v is Currency {
  return (CURRENCIES as readonly string[]).includes(v)
}

export function formatPrice(amount: number, currency: Currency): string {
  return `${CURRENCY_SYMBOLS[currency]}${Number(amount).toFixed(2)}`
}
