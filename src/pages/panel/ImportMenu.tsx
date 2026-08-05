import { useCallback, useEffect, useState } from 'react'
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

// Kategori/ürün adlarını karşılaştırırken kullanılır (Türkçe büyük/küçük harf
// kurallarına uygun, baştaki/sondaki boşluklardan bağımsız eşleştirme için).
function normalizeName(s: string) {
  return s.trim().toLocaleLowerCase('tr')
}

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
  const [note, setNote] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeStep, setAnalyzeStep] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveStep, setSaveStep] = useState('')
  const [done, setDone] = useState(false)
  // Uzun bir kategori tek fotoğrafa sığmayıp devam fotoğrafıyla yüklendiğinde,
  // kategori başlığı o karede görünmeyebilir — kullanıcı burada hangi kategorinin
  // devamı olduğunu seçip AI'ye kesin talimat olarak geçirebilir.
  const [existingCategoryNames, setExistingCategoryNames] = useState<string[]>([])
  const [continuationCategory, setContinuationCategory] = useState('')

  const loadCategoryNames = useCallback(async () => {
    if (!cafe) return
    const { data } = await supabase
      .from('categories')
      .select('name')
      .eq('cafe_id', cafe.id)
      .order('name')
    setExistingCategoryNames((data ?? []).map((c) => c.name))
  }, [cafe])

  useEffect(() => {
    void loadCategoryNames()
  }, [loadCategoryNames])

  async function onFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || !cafe) return
    const files = Array.from(fileList)
    for (const file of files) {
      if (!ACCEPTED.includes(file.type)) {
        setError('Lütfen JPEG, PNG veya WebP formatında menü fotoğrafları yükleyin.')
        return
      }
    }
    setError('')
    setNote('')
    setDone(false)
    setAnalyzing(true)
    try {
      // Mevcut menüdeki ürünlerle (ve bu partideki diğer fotoğraflarla) çakışanları
      // elemek için tek bir "görülenler" kümesi tüm fotoğraflar boyunca paylaşılır.
      const { data: existingItems } = await supabase
        .from('menu_items')
        .select('name, categories(name)')
        .eq('cafe_id', cafe.id)
      const seen = new Set(
        (existingItems ?? []).map((it) => {
          const catName = (it.categories as unknown as { name: string } | null)?.name ?? ''
          return `${normalizeName(catName)}::${normalizeName(it.name)}`
        }),
      )

      // Farklı fotoğraflardan çıkan aynı isimli kategoriler tek bir kategoriye
      // birleştirilir (ör. 2. fotoğraf da "Gözleme Çeşitleri" başlığıyla devam ediyorsa).
      const merged: ImportedCategory[] = []
      const catIdxByName = new Map<string, number>()
      let skipped = 0
      let failed = 0

      for (const [i, file] of files.entries()) {
        setAnalyzeStep(
          files.length > 1 ? `Fotoğraf ${i + 1}/${files.length} analiz ediliyor…` : 'Fotoğraf analiz ediliyor…',
        )
        try {
          const b64 = await fileToBase64(file)
          const categories = await importMenuFromImage(b64, file.type, continuationCategory || undefined)
          for (const cat of categories) {
            const normCat = normalizeName(cat.name)
            let ci = catIdxByName.get(normCat)
            if (ci === undefined) {
              merged.push({ name: cat.name, items: [] })
              ci = merged.length - 1
              catIdxByName.set(normCat, ci)
            }
            for (const item of cat.items) {
              const key = `${normCat}::${normalizeName(item.name)}`
              if (seen.has(key)) {
                skipped++
                continue
              }
              seen.add(key)
              merged[ci].items.push(item)
            }
          }
        } catch {
          failed++
        }
      }

      const finalCategories = merged.filter((c) => c.items.length > 0)
      if (!finalCategories.length) {
        setError(
          skipped > 0
            ? `Fotoğraflardaki ${skipped} ürünün tamamı menünüzde zaten kayıtlı — eklenecek yeni ürün kalmadı.`
            : failed > 0
              ? 'Fotoğraflar analiz edilemedi. Daha net fotoğraflar deneyin.'
              : 'Fotoğraflarda menü içeriği bulunamadı. Daha net fotoğraflar deneyin.',
        )
        return
      }
      setPreview(finalCategories)
      const notes: string[] = []
      if (skipped > 0) {
        notes.push(`${skipped} ürün menünüzde zaten kayıtlı olduğu için otomatik çıkarıldı.`)
      }
      if (failed > 0) {
        notes.push(`${failed} fotoğraf analiz edilemedi (kota sınırı olabilir), diğerleri işlendi.`)
      }
      if (notes.length) setNote(notes.join(' '))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'İçe aktarma başarısız oldu.')
    } finally {
      setAnalyzing(false)
      setAnalyzeStep('')
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
          // Ürün adı tek başına belirsiz olabilir (ör. "Kaşarlı"); kategori adı
          // (ör. "Gözleme") AI'nin doğru yemeği anlaması için gönderilir.
          category: cat.name,
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

      // 2) Kategorileri ve ürünleri kaydet. Aynı isimli bir kategori zaten
      //    varsa (ör. önceki fotoğraftan) yeniden oluşturmak yerine ona eklenir.
      setSaveStep('Menü kaydediliyor…')
      const { data: existingCats } = await supabase
        .from('categories')
        .select('id, name')
        .eq('cafe_id', cafe.id)
      const catIdByName = new Map<string, string>(
        (existingCats ?? []).map((c) => [normalizeName(c.name), c.id]),
      )
      let sortBase = existingCats?.length ?? 0

      // Mevcut kategoriye ürün eklerken sort_order'ın oradaki ürünlerin üzerine
      // devam etmesi için (baştan başlayıp mevcutların üzerine yazmaması için).
      const { data: existingItemCounts } = await supabase
        .from('menu_items')
        .select('category_id')
        .eq('cafe_id', cafe.id)
      const itemCountByCategory = new Map<string, number>()
      for (const it of existingItemCounts ?? []) {
        itemCountByCategory.set(it.category_id, (itemCountByCategory.get(it.category_id) ?? 0) + 1)
      }

      for (const [ci, cat] of preview.entries()) {
        const normCatName = normalizeName(cat.name)
        let categoryId = catIdByName.get(normCatName)
        if (!categoryId) {
          const { data: catRow, error: catErr } = await supabase
            .from('categories')
            .insert({ cafe_id: cafe.id, name: cat.name, sort_order: sortBase++ })
            .select('id')
            .single()
          if (catErr) throw new Error(catErr.message)
          categoryId = catRow.id as string
          catIdByName.set(normCatName, categoryId)
        }
        // let + kapanış (closure) içinde TS daralmayı koruyamadığından sabit bir
        // string kopyaya alınır (categoryId burada artık kesin tanımlı).
        const catId: string = categoryId
        let itemSort = itemCountByCategory.get(catId) ?? 0

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
            category_id: catId,
            name: item.name,
            description: item.description ?? r?.description ?? null,
            price: item.price ?? 0,
            kcal: r?.kcal_estimate ?? null,
            allergens: r?.allergens ?? [],
            contains_alcohol: r?.contains_alcohol ?? false,
            contains_pork: r?.contains_pork ?? false,
            ai_suggested: suggestion,
            sort_order: itemSort++,
          }
        })
        if (rows.length) {
          const { error: itemErr } = await supabase.from('menu_items').insert(rows)
          if (itemErr) throw new Error(itemErr.message)
        }
        itemCountByCategory.set(catId, itemSort)
      }
      setPreview(null)
      setNote('')
      setContinuationCategory('')
      await loadCategoryNames()
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
        Mevcut basılı menünüzün fotoğraf(lar)ını yükleyin; yapay zeka kategorileri, ürünleri ve
        fiyatları çıkarır. Kaydederken her ürünün <strong>alerjen, kalori, alkol/domuz beyanları
        ve eksik açıklamaları da otomatik doldurulur</strong>. Bunlar AI önerisidir — kaydedilen
        ürünler panelde "kontrol edin" rozetiyle işaretlenir, düzenleyip kaydettiğinizde
        onaylanmış sayılır. Menü tek fotoğrafa sığmıyorsa <strong>birden fazla fotoğrafı aynı
        anda seçebilirsiniz</strong> — hepsi tek önizlemede birleşir, aralarındaki (ve mevcut
        menünüzle) çakışan ürünler otomatik elenir.
      </p>

      <Card>
        {existingCategoryNames.length > 0 && (
          <div className="mb-3">
            <label htmlFor="continuation-category" className="mb-1 block text-sm font-medium text-ink">
              Bu fotoğraf bir kategorinin devamı mı?
            </label>
            <select
              id="continuation-category"
              value={continuationCategory}
              onChange={(e) => setContinuationCategory(e.target.value)}
              className="min-h-11 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-cobalt focus:ring-2 focus:ring-cobalt-soft"
            >
              <option value="">— Hayır, yeni kategori(ler) var —</option>
              {existingCategoryNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-ink-soft">
              Uzun bir kategori tek fotoğrafa sığmayıp başlığı önceki karede kaldıysa seçin —
              böylece AI yeni bir kategori uydurmak yerine bu ürünleri seçtiğiniz kategoriye ekler.
              Birden fazla fotoğraf seçtiyseniz bu seçim hepsine uygulanır.
            </p>
          </div>
        )}
        <label className="inline-flex min-h-11 w-full touch-manipulation cursor-pointer items-center justify-center rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:border-cobalt active:bg-cobalt-soft sm:w-auto">
          Menü fotoğraf(lar)ı seç
          <input
            type="file"
            accept={ACCEPTED.join(',')}
            multiple
            onChange={(e) => onFiles(e.target.files)}
            disabled={analyzing}
            className="sr-only"
          />
        </label>
        {analyzing && <Spinner label={analyzeStep || 'Fotoğraf(lar) analiz ediliyor… (15-30 sn/fotoğraf sürebilir)'} />}
      </Card>

      <ErrorText>{error}</ErrorText>
      {note && (
        <Card className="mt-4 border-line bg-cobalt-soft">
          <p className="text-sm text-cobalt-deep">{note}</p>
        </Card>
      )}
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
