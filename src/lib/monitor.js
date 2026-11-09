// ============================================================
//  PEMANTAUAN — riwayat cek koneksi & error yang BENAR-BENAR terjadi
//  di perangkat ini (localStorage, maks 600 entri). Tidak ada data
//  karangan: kosong = belum ada kejadian tercatat.
//  LIVE: sebaiknya juga dikirim ke tabel server_monitor (RLS: insert
//  semua pengguna terautentikasi, select hanya superadmin).
// ============================================================
const KEY = 'atlas-monitor-v1'
const MAX = 600
const subs = new Set()

export function bacaMonitor() { try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] } }
export function catatMonitor(e) {
  try {
    const list = bacaMonitor(); list.push({ at: new Date().toISOString(), ...e })
    localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)))
  } catch { /* penyimpanan penuh — abaikan */ }
  subs.forEach((f) => f())
}
export const dengarMonitor = (f) => { subs.add(f); return () => subs.delete(f) }

/** Kelompokkan penyebab error: koneksi Atlas · izin ditolak · layanan · aplikasi. */
export function jenisError(e) {
  const pesan = String(e?.message || e || '')
  const status = Number(e?.status || e?.statusCode || 0)
  if (e?.code === '42501' || status === 401 || status === 403 || /permission|row-level|not allowed|izin|unauthori[sz]ed|forbidden|JWT/i.test(pesan)) return 'izin'
  if (status >= 500 || /service unavailable|bad gateway|timeout|timed out|upstream/i.test(pesan)) return 'layanan'
  if (e instanceof TypeError || /failed to fetch|networkerror|load failed|network request failed|offline/i.test(pesan)) return 'koneksi'
  return 'aplikasi'
}
export const LABEL_ERROR = { izin: 'Izin ditolak', layanan: 'Layanan Supabase', koneksi: 'Koneksi Atlas', aplikasi: 'Kesalahan aplikasi' }

let terpasang = false
/** Tangkap error yang tidak tertangani di browser (sekali saja). */
export function pasangPenangkapError() {
  if (terpasang || typeof window === 'undefined') return
  terpasang = true
  window.addEventListener('unhandledrejection', (ev) => {
    const r = ev.reason
    catatMonitor({ jenis: 'error', sumber: 'browser', kelas: jenisError(r), pesan: String(r?.message || r).slice(0, 200) })
  })
  window.addEventListener('error', (ev) => {
    if (!ev.message || /ResizeObserver/.test(ev.message)) return
    catatMonitor({ jenis: 'error', sumber: 'browser', kelas: 'aplikasi', pesan: String(ev.message).slice(0, 200) })
  })
}
