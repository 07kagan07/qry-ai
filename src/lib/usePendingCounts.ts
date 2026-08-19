import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Cafe } from './types'

export interface PendingCounts {
  waiterCalls: number
  reservations: number
  orders: number
}

const ZERO: PendingCounts = { waiterCalls: 0, reservations: 0, orders: 0 }

async function countPending(table: string, cafeId: string) {
  const { count } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('cafe_id', cafeId)
    .eq('status', 'pending')
  return count ?? 0
}

// Panelin her sayfasında (hangi sekmedeyseniz olun) çalışsın diye
// PanelLayout.tsx'te tek yerden çağrılır — böylece sesli uyarı ve bekleyen
// sayıları, sadece o özelliğin kendi sayfası açıkken değil her zaman güncel
// kalır (bkz. Reservations/Orders/TablesAndCalls.tsx'ten çıkarılan sayfa-özel
// bip mantığı).
export function usePendingCounts(cafe: Cafe | null): PendingCounts {
  const [counts, setCounts] = useState<PendingCounts>(ZERO)

  const refresh = useCallback(async () => {
    if (!cafe) {
      setCounts(ZERO)
      return
    }
    const [waiterCalls, reservations, orders] = await Promise.all([
      cafe.waiter_call_enabled ? countPending('waiter_calls', cafe.id) : Promise.resolve(0),
      cafe.reservation_enabled ? countPending('reservations', cafe.id) : Promise.resolve(0),
      cafe.order_enabled ? countPending('orders', cafe.id) : Promise.resolve(0),
    ])
    setCounts({ waiterCalls, reservations, orders })
  }, [cafe])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!cafe) return
    const channel = supabase
      .channel(`panel_pending_${cafe.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'waiter_calls', filter: `cafe_id=eq.${cafe.id}` },
        () => void refresh(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservations', filter: `cafe_id=eq.${cafe.id}` },
        () => void refresh(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `cafe_id=eq.${cafe.id}` },
        () => void refresh(),
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [cafe, refresh])

  return counts
}
