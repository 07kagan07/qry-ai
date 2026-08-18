import { useState } from 'react'
import { ALLERGENS } from '../../../lib/allergens'
import { formatPrice } from '../../../lib/currency'
import type { MenuItem } from '../../../lib/types'
import AllergenFilterBar from '../../../components/AllergenFilterBar'
import AllergenLegend from '../../../components/AllergenLegend'
import ItemDetailModal from '../../../components/ItemDetailModal'
import FxPrice from '../../../components/FxPrice'
import type { MenuThemeProps } from './types'

// Görsel Izgara: 2-3 sütunlu, fotoğraf öne çıkan kartlar. AI ile üretilen ya
// da yüklenen ürün görsellerini en iyi şekilde gösteren tema. Kartlar yer
// kısıtlı olduğu için tıklayınca tam detay (açıklama, alerjen etiketleri) bir
// modalda açılır — dokunmatik cihazlarda ikon üzerindeki title tooltip'i
// çalışmadığından bu, tam alerjen bilgisine tek erişim yolu.
export default function GridMenuTheme({
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

  return (
    <div className="mx-auto max-w-2xl pb-20">
      <header className="border-b border-line bg-surface px-5 pt-8 pb-6 text-center">
        {cafe.logo_url && (
          <img
            src={cafe.logo_url}
            alt=""
            className="mx-auto mb-3 h-16 w-16 rounded-full border border-line object-cover"
          />
        )}
        <p className="text-xs font-semibold tracking-[0.2em] text-ink-soft uppercase">Menü</p>
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
          Tümü
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

      <main className="px-4 py-6">
        {shownCategories.length === 0 && (
          <p className="py-12 text-center text-sm text-ink-soft">
            Bu filtrelere uyan ürün kalmadı. Filtreyi gevşetmeyi deneyin.
          </p>
        )}
        {shownCategories.map((cat) => (
          <section key={cat.id} className="mb-8">
            <h2 className="font-display mb-3 px-1 text-xl font-bold text-ink">{cat.name}</h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {cat.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedItem(item)}
                    className="w-full touch-manipulation overflow-hidden rounded-xl border border-line bg-surface text-left transition-transform active:scale-[0.98]"
                  >
                    <span className="block aspect-square w-full bg-porcelain">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span
                          className="flex h-full w-full items-center justify-center text-3xl text-ink-soft/40"
                          aria-hidden
                        >
                          🍽️
                        </span>
                      )}
                    </span>
                    <span className="block p-2.5">
                      <h3 className="line-clamp-1 text-sm font-semibold text-ink">{item.name}</h3>
                      <span className="font-display block text-sm font-bold text-cobalt">
                        {formatPrice(item.price, cafe.currency)}
                      </span>
                      <FxPrice
                        price={item.price}
                        currency={cafe.currency}
                        className="block text-[10px] text-ink-soft/70"
                      />
                      {item.description && (
                        <span className="mt-0.5 line-clamp-2 block text-xs text-ink-soft">
                          {item.description}
                        </span>
                      )}
                      {(item.kcal != null ||
                        item.allergens.length > 0 ||
                        item.contains_alcohol ||
                        item.contains_pork) && (
                        <span className="mt-1.5 flex flex-wrap items-center gap-1 text-[11px]">
                          {item.kcal != null && (
                            <span className="rounded border border-line bg-porcelain px-1.5 py-0.5 text-ink-soft">
                              {item.kcal} kcal
                            </span>
                          )}
                          {item.contains_alcohol && <span aria-hidden>🍷</span>}
                          {item.contains_pork && <span aria-hidden>🥓</span>}
                          {item.allergens.map((a) => (
                            <span key={a} aria-hidden>
                              {ALLERGENS[a].icon}
                            </span>
                          ))}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <AllergenLegend cafe={cafe} className="mt-6" />
      </main>

      {selectedItem && (
        <ItemDetailModal item={selectedItem} currency={cafe.currency} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  )
}
