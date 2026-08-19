// Tek bir AudioContext yeniden kullanılır (her bip için yenisini açmak yerine).
// Tarayıcılar, kullanıcı sayfayla hiç etkileşmeden sesin otomatik çalmasını
// engeller (autoplay policy) — bu yüzden context ilk dokunma/tuş basımında
// unlockAudioOnFirstInteraction ile önceden açılıp kilidi kaldırılır; sonraki
// çağrılarda kullanıcı etkileşimi olmadan da (arka planda) ses çalabilir.
let sharedAudioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  try {
    if (!sharedAudioCtx) sharedAudioCtx = new AudioContext()
    if (sharedAudioCtx.state === 'suspended') void sharedAudioCtx.resume()
    return sharedAudioCtx
  } catch {
    return null
  }
}

/** Kısa bir bip — bağımlılık eklemeden, Web Audio API ile üretilir. */
export function beep() {
  const ctx = getAudioContext()
  if (!ctx) return
  try {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.6, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.start()
    osc.stop(ctx.currentTime + 0.4)
  } catch {
    // Tarayıcı Web Audio'yu engellemiş olabilir — sessizce yoksay.
  }
}

/** Sayfayla ilk dokunma/tuş basımında ses kilidini önceden açar. */
export function unlockAudioOnFirstInteraction(): () => void {
  function unlock() {
    getAudioContext()
  }
  document.addEventListener('pointerdown', unlock, { once: true })
  document.addEventListener('keydown', unlock, { once: true })
  return () => {
    document.removeEventListener('pointerdown', unlock)
    document.removeEventListener('keydown', unlock)
  }
}
