import type { AllergenKey } from './allergens'

export interface Cafe {
  id: string
  owner_id: string
  name: string
  slug: string
  logo_url: string | null
  address: string | null
  phone: string | null
  instagram: string | null
  default_locale: string
  created_at: string
}

export interface Category {
  id: string
  cafe_id: string
  name: string
  sort_order: number
  is_active: boolean
}

// AI'nin önerdiği ve işletmecinin henüz onaylamadığı değerler
export interface AiSuggestion {
  kcal_estimate: number
  kcal_min: number
  kcal_max: number
  allergens: AllergenKey[]
  contains_alcohol: boolean
  contains_pork: boolean
  confidence: 'low' | 'medium' | 'high'
  notes: string
  suggested_at: string
  approved: boolean
}

export interface MenuItem {
  id: string
  cafe_id: string
  category_id: string
  name: string
  description: string | null
  price: number
  image_url: string | null
  kcal: number | null
  allergens: AllergenKey[]
  contains_alcohol: boolean
  contains_pork: boolean
  ai_suggested: AiSuggestion | null
  is_active: boolean
  sort_order: number
}

export interface ItemTranslation {
  item_id: string
  locale: string
  name: string
  description: string | null
}

export interface CategoryWithItems extends Category {
  items: MenuItem[]
}
