// Ürün adı + malzemelerden mevzuat beyanlarını (14 alerjen, kcal, alkol, domuz) tahmin eder.
// Türk Gıda Kodeksi Gıda Etiketleme ve Tüketicileri Bilgilendirme Yönetmeliği uyumu için.

import {
  ALLERGEN_ENUM,
  generateJson,
  handleOptions,
  jsonResponse,
} from '../_shared/gemini.ts'

const OUTPUT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    kcal_estimate: { type: 'INTEGER', description: 'Tek porsiyon için en olası enerji değeri (kcal)' },
    kcal_min: { type: 'INTEGER', description: 'Makul alt sınır (kcal)' },
    kcal_max: { type: 'INTEGER', description: 'Makul üst sınır (kcal)' },
    allergens: {
      type: 'ARRAY',
      items: { type: 'STRING', enum: ALLERGEN_ENUM },
      description: 'Üründe bulunması muhtemel 14 majör alerjenden olanlar',
    },
    contains_alcohol: { type: 'BOOLEAN' },
    contains_pork: { type: 'BOOLEAN' },
    confidence: { type: 'STRING', enum: ['low', 'medium', 'high'] },
    notes: {
      type: 'STRING',
      description: 'Türkçe, 1-2 cümle: tahminin dayanağı ve işletmecinin kontrol etmesi gerekenler',
    },
    description: {
      type: 'STRING',
      nullable: true,
      description:
        'Menü açıklaması zaten verilmişse null. Verilmemişse en fazla 120 karakterlik, ' +
        'iştah açıcı, abartısız bir Türkçe menü açıklaması üret.',
    },
  },
  required: [
    'kcal_estimate',
    'kcal_min',
    'kcal_max',
    'allergens',
    'contains_alcohol',
    'contains_pork',
    'confidence',
    'notes',
  ],
}

const SYSTEM_PROMPT = `Sen Türk mutfağı ve gıda bilimi konusunda uzman bir gıda mühendisisin.
Bir kafe/restoran menüsündeki ürün için Türk Gıda Kodeksi kapsamında beyan edilmesi gereken
bilgileri tahmin ediyorsun.

Kurallar:
- Ürün adı tek başına belirsiz/eksik olabilir (ör. sadece "Kaşarlı" ya da "Karışık"); bu
  durumda verilmişse KATEGORİ adıyla birleştirerek asıl yemeği anla (ör. "Gözleme"
  kategorisindeki "Kaşarlı" = kaşarlı gözleme → yufka/glüten içerir).
- Kalori tahmini TEK PORSİYON içindir (kafede servis edilen tipik porsiyon).
- Alerjenlerde tipik/geleneksel tarifi esas al. Malzeme listesi verildiyse ona öncelik ver.
- Emin olmadığın ama muhtemel alerjenleri de dahil et (tüketici güvenliği önceliklidir) ve
  notes alanında belirt.
- Çapraz bulaşma riskini notes'ta belirt ama allergens listesine ekleme.
- Türk kahvesi, ayran, simit, menemen gibi klasik ürünlerde yüksek güven; ev yapımı/özel
  ürünlerde düşük güven bildir.
- notes her zaman Türkçe olmalı.
- description: menü açıklaması zaten verilmişse kesinlikle null döndür (üzerine yazma).
  Verilmemişse kısa, iştah açıcı, klişesiz ("eşsiz lezzet" gibi ifadeler yok) bir açıklama üret.`

Deno.serve(async (req) => {
  const opt = handleOptions(req)
  if (opt) return opt

  try {
    const { name, description, ingredients, category } = await req.json()
    if (!name || typeof name !== 'string') {
      return jsonResponse({ error: 'Ürün adı gerekli.' }, 400)
    }

    const parts = [`Ürün adı: ${name}`]
    if (category) parts.push(`Kategori: ${category}`)
    if (description) parts.push(`Menü açıklaması: ${description}`)
    if (ingredients) parts.push(`Malzemeler: ${ingredients}`)

    // temperature: 0 — aynı ürün için tekrar analiz edildiğinde tutarlı (deterministik)
    // sonuç dönmesi için; mevzuat beyanı gibi hukuki sorumluluğu olan bir çıktıda
    // istekten isteğe farklı alerjen listesi dönmesi kabul edilemez.
    const result = await generateJson(
      SYSTEM_PROMPT,
      [{ text: parts.join('\n') }],
      OUTPUT_SCHEMA,
      { temperature: 0 },
    )

    return jsonResponse(result)
  } catch (err) {
    console.error('ai-analyze error:', err)
    return jsonResponse({ error: err instanceof Error ? err.message : 'Bilinmeyen hata' }, 500)
  }
})
