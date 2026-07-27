import { useState } from 'react'
import type { FormEvent } from 'react'
import type { AllergenKey } from '../lib/allergens'
import type { AiSuggestion, MenuItem } from '../lib/types'
import { analyzeItem, generateDescription } from '../lib/ai'
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
}

interface Props {
  title: string
  initial?: MenuItem
  onSave: (draft: ItemDraft) => Promise<void>
  onClose: () => void
}

export default function ItemFormModal({ title, initial, onSave, onClose }: Props) {
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
  const [busy, setBusy] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [descBusy, setDescBusy] = useState(false)

  async function runAiAnalyze() {
    if (!name.trim()) {
      setError('Önce ürün adını girin.')
      return
    }
    setError('')
    setAiBusy(true)
    try {
      const r = await analyzeItem(name, description || undefined, ingredients || undefined)
      setKcal(String(r.kcal_estimate))
      setAllergens(r.allergens)
      setContainsAlcohol(r.contains_alcohol)
      setContainsPork(r.contains_pork)
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

  async function runAiDescribe() {
    if (!name.trim()) {
      setError('Önce ürün adını girin.')
      return
    }
    setError('')
    setDescBusy(true)
    try {
      setDescription(await generateDescription(name, ingredients || undefined))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Açıklama üretilemedi.')
    } finally {
      setDescBusy(false)
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    const priceNum = Number(price.replace(',', '.'))
    if (Number.isNaN(priceNum) || priceNum < 0) {
      setError('Geçerli bir fiyat girin.')
      return
    }
    setBusy(true)
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
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kaydedilemedi.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-8 w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="text-ink-soft hover:text-ink">
            ✕
          </button>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label>Ürün Adı *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Örn: Fıstıklı Baklava" />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label>Açıklama</Label>
              <button
                type="button"
                onClick={runAiDescribe}
                disabled={descBusy}
                className="mb-1 text-xs font-medium text-cobalt hover:underline disabled:text-ink-soft"
              >
                {descBusy ? 'Üretiliyor…' : '✨ Açıklama üret'}
              </button>
            </div>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <Label>Malzemeler (AI analizinin isabetini artırır, menüde gösterilmez)</Label>
            <Input
              value={ingredients}
              onChange={(e) => setIngredients(e.target.value)}
              placeholder="Örn: antep fıstığı, yufka, tereyağı, şerbet"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Fiyat (₺) *</Label>
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
            {aiNote && <p className="mb-2 rounded bg-white p-2 text-xs leading-relaxed text-ink-soft">{aiNote}</p>}
            <Label>Alerjenler</Label>
            <AllergenPicker value={allergens} onChange={setAllergens} />
            <div className="mt-3 flex gap-5">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={containsAlcohol} onChange={(e) => setContainsAlcohol(e.target.checked)} />
                🍷 Alkol içerir
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={containsPork} onChange={(e) => setContainsPork(e.target.checked)} />
                🥓 Domuz ürünü içerir
              </label>
            </div>
          </div>

          <ErrorText>{error}</ErrorText>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Vazgeç
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Kaydediliyor…' : 'Kaydet'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
