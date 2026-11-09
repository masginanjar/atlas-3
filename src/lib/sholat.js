// ============================================================
//  JADWAL SHOLAT — dihitung di peramban (tanpa internet) dengan
//  rumus astronomi standar; parameter mengikuti Kemenag RI:
//  Subuh 20°, Isya 18°, Ashar madzhab Syafi'i, ihtiyat +2 menit.
//  Selisih dengan jadwal resmi biasanya ≤ 1–2 menit.
// ============================================================

/** Koordinat kota per cabang + zona waktunya. */
export const KOTA = {
  Bali: { nama: 'Denpasar', lat: -8.65, lng: 115.22, tz: 8, zona: 'WITA' },
  Makassar: { nama: 'Makassar', lat: -5.15, lng: 119.43, tz: 8, zona: 'WITA' },
  Jakarta: { nama: 'Jakarta', lat: -6.2, lng: 106.85, tz: 7, zona: 'WIB' },
  Surabaya: { nama: 'Surabaya', lat: -7.25, lng: 112.75, tz: 7, zona: 'WIB' },
  Semarang: { nama: 'Semarang', lat: -6.97, lng: 110.42, tz: 7, zona: 'WIB' },
  Bandung: { nama: 'Bandung', lat: -6.91, lng: 107.61, tz: 7, zona: 'WIB' },
  Yogyakarta: { nama: 'Yogyakarta', lat: -7.8, lng: 110.37, tz: 7, zona: 'WIB' },
  Medan: { nama: 'Medan', lat: 3.59, lng: 98.67, tz: 7, zona: 'WIB' },
  Batam: { nama: 'Batam', lat: 1.08, lng: 104.03, tz: 7, zona: 'WIB' },
}
export const DAFTAR_KOTA = Object.keys(KOTA)

const rad = (d) => (d * Math.PI) / 180
const deg = (r) => (r * 180) / Math.PI
const fix = (a, b) => { a -= b * Math.floor(a / b); return a < 0 ? a + b : a }

/** Tanggal (Y, M, D) → Julian Day. */
function julian(y, m, d) {
  if (m <= 2) { y -= 1; m += 12 }
  const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4)
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5
}

/** Deklinasi matahari & persamaan waktu (jam) untuk JD tertentu. */
function matahari(jd) {
  const D = jd - 2451545.0
  const g = fix(357.529 + 0.98560028 * D, 360)
  const q = fix(280.459 + 0.98564736 * D, 360)
  const L = fix(q + 1.915 * Math.sin(rad(g)) + 0.02 * Math.sin(rad(2 * g)), 360)
  const e = 23.439 - 0.00000036 * D
  const RA = deg(Math.atan2(Math.cos(rad(e)) * Math.sin(rad(L)), Math.cos(rad(L)))) / 15
  const decl = deg(Math.asin(Math.sin(rad(e)) * Math.sin(rad(L))))
  const eqt = q / 15 - fix(RA, 24)
  return { decl, eqt }
}

/**
 * Jadwal sholat satu hari untuk kota tertentu (jam desimal lokal).
 * @returns {{imsak,subuh,terbit,dzuhur,ashar,maghrib,isya}} dalam menit sejak 00.00
 */
export function hitungSholat(kota, tgl = new Date()) {
  const k = KOTA[kota] || KOTA.Bali
  const jd = julian(tgl.getFullYear(), tgl.getMonth() + 1, tgl.getDate()) - k.lng / (15 * 24)
  const { decl, eqt } = matahari(jd + 0.5)
  const noon = fix(12 - eqt, 24) // waktu transit (jam matahari lokal)
  const sudut = (a) => { // selisih jam dari transit untuk ketinggian matahari -a°
    const v = (-Math.sin(rad(a)) - Math.sin(rad(k.lat)) * Math.sin(rad(decl))) / (Math.cos(rad(k.lat)) * Math.cos(rad(decl)))
    return deg(Math.acos(Math.max(-1, Math.min(1, v)))) / 15
  }
  const asharA = -deg(Math.atan(1 / (1 + Math.tan(rad(Math.abs(k.lat - decl)))))) // Syafi'i: bayangan = 1× + bayangan saat transit
  const lokal = (h) => h + k.tz - k.lng / 15 // jam matahari → jam zona
  const t = {
    subuh: lokal(noon - sudut(20)) + 2 / 60,
    terbit: lokal(noon - sudut(0.833)) - 2 / 60,
    dzuhur: lokal(noon) + 3 / 60,
    ashar: lokal(noon + sudut(asharA)) + 2 / 60,
    maghrib: lokal(noon + sudut(0.833)) + 2 / 60,
    isya: lokal(noon + sudut(18)) + 2 / 60,
  }
  t.imsak = t.subuh - 10 / 60
  const menit = {}
  for (const [n, v] of Object.entries(t)) menit[n] = Math.round(fix(v, 24) * 60)
  return menit
}

export const URUT_SHOLAT = [
  ['subuh', 'Subuh'], ['dzuhur', 'Dzuhur'], ['ashar', 'Ashar'], ['maghrib', 'Maghrib'], ['isya', 'Isya'],
]

/** "04.42" dari menit sejak tengah malam. */
export const jamMenit = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}.${String(m % 60).padStart(2, '0')}`

/** Menit berjalan hari ini di zona kota (bukan zona perangkat). */
export function menitSekarang(kota, kini = new Date()) {
  const k = KOTA[kota] || KOTA.Bali
  const tz = k.tz === 8 ? 'Asia/Makassar' : 'Asia/Jakarta'
  const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(kini).split(':').map(Number)
  return (h % 24) * 60 + m
}

/** Sholat berikutnya + sisa menit; setelah Isya → Subuh besok. */
export function sholatBerikut(kota, kini = new Date()) {
  const j = hitungSholat(kota, kini)
  const skr = menitSekarang(kota, kini)
  for (const [key, label] of URUT_SHOLAT) if (j[key] > skr) return { key, label, menit: j[key], sisa: j[key] - skr }
  const besok = new Date(kini); besok.setDate(besok.getDate() + 1)
  const jb = hitungSholat(kota, besok)
  return { key: 'subuh', label: 'Subuh', menit: jb.subuh, sisa: 24 * 60 - skr + jb.subuh, besok: true, imsakBesok: jb.imsak }
}

/** "1 jam 32 mnt" */
export const sisaTeks = (m) => (m >= 60 ? `${Math.floor(m / 60)} jam ${m % 60 ? `${m % 60} mnt` : ''}`.trim() : `${m} mnt`)

/** Kota bawaan dari cabang user (freelance/tanpa cabang → Bali). */
export const kotaUser = (u) => (u?.branch && KOTA[u.branch] ? u.branch : 'Bali')
