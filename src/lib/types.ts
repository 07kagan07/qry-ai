import type { AllergenKey } from './allergens'
import type { Currency } from './currency'

export type MenuTheme = 'classic' | 'grid' | 'elegant' | 'compact'

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
  currency: Currency
  menu_theme: MenuTheme
  menu_landing_enabled: boolean
  cover_image_url: string | null
  wifi_ssid: string | null
  wifi_password: string | null
  website_url: string | null
  waiter_call_enabled: boolean
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

// Kalıcı masa kimliği — QR koda basılan tek şey bu id'dir, hiç değişmez.
export interface Table {
  id: string
  cafe_id: string
  label: string
  is_active: boolean
  created_at: string
}

// Kısa ömürlü geçici oturum — ?masa= değeri budur, kalıcı masa kimliğini taşımaz.
export interface TableSession {
  id: string
  table_id: string
  cafe_id: string
  expires_at: string
  created_at: string
}

export type WaiterCallStatus = 'pending' | 'acknowledged' | 'resolved'

export interface WaiterCall {
  id: string
  cafe_id: string
  table_id: string
  status: WaiterCallStatus
  created_at: string
  acknowledged_at: string | null
  resolved_at: string | null
}
