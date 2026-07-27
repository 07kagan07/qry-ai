// Supabase Edge Functions (Deno) için ortak Gemini API yardımcıları.
// Ücretsiz API anahtarı: https://aistudio.google.com/apikey
// Secret olarak tanımlanmalı:
//   supabase secrets set GEMINI_API_KEY=AIza...

export const MODEL = 'gemini-2.5-flash'

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export function handleOptions(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  return null
}

interface GeminiPart {
  text?: string
  inline_data?: { mime_type: string; data: string }
}

/**
 * Gemini'ye yapılandırılmış (JSON şemalı) istek atar ve parse edilmiş JSON döner.
 * schema: Gemini responseSchema formatı (type: OBJECT/ARRAY/STRING/INTEGER/NUMBER/BOOLEAN)
 */
export async function generateJson<T>(
  systemPrompt: string,
  userParts: GeminiPart[],
  schema: Record<string, unknown>,
): Promise<T> {
  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY tanımlı değil. `supabase secrets set GEMINI_API_KEY=...` ile ekleyin.')
  }

  const res = await fetch(`${API_BASE}/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: userParts }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    // Ücretsiz katman kota aşımı için anlaşılır mesaj
    if (res.status === 429) {
      throw new Error('Gemini ücretsiz kota sınırına ulaşıldı. Bir dakika bekleyip tekrar deneyin.')
    }
    throw new Error(`Gemini API hatası (${res.status}): ${errText.slice(0, 300)}`)
  }

  const data = await res.json()

  if (data.promptFeedback?.blockReason) {
    throw new Error(`İstek AI tarafından engellendi (${data.promptFeedback.blockReason}).`)
  }

  const candidate = data.candidates?.[0]
  const text = candidate?.content?.parts?.map((p: GeminiPart) => p.text ?? '').join('')
  if (!text) {
    throw new Error('AI yanıtı boş döndü, lütfen tekrar deneyin.')
  }
  if (candidate.finishReason && candidate.finishReason !== 'STOP') {
    throw new Error(`AI yanıtı tamamlanamadı (${candidate.finishReason}), lütfen tekrar deneyin.`)
  }

  return JSON.parse(text) as T
}

export const ALLERGEN_ENUM = [
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
]
