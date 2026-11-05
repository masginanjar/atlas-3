import { useMemo, useState } from 'react'
import { History, FolderKanban, Workflow, Wallet, PiggyBank, Settings as Cog } from 'lucide-react'
import { ROLES } from '../config/access.js'
import { ACTIVITY_KINDS } from '../lib/activity.js'
import { cx } from './ui.jsx'

const ICON = { project: FolderKanban, stage: Workflow, finance: Wallet, petty: PiggyBank, setting: Cog }
const TONE = { project: 'bg-sky-50 text-sky-700', stage: 'bg-indigo-50 text-indigo-700', finance: 'bg-amber-50 text-amber-700', petty: 'bg-emerald-50 text-emerald-700', setting: 'bg-slate-100 text-slate-600' }
const fmtDay = (iso) => new Date(iso).toLocaleDateString('id-ID', { timeZone: 'Asia/Makassar', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const fmtTime = (iso) => new Date(iso).toLocaleTimeString('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit' })
const dayOf = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date(iso))

/** Daftar aktivitas dikelompokkan per hari. showProject = tampilkan no. invoice (untuk halaman semua aktivitas). */
export default function ActivityList({ items, showProject, pageSize = 60, empty = 'Belum ada aktivitas.' }) {
  const [limit, setLimit] = useState(pageSize)
  const groups = useMemo(() => {
    const g = []
    for (const a of items.slice(0, limit)) {
      const d = dayOf(a.at); let cur = g[g.length - 1]
      if (!cur || cur.d !== d) { cur = { d, at: a.at, rows: [] }; g.push(cur) }
      cur.rows.push(a)
    }
    return g
  }, [items, limit])
  if (!items.length) return <p className="px-4 py-8 text-center text-sm text-ink-mute"><History className="mx-auto mb-2 h-5 w-5" />{empty}</p>
  return (
    <div>
      {groups.map((g) => (
        <div key={g.d}>
          <p className="sticky top-0 z-[1] bg-slate-50 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-mute">{fmtDay(g.at)}</p>
          <ul className="divide-y divide-slate-100">
            {g.rows.map((a) => {
              const Icon = ICON[a.kind] || History
              return (
                <li key={a.id} className="flex items-start gap-2.5 px-3 py-2.5 sm:gap-3 sm:px-4">
                  <span className="w-10 shrink-0 pt-0.5 text-[11px] font-semibold tabular-nums text-ink-mute sm:w-11 sm:text-xs">{fmtTime(a.at)}</span>
                  <span className={cx('mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg', TONE[a.kind] || TONE.setting)} title={ACTIVITY_KINDS[a.kind]}><Icon className="h-3.5 w-3.5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm"><b>{a.by || 'Sistem'}</b>{a.role && <span className="text-xs text-ink-mute"> · {ROLES[a.role]?.label || a.role}</span>}</p>
                    <p className="text-[13px] leading-snug text-ink-soft">{a.action}</p>
                    {(showProject && a.ref) || a.sub ? (
                      <p className="text-[11px] text-ink-mute">
                        {showProject && a.project_id ? <a href={`#/projects/${a.project_id}`} className="font-semibold text-brand hover:underline">{a.ref}</a> : showProject ? a.ref : null}
                        {a.sub && <>{showProject && a.ref ? ' · ' : ''}Sub: {a.sub}</>}
                      </p>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
      {items.length > limit && <button type="button" onClick={() => setLimit((l) => l + pageSize)} className="w-full border-t border-slate-100 py-2.5 text-xs font-semibold text-brand hover:bg-slate-50">Tampilkan lebih banyak ({items.length - limit} lagi)</button>}
    </div>
  )
}
