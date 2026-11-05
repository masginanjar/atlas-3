// ============================================================
//  SUARA NOTIFIKASI — disintesis dengan WebAudio (tanpa file audio).
//  - cashRegister(): "cha-ching" mesin kasir untuk pembayaran berhasil
//  - ping(): bunyi "ping" pendek dua nada (ala BBM) untuk Ping antar-role
//  Browser hanya mengizinkan audio setelah interaksi pengguna; kegagalan diabaikan.
// ============================================================
const KEY = 'atlas-sound'
export const soundEnabled = () => { try { return localStorage.getItem(KEY) !== '0' } catch { return true } }
export const setSoundEnabled = (on) => { try { localStorage.setItem(KEY, on ? '1' : '0') } catch { /* abaikan */ } }

let ctx
const ac = () => { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ctx ||= new AC(); if (ctx.state === 'suspended') ctx.resume().catch(() => {}); return ctx }

const tone = (c, { f = 880, t0 = 0, dur = 0.12, type = 'sine', gain = 0.18, slide }) => {
  const o = c.createOscillator(); const g = c.createGain()
  o.type = type; o.frequency.setValueAtTime(f, c.currentTime + t0)
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, c.currentTime + t0 + dur)
  g.gain.setValueAtTime(0.0001, c.currentTime + t0)
  g.gain.exponentialRampToValueAtTime(gain, c.currentTime + t0 + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + t0 + dur)
  o.connect(g).connect(c.destination); o.start(c.currentTime + t0); o.stop(c.currentTime + t0 + dur + 0.02)
}
const noise = (c, { t0 = 0, dur = 0.08, gain = 0.08 }) => {
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate); const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length)
  const s = c.createBufferSource(); s.buffer = buf; const g = c.createGain(); g.gain.value = gain
  const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000
  s.connect(hp).connect(g).connect(c.destination); s.start(c.currentTime + t0)
}

/** "Cha-ching": dentang bel kasir + laci terbuka. */
export function cashRegister() {
  if (!soundEnabled()) return
  try {
    const c = ac(); if (!c) return
    noise(c, { t0: 0, dur: 0.06, gain: 0.06 })               // klik tuas
    tone(c, { f: 2093, t0: 0.05, dur: 0.35, gain: 0.16 })     // bel 1 (C7)
    tone(c, { f: 2637, t0: 0.05, dur: 0.35, gain: 0.10 })     // harmonik
    tone(c, { f: 2349, t0: 0.22, dur: 0.45, gain: 0.16 })     // bel 2 (D7)
    tone(c, { f: 3136, t0: 0.22, dur: 0.45, gain: 0.08 })
    noise(c, { t0: 0.45, dur: 0.12, gain: 0.05 })             // laci terbuka
    tone(c, { f: 180, t0: 0.46, dur: 0.1, type: 'triangle', gain: 0.08, slide: 90 })
  } catch { /* abaikan */ }
}

/** "Ping" dua nada pendek, nada kedua lebih tinggi. */
export function ping() {
  if (!soundEnabled()) return
  try {
    const c = ac(); if (!c) return
    tone(c, { f: 1319, t0: 0, dur: 0.11, type: 'triangle', gain: 0.2 })
    tone(c, { f: 1760, t0: 0.13, dur: 0.22, type: 'triangle', gain: 0.2 })
    tone(c, { f: 3520, t0: 0.13, dur: 0.22, type: 'sine', gain: 0.05 })
  } catch { /* abaikan */ }
}

/** "Perlu penerjemah": tiga nada naik (lonceng pimpinan) — berbeda dari kasir & ping. */
export function needTranslator() {
  if (!soundEnabled()) return
  try {
    const c = ac(); if (!c) return
    tone(c, { f: 784, t0: 0, dur: 0.16, type: 'triangle', gain: 0.18 })      // G5
    tone(c, { f: 988, t0: 0.15, dur: 0.16, type: 'triangle', gain: 0.18 })   // B5
    tone(c, { f: 1319, t0: 0.30, dur: 0.38, type: 'triangle', gain: 0.2 })   // E6
    tone(c, { f: 2637, t0: 0.30, dur: 0.38, type: 'sine', gain: 0.05 })
  } catch { /* abaikan */ }
}

// alias nama (dipakai komponen lonceng)
export const playCashRegister = cashRegister
export const playPing = ping
export const playNeedTranslator = needTranslator
