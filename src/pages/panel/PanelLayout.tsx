import { NavLink, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Spinner, Button } from '../../components/ui'
import CreateCafe from './CreateCafe'

const navItems = [
  { to: '/panel', label: 'Kafe Bilgileri', end: true },
  { to: '/panel/menu', label: 'Menü Yönetimi' },
  { to: '/panel/ice-aktar', label: 'AI ile İçe Aktar' },
  { to: '/panel/qr', label: 'QR Kod' },
]

export default function PanelLayout() {
  const { user, cafe, loading, signOut } = useAuth()

  if (loading) return <Spinner label="Yükleniyor…" />
  if (!user) return <Navigate to="/giris" replace />
  if (!cafe) return <CreateCafe />

  return (
    <div className="min-h-screen">
      <header className="bg-cobalt text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="font-display truncate text-lg font-bold">{cafe.name}</span>
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
        <nav className="scroll-pills mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `min-h-11 shrink-0 touch-manipulation border-b-[3px] px-3 py-2.5 text-sm font-semibold transition-colors ${
                  isActive
                    ? 'border-white text-white'
                    : 'border-transparent text-white/60 hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
