import { useFxTable, convertPrice, otherCurrencies } from '../lib/exchangeRates'
import { CURRENCY_SYMBOLS, type Currency } from '../lib/currency'

interface Props {
  price: number
  /** Fiyatın kaydedildiği para birimi (kafenin para birimi) */
  currency: Currency
  className?: string
}

// Kafenin para biriminden fiyatın diğer iki para birimindeki karşılığı.
// Kurlar henüz yüklenmediyse (veya yüklenemediyse) hiçbir şey göstermez —
// asıl kayıtlı fiyat (kendi para biriminde) zaten her zaman görünür.
export default function FxPrice({ price, currency, className }: Props) {
  const table = useFxTable()
  if (!table) return null

  const parts = otherCurrencies(currency).map(
    (c) => `${CURRENCY_SYMBOLS[c]}${convertPrice(price, currency, c, table).toFixed(2)}`,
  )

  return <span className={className}>{parts.join(' · ')}</span>
}
