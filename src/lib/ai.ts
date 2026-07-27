import { supabase } from './supabase'
import { isAllergenKey, type AllergenKey } from './allergens'

export interface AnalyzeResult {
  kcal_estimate: number
  kcal_min: number
  kcal_max: number
  allergens: AllergenKey[]
  contains_alcohol: boolean
  contains_pork: boolean
  confidence: 'low' | 'medium' | 'high'
  notes: string
}

export interface ImportedItem {
  name: string
  description: string | null
  price: number | null
}

export interface ImportedCategory {
  name: string
  items: ImportedItem[]
}

async function invoke<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body })
  if (error) {
    throw new Error(`AI servisi hatası (${fn}): ${error.message}`)
  }
  if (data?.error) {
    throw new Error(String(data.error))
  }
  return data as T
}

/** Ürün adı + malzemelerden alerjen ve kalori tahmini */
export async function analyzeItem(name: string, description?: string, ingredients?: string) {
  const result = await invoke<AnalyzeResult>('ai-analyze', { name, description, ingredients })
  // AI çıktısındaki alerjen anahtarlarını doğrula
  result.allergens = (result.allergens ?? []).filter((a): a is AllergenKey => isAllergenKey(a))
  return result
}

/** Menü fotoğrafından ürünleri çıkar */
export async function importMenuFromImage(imageBase64: string, mediaType: string) {
  const result = await invoke<{ categories: ImportedCategory[] }>('ai-import-menu', {
    image: imageBase64,
    media_type: mediaType,
  })
  return result.categories ?? []
}

/** Ürün için kısa iştah açıcı açıklama üret */
export async function generateDescription(name: string, ingredients?: string) {
  const result = await invoke<{ description: string }>('ai-describe', { name, ingredients })
  return result.description
}

/** Ürün metinlerini hedef dile çevir */
export async function translateItems(
  items: { id: string; name: string; description: string | null }[],
  targetLocale: string,
) {
  const result = await invoke<{
    translations: { id: string; name: string; description: string | null }[]
  }>('ai-translate', { items, target_locale: targetLocale })
  return result.translations ?? []
}
