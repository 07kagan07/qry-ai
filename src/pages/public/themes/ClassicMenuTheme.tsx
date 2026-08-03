import { useState } from 'react'
import { ALLERGENS } from '../../../lib/allergens'
import type { MenuItem } from '../../../lib/types'
import AllergenFilterBar from '../../../components/AllergenFilterBar'
import AllergenLegend from '../../../components/AllergenLegend'
import ItemDetailModal from '../../../components/ItemDetailModal'
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

      <main className="px-5 py-6">
        {shownCategories.length === 0 && (
          <p className="py-12 text-center text-sm text-ink-soft">
            Bu filtrelere uyan ürün kalmadı. Filtreyi gevşetmeyi deneyin.
          </p>
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
                          ₺{Number(item.price).toFixed(2)}
                        </span>
                      </span>
                      {item.description && (
                        <span className="mt-0.5 block text-sm text-ink-soft">{item.description}</span>
                      )}
                      <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                        {item.kcal != null && (
                          <span className="rounded-md border border-line bg-surface px-2 py-0.5 font-medium text-ink-soft">
                            {item.kcal} kcal
                          </span>
                        )}
                        {item.contains_alcohol && (
                          <span className="rounded-md bg-cobalt-soft px-2 py-0.5 font-medium text-cobalt-deep">
                            Alkollü
                          </span>
                        )}
                        {item.contains_pork && (
                          <span className="rounded-md bg-coral-soft px-2 py-0.5 font-medium text-coral-deep">
                            Domuz ürünü
                          </span>
                        )}
                        {item.allergens.map((a) => (
                          <span
                            key={a}
                            className="rounded-md border border-coral-soft bg-coral-soft/60 px-2 py-0.5 text-coral-deep"
                          >
                            {ALLERGENS[a].icon} {ALLERGENS[a].label}
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

      {selectedItem && <ItemDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />}
    </div>
  )
}
