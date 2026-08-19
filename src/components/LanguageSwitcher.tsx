import { useState } from 'react'
import { LOCALE_NATIVE_NAMES, LOCALE_FLAGS, type LocaleKey } from '../lib/locales'
import type { Cafe } from '../lib/types'

interface Props {
  cafe: Cafe
  locale: LocaleKey | null
  onChange: (locale: LocaleKey | null) => void
}

const TR_FLAG = '🇹🇷'

// Diğer floating butonlardan (Rezervasyon/Garson Çağır/Sepet, hepsi alt
// kısımda) farklı olarak sağ-üstte konumlanır. cafe.enabled_locales boşsa
// hiçbir şey render etmez (özellik varsayılan kapalı).
export default function LanguageSwitcher({ cafe, locale, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const enabled = cafe.enabled_locales ?? []

  if (enabled.length === 0) return null

  const currentFlag = locale ? LOCALE_FLAGS[locale] : TR_FLAG
  const currentLabel = locale ? LOCALE_NATIVE_NAMES[locale] : 'Türkçe'

  function select(next: LocaleKey | null) {
    onChange(next)
    setOpen(false)
  }

  return (
    <div className="fixed top-4 right-4 z-30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 touch-manipulation items-center gap-1.5 rounded-full border border-line bg-white px-3 py-2 text-sm font-semibold text-ink shadow-lg active:scale-[0.97]"
      >
        <span aria-hidden>{currentFlag}</span>
        {currentLabel}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="menu"
            className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded-lg border border-line bg-surface shadow-lg"
          >
            <button
              role="menuitem"
              type="button"
              onClick={() => select(null)}
              className={`block min-h-11 w-full px-4 text-left text-sm hover:bg-porcelain ${
                locale === null ? 'font-semibold text-cobalt' : 'text-ink'
              }`}
            >
              {TR_FLAG} Türkçe
            </button>
            {enabled.map((l) => (
              <button
                key={l}
                role="menuitem"
                type="button"
                onClick={() => select(l)}
                className={`block min-h-11 w-full px-4 text-left text-sm hover:bg-porcelain ${
                  locale === l ? 'font-semibold text-cobalt' : 'text-ink'
                }`}
              >
                {LOCALE_FLAGS[l]} {LOCALE_NATIVE_NAMES[l]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
