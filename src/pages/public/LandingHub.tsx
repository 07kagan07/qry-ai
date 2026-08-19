import { useState } from 'react'
import type { Cafe } from '../../lib/types'
import { Button } from '../../components/ui'
import { useT } from '../../context/LocaleContext'

interface Props {
  cafe: Cafe
  onEnterMenu: () => void
}

// QR okutulduğunda menüden önce gösterilebilen, opsiyonel çok amaçlı giriş
// ekranı: kapak görseli, hızlı bağlantılar (WiFi, Instagram, web sitesi,
// telefon, konum) ve menüye geçiş butonu.
export default function LandingHub({ cafe, onEnterMenu }: Props) {
  const [wifiCopied, setWifiCopied] = useState(false)
  const t = useT()

  async function copyWifiPassword() {
    if (!cafe.wifi_password) return
    try {
      await navigator.clipboard.writeText(cafe.wifi_password)
      setWifiCopied(true)
      window.setTimeout(() => setWifiCopied(false), 1600)
    } catch {
      // Panoya erişim engellenmiş olabilir (izin, HTTP bağlamı) — sessizce yoksay,
      // şifre zaten ekranda okunabilir durumda.
    }
  }

  const instagramUrl = cafe.instagram
    ? `https://instagram.com/${cafe.instagram.replace(/^@/, '')}`
    : null
  const mapsUrl = cafe.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${cafe.name} ${cafe.address}`)}`
    : null

  const hasQuickLinks = Boolean(
    cafe.wifi_ssid || instagramUrl || cafe.website_url || cafe.phone || mapsUrl,
  )

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col pb-8">
      {cafe.cover_image_url ? (
        <div className="aspect-[4/3] w-full shrink-0 bg-porcelain">
          <img src={cafe.cover_image_url} alt="" className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className="flex aspect-[4/3] w-full shrink-0 items-center justify-center bg-cobalt" aria-hidden>
          <span className="font-display text-6xl text-white/25">☕</span>
        </div>
      )}

      <div className="-mt-8 flex-1 rounded-t-3xl bg-porcelain px-5 pt-7 pb-4 text-center">
        {cafe.logo_url && (
          <img
            src={cafe.logo_url}
            alt=""
            className="mx-auto -mt-14 mb-3 h-16 w-16 rounded-full border-4 border-porcelain bg-white object-cover shadow-sm"
          />
        )}
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink">{cafe.name}</h1>
        {cafe.address && <p className="mt-1.5 text-sm text-ink-soft">{cafe.address}</p>}

        <Button onClick={onEnterMenu} className="mt-6 w-full text-base">
          {t('landing.goToMenu')}
        </Button>

        {hasQuickLinks && (
          <ul className="mt-6 space-y-2 text-left">
            {cafe.wifi_ssid && (
              <li className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold tracking-wide text-ink-soft uppercase">
                    {t('landing.wifi')}
                  </p>
                  <p className="truncate text-sm font-medium text-ink">{cafe.wifi_ssid}</p>
                  {cafe.wifi_password && (
                    <p className="truncate text-xs text-ink-soft">
                      {t('landing.wifiPassword', { password: cafe.wifi_password })}
                    </p>
                  )}
                </div>
                {cafe.wifi_password && (
                  <button
                    type="button"
                    onClick={copyWifiPassword}
                    className="min-h-11 shrink-0 touch-manipulation rounded-lg border border-line px-3 text-xs font-semibold text-cobalt active:scale-[0.97]"
                  >
                    {wifiCopied ? `${t('landing.copied')} ✓` : t('landing.copyPassword')}
                  </button>
                )}
              </li>
            )}

            {instagramUrl && (
              <li>
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-11 touch-manipulation items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 active:scale-[0.98]"
                >
                  <span aria-hidden>📷</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                    {cafe.instagram}
                  </span>
                  <span aria-hidden className="shrink-0 text-ink-soft">
                    ›
                  </span>
                </a>
              </li>
            )}

            {cafe.website_url && (
              <li>
                <a
                  href={cafe.website_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-11 touch-manipulation items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 active:scale-[0.98]"
                >
                  <span aria-hidden>🔗</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                    {cafe.website_url.replace(/^https?:\/\//, '')}
                  </span>
                  <span aria-hidden className="shrink-0 text-ink-soft">
                    ›
                  </span>
                </a>
              </li>
            )}

            {cafe.phone && (
              <li>
                <a
                  href={`tel:${cafe.phone}`}
                  className="flex min-h-11 touch-manipulation items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 active:scale-[0.98]"
                >
                  <span aria-hidden>📞</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{cafe.phone}</span>
                  <span aria-hidden className="shrink-0 text-ink-soft">
                    ›
                  </span>
                </a>
              </li>
            )}

            {mapsUrl && (
              <li>
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-11 touch-manipulation items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 active:scale-[0.98]"
                >
                  <span aria-hidden>📍</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                    {t('landing.directions')}
                  </span>
                  <span aria-hidden className="shrink-0 text-ink-soft">
                    ›
                  </span>
                </a>
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  )
}
