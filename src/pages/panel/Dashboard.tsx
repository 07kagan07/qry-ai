import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { MENU_THEMES } from '../../lib/menuThemes'
import type { MenuTheme } from '../../lib/types'
import { Button, Card, ErrorText, Input, Label } from '../../components/ui'

// Her tema için küçük, gerçek ekran görüntüsü gerektirmeyen soyut önizleme —
// düzenin şeklini (görsel var mı, ızgara mı liste mi, ortalı mı) anında anlatır.
function ThemePreview({ theme }: { theme: MenuTheme }) {
  if (theme === 'grid') {
    return (
      <div className="grid grid-cols-2 gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="aspect-square rounded bg-line" />
        ))}
      </div>
    )
  }
  if (theme === 'elegant') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1.5">
        <div className="h-1.5 w-10 rounded-full bg-line" />
        <div className="h-1 w-16 rounded-full bg-line/70" />
        <div className="h-1 w-12 rounded-full bg-line/70" />
      </div>
    )
  }
  if (theme === 'compact') {
    return (
      <div className="flex h-full flex-col justify-center gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-1 rounded-full bg-line" style={{ width: `${70 - i * 8}%` }} />
        ))}
      </div>
    )
  }
  // classic
  return (
    <div className="flex h-full flex-col justify-center gap-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div className="h-4 w-4 shrink-0 rounded bg-line" />
          <div className="h-1.5 flex-1 rounded-full bg-line/70" />
        </div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const { cafe, refreshCafe } = useAuth()
  const [name, setName] = useState(cafe?.name ?? '')
  const [address, setAddress] = useState(cafe?.address ?? '')
  const [phone, setPhone] = useState(cafe?.phone ?? '')
  const [instagram, setInstagram] = useState(cafe?.instagram ?? '')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [themeBusy, setThemeBusy] = useState<MenuTheme | null>(null)
  const [themeError, setThemeError] = useState('')

  if (!cafe) return null

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSaved(false)
    setBusy(true)
    const { error } = await supabase
      .from('cafes')
      .update({ name, address: address || null, phone: phone || null, instagram: instagram || null })
      .eq('id', cafe!.id)
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    setSaved(true)
    await refreshCafe()
  }

  async function selectTheme(theme: MenuTheme) {
    if (theme === cafe!.menu_theme || themeBusy) return
    setThemeError('')
    setThemeBusy(theme)
    const { error } = await supabase.from('cafes').update({ menu_theme: theme }).eq('id', cafe!.id)
    setThemeBusy(null)
    if (error) {
      setThemeError(error.message)
      return
    }
    await refreshCafe()
  }

  return (
    <div className="max-w-xl">
      <h1 className="mb-4 text-xl font-bold">Kafe Bilgileri</h1>
      <Card>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label>Kafe Adı</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <Label>Adres</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Menü altında gösterilir" />
          </div>
          <div>
            <Label>Telefon</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <Label>Instagram</Label>
            <Input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@kullaniciadi" />
          </div>
          <ErrorText>{error}</ErrorText>
          {saved && <p className="text-sm text-teal-deep">Kaydedildi.</p>}
          <Button type="submit" disabled={busy}>
            {busy ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        </form>
      </Card>

      <Card className="mt-4">
        <h2 className="mb-1 font-semibold text-ink">Menü Görünümü</h2>
        <p className="mb-3 text-sm text-ink-soft">
          Müşterilerinizin QR kodu okuttuğunda göreceği menü tasarımını seçin. Değişiklik anında
          yayına alınır.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {MENU_THEMES.map((t) => {
            const active = cafe.menu_theme === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => selectTheme(t.id)}
                disabled={themeBusy !== null}
                aria-pressed={active}
                className={`flex min-h-11 touch-manipulation flex-col gap-2 rounded-xl border p-3 text-left transition-colors active:scale-[0.98] ${
                  active
                    ? 'border-cobalt bg-cobalt-soft'
                    : 'border-line bg-surface hover:border-line-strong'
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                <div className="h-16 rounded-lg border border-line bg-porcelain p-2">
                  <ThemePreview theme={t.id} />
                </div>
                <div>
                  <p className={`text-sm font-semibold ${active ? 'text-cobalt-deep' : 'text-ink'}`}>
                    {t.name}
                    {themeBusy === t.id && ' …'}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-soft">{t.description}</p>
                </div>
                {active && (
                  <span className="text-xs font-semibold text-cobalt-deep">✓ Kullanılıyor</span>
                )}
              </button>
            )
          })}
        </div>
        <ErrorText>{themeError}</ErrorText>
      </Card>

      <Card className="mt-4 border-line bg-cobalt-soft">
        <h2 className="mb-2 font-semibold text-cobalt-deep">Mevzuat Hatırlatması</h2>
        <p className="text-sm leading-relaxed text-cobalt-deep">
          Türk Gıda Kodeksi düzenlemesine göre menünüzdeki her ürün için <strong>14 majör alerjen</strong>,{' '}
          <strong>enerji değeri (kcal)</strong> ile <strong>alkol ve domuz içeriği</strong> beyanı
          zorunludur. Menü Yönetimi sayfasındaki <em>"AI ile Doldur"</em> özelliği bu alanları sizin
          için önerir; öneriler yapay zeka tahminidir, yayınlamadan önce kontrol edip onaylamanız
          gerekir. QR menü kullanan işletmelerin, QR koda erişemeyen müşteriler için yazılı bir
          alternatif bulundurması gerekir — bunun için QR Kod sayfasındaki yazdırılabilir menüyü
          kullanabilirsiniz.
        </p>
      </Card>
    </div>
  )
}
