import { useEffect, useState } from 'react'
import { NavLink, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { usePendingCounts } from '../../lib/usePendingCounts'
import { beep, unlockAudioOnFirstInteraction } from '../../lib/beep'
import { Spinner, Button } from '../../components/ui'
import CreateCafe from './CreateCafe'
import AddBranchModal from '../../components/AddBranchModal'

const navItems = [
  { to: '/panel', label: 'Kafe Bilgileri', end: true },
  { to: '/panel/genel-bakis', label: 'Genel Bakış' },
  { to: '/panel/menu', label: 'Menü Yönetimi' },
  { to: '/panel/ice-aktar', label: 'AI ile İçe Aktar' },
  { to: '/panel/qr', label: 'QR Kod' },
  { to: '/panel/masalar', label: 'Masalar' },
  { to: '/panel/rezervasyonlar', label: 'Rezervasyonlar' },
  { to: '/panel/siparisler', label: 'Siparişler' },
  { to: '/panel/musteriler', label: 'Müşteriler' },
  { to: '/panel/vardiyalar', label: 'Vardiyalar' },
  { to: '/panel/diller', label: 'Diller' },
]

export default function PanelLayout() {
  const { user, cafe, cafes, switchCafe, loading, signOut } = useAuth()
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [addBranchOpen, setAddBranchOpen] = useState(false)

  // Hangi panel sayfasında olursa olsun (sadece Siparişler/Rezervasyonlar/Masalar
  // açıkken değil) çalışsın diye bekleyen sayıları ve sesli uyarı burada, tek
  // yerden yönetiliyor — nav linklerindeki rozetler bundan besleniyor.
  const pending = usePendingCounts(cafe)
  const hasAnyPending = pending.waiterCalls + pending.reservations + pending.orders > 0

  useEffect(() => unlockAudioOnFirstInteraction(), [])

  useEffect(() => {
    if (!hasAnyPending) return
    beep()
    const interval = window.setInterval(beep, 5000)
    return () => window.clearInterval(interval)
  }, [hasAnyPending])

  if (loading) return <Spinner label="Yükleniyor…" />
  if (!user) return <Navigate to="/giris" replace />
  if (!cafe) return <CreateCafe />

  const navBadges: Record<string, number> = {
    '/panel/masalar': pending.waiterCalls,
    '/panel/rezervasyonlar': pending.reservations,
    '/panel/siparisler': pending.orders,
  }

  return (
    <div className="min-h-screen">
      <header className="no-print bg-cobalt text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative min-w-0">
              <button
                type="button"
                onClick={() => setSwitcherOpen((v) => !v)}
                className="flex min-h-11 max-w-full touch-manipulation items-center gap-1 truncate rounded-lg px-1 font-display text-lg font-bold hover:bg-white/10"
              >
                <span className="truncate">{cafe.name}</span>
                <span aria-hidden className="shrink-0 text-sm">▾</span>
              </button>
              {switcherOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setSwitcherOpen(false)} aria-hidden />
                  <div
                    role="menu"
                    className="absolute left-0 z-20 mt-1 w-56 overflow-hidden rounded-lg border border-line bg-surface text-ink shadow-lg"
                  >
                    {cafes.map((c) => (
                      <button
                        key={c.id}
                        role="menuitem"
                        type="button"
                        onClick={() => {
                          switchCafe(c.id)
                          setSwitcherOpen(false)
                        }}
                        className={`block min-h-11 w-full truncate px-4 text-left text-sm hover:bg-porcelain ${
                          c.id === cafe.id ? 'font-semibold text-cobalt' : ''
                        }`}
                      >
                        {c.id === cafe.id ? '✓ ' : ''}
                        {c.name}
                      </button>
                    ))}
                    <button
                      role="menuitem"
                      type="button"
                      onClick={() => {
                        setSwitcherOpen(false)
                        setAddBranchOpen(true)
                      }}
                      className="block min-h-11 w-full border-t border-line px-4 text-left text-sm font-medium text-cobalt hover:bg-porcelain"
                    >
                      + Yeni Şube Ekle
                    </button>
                  </div>
                </>
              )}
            </div>
            <a
              href={`/menu/${cafe.slug}`}
              target="_blank"
              rel="noreferrer"
              className="hidden shrink-0 text-sm text-white/70 hover:text-white hover:underline sm:inline"
            >
              /menu/{cafe.slug} ↗
            </a>
          </div>
          <Button variant="ghost" onClick={signOut} className="!text-white/80 hover:!bg-white/10 hover:!text-white">
            Çıkış
          </Button>
        </div>
        <nav className="mx-auto flex max-w-5xl flex-wrap gap-1 px-4 py-1">
          {navItems.map((item) => {
            const badgeCount = navBadges[item.to] ?? 0
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex min-h-11 shrink-0 touch-manipulation items-center gap-1.5 border-b-[3px] px-3 py-2.5 text-sm font-semibold transition-colors ${
                    isActive
                      ? 'border-white text-white'
                      : 'border-transparent text-white/60 hover:text-white'
                  }`
                }
              >
                {item.label}
                {badgeCount > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-coral px-1 text-[10px] font-bold text-white">
                    {badgeCount}
                  </span>
                )}
              </NavLink>
            )
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
      {addBranchOpen && <AddBranchModal onClose={() => setAddBranchOpen(false)} />}
    </div>
  )
}
