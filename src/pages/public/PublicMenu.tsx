import { useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { usePublicMenu } from '../../lib/usePublicMenu'
import type { AllergenKey } from '../../lib/allergens'
import { Spinner } from '../../components/ui'
import CallWaiterButton from '../../components/CallWaiterButton'
import LandingHub from './LandingHub'
import ClassicMenuTheme from './themes/ClassicMenuTheme'
import GridMenuTheme from './themes/GridMenuTheme'
import ElegantMenuTheme from './themes/ElegantMenuTheme'
import CompactMenuTheme from './themes/CompactMenuTheme'
import type { MenuThemeProps } from './themes/types'

const THEME_COMPONENTS: Record<string, React.ComponentType<MenuThemeProps>> = {
  classic: ClassicMenuTheme,
  grid: GridMenuTheme,
  elegant: ElegantMenuTheme,
  compact: CompactMenuTheme,
}

// PublicMenu: veri çekme + alerjen filtresi + kategori seçimi burada tek
// yerde yönetilir; görünüm tamamen seçili temaya devredilir (themes/*.tsx).
export default function PublicMenu() {
  const { slug } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { cafe, categories, loading, error } = usePublicMenu(slug)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [excluded, setExcluded] = useState<AllergenKey[]>([])
  const [filterOpen, setFilterOpen] = useState(false)

  const allCategories = useMemo(() => {
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

  const shownCategories = activeCategory
    ? allCategories.filter((c) => c.id === activeCategory)
    : allCategories

  function toggleAllergen(key: AllergenKey) {
    setExcluded((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  const sessionId = searchParams.get('masa')

  function enterMenu() {
    // Mevcut parametreleri (özellikle ?masa=) koruyarak sadece view'i ekler —
    // aksi halde masa oturumu kaybolur ve garson çağırma butonu kaybolurdu.
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('view', 'menu')
      return next
    })
  }

  // Karşılama sayfası opsiyoneldir; QR her zaman aynı /menu/:slug adresini
  // gösterir, "Menüye Git" tıklanınca ?view=menu ile geri tuşuna uyumlu
  // şekilde asıl menüye geçilir.
  if (cafe.menu_landing_enabled && searchParams.get('view') !== 'menu') {
    return (
      <>
        <LandingHub cafe={cafe} onEnterMenu={enterMenu} />
        <CallWaiterButton cafe={cafe} sessionId={sessionId} />
      </>
    )
  }

  const ThemeComponent = THEME_COMPONENTS[cafe.menu_theme] ?? ClassicMenuTheme

  return (
    <>
      <ThemeComponent
        cafe={cafe}
        allCategories={allCategories}
        shownCategories={shownCategories}
        activeCategory={activeCategory}
        onSelectCategory={setActiveCategory}
        excludedAllergens={excluded}
        onToggleAllergen={toggleAllergen}
        filterOpen={filterOpen}
        onToggleFilterOpen={() => setFilterOpen((v) => !v)}
      />
      <CallWaiterButton cafe={cafe} sessionId={sessionId} />
    </>
  )
}
