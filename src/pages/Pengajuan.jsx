import { useMemo, useState } from 'react'
import { FilePlus2, Search, Plus, ExternalLink } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { usePanel } from '../components/WorkspacePanel.jsx'
import { RequestBoard, REQ_KINDS, REQ_STATUS, KindBadge, ReqStatus, scopeRequests } from '../components/Requests.jsx'
import { isApprover, needsAction } from '../lib/badges.js'
import { rupiah, tgl } from '../lib/format.js'
import { go } from '../lib/router.js'
import { Button, Card, cx } from '../components/ui.jsx'

export { isApprover, needsAction }

export default function Pengajuan() {
  const { user, data, branchFilter } = useApp()
  const { open } = usePanel()
  const approver = isApprover(user)
  const [tab, setTab] = useState(approver ? 'acc' : 'saya')
  const [q, setQ] = useState('')
  const [kind, setKind] = useState('')
  const [status, setStatus] = useState('')
  const [month, setMonth] = useState('')

  const scoped = useMemo(() => scopeRequests(user, data.requests || [], branchFilter), [user, data.requests, branchFilter])
  const mine = useMemo(() => scoped.filter((r) => r.requested_by === user.id), [scoped, user.id])
  const todo = needsAction(user, data, branchFilter)

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return mine.filter((r) => {
      if (kind && r.kind !== kind) return false
      if (status && r.status !== status) return false
      if (month && !String(r.created_at || '').startsWith(month)) return false
      if (!term) return true
      return [r.purpose, REQ_KINDS[r.kind]?.label, r.branch, String(r.amount)].join(' ').toLowerCase().includes(term)
    }).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
  }, [mine, q, kind, status, month])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold tracking-tight"><FilePlus2 className="h-5 w-5 text-ink-mute" />Pengajuan</h1>
          <p className="text-sm text-ink-soft">Top up petty cash, refund pelanggan, dan pengajuan lain — beserta status persetujuannya.</p>
        </div>
        <Button size="sm" variant="dark" onClick={() => open('pengajuan')}><Plus className="h-3.5 w-3.5" />Pengajuan Baru</Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setTab('saya')} aria-pressed={tab === 'saya'}
          className={cx('rounded-xl px-3 py-1.5 text-xs font-semibold ring-1 transition', tab === 'saya' ? 'bg-ink text-white ring-ink' : 'bg-white text-ink-soft ring-slate-200 hover:ring-brand')}>
          Pengajuan Saya <span className="tabular-nums opacity-70">{mine.length}</span>
        </button>
        {approver && (
          <button type="button" onClick={() => setTab('acc')} aria-pressed={tab === 'acc'}
            className={cx('rounded-xl px-3 py-1.5 text-xs font-semibold ring-1 transition', tab === 'acc' ? 'bg-ink text-white ring-ink' : 'bg-white text-ink-soft ring-slate-200 hover:ring-brand')}>
            Perlu Persetujuan {todo > 0 && <span className="ml-0.5 rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">{todo}</span>}
          </button>
        )}
      </div>

      {tab === 'acc' && approver && <RequestBoard bare />}

      {tab === 'saya' && (
        <>
          <div className="flex flex-wrap gap-1.5">
            <label className="relative min-w-[180px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari keperluan…" aria-label="Cari pengajuan"
                className="w-full rounded-xl border-0 bg-white py-2.5 pl-9 pr-3 text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-brand" />
            </label>
            <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Filter jenis" className="rounded-xl border-0 bg-white py-2.5 pl-3 pr-8 text-sm font-semibold ring-1 ring-slate-200">
              <option value="">Semua jenis</option>{Object.entries(REQ_KINDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter status" className="rounded-xl border-0 bg-white py-2.5 pl-3 pr-8 text-sm font-semibold ring-1 ring-slate-200">
              <option value="">Semua status</option>{Object.entries(REQ_STATUS).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}
            </select>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Filter bulan" className="rounded-xl border-0 bg-white py-2.5 px-3 text-sm font-semibold ring-1 ring-slate-200" />
          </div>

          {rows.length === 0
            ? <Card className="p-10 text-center text-sm text-ink-mute">Belum ada pengajuan yang cocok.</Card>
            : (
              <Card className="p-0">
                <ul className="divide-y divide-slate-100">
                  {rows.map((r, i) => {
                    const p = data.projects.find((x) => x.id === r.project_id)
                    return (
                      <li key={r.id} className={cx('flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5', i % 2 && 'bg-slate-50/70')}>
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-2"><KindBadge kind={r.kind} /><span className="truncate text-sm font-semibold text-ink">{r.purpose || '—'}</span></p>
                          <p className="flex flex-wrap items-center gap-x-2 text-[11px] text-ink-mute">
                            <span>{tgl(r.created_at)}</span><span>· {r.branch}</span>
                            {p && <button type="button" onClick={() => go(`projects/${p.id}`)} className="inline-flex items-center gap-0.5 font-semibold text-brand hover:underline">{p.invoice_no}<ExternalLink className="h-2.5 w-2.5" /></button>}
                            {r.decided_note && <span className="truncate">· {r.decided_note}</span>}
                          </p>
                        </div>
                        <span className="text-sm font-bold tabular-nums">{rupiah(r.amount)}</span>
                        <ReqStatus status={r.status} />
                      </li>
                    )
                  })}
                </ul>
              </Card>
            )}
        </>
      )}
      <p className="text-[11px] text-ink-mute">Pengajuan hanya terlihat oleh pemohon, cabangnya, dan pihak yang berwenang menyetujui. Keputusan ACC &amp; pembayaran tetap mengikuti alur yang sudah berjalan.</p>
    </div>
  )
}
