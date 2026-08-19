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

// Kompakt Liste: görselsiz, sık aralıklı, minimum gezinme yükü. Çok ürünlü
// menülerde (kebapçı, fast-food) az kaydırma ile çok bilgi hedefler. Satır
// tek satıra sıkıştığı için dokununca açılan detay modalı tam açıklamayı verir.
export default function CompactMenuTheme({
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
    <div className="mx-auto max-w-lg pb-16">
      <header className="border-b border-line bg-surface px-5 pt-5 pb-4 text-center">
        <h1 className="font-display text-2xl font-bold tracking-tight text-cobalt">{cafe.name}</h1>
        {cafe.address && <p className="mt-1 text-xs text-ink-soft">{cafe.address}</p>}
      </header>

      <nav
        aria-label="Menü kategorileri"
        className="scroll-pills sticky top-0 z-10 flex gap-3 overflow-x-auto border-b border-line bg-porcelain/95 px-4 py-1.5 text-xs backdrop-blur"
      >
        <button
          onClick={() => onSelectCategory(null)}
          className={`min-h-9 shrink-0 touch-manipulation border-b-2 px-0.5 font-semibold transition-colors ${
            activeCategory === null
              ? 'border-cobalt text-cobalt'
              : 'border-transparent text-ink-soft hover:text-cobalt'
          }`}
        >
          {t('nav.all')}
        </button>
        {allCategories.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelectCategory(c.id)}
            className={`min-h-9 shrink-0 touch-manipulation border-b-2 px-0.5 font-semibold transition-colors ${
              activeCategory === c.id
                ? 'border-cobalt text-cobalt'
                : 'border-transparent text-ink-soft hover:text-cobalt'
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
        className="border-b border-line bg-porcelain px-4 py-1.5"
      />

      <main className="px-4 py-4">
        {shownCategories.length === 0 && (
          <p className="py-12 text-center text-sm text-ink-soft">{t('nav.noResults')}</p>
        )}
        {shownCategories.map((cat) => (
          <section key={cat.id} className="mb-4">
            <h2 className="font-display mt-3 mb-1 text-sm font-bold tracking-wide text-cobalt uppercase">
              {cat.name}
            </h2>
            <ul>
              {cat.items.map((item) => {
                const hasMeta =
                  item.kcal != null ||
                  item.allergens.length > 0 ||
                  item.contains_alcohol ||
                  item.contains_pork
                return (
                  <li key={item.id} className="border-b border-line/60 last:border-b-0">
                    <button
                      type="button"
                      onClick={() => setSelectedItem(item)}
                      className="block w-full touch-manipulation py-1.5 text-left transition-colors hover:bg-surface active:bg-surface"
                    >
                      <span className="flex items-baseline gap-2 text-sm">
                        <span className="min-w-0 flex-1 truncate font-medium text-ink">{item.name}</span>
                        <span className="dot-leader" aria-hidden />
                        <span className="font-display shrink-0 font-bold text-cobalt">
                          {formatPrice(item.price, cafe.currency)}
                        </span>
                      </span>
                      <FxPrice
                        price={item.price}
                        currency={cafe.currency}
                        className="block text-right text-[10px] text-ink-soft/70"
                      />
                      {/* Alerjen/kalori bilgisi mevzuat gereği asla kesilmez — yoğun
                          düzende bile bu satır tam olarak sarmalanır. */}
                      {hasMeta && (
                        <span className="mt-0.5 block text-[11px] text-ink-soft">
                          {[
                            item.kcal != null ? t('badge.kcal', { n: item.kcal }) : null,
                            item.contains_alcohol ? t('badge.alcohol') : null,
                            item.contains_pork ? t('badge.pork') : null,
                            item.allergens.length > 0
                              ? item.allergens
                                  .map((a) => `${ALLERGENS[a].icon} ${t(`allergen.name.${a}` as UIKey)}`)
                                  .join(', ')
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}

        <AllergenLegend cafe={cafe} className="mt-6" />
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
