// Türk Gıda Kodeksi Gıda Etiketleme ve Tüketicileri Bilgilendirme Yönetmeliği
// Ek-1'deki 14 majör alerjen. Anahtarlar veritabanında text[] olarak saklanır.

export const ALLERGEN_KEYS = [
  'gluten',
  'crustaceans',
  'egg',
  'fish',
  'peanut',
  'soy',
  'milk',
  'nuts',
  'celery',
  'mustard',
  'sesame',
  'sulphites',
  'lupin',
  'molluscs',
] as const

export type AllergenKey = (typeof ALLERGEN_KEYS)[number]

export interface AllergenInfo {
  key: AllergenKey
  label: string
  icon: string
  description: string
}

export const ALLERGENS: Record<AllergenKey, AllergenInfo> = {
  gluten: {
    key: 'gluten',
    label: 'Gluten',
    icon: '🌾',
    description: 'Gluten içeren tahıllar (buğday, çavdar, arpa, yulaf)',
  },
  crustaceans: {
    key: 'crustaceans',
    label: 'Kabuklular',
    icon: '🦐',
    description: 'Kabuklu deniz hayvanları (karides, yengeç, ıstakoz)',
  },
  egg: { key: 'egg', label: 'Yumurta', icon: '🥚', description: 'Yumurta ve yumurta ürünleri' },
  fish: { key: 'fish', label: 'Balık', icon: '🐟', description: 'Balık ve balık ürünleri' },
  peanut: {
    key: 'peanut',
    label: 'Yer Fıstığı',
    icon: '🥜',
    description: 'Yer fıstığı ve ürünleri',
  },
  soy: { key: 'soy', label: 'Soya', icon: '🫘', description: 'Soya fasulyesi ve ürünleri' },
  milk: {
    key: 'milk',
    label: 'Süt',
    icon: '🥛',
    description: 'Süt ve süt ürünleri (laktoz dahil)',
  },
  nuts: {
    key: 'nuts',
    label: 'Sert Kabuklu Yemişler',
    icon: '🌰',
    description: 'Badem, fındık, ceviz, kaju, antep fıstığı vb.',
  },
  celery: { key: 'celery', label: 'Kereviz', icon: '🥬', description: 'Kereviz ve ürünleri' },
  mustard: { key: 'mustard', label: 'Hardal', icon: '🟡', description: 'Hardal ve ürünleri' },
  sesame: { key: 'sesame', label: 'Susam', icon: '🫓', description: 'Susam tohumu ve ürünleri' },
  sulphites: {
    key: 'sulphites',
    label: 'Sülfit',
    icon: '🧪',
    description: 'Kükürt dioksit ve sülfitler (>10 mg/kg)',
  },
  lupin: { key: 'lupin', label: 'Acı Bakla', icon: '🌸', description: 'Acı bakla (lupin) ve ürünleri' },
  molluscs: {
    key: 'molluscs',
    label: 'Yumuşakçalar',
    icon: '🐚',
    description: 'Midye, kalamar, ahtapot, salyangoz vb.',
  },
}

export const ALLERGEN_LIST: AllergenInfo[] = ALLERGEN_KEYS.map((k) => ALLERGENS[k])

export function isAllergenKey(v: string): v is AllergenKey {
  return (ALLERGEN_KEYS as readonly string[]).includes(v)
}
