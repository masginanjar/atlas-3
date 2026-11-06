// ============================================================
//  TIM AKTIF — status online / idle / offline
//  Sumbernya data nyata: tiap tab yang terbuka memperbarui dua
//  kolom di baris user-nya sendiri —
//    online_until   : sampai kapan tab ini menyatakan tersambung
//    last_active_at : interaksi nyata terakhir (klik/ketik/scroll)
//  Tidak ada status yang dikarang: kalau tab ditutup, online_until
//  lewat dengan sendirinya dan orangnya jadi Offline.
// ============================================================
import { lastActivity } from './session.js'

export const BEAT_MS = 60 * 1000 // denyut tiap 1 menit
export const ONLINE_GRACE = 150 * 1000 // dianggap tersambung 2,5 menit sejak denyut terakhir
export const IDLE_AFTER = 15 * 60 * 1000 // 15 menit tanpa interaksi → Idle

const ms = (v) => (v ? new Date(v).getTime() : 0)

/** Direktur ditampilkan tersedia terus — bisa dimatikan sendiri di Setting → Preferensi. */
export const always24h = (u) => (u?.base_role || u?.role) === 'direktur' && u?.available_24h !== false

/** 'online' | 'idle' | 'offline' — dari dua kolom di atas; Direktur selalu 'online'. */
export function statusOf(u, now = Date.now()) {
  if (always24h(u)) return 'online'
  if (ms(u?.online_until) < now) return 'offline'
  return now - ms(u?.last_active_at) > IDLE_AFTER ? 'idle' : 'online'
}

export const STATUS = {
  online: { label: 'Online', dot: 'bg-emerald-500', text: 'text-emerald-700', ring: 'ring-emerald-200', soft: 'bg-emerald-50' },
  idle: { label: 'Idle', dot: 'bg-amber-400', text: 'text-amber-700', ring: 'ring-amber-200', soft: 'bg-amber-50' },
  offline: { label: 'Offline', dot: 'bg-slate-300', text: 'text-ink-mute', ring: 'ring-slate-200', soft: 'bg-slate-50' },
}

/** "baru saja" / "12 menit lalu" / "2 jam lalu" */
export function sinceLabel(v, now = Date.now()) {
  const t = ms(v); if (!t) return 'belum ada aktivitas'
  const m = Math.floor((now - t) / 60000)
  if (m < 1) return 'baru saja'
  if (m < 60) return `${m} menit lalu`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} jam lalu`
  return `${Math.floor(h / 24)} hari lalu`
}

/**
 * Denyut kehadiran. Menulis ke baris user sendiri tiap 1 menit selama tab terbuka.
 * onRow dipanggil dengan baris terbaru supaya tampilan ikut segar tanpa menunggu refresh.
 */
export function startHeartbeat(db, userId, onRow) {
  let alive = true
  const beat = async () => {
    if (!alive) return
    try {
      const row = await db.update('users', userId, {
        online_until: new Date(Date.now() + ONLINE_GRACE).toISOString(),
        last_active_at: new Date(lastActivity() || Date.now()).toISOString(),
      })
      if (alive && row) onRow?.(row)
    } catch { /* kehadiran tidak krusial — abaikan bila gagal */ }
  }
  beat()
  // denyut kedua setelah muat awal selesai, supaya baris sendiri tidak tertimpa refresh pertama
  const warm = setTimeout(beat, 3000)
  const timer = setInterval(beat, BEAT_MS)
  return {
    stop: async (clear = false) => {
      alive = false; clearInterval(timer); clearTimeout(warm)
      if (clear) { try { await db.update('users', userId, { online_until: null }) } catch { /* abaikan */ } }
    },
  }
}
