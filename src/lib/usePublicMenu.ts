import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { LocaleKey } from './locales'
import type { Cafe, Category, CategoryWithItems, MenuItem } from './types'

interface PublicMenuState {
  cafe: Cafe | null
  categories: CategoryWithItems[]
  loading: boolean
  error: string
}

// locale verilmişse (Türkçe dışında bir dil seçiliyse), item_translations/
// category_translations'tan çeviriyi çekip name/description'ın üzerine yazar
// — çevirisi olmayan ürün/kategori sessizce Türkçe kalır, hiçbir şey gizlenmez.
// 4 tema dosyası ve ItemDetailModal bu sayede hiç değişmiyor; onlar zaten
// item.name/item.description okuyor, veri zaten doğru dilde geliyor.
export function usePublicMenu(slug: string | undefined, locale?: LocaleKey | null): PublicMenuState {
  const [state, setState] = useState<PublicMenuState>({
    cafe: null,
    categories: [],
    loading: true,
    error: '',
  })

  useEffect(() => {
    if (!slug) return
    let cancelled = false

    async function load() {
      const { data: cafe, error: cafeErr } = await supabase
        .from('cafes')
        .select('*')
        .eq('slug', slug)
        .maybeSingle()
      if (cancelled) return
      if (cafeErr || !cafe) {
        setState({ cafe: null, categories: [], loading: false, error: 'Menü bulunamadı.' })
        return
      }

      const [cats, items] = await Promise.all([
        supabase
          .from('categories')
          .select('*')
          .eq('cafe_id', cafe.id)
          .eq('is_active', true)
          .order('sort_order'),
        supabase
          .from('menu_items')
          .select('*')
          .eq('cafe_id', cafe.id)
          .eq('is_active', true)
          .order('sort_order'),
      ])
      if (cancelled) return

      let categoryRows = (cats.data ?? []) as Category[]
      let itemRows = (items.data ?? []) as MenuItem[]

      if (locale) {
        const categoryIds = categoryRows.map((c) => c.id)
        const itemIds = itemRows.map((i) => i.id)
        const [catTranslations, itemTranslations] = await Promise.all([
          categoryIds.length
            ? supabase
                .from('category_translations')
                .select('category_id, name')
                .eq('locale', locale)
                .in('category_id', categoryIds)
            : Promise.resolve({ data: [] }),
          itemIds.length
            ? supabase
                .from('item_translations')
                .select('item_id, name, description')
                .eq('locale', locale)
                .in('item_id', itemIds)
            : Promise.resolve({ data: [] }),
        ])
        if (cancelled) return

        const catNameByCategoryId = new Map(
          ((catTranslations.data ?? []) as { category_id: string; name: string }[]).map((t) => [
            t.category_id,
            t.name,
          ]),
        )
        const itemTranslationById = new Map(
          ((itemTranslations.data ?? []) as { item_id: string; name: string; description: string | null }[]).map(
            (t) => [t.item_id, t],
          ),
        )

        categoryRows = categoryRows.map((c) => {
          const translatedName = catNameByCategoryId.get(c.id)
          return translatedName ? { ...c, name: translatedName } : c
        })
        itemRows = itemRows.map((i) => {
          const t = itemTranslationById.get(i.id)
          return t ? { ...i, name: t.name, description: t.description ?? i.description } : i
        })
      }

      const categories = categoryRows
        .map((c) => ({
          ...c,
          items: itemRows.filter((i) => i.category_id === c.id),
        }))
        .filter((c) => c.items.length > 0)

      setState({ cafe: cafe as Cafe, categories, loading: false, error: '' })
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [slug, locale])

  return state
}
