import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Cafe, Category, CategoryWithItems, MenuItem } from './types'

interface PublicMenuState {
  cafe: Cafe | null
  categories: CategoryWithItems[]
  loading: boolean
  error: string
}

export function usePublicMenu(slug: string | undefined): PublicMenuState {
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

      const categories = ((cats.data ?? []) as Category[])
        .map((c) => ({
          ...c,
          items: ((items.data ?? []) as MenuItem[]).filter((i) => i.category_id === c.id),
        }))
        .filter((c) => c.items.length > 0)

      setState({ cafe: cafe as Cafe, categories, loading: false, error: '' })
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [slug])

  return state
}
