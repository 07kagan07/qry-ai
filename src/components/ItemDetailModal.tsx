import { useEffect, useRef } from 'react'
import { ALLERGENS } from '../lib/allergens'
import { formatPrice, type Currency } from '../lib/currency'
import type { MenuItem } from '../lib/types'
import FxPrice from './FxPrice'

interface Props {
  item: MenuItem
  currency: Currency
  onClose: () => void
}

// Tüm menü temalarında paylaşılan salt-okunur ürün detayı — mobilde alttan
// açılan bir sayfa (bottom sheet), masaüstünde ortalanmış bir kutu.
// Işıklandırma: ızgara/kompakt temalarda kısaltılan açıklama ve ikon-only
// alerjen rozetlerinin tam hâlini burada gösteriyoruz (dokunmatik cihazlarda
// title tooltip'i çalışmadığı için bu, alerjen bilgisine tek erişim yolu).
export default function ItemDetailModal({ item, currency, onClose }: Props) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeButtonRef.current?.focus()
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const hasMeta = item.kcal != null || item.contains_alcohol || item.contains_pork

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onClick={onClose}
      style={{ overscrollBehavior: 'contain' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-detail-title"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
      >
        <div className="flex shrink-0 justify-center pt-2 sm:hidden" aria-hidden>
          <span className="h-1.5 w-10 rounded-full bg-line-strong" />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {item.image_url && (
            <img src={item.image_url} alt="" className="aspect-[4/3] w-full object-cover" />
          )}

          <div className="p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 id="item-detail-title" className="font-display text-2xl font-bold break-words text-ink">
                {item.name}
              </h2>
              <span className="shrink-0 text-right">
                <span className="font-display block text-xl font-bold text-cobalt">
                  {formatPrice(item.price, currency)}
                </span>
                <FxPrice price={item.price} currency={currency} className="block text-xs text-ink-soft" />
              </span>
            </div>

            {item.description && (
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{item.description}</p>
            )}

            {hasMeta && (
              <div className="mt-4 flex flex-wrap items-center gap-1.5 text-xs">
                {item.kcal != null && (
                  <span className="rounded-md border border-line bg-porcelain px-2 py-1 font-medium text-ink-soft">
                    {item.kcal} kcal
                  </span>
                )}
                {item.contains_alcohol && (
                  <span className="rounded-md bg-cobalt-soft px-2 py-1 font-medium text-cobalt-deep">
                    Alkollü
                  </span>
                )}
                {item.contains_pork && (
                  <span className="rounded-md bg-coral-soft px-2 py-1 font-medium text-coral-deep">
                    Domuz ürünü
                  </span>
                )}
              </div>
            )}

            {item.allergens.length > 0 && (
              <div className="mt-4">
                <p className="mb-1.5 text-xs font-semibold tracking-wide text-ink-soft uppercase">
                  Alerjenler
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {item.allergens.map((a) => (
                    <span
                      key={a}
                      title={ALLERGENS[a].description}
                      className="rounded-md border border-coral-soft bg-coral-soft/60 px-2 py-1 text-xs text-coral-deep"
                    >
                      {ALLERGENS[a].icon} {ALLERGENS[a].label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-line p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4">
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="min-h-11 w-full touch-manipulation rounded-lg bg-cobalt-soft text-sm font-semibold text-cobalt-deep transition-colors hover:bg-cobalt-soft/70 active:scale-[0.98]"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  )
}
