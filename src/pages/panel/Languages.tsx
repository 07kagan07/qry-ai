import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { translateItems } from '../../lib/ai'
import { LOCALE_KEYS, LOCALE_LABELS, LOCALE_FLAGS, type LocaleKey } from '../../lib/locales'
import { Button, Card, ErrorText } from '../../components/ui'

interface Row {
  id: string
  name: string
  description: string | null
}

interface Coverage {
  translatedItems: number
  translatedCategories: number
}

const CHUNK = 40

export default function Languages() {
  const { cafe, refreshCafe } = useAuth()
  const [categories, setCategories] = useState<Row[]>([])
  const [items, setItems] = useState<Row[]>([])
  const [coverage, setCoverage] = useState<Record<string, Coverage>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toggleBusy, setToggleBusy] = useState(false)
  const [translatingLocale, setTranslatingLocale] = useState<LocaleKey | null>(null)
  const [translateProgress, setTranslateProgress] = useState('')

  const load = useCallback(async () => {
    if (!cafe) return
    const [catsRes, itemsRes] = await Promise.all([
      supabase.from('categories').select('id, name').eq('cafe_id', cafe.id).eq('is_active', true),
      supabase
        .from('menu_items')
        .select('id, name, description')
        .eq('cafe_id', cafe.id)
        .eq('is_active', true),
    ])
    if (catsRes.error || itemsRes.error) {
      setError((catsRes.error ?? itemsRes.error)!.message)
      setLoading(false)
      return
    }
    const catRows = (catsRes.data ?? []) as Row[]
    const itemRows = (itemsRes.data ?? []) as Row[]
    setCategories(catRows)
    setItems(itemRows)

    const categoryIds = catRows.map((c) => c.id)
    const itemIds = itemRows.map((i) => i.id)
    const [catTranslationsRes, itemTranslationsRes] = await Promise.all([
      categoryIds.length
        ? supabase.from('category_translations').select('category_id, locale').in('category_id', categoryIds)
        : Promise.resolve({ data: [] as { category_id: string; locale: string }[] }),
      itemIds.length
        ? supabase.from('item_translations').select('item_id, locale').in('item_id', itemIds)
        : Promise.resolve({ data: [] as { item_id: string; locale: string }[] }),
    ])

    const nextCoverage: Record<string, Coverage> = {}
    for (const locale of LOCALE_KEYS) {
      nextCoverage[locale] = { translatedItems: 0, translatedCategories: 0 }
    }
    for (const row of (catTranslationsRes.data ?? []) as { category_id: string; locale: string }[]) {
      if (nextCoverage[row.locale]) nextCoverage[row.locale].translatedCategories++
    }
    for (const row of (itemTranslationsRes.data ?? []) as { item_id: string; locale: string }[]) {
      if (nextCoverage[row.locale]) nextCoverage[row.locale].translatedItems++
    }
    setCoverage(nextCoverage)
    setLoading(false)
  }, [cafe])

  useEffect(() => {
    void load()
  }, [load])

  if (!cafe) return null

  async function toggleLocale(locale: LocaleKey, enabled: boolean) {
    const next = enabled
      ? [...(cafe!.enabled_locales ?? []), locale]
      : (cafe!.enabled_locales ?? []).filter((l) => l !== locale)
    setToggleBusy(true)
    const { error: updateErr } = await supabase.from('cafes').update({ enabled_locales: next }).eq('id', cafe!.id)
    setToggleBusy(false)
    if (updateErr) {
      setError(updateErr.message)
      return
    }
    await refreshCafe()
  }

  async function translateLocale(locale: LocaleKey) {
    setError('')
    setTranslatingLocale(locale)
    try {
      // Sadece o dilde henüz çevirisi olmayanları bul — tekrar basmak zaten
      // çevrilmiş olanlara dokunmaz, ekstra AI maliyeti çıkarmaz.
      const [existingItemLocales, existingCatLocales] = await Promise.all([
        supabase.from('item_translations').select('item_id').eq('locale', locale),
        supabase.from('category_translations').select('category_id').eq('locale', locale),
      ])
      const translatedItemIds = new Set(
        ((existingItemLocales.data ?? []) as { item_id: string }[]).map((r) => r.item_id),
      )
      const translatedCatIds = new Set(
        ((existingCatLocales.data ?? []) as { category_id: string }[]).map((r) => r.category_id),
      )
      const pendingItems = items.filter((i) => !translatedItemIds.has(i.id))
      const pendingCategories = categories.filter((c) => !translatedCatIds.has(c.id))

      if (pendingItems.length === 0 && pendingCategories.length === 0) {
        setTranslatingLocale(null)
        return
      }

      let done = 0
      let skipped = 0
      const total = pendingItems.length + pendingCategories.length

      for (let i = 0; i < pendingCategories.length; i += CHUNK) {
        const chunk = pendingCategories.slice(i, i + CHUNK)
        const validIds = new Set(chunk.map((c) => c.id))
        const translations = await translateItems(
          chunk.map((c) => ({ id: c.id, name: c.name, description: null })),
          locale,
        )
        // AI uzun bir UUID'yi bazen bir karakter kaybederek "yansıtır" — bozuk
        // id doğrudan upsert'e gitmesin diye gönderdiğimiz gerçek id'lerle
        // eşleşmeyenler sessizce atlanır (o kategori "çevrilmemiş" kalır,
        // bir sonraki basışta tekrar denenir).
        const valid = translations.filter((t) => validIds.has(t.id))
        skipped += translations.length - valid.length
        const rows = valid.map((t) => ({ category_id: t.id, locale, name: t.name }))
        if (rows.length) {
          const { error: upsertErr } = await supabase
            .from('category_translations')
            .upsert(rows, { onConflict: 'category_id,locale' })
          if (upsertErr) throw new Error(upsertErr.message)
        }
        done += chunk.length
        setTranslateProgress(`${done}/${total}`)
      }

      for (let i = 0; i < pendingItems.length; i += CHUNK) {
        const chunk = pendingItems.slice(i, i + CHUNK)
        const validIds = new Set(chunk.map((it) => it.id))
        const translations = await translateItems(
          chunk.map((it) => ({ id: it.id, name: it.name, description: it.description })),
          locale,
        )
        const valid = translations.filter((t) => validIds.has(t.id))
        skipped += translations.length - valid.length
        const rows = valid.map((t) => ({
          item_id: t.id,
          locale,
          name: t.name,
          description: t.description,
        }))
        if (rows.length) {
          const { error: upsertErr } = await supabase
            .from('item_translations')
            .upsert(rows, { onConflict: 'item_id,locale' })
          if (upsertErr) throw new Error(upsertErr.message)
        }
        done += chunk.length
        setTranslateProgress(`${done}/${total}`)
      }

      await load()
      if (skipped > 0) {
        setError(
          `${skipped} ürün/kategori AI'nin geçersiz bir kimlik döndürmesi nedeniyle atlandı — ` +
            `"Menüyü Çevir"e tekrar basarak tamamlayabilirsiniz.`,
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Çeviri başarısız oldu.')
    } finally {
      setTranslatingLocale(null)
      setTranslateProgress('')
    }
  }

  const enabledLocales = cafe.enabled_locales ?? []

  return (
    <div className="max-w-2xl">
      <h1 className="mb-2 text-xl font-bold">Diller</h1>
      <p className="mb-4 text-sm text-ink-soft">
        Menünüzü hangi dillerde sunacağınızı seçin; her dil için "Menüyü Çevir" ile yapay zeka
        kategori ve ürünleri çevirsin. Müşteriler menüde sağ üstteki dil seçiciden bu dilleri
        görebilir. Yeni ürün eklediğinizde tekrar "Menüyü Çevir"e basmanız yeterli — zaten çevrilmiş
        olanlara dokunulmaz.
      </p>

      <ErrorText>{error}</ErrorText>

      <Card>
        {loading ? (
          <p className="text-sm text-ink-soft">Yükleniyor…</p>
        ) : (
          <ul className="divide-y divide-line">
            {LOCALE_KEYS.map((locale) => {
              const isEnabled = enabledLocales.includes(locale)
              const cov = coverage[locale] ?? { translatedItems: 0, translatedCategories: 0 }
              const isTranslating = translatingLocale === locale
              const fullyTranslated =
                cov.translatedItems === items.length && cov.translatedCategories === categories.length

              return (
                <li key={locale} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <label className="flex min-h-11 items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      disabled={toggleBusy}
                      onChange={(e) => toggleLocale(locale, e.target.checked)}
                      className="h-4 w-4"
                    />
                    <span className="font-medium text-ink">
                      {LOCALE_FLAGS[locale]} {LOCALE_LABELS[locale]}
                    </span>
                  </label>
                  {isEnabled && (
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-ink-soft">
                        {cov.translatedItems}/{items.length} ürün, {cov.translatedCategories}/
                        {categories.length} kategori çevrildi
                      </span>
                      <Button
                        variant="secondary"
                        className="text-xs"
                        disabled={translatingLocale !== null || fullyTranslated}
                        onClick={() => translateLocale(locale)}
                      >
                        {isTranslating
                          ? translateProgress
                            ? `Çevriliyor… (${translateProgress})`
                            : 'Çevriliyor…'
                          : fullyTranslated
                            ? 'Tümü çevrildi'
                            : 'Menüyü Çevir'}
                      </Button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}
