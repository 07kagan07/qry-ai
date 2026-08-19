import { useState } from 'react'
import { ALLERGENS } from '../../../lib/allergens'
import { formatPrice } from '../../../lib/currency'
import type { MenuItem } from '../../../lib/types'
import AllergenFilterBar from '../../../components/AllergenFilterBar'
import AllergenLegend from '../../../components/AllergenLegend'
import ItemDetailModal from '../../../components/ItemDetailModal'
import FxPrice from '../../../components/FxPrice'
import { useT } from '../../../context/LocaleContext'
import type { UIKey } from '../../../lib/uiText'
import type { MenuThemeProps } from './types'

// Klasik Liste: küçük kare görsel solda, ürün adı + noktalı kılavuz + fiyat,
// altında açıklama ve rozetler. Dengeli, tanıdık bir menü hissi. Satıra
// dokununca tam detay bir modalda büyük görselle açılır.
export default function ClassicMenuTheme({
  cafe,
  allCategories,
  shownCategories,
  activeCategory,
  onSelectCategory,
  excludedAllergens,
  onToggleAllergen,
  filterOpen,
  onToggleFilterOpen,
}: MenuThemeProps) {
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const t = useT()

  return (
    <div className="mx-auto max-w-lg pb-20">
      <header className="border-b border-line bg-surface px-5 pt-8 pb-6 text-center">
        {cafe.logo_url && (
          <img
            src={cafe.logo_url}
            alt=""
            className="mx-auto mb-3 h-16 w-16 rounded-full border border-line object-cover"
          />
        )}
        <p className="text-xs font-semibold tracking-[0.2em] text-ink-soft uppercase">{t('nav.menuEyebrow')}</p>
        <h1 className="font-display mt-1 text-4xl font-bold tracking-tight text-cobalt">{cafe.name}</h1>
        {cafe.address && <p className="mt-2 text-sm text-ink-soft">{cafe.address}</p>}
      </header>

      <nav
        aria-label="Menü kategorileri"
        className="scroll-pills sticky top-0 z-10 flex gap-2 overflow-x-auto border-b border-line bg-porcelain/95 px-4 py-3 backdrop-blur"
      >
        <button
          onClick={() => onSelectCategory(null)}
          className={`min-h-11 shrink-0 touch-manipulation rounded-full px-4 text-sm font-semibold transition-colors active:scale-[0.97] ${
            activeCategory === null ? 'bg-cobalt text-white' : 'bg-surface text-ink-soft hover:text-cobalt'
          }`}
        >
          {t('nav.all')}
        </button>
        {allCategories.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelectCategory(c.id)}
            className={`min-h-11 shrink-0 touch-manipulation rounded-full px-4 text-sm font-semibold transition-colors active:scale-[0.97] ${
              activeCategory === c.id ? 'bg-cobalt text-white' : 'bg-surface text-ink-soft hover:text-cobalt'
            }`}
          >
            {c.name}
          </button>
        ))}
      </nav>

      <AllergenFilterBar
        excluded={excludedAllergens}
        onToggle={onToggleAllergen}
        open={filterOpen}
        onToggleOpen={onToggleFilterOpen}
        className="border-b border-line bg-porcelain px-4 py-2"
      />

      <main className="px-5 py-6">
        {shownCategories.length === 0 && (
          <p className="py-12 text-center text-sm text-ink-soft">{t('nav.noResults')}</p>
        )}
        {shownCategories.map((cat) => (
          <section key={cat.id} className="mb-9">
            <h2 className="font-display mb-4 border-b border-line pb-2 text-xl font-bold text-ink">
              {cat.name}
            </h2>
            <ul className="space-y-5">
              {cat.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedItem(item)}
                    className="flex w-full touch-manipulation gap-3 rounded-lg text-left transition-colors hover:bg-surface active:bg-surface"
                  >
                    {item.image_url && (
                      <img
                        src={item.image_url}
                        alt=""
                        width={80}
                        height={80}
                        loading="lazy"
                        className="h-20 w-20 shrink-0 rounded-lg border border-line object-cover"
                      />
                    )}
                    <span className="block min-w-0 flex-1">
                      <span className="flex items-baseline">
                        <h3 className="min-w-0 font-semibold break-words text-ink">{item.name}</h3>
                        <span className="dot-leader" aria-hidden />
                        <span className="font-display shrink-0 font-bold text-cobalt">
                          {formatPrice(item.price, cafe.currency)}
                        </span>
                      </span>
                      <FxPrice
                        price={item.price}
                        currency={cafe.currency}
                        className="block text-right text-[11px] text-ink-soft/70"
                      />
                      {item.description && (
                        <span className="mt-0.5 block text-sm text-ink-soft">{item.description}</span>
                      )}
                      {/* Satırda sadece ikon-only rozetler — tam etiket/açıklama detayına
                          tıklanınca açılan ItemDetailModal'da yer alır. Bilgi hiç gizlenmez
                          (ikon her zaman görünür), yalnızca tam metin bir tıkla açılır. */}
                      <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                        {item.kcal != null && (
                          <span className="rounded-md border border-line bg-surface px-2 py-0.5 font-medium text-ink-soft">
                            {t('badge.kcal', { n: item.kcal })}
                          </span>
                        )}
                        {item.contains_alcohol && (
                          <span title={t('badge.alcohol')} aria-hidden>
                            🍷
                          </span>
                        )}
                        {item.contains_pork && (
                          <span title={t('badge.pork')} aria-hidden>
                            🥓
                          </span>
                        )}
                        {item.allergens.map((a) => (
                          <span key={a} title={t(`allergen.name.${a}` as UIKey)} aria-hidden>
                            {ALLERGENS[a].icon}
                          </span>
                        ))}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <AllergenLegend cafe={cafe} className="mt-10" />
      </main>

      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          currency={cafe.currency}
          orderEnabled={cafe.order_enabled}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  )
}
