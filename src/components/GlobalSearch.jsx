import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, FolderKanban, StickyNote, ListTodo, AlarmClock, FilePlus2 } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { scopeByBranch } from '../config/access.js'
import { scopeRequests, REQ_KINDS } from './Requests.jsx'
import { myNotes } from '../lib/personal.js'
import { myTodos } from '../pages/Todos.jsx'
import { myReminders } from '../pages/Reminders.jsx'
import { usePanel } from './WorkspacePanel.jsx'
import { go } from '../lib/router.js'
import { cx } from './ui.jsx'

const ICON = { project: FolderKanban, note: StickyNote, todo: ListTodo, reminder: AlarmClock, pengajuan: FilePlus2 }
const LABEL = { project: 'Project', note: 'Catatan', todo: 'To-do', reminder: 'Pengingat', pengajuan: 'Pengajuan' }

/** Pencarian lintas item — hanya yang boleh dilihat user ini. */
export function searchAll(user, data, branchFilter, term) {
  const q = term.trim().toLowerCase()
  if (q.length < 2) return []
  const hit = (s) => String(s || '').toLowerCase().includes(q)
  const out = []
  for (const p of scopeByBranch(user, data.projects, branchFilter)) {
    if (hit(p.invoice_no) || hit(p.customer?.name) || (p.sub_projects || []).some((s) => hit(s.title))) {
      out.push({ kind: 'project', id: p.id, title: p.invoice_no, sub: p.customer?.name || '', open: () => go(`projects/${p.id}`) })
    }
  }
  for (const n of myNotes(data, user)) if (!n.deleted_at && (hit(n.title) || hit(n.body) || (n.tags || []).some(hit))) out.push({ kind: 'note', id: n.id, title: n.title || '(tanpa judul)', sub: (n.tags || []).join(', '), panel: ['note', { note: n }] })
  for (const t of myTodos(data, user)) if (hit(t.title) || hit(t.note)) out.push({ kind: 'todo', id: t.id, title: t.title, sub: t.list || 'Umum', panel: ['todo', { todo: t }] })
  for (const r of myReminders(data, user)) if (hit(r.title) || hit(r.note)) out.push({ kind: 'reminder', id: r.id, title: r.title, sub: '', panel: ['reminder', { reminder: r }] })
  for (const r of scopeRequests(user, data.requests || [], branchFilter)) if (hit(r.purpose) || hit(REQ_KINDS[r.kind]?.label)) out.push({ kind: 'pengajuan', id: r.id, title: r.purpose || REQ_KINDS[r.kind]?.label, sub: REQ_KINDS[r.kind]?.label || '', open: () => go('pengajuan') })
  return out.slice(0, 24)
}

export default function GlobalSearch() {
  const { user, data, branchFilter } = useApp()
  const { open: openPanel } = usePanel()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [i, setI] = useState(0)
  const input = useRef(null)

  const rows = useMemo(() => (open ? searchAll(user, data, branchFilter, q) : []), [open, user, data, branchFilter, q])

  useEffect(() => {
    const key = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(true); setQ('') }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])
  useEffect(() => { if (open) setTimeout(() => input.current?.focus(), 30); setI(0) }, [open, q])

  const pick = (r) => { setOpen(false); if (r.open) r.open(); else if (r.panel) openPanel(...r.panel) }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title="Cari (Ctrl+K)" aria-label="Cari"
        className="grid h-8 w-8 place-items-center rounded-lg text-ink-mute transition hover:bg-white hover:text-brand"><Search className="h-[17px] w-[17px]" /></button>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-start justify-center bg-ink/30 px-4 pt-[12vh] backdrop-blur-[2px]" onClick={() => setOpen(false)}>
          <div role="dialog" aria-label="Pencarian" onClick={(e) => e.stopPropagation()} className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
            <label className="relative block border-b border-slate-100">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" />
              <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari project, catatan, to-do, pengingat, pengajuan…" aria-label="Kata kunci"
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(x + 1, rows.length - 1)) }
                  if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(x - 1, 0)) }
                  if (e.key === 'Enter' && rows[i]) pick(rows[i])
                }}
                className="w-full border-0 py-3.5 pl-11 pr-4 text-sm focus:outline-none focus:ring-0" />
            </label>
            <ul className="max-h-[52vh] overflow-auto p-1.5">
              {q.trim().length < 2 && <li className="px-3 py-6 text-center text-xs text-ink-mute">Ketik minimal 2 huruf. Tekan Ctrl+K kapan saja untuk membuka pencarian.</li>}
              {q.trim().length >= 2 && rows.length === 0 && <li className="px-3 py-6 text-center text-xs text-ink-mute">Tidak ada yang cocok.</li>}
              {rows.map((r, n) => {
                const Icon = ICON[r.kind]
                return (
                  <li key={`${r.kind}${r.id}`}>
                    <button type="button" onMouseEnter={() => setI(n)} onClick={() => pick(r)}
                      className={cx('flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left', n === i ? 'bg-slate-100' : 'hover:bg-slate-50')}>
                      <Icon className="h-4 w-4 shrink-0 text-ink-mute" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-ink">{r.title}</span>
                        {r.sub && <span className="block truncate text-[11px] text-ink-mute">{r.sub}</span>}
                      </span>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-ink-soft">{LABEL[r.kind]}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      )}
    </>
  )
}
