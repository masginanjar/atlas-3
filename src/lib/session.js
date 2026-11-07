// ============================================================
//  SESI — keluar otomatis setelah 3 JAM TIDAK AKTIF
//  • Hitungannya dari aktivitas terakhir (klik, ketik, scroll),
//    BUKAN dari jam login. Selama dipakai, sesi tidak akan putus.
//  • Heartbeat / polling / refresh data otomatis TIDAK dihitung
//    sebagai aktivitas — hanya interaksi nyata dari pengguna.
//  • Antar tab disamakan lewat localStorage: aktif di satu tab
//    membuat tab lain ikut aman, dan keluar di satu tab membuat
//    tab lain ikut keluar.
// ============================================================
export const IDLE_MS = 3 * 60 * 60 * 1000 // 3 jam
export const WARN_MS = 5 * 60 * 1000 // peringatan 5 menit sebelum keluar
const K_ACT = 'atlas-last-activity'
const K_OUT = 'atlas-signed-out'
const K_IDLE = 'atlas-idle-logout'
const WRITE_GAP = 15000 // tulis ke localStorage paling sering tiap 15 detik

const now = () => Date.now()
const read = (k) => { try { return localStorage.getItem(k) } catch { return null } }
const write = (k, v) => { try { localStorage.setItem(k, v) } catch { /* abaikan */ } }

export const lastActivity = () => Number(read(K_ACT)) || 0
export const markActivity = (t = now()) => write(K_ACT, String(t))
/** Tandai bahwa keluarnya karena idle → halaman login menampilkan alasannya. */
export const setIdleReason = () => write(K_IDLE, String(now()))
export const takeIdleReason = () => { const v = read(K_IDLE); if (v) { try { localStorage.removeItem(K_IDLE) } catch { /* abaikan */ } } return !!v }
/** Beri tahu tab lain bahwa sesi berakhir. */
export const broadcastSignOut = () => write(K_OUT, String(now()))

// --- tujuan terakhir sebelum sesi putus, supaya setelah masuk kembali ke sana ---
const K_TUJUAN = 'atlas-tujuan'
/** Simpan halaman yang sedang dibuka saat sesi berakhir. */
export const simpanTujuan = () => {
  const h = (window.location.hash || '').replace(/^#\/?/, '')
  if (h && !/^(login|dashboard)$/.test(h)) write(K_TUJUAN, h)
}
/** Ambil (sekali) tujuan terakhir. Kosong bila tidak ada. */
export const ambilTujuan = () => {
  const v = read(K_TUJUAN)
  if (v) { try { localStorage.removeItem(K_TUJUAN) } catch { /* abaikan */ } }
  return v || ''
}

/**
 * Pantau idle. Memanggil onWarn(sisaDetik) saat masuk 5 menit terakhir,
 * onSafe() saat pengguna kembali aktif, dan onExpire() saat 3 jam terlewati.
 * Mengembalikan fungsi pembersih + extend() untuk tombol "Lanjutkan Sesi".
 */
export function watchIdle({ onWarn, onSafe, onExpire, onSignOutElsewhere }) {
  if (!lastActivity()) markActivity()
  let lastWrite = lastActivity()
  let warned = false
  let stopped = false

  const bump = () => {
    const t = now()
    if (t - lastWrite < WRITE_GAP && !warned) return // hemat tulis, kecuali sedang diperingatkan
    lastWrite = t; markActivity(t)
    if (warned) { warned = false; onSafe?.() }
  }
  const EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll']
  EVENTS.forEach((e) => window.addEventListener(e, bump, { passive: true, capture: true }))

  const tick = () => {
    if (stopped) return
    const idle = now() - lastActivity()
    if (idle >= IDLE_MS) { stopped = true; onExpire?.(); return }
    if (idle >= IDLE_MS - WARN_MS) { warned = true; onWarn?.(Math.max(0, Math.round((IDLE_MS - idle) / 1000))) }
    else if (warned) { warned = false; onSafe?.() }
  }
  const timer = setInterval(tick, 5000)
  tick()

  // Tab lain: aktivitas baru → aman kembali; keluar → ikut keluar
  const onStorage = (e) => {
    if (e.key === K_ACT) { lastWrite = lastActivity(); tick() }
    if (e.key === K_OUT && e.newValue) onSignOutElsewhere?.()
  }
  window.addEventListener('storage', onStorage)

  return {
    extend: () => { lastWrite = now(); markActivity(lastWrite); warned = false; onSafe?.() },
    stop: () => { stopped = true; clearInterval(timer); window.removeEventListener('storage', onStorage); EVENTS.forEach((e) => window.removeEventListener(e, bump, { capture: true })) },
  }
}
