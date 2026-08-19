// Müşterinin son birkaç rezervasyonunun id'lerini tarayıcıda saklar — arka
// arkaya birden fazla rezervasyon verdiğinde hepsinin durumunu (onaylandı/
// reddedildi vb.) görebilsin diye, sadece en sonuncusunu değil. Kafe başına
// en fazla MAX_TRACKED rezervasyon tutulur (en yeniler önde), eskiler
// otomatik düşer. orderTracking.ts ile aynı desen.

const PREFIX = 'qr-menu:reservations:'
const MAX_TRACKED = 5

function storageKey(cafeSlug: string) {
  return PREFIX + cafeSlug
}

export function getTrackedReservationIds(cafeSlug: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey(cafeSlug))
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function writeTrackedReservationIds(cafeSlug: string, ids: string[]) {
  try {
    localStorage.setItem(storageKey(cafeSlug), JSON.stringify(ids))
  } catch {
    // localStorage kullanılamıyorsa (gizli sekme vb.) sessizce yoksay.
  }
}

export function addTrackedReservation(cafeSlug: string, id: string) {
  const ids = getTrackedReservationIds(cafeSlug).filter((existing) => existing !== id)
  ids.unshift(id)
  writeTrackedReservationIds(cafeSlug, ids.slice(0, MAX_TRACKED))
}

export function removeTrackedReservation(cafeSlug: string, id: string) {
  writeTrackedReservationIds(
    cafeSlug,
    getTrackedReservationIds(cafeSlug).filter((existing) => existing !== id),
  )
}
