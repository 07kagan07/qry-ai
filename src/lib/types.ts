import type { AllergenKey } from './allergens'
import type { Currency } from './currency'
import type { LocaleKey } from './locales'

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
  reservation_enabled: boolean
  order_enabled: boolean
  enabled_locales: LocaleKey[]
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

export interface CategoryTranslation {
  category_id: string
  locale: string
  name: string
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

export type ReservationStatus = 'pending' | 'confirmed' | 'rejected' | 'cancelled'

// Belirli bir masaya bağlı değildir — hangi masaya oturacağına personel karar verir.
export interface Reservation {
  id: string
  cafe_id: string
  customer_name: string
  phone: string
  party_size: number
  reservation_at: string
  note: string | null
  status: ReservationStatus
  created_at: string
}

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled'

// Sadece gel-al/paket sipariş — masa/oturuma bağlı değil.
export interface Order {
  id: string
  cafe_id: string
  customer_name: string
  phone: string
  note: string | null
  status: OrderStatus
  total: number
  created_at: string
}

// name/price sipariş anında "donmuş" kalır — menu_item sonradan değişse/silinse bile.
export interface OrderItem {
  id: string
  order_id: string
  menu_item_id: string | null
  name: string
  price: number
  quantity: number
  /** Müşterinin ürüne özel isteği (ör. "soğansız") — mutfak ekranında uyarı olarak gösterilir. */
  note: string | null
}

/** get_kitchen_orders RPC'sinden gelen, mutfak ekranının çizdiği sipariş biçimi. */
export interface KitchenOrder {
  id: string
  customer_name: string
  note: string | null
  status: OrderStatus
  created_at: string
  items: { name: string; quantity: number; note: string | null }[]
}

export interface Customer {
  id: string
  cafe_id: string
  phone: string
  name: string
  first_seen_at: string
  last_order_at: string
  total_orders: number
}

// Supabase Auth hesabı yok — id (rastgele UUID) kişisel vardiya linkidir (/vardiya/:id).
export interface Staff {
  id: string
  cafe_id: string
  name: string
  is_active: boolean
  created_at: string
}

export interface Shift {
  id: string
  cafe_id: string
  staff_id: string
  starts_at: string
  ends_at: string
  note: string | null
  created_at: string
  /** Aynı "Her hafta tekrarla" işleminde oluşturulan satırları gruplar; tekil vardiyalarda null. */
  recurrence_id: string | null
}
