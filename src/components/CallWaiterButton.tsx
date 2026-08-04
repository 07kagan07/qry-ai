import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Cafe, WaiterCallStatus } from '../lib/types'

interface Props {
  cafe: Cafe
  /** URL'deki ?masa= değeri — kısa ömürlü geçici oturum id'si (kalıcı masa id'si değil). */
  sessionId: string | null
}

type ResolvedState =
  | { kind: 'off' }
  | { kind: 'no-session' }
  | { kind: 'expired' }
  | { kind: 'ready'; tableId: string; cafeId: string; expiresAt: number; status: WaiterCallStatus | null }

// Menünün en dış kabuğunda, tüm temalarda tutarlı görünsün diye render edilir
// (AllergenLegend/AllergenFilterBar ile aynı paylaşım deseni). Özellik kapalıysa
// ya da masasız genel menü linkindeyse hiçbir şey render etmez. Ama masa QR'ından
// gelinmiş, oturumu süresi dolmuş bir linkse (ör. ertesi gün açılan eski sekme)
// müşteriye QR'ı tekrar okutması gerektiğini bildirir — sessizce kaybolmak yerine.
export default function CallWaiterButton({ cafe, sessionId }: Props) {
  const [state, setState] = useState<ResolvedState | null>(null)
  const [sending, setSending] = useState(false)
  const [justCalled, setJustCalled] = useState(false)

  useEffect(() => {
    setState(null)
    if (!cafe.waiter_call_enabled) {
      setState({ kind: 'off' })
      return
    }
    if (!sessionId) {
      setState({ kind: 'no-session' })
      return
    }
    let cancelled = false

    async function resolve() {
      const { data: session } = await supabase
        .from('table_sessions')
        .select('table_id, cafe_id, expires_at')
        .eq('id', sessionId)
        .maybeSingle()
      if (cancelled) return
      const expiresAt = session ? new Date(session.expires_at).getTime() : 0
      if (!session || expiresAt <= Date.now()) {
        setState({ kind: 'expired' })
        return
      }

      const { data: activeCall } = await supabase
        .from('waiter_calls')
        .select('status')
        .eq('table_id', session.table_id)
        .in('status', ['pending', 'acknowledged'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (cancelled) return

      setState({
        kind: 'ready',
        tableId: session.table_id,
        cafeId: session.cafe_id,
        expiresAt,
        status: (activeCall?.status as WaiterCallStatus | undefined) ?? null,
      })
    }

    void resolve()
    return () => {
      cancelled = true
    }
  }, [cafe.waiter_call_enabled, sessionId])

  useEffect(() => {
    if (state?.kind !== 'ready') return
    const tableId = state.tableId
    const channel = supabase
      .channel(`waiter_calls_${tableId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'waiter_calls', filter: `table_id=eq.${tableId}` },
        (payload) => {
          const row = payload.new as { status?: WaiterCallStatus } | null
          setState((prev) => {
            if (!prev || prev.kind !== 'ready') return prev
            const nextStatus = row?.status === 'resolved' ? null : (row?.status ?? null)
            return { ...prev, status: nextStatus }
          })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
    // tableId sabit kalır (state.kind === 'ready' olduğu sürece); yalnızca bağlanırken kurulur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.kind === 'ready' ? state.tableId : null])

  // Sekme açık kalıp sayfa yeniden yüklenmese bile, oturum süresi dolar dolmaz
  // arayüz otomatik "tekrar okutun" durumuna geçsin — sunucudaki RLS kontrolü
  // (aşağıdaki callWaiter'da da ele alınır) zaten çağrıyı reddeder, ama bunu
  // önceden gösterip müşterinin boşuna butona basmasını engelliyoruz.
  const readyExpiresAt = state?.kind === 'ready' ? state.expiresAt : null
  useEffect(() => {
    if (readyExpiresAt == null) return
    const msLeft = readyExpiresAt - Date.now()
    if (msLeft <= 0) {
      setState({ kind: 'expired' })
      return
    }
    const timer = window.setTimeout(() => setState({ kind: 'expired' }), msLeft)
    return () => window.clearTimeout(timer)
  }, [readyExpiresAt])

  if (!state || state.kind === 'off' || state.kind === 'no-session') return null

  if (state.kind === 'expired') {
    return (
      <div className="fixed right-4 bottom-4 z-30 max-w-[calc(100%-2rem)] pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink-soft shadow-lg">
          <span aria-hidden>🔄</span>
          Garson çağırmak için QR kodu tekrar okutun
        </div>
      </div>
    )
  }

  async function callWaiter() {
    if (state?.kind !== 'ready' || sending) return
    setSending(true)
    const { error } = await supabase
      .from('waiter_calls')
      .insert({ cafe_id: state.cafeId, table_id: state.tableId, status: 'pending' })
    setSending(false)
    if (error && error.code !== '23505') {
      // RLS reddi (42501) genelde oturumun az önce, istemci fark etmeden süresinin
      // dolması demektir — sunucu tarafındaki asıl güvenlik kontrolü budur.
      setState({ kind: 'expired' })
      return
    }
    // 23505: zaten bekleyen bir çağrı var (kısmi unique index) — hata değil, mevcut durumu yansıt.
    setState((prev) => (prev?.kind === 'ready' ? { ...prev, status: 'pending' } : prev))
    setJustCalled(true)
    window.setTimeout(() => setJustCalled(false), 2500)
  }

  const { status } = state

  return (
    <div className="fixed right-4 bottom-4 z-30 pb-[env(safe-area-inset-bottom)]">
      {status === 'pending' ? (
        <div className="flex min-h-11 touch-manipulation items-center gap-2 rounded-full border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink-soft shadow-lg">
          <span aria-hidden>🔔</span>
          {justCalled ? 'Garson çağrıldı ✓' : 'Çağrınız iletildi'}
        </div>
      ) : status === 'acknowledged' ? (
        <div className="flex min-h-11 touch-manipulation items-center gap-2 rounded-full border border-teal bg-teal-soft px-4 py-2.5 text-sm font-semibold text-teal-deep shadow-lg">
          <span aria-hidden>🚶</span>
          Personel geliyor
        </div>
      ) : (
        <button
          type="button"
          onClick={callWaiter}
          disabled={sending}
          className="flex min-h-11 touch-manipulation items-center gap-2 rounded-full bg-cobalt px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-cobalt-deep active:scale-[0.97] disabled:opacity-60"
        >
          <span aria-hidden>🔔</span>
          {sending ? 'Çağrılıyor…' : 'Garson Çağır'}
        </button>
      )}
    </div>
  )
}
