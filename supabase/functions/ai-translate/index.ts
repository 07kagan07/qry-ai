// Menü ürün metinlerini hedef dile çevirir (çok dilli menü altyapısı).

import { generateJson, handleOptions, jsonResponse } from '../_shared/gemini.ts'

const OUTPUT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    translations: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING' },
          name: { type: 'STRING' },
          description: { type: 'STRING', nullable: true },
        },
        required: ['id', 'name'],
      },
    },
  },
  required: ['translations'],
}

const LOCALE_NAMES: Record<string, string> = {
  en: 'İngilizce',
  de: 'Almanca',
  ar: 'Arapça',
  ru: 'Rusça',
  fr: 'Fransızca',
  es: 'İspanyolca',
}

Deno.serve(async (req) => {
  const opt = handleOptions(req)
  if (opt) return opt

  try {
    const { items, target_locale } = await req.json()
    if (!Array.isArray(items) || items.length === 0) {
      return jsonResponse({ error: 'Çevrilecek ürün listesi gerekli.' }, 400)
    }
    if (items.length > 100) {
      return jsonResponse({ error: 'Tek seferde en fazla 100 ürün çevrilebilir.' }, 400)
    }
    const localeName = LOCALE_NAMES[target_locale]
    if (!localeName) {
      return jsonResponse(
        { error: `Desteklenmeyen dil: ${target_locale}. Desteklenenler: ${Object.keys(LOCALE_NAMES).join(', ')}` },
        400,
      )
    }

    const systemPrompt =
      `Türkçe kafe menüsü metinlerini ${localeName} diline çeviriyorsun. ` +
      'Yemek adlarında yerleşik karşılık varsa onu kullan (örn: Türk Kahvesi -> Turkish Coffee); ' +
      'yoksa özgün adı koruyup kısa bir açıklama ekle (örn: Menemen -> Menemen (Turkish scrambled ' +
      'eggs with tomatoes)). id alanlarını aynen koru. description null ise null bırak.'

    const result = await generateJson(
      systemPrompt,
      [{ text: JSON.stringify({ items }) }],
      OUTPUT_SCHEMA,
    )

    return jsonResponse(result)
  } catch (err) {
    console.error('ai-translate error:', err)
    return jsonResponse({ error: err instanceof Error ? err.message : 'Bilinmeyen hata' }, 500)
  }
})
