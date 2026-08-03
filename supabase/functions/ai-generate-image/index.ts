// Verilen prompt'tan görsel üretir. ÜCRETLİ bir işlemdir (Google Cloud
// faturalandırması gerektirir) — bkz. _shared/gemini.ts içindeki IMAGE_MODEL notu.

import { generateImage, handleOptions, jsonResponse } from '../_shared/gemini.ts'

const MAX_PROMPT_LENGTH = 2000

Deno.serve(async (req) => {
  const opt = handleOptions(req)
  if (opt) return opt

  try {
    const { prompt } = await req.json()
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return jsonResponse({ error: 'Prompt gerekli.' }, 400)
    }
    if (prompt.length > MAX_PROMPT_LENGTH) {
      return jsonResponse({ error: `Prompt en fazla ${MAX_PROMPT_LENGTH} karakter olabilir.` }, 400)
    }

    const { base64, mimeType } = await generateImage(prompt.trim())
    return jsonResponse({ image: base64, mime_type: mimeType })
  } catch (err) {
    console.error('ai-generate-image error:', err)
    return jsonResponse({ error: err instanceof Error ? err.message : 'Bilinmeyen hata' }, 500)
  }
})
