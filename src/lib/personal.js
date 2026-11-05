// Helper data pribadi (catatan) — dipakai halaman Notes, pencarian, dan panel project.
import { scopeByBranch } from '../config/access.js'
import { isIncomingPrint } from './performance.js'

/** Catatan milik user (pribadi) + yang dibagikan khusus ke dia. */
export const myNotes = (data, user) => (data.notes || []).filter((n) => n.owner_id === user.id || (n.shared_with || []).includes(user.id))

/** Catatan yang datang dari project: pesan pelanggan/CS dan titipan print dari cabang lain. */
export function projectNotes(user, data, branchFilter) {
  const out = []
  for (const p of scopeByBranch(user, data.projects, branchFilter)) {
    if (p.about?.notes?.trim()) out.push({ id: `n${p.id}`, kind: 'pelanggan', project: p, text: p.about.notes.trim() })
    if (isIncomingPrint(user, p)) out.push({ id: `p${p.id}`, kind: 'print', project: p, text: `Titipan print dari cabang ${p.branch} — dicetak di ${p.about.print_location}.${p.about?.courier ? '' : ' Kurir belum dipilih.'}` })
  }
  return out
}
