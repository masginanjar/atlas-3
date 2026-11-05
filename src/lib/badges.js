// Hitungan kecil untuk angka di menu — dipisah agar tidak menarik halaman besar ke bundel awal.
import { scopeRequests } from '../components/Requests.jsx'
export { isApprover } from '../config/menuAccess.js'
import { isApprover } from '../config/menuAccess.js'

/** Jumlah pengajuan yang benar-benar menunggu TINDAKAN user ini. */
export function needsAction(user, data, branchFilter = 'Semua') {
  if (!isApprover(user)) return 0
  const rows = scopeRequests(user, data.requests || [], branchFilter)
  if (user.role === 'akunting') return rows.filter((r) => r.status === 'disetujui').length
  if (user.role === 'direktur') return rows.filter((r) => r.status === 'menunggu').length
  return rows.filter((r) => ['menunggu', 'disetujui'].includes(r.status)).length
}
