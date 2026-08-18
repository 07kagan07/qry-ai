import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'
import type { AllergenKey } from '../lib/allergens'
import { CURRENCY_SYMBOLS } from '../lib/currency'
import type { AiSuggestion, MenuItem } from '../lib/types'
import { analyzeItem, generateImagePrompt, generateItemImage } from '../lib/ai'
import { uploadGeneratedImage, uploadItemImage } from '../lib/storage'
import AllergenPicker from './AllergenPicker'
import { Button, ErrorText, Input, Label, Textarea } from './ui'

export interface ItemDraft {
  name: string
  description: string
  price: string
  kcal: string
  allergens: AllergenKey[]
  contains_alcohol: boolean
  contains_pork: boolean
  ai_suggested: AiSuggestion | null
  image_url: string | null
}

interface Props {
  title: string
  initial?: MenuItem
  /** Ürünün ait olduğu kategori adı (ör. "Gözleme") — ürün adı tek başına belirsizse
   * (ör. "Kaşarlı") AI'nin doğru yemeği anlaması için analiz/açıklama/görsel isteklerine eklenir. */
  categoryName?: string
  onSave: (draft: ItemDraft) => Promise<void>
  onClose: () => void
}

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const SAVED_MESSAGE_MS = 1600

type SaveState = 'idle' | 'saving' | 'saved'

export default function ItemFormModal({ title, initial, categoryName, onSave, onClose }: Props) {
  const { cafe } = useAuth()
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [ingredients, setIngredients] = useState('')
  const [price, setPrice] = useState(initial ? String(initial.price) : '')
  const [kcal, setKcal] = useState(initial?.kcal != null ? String(initial.kcal) : '')
  const [allergens, setAllergens] = useState<AllergenKey[]>(initial?.allergens ?? [])
  const [containsAlcohol, setContainsAlcohol] = useState(initial?.contains_alcohol ?? false)
  const [containsPork, setContainsPork] = useState(initial?.contains_pork ?? false)
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(initial?.ai_suggested ?? null)
  const [aiNote, setAiNote] = useState('')
  const [error, setError] = useState('')
  const [aiBusy, setAiBusy] = useState(false)

  // Görsel durumu
  const [imageUrl, setImageUrl] = useState<string | null>(initial?.image_url ?? null)
  const [imagePreview, setImagePreview] = useState<{ base64: string; mimeType: string } | null>(null)
  const [imgBusy, setImgBusy] = useState<'idle' | 'prompting' | 'generating' | 'uploading'>('idle')
  const [imgError, setImgError] = useState('')

  // Kaydet çubuğu: yalnızca kaydedilmemiş bir değişiklik varken (ya da az önce
  // kaydedildi mesajı gösterilirken) görünür.
  const [dirty, setDirty] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const isFirstRender = useRef(true)
  const savedTimeoutRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    setDirty(true)
    setSaveState('idle')
    window.clearTimeout(savedTimeoutRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, description, price, kcal, allergens, containsAlcohol, containsPork, imageUrl])

  useEffect(() => () => window.clearTimeout(savedTimeoutRef.current), [])

  async function runAiAnalyze() {
    if (!name.trim()) {
      setError('Önce ürün adını girin.')
      return
    }
    setError('')
    setAiBusy(true)
    try {
      const r = await analyzeItem(
        name,
        description || undefined,
        ingredients || undefined,
        categoryName,
      )
      setKcal(String(r.kcal_estimate))
      setAllergens(r.allergens)
      setContainsAlcohol(r.contains_alcohol)
      setContainsPork(r.contains_pork)
      // Açıklama zaten doluysa AI üzerine yazmaz (r.description null döner) — kullanıcının
      // elle yazdığı metin korunur.
      if (!description.trim() && r.description) {
        setDescription(r.description)
      }
      const suggestion: AiSuggestion = {
        kcal_estimate: r.kcal_estimate,
        kcal_min: r.kcal_min,
        kcal_max: r.kcal_max,
        allergens: r.allergens,
        contains_alcohol: r.contains_alcohol,
        contains_pork: r.contains_pork,
        confidence: r.confidence,
        notes: r.notes,
        suggested_at: new Date().toISOString(),
        approved: false,
      }
      setAiSuggestion(suggestion)
      const conf = { low: 'düşük', medium: 'orta', high: 'yüksek' }[r.confidence]
      setAiNote(
        `AI önerisi (güven: ${conf}): ${r.kcal_min}–${r.kcal_max} kcal aralığı tahmin edildi. ${r.notes} ` +
          'Bu bir tahmindir — kaydetmeden önce kontrol edin; kaydettiğinizde beyanı onaylamış sayılırsınız.',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI analizi başarısız oldu.')
    } finally {
      setAiBusy(false)
    }
  }

  // Prompt üretimi ve görsel üretimi arka arkaya, kullanıcıya prompt hiç
  // gösterilmeden çalışır — işletmeci sadece sonucu görür.
  async function runGenerateImage() {
    if (!name.trim()) {
      setImgError('Önce ürün adını girin.')
      return
    }
    setImgError('')
    try {
      setImgBusy('prompting')
      const p = await generateImagePrompt({
        name,
        description: description || undefined,
        ingredients: ingredients || undefined,
        category: categoryName,
      })
      setImgBusy('generating')
      const r = await generateItemImage(p.prompt)
      setImagePreview({ base64: r.image, mimeType: r.mime_type })
    } catch (err) {
      setImgError(err instanceof Error ? err.message : 'Görsel üretilemedi.')
    } finally {
      setImgBusy('idle')
    }
  }

  async function useGeneratedImage() {
    if (!imagePreview || !cafe) return
    setImgError('')
    setImgBusy('uploading')
    try {
      const url = await uploadGeneratedImage(cafe.id, imagePreview.base64, imagePreview.mimeType)
      setImageUrl(url)
      setImagePreview(null)
      // "Kaydet" demek burada gerçekten kaydetmeli — ürünü hemen kaydediyoruz,
      // kullanıcı ayrıca alttaki çubuğa basmak zorunda kalmasın.
      await saveDraft(url)
    } catch (err) {
      setImgError(err instanceof Error ? err.message : 'Görsel kaydedilemedi.')
    } finally {
      setImgBusy('idle')
    }
  }

  async function onFileSelected(file: File | undefined) {
    if (!file || !cafe) return
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setImgError('Lütfen JPEG, PNG veya WebP formatında bir görsel seçin.')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImgError('Görsel en fazla 5 MB olabilir.')
      return
    }
    setImgError('')
    setImgBusy('uploading')
    try {
      setImageUrl(await uploadItemImage(cafe.id, file))
    } catch (err) {
      setImgError(err instanceof Error ? err.message : 'Yükleme başarısız oldu.')
    } finally {
      setImgBusy('idle')
    }
  }

  // Ürünü kaydeden tek yer. imageOverride, henüz state'e yansımamış olabilecek
  // (setState asenkron) taze yüklenen görsel URL'ini kullanmak için opsiyoneldir.
  // Var olan bir ürün düzenlenirken modal açık kalır ve kısa bir "Kaydedildi"
  // onayı gösterilip kaybolur; yeni ürün oluştururken modal kapanır (henüz bir
  // kaydı olmadığı için tekrar kaydetmek yeni bir satır oluşturur).
  async function saveDraft(imageOverride?: string | null) {
    setError('')
    const priceNum = Number(price.replace(',', '.'))
    if (Number.isNaN(priceNum) || priceNum < 0) {
      setError('Geçerli bir fiyat girin.')
      return
    }
    setSaveState('saving')
    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        price: price.replace(',', '.'),
        kcal,
        allergens,
        contains_alcohol: containsAlcohol,
        contains_pork: containsPork,
        // Kaydetme = işletmeci onayı
        ai_suggested: aiSuggestion ? { ...aiSuggestion, approved: true } : null,
        image_url: imageOverride !== undefined ? imageOverride : imageUrl,
      })
      if (!initial) {
        onClose()
        return
      }
      setDirty(false)
      setSaveState('saved')
      window.clearTimeout(savedTimeoutRef.current)
      savedTimeoutRef.current = window.setTimeout(() => setSaveState('idle'), SAVED_MESSAGE_MS)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kaydedilemedi.')
      setSaveState('idle')
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    await saveDraft()
  }

  const imgLoading = imgBusy !== 'idle'
  const showSaveBar = dirty || saveState !== 'idle'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4"
      style={{ overscrollBehavior: 'contain' }}
    >
      <div className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-line p-4 sm:p-5">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-lg text-ink-soft hover:bg-porcelain hover:text-ink active:bg-porcelain"
          >
            ✕
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
            <div>
              <Label>Ürün Adı *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Örn: Fıstıklı Baklava" />
            </div>
            <div>
              <Label>Açıklama</Label>
              <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
              <p className="mt-1 text-xs text-ink-soft">
                Boş bırakırsanız aşağıdaki "AI ile Doldur" bunu da otomatik üretir.
              </p>
            </div>
            <div>
              <Label>Malzemeler (AI analizinin isabetini artırır, menüde gösterilmez)</Label>
              <Input
                value={ingredients}
                onChange={(e) => setIngredients(e.target.value)}
                placeholder="Örn: antep fıstığı, yufka, tereyağı, şerbet"
              />
            </div>

            {/* Görsel */}
            <div>
              <Label>Görsel</Label>
              {imageUrl ? (
                <div className="flex items-center gap-3">
                  <img
                    src={imageUrl}
                    alt=""
                    className="h-24 w-24 rounded-lg border border-line object-cover"
                  />
                  <Button type="button" variant="secondary" onClick={() => setImageUrl(null)}>
                    Görseli kaldır
                  </Button>
                </div>
              ) : imagePreview ? (
                <div className="space-y-2">
                  <img
                    src={`data:${imagePreview.mimeType};base64,${imagePreview.base64}`}
                    alt="AI tarafından üretilen ürün görseli önizlemesi"
                    className="h-40 w-40 rounded-lg border border-line object-cover"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={useGeneratedImage} disabled={imgLoading}>
                      {imgBusy === 'uploading' ? 'Kaydediliyor…' : 'Kaydet'}
                    </Button>
                    <Button type="button" variant="secondary" onClick={runGenerateImage} disabled={imgLoading}>
                      {imgBusy !== 'idle' ? 'Oluşturuluyor…' : 'Yeniden oluştur'}
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setImagePreview(null)} disabled={imgLoading}>
                      Vazgeç
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 rounded-lg border border-line bg-porcelain p-3">
                  <label className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:border-cobalt">
                    Kendi görselinizi yükleyin
                    <input
                      type="file"
                      accept={ACCEPTED_IMAGE_TYPES.join(',')}
                      className="sr-only"
                      onChange={(e) => onFileSelected(e.target.files?.[0])}
                      disabled={imgLoading}
                    />
                  </label>

                  <div className="border-t border-line pt-3">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={runGenerateImage}
                      disabled={imgLoading || !name.trim()}
                    >
                      {imgBusy === 'prompting'
                        ? 'Hazırlanıyor…'
                        : imgBusy === 'generating'
                          ? 'Görsel oluşturuluyor…'
                          : '✨ AI ile görsel oluştur'}
                    </Button>
                  </div>
                  <ErrorText>{imgError}</ErrorText>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Fiyat ({CURRENCY_SYMBOLS[cafe?.currency ?? 'TRY']}) *</Label>
                <Input value={price} onChange={(e) => setPrice(e.target.value)} required inputMode="decimal" />
              </div>
              <div>
                <Label>Enerji (kcal)</Label>
                <Input value={kcal} onChange={(e) => setKcal(e.target.value)} inputMode="numeric" />
              </div>
            </div>

            <div className="rounded-lg border border-line bg-cobalt-soft/50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-cobalt-deep">Mevzuat Beyanları</span>
                <Button type="button" variant="secondary" onClick={runAiAnalyze} disabled={aiBusy} className="!py-1 text-xs">
                  {aiBusy ? 'Analiz ediliyor…' : '✨ AI ile Doldur'}
                </Button>
              </div>
              <p className="mb-2 text-xs text-ink-soft">
                Kalori/alerjen beyanlarını doldurur; açıklama boşsa onu da üretir.
              </p>
              {aiNote && <p className="mb-2 rounded bg-white p-2 text-xs leading-relaxed text-ink-soft">{aiNote}</p>}
              <Label>Alerjenler</Label>
              <AllergenPicker value={allergens} onChange={setAllergens} />
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={containsAlcohol}
                    onChange={(e) => setContainsAlcohol(e.target.checked)}
                    className="h-4 w-4"
                  />
                  🍷 Alkol içerir
                </label>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={containsPork}
                    onChange={(e) => setContainsPork(e.target.checked)}
                    className="h-4 w-4"
                  />
                  🥓 Domuz ürünü içerir
                </label>
              </div>
            </div>

            <ErrorText>{error}</ErrorText>
          </div>

          {/* Kaydet çubuğu: yalnızca değişiklik varken belirir, kaydedince
              onay gösterip kaybolur (var olan ürünler için modal açık kalır). */}
          <div
            aria-hidden={!showSaveBar}
            className={`shrink-0 overflow-hidden border-t border-line bg-white transition-[transform,opacity] duration-200 ${
              showSaveBar
                ? 'translate-y-0 opacity-100'
                : 'pointer-events-none translate-y-2 opacity-0'
            }`}
          >
            <div className="flex items-center justify-between gap-3 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4">
              {saveState === 'saved' ? (
                <p role="status" className="text-sm font-medium text-teal-deep">
                  ✓ Kaydedildi
                </p>
              ) : (
                <>
                  <p className="text-sm text-ink-soft">Kaydedilmemiş değişiklikler var</p>
                  <Button type="submit" disabled={saveState === 'saving'} className="shrink-0">
                    {saveState === 'saving' ? 'Kaydediliyor…' : 'Kaydet'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
