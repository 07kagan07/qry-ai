import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { formatPrice } from '../../lib/currency'
import type { Customer, Order, OrderItem } from '../../lib/types'
import { Card, Spinner } from '../../components/ui'

type OrderWithItems = Order & { order_items: OrderItem[] }

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// Sipariş geçmişini dağınık tek bir liste yerine müşteri bazlı gruplu gösterir
// (bkz. yol haritası planı — Faz 2 kararı). Her müşterinin geçmişi tıklanınca
// açılır, ayrı bir tablo tutulmuyor — orders'tan telefona göre anlık çekilir.
export default function Customers() {
  const { cafe } = useAuth()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedPhone, setExpandedPhone] = useState<string | null>(null)
  const [history, setHistory] = useState<OrderWithItems[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  useEffect(() => {
    if (!cafe) return
    let cancelled = false
    async function load() {
      const { data } = await supabase
        .from('customers')
        .select('*')
        .eq('cafe_id', cafe!.id)
        .order('last_order_at', { ascending: false })
      if (cancelled) return
      setCustomers((data ?? []) as Customer[])
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [cafe])

  async function toggleHistory(phone: string) {
    if (expandedPhone === phone) {
      setExpandedPhone(null)
      return
    }
    setExpandedPhone(phone)
    setHistoryLoading(true)
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('cafe_id', cafe!.id)
      .eq('phone', phone)
      .order('created_at', { ascending: false })
    setHistory((data ?? []) as OrderWithItems[])
    setHistoryLoading(false)
  }

  if (!cafe) return null
  if (loading) return <Spinner label="Yükleniyor…" />

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-xl font-bold">Müşteriler</h1>
      <p className="mb-4 text-sm text-ink-soft">
        Paket sipariş veren müşteriler telefon numarasına göre burada gruplanır. Bir müşteriye
        dokunarak sipariş geçmişini görebilirsiniz.
      </p>

      <Card>
        {customers.length === 0 ? (
          <p className="text-sm text-ink-soft">Henüz sipariş veren müşteri yok.</p>
        ) : (
          <ul className="divide-y divide-line">
            {customers.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => toggleHistory(c.phone)}
                  className="flex min-h-11 w-full touch-manipulation items-center justify-between gap-2 py-2 text-left hover:bg-porcelain"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{c.name}</p>
                    <p className="text-xs text-ink-soft">
                      {c.phone} — {c.total_orders} sipariş — son: {formatWhen(c.last_order_at)}
                    </p>
                  </div>
                  <span aria-hidden className="shrink-0 text-ink-soft">
                    {expandedPhone === c.phone ? '︿' : '›'}
                  </span>
                </button>
                {expandedPhone === c.phone && (
                  <div className="pb-3 pl-2">
                    {historyLoading ? (
                      <p className="text-xs text-ink-soft">Yükleniyor…</p>
                    ) : (
                      <ul className="space-y-2">
                        {history.map((o) => (
                          <li key={o.id} className="rounded-lg border border-line bg-porcelain p-2 text-xs">
                            <p className="font-medium text-ink">
                              {formatWhen(o.created_at)} — {formatPrice(o.total, cafe.currency)}
                            </p>
                            <p className="mt-0.5 text-ink-soft">
                              {o.order_items.map((it) => `${it.quantity}× ${it.name}`).join(', ')}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
