// ============================================================
//  SIAPA BOLEH LIHAT MENU APA.
//  Dipisah dari halamannya supaya App.jsx tidak perlu memuat
//  seluruh halaman hanya untuk mengecek hak akses — halaman berat
//  baru diunduh saat menunya benar-benar dibuka.
// ============================================================
import { WORKER_ROLES } from './access.js'

const APOSTILLE_ROLES = ['staf_apostille', 'supervisor', 'superadmin', 'direktur', 'admin_pusat']
export const canSeeApostille = (u) => APOSTILLE_ROLES.includes(u?.role) || (u?.extra_roles || []).some((r) => APOSTILLE_ROLES.includes(r))
export const canSeeAllActivity = (u) => ['superadmin', 'direktur'].includes(u?.role)
export const canMonitor = (u) => u?.role === 'superadmin'
export const canSeeKeuangan = (u) => !!u && !WORKER_ROLES.includes(u.role)
/** Menu Faktur & badge pembayaran: pelaksana tidak perlu. */
export const canSeeInvoices = (u) => !WORKER_ROLES.includes(u?.role)
export const canSeePayment = (u) => !WORKER_ROLES.includes(u?.role)
/** Boleh memutuskan pengajuan (ACC Direktur, transfer Akunting). */
export const isApprover = (u) => ['direktur', 'akunting', 'superadmin'].includes(u?.role)
