import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Spinner } from '../../components/ui'

interface ShiftRow {
  shift_id: string | null
  starts_at: string | null
  ends_at: string | null
  note: string | null
}

interface StaffShiftsState {
  loading: boolean
  staffName: string | null
  shifts: ShiftRow[]
}

function formatRange(startsAt: string, endsAt: string) {
  const start = new Date(startsAt)
  const end = new Date(endsAt)
  const day = start.toLocaleDateString('tr-TR', { weekday: 'long', day: '2-digit', month: 'long' })
  const startTime = start.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  const endTime = end.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  return { day, range: `${startTime} – ${endTime}` }
}

// Personelin Supabase Auth hesabı yok — bu sayfa tamamen id'nin (staffId,
// rastgele UUID) tahmin edilemez olmasına dayanır. PublicMenu.tsx'in
// "bulunamadı" görsel diliyle tutarlı.
export default function StaffShifts() {
  const { staffId } = useParams()
  const [state, setState] = useState<StaffShiftsState>({ loading: true, staffName: null, shifts: [] })

  useEffect(() => {
    if (!staffId) return
    let cancelled = false

    async function load() {
      const { data } = await supabase.rpc('get_staff_shifts', { p_staff_id: staffId })
      if (cancelled) return
      const rows = (data ?? []) as (ShiftRow & { staff_name: string; is_active: boolean })[]
      if (rows.length === 0 || !rows[0].is_active) {
        setState({ loading: false, staffName: null, shifts: [] })
        return
      }
      setState({
        loading: false,
        staffName: rows[0].staff_name,
        shifts: rows.filter((r) => r.shift_id != null),
      })
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [staffId])

  if (state.loading) return <Spinner label="Yükleniyor…" />

  if (!state.staffName) {
    return (
      <div className="mx-auto mt-24 max-w-sm px-4 text-center">
        <p className="font-display text-2xl font-bold text-cobalt">Vardiya bulunamadı</p>
        <p className="mt-2 text-sm text-ink-soft">
          Link geçersiz olabilir ya da artık aktif değilsiniz. İşletmenizle iletişime geçin.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg px-5 py-10">
      <h1 className="font-display text-3xl font-bold tracking-tight text-cobalt">
        Merhaba {state.staffName} 👋
      </h1>
      <p className="mt-2 text-sm text-ink-soft">Yaklaşan vardiyalarınız:</p>

      {state.shifts.length === 0 ? (
        <p className="mt-6 text-sm text-ink-soft">Şu an için planlanmış bir vardiyanız yok.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {state.shifts.map((s) => {
            const { day, range } = formatRange(s.starts_at!, s.ends_at!)
            return (
              <li key={s.shift_id} className="rounded-lg border border-line bg-surface p-3">
                <p className="font-semibold text-ink capitalize">{day}</p>
                <p className="text-sm text-ink-soft">{range}</p>
                {s.note && <p className="mt-1 text-xs text-ink-soft">Not: {s.note}</p>}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
