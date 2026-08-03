import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import {
  analyzeBatch,
  importMenuFromImage,
  type BatchAnalyzeInput,
  type ImportedCategory,
} from '../../lib/ai'
import type { AiSuggestion } from '../../lib/types'
import { Button, Card, ErrorText, Spinner } from '../../components/ui'

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      resolve(dataUrl.split(',')[1])
    }
    reader.onerror = () => reject(new Error('Dosya okunamadı.'))
    reader.readAsDataURL(file)
  })
}

export default function ImportMenu() {
  const { cafe } = useAuth()
  const [preview, setPreview] = useState<ImportedCategory[] | null>(null)
  const [error, setError] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveStep, setSaveStep] = useState('')
  const [done, setDone] = useState(false)

  async function onFile(file: File | undefined) {
    if (!file) return
    if (!ACCEPTED.includes(file.type)) {
      setError('Lütfen JPEG, PNG veya WebP formatında bir menü fotoğrafı yükleyin.')
      return
    }
    setError('')
    setDone(false)
    setAnalyzing(true)
    try {
      const b64 = await fileToBase64(file)
      const categories = await importMenuFromImage(b64, file.type)
      if (!categories.length) {
        setError('Fotoğrafta menü içeriği bulunamadı. Daha net bir fotoğraf deneyin.')
      } else {
        setPreview(categories)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'İçe aktarma başarısız oldu.')
    } finally {
      setAnalyzing(false)
    }
  }

  function updateItem(catIdx: number, itemIdx: number, field: 'name' | 'price', value: string) {
    if (!preview) return
    const next = structuredClone(preview)
    if (field === 'name') next[catIdx].items[itemIdx].name = value
    else next[catIdx].items[itemIdx].price = value ? Number(value.replace(',', '.')) : null
    setPreview(next)
  }

  function removeItem(catIdx: number, itemIdx: number) {
    if (!preview) return
    const next = structuredClone(preview)
    next[catIdx].items.splice(itemIdx, 1)
    setPreview(next.filter((c) => c.items.length > 0))
  }

  async function saveAll() {
    if (!preview || !cafe) return
    setError('')
    setSaving(true)
    try {
      // 1) Tüm ürünlerin beyanlarını (alerjen, kcal, alkol, domuz) ve eksik
      //    açıklamalarını toplu üret. Başarısız olursa içe aktarma yine sürer.
      setSaveStep('Alerjen ve kalori beyanları oluşturuluyor… (30-60 sn sürebilir)')
      const inputs: BatchAnalyzeInput[] = preview.flatMap((cat, ci) =>
        cat.items.map((item, ii) => ({
          id: `${ci}-${ii}`,
          name: item.name,
          description: item.description,
        })),
      )
      let analysis: Awaited<ReturnType<typeof analyzeBatch>> | null = null
      let analysisFailed = false
      try {
        analysis = await analyzeBatch(inputs, (done, total) =>
          setSaveStep(`Alerjen ve kalori beyanları oluşturuluyor… (${done}/${total} ürün)`),
        )
      } catch {
        analysisFailed = true
      }

      // 2) Kategorileri ve ürünleri kaydet
      setSaveStep('Menü kaydediliyor…')
      const { data: existing } = await supabase
        .from('categories')
        .select('id')
        .eq('cafe_id', cafe.id)
      let sortBase = existing?.length ?? 0

      for (const [ci, cat] of preview.entries()) {
        const { data: catRow, error: catErr } = await supabase
          .from('categories')
          .insert({ cafe_id: cafe.id, name: cat.name, sort_order: sortBase++ })
          .select('id')
          .single()
        if (catErr) throw new Error(catErr.message)

        const rows = cat.items.map((item, ii) => {
          const r = analysis?.get(`${ci}-${ii}`)
          const suggestion: AiSuggestion | null = r
            ? {
                kcal_estimate: r.kcal_estimate,
                kcal_min: r.kcal_min,
                kcal_max: r.kcal_max,
                allergens: r.allergens,
                contains_alcohol: r.contains_alcohol,
                contains_pork: r.contains_pork,
                confidence: r.confidence,
                notes: r.notes,
                suggested_at: new Date().toISOString(),
                approved: false, // işletmeci panelden kontrol edip kaydedince onaylanır
              }
            : null
          return {
            cafe_id: cafe.id,
            category_id: catRow.id,
            name: item.name,
            description: item.description ?? r?.description ?? null,
            price: item.price ?? 0,
            kcal: r?.kcal_estimate ?? null,
            allergens: r?.allergens ?? [],
            contains_alcohol: r?.contains_alcohol ?? false,
            contains_pork: r?.contains_pork ?? false,
            ai_suggested: suggestion,
            sort_order: ii,
          }
        })
        if (rows.length) {
          const { error: itemErr } = await supabase.from('menu_items').insert(rows)
          if (itemErr) throw new Error(itemErr.message)
        }
      }
      setPreview(null)
      setDone(true)
      if (analysisFailed) {
        setError(
          'Ürünler kaydedildi ancak AI beyan doldurma başarısız oldu (muhtemelen kota sınırı). ' +
            'Menü Yönetimi sayfasından ürünleri tek tek "AI ile Doldur" ile tamamlayabilirsiniz.',
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kaydetme başarısız oldu.')
    } finally {
      setSaving(false)
      setSaveStep('')
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-2 text-xl font-bold">AI ile Menü İçe Aktarma</h1>
      <p className="mb-4 text-sm text-ink-soft">
        Mevcut basılı menünüzün fotoğrafını yükleyin; yapay zeka kategorileri, ürünleri ve
        fiyatları çıkarır. Kaydederken her ürünün <strong>alerjen, kalori, alkol/domuz beyanları
        ve eksik açıklamaları da otomatik doldurulur</strong>. Bunlar AI önerisidir — kaydedilen
        ürünler panelde "kontrol edin" rozetiyle işaretlenir, düzenleyip kaydettiğinizde
        onaylanmış sayılır.
      </p>

      <Card>
        <label className="inline-flex min-h-11 w-full touch-manipulation cursor-pointer items-center justify-center rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:border-cobalt active:bg-cobalt-soft sm:w-auto">
          Menü fotoğrafı seç
          <input
            type="file"
            accept={ACCEPTED.join(',')}
            onChange={(e) => onFile(e.target.files?.[0])}
            disabled={analyzing}
            className="sr-only"
          />
        </label>
        {analyzing && <Spinner label="Fotoğraf analiz ediliyor… (15-30 sn sürebilir)" />}
      </Card>

      <ErrorText>{error}</ErrorText>
      {done && (
        <Card className="mt-4 border-teal bg-teal-soft">
          <p className="text-sm text-teal-deep">
            Menü içe aktarıldı! <a href="/panel/menu" className="font-medium underline">Menü Yönetimi</a>{' '}
            sayfasından alerjen ve kalori bilgilerini tamamlayabilirsiniz.
          </p>
        </Card>
      )}

      {preview && (
        <div className="mt-4 space-y-4">
          {preview.map((cat, ci) => (
            <Card key={ci}>
              <h2 className="mb-2 font-semibold">{cat.name}</h2>
              <ul className="space-y-1">
                {cat.items.map((item, ii) => (
                  <li key={ii} className="flex items-center gap-1.5">
                    <input
                      value={item.name}
                      onChange={(e) => updateItem(ci, ii, 'name', e.target.value)}
                      aria-label="Ürün adı"
                      className="min-h-10 min-w-0 flex-1 rounded border border-line px-2 py-1 text-sm"
                    />
                    <input
                      value={item.price ?? ''}
                      onChange={(e) => updateItem(ci, ii, 'price', e.target.value)}
                      placeholder="₺"
                      aria-label="Fiyat"
                      inputMode="decimal"
                      className="min-h-10 w-16 shrink-0 rounded border border-line px-2 py-1 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(ci, ii)}
                      className="flex min-h-10 min-w-10 shrink-0 touch-manipulation items-center justify-center rounded text-ink-soft hover:bg-coral-soft hover:text-coral-deep active:bg-coral-soft"
                      aria-label={`${item.name} satırını kaldır`}
                      title="Kaldır"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
          <Button onClick={saveAll} disabled={saving} className="w-full">
            {saving
              ? saveStep || 'Kaydediliyor…'
              : `${preview.reduce((n, c) => n + c.items.length, 0)} ürünü beyanlarıyla birlikte menüye ekle`}
          </Button>
        </div>
      )}
    </div>
  )
}
