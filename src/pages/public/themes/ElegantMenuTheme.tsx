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

// Zarif Menü: görselsiz, ortalanmış, tipografi odaklı — basılı restoran
// menüsü hissi. Ürün görselleri satır düzeninde bilinçli olarak gösterilmez,
// ama üründe görsel varsa dokununca açılan detayda görülebilir.
export default function ElegantMenuTheme({
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
      <header className="border-b border-line bg-surface px-5 pt-10 pb-7 text-center">
        {cafe.logo_url && (
          <img
            src={cafe.logo_url}
            alt=""
            className="mx-auto mb-4 h-16 w-16 rounded-full border border-line object-cover"
          />
        )}
        <h1 className="font-display text-4xl font-bold tracking-tight text-ink">{cafe.name}</h1>
        <p className="mx-auto mt-3 h-px w-16 bg-line" aria-hidden />
        {cafe.address && <p className="mt-3 text-sm text-ink-soft">{cafe.address}</p>}
      </header>

      <nav
        aria-label="Menü kategorileri"
        className="sticky top-0 z-10 border-b border-line bg-porcelain/95 px-4 py-3 text-center backdrop-blur"
      >
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-sm">
          <button
            onClick={() => onSelectCategory(null)}
            className={`touch-manipulation border-b-2 px-0.5 py-1 font-medium transition-colors ${
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
              className={`touch-manipulation border-b-2 px-0.5 py-1 font-medium transition-colors ${
                activeCategory === c.id
                  ? 'border-cobalt text-cobalt'
                  : 'border-transparent text-ink-soft hover:text-cobalt'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </nav>

      <AllergenFilterBar
        excluded={excludedAllergens}
        onToggle={onToggleAllergen}
        open={filterOpen}
        onToggleOpen={onToggleFilterOpen}
        className="border-b border-line bg-porcelain px-4 py-2 text-center"
      />

      <main className="px-5 py-8">
        {shownCategories.length === 0 && (
          <p className="py-12 text-center text-sm text-ink-soft">{t('nav.noResults')}</p>
        )}
        {shownCategories.map((cat) => (
          <section key={cat.id} className="mb-10">
            <h2 className="font-display mb-6 flex items-center justify-center gap-3 text-lg font-bold tracking-[0.08em] text-ink uppercase">
              <span className="h-px w-8 bg-line" aria-hidden />
              {cat.name}
              <span className="h-px w-8 bg-line" aria-hidden />
            </h2>
            <ul className="space-y-6">
              {cat.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedItem(item)}
                    className="w-full touch-manipulation rounded-lg py-1 text-center transition-colors hover:bg-surface active:bg-surface"
                  >
                    <span className="mx-auto flex max-w-sm items-baseline">
                      <h3 className="font-display min-w-0 font-semibold break-words text-ink">
                        {item.name}
                      </h3>
                      <span className="dot-leader" aria-hidden />
                      <span className="font-display shrink-0 font-bold text-cobalt">
                        {formatPrice(item.price, cafe.currency)}
                      </span>
                    </span>
                    <FxPrice
                      price={item.price}
                      currency={cafe.currency}
                      className="mt-0.5 block text-center text-[11px] text-ink-soft/70"
                    />
                    {item.description && (
                      <span className="mx-auto mt-1.5 block max-w-sm text-sm text-ink-soft italic">
                        {item.description}
                      </span>
                    )}
                    {/* Satırda sadece ikon-only rozetler — tam etiket/açıklama detayına
                        tıklanınca açılan ItemDetailModal'da yer alır. Bilgi hiç gizlenmez
                        (ikon her zaman görünür), yalnızca tam metin bir tıkla açılır. */}
                    {(item.kcal != null ||
                      item.allergens.length > 0 ||
                      item.contains_alcohol ||
                      item.contains_pork) && (
                      <span className="mt-2 flex flex-wrap items-center justify-center gap-1.5 text-xs">
                        {item.kcal != null && (
                          <span className="rounded-md border border-line px-2 py-0.5 font-medium text-ink-soft">
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
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <AllergenLegend cafe={cafe} className="mt-10 text-left" />
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
