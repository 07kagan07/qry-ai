// Ürün bilgilerinden, görsel üretim modeline verilecek optimize bir fotoğraf
// prompt'u üretir. Ücretsiz metin modelini kullanır (görsel üretmez, maliyetsiz).

import { generateJson, handleOptions, jsonResponse } from '../_shared/gemini.ts'

const OUTPUT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    prompt: {
      type: 'STRING',
      description: 'İngilizce, detaylı, fotogerçekçi yemek/içecek fotoğrafçılığı prompt\'u',
    },
    style_note: {
      type: 'STRING',
      description: 'Türkçe, tek cümle: bu stil/kompozisyon neden seçildi',
    },
  },
  required: ['prompt', 'style_note'],
}

const SYSTEM_PROMPT = `Sen bir yemek/içecek fotoğrafçılığı sanat yönetmenisin. Bir kafe menüsündeki
ürün için, yapay zeka görsel üretim modeline verilecek profesyonel bir fotoğraf prompt'u
yazıyorsun. Amaç: bu ürüne EN UYGUN, işletmenin gerçekte servis edeceği şeye en yakın görseli
üretmek.

Kurallar:
- prompt İNGİLİZCE olmalı (görsel üretim modelleri İngilizce prompt'ta daha isabetli sonuç verir).
- Ürünün geleneksel/tipik Türk kafe sunumunu yansıt: doğru tabak/bardak/fincan/tepsi, doğru
  porsiyon büyüklüğü, doğru renk ve doku. Örnekler: Türk kahvesi bakır cezve yanında küçük
  fincanda lokumla; ayran bakır tas ya da ince belli bardakta; baklava dikdörtgen tepside
  parlak şerbetiyle; latte şeffaf veya seramik fincanda latte-art ile.
- Sıcak, doğal, iştah açıcı aydınlatma; sade ve az dikkat dağıtan arka plan (bulanık masa/kafe
  atmosferi ima edilebilir ama kalabalık/karmaşık olmamalı).
- Fotogerçekçi, yüksek detaylı, profesyonel menü fotoğrafçılığı stili; ürüne göre en uygun açı
  (çoğunlukla 45 derece veya doğrudan üstten).
- Görselde YAZI, logo, filigran, marka adı, insan eli/yüzü OLMASIN (ürünün doğası gerektirmedikçe).
- Kare (1:1) kompozisyona uygun kurgula; ürün kadrajın ortasında ve net olsun.
- style_note Türkçe ve TEK cümle olsun; işletmeciye stil seçiminin gerekçesini özetle.`

Deno.serve(async (req) => {
  const opt = handleOptions(req)
  if (opt) return opt

  try {
    const { name, description, ingredients, category } = await req.json()
    if (!name || typeof name !== 'string' || !name.trim()) {
      return jsonResponse({ error: 'Ürün adı gerekli.' }, 400)
    }

    const parts = [`Ürün adı: ${name}`]
    if (category) parts.push(`Kategori: ${category}`)
    if (description) parts.push(`Açıklama: ${description}`)
    if (ingredients) parts.push(`Malzemeler: ${ingredients}`)

    const result = await generateJson(SYSTEM_PROMPT, [{ text: parts.join('\n') }], OUTPUT_SCHEMA)
    return jsonResponse(result)
  } catch (err) {
    console.error('ai-image-prompt error:', err)
    return jsonResponse({ error: err instanceof Error ? err.message : 'Bilinmeyen hata' }, 500)
  }
})
