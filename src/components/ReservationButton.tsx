import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { getTrackedReservationIds, addTrackedReservation, removeTrackedReservation } from '../lib/reservationTracking'
import { useT } from '../context/LocaleContext'
import type { UIKey } from '../lib/uiText'
import type { Cafe, ReservationStatus } from '../lib/types'
import { Button, ErrorText, Input, Label, Textarea } from './ui'

interface Props {
  cafe: Cafe
}

type FormState = 'idle' | 'sending'

interface TrackedReservation {
  id: string
  status: ReservationStatus
  partySize: number
  reservationAt: string
}

const STATUS_ICON: Record<ReservationStatus, string> = {
  pending: '📅',
  confirmed: '✅',
  rejected: '❌',
  cancelled: '📅',
}

const STATUS_LABEL_KEY: Record<ReservationStatus, UIKey> = {
  pending: 'reservation.statusPending',
  confirmed: 'reservation.statusConfirmed',
  rejected: 'reservation.statusRejected',
  cancelled: 'reservation.statusCancelled',
}

const POLL_MS = 20000

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function fetchReservationStatus(id: string): Promise<TrackedReservation | null> {
  const { data, error } = await supabase.rpc('get_reservation_status', { p_id: id })
  if (error || !data || data.length === 0) return null
  const row = data[0] as { status: ReservationStatus; party_size: number; reservation_at: string }
  return { id, status: row.status, partySize: row.party_size, reservationAt: row.reservation_at }
}

// CallWaiterButton ile aynı yerde (PublicMenu.tsx) render edilir, ama masa
// oturumuna bağımlı değildir — özellik açıksa her zaman görünür. Sağ-altta
// CallWaiterButton olduğu için sol-altta konumlanır.
//
// Müşteri arka arkaya birden fazla rezervasyon verirse hepsinin durumunu aynı
// anda görebilir — sadece en sonuncusunu değil (bkz. reservationTracking.ts,
// CartButton.tsx'teki aynı desen).
export default function ReservationButton({ cafe }: Props) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [trackedReservations, setTrackedReservations] = useState<TrackedReservation[]>([])
  const [checkingTracked, setCheckingTracked] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [partySize, setPartySize] = useState('2')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [state, setState] = useState<FormState>('idle')

  useEffect(() => {
    if (!cafe.reservation_enabled) {
      setCheckingTracked(false)
      return
    }
    const ids = getTrackedReservationIds(cafe.slug)
    if (ids.length === 0) {
      setCheckingTracked(false)
      return
    }
    let cancelled = false
    Promise.all(ids.map(fetchReservationStatus)).then((results) => {
      if (cancelled) return
      const valid = results.filter((r): r is TrackedReservation => r != null)
      // Artık bulunamayan (silinmiş) rezervasyonları takipten düşür.
      for (const [i, id] of ids.entries()) {
        if (!results[i]) removeTrackedReservation(cafe.slug, id)
      }
      setTrackedReservations(valid)
      setCheckingTracked(false)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cafe.slug, cafe.reservation_enabled])

  // trackedReservations her yeni rezervasyon eklendiğinde değişiyor ama
  // interval'i her seferinde yeniden kurmak istemiyoruz — bir ref üzerinden en
  // güncel listeyi okuyoruz, aksi halde interval'in kapandığı an (closure)
  // hangi listeyse ona takılı kalır ve yeni eklenenler yanlış karta (ya da
  // hiç) eşlenirdi.
  const trackedRef = useRef<TrackedReservation[]>([])
  useEffect(() => {
    trackedRef.current = trackedReservations
  }, [trackedReservations])

  // Bekleyen rezervasyon varken durumu periyodik kontrol eder — işletme
  // onayladığı/reddettiği an, sayfa açık kalsa da müşteri yeniden okutmadan görür.
  const hasPending = trackedReservations.some((r) => r.status === 'pending')
  useEffect(() => {
    if (!hasPending) return
    const interval = window.setInterval(async () => {
      const ids = trackedRef.current.map((r) => r.id)
      const results = await Promise.all(ids.map(fetchReservationStatus))
      const byId = new Map(results.filter((r): r is TrackedReservation => r != null).map((r) => [r.id, r]))
      setTrackedReservations((prev) => prev.map((r) => byId.get(r.id) ?? r))
    }, POLL_MS)
    return () => window.clearInterval(interval)
  }, [hasPending])

  if (!cafe.reservation_enabled || checkingTracked) return null

  function close() {
    setOpen(false)
    setState('idle')
    setError('')
  }

  function dismissReservation(id: string) {
    removeTrackedReservation(cafe.slug, id)
    setTrackedReservations((prev) => prev.filter((r) => r.id !== id))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    const size = Number(partySize)
    if (!name.trim() || !phone.trim() || !date || !time || !Number.isFinite(size) || size < 1) {
      setError(t('reservation.validationError'))
      return
    }
    const reservationAt = new Date(`${date}T${time}`)
    if (Number.isNaN(reservationAt.getTime())) {
      setError(t('reservation.dateTimeError'))
      return
    }
    setState('sending')
    // Kaydettikten sonra geri okuyabilmek için (RLS'de anon'a genel bir okuma
    // izni yok — isim/telefon başkalarına sızmasın diye bilerek kapalı) id'yi
    // istemci üretip gönderiyoruz; böylece geri okumaya hiç gerek kalmıyor.
    const id = crypto.randomUUID()
    const { error: insertErr } = await supabase.from('reservations').insert({
      id,
      cafe_id: cafe.id,
      customer_name: name.trim(),
      phone: phone.trim(),
      party_size: size,
      reservation_at: reservationAt.toISOString(),
      note: note.trim() || null,
    })
    if (insertErr) {
      setState('idle')
      setError(t('reservation.submitError'))
      return
    }
    addTrackedReservation(cafe.slug, id)
    setTrackedReservations((prev) => [
      { id, status: 'pending', partySize: size, reservationAt: reservationAt.toISOString() },
      ...prev,
    ])
    setShowForm(false)
    setState('idle')
  }

  const today = new Date().toISOString().slice(0, 10)
  const pendingCount = trackedReservations.filter((r) => r.status === 'pending').length
  const buttonMeta =
    trackedReservations.length > 0
      ? {
          icon: '📅',
          label: `${t('reservation.myReservations')} (${trackedReservations.length})${pendingCount > 0 ? ' •' : ''}`,
        }
      : { icon: '📅', label: t('reservation.makeButton') }
  const displayForm = showForm || trackedReservations.length === 0

  return (
    <>
      <div className="fixed bottom-4 left-4 z-30 pb-[env(safe-area-inset-bottom)]">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-11 touch-manipulation items-center gap-2 rounded-full bg-cobalt px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-cobalt-deep active:scale-[0.97]"
        >
          <span aria-hidden>{buttonMeta.icon}</span>
          {buttonMeta.label}
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center sm:p-4"
          onClick={close}
          style={{ overscrollBehavior: 'contain' }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reservation-title"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-md flex-col rounded-xl bg-white shadow-xl"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-line p-4 sm:p-5">
              <h2 id="reservation-title" className="text-lg font-bold">
                {displayForm ? t('reservation.title') : t('reservation.myReservations')}
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="Kapat"
                className="flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-lg text-ink-soft hover:bg-porcelain hover:text-ink active:bg-porcelain"
              >
                ✕
              </button>
            </div>

            {!displayForm ? (
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-5">
                {trackedReservations.map((r) => (
                  <div
                    key={r.id}
                    className={`rounded-lg border p-4 text-center ${
                      r.status === 'confirmed'
                        ? 'border-teal bg-teal-soft'
                        : r.status === 'rejected' || r.status === 'cancelled'
                          ? 'border-coral bg-coral-soft'
                          : 'border-line bg-porcelain'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="flex-1 font-semibold text-ink">
                        {STATUS_ICON[r.status]} {t(STATUS_LABEL_KEY[r.status])}
                      </p>
                      {r.status !== 'pending' && (
                        <button
                          type="button"
                          onClick={() => dismissReservation(r.id)}
                          className="shrink-0 text-xs text-ink-soft underline"
                        >
                          {t('form.hide')}
                        </button>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-ink-soft">
                      {formatWhen(r.reservationAt)} · {t('reservation.partySizeSuffix', { n: r.partySize })}
                    </p>
                    {r.status === 'pending' && (
                      <p className="mt-2 text-xs text-ink-soft">{t('reservation.pendingNote')}</p>
                    )}
                    {r.status === 'rejected' && (
                      <p className="mt-2 text-xs text-ink-soft">{t('reservation.rejectedNote')}</p>
                    )}
                  </div>
                ))}
                <Button onClick={() => setShowForm(true)} variant="secondary" className="w-full">
                  {t('reservation.newButton')}
                </Button>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
                <div>
                  <Label>{t('reservation.nameLabel')} *</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div>
                  <Label>{t('reservation.phoneLabel')} *</Label>
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    placeholder="05xx xxx xx xx"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{t('reservation.dateLabel')} *</Label>
                    <Input
                      type="date"
                      value={date}
                      min={today}
                      onChange={(e) => setDate(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label>{t('reservation.timeLabel')} *</Label>
                    <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
                  </div>
                </div>
                <div>
                  <Label>{t('reservation.partySizeLabel')} *</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={partySize}
                    onChange={(e) => setPartySize(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label>{t('reservation.noteLabel')}</Label>
                  <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
                </div>
                <ErrorText>{error}</ErrorText>
                <Button type="submit" disabled={state === 'sending'} className="w-full">
                  {state === 'sending' ? t('reservation.submitting') : t('reservation.submitButton')}
                </Button>
                {trackedReservations.length > 0 && (
                  <Button type="button" variant="ghost" className="w-full" onClick={() => setShowForm(false)}>
                    {t('reservation.backToList')}
                  </Button>
                )}
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
