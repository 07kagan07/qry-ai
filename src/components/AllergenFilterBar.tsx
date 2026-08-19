import { ALLERGEN_LIST, type AllergenKey } from '../lib/allergens'
import { useT } from '../context/LocaleContext'
import type { UIKey } from '../lib/uiText'

interface Props {
  excluded: AllergenKey[]
  onToggle: (key: AllergenKey) => void
  open: boolean
  onToggleOpen: () => void
  className?: string
}

// Alerjen dışlama filtresi — tüm temalarda aynı davranış ve metin, sadece
// çevresindeki kap (padding/arka plan) temaya göre değişir.
export default function AllergenFilterBar({ excluded, onToggle, open, onToggleOpen, className = '' }: Props) {
  const t = useT()
  return (
    <div className={className}>
      <button
        onClick={onToggleOpen}
        aria-expanded={open}
        className="min-h-11 touch-manipulation text-sm font-semibold text-coral-deep"
      >
        {t('allergen.filterLabel')}
        {excluded.length > 0 && ` · ${t('allergen.filterExcluded', { n: excluded.length })}`}{' '}
        {open ? '▴' : '▾'}
      </button>
      {open && (
        <div className="pb-3">
          <p className="mb-2 text-xs text-ink-soft">{t('allergen.filterHelp')}</p>
          <div className="flex flex-wrap gap-1.5">
            {ALLERGEN_LIST.map((a) => {
              const on = excluded.includes(a.key)
              return (
                <button
                  key={a.key}
                  onClick={() => onToggle(a.key)}
                  aria-pressed={on}
                  className={`min-h-9 touch-manipulation rounded-md border px-2.5 py-1 text-xs font-medium transition-colors active:scale-[0.97] ${
                    on
                      ? 'border-coral bg-coral text-white'
                      : 'border-line bg-surface text-ink-soft hover:border-coral hover:text-coral-deep'
                  }`}
                >
                  {a.icon} {t(`allergen.name.${a.key}` as UIKey)}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
