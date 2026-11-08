import { useMemo, useState } from 'react'
import { History, Lock, Search } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { ROLES, BRANCHES } from '../config/access.js'
import { allActivities, ACTIVITY_KINDS } from '../lib/activity.js'
import { dayKey, addDays } from '../lib/performance.js'
import ActivityList from '../components/ActivityList.jsx'
import { Card, Empty, Input, Select, cx } from '../components/ui.jsx'
import { PilihPeriode, FilterLainnya, ChipAktif } from '../components/ToolbarRingkas.jsx'

import { canSeeAllActivity } from '../config/menuAccess.js'
export { canSeeAllActivity }

/** Riwayat aktivitas semua orang — hanya Superadmin & Direktur. */
export default function Activity() {
  const { user, data } = useApp()
  const today = dayKey()
  const [range, setRange] = useState({ from: addDays(today, -6), to: today })
  const [who, setWho] = useState('')
  const [role, setRole] = useState('')
  const [kind, setKind] = useState('')
  const [branch, setBranch] = useState('')
  const [q, setQ] = useState('')
  const all = useMemo(() => allActivities(data), [data])
  const projBranch = useMemo(() => new Map(data.projects.map((p) => [p.id, p.branch])), [data.projects])
  const userBranch = useMemo(() => new Map(data.users.map((u) => [u.name, u.branch])), [data.users])
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    return all.filter((a) => {
      const d = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date(a.at))
      if (range.from && d < range.from) return false
      if (range.to && d > range.to) return false
      if (who && a.by !== who) return false
      if (role && a.role !== role) return false
      if (kind && a.kind !== kind) return false
      if (branch && (projBranch.get(a.project_id) || userBranch.get(a.by)) !== branch) return false
      return !s || `${a.by} ${a.action} ${a.ref || ''} ${a.sub || ''}`.toLowerCase().includes(s)
    })
  }, [all, range, who, role, kind, branch, q, projBranch, userBranch])

  if (!canSeeAllActivity(user)) return <Card><Empty icon={Lock} title="Halaman ini hanya untuk Superadmin & Direktur" /></Card>
  const people = [...new Set(all.map((a) => a.by).filter(Boolean))].sort()
  const chip = (on) => cx('rounded-lg px-2.5 py-1 text-xs font-semibold ring-1', on ? 'bg-ink text-white ring-ink' : 'bg-white text-ink-soft ring-slate-200 hover:ring-ink')
  const byKind = Object.keys(ACTIVITY_KINDS).map((k) => [k, shown.filter((a) => a.kind === k).length])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-tight sm:text-2xl"><History className="h-6 w-6" />Riwayat Aktivitas</h1>
        <p className="text-[13px] text-ink-mute">Aktivitas semua orang — project, alur kerja, file, keuangan &amp; pengaturan.<span className="hidden sm:inline"> Hanya terlihat oleh Superadmin &amp; Direktur.</span></p>
      </div>
      <Card className="overflow-hidden">
        <div className="space-y-2 border-b border-slate-100 p-3">
          {/* Satu baris alat: cari · periode · filter lainnya.
              Dulu tiga baris (5 tombol periode, 2 kolom tanggal, 5 saringan) —
              fungsinya sama persis, hanya yang jarang dipakai dipindah ke "Filter". */}
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-[160px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari invoice, nama, aksi…" className="!pl-8 text-sm" aria-label="Cari aktivitas" />
            </label>
            <PilihPeriode range={range} setRange={setRange} today={today} />
            <FilterLainnya aktif={[who, role, kind, branch].filter(Boolean).length}
              onReset={() => { setWho(''); setRole(''); setKind(''); setBranch('') }}>
              <div className="space-y-1.5 [&_select]:!py-1.5 [&_select]:text-sm">
                <label className="block text-[11px] font-semibold text-ink-soft">Orang
                  <Select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Filter orang"><option value="">Semua orang</option>{people.map((p) => <option key={p}>{p}</option>)}</Select></label>
                <label className="block text-[11px] font-semibold text-ink-soft">Role
                  <Select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Filter role"><option value="">Semua role</option>{Object.entries(ROLES).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}</Select></label>
                <label className="block text-[11px] font-semibold text-ink-soft">Jenis aktivitas
                  <Select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Filter jenis"><option value="">Semua jenis</option>{Object.entries(ACTIVITY_KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></label>
                <label className="block text-[11px] font-semibold text-ink-soft">Cabang
                  <Select value={branch} onChange={(e) => setBranch(e.target.value)} aria-label="Filter cabang"><option value="">Semua cabang</option>{BRANCHES.map((b) => <option key={b}>{b}</option>)}</Select></label>
              </div>
            </FilterLainnya>
            <p className="ml-auto flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-mute"><b className="text-ink">{shown.length} aktivitas</b>{byKind.filter(([, n]) => n).map(([k, n]) => <span key={k}>{ACTIVITY_KINDS[k]} {n}</span>)}</p>
          </div>
          <ChipAktif items={[
            who && { label: `Orang: ${who}`, clear: () => setWho('') },
            role && { label: `Role: ${ROLES[role]?.label || role}`, clear: () => setRole('') },
            kind && { label: `Jenis: ${ACTIVITY_KINDS[kind] || kind}`, clear: () => setKind('') },
            branch && { label: `Cabang: ${branch}`, clear: () => setBranch('') },
          ]} />
        </div>
        <ActivityList items={shown} showProject pageSize={80} empty="Tidak ada aktivitas pada filter ini." />
      </Card>
    </div>
  )
}
