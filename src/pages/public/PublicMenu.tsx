import { useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { usePublicMenu } from '../../lib/usePublicMenu'
import type { AllergenKey } from '../../lib/allergens'
import { RTL_LOCALES, isLocaleKey, type LocaleKey } from '../../lib/locales'
import { UI_TEXT } from '../../lib/uiText'
import { Spinner } from '../../components/ui'
import CallWaiterButton from '../../components/CallWaiterButton'
import ReservationButton from '../../components/ReservationButton'
import CartButton from '../../components/CartButton'
import LanguageSwitcher from '../../components/LanguageSwitcher'
import { CartProvider } from '../../context/CartContext'
import { LocaleProvider } from '../../context/LocaleContext'
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

function localeStorageKey(slug: string) {
  return `qr-menu:locale:${slug}`
}

function readStoredLocale(slug: string | undefined): LocaleKey | null {
  if (!slug) return null
  try {
    const stored = localStorage.getItem(localeStorageKey(slug))
    return stored && isLocaleKey(stored) ? stored : null
  } catch {
    return null
  }
}

// PublicMenu: veri çekme + alerjen filtresi + kategori seçimi burada tek
// yerde yönetilir; görünüm tamamen seçili temaya devredilir (themes/*.tsx).
export default function PublicMenu() {
  const { slug } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const [locale, setLocaleState] = useState<LocaleKey | null>(() => readStoredLocale(slug))
  const { cafe, categories, loading, error } = usePublicMenu(slug, locale)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [excluded, setExcluded] = useState<AllergenKey[]>([])
  const [filterOpen, setFilterOpen] = useState(false)

  function setLocale(next: LocaleKey | null) {
    setLocaleState(next)
    if (!slug) return
    try {
      if (next) localStorage.setItem(localeStorageKey(slug), next)
      else localStorage.removeItem(localeStorageKey(slug))
    } catch {
      // localStorage kullanılamıyorsa (gizli sekme vb.) sessizce yoksay.
    }
  }

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
    // Bu iki mesaj LocaleProvider ağacının dışında (henüz hangi kafenin
    // enabled_locales'ine sahip olduğumuzu bilmiyoruz) — bu yüzden useT()
    // yerine doğrudan sözlükten okunuyor, aynı yer tutucu mantığıyla.
    const lang = locale ?? 'tr'
    return (
      <div className="mx-auto mt-24 max-w-sm px-4 text-center">
        <p className="font-display text-2xl font-bold text-cobalt">{UI_TEXT['notFound.title'][lang]}</p>
        <p className="mt-2 text-sm text-ink-soft">{UI_TEXT['notFound.body'][lang]}</p>
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
  const dir = locale && RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr'

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
      <div dir={dir}>
        <LocaleProvider locale={locale}>
          <CartProvider cafeSlug={cafe.slug}>
            <LandingHub cafe={cafe} onEnterMenu={enterMenu} />
            <CallWaiterButton cafe={cafe} sessionId={sessionId} />
            <ReservationButton cafe={cafe} />
            <CartButton cafe={cafe} />
            <LanguageSwitcher cafe={cafe} locale={locale} onChange={setLocale} />
          </CartProvider>
        </LocaleProvider>
      </div>
    )
  }

  const ThemeComponent = THEME_COMPONENTS[cafe.menu_theme] ?? ClassicMenuTheme

  return (
    <div dir={dir}>
      <LocaleProvider locale={locale}>
        <CartProvider cafeSlug={cafe.slug}>
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
          <ReservationButton cafe={cafe} />
          <CartButton cafe={cafe} />
          <LanguageSwitcher cafe={cafe} locale={locale} onChange={setLocale} />
        </CartProvider>
      </LocaleProvider>
    </div>
  )
}
