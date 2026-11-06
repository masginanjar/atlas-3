// ============================================================
//  PENULISAN TANGGAL & JAM
//  Format baku: "Sel 3 Nov 08.13" — hari singkat, tanggal, bulan
//  singkat, jam memakai titik (kebiasaan penulisan Indonesia).
//  Tahun hanya ditulis bila bukan tahun berjalan.
// ============================================================
const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

const d2 = (n) => String(n).padStart(2, '0')
const toDate = (v) => { const t = v instanceof Date ? v : new Date(v); return Number.isNaN(t.getTime()) ? null : t }

/** "Sel 3 Nov" — tanpa jam. Tahun ikut bila beda dari tahun ini. */
export function tanggal(v) {
  const t = toDate(v); if (!t) return '—'
  const th = t.getFullYear() !== new Date().getFullYear() ? ` ${t.getFullYear()}` : ''
  return `${HARI[t.getDay()]} ${t.getDate()} ${BULAN[t.getMonth()]}${th}`
}

/** "08.13" */
export const jam = (v) => { const t = toDate(v); return t ? `${d2(t.getHours())}.${d2(t.getMinutes())}` : '—' }

/** "Sel 3 Nov 08.13" — bentuk baku untuk stempel waktu. */
export function tanggalJam(v) {
  const t = toDate(v); if (!t) return '—'
  return `${tanggal(t)} ${jam(t)}`
}

// ---- Dua zona waktu ------------------------------------------------------
// Kantor pusat di Bali (WITA), tapi sebagian besar cabang di WIB. Keduanya
// ditampilkan supaya tidak perlu menghitung selisih sendiri saat menelepon
// atau menjanjikan deadline.
export const ZONA = [
  { kode: 'WIB', tz: 'Asia/Jakarta' },
  { kode: 'WITA', tz: 'Asia/Makassar' },
]

/** Jam "08.13" pada zona tertentu. */
export function jamDi(tz, v = new Date()) {
  const t = toDate(v); if (!t) return '—'
  const [h, m] = new Intl.DateTimeFormat('id-ID', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false })
    .format(t).split(/[.:]/)
  return `${d2(Number(h) % 24)}.${d2(Number(m))}`
}

/** [{kode:'WIB', jam:'21.46'}, {kode:'WITA', jam:'22.46'}] */
export const jamDuaZona = (v = new Date()) => ZONA.map(({ kode, tz }) => ({ kode, jam: jamDi(tz, v) }))
