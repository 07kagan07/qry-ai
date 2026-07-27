// Birden çok ürün için tek istekte mevzuat beyanları (alerjen, kcal, alkol, domuz)
// ve eksik açıklamaları üretir. Menü içe aktarma sonrası toplu doldurma için.

import {
  ALLERGEN_ENUM,
  generateJson,
  handleOptions,
  jsonResponse,
} from '../_shared/gemini.ts'

const MAX_ITEMS = 40

const OUTPUT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    results: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING', description: 'Girdideki id, aynen korunur' },
          kcal_estimate: { type: 'INTEGER' },
          kcal_min: { type: 'INTEGER' },
          kcal_max: { type: 'INTEGER' },
          allergens: {
            type: 'ARRAY',
            items: { type: 'STRING', enum: ALLERGEN_ENUM },
          },
          contains_alcohol: { type: 'BOOLEAN' },
          contains_pork: { type: 'BOOLEAN' },
          confidence: { type: 'STRING', enum: ['low', 'medium', 'high'] },
          notes: { type: 'STRING', description: 'Türkçe, tek cümle: tahmin dayanağı/uyarı' },
          description: {
            type: 'STRING',
            nullable: true,
            description:
              'Ürünün açıklaması yoksa en fazla 120 karakterlik Türkçe menü açıklaması; açıklaması zaten varsa null',
          },
        },
        required: [
          'id',
          'kcal_estimate',
          'kcal_min',
          'kcal_max',
          'allergens',
          'contains_alcohol',
          'contains_pork',
          'confidence',
          'notes',
        ],
      },
    },
  },
  required: ['results'],
}

const SYSTEM_PROMPT = `Sen Türk mutfağı ve gıda bilimi konusunda uzman bir gıda mühendisisin.
Bir kafe menüsündeki ÜRÜN LİSTESİNİN TAMAMI için Türk Gıda Kodeksi kapsamında beyan edilmesi
gereken bilgileri üretiyorsun. Her ürün için bir sonuç döndür; id alanını aynen koru.

Kurallar:
- Kalori tahmini TEK PORSİYON içindir (kafede servis edilen tipik porsiyon).
- Alerjenlerde ürünün tipik/geleneksel tarifini esas al; muhtemel alerjenleri de dahil et
  (tüketici güvenliği önceliklidir) ve notes'ta belirt.
- notes: her ürün için Türkçe TEK kısa cümle.
- description: ürünün açıklaması yoksa iştah açıcı, abartısız, en fazla 120 karakterlik
  Türkçe bir açıklama yaz. Klişelerden ("eşsiz lezzet") kaçın. Açıklaması zaten varsa null.
- Klasik ürünlerde (Türk kahvesi, ayran, simit...) yüksek güven; belirsiz/özel ürünlerde
  düşük güven bildir.`

Deno.serve(async (req) => {
  const opt = handleOptions(req)
  if (opt) return opt

  try {
    const { items } = await req.json()
    if (!Array.isArray(items) || items.length === 0) {
      return jsonResponse({ error: 'Ürün listesi gerekli.' }, 400)
    }
    if (items.length > MAX_ITEMS) {
      return jsonResponse({ error: `Tek istekte en fazla ${MAX_ITEMS} ürün analiz edilebilir.` }, 400)
    }
    for (const it of items) {
      if (!it || typeof it.id !== 'string' || typeof it.name !== 'string' || !it.name.trim()) {
        return jsonResponse({ error: 'Her ürün için id ve name gerekli.' }, 400)
      }
    }

    const lines = items.map(
      (it: { id: string; name: string; description?: string | null }) =>
        `- id: ${it.id} | ürün: ${it.name}${it.description ? ` | mevcut açıklama: ${it.description}` : ' | açıklama yok'}`,
    )

    const result = await generateJson(
      SYSTEM_PROMPT,
      [{ text: `Ürün listesi:\n${lines.join('\n')}` }],
      OUTPUT_SCHEMA,
    )

    return jsonResponse(result)
  } catch (err) {
    console.error('ai-analyze-batch error:', err)
    return jsonResponse({ error: err instanceof Error ? err.message : 'Bilinmeyen hata' }, 500)
  }
})
