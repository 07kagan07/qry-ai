import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { SITE_URL, IS_LOCAL_URL } from '../../lib/siteUrl'
import type { Shift, Staff as StaffMember } from '../../lib/types'
import { Button, Card, ErrorText, Input, Label, Select, Textarea } from '../../components/ui'

type ShiftWithStaffName = Shift & { staffName: string }

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// "24:00" bir <input type="time"> değeri olarak geçerli değil — Akşam vardiyasının
// bitişi bir sonraki günün "00:00"ı olarak ifade edilir; addShift'teki "bitiş ≤
// başlangıçsa ertesi güne taş" mantığı bunu otomatik gece yarısını geçen bir
// vardiyaya çevirir.
const SHIFT_PRESETS = [
  { key: 'day', icon: '🌅', label: 'Gündüz', start: '08:00', end: '16:00' },
  { key: 'evening', icon: '🌆', label: 'Akşam', start: '16:00', end: '00:00' },
  { key: 'night', icon: '🌙', label: 'Gece', start: '00:00', end: '08:00' },
  { key: 'custom', icon: '✏️', label: 'Özel', start: '', end: '' },
] as const

function toDateStr(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const NEXT_7_DAYS = Array.from({ length: 7 }, (_, i) => {
  const d = new Date()
  d.setDate(d.getDate() + i)
  return d
})

// Gerçek sonsuz döngü yerine bilinçli olarak sınırlı bir ufuk (kullanıcıyla
// konuşuldu) — ekstra zamanlanmış görev (cron) altyapısı gerektirmiyor.
const RECURRENCE_WEEKS = 12

const WEEKDAY_LABELS = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

function weekdaySetLabel(items: ShiftWithStaffName[]) {
  const present = new Set(items.map((s) => new Date(s.starts_at).getDay()))
  return WEEKDAY_ORDER.filter((d) => present.has(d))
    .map((d) => WEEKDAY_LABELS[d])
    .join('/')
}

const MAX_CONTINUOUS_HOURS = 12

interface ShiftInterval {
  start: Date
  end: Date
  isNew: boolean
}

// Üst üste binen (overlap) ve arka arkaya/bitişik (adjacent) vardiyaları tek
// bloklara birleştirir — çakışma ve uzun kesintisiz çalışma kontrolü için.
function mergeShiftIntervals(intervals: ShiftInterval[]) {
  const sorted = [...intervals].sort((a, b) => a.start.getTime() - b.start.getTime())
  const blocks: { start: Date; end: Date; hasNew: boolean; overlap: boolean }[] = []
  for (const cur of sorted) {
    const last = blocks[blocks.length - 1]
    if (last && cur.start <= last.end) {
      if (cur.start < last.end) last.overlap = true
      if (cur.end > last.end) last.end = cur.end
      last.hasNew = last.hasNew || cur.isNew
    } else {
      blocks.push({ start: cur.start, end: cur.end, hasNew: cur.isNew, overlap: false })
    }
  }
  return blocks
}

// Yeni eklenen vardiya(lar), aynı personelin mevcut vardiyalarıyla çakışıyor
// mu ya da arka arkaya gelip MAX_CONTINUOUS_HOURS'tan uzun kesintisiz bir
// çalışma bloğu oluşturuyor mu — varsa kullanıcıya sorulacak uyarı metnini
// döner (engellemez, sadece onay ister).
function findShiftWarning(
  staffId: string,
  newRows: { starts_at: string; ends_at: string }[],
  existingShifts: ShiftWithStaffName[],
): string | null {
  const intervals: ShiftInterval[] = [
    ...existingShifts
      .filter((s) => s.staff_id === staffId)
      .map((s) => ({ start: new Date(s.starts_at), end: new Date(s.ends_at), isNew: false })),
    ...newRows.map((r) => ({ start: new Date(r.starts_at), end: new Date(r.ends_at), isNew: true })),
  ]
  for (const block of mergeShiftIntervals(intervals)) {
    if (!block.hasNew) continue
    if (block.overlap) {
      return 'Bu personelin seçtiğiniz saatlerde zaten başka bir vardiyası var. Yine de kaydetmek istiyor musunuz?'
    }
    const hours = (block.end.getTime() - block.start.getTime()) / (60 * 60 * 1000)
    if (hours > MAX_CONTINUOUS_HOURS) {
      return `Bu personel kesintisiz yaklaşık ${Math.round(hours)} saat çalışmış olacak (${MAX_CONTINUOUS_HOURS} saatten fazla). Yine de kaydetmek istiyor musunuz?`
    }
  }
  return null
}

// Tekrar eden bir seriye ait onlarca satırı tek tek listelemek yerine (12
// hafta × birden fazla gün = çok kalabalık olurdu) tek bir özet karta
// gruplar; tekil vardiyalar ayrı listelenir.
function groupShifts(shifts: ShiftWithStaffName[]) {
  const oneOff: ShiftWithStaffName[] = []
  const recurringMap = new Map<string, ShiftWithStaffName[]>()
  for (const s of shifts) {
    if (s.recurrence_id) {
      const list = recurringMap.get(s.recurrence_id) ?? []
      list.push(s)
      recurringMap.set(s.recurrence_id, list)
    } else {
      oneOff.push(s)
    }
  }
  return { oneOff, recurringGroups: Array.from(recurringMap.entries()) }
}

export default function Staff() {
  const { cafe } = useAuth()
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [shifts, setShifts] = useState<ShiftWithStaffName[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [newStaffName, setNewStaffName] = useState('')
  const [addStaffBusy, setAddStaffBusy] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const [showShiftForm, setShowShiftForm] = useState(false)
  const [shiftStaffId, setShiftStaffId] = useState('')
  const [shiftPreset, setShiftPreset] = useState<string | null>(null)
  const [shiftStart, setShiftStart] = useState('')
  const [shiftEnd, setShiftEnd] = useState('')
  const [selectedDays, setSelectedDays] = useState<string[]>([])
  const [repeatWeekly, setRepeatWeekly] = useState(false)
  const [shiftNote, setShiftNote] = useState('')
  const [shiftBusy, setShiftBusy] = useState(false)
  const [shiftError, setShiftError] = useState('')
  const [expandedRecurrence, setExpandedRecurrence] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!cafe) return
    const [staffRes, shiftsRes] = await Promise.all([
      supabase.from('staff').select('*').eq('cafe_id', cafe.id).order('name'),
      supabase
        .from('shifts')
        .select('*, staff(name)')
        .eq('cafe_id', cafe.id)
        .gte('ends_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('starts_at'),
    ])
    if (staffRes.error || shiftsRes.error) {
      setError((staffRes.error ?? shiftsRes.error)!.message)
    } else {
      setStaff(staffRes.data as StaffMember[])
      setShifts(
        (shiftsRes.data as (Shift & { staff: { name: string } | null })[]).map((s) => ({
          ...s,
          staffName: s.staff?.name ?? 'Bilinmeyen personel',
        })),
      )
    }
    setLoading(false)
  }, [cafe])

  useEffect(() => {
    void load()
  }, [load])

  if (!cafe) return null

  async function addStaff() {
    const name = newStaffName.trim()
    if (!name) return
    setAddStaffBusy(true)
    const { error: insertErr } = await supabase.from('staff').insert({ cafe_id: cafe!.id, name })
    setAddStaffBusy(false)
    if (insertErr) {
      setError(insertErr.message)
      return
    }
    setNewStaffName('')
    await load()
  }

  async function toggleStaffActive(member: StaffMember) {
    const { error: updateErr } = await supabase
      .from('staff')
      .update({ is_active: !member.is_active })
      .eq('id', member.id)
    if (updateErr) setError(updateErr.message)
    else await load()
  }

  async function deleteStaff(member: StaffMember) {
    if (!window.confirm(`"${member.name}" silinecek (vardiyaları da silinir). Emin misiniz?`)) return
    const { error: deleteErr } = await supabase.from('staff').delete().eq('id', member.id)
    if (deleteErr) setError(deleteErr.message)
    else await load()
  }

  async function copyLink(member: StaffMember) {
    const url = `${SITE_URL}/vardiya/${member.id}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(member.id)
      window.setTimeout(() => setCopiedId(null), 1600)
    } catch {
      // Panoya erişim engellenmiş olabilir — sessizce yoksay, link zaten görülebilir değilse de kopyalanabilir.
    }
  }

  function applyPreset(preset: (typeof SHIFT_PRESETS)[number]) {
    setShiftPreset(preset.key)
    setShiftStart(preset.start)
    setShiftEnd(preset.end)
  }

  function toggleDay(dateStr: string) {
    setSelectedDays((prev) => (prev.includes(dateStr) ? prev.filter((d) => d !== dateStr) : [...prev, dateStr]))
  }

  async function addShift(e: FormEvent) {
    e.preventDefault()
    setShiftError('')
    if (!shiftStaffId || selectedDays.length === 0 || !shiftStart || !shiftEnd) {
      setShiftError('Lütfen personel, en az bir gün ve saat aralığı seçin.')
      return
    }
    // Form açıkken personel silinmiş/değiştirilmiş olabilir — göndermeden önce
    // hâlâ mevcut olduğunu doğrula (aksi halde DB'den anlaşılır olmayan bir
    // foreign key hatası döner).
    if (!staff.some((m) => m.id === shiftStaffId)) {
      setShiftError('Seçtiğiniz personel artık mevcut değil. Lütfen listeden tekrar seçin.')
      setShiftStaffId('')
      await load()
      return
    }
    // "Her hafta tekrarla" işaretliyse aynı gün(ler) için RECURRENCE_WEEKS hafta
    // boyunca satırlar tek seferde oluşturulur, ortak bir recurrence_id ile
    // etiketlenir — "Tüm Tekrarı İptal Et" bu id'ye sahip gelecek satırları
    // toplu siler, tek bir günü izinli yapmak ise mevcut tekil "Sil" ile mümkün.
    const recurrenceId = repeatWeekly ? crypto.randomUUID() : null
    const weekCount = repeatWeekly ? RECURRENCE_WEEKS : 1
    const rows: {
      cafe_id: string
      staff_id: string
      starts_at: string
      ends_at: string
      note: string | null
      recurrence_id: string | null
    }[] = []
    for (let week = 0; week < weekCount; week++) {
      for (const dateStr of selectedDays) {
        const baseDate = new Date(`${dateStr}T00:00:00`)
        baseDate.setDate(baseDate.getDate() + week * 7)
        const targetDateStr = toDateStr(baseDate)
        const startsAt = new Date(`${targetDateStr}T${shiftStart}`)
        let endsAt = new Date(`${targetDateStr}T${shiftEnd}`)
        if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
          setShiftError('Geçerli bir saat girin.')
          return
        }
        // Bitiş, başlangıçtan önce/eşitse gece yarısını geçen bir vardiya demektir
        // (ör. Akşam: 16:00 → ertesi gün 00:00) — otomatik ertesi güne taşınır.
        if (endsAt <= startsAt) {
          endsAt = new Date(endsAt.getTime() + 24 * 60 * 60 * 1000)
        }
        rows.push({
          cafe_id: cafe!.id,
          staff_id: shiftStaffId,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          note: shiftNote.trim() || null,
          recurrence_id: recurrenceId,
        })
      }
    }
    const warning = findShiftWarning(shiftStaffId, rows, shifts)
    if (warning && !window.confirm(warning)) {
      return
    }

    setShiftBusy(true)
    const { error: insertErr } = await supabase.from('shifts').insert(rows)
    setShiftBusy(false)
    if (insertErr) {
      // 23503: foreign key ihlali — personel tam gönderim anında silinmiş olabilir.
      if (insertErr.code === '23503') {
        setShiftError('Seçtiğiniz personel artık mevcut değil. Lütfen listeden tekrar seçin.')
        setShiftStaffId('')
        await load()
      } else {
        setShiftError(insertErr.message)
      }
      return
    }
    setShiftPreset(null)
    setShiftStart('')
    setShiftEnd('')
    setSelectedDays([])
    setRepeatWeekly(false)
    setShiftNote('')
    setShowShiftForm(false)
    await load()
  }

  async function deleteShift(shift: ShiftWithStaffName) {
    if (!window.confirm('Bu vardiya silinecek. Emin misiniz?')) return
    const { error: deleteErr } = await supabase.from('shifts').delete().eq('id', shift.id)
    if (deleteErr) setError(deleteErr.message)
    else await load()
  }

  async function cancelRecurrence(recurrenceId: string) {
    if (!window.confirm('Bu tekrar eden vardiyanın kalan tüm günleri silinecek. Emin misiniz?')) return
    const { error: deleteErr } = await supabase
      .from('shifts')
      .delete()
      .eq('recurrence_id', recurrenceId)
      .gte('starts_at', new Date().toISOString())
    if (deleteErr) setError(deleteErr.message)
    else await load()
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-xl font-bold">Vardiyalar</h1>

      {IS_LOCAL_URL && (
        <Card className="mb-4 border-coral bg-coral-soft">
          <p className="text-sm leading-relaxed text-coral-deep">
            Personel linkleri şu an geliştirme adresinde (localhost) üretiliyor, telefonda
            çalışmaz. Yayına aldıktan sonra <code>VITE_PUBLIC_SITE_URL</code> ayarlanmalı.
          </p>
        </Card>
      )}

      <ErrorText>{error}</ErrorText>

      <Card className="mb-4">
        <h2 className="mb-3 font-semibold text-ink">Personel</h2>
        <div className="mb-4 flex max-w-md gap-2">
          <Input
            value={newStaffName}
            onChange={(e) => setNewStaffName(e.target.value)}
            placeholder="Personel adı (örn: Ayşe Yılmaz)"
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addStaff())}
          />
          <Button onClick={addStaff} disabled={addStaffBusy} className="shrink-0">
            Ekle
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-ink-soft">Yükleniyor…</p>
        ) : staff.length === 0 ? (
          <p className="text-sm text-ink-soft">Henüz personel eklenmedi.</p>
        ) : (
          <ul className="space-y-2">
            {staff.map((member) => (
              <li
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-3"
              >
                <div>
                  <p className={`font-medium ${member.is_active ? 'text-ink' : 'text-ink-soft line-through'}`}>
                    {member.name}
                  </p>
                  <p className="text-xs text-ink-soft">{member.is_active ? 'Aktif' : 'Pasif'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" className="text-xs" onClick={() => copyLink(member)}>
                    {copiedId === member.id ? 'Kopyalandı ✓' : 'Link Kopyala'}
                  </Button>
                  <Button variant="secondary" className="text-xs" onClick={() => toggleStaffActive(member)}>
                    {member.is_active ? 'Pasif yap' : 'Aktif yap'}
                  </Button>
                  <Button variant="danger" className="text-xs" onClick={() => deleteStaff(member)}>
                    Sil
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-ink">Vardiyalar</h2>
          <Button
            variant="secondary"
            className="!px-3 !py-1.5 text-xs"
            onClick={() => setShowShiftForm((v) => !v)}
            disabled={staff.length === 0}
          >
            + Vardiya Ekle
          </Button>
        </div>
        {staff.length === 0 && (
          <p className="mb-3 text-xs text-ink-soft">Vardiya eklemek için önce bir personel ekleyin.</p>
        )}

        {showShiftForm && (
          <form onSubmit={addShift} className="mb-4 space-y-3 rounded-lg border border-line bg-porcelain p-3">
            <div>
              <Label>Personel</Label>
              <Select value={shiftStaffId} onChange={(e) => setShiftStaffId(e.target.value)} required>
                <option value="" disabled>
                  Seçin…
                </option>
                {staff.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Vardiya Tipi</Label>
              <div className="flex flex-wrap gap-2">
                {SHIFT_PRESETS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className={`min-h-9 touch-manipulation rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      shiftPreset === p.key
                        ? 'border-cobalt bg-cobalt text-white'
                        : 'border-line bg-white text-ink hover:border-cobalt'
                    }`}
                  >
                    {p.icon} {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Başlangıç</Label>
                <Input
                  type="time"
                  value={shiftStart}
                  onChange={(e) => {
                    setShiftStart(e.target.value)
                    setShiftPreset(null)
                  }}
                  required
                />
              </div>
              <div>
                <Label>Bitiş</Label>
                <Input
                  type="time"
                  value={shiftEnd}
                  onChange={(e) => {
                    setShiftEnd(e.target.value)
                    setShiftPreset(null)
                  }}
                  required
                />
              </div>
            </div>
            <div>
              <Label>Günler (birden fazla seçilebilir)</Label>
              <div className="flex flex-wrap gap-2">
                {NEXT_7_DAYS.map((d) => {
                  const dateStr = toDateStr(d)
                  const active = selectedDays.includes(dateStr)
                  return (
                    <button
                      key={dateStr}
                      type="button"
                      onClick={() => toggleDay(dateStr)}
                      className={`min-h-9 touch-manipulation rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                        active
                          ? 'border-cobalt bg-cobalt text-white'
                          : 'border-line bg-white text-ink hover:border-cobalt'
                      }`}
                    >
                      {d.toLocaleDateString('tr-TR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                    </button>
                  )
                })}
              </div>
            </div>
            <label className="flex min-h-9 items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={repeatWeekly}
                onChange={(e) => setRepeatWeekly(e.target.checked)}
                className="h-4 w-4"
              />
              🔁 Her hafta tekrarla (önümüzdeki {RECURRENCE_WEEKS} hafta boyunca, siz iptal edene kadar)
            </label>
            <div>
              <Label>Not (opsiyonel)</Label>
              <Textarea rows={2} value={shiftNote} onChange={(e) => setShiftNote(e.target.value)} />
            </div>
            <ErrorText>{shiftError}</ErrorText>
            <Button type="submit" disabled={shiftBusy}>
              {shiftBusy
                ? 'Kaydediliyor…'
                : selectedDays.length > 1
                  ? `${selectedDays.length} Gün İçin Kaydet`
                  : 'Vardiyayı Kaydet'}
            </Button>
          </form>
        )}

        {shifts.length === 0 ? (
          <p className="text-sm text-ink-soft">Yaklaşan vardiya yok.</p>
        ) : (
          (() => {
            const { oneOff, recurringGroups } = groupShifts(shifts)
            return (
              <div className="space-y-4">
                {recurringGroups.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold tracking-wide text-ink-soft uppercase">
                      Tekrar Eden Vardiyalar
                    </p>
                    <ul className="space-y-2">
                      {recurringGroups.map(([recId, items]) => {
                        const first = items[0]
                        const last = items[items.length - 1]
                        const startTime = new Date(first.starts_at).toLocaleTimeString('tr-TR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                        const endTime = new Date(first.ends_at).toLocaleTimeString('tr-TR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                        const expanded = expandedRecurrence === recId
                        return (
                          <li key={recId} className="rounded-lg border border-line p-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="font-medium text-ink">
                                  🔁 {first.staffName} — {weekdaySetLabel(items)} {startTime}-{endTime}
                                </p>
                                <p className="text-xs text-ink-soft">
                                  {new Date(first.starts_at).toLocaleDateString('tr-TR', {
                                    day: '2-digit',
                                    month: '2-digit',
                                  })}
                                  {' – '}
                                  {new Date(last.starts_at).toLocaleDateString('tr-TR', {
                                    day: '2-digit',
                                    month: '2-digit',
                                  })}
                                  {` (${items.length} vardiya)`}
                                </p>
                                {first.note && <p className="text-xs text-ink-soft">Not: {first.note}</p>}
                              </div>
                              <div className="flex shrink-0 flex-col gap-2">
                                <Button
                                  variant="secondary"
                                  className="text-xs"
                                  onClick={() => setExpandedRecurrence(expanded ? null : recId)}
                                >
                                  {expanded ? 'Günleri Gizle' : 'Günleri Gör'}
                                </Button>
                                <Button variant="danger" className="text-xs" onClick={() => cancelRecurrence(recId)}>
                                  Tüm Tekrarı İptal Et
                                </Button>
                              </div>
                            </div>
                            {expanded && (
                              <ul className="mt-3 space-y-1.5 border-t border-line pt-3">
                                {items.map((s) => (
                                  <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                                    <span className="text-ink">{formatWhen(s.starts_at)}</span>
                                    <button
                                      type="button"
                                      onClick={() => deleteShift(s)}
                                      className="text-xs font-medium text-coral-deep hover:underline"
                                    >
                                      Sil (bu günü izinli yap)
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}

                {oneOff.length > 0 && (
                  <div>
                    {recurringGroups.length > 0 && (
                      <p className="mb-2 text-xs font-semibold tracking-wide text-ink-soft uppercase">
                        Tekil Vardiyalar
                      </p>
                    )}
                    <ul className="space-y-2">
                      {oneOff.map((s) => (
                        <li
                          key={s.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-3"
                        >
                          <div>
                            <p className="font-medium text-ink">
                              {formatWhen(s.starts_at)} –{' '}
                              {new Date(s.ends_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <p className="text-xs text-ink-soft">{s.staffName}</p>
                            {s.note && <p className="text-xs text-ink-soft">Not: {s.note}</p>}
                          </div>
                          <Button variant="danger" className="text-xs" onClick={() => deleteShift(s)}>
                            Sil
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )
          })()
        )}
      </Card>
    </div>
  )
}
