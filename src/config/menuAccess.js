// ============================================================
//  SIAPA BOLEH LIHAT MENU APA.
//  Dipisah dari halamannya supaya App.jsx tidak perlu memuat
//  seluruh halaman hanya untuk mengecek hak akses — halaman berat
//  baru diunduh saat menunya benar-benar dibuka.
// ============================================================
import { WORKER_ROLES, isFreelance } from './access.js'
import { fiturBoleh } from './rilis.js'

/**
 * Penerjemah, Proofreader, dan Otorisator bekerja pada dokumen saja —
 * menunya dipersempit supaya tidak penuh hal yang tidak mereka pakai.
 * "settings" tetap ada karena di situ mereka mengganti profil & kata sandi.
 */
export const MENU_PELAKSANA = ['dashboard', 'projects', 'register', 'otorisasi', 'agenda', 'calendar', 'reminders', 'notes', 'todo', 'settings']

/** Benar bila menu orang ini dipersempit (semua perannya pelaksana lepas). */
export const menuDipersempit = (u) => isFreelance(u)

/** Boleh membuka halaman ini? Dipakai menu DAN rute, supaya alamat langsung juga tertutup. */
export const menuBoleh = (u, key) =>
  (!menuDipersempit(u) || MENU_PELAKSANA.includes(key)) && fiturBoleh(u, key) // + saklar Rilis Fitur

const APOSTILLE_ROLES = ['staf_apostille', 'supervisor', 'superadmin', 'direktur', 'admin_pusat', 'helper']
export const canSeeApostille = (u) => APOSTILLE_ROLES.includes(u?.role) || (u?.extra_roles || []).some((r) => APOSTILLE_ROLES.includes(r))
export const canSeeAllActivity = (u) => ['superadmin', 'direktur'].includes(u?.role)
export const canMonitor = (u) => u?.role === 'superadmin'
/** Penugasan (kapasitas & bagi penerjemah): Superadmin & Direktur. */
export const canSeePenugasan = (u) => ['superadmin', 'supervisor'].includes(u?.role)
/** Daftar pelanggan: hanya Superadmin. */
export const canSeePelanggan = (u) => u?.role === 'superadmin'
/** Katalog layanan & data vendor — pengaturan tingkat perusahaan, khusus Superadmin. */
export const canSeeKatalog = (u) => u?.role === 'superadmin'
export const canSeeVendor = (u) => u?.role === 'superadmin'
// Mitra: Superadmin & Direktur semua cabang, CS hanya cabangnya sendiri.
export const canSeeMitra = (u) => ['superadmin', 'direktur', 'cs'].includes(u?.role)
export const canSeeKeuangan = (u) => !!u && !WORKER_ROLES.includes(u.role)
/** Menu Faktur & badge pembayaran: pelaksana tidak perlu. */
export const canSeeInvoices = (u) => !WORKER_ROLES.includes(u?.role)
export const canSeePayment = (u) => !WORKER_ROLES.includes(u?.role)
/**
 * Tracking Affidavit: yang mencetak (CS, Helper, cabang) dan yang memantau
 * (pusat, Direktur, Direktur, Akunting). Penerjemah/Proofreader/Otorisator
 * tidak mencetak lembar, jadi menunya tidak perlu muncul.
 */
export const canSeeAffidavit = (u) => !!u && !WORKER_ROLES.includes(u.role)
/** Boleh memutuskan pengajuan (ACC Direktur, transfer Akunting). */
export const isApprover = (u) => ['direktur', 'akunting', 'superadmin'].includes(u?.role)
/** Beranda (info ringan): semua staf kantor; Penerjemah, Proofreader, Otorisator tidak. */
export const canSeeBeranda = (u) => !!u && !['penerjemah', 'proofreader', 'otorisator'].includes(u.role)

/** Nomor Register: Admin Pusat (terbitkan), pimpinan, dan otorisator (Pak Arifin menginput ke sistemnya). */
export const canSeeRegister = (u) => ['superadmin', 'direktur', 'supervisor', 'admin_pusat', 'otorisator'].includes(u?.role)

/** Laporan Otorisasi: Superadmin, Direktur, Admin Pusat (semua), otorisator (miliknya). */
export const canSeeLaporanOto = (u) => ['superadmin', 'direktur', 'admin_pusat', 'otorisator'].includes(u?.role) || (u?.extra_roles || []).includes('otorisator')
