import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Spinner } from '../../components/ui'

const SESSION_HOURS = 1

// QR koda basılan kalıcı masa kimliğinin tek görevi budur: geçerli (süresi
// dolmamış) bir geçici oturum bulmak/oluşturmak ve tarayıcıyı, geçmişte ayrı
// bir kayıt bırakmadan (replace: true), o oturumu taşıyan asıl menü adresine
// yönlendirmek. Kalıcı id adres çubuğunda hiç görünmez — bookmark/geçmişte
// kalan tek şey saatlik geçici oturumdur, süresi dolunca sessizce işe yaramaz.
export default function TableRedirect() {
  const { tableId } = useParams()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    if (!tableId) return
    let cancelled = false

    async function run() {
      const { data: table } = await supabase
        .from('tables')
        .select('id, cafe_id, is_active, cafes(slug)')
        .eq('id', tableId)
        .maybeSingle()
      if (cancelled) return
      const cafe = (table?.cafes ?? null) as { slug: string } | null
      if (!table || !table.is_active || !cafe) {
        setError('Masa bulunamadı. QR kodu yeniden okutmayı deneyin.')
        return
      }

      const nowIso = new Date().toISOString()
      const { data: existing } = await supabase
        .from('table_sessions')
        .select('id')
        .eq('table_id', table.id)
        .gt('expires_at', nowIso)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (cancelled) return

      let sessionId = existing?.id as string | undefined
      if (!sessionId) {
        const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString()
        const { data: created, error: insertErr } = await supabase
          .from('table_sessions')
          .insert({ table_id: table.id, cafe_id: table.cafe_id, expires_at: expiresAt })
          .select('id')
          .single()
        if (cancelled) return
        if (insertErr || !created) {
          setError('Bir şeyler ters gitti. QR kodu yeniden okutmayı deneyin.')
          return
        }
        sessionId = created.id
      }

      navigate(`/menu/${cafe.slug}?masa=${sessionId}&view=menu`, { replace: true })
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [tableId, navigate])

  if (error) {
    return (
      <div className="mx-auto mt-24 max-w-sm px-4 text-center">
        <p className="font-display text-2xl font-bold text-cobalt">Menü bulunamadı</p>
        <p className="mt-2 text-sm text-ink-soft">{error}</p>
      </div>
    )
  }

  return <Spinner label="Yönlendiriliyor…" />
}
