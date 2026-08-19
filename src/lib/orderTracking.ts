// Müşterinin son birkaç siparişinin id'lerini tarayıcıda saklar — arka arkaya
// birden fazla sipariş verdiğinde hepsinin durumunu (hazırlanıyor/reddedildi
// vb.) görebilsin diye, sadece en sonuncusunu değil. Kafe başına en fazla
// MAX_TRACKED sipariş tutulur (en yeniler önde), eskiler otomatik düşer.

const PREFIX = 'qr-menu:orders:'
const MAX_TRACKED = 5

function storageKey(cafeSlug: string) {
  return PREFIX + cafeSlug
}

export function getTrackedOrderIds(cafeSlug: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey(cafeSlug))
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function writeTrackedOrderIds(cafeSlug: string, ids: string[]) {
  try {
    localStorage.setItem(storageKey(cafeSlug), JSON.stringify(ids))
  } catch {
    // localStorage kullanılamıyorsa (gizli sekme vb.) sessizce yoksay.
  }
}

export function addTrackedOrder(cafeSlug: string, id: string) {
  const ids = getTrackedOrderIds(cafeSlug).filter((existing) => existing !== id)
  ids.unshift(id)
  writeTrackedOrderIds(cafeSlug, ids.slice(0, MAX_TRACKED))
}

export function removeTrackedOrder(cafeSlug: string, id: string) {
  writeTrackedOrderIds(
    cafeSlug,
    getTrackedOrderIds(cafeSlug).filter((existing) => existing !== id),
  )
}
