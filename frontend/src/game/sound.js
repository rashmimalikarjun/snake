/**
 * Retro sound effects generated with the Web Audio API — square waves only,
 * short and clicky, like a phone buzzer. Audio context is created lazily on
 * first user interaction (browser autoplay policy).
 */

let ctx = null
let enabled = true

function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

export function setSoundEnabled(v) {
  enabled = v
}

export function isSoundEnabled() {
  return enabled
}

function beep(freq, durationMs, { type = 'square', volume = 0.045, delayMs = 0, slideTo = null } = {}) {
  if (!enabled) return
  const ac = ensureCtx()
  if (!ac) return
  const t0 = ac.currentTime + delayMs / 1000
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (slideTo) osc.frequency.linearRampToValueAtTime(slideTo, t0 + durationMs / 1000)
  gain.gain.setValueAtTime(volume, t0)
  gain.gain.setValueAtTime(volume, t0 + durationMs / 1000 - 0.01)
  gain.gain.linearRampToValueAtTime(0.0001, t0 + durationMs / 1000)
  osc.connect(gain).connect(ac.destination)
  osc.start(t0)
  osc.stop(t0 + durationMs / 1000 + 0.02)
}

// Public cues -------------------------------------------------------------

export function playStart() {
  // little rising "power on" jingle
  beep(392, 80)          // G
  beep(523, 80, { delayMs: 90 })  // C
  beep(659, 120, { delayMs: 180 }) // E
}

export function playEat() {
  beep(880, 45)
  beep(1320, 45, { delayMs: 45 })
}

export function playGameOver() {
  // descending sad buzz
  beep(440, 120, { slideTo: 330 })
  beep(330, 140, { delayMs: 130, slideTo: 220 })
  beep(196, 320, { delayMs: 280, slideTo: 110, volume: 0.06 })
}

export function playMenuSelect() {
  beep(1046, 40, { volume: 0.04 })
}

export function playMenuMove() {
  beep(700, 25, { volume: 0.03 })
}

export function playBack() {
  beep(520, 35, { volume: 0.035 })
  beep(390, 45, { delayMs: 40, volume: 0.035 })
}

export function playPause() {
  beep(660, 60)
  beep(660, 60, { delayMs: 100 })
}

/** Unlock audio on first user gesture (call from a click/keydown handler). */
export function unlockAudio() {
  ensureCtx()
}
