import { useState } from 'react'
import { Users, Lock } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { Card, Empty } from '../components/ui.jsx'
import { useDashStats, TranslatorLoad, AssignTable } from './Dashboard.jsx'
import { rolesOf } from '../config/access.js'
import { KapasitasAcc } from '../components/Kapasitas.jsx'
import { PilihPeriode, hariIni, tambahHari } from '../components/ToolbarRingkas.jsx'

// ============================================================
//  PENUGASAN — Perlu Penerjemah (fokus utama, kiri) + Kapasitas &
//  persetujuan tambah kapasitas (kanan). Satu pemilih periode untuk
//  seluruh halaman menggantikan 5 tombol + 2 kolom tanggal.
// ============================================================

export const canSeePenugasan = (u) => rolesOf(u).some((r) => ['superadmin', 'supervisor'].includes(r))

const PERIODE_PENUGASAN = (t = hariIni()) => [
  ['Saat ini', { from: '', to: '' }],
  ['Hari ini', { from: t, to: t }],
  ['s/d Besok', { from: t, to: tambahHari(t, 1) }],
  ['7 hari', { from: t, to: tambahHari(t, 6) }],
  ['30 hari', { from: t, to: tambahHari(t, 29) }],
]

export default function Penugasan() {
  const { user } = useApp()
  const s = useDashStats()
  const [range, setRange] = useState({ from: '', to: '' })

  if (!canSeePenugasan(user)) {
    return <div className="p-4"><Card><Empty icon={Lock} title="Halaman Penugasan hanya untuk Superadmin & Supervisor" /></Card></div>
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2" data-alat>
        <h1 className="mr-1 flex items-center gap-2 text-xl font-extrabold tracking-tight sm:text-2xl"><Users className="h-5 w-5 text-ink-mute" />Penugasan</h1>
        <span className="text-sm text-ink-mute">{s.needTr.length} perlu penerjemah</span>
        <div className="ml-auto"><PilihPeriode range={range} setRange={setRange} pilihan={PERIODE_PENUGASAN()} label="Deadline" /></div>
      </div>
      <AssignTable rows={s.needTr} range={range} setRange={setRange} />
      <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
        <TranslatorLoad range={range} setRange={setRange} ringkas />
        <KapasitasAcc />
      </div>
    </div>
  )
}
