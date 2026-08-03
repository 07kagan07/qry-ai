import { supabase } from './supabase'

const BUCKET = 'menu-images'

const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

function extFromMime(mime: string): string {
  return MIME_TO_EXT[mime] ?? 'png'
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteChars = atob(base64)
  const bytes = new Uint8Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)
  return new Blob([bytes], { type: mimeType })
}

async function upload(cafeId: string, ext: string, body: File | Blob, contentType: string) {
  const path = `${cafeId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, body, { contentType, upsert: false })
  if (error) throw new Error(`Görsel yüklenemedi: ${error.message}`)
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

/** İşletmecinin kendi bilgisayarından seçtiği görseli yükler. */
export async function uploadItemImage(cafeId: string, file: File): Promise<string> {
  const ext = extFromMime(file.type) ?? file.name.split('.').pop() ?? 'png'
  return upload(cafeId, ext, file, file.type)
}

/** AI'nin ürettiği base64 görseli storage'a yükler. */
export async function uploadGeneratedImage(
  cafeId: string,
  base64: string,
  mimeType: string,
): Promise<string> {
  return upload(cafeId, extFromMime(mimeType), base64ToBlob(base64, mimeType), mimeType)
}
