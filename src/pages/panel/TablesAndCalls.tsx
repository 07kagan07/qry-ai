import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { SITE_URL, IS_LOCAL_URL } from '../../lib/siteUrl'
import type { Table, WaiterCall, WaiterCallStatus } from '../../lib/types'
import { Button, Card, ErrorText, Input } from '../../components/ui'

type CallWithLabel = WaiterCall & { tableLabel: string }

// Tek bir AudioContext yeniden kullanılır (her bip için yenisini açmak yerine).
// Tarayıcılar, kullanıcı sayfayla hiç etkileşmeden sesin otomatik çalmasını
// engeller (autoplay policy) — bu yüzden context ilk dokunma/tuş basımında
// "unlockAudio" ile önceden açılıp kilidi kaldırılır; sonraki çağrılarda
// kullanıcı etkileşimi olmadan da (arka planda) ses çalabilir.
let sharedAudioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  try {
    if (!sharedAudioCtx) sharedAudioCtx = new AudioContext()
    if (sharedAudioCtx.state === 'suspended') void sharedAudioCtx.resume()
    return sharedAudioCtx
  } catch {
    return null
  }
}

// Kısa bir bip — bağımlılık eklemeden, Web Audio API ile üretilir.
function beep() {
  const ctx = getAudioContext()
  if (!ctx) return
  try {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.6, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.start()
    osc.stop(ctx.currentTime + 0.4)
  } catch {
    // Tarayıcı Web Audio'yu engellemiş olabilir — sessizce yoksay.
  }
}

function TableRow({ table, onDeleted, onToggled }: {
  table: Table
  onDeleted: (id: string) => void
  onToggled: (id: string, is_active: boolean) => void
}) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const url = `${SITE_URL}/t/${table.id}`

  async function toggleActive() {
    setBusy(true)
    const { error } = await supabase
      .from('tables')
      .update({ is_active: !table.is_active })
      .eq('id', table.id)
    setBusy(false)
    if (!error) onToggled(table.id, !table.is_active)
  }

  async function remove() {
    if (!window.confirm(`"${table.label}" masasını silmek istediğinize emin misiniz?`)) return
    setBusy(true)
    const { error } = await supabase.from('tables').delete().eq('id', table.id)
    setBusy(false)
    if (!error) onDeleted(table.id)
  }

  function download() {
    const canvas = wrapperRef.current?.querySelector('canvas')
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `qr-masa-${table.label.replace(/\s+/g, '-').toLowerCase()}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div ref={wrapperRef} className="shrink-0 rounded-lg bg-white p-1.5">
          <QRCodeCanvas value={url} size={64} level="M" includeMargin />
        </div>
        <div>
          <p className="font-semibold text-ink">{table.label}</p>
          <p className={`text-xs ${table.is_active ? 'text-ink-soft' : 'text-coral-deep'}`}>
            {table.is_active ? 'Aktif' : 'Pasif'}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={download} disabled={busy} className="text-xs">
          QR indir
        </Button>
        <Button variant="secondary" onClick={toggleActive} disabled={busy} className="text-xs">
          {table.is_active ? 'Pasif yap' : 'Aktif yap'}
        </Button>
        <Button variant="danger" onClick={remove} disabled={busy} className="text-xs">
          Sil
        </Button>
      </div>
    </div>
  )
}

export default function TablesAndCalls() {
  const { cafe, refreshCafe } = useAuth()
  const [tables, setTables] = useState<Table[]>([])
  const [calls, setCalls] = useState<CallWithLabel[]>([])
  const [newLabel, setNewLabel] = useState('')
  const [addBusy, setAddBusy] = useState(false)
  const [toggleBusy, setToggleBusy] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const tablesRef = useRef<Table[]>([])
  tablesRef.current = tables

  useEffect(() => {
    if (!cafe) return
    let cancelled = false

    async function load() {
      const [tablesRes, callsRes] = await Promise.all([
        supabase.from('tables').select('*').eq('cafe_id', cafe!.id).order('created_at'),
        supabase
          .from('waiter_calls')
          .select('*, tables(label)')
          .eq('cafe_id', cafe!.id)
          .order('created_at', { ascending: false })
          .limit(50),
      ])
      if (cancelled) return
      setTables((tablesRes.data ?? []) as Table[])
      setCalls(
        ((callsRes.data ?? []) as (WaiterCall & { tables: { label: string } | null })[]).map((c) => ({
          ...c,
          tableLabel: c.tables?.label ?? 'Bilinmeyen masa',
        })),
      )
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
      .channel(`panel_waiter_calls_${cafe.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'waiter_calls', filter: `cafe_id=eq.${cafe.id}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as WaiterCall
            const label = tablesRef.current.find((t) => t.id === row.table_id)?.label ?? 'Bilinmeyen masa'
            setCalls((prev) => [{ ...row, tableLabel: label }, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new as WaiterCall
            setCalls((prev) => prev.map((c) => (c.id === row.id ? { ...c, ...row } : c)))
          }
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [cafe])

  // Sayfayla ilk dokunma/tuş basımında ses kilidini önceden açar — böylece
  // müşteri gerçekten çağrı gönderdiğinde tarayıcı otomatik oynatmayı
  // engellemeden ses hemen çalabilir.
  useEffect(() => {
    function unlock() {
      getAudioContext()
    }
    document.addEventListener('pointerdown', unlock, { once: true })
    document.addEventListener('keydown', unlock, { once: true })
    return () => {
      document.removeEventListener('pointerdown', unlock)
      document.removeEventListener('keydown', unlock)
    }
  }, [])

  // Bekleyen ("pending") en az bir çağrı olduğu sürece birkaç saniyede bir
  // tekrar çalar — kalabalık bir kafede personel ekrana sürekli bakmayabilir,
  // tek seferlik bir bip kolayca kaçırılabilir. "Geldim" ile onaylanınca durur.
  const hasPendingCall = calls.some((c) => c.status === 'pending')
  useEffect(() => {
    if (!hasPendingCall) return
    beep()
    const interval = window.setInterval(beep, 5000)
    return () => window.clearInterval(interval)
  }, [hasPendingCall])

  if (!cafe) return null

  async function toggleWaiterCall(enabled: boolean) {
    setToggleBusy(true)
    const { error } = await supabase.from('cafes').update({ waiter_call_enabled: enabled }).eq('id', cafe!.id)
    setToggleBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    await refreshCafe()
  }

  async function addTable(e: FormEvent) {
    e.preventDefault()
    if (!newLabel.trim()) return
    setError('')
    setAddBusy(true)
    const { data, error } = await supabase
      .from('tables')
      .insert({ cafe_id: cafe!.id, label: newLabel.trim() })
      .select('*')
      .single()
    setAddBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    setTables((prev) => [...prev, data as Table])
    setNewLabel('')
  }

  async function updateCallStatus(call: CallWithLabel, status: WaiterCallStatus) {
    const patch =
      status === 'acknowledged' ? { status, acknowledged_at: new Date().toISOString() } : { status, resolved_at: new Date().toISOString() }
    const { error } = await supabase.from('waiter_calls').update(patch).eq('id', call.id)
    if (!error) {
      setCalls((prev) => prev.map((c) => (c.id === call.id ? { ...c, ...patch } : c)))
    }
  }

  const activeCalls = calls.filter((c) => c.status !== 'resolved')

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-xl font-bold">Masalar</h1>

      {IS_LOCAL_URL && (
        <Card className="mb-4 border-coral bg-coral-soft">
          <p className="text-sm leading-relaxed text-coral-deep">
            Masa QR'ları şu an geliştirme adresinde (localhost) üretiliyor, telefonda çalışmaz.
            Yayına aldıktan sonra <code>VITE_PUBLIC_SITE_URL</code> ayarlanmalı.
          </p>
        </Card>
      )}

      <Card className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-ink">Garson Çağırma</h2>
            <p className="mt-1 text-sm text-ink-soft">
              Açarsanız masa QR'ını okutan müşteriler menüden tek dokunuşla garson çağırabilir.
              Çağrılar aşağıda anlık görünür.
            </p>
          </div>
          <label className={`relative inline-flex min-h-11 min-w-11 shrink-0 touch-manipulation items-center ${toggleBusy ? 'opacity-60' : ''}`}>
            <input
              type="checkbox"
              checked={cafe.waiter_call_enabled}
              onChange={(e) => toggleWaiterCall(e.target.checked)}
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
        <h2 className="mb-3 font-semibold text-ink">Gelen Çağrılar</h2>
        {activeCalls.length === 0 ? (
          <p className="text-sm text-ink-soft">Bekleyen çağrı yok.</p>
        ) : (
          <ul className="space-y-2">
            {activeCalls.map((call) => (
              <li
                key={call.id}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 ${
                  call.status === 'pending' ? 'border-coral bg-coral-soft' : 'border-teal bg-teal-soft'
                }`}
              >
                <div>
                  <p className={`font-semibold ${call.status === 'pending' ? 'text-coral-deep' : 'text-teal-deep'}`}>
                    {call.tableLabel}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {new Date(call.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    {' — '}
                    {call.status === 'pending' ? 'Bekliyor' : 'Personel gidiyor'}
                  </p>
                </div>
                <div className="flex gap-2">
                  {call.status === 'pending' && (
                    <Button variant="secondary" className="text-xs" onClick={() => updateCallStatus(call, 'acknowledged')}>
                      Geldim
                    </Button>
                  )}
                  <Button variant="primary" className="text-xs" onClick={() => updateCallStatus(call, 'resolved')}>
                    Tamamlandı
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold text-ink">Masalar</h2>
        <form onSubmit={addTable} className="mb-4 flex flex-col gap-2 sm:flex-row">
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Örn: Masa 5"
            className="sm:max-w-xs"
          />
          <Button type="submit" disabled={addBusy || !newLabel.trim()}>
            {addBusy ? 'Ekleniyor…' : '+ Masa Ekle'}
          </Button>
        </form>

        {loading ? (
          <p className="text-sm text-ink-soft">Yükleniyor…</p>
        ) : tables.length === 0 ? (
          <p className="text-sm text-ink-soft">Henüz masa eklenmedi.</p>
        ) : (
          <div className="space-y-2">
            {tables.map((t) => (
              <TableRow
                key={t.id}
                table={t}
                onDeleted={(id) => setTables((prev) => prev.filter((x) => x.id !== id))}
                onToggled={(id, is_active) =>
                  setTables((prev) => prev.map((x) => (x.id === id ? { ...x, is_active } : x)))
                }
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
