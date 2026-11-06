import { tanggal, tanggalJam } from './waktu.js'
export const rupiah = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID')
// Penulisan baku: "Sel 3 Nov 08.13" — hari singkat, tanggal, bulan singkat,
// jam memakai titik. Satu sumber untuk seluruh aplikasi (lihat lib/waktu.js).
export const tgl = (iso) => tanggal(iso)
export const jam = (iso) => tanggalJam(iso)
export const daysLeft = (iso) => iso ? Math.ceil((new Date(iso) - Date.now()) / 864e5) : null
export const kb = (b) => b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' KB'

// ---------- Waktu relatif: "12 detik lalu" · "5 menit lalu" · "3 jam lalu" · lewat 1 hari: "Sen 7 Nov 13.33" ----------
const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
export function relTime(iso, now = Date.now()) {
  if (!iso) return ''
  const t = new Date(iso); const s = Math.max(0, Math.floor((now - t.getTime()) / 1000))
  if (s < 60) return `${s} detik lalu`
  if (s < 3600) return `${Math.floor(s / 60)} menit lalu`
  if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`
  const w = new Date(t.getTime() + 8 * 3600e3) // WITA
  const noTime = String(iso).length <= 10 || (w.getUTCHours() === 0 && w.getUTCMinutes() === 0 && w.getUTCSeconds() === 0) // data lama: hanya tanggal
  return `${HARI[w.getUTCDay()]} ${w.getUTCDate()} ${BLN[w.getUTCMonth()]}${noTime ? '' : ` ${String(w.getUTCHours()).padStart(2, '0')}.${String(w.getUTCMinutes()).padStart(2, '0')}`}`
}
/** Waktu sub project masuk ke tahap saat ini (entri riwayat terakhir yang memindahkan tahap), cadangan: waktu dibuat. */
export function stageArrivedAt(sub, project) {
  if (sub?.stage_at) return sub.stage_at
  const h = [...(sub?.history || [])].reverse().find((x) => /→/.test(x.action || '') || /ditetapkan|Dibuat|Diserahkan|Order ke/i.test(x.action || ''))
  return h?.at || project?.created_at || null
}
