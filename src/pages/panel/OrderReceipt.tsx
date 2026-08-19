import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { formatPrice } from '../../lib/currency'
import type { Order, OrderItem } from '../../lib/types'
import { Spinner, Button } from '../../components/ui'

type OrderWithItems = Order & { order_items: OrderItem[] }

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Gerçek e-fatura/e-arşiv DEĞİL — "bu müşteriye şu tarihte şunlar satıldı, toplam
// bu kadar" şeklinde basit, işletme içi bir kayıt/adisyon. PrintMenu.tsx ile aynı
// tarayıcı-yazdırma deseni (.no-print/.print-page, window.print()); PanelLayout'un
// başlık/nav'ı da artık no-print olduğu için yazdırınca sadece bu içerik basılır.
export default function OrderReceipt() {
  const { cafe } = useAuth()
  const { orderId } = useParams()
  const [order, setOrder] = useState<OrderWithItems | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!orderId) return
    let cancelled = false
    supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', orderId)
      .single()
      .then(({ data, error: loadErr }) => {
        if (cancelled) return
        if (loadErr) setError(loadErr.message)
        else setOrder(data as OrderWithItems)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [orderId])

  if (loading) return <Spinner label="Yükleniyor…" />
  if (error || !order || !cafe) {
    return <p className="mt-10 text-center text-sm text-ink-soft">{error || 'Sipariş bulunamadı.'}</p>
  }

  return (
    <div className="print-page mx-auto max-w-sm bg-white p-6">
      <div className="no-print mb-6 flex justify-end">
        <Button onClick={() => window.print()}>🖨️ Yazdır</Button>
      </div>

      <header className="text-center">
        <h1 className="text-lg font-bold">{cafe.name}</h1>
        {cafe.address && <p className="text-xs text-ink-soft">{cafe.address}</p>}
        {cafe.phone && <p className="text-xs text-ink-soft">{cafe.phone}</p>}
      </header>

      <p className="mt-4 text-center text-xs text-ink-soft">{formatWhen(order.created_at)}</p>
      <p className="text-center text-xs text-ink-soft">Sipariş No: {order.id.slice(0, 8)}</p>

      <div className="mt-3 border-t border-dashed border-line pt-2 text-sm">
        <p>
          <span className="font-semibold">Müşteri:</span> {order.customer_name}
        </p>
        <p>
          <span className="font-semibold">Telefon:</span> {order.phone}
        </p>
      </div>

      <table className="mt-3 w-full border-t border-dashed border-line pt-2 text-sm">
        <tbody>
          {order.order_items.map((it) => (
            <tr key={it.id} className="align-top">
              <td className="py-1 pr-2">
                {it.quantity}× {it.name}
                {it.note && <div className="text-xs text-ink-soft">Not: {it.note}</div>}
              </td>
              <td className="py-1 text-right whitespace-nowrap">
                {formatPrice(it.price * it.quantity, cafe.currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {order.note && (
        <p className="mt-2 border-t border-dashed border-line pt-2 text-xs text-ink-soft">
          Not: {order.note}
        </p>
      )}

      <div className="mt-2 flex justify-between border-t border-line pt-2 text-base font-bold">
        <span>Toplam</span>
        <span>{formatPrice(order.total, cafe.currency)}</span>
      </div>

      <p className="mt-6 text-center text-[10px] text-ink-soft">
        Bu belge resmi bir fatura değildir, işletme içi kayıt amaçlıdır.
      </p>
    </div>
  )
}
