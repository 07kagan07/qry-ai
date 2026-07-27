// Ürün için kısa, iştah açıcı Türkçe menü açıklaması üretir.

import { generateJson, handleOptions, jsonResponse } from '../_shared/gemini.ts'

const OUTPUT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    description: {
      type: 'STRING',
      description: 'En fazla 120 karakter, Türkçe, iştah açıcı menü açıklaması',
    },
  },
  required: ['description'],
}

const SYSTEM_PROMPT =
  'Kafe menüleri için kısa, iştah açıcı Türkçe ürün açıklamaları yazıyorsun. ' +
  'En fazla 120 karakter. Abartısız, samimi, doğal bir dil kullan. ' +
  'Klişelerden ("eşsiz lezzet", "damaklarda şölen") kaçın.'

Deno.serve(async (req) => {
  const opt = handleOptions(req)
  if (opt) return opt

  try {
    const { name, ingredients } = await req.json()
    if (!name || typeof name !== 'string') {
      return jsonResponse({ error: 'Ürün adı gerekli.' }, 400)
    }

    const result = await generateJson(
      SYSTEM_PROMPT,
      [{ text: ingredients ? `Ürün: ${name}\nMalzemeler: ${ingredients}` : `Ürün: ${name}` }],
      OUTPUT_SCHEMA,
    )

    return jsonResponse(result)
  } catch (err) {
    console.error('ai-describe error:', err)
    return jsonResponse({ error: err instanceof Error ? err.message : 'Bilinmeyen hata' }, 500)
  }
})
