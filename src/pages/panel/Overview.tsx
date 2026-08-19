import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { useFxTable, convertPrice } from '../../lib/exchangeRates'
import { formatPrice } from '../../lib/currency'
import type { Cafe } from '../../lib/types'
import { Button, Card, Spinner } from '../../components/ui'

interface BranchStat {
  cafe: Cafe
  todayOrderCount: number
  todayRevenue: number
  pendingReservations: number
}

// Tüm şubelerin bugünkü sipariş/ciro/bekleyen rezervasyon özetini tek ekranda
// gösterir. RLS zaten owns_cafe ile sahip olunan tüm şubelere izin verdiği
// için .in('cafe_id', ...) sorgusu ek bir yetkilendirme gerektirmez.
export default function Overview() {
  const { cafes, switchCafe } = useAuth()
  const navigate = useNavigate()
  const fxTable = useFxTable()
  const [stats, setStats] = useState<BranchStat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (cafes.length === 0) {
      setLoading(false)
      return
    }
    let cancelled = false

    async function load() {
      const cafeIds = cafes.map((c) => c.id)
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)

      const [ordersRes, reservationsRes] = await Promise.all([
        supabase
          .from('orders')
          .select('cafe_id, status, total')
          .in('cafe_id', cafeIds)
          .gte('created_at', todayStart.toISOString()),
        supabase
          .from('reservations')
          .select('cafe_id')
          .in('cafe_id', cafeIds)
          .eq('status', 'pending'),
      ])
      if (cancelled) return

      const orders = (ordersRes.data ?? []) as { cafe_id: string; status: string; total: number }[]
      const reservations = (reservationsRes.data ?? []) as { cafe_id: string }[]

      setStats(
        cafes.map((cafe) => {
          const cafeOrders = orders.filter((o) => o.cafe_id === cafe.id && o.status !== 'cancelled')
          return {
            cafe,
            todayOrderCount: cafeOrders.length,
            todayRevenue: cafeOrders.reduce((sum, o) => sum + o.total, 0),
            pendingReservations: reservations.filter((r) => r.cafe_id === cafe.id).length,
          }
        }),
      )
      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [cafes])

  if (loading) return <Spinner label="Yükleniyor…" />

  const combinedOrderCount = stats.reduce((sum, s) => sum + s.todayOrderCount, 0)
  const combinedReservations = stats.reduce((sum, s) => sum + s.pendingReservations, 0)
  const combinedRevenueTRY = fxTable
    ? stats.reduce((sum, s) => sum + convertPrice(s.todayRevenue, s.cafe.currency, 'TRY', fxTable), 0)
    : null

  return (
    <div className="max-w-3xl">
      <h1 className="mb-4 text-xl font-bold">Genel Bakış</h1>

      {stats.length > 1 && (
        <Card className="mb-4 border-cobalt bg-cobalt-soft">
          <h2 className="mb-3 font-semibold text-cobalt-deep">Tüm Şubeler (Bugün)</h2>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-2xl font-bold text-cobalt-deep">{combinedOrderCount}</p>
              <p className="text-xs text-cobalt-deep">Sipariş</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-cobalt-deep">
                {combinedRevenueTRY != null ? formatPrice(combinedRevenueTRY, 'TRY') : '—'}
              </p>
              <p className="text-xs text-cobalt-deep">≈ Toplam Ciro</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-cobalt-deep">{combinedReservations}</p>
              <p className="text-xs text-cobalt-deep">Bekleyen Rezervasyon</p>
            </div>
          </div>
          <p className="mt-3 text-xs text-cobalt-deep/70">
            Farklı para birimli şubeler güncel kurla TL'ye çevrilerek toplanmıştır — yaklaşık değerdir.
          </p>
        </Card>
      )}

      <div className="space-y-3">
        {stats.map((s) => (
          <Card key={s.cafe.id} className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-ink">{s.cafe.name}</p>
              <p className="text-sm text-ink-soft">
                Bugün {s.todayOrderCount} sipariş · {formatPrice(s.todayRevenue, s.cafe.currency)} ·{' '}
                {s.pendingReservations} bekleyen rezervasyon
              </p>
            </div>
            <Button
              variant="secondary"
              className="text-xs"
              onClick={() => {
                switchCafe(s.cafe.id)
                navigate('/panel')
              }}
            >
              Bu Şubeye Geç
            </Button>
          </Card>
        ))}
      </div>
    </div>
  )
}
