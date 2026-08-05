// Menü fotoğrafından kategorileri, ürünleri ve fiyatları çıkarır (vision).

import { generateJson, handleOptions, jsonResponse } from '../_shared/gemini.ts'

const OUTPUT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    categories: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING', description: 'Kategori adı (örn: Sıcak İçecekler)' },
          items: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                name: { type: 'STRING' },
                description: {
                  type: 'STRING',
                  nullable: true,
                  description: 'Menüde yazan açıklama; yoksa null',
                },
                price: {
                  type: 'NUMBER',
                  nullable: true,
                  description: 'TL cinsinden fiyat; okunamıyorsa null',
                },
              },
              required: ['name'],
            },
          },
        },
        required: ['name', 'items'],
      },
    },
  },
  required: ['categories'],
}

const SYSTEM_PROMPT = `Bir kafe/restoran menüsü fotoğrafından yapılandırılmış veri çıkarıyorsun.
Kurallar:
- Fotoğraftaki TÜM ürünleri çıkar; hiçbirini atlama.
- Menüde görünen kategori başlıklarını kullan. Kategori yoksa ürünleri mantıklı Türkçe
  kategorilere grupla (örn: Sıcak İçecekler, Soğuk İçecekler, Tatlılar, Atıştırmalıklar).
- Fiyatları sayı olarak yaz (₺, TL gibi sembolleri atla). Birden fazla boy/fiyat varsa en
  küçük boyun fiyatını al ve açıklamaya boy bilgisini ekle.
- Okunamayan fiyatlar için null kullan; fiyat uydurma.
- Fiyat yerine "İşletme ile görüşün", "Sorunuz", "Fiyat için sorun" gibi bir metin
  yazıyorsa: price'ı null yap ve bu ifadeyi description alanına ekle (mevcut açıklamayla
  birleştirerek), böylece bilgi kaybolmaz.
- Ürün adlarını menüde yazıldığı gibi koru.`

Deno.serve(async (req) => {
  const opt = handleOptions(req)
  if (opt) return opt

  try {
    const { image, media_type } = await req.json()
    if (!image || typeof image !== 'string') {
      return jsonResponse({ error: 'Görsel gerekli.' }, 400)
    }
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(media_type)) {
      return jsonResponse({ error: 'Desteklenmeyen görsel formatı.' }, 400)
    }

    const result = await generateJson(
      SYSTEM_PROMPT,
      [
        { inline_data: { mime_type: media_type, data: image } },
        { text: 'Bu menü fotoğrafındaki tüm kategorileri ve ürünleri çıkar.' },
      ],
      OUTPUT_SCHEMA,
    )

    return jsonResponse(result)
  } catch (err) {
    console.error('ai-import-menu error:', err)
    return jsonResponse({ error: err instanceof Error ? err.message : 'Bilinmeyen hata' }, 500)
  }
})
