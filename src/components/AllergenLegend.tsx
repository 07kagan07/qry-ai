import { ALLERGEN_LIST } from '../lib/allergens'
import { useT } from '../context/LocaleContext'
import type { UIKey } from '../lib/uiText'
import type { Cafe } from '../lib/types'

interface Props {
  cafe: Cafe
  className?: string
}

// Tüm menü temalarında aynı yasal metni gösteren tek kaynak — tema başına
// kopyalanmaz, içerik hep tutarlı kalır.
export default function AllergenLegend({ cafe, className = '' }: Props) {
  const t = useT()
  return (
    <footer className={`overflow-hidden rounded-xl border border-line bg-surface ${className}`}>
      <div className="p-4 text-xs text-ink-soft">
        <h3 className="font-display mb-2 text-sm font-bold text-ink">{t('allergen.legendTitle')}</h3>
        <p className="mb-3 leading-relaxed">{t('allergen.legendBody')}</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {ALLERGEN_LIST.map((a) => (
            <span key={a.key}>
              {a.icon} {t(`allergen.name.${a.key}` as UIKey)}
            </span>
          ))}
        </div>
        {(cafe.phone || cafe.instagram) && (
          <p className="mt-3 border-t border-line pt-2">
            {cafe.phone && (
              <span className="mr-3">
                {t('allergen.phone')}: {cafe.phone}
              </span>
            )}
            {cafe.instagram && <span>Instagram: {cafe.instagram}</span>}
          </p>
        )}
      </div>
    </footer>
  )
}
