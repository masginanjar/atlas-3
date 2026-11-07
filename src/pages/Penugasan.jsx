import { useState } from 'react'
import { Users, Lock } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { Card, Empty } from '../components/ui.jsx'
import { useDashStats, TranslatorLoad, AssignTable } from './Dashboard.jsx'
import { rolesOf } from '../config/access.js'

// ============================================================
//  PENUGASAN — Kapasitas Penerjemah + Perlu Penerjemah dalam satu
//  halaman. Komponennya SAMA dengan yang dipakai Dashboard dan
//  datanya dari store yang sama, jadi kapasitas dan penugasan
//  selalu seirama di kedua tempat.
// ============================================================

export const canSeePenugasan = (u) => rolesOf(u).some((r) => ['superadmin', 'supervisor'].includes(r))

export default function Penugasan() {
  const { user } = useApp()
  const s = useDashStats()
  // Rentang deadline dipakai bersama kedua kartu, seperti di Dashboard.
  const [range, setRange] = useState({ from: '', to: '' })

  if (!canSeePenugasan(user)) {
    return <div className="p-4"><Card><Empty icon={Lock} title="Halaman Penugasan hanya untuk Superadmin & Supervisor" /></Card></div>
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4">
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-lg font-bold text-ink"><Users className="h-5 w-5 text-brand" />Penugasan</h1>
        <p className="text-xs text-ink-soft">
          Kapasitas penerjemah dan dokumen yang belum punya penerjemah — satu tempat untuk membagi pekerjaan.
        </p>
      </div>
      <TranslatorLoad range={range} setRange={setRange} />
      <AssignTable rows={s.needTr} range={range} setRange={setRange} />
    </div>
  )
}
