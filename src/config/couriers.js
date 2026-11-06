// ============================================================
//  DAFTAR EKSPEDISI BAWAAN
//  Dipakai oleh data contoh (seed) dan oleh migrasi data lama,
//  supaya tidak ada kurir yang terdaftar dua kali.
//  Pencocokan memakai nama yang sudah dirapikan (huruf kecil,
//  spasi dirapatkan) — jadi "J&T" dan "j&t " dianggap sama.
//  Pengelola tetap bisa menambah/mengubah lewat Setting → Kurir.
// ============================================================

/** Nama kurir yang disamakan untuk pembanding. */
export const courierKey = (name) => String(name ?? '').trim().toLowerCase().replace(/\s+/g, ' ')

/** Ekspedisi yang harus selalu tersedia. Urutan = urutan tampil. */
export const DEFAULT_COURIERS = [
  // Bukan ekspedisi — jenisnya khusus, jangan diubah jadi 'courier'.
  { name: 'Softcopy Saja', type: 'softcopy', icon: 'file', color: '#64748b' },
  { name: 'Diambil di Kantor', type: 'pickup', icon: 'store', color: '#1f4fd1' },
  { name: 'Dikirim dari Penerjemah', type: 'vendor', icon: 'send', color: '#7c3aed' },
  // Kurir instan
  { name: 'Gojek', type: 'courier', icon: 'bike', color: '#00a651' },
  { name: 'Grab', type: 'courier', icon: 'bike', color: '#00b14f' },
  // Ekspedisi dalam negeri
  { name: 'J&T', type: 'courier', icon: 'truck', color: '#d71920' },
  { name: 'JNE', type: 'courier', icon: 'package', color: '#1b3d8f' },
  { name: 'SiCepat', type: 'courier', icon: 'truck', color: '#e4002b' },
  { name: 'TIKI', type: 'courier', icon: 'package', color: '#004b93' },
  { name: 'AnterAja', type: 'courier', icon: 'truck', color: '#00a0e3' },
  { name: 'Ninja Xpress', type: 'courier', icon: 'truck', color: '#d6002d' },
  { name: 'ID Express', type: 'courier', icon: 'truck', color: '#e3002b' },
  { name: 'SAP Express', type: 'courier', icon: 'package', color: '#0b4ea2' },
  { name: 'Wahana Express', type: 'courier', icon: 'truck', color: '#f05a28' },
  { name: 'Lion Parcel', type: 'courier', icon: 'package', color: '#d9232e' },
  { name: 'Paxel', type: 'courier', icon: 'bike', color: '#f26122' },
  { name: 'POS Indonesia', type: 'courier', icon: 'package', color: '#f58220' },
  { name: 'JET Express', type: 'courier', icon: 'truck', color: '#e11b22' },
  { name: 'RPX', type: 'courier', icon: 'package', color: '#003a70' },
  // Ekspedisi internasional
  { name: 'DHL', type: 'courier', icon: 'truck', color: '#d40511' },
  { name: 'FedEx', type: 'courier', icon: 'truck', color: '#4d148c' },
  { name: 'UPS', type: 'courier', icon: 'truck', color: '#351c15' },
  { name: 'EMS (Pos Internasional)', type: 'courier', icon: 'package', color: '#f58220' },
]

/**
 * Tambahkan kurir bawaan yang belum ada ke daftar `list`.
 * Yang sudah ada TIDAK disentuh — nama, jenis, logo, dan urutannya
 * tetap seperti yang diatur pengelola.
 * @returns {boolean} true bila ada yang ditambahkan.
 */
export function ensureDefaultCouriers(list, makeId) {
  const ada = new Set(list.map((c) => courierKey(c.name)))
  let urut = list.reduce((max, c) => Math.max(max, Number(c.order) || 0), 0)
  let changed = false
  for (const d of DEFAULT_COURIERS) {
    if (ada.has(courierKey(d.name))) continue
    urut += 1
    list.push({ id: makeId(), ...d, logo: '', order: urut, created_at: new Date().toISOString() })
    ada.add(courierKey(d.name))
    changed = true
  }
  return changed
}
