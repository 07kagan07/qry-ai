import { useRef, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { useAuth } from '../../context/AuthContext'
import { Button, Card, Input, Label } from '../../components/ui'

// QR içine gömülecek site adresi. Yayında VITE_PUBLIC_SITE_URL tanımlanmalı;
// tanımlı değilse tarayıcının adresi kullanılır (geliştirmede localhost olur).
const SITE_URL: string =
  (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined)?.replace(/\/$/, '') ??
  window.location.origin

const IS_LOCAL_URL = /localhost|127\.0\.0\.1/.test(SITE_URL)

export default function QrPage() {
  const { cafe } = useAuth()
  const [table, setTable] = useState('')
  const wrapperRef = useRef<HTMLDivElement>(null)

  if (!cafe) return null

  const baseUrl = `${SITE_URL}/menu/${cafe.slug}`
  const url = table ? `${baseUrl}?masa=${encodeURIComponent(table)}` : baseUrl

  function download() {
    const canvas = wrapperRef.current?.querySelector('canvas')
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `qr-menu-${cafe!.slug}${table ? `-masa-${table}` : ''}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  return (
    <div className="max-w-xl">
      <h1 className="mb-4 text-xl font-bold">QR Kod</h1>

      {IS_LOCAL_URL && (
        <Card className="mb-4 border-coral bg-coral-soft">
          <p className="text-sm leading-relaxed text-coral-deep">
            <strong>Bu QR kod henüz telefonda çalışmaz.</strong> Uygulama şu an geliştirme
            adresinde (localhost) çalışıyor; localhost yalnızca bu bilgisayardan erişilebilir.
            Aynı Wi-Fi ağındaki telefonla denemek için uygulamayı bilgisayarınızın ağ adresi
            üzerinden açın, kalıcı çözüm için siteyi yayınlayıp <code>VITE_PUBLIC_SITE_URL</code>{' '}
            değerini ayarlayın (bkz. README).
          </p>
        </Card>
      )}

      <Card className="flex flex-col items-center gap-4">
        <div ref={wrapperRef} className="rounded-lg bg-white p-4">
          <QRCodeCanvas value={url} size={280} level="M" includeMargin />
        </div>
        <p className="break-all text-center text-sm text-ink-soft">{url}</p>
        <div className="w-full max-w-xs">
          <Label>Masa numarası (isteğe bağlı)</Label>
          <Input value={table} onChange={(e) => setTable(e.target.value)} placeholder="Örn: 5" />
        </div>
        <div className="flex gap-2">
          <Button onClick={download}>PNG olarak indir</Button>
          <Button variant="secondary" onClick={() => window.open(`/menu/${cafe.slug}/yazdir`, '_blank')}>
            Yazdırılabilir menü
          </Button>
        </div>
      </Card>
      <Card className="mt-4 border-line bg-cobalt-soft">
        <p className="text-sm leading-relaxed text-cobalt-deep">
          <strong>Hatırlatma:</strong> Mevzuata göre QR menü kullanan işletmelerin, QR koda
          erişemeyen müşteriler için yazılı bir alternatif sunması gerekir. "Yazdırılabilir menü"
          butonuyla alerjen ve kalori bilgilerini içeren basılı bir sürüm alabilirsiniz.
        </p>
      </Card>
    </div>
  )
}
