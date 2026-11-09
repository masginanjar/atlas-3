import { useEffect, useState } from 'react'
import { useApp } from '../lib/store.jsx'
import { RequestBoard } from '../components/Requests.jsx'
import { isApprover, needsAction } from '../lib/badges.js'
import { Card } from '../components/ui.jsx'

export { isApprover, needsAction }

/**
 * Tab Pengajuan di halaman Keuangan. Satu baris sub-tab (Perlu ACC · Perlu
 * transfer · Saya ajukan · …) ditaruh ke panel "map" oleh RequestBoard.
 * Tombol "Pengajuan Baru" sudah ada di tombol + Catat / Ajukan di judul.
 */
export default function Pengajuan({ subAwal }) {
  const { user } = useApp()
  const approver = isApprover(user)
  const bawaan = subAwal || (user.role === 'akunting' ? 'disetujui' : approver ? 'menunggu' : 'saya')
  const [tab, setTab] = useState(bawaan)
  useEffect(() => { if (subAwal) setTab(subAwal) }, [subAwal])
  return (
    <div className="space-y-3">
      <Card className="overflow-hidden p-0"><RequestBoard bare subtab tab={tab} onTab={setTab} /></Card>
      <p className="text-[11px] text-ink-mute">Pengajuan hanya terlihat oleh pemohon, cabangnya, dan pihak yang berwenang menyetujui. Keputusan ACC &amp; pembayaran tetap mengikuti alur yang sudah berjalan.</p>
    </div>
  )
}
