import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { QRCodeCanvas } from 'qrcode.react'
import { useAuth } from '../../context/AuthContext'
import { SITE_URL, IS_LOCAL_URL } from '../../lib/siteUrl'
import { Button, Card } from '../../components/ui'

export default function QrPage() {
  const { cafe } = useAuth()
  const wrapperRef = useRef<HTMLDivElement>(null)

  if (!cafe) return null

  const url = `${SITE_URL}/menu/${cafe.slug}`

  function download() {
    const canvas = wrapperRef.current?.querySelector('canvas')
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `qr-menu-${cafe!.slug}.png`
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
        {/* 200px: en dar telefonlarda (320px genişlik) bile Card+sayfa dolgusu
            içinde yatay taşma olmadan sığar; taranabilirlik için yeterli. */}
        <div ref={wrapperRef} className="rounded-lg bg-white p-3">
          <QRCodeCanvas value={url} size={200} level="M" includeMargin />
        </div>
        <p className="w-full break-all text-center text-sm text-ink-soft">{url}</p>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button onClick={download} className="w-full sm:w-auto">
            PNG olarak indir
          </Button>
          <Button
            variant="secondary"
            onClick={() => window.open(`/menu/${cafe.slug}/yazdir`, '_blank')}
            className="w-full sm:w-auto"
          >
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
      <Card className="mt-4">
        <p className="text-sm leading-relaxed text-ink-soft">
          Masa bazlı QR kod ve <strong>garson çağırma</strong> özelliği için{' '}
          <Link to="/panel/masalar" className="font-semibold text-cobalt hover:underline">
            Masalar
          </Link>{' '}
          sayfasını kullanın. Buradaki genel QR kod masasız, tüm masalarda ortak kullanılabilir.
        </p>
      </Card>
    </div>
  )
}
