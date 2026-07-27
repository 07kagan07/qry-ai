import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui'
import { ALLERGENS } from '../lib/allergens'

// Kahraman bölümde ürünün kendisi: gerçek bir menü satırının nasıl görüneceği.
function SampleMenuRow() {
  return (
    <div className="mx-auto max-w-sm overflow-hidden rounded-xl border border-line bg-surface text-left shadow-[0_10px_32px_-18px_rgba(28,35,51,0.3)]">
      <div className="p-5">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-ink-soft uppercase">Tatlılar</p>
        <div className="mt-2 flex items-baseline">
          <span className="font-semibold text-ink">Fıstıklı Baklava</span>
          <span className="dot-leader" aria-hidden />
          <span className="font-display font-bold text-cobalt">₺185,00</span>
        </div>
        <p className="mt-1 text-sm text-ink-soft">Şam fıstıklı, tereyağlı, günlük şerbetli.</p>
        <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
          <span className="rounded-md border border-line bg-surface px-2 py-0.5 font-medium text-ink-soft">250 kcal</span>
          {(['gluten', 'milk', 'nuts'] as const).map((a) => (
            <span key={a} className="rounded-md bg-coral-soft/60 px-2 py-0.5 text-coral-deep">
              {ALLERGENS[a].icon} {ALLERGENS[a].label}
            </span>
          ))}
        </div>
        <p className="mt-3 border-t border-line pt-2 text-[11px] text-ink-soft">
          ✨ Alerjen ve kalori bilgisi AI tarafından önerildi, işletme onayladı
        </p>
      </div>
    </div>
  )
}

export default function Landing() {
  const { user } = useAuth()

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-3xl px-5 py-14 text-center">
        <p className="text-xs font-semibold tracking-[0.25em] text-ink-soft uppercase">
          Kafeler için QR menü
        </p>
        <h1 className="font-display mt-3 text-4xl font-extrabold tracking-tight text-cobalt sm:text-5xl">
          Menünüz yeni mevzuata
          <br />
          hazır mı?
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-ink-soft">
          Türk Gıda Kodeksi artık menülerde <strong className="text-ink">14 majör alerjen</strong> ve{' '}
          <strong className="text-ink">kalori</strong> beyanı istiyor. Ürünlerinizi yazın, yapay
          zeka beyanları önersin — siz kontrol edip onaylayın.
        </p>

        <div className="mt-8 flex justify-center gap-3">
          {user ? (
            <Link to="/panel">
              <Button className="px-6">Panele git</Button>
            </Link>
          ) : (
            <>
              <Link to="/kayit">
                <Button className="px-6">Ücretsiz başla</Button>
              </Link>
              <Link to="/giris">
                <Button variant="secondary" className="px-6">
                  Giriş yap
                </Button>
              </Link>
            </>
          )}
        </div>

        <div className="mt-12">
          <SampleMenuRow />
        </div>

        {/* Özellikler */}
        <div className="mt-16 grid gap-4 text-left sm:grid-cols-3">
          {[
            {
              title: 'AI beyanları önerir',
              text: 'Ürün adı ve malzemelerden 14 majör alerjen, kcal aralığı, alkol ve domuz içeriği önerilir. Son söz her zaman sizde.',
            },
            {
              title: 'Fotoğraftan aktarım',
              text: 'Eski menünüzün fotoğrafını yükleyin; ürünler, fiyatlar ve kategoriler saniyeler içinde sisteme geçsin.',
            },
            {
              title: 'QR + yazılı menü',
              text: 'Masalar için QR kod, mevzuatın istediği yazılı alternatif için tek tıkla yazdırılabilir menü.',
            },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-line bg-surface p-5">
              <h3 className="font-display font-bold text-cobalt">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{f.text}</p>
            </div>
          ))}
        </div>

        {/* Uyum takvimi — gerçek bir zaman sırası olduğu için numaralandırma anlamlı */}
        <div className="mt-16 rounded-xl border border-line bg-surface p-6 text-left">
          <h2 className="font-display text-lg font-bold text-ink">Uyum takvimi</h2>
          <ol className="mt-4 space-y-3 text-sm">
            {[
              { date: '1 Temmuz 2026', who: 'Ulusal zincir restoranlar' },
              { date: '31 Aralık 2026', who: 'Aynı ilde 3 ve üzeri şubesi olan işletmeler' },
              { date: '31 Aralık 2027', who: 'Kalori beyanı — tüm işletmeler için son tarih' },
            ].map((row) => (
              <li key={row.date} className="flex items-baseline gap-3">
                <span className="font-display shrink-0 font-bold text-cobalt">{row.date}</span>
                <span className="dot-leader" aria-hidden />
                <span className="text-right text-ink-soft">{row.who}</span>
              </li>
            ))}
          </ol>
        </div>

        <p className="mt-12 text-xs text-ink-soft">
          Dayanak: Türk Gıda Kodeksi Gıda Etiketleme ve Tüketicileri Bilgilendirme Yönetmeliği
        </p>
      </div>
    </div>
  )
}
