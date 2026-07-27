import { ALLERGEN_LIST, type AllergenKey } from '../lib/allergens'

interface Props {
  value: AllergenKey[]
  onChange: (next: AllergenKey[]) => void
}

// Alerjenler "çini karosu" gibi küçük kare seçiciler: seçiliyken mercan —
// mercan bu arayüzde her zaman "dikkat" anlamı taşır.
export default function AllergenPicker({ value, onChange }: Props) {
  function toggle(key: AllergenKey) {
    onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key])
  }

  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
      {ALLERGEN_LIST.map((a) => {
        const active = value.includes(a.key)
        return (
          <button
            key={a.key}
            type="button"
            title={a.description}
            onClick={() => toggle(a.key)}
            aria-pressed={active}
            className={`flex min-h-11 items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left text-xs transition-colors ${
              active
                ? 'border-coral bg-coral-soft font-semibold text-coral-deep'
                : 'border-line bg-surface text-ink-soft hover:border-line-strong'
            }`}
          >
            <span aria-hidden>{a.icon}</span>
            <span className="truncate">{a.label}</span>
          </button>
        )
      })}
    </div>
  )
}
