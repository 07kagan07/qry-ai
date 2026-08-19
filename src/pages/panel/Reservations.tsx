import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import type { Reservation, ReservationStatus } from '../../lib/types'
import { Button, Card, ErrorText } from '../../components/ui'

const STATUS_LABEL: Record<ReservationStatus, string> = {
  pending: 'Bekliyor',
  confirmed: 'Onaylandı',
  rejected: 'Reddedildi',
  cancelled: 'İptal edildi',
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function Reservations() {
  const { cafe, refreshCafe } = useAuth()
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toggleBusy, setToggleBusy] = useState(false)

  useEffect(() => {
    if (!cafe) return
    let cancelled = false

    async function load() {
      const { data, error: loadErr } = await supabase
        .from('reservations')
        .select('*')
        .eq('cafe_id', cafe!.id)
        .order('reservation_at', { ascending: true })
      if (cancelled) return
      if (loadErr) setError(loadErr.message)
      else setReservations((data ?? []) as Reservation[])
      setLoading(false)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [cafe])

  useEffect(() => {
    if (!cafe) return
    const channel = supabase
      .channel(`panel_reservations_${cafe.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservations', filter: `cafe_id=eq.${cafe.id}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as Reservation
            setReservations((prev) =>
              [...prev, row].sort((a, b) => a.reservation_at.localeCompare(b.reservation_at)),
            )
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as Reservation
            setReservations((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...row } : r)))
          }
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [cafe])

  // Sesli uyarı ve bekleyen sayısı artık panelin her sayfasında çalışan
  // usePendingCounts (PanelLayout.tsx) ile geliyor — burada tekrar etmiyor.

  if (!cafe) return null

  async function toggleReservation(enabled: boolean) {
    setToggleBusy(true)
    const { error: toggleErr } = await supabase
      .from('cafes')
      .update({ reservation_enabled: enabled })
      .eq('id', cafe!.id)
    setToggleBusy(false)
    if (toggleErr) {
      setError(toggleErr.message)
      return
    }
    await refreshCafe()
  }

  async function updateStatus(res: Reservation, status: ReservationStatus) {
    const { error: updateErr } = await supabase
      .from('reservations')
      .update({ status })
      .eq('id', res.id)
    if (updateErr) {
      setError(updateErr.message)
      return
    }
    setReservations((prev) => prev.map((r) => (r.id === res.id ? { ...r, status } : r)))
  }

  const activeReservations = reservations.filter(
    (r) => r.status === 'pending' || r.status === 'confirmed',
  )
  const pastReservations = reservations.filter(
    (r) => r.status === 'rejected' || r.status === 'cancelled',
  )

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-xl font-bold">Rezervasyonlar</h1>

      <Card className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-ink">Rezervasyon</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Açarsanız müşteriler menüden "Rezervasyon Yap" ile talep gönderebilir. Talepler
              aşağıda anlık görünür, onaylayıp/reddedebilirsiniz.
            </p>
          </div>
          <label className={`relative inline-flex min-h-11 min-w-11 shrink-0 touch-manipulation items-center ${toggleBusy ? 'opacity-60' : ''}`}>
            <input
              type="checkbox"
              checked={cafe.reservation_enabled}
              onChange={(e) => toggleReservation(e.target.checked)}
              disabled={toggleBusy}
              className="peer sr-only"
            />
            <span className="h-6 w-11 rounded-full bg-line transition-colors peer-checked:bg-cobalt" />
            <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
          </label>
        </div>
        <ErrorText>{error}</ErrorText>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold text-ink">Talepler</h2>
        {loading ? (
          <p className="text-sm text-ink-soft">Yükleniyor…</p>
        ) : activeReservations.length === 0 ? (
          <p className="text-sm text-ink-soft">Bekleyen ya da onaylı rezervasyon yok.</p>
        ) : (
          <ul className="space-y-2">
            {activeReservations.map((r) => (
              <li
                key={r.id}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 ${
                  r.status === 'pending' ? 'border-coral bg-coral-soft' : 'border-teal bg-teal-soft'
                }`}
              >
                <div className="min-w-0">
                  <p className={`font-semibold ${r.status === 'pending' ? 'text-coral-deep' : 'text-teal-deep'}`}>
                    {formatWhen(r.reservation_at)} — {r.customer_name} ({r.party_size} kişi)
                  </p>
                  <p className="text-xs text-ink-soft">
                    <a href={`tel:${r.phone}`} className="underline">
                      {r.phone}
                    </a>
                    {' — '}
                    {STATUS_LABEL[r.status]}
                  </p>
                  {r.note && <p className="mt-0.5 text-xs text-ink-soft">Not: {r.note}</p>}
                </div>
                <div className="flex shrink-0 gap-2">
                  {r.status === 'pending' && (
                    <>
                      <Button className="text-xs" onClick={() => updateStatus(r, 'confirmed')}>
                        Onayla
                      </Button>
                      <Button
                        variant="secondary"
                        className="text-xs"
                        onClick={() => updateStatus(r, 'rejected')}
                      >
                        Reddet
                      </Button>
                    </>
                  )}
                  {r.status === 'confirmed' && (
                    <Button
                      variant="danger"
                      className="text-xs"
                      onClick={() => updateStatus(r, 'cancelled')}
                    >
                      İptal Et
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {pastReservations.length > 0 && (
          <div className="mt-4 border-t border-line pt-3">
            <p className="mb-2 text-xs font-semibold tracking-wide text-ink-soft uppercase">
              Geçmiş
            </p>
            <ul className="space-y-1.5">
              {pastReservations.map((r) => (
                <li key={r.id} className="text-xs text-ink-soft">
                  {formatWhen(r.reservation_at)} — {r.customer_name} ({r.party_size} kişi) —{' '}
                  {STATUS_LABEL[r.status]}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </div>
  )
}
