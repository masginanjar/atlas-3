import { useMemo, useState } from 'react'
import { History, Lock, Search } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { ROLES, BRANCHES } from '../config/access.js'
import { allActivities, ACTIVITY_KINDS } from '../lib/activity.js'
import { dayKey, addDays } from '../lib/performance.js'
import ActivityList from '../components/ActivityList.jsx'
import { Card, Empty, Input, Select, cx } from '../components/ui.jsx'

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
        <p className="text-[13px] text-ink-mute">Semua aktivitas semua orang: project, alur kerja, file, keuangan, petty cash & pengaturan. Hanya terlihat oleh Superadmin & Direktur.</p>
      </div>
      <Card className="overflow-hidden">
        <div className="space-y-2 border-b border-slate-100 p-3">
          <div className="-mx-3 flex items-center gap-1.5 overflow-x-auto px-3 pb-0.5 [scrollbar-width:none]">
            <button className={chip(range.from === today && range.to === today)} onClick={() => setRange({ from: today, to: today })}>Hari ini</button>
            <button className={chip(range.from === addDays(today, -1) && range.to === addDays(today, -1))} onClick={() => setRange({ from: addDays(today, -1), to: addDays(today, -1) })}>Kemarin</button>
            <button className={chip(range.from === addDays(today, -6) && range.to === today)} onClick={() => setRange({ from: addDays(today, -6), to: today })}>7 hari</button>
            <button className={chip(range.from === addDays(today, -29) && range.to === today)} onClick={() => setRange({ from: addDays(today, -29), to: today })}>30 hari</button>
            <button className={chip(!range.from && !range.to)} onClick={() => setRange({ from: '', to: '' })}>Semua</button>
          </div>
          <div className="flex items-center gap-1.5">
            <Input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className="min-w-0 flex-1 !py-1 text-xs sm:!w-36 sm:flex-none" aria-label="Dari tanggal" />
            <span className="text-xs text-ink-mute">–</span>
            <Input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className="min-w-0 flex-1 !py-1 text-xs sm:!w-36 sm:flex-none" aria-label="Sampai tanggal" />
          </div>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-5 [&_select]:!py-1.5 [&_select]:text-xs sm:[&_select]:text-sm">
            <label className="relative col-span-2 lg:col-span-1"><Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-ink-mute" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari invoice, nama, aksi…" className="!pl-8 text-sm" aria-label="Cari aktivitas" /></label>
            <Select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Filter orang"><option value="">Semua orang</option>{people.map((p) => <option key={p}>{p}</option>)}</Select>
            <Select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Filter role"><option value="">Semua role</option>{Object.entries(ROLES).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}</Select>
            <Select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Filter jenis"><option value="">Semua jenis</option>{Object.entries(ACTIVITY_KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
            <Select value={branch} onChange={(e) => setBranch(e.target.value)} aria-label="Filter cabang"><option value="">Semua cabang</option>{BRANCHES.map((b) => <option key={b}>{b}</option>)}</Select>
          </div>
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-mute"><b className="text-ink">{shown.length} aktivitas</b>{byKind.filter(([, n]) => n).map(([k, n]) => <span key={k}>{ACTIVITY_KINDS[k]} {n}</span>)}</p>
        </div>
        <ActivityList items={shown} showProject pageSize={80} empty="Tidak ada aktivitas pada filter ini." />
      </Card>
    </div>
  )
}
