import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { usePublicMenu } from '../../lib/usePublicMenu'
import { ALLERGENS, ALLERGEN_LIST, type AllergenKey } from '../../lib/allergens'
import { Spinner } from '../../components/ui'

export default function PublicMenu() {
  const { slug } = useParams()
  const { cafe, categories, loading, error } = usePublicMenu(slug)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [excluded, setExcluded] = useState<AllergenKey[]>([])
  const [filterOpen, setFilterOpen] = useState(false)

  const visibleCategories = useMemo(() => {
    return categories
      .map((c) => ({
        ...c,
        items: c.items.filter((i) => !i.allergens.some((a) => excluded.includes(a))),
      }))
      .filter((c) => c.items.length > 0)
  }, [categories, excluded])

  if (loading) return <Spinner label="Menü yükleniyor…" />
  if (error || !cafe) {
    return (
      <div className="mx-auto mt-24 max-w-sm px-4 text-center">
        <p className="font-display text-2xl font-bold text-cobalt">Menü bulunamadı</p>
        <p className="mt-2 text-sm text-ink-soft">
          Adres yanlış yazılmış olabilir. QR kodu yeniden okutmayı deneyin.
        </p>
      </div>
    )
  }

  const shown = activeCategory
    ? visibleCategories.filter((c) => c.id === activeCategory)
    : visibleCategories

  return (
    <div className="mx-auto max-w-lg pb-20">
      {/* Başlık */}
      <header className="border-b border-line bg-surface px-5 pt-8 pb-6 text-center">
        {cafe.logo_url && (
          <img
            src={cafe.logo_url}
            alt=""
            className="mx-auto mb-3 h-16 w-16 rounded-full border border-line object-cover"
          />
        )}
        <p className="text-xs font-semibold tracking-[0.2em] text-ink-soft uppercase">Menü</p>
        <h1 className="font-display mt-1 text-4xl font-bold tracking-tight text-cobalt">
          {cafe.name}
        </h1>
        {cafe.address && <p className="mt-2 text-sm text-ink-soft">{cafe.address}</p>}
      </header>

      {/* Kategori gezinme */}
      <nav
        aria-label="Menü kategorileri"
        className="scroll-pills sticky top-0 z-10 flex gap-2 overflow-x-auto border-b border-line bg-porcelain/95 px-4 py-3 backdrop-blur"
      >
        <button
          onClick={() => setActiveCategory(null)}
          className={`min-h-11 shrink-0 touch-manipulation rounded-full px-4 text-sm font-semibold transition-colors active:scale-[0.97] ${
            activeCategory === null
              ? 'bg-cobalt text-white'
              : 'bg-surface text-ink-soft hover:text-cobalt'
          }`}
        >
          Tümü
        </button>
        {visibleCategories.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCategory(c.id)}
            className={`min-h-11 shrink-0 touch-manipulation rounded-full px-4 text-sm font-semibold transition-colors active:scale-[0.97] ${
              activeCategory === c.id
                ? 'bg-cobalt text-white'
                : 'bg-surface text-ink-soft hover:text-cobalt'
            }`}
          >
            {c.name}
          </button>
        ))}
      </nav>

      {/* Alerjen filtresi */}
      <div className="border-b border-line bg-porcelain px-4 py-2">
        <button
          onClick={() => setFilterOpen(!filterOpen)}
          aria-expanded={filterOpen}
          className="min-h-11 text-sm font-semibold text-coral-deep"
        >
          Alerjen filtresi{excluded.length > 0 && ` · ${excluded.length} hariç`} {filterOpen ? '▴' : '▾'}
        </button>
        {filterOpen && (
          <div className="pb-3">
            <p className="mb-2 text-xs text-ink-soft">
              İçermesini istemediğiniz alerjenleri seçin; o ürünler listeden çıkar.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ALLERGEN_LIST.map((a) => {
                const on = excluded.includes(a.key)
                return (
                  <button
                    key={a.key}
                    onClick={() =>
                      setExcluded(on ? excluded.filter((k) => k !== a.key) : [...excluded, a.key])
                    }
                    aria-pressed={on}
                    className={`min-h-9 touch-manipulation rounded-md border px-2.5 py-1 text-xs font-medium transition-colors active:scale-[0.97] ${
                      on
                        ? 'border-coral bg-coral text-white'
                        : 'border-line bg-surface text-ink-soft hover:border-coral hover:text-coral-deep'
                    }`}
                  >
                    {a.icon} {a.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Ürünler */}
      <main className="px-5 py-6">
        {shown.length === 0 && (
          <p className="py-12 text-center text-sm text-ink-soft">
            Bu filtrelere uyan ürün kalmadı. Filtreyi gevşetmeyi deneyin.
          </p>
        )}
        {shown.map((cat) => (
          <section key={cat.id} className="mb-9">
            <h2 className="font-display mb-4 border-b border-line pb-2 text-xl font-bold text-ink">
              {cat.name}
            </h2>
            <ul className="space-y-5">
              {cat.items.map((item) => (
                <li key={item.id} className="flex gap-3">
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
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline">
                      <h3 className="min-w-0 font-semibold break-words text-ink">{item.name}</h3>
                      <span className="dot-leader" aria-hidden />
                      <span className="font-display shrink-0 font-bold text-cobalt">
                        ₺{Number(item.price).toFixed(2)}
                      </span>
                    </div>
                    {item.description && (
                      <p className="mt-0.5 text-sm text-ink-soft">{item.description}</p>
                    )}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
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
                          title={`${ALLERGENS[a].label}: ${ALLERGENS[a].description}`}
                          className="rounded-md border border-coral-soft bg-coral-soft/60 px-2 py-0.5 text-coral-deep"
                        >
                          {ALLERGENS[a].icon} {ALLERGENS[a].label}
                        </span>
                      ))}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {/* Mevzuat lejantı */}
        <footer className="mt-10 overflow-hidden rounded-xl border border-line bg-surface">
          <div className="p-4 text-xs text-ink-soft">
            <h3 className="font-display mb-2 text-sm font-bold text-ink">Alerjen bilgilendirmesi</h3>
            <p className="mb-3 leading-relaxed">
              Alerjen, enerji (kcal), alkol ve domuz ürünü bilgileri Türk Gıda Kodeksi Gıda
              Etiketleme ve Tüketicileri Bilgilendirme Yönetmeliği kapsamında beyan edilmiştir.
              Şiddetli alerjiniz varsa siparişten önce personelimize danışın.
            </p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
              {ALLERGEN_LIST.map((a) => (
                <span key={a.key}>
                  {a.icon} {a.label}
                </span>
              ))}
            </div>
            {(cafe.phone || cafe.instagram) && (
              <p className="mt-3 border-t border-line pt-2">
                {cafe.phone && <span className="mr-3">Tel: {cafe.phone}</span>}
                {cafe.instagram && <span>Instagram: {cafe.instagram}</span>}
              </p>
            )}
          </div>
        </footer>
      </main>
    </div>
  )
}
