import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { beep, unlockAudioOnFirstInteraction } from '../../lib/beep'
import { Spinner } from '../../components/ui'
import type { KitchenOrder, OrderStatus } from '../../lib/types'

const POLL_MS = 6000

interface Column {
  status: OrderStatus
  label: string
  accentClass: string
  headerClass: string
  next: { status: OrderStatus; label: string } | null
}

const COLUMNS: Column[] = [
  {
    status: 'pending',
    label: 'Bekliyor',
    accentClass: 'border-coral',
    headerClass: 'bg-coral',
    next: { status: 'preparing', label: "Hazırlanıyor'a Al" },
  },
  {
    status: 'preparing',
    label: 'Hazırlanıyor',
    accentClass: 'border-cobalt',
    headerClass: 'bg-cobalt',
    next: { status: 'ready', label: 'Hazır Yap' },
  },
  {
    status: 'ready',
    label: 'Hazır',
    accentClass: 'border-teal',
    headerClass: 'bg-teal',
    next: { status: 'completed', label: 'Teslim Edildi' },
  },
]

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

interface TicketProps {
  order: KitchenOrder
  accentClass: string
  actionLabel: string | null
  busy: boolean
  onAdvance: () => void
  onCancel: () => void
}

function Ticket({ order, accentClass, actionLabel, busy, onAdvance, onCancel }: TicketProps) {
  return (
    <div className={`rounded-lg border-2 bg-white p-3 shadow-sm ${accentClass}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-lg font-bold text-ink">{order.customer_name}</p>
        <p className="shrink-0 text-sm font-semibold text-ink-soft">{formatTime(order.created_at)}</p>
      </div>
      <ul className="mt-2 space-y-1.5">
        {order.items.map((it, idx) => (
          <li key={idx} className="text-base text-ink">
            <span className="font-semibold">{it.quantity}×</span> {it.name}
            {it.note && (
              <div className="mt-0.5 rounded bg-coral-soft px-2 py-1 text-sm font-semibold text-coral-deep">
                ⚠ {it.note}
              </div>
            )}
          </li>
        ))}
      </ul>
      {order.note && (
        <p className="mt-2 rounded bg-porcelain px-2 py-1 text-sm text-ink-soft">Not: {order.note}</p>
      )}
      <div className="mt-3 flex gap-2">
        {actionLabel && (
          <button
            type="button"
            onClick={onAdvance}
            disabled={busy}
            className="min-h-11 flex-1 touch-manipulation rounded-lg bg-cobalt px-3 text-sm font-semibold text-white active:scale-[0.98] disabled:opacity-60"
          >
            {actionLabel}
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="min-h-11 touch-manipulation rounded-lg border border-line px-3 text-sm text-ink-soft active:scale-[0.98] disabled:opacity-60"
        >
          İptal
        </button>
      </div>
    </div>
  )
}

// Personel vardiya linkiyle (StaffShifts.tsx) aynı ilke: giriş gerektirmez,
// tamamen tahmin edilemez bir token'a (kitchen_links.token) dayanır. Mutfaktaki
// paylaşımlı bir tablette açık bırakılması için tasarlandı — realtime yerine
// kısa aralıklı polling kullanılır (bkz. 014_kitchen_display.sql'deki not:
// anonim erişimde RLS realtime'ı zaten engeller, tüm okuma/yazma token'lı
// RPC'ler üzerinden).
export default function KitchenDisplay() {
  const { token } = useParams()
  const [cafeName, setCafeName] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [orders, setOrders] = useState<KitchenOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const knownIds = useRef<Set<string>>(new Set())
  const firstPoll = useRef(true)

  useEffect(() => unlockAudioOnFirstInteraction(), [])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    void supabase.rpc('get_kitchen_cafe', { p_token: token }).then(({ data }) => {
      if (cancelled) return
      const rows = (data ?? []) as { cafe_id: string; cafe_name: string }[]
      if (rows.length === 0) setNotFound(true)
      else setCafeName(rows[0].cafe_name)
    })
    return () => {
      cancelled = true
    }
  }, [token])

  const poll = useCallback(async () => {
    if (!token) return
    const { data, error } = await supabase.rpc('get_kitchen_orders', { p_token: token })
    if (error || !data) {
      setLoading(false)
      return
    }
    const rows = data as KitchenOrder[]
    // İlk yüklemede bip çalmaz — sayfa açılır açılmaz mevcut bekleyen
    // siparişler için değil, SONRADAN gelen yeni siparişler için çalar.
    if (!firstPoll.current) {
      const hasNewPending = rows.some((o) => o.status === 'pending' && !knownIds.current.has(o.id))
      if (hasNewPending) beep()
    }
    firstPoll.current = false
    knownIds.current = new Set(rows.map((o) => o.id))
    setOrders(rows)
    setLoading(false)
  }, [token])

  useEffect(() => {
    if (notFound) return
    void poll()
    const interval = window.setInterval(() => void poll(), POLL_MS)
    return () => window.clearInterval(interval)
  }, [poll, notFound])

  async function advance(orderId: string, status: OrderStatus) {
    if (!token) return
    setBusyId(orderId)
    const { error } = await supabase.rpc('update_kitchen_order_status', {
      p_token: token,
      p_order_id: orderId,
      p_status: status,
    })
    setBusyId(null)
    if (!error) void poll()
  }

  if (notFound) {
    return (
      <div className="mx-auto mt-24 max-w-sm px-4 text-center">
        <p className="font-display text-2xl font-bold text-cobalt">Mutfak ekranı bulunamadı</p>
        <p className="mt-2 text-sm text-ink-soft">
          Link geçersiz olabilir. İşletme panelinden "Siparişler" sayfasına girip linki kontrol
          edin.
        </p>
      </div>
    )
  }

  if (loading) return <Spinner label="Yükleniyor…" />

  return (
    <div className="flex h-screen flex-col bg-porcelain">
      <header className="flex shrink-0 items-center justify-between border-b border-line bg-surface px-4 py-3">
        <h1 className="font-display text-xl font-bold text-ink">{cafeName} — Mutfak Ekranı</h1>
        <p className="text-sm text-ink-soft">{orders.length} aktif sipariş</p>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden p-3 sm:grid-cols-3">
        {COLUMNS.map((col) => {
          const colOrders = orders.filter((o) => o.status === col.status)
          return (
            <div
              key={col.status}
              className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-line bg-surface"
            >
              <div className={`shrink-0 px-4 py-2.5 text-base font-bold text-white ${col.headerClass}`}>
                {col.label} ({colOrders.length})
              </div>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
                {colOrders.length === 0 ? (
                  <p className="pt-6 text-center text-sm text-ink-soft">—</p>
                ) : (
                  colOrders.map((o) => (
                    <Ticket
                      key={o.id}
                      order={o}
                      accentClass={col.accentClass}
                      actionLabel={col.next?.label ?? null}
                      busy={busyId === o.id}
                      onAdvance={() => col.next && advance(o.id, col.next.status)}
                      onCancel={() => advance(o.id, 'cancelled')}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
