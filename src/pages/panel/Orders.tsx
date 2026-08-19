import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { formatPrice } from '../../lib/currency'
import type { Order, OrderItem, OrderStatus } from '../../lib/types'
import { Button, Card, ErrorText } from '../../components/ui'

type OrderWithItems = Order & { order_items: OrderItem[] }

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Bekliyor',
  preparing: 'Hazırlanıyor',
  ready: 'Hazır',
  completed: 'Tamamlandı',
  cancelled: 'İptal edildi',
}

const NEXT_STATUS: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> = {
  pending: { status: 'preparing', label: 'Hazırlanıyor' },
  preparing: { status: 'ready', label: 'Hazır' },
  ready: { status: 'completed', label: 'Tamamlandı' },
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function Orders() {
  const { cafe, refreshCafe } = useAuth()
  const [orders, setOrders] = useState<OrderWithItems[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toggleBusy, setToggleBusy] = useState(false)
  const [kitchenToken, setKitchenToken] = useState<string | null>(null)
  const [kitchenBusy, setKitchenBusy] = useState(false)
  const [kitchenCopied, setKitchenCopied] = useState(false)

  const loadKitchenLink = useCallback(async () => {
    if (!cafe) return
    const { data, error: selectErr } = await supabase
      .from('kitchen_links')
      .select('token')
      .eq('cafe_id', cafe.id)
      .maybeSingle()
    if (selectErr) {
      setError(selectErr.message)
      return
    }
    if (data) {
      setKitchenToken(data.token)
      return
    }
    // İlk ziyarette henüz link yok — kendiliğinden oluşturulur.
    const { data: inserted, error: insertErr } = await supabase
      .from('kitchen_links')
      .insert({ cafe_id: cafe.id })
      .select('token')
      .single()
    if (insertErr) {
      setError(insertErr.message)
      return
    }
    setKitchenToken(inserted?.token ?? null)
  }, [cafe])

  useEffect(() => {
    void loadKitchenLink()
  }, [loadKitchenLink])

  async function regenerateKitchenLink() {
    if (!cafe) return
    setKitchenBusy(true)
    const newToken = crypto.randomUUID()
    const { error: updateErr } = await supabase
      .from('kitchen_links')
      .update({ token: newToken })
      .eq('cafe_id', cafe.id)
    setKitchenBusy(false)
    if (updateErr) {
      setError(updateErr.message)
      return
    }
    setKitchenToken(newToken)
  }

  async function copyKitchenLink() {
    if (!kitchenToken) return
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/mutfak/${kitchenToken}`)
      setKitchenCopied(true)
      window.setTimeout(() => setKitchenCopied(false), 1600)
    } catch {
      // Panoya erişim engellenmiş olabilir — link zaten ekranda okunabilir durumda.
    }
  }

  const load = useCallback(async () => {
    if (!cafe) return
    const { data, error: loadErr } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('cafe_id', cafe.id)
      .order('created_at', { ascending: true })
    if (loadErr) setError(loadErr.message)
    else setOrders((data ?? []) as OrderWithItems[])
    setLoading(false)
  }, [cafe])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!cafe) return
    const channel = supabase
      .channel(`panel_orders_${cafe.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `cafe_id=eq.${cafe.id}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            void load()
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as Order
            setOrders((prev) => prev.map((o) => (o.id === row.id ? { ...o, ...row } : o)))
          }
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [cafe, load])

  // Sesli uyarı ve bekleyen sayısı artık panelin her sayfasında çalışan
  // usePendingCounts (PanelLayout.tsx) ile geliyor — burada tekrar etmiyor.

  if (!cafe) return null

  async function toggleOrders(enabled: boolean) {
    setToggleBusy(true)
    const { error: toggleErr } = await supabase
      .from('cafes')
      .update({ order_enabled: enabled })
      .eq('id', cafe!.id)
    setToggleBusy(false)
    if (toggleErr) {
      setError(toggleErr.message)
      return
    }
    await refreshCafe()
  }

  async function updateStatus(order: OrderWithItems, status: OrderStatus) {
    const { error: updateErr } = await supabase.from('orders').update({ status }).eq('id', order.id)
    if (updateErr) {
      setError(updateErr.message)
      return
    }
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status } : o)))
  }

  const activeOrders = orders.filter((o) => o.status !== 'completed' && o.status !== 'cancelled')
  const pastOrders = orders.filter((o) => o.status === 'completed' || o.status === 'cancelled')

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-xl font-bold">Siparişler</h1>

      <Card className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-ink">Paket Sipariş</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Açarsanız müşteriler menüden ürün seçip gel-al siparişi verebilir. Siparişler aşağıda
              anlık görünür.
            </p>
          </div>
          <label className={`relative inline-flex min-h-11 min-w-11 shrink-0 touch-manipulation items-center ${toggleBusy ? 'opacity-60' : ''}`}>
            <input
              type="checkbox"
              checked={cafe.order_enabled}
              onChange={(e) => toggleOrders(e.target.checked)}
              disabled={toggleBusy}
              className="peer sr-only"
            />
            <span className="h-6 w-11 rounded-full bg-line transition-colors peer-checked:bg-cobalt" />
            <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
          </label>
        </div>
        <ErrorText>{error}</ErrorText>
      </Card>

      <Card className="mb-4">
        <h2 className="font-semibold text-ink">Mutfak Ekranı</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Bu linki mutfaktaki tablet/ekranda açık bırakın — giriş gerektirmez, aktif siparişleri
          otomatik gösterir. Link başkasının eline geçerse "Yeni Link Oluştur" ile eskisini
          geçersiz kılabilirsiniz.
        </p>
        {kitchenToken && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg border border-line bg-porcelain px-3 py-2 text-xs text-ink-soft">
              {`${window.location.origin}/mutfak/${kitchenToken}`}
            </code>
            <Button variant="secondary" className="shrink-0 text-xs" onClick={copyKitchenLink}>
              {kitchenCopied ? 'Kopyalandı ✓' : 'Linki Kopyala'}
            </Button>
            <Button
              variant="ghost"
              className="shrink-0 text-xs"
              disabled={kitchenBusy}
              onClick={regenerateKitchenLink}
            >
              Yeni Link Oluştur
            </Button>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold text-ink">Aktif Siparişler</h2>
        {loading ? (
          <p className="text-sm text-ink-soft">Yükleniyor…</p>
        ) : activeOrders.length === 0 ? (
          <p className="text-sm text-ink-soft">Aktif sipariş yok.</p>
        ) : (
          <ul className="space-y-2">
            {activeOrders.map((o) => {
              const next = NEXT_STATUS[o.status]
              return (
                <li
                  key={o.id}
                  className={`rounded-lg border p-3 ${
                    o.status === 'pending' ? 'border-coral bg-coral-soft' : 'border-teal bg-teal-soft'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p
                        className={`font-semibold ${o.status === 'pending' ? 'text-coral-deep' : 'text-teal-deep'}`}
                      >
                        {formatWhen(o.created_at)} — {o.customer_name}
                      </p>
                      <p className="text-xs text-ink-soft">
                        <a href={`tel:${o.phone}`} className="underline">
                          {o.phone}
                        </a>
                        {' — '}
                        {STATUS_LABEL[o.status]}
                      </p>
                      <ul className="mt-1 text-sm text-ink">
                        {o.order_items.map((it) => (
                          <li key={it.id}>
                            {it.quantity}× {it.name}
                            {it.note && (
                              <span className="ml-1 font-medium text-coral-deep">— {it.note}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                      {o.note && <p className="mt-0.5 text-xs text-ink-soft">Not: {o.note}</p>}
                      <p className="mt-1 font-semibold text-ink">{formatPrice(o.total, cafe.currency)}</p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-2">
                      {next && (
                        <Button className="text-xs" onClick={() => updateStatus(o, next.status)}>
                          {next.label} yap
                        </Button>
                      )}
                      <Button
                        variant="danger"
                        className="text-xs"
                        onClick={() => updateStatus(o, 'cancelled')}
                      >
                        İptal Et
                      </Button>
                      <Link
                        to={`/panel/siparisler/${o.id}/adisyon`}
                        target="_blank"
                        className="text-center text-xs text-cobalt underline"
                      >
                        🖨️ Adisyon
                      </Link>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {pastOrders.length > 0 && (
          <div className="mt-4 border-t border-line pt-3">
            <p className="mb-2 text-xs font-semibold tracking-wide text-ink-soft uppercase">
              Geçmiş
            </p>
            <ul className="space-y-1.5">
              {pastOrders.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center gap-x-1 text-xs text-ink-soft">
                  <span>
                    {formatWhen(o.created_at)} — {o.customer_name} — {formatPrice(o.total, cafe.currency)}{' '}
                    — {STATUS_LABEL[o.status]}
                  </span>
                  <Link to={`/panel/siparisler/${o.id}/adisyon`} target="_blank" className="text-cobalt underline">
                    🖨️ Adisyon
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </div>
  )
}
