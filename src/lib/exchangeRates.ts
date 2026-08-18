import { useEffect, useState } from 'react'
import { CURRENCIES, type Currency } from './currency'

// ₺/$/€ fiyatların diğer iki para birimindeki karşılığını göstermek için
// kullanılan kurlar. Ücretsiz, anahtarsız frankfurter.app API'si; 24 saat
// localStorage'da önbelleklenir (aynı sekmede birden çok bileşen aynı isteği
// paylaşır). EUR baz alınarak tek istekle tüm çaprazlar hesaplanır.

export interface FxTable {
  /** 1 EUR kaç birim eder (EUR her zaman 1) */
  perEur: Record<Currency, number>
}

const CACHE_KEY = 'qr-menu:fx-table'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

interface CachedFx {
  perEur: Record<Currency, number>
  fetchedAt: number
}

function readCache(): FxTable | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedFx
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null
    return { perEur: parsed.perEur }
  } catch {
    return null
  }
}

function writeCache(table: FxTable) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ perEur: table.perEur, fetchedAt: Date.now() }))
  } catch {
    // localStorage kullanılamıyorsa (gizli sekme vb.) önbellek atlanır
  }
}

let inFlight: Promise<FxTable | null> | null = null

async function fetchFxTable(): Promise<FxTable | null> {
  const cached = readCache()
  if (cached) return cached

  if (!inFlight) {
    inFlight = fetch('https://api.frankfurter.app/latest?from=EUR&to=USD,TRY')
      .then((res) => {
        if (!res.ok) throw new Error('fx fetch failed')
        return res.json() as Promise<{ rates: { USD: number; TRY: number } }>
      })
      .then(({ rates }) => {
        const table: FxTable = { perEur: { EUR: 1, USD: rates.USD, TRY: rates.TRY } }
        writeCache(table)
        return table
      })
      .catch(() => null)
      .finally(() => {
        inFlight = null
      })
  }
  return inFlight
}

/** Güncel çapraz kur tablosunu döner; yüklenene kadar null verir. */
export function useFxTable(): FxTable | null {
  const [table, setTable] = useState<FxTable | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchFxTable().then((t) => {
      if (!cancelled) setTable(t)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return table
}

/** `amount` (from cinsinden) değerini `to` cinsine çevirir. */
export function convertPrice(amount: number, from: Currency, to: Currency, table: FxTable): number {
  if (from === to) return amount
  const amountInEur = amount / table.perEur[from]
  return amountInEur * table.perEur[to]
}

/** Verilen para biriminin dışındaki diğer iki para birimi, sabit sırayla. */
export function otherCurrencies(currency: Currency): Currency[] {
  return CURRENCIES.filter((c) => c !== currency)
}
