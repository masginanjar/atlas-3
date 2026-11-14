// Zona waktu tiap cabang (Indonesia): Bali & Makassar = WITA (UTC+8), cabang lain = WIB (UTC+7).
export const ZONA_CABANG = {
  Bali: 'Asia/Makassar', Makassar: 'Asia/Makassar',
  Jakarta: 'Asia/Jakarta', Semarang: 'Asia/Jakarta', Surabaya: 'Asia/Jakarta', Bandung: 'Asia/Jakarta',
  Yogyakarta: 'Asia/Jakarta', Medan: 'Asia/Jakarta', Batam: 'Asia/Jakarta',
}
const LABEL = { 'Asia/Makassar': 'WITA (Asia/Makassar)', 'Asia/Jakarta': 'WIB (Asia/Jakarta)', 'Asia/Jayapura': 'WIT (Asia/Jayapura)' }
/** Zona waktu seorang pengguna menurut cabangnya; tanpa cabang (mis. freelance) → WITA kantor pusat. */
export function zonaPengguna(u) {
  const cab = [u?.branch, ...(Array.isArray(u?.branches) ? u.branches : [])].filter(Boolean)
  const zona = [...new Set(cab.map((c) => ZONA_CABANG[c]).filter(Boolean))]
  if (!zona.length) return { tz: 'Asia/Makassar', label: 'WITA (Asia/Makassar) · kantor pusat' }
  if (zona.length > 1) return { tz: zona[0], label: zona.map((z) => LABEL[z].split(' ')[0]).join(' / ') + ' (beberapa cabang)' }
  return { tz: zona[0], label: LABEL[zona[0]] || zona[0] }
}

/** Dua jam di menu: kantor pusat (BALI) + kota cabang pengguna.
 *  Tanpa cabang / cabangnya Bali → kota cabang yang dipilih di filter, kalau tidak ada → Jakarta (WIB). */
export function jamKantor(user, branchFilter) {
  const cab = [user?.branch, ...(Array.isArray(user?.branches) ? user.branches : [])].filter((c) => c && ZONA_CABANG[c])
  const kota = cab.find((c) => c !== 'Bali') || (branchFilter && branchFilter !== 'Semua' && branchFilter !== 'Bali' && ZONA_CABANG[branchFilter] ? branchFilter : 'Jakarta')
  return [{ label: 'Bali', tz: 'Asia/Makassar' }, { label: kota, tz: ZONA_CABANG[kota] || 'Asia/Jakarta' }]
}
