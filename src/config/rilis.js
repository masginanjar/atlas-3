// ============================================================
//  RILIS FITUR BERTAHAP — saklar per menu (khusus Superadmin).
//  Disimpan di app_settings key 'rilis_fitur'. Status tiap menu:
//    tersembunyi · uji (hanya penguji terpilih) · aktif (semua yang berhak).
//  Superadmin & Direktur selalu melihat semua fitur untuk mengecek.
//  Dipakai menuBoleh() → berlaku untuk menu DAN alamat langsung.
//  Data tetap dijaga di server (RLS); saklar ini mengatur tampilan.
// ============================================================

/** Menu yang bisa diatur, dikelompokkan per tahap rilis yang direncanakan. */
export const FITUR = [
  { key: 'projects', label: 'Project', tahap: 1, ket: 'Daftar & proses project (termasuk Apostille)' },
  { key: 'keuangan', label: 'Keuangan', tahap: 1, ket: 'Pengajuan & statusnya' },
  { key: 'otorisasi', label: 'Laporan Otorisasi', tahap: 1, ket: 'Rekap bulanan otorisator, unduh PDF/Excel' },
  { key: 'register', label: 'Nomor Register', tahap: 1, ket: 'Admin Pusat menerbitkan nomor; daftar untuk input Pak Arifin' },
  { key: 'dashboard', label: 'Dashboard', tahap: 1, ket: 'Beranda kerja penerjemah / pelaksana' },
  { key: 'jadwal', label: 'Jadwal', tahap: 2, ket: 'Shift Bali, Jakarta, Semarang & cuti' },
  { key: 'pesan', label: 'Pesan Masuk', tahap: 2 },
  { key: 'agenda', label: 'Agenda', tahap: 2, ket: 'Pengingat, tugas, kalender' },
  { key: 'notes', label: 'Catatan', tahap: 2 },
  { key: 'faq', label: 'FAQ', tahap: 2 },
  { key: 'dokumen', label: 'Dokumen', tahap: 3 },
  { key: 'faktur', label: 'Faktur', tahap: 3 },
  { key: 'pelanggan', label: 'Pelanggan', tahap: 3 },
  { key: 'daftar-harga', label: 'Katalog', tahap: 3 },
  { key: 'vendor', label: 'Vendor', tahap: 3 },
  { key: 'mitra', label: 'Mitra', tahap: 3 },
  { key: 'penugasan', label: 'Penugasan', tahap: 3 },
  { key: 'affidavit', label: 'Affidavit', tahap: 3 },
  { key: 'beranda', label: 'Beranda', tahap: 4, ket: 'Sapaan, jadwal sholat, info ringan' },
  { key: 'perusahaan', label: 'Perusahaan', tahap: 4 },
]
export const STATUS_FITUR = [['tersembunyi', 'Tersembunyi'], ['uji', 'Uji coba'], ['aktif', 'Aktif']]

/** Halaman turunan ikut saklar menu induknya. */
const INDUK = { apostille: 'projects', 'k-koordinator': 'projects', 'k-apostille': 'projects', 'k-penugasan': 'projects', 'k-titip': 'projects', pengajuan: 'keuangan', reminders: 'agenda', todo: 'agenda', calendar: 'agenda' }
const DIATUR = new Set(FITUR.map((f) => f.key))
const PEMERIKSA = ['superadmin', 'direktur']

/** Rencana per tahap: fitur tahap ≤ n aktif, sisanya tersembunyi. */
export const rencanaTahap = (n) => Object.fromEntries(FITUR.map((f) => [f.key, f.tahap <= n ? 'aktif' : 'tersembunyi']))

// Pengaturan terkini — diisi App setiap render (satu sumber untuk menu & rute).
let cfg = null
export function pasangRilis(appSettings) { cfg = (appSettings || []).find((r) => r.key === 'rilis_fitur') || null }
export const bacaRilis = (appSettings) => (appSettings || []).find((r) => r.key === 'rilis_fitur') || null

const pemeriksa = (u) => PEMERIKSA.includes(u?.base_role || u?.role) || PEMERIKSA.includes(u?.role)
const idAsli = (u) => u?._actor || u?.id

/** Fitur ini terlihat untuk orang ini? Tanpa pengaturan / rilis tidak aktif → semua seperti biasa. */
export function fiturBoleh(u, key, c = cfg) {
  if (!c?.aktif || pemeriksa(u)) return true
  const k = INDUK[key] || key
  if (!DIATUR.has(k)) return true
  const st = c.fitur?.[k] || 'tersembunyi'
  if (st === 'aktif') return true
  if (st === 'uji') return (c.penguji || []).includes(idAsli(u))
  return false
}

/** Tim dikunci di Mode Klasik? (Superadmin & Direktur tetap bebas memilih.) */
export const kunciKlasik = (u, c = cfg) => !!(c?.aktif && c?.kunci_klasik && !pemeriksa(u))
