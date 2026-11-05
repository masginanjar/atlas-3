import { useMemo, useState } from 'react'
import { StickyNote, Search, Pin, Archive, Trash2, Undo2, Plus, ExternalLink, CheckSquare, Printer, MessageSquareQuote } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { usePanel } from '../components/WorkspacePanel.jsx'
import { go } from '../lib/router.js'
import { Button, Card, cx } from '../components/ui.jsx'
import TimeAgo from '../components/TimeAgo.jsx'

import { myNotes, projectNotes } from '../lib/personal.js'
export { myNotes, projectNotes }

const TABS = [['aktif', 'Catatan saya'], ['project', 'Dari project'], ['pinned', 'Disematkan'], ['arsip', 'Arsip'], ['trash', 'Trash']]


export default function Notes() {
  const { user, data, save, notify, branchFilter } = useApp()
  const { open } = usePanel()
  const [tab, setTab] = useState('aktif')
  const [q, setQ] = useState('')
  const [tag, setTag] = useState('')

  const all = useMemo(() => myNotes(data, user), [data.notes, user]) // eslint-disable-line react-hooks/exhaustive-deps
  const tags = useMemo(() => [...new Set(all.flatMap((n) => n.tags || []))].sort(), [all])
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return all.filter((n) => {
      if (tab === 'trash') return !!n.deleted_at
      if (n.deleted_at) return false
      if (tab === 'arsip') return !!n.archived
      if (n.archived) return false
      if (tab === 'pinned' && !n.pinned) return false
      if (tag && !(n.tags || []).includes(tag)) return false
      if (!term) return true
      return [n.title, n.body, ...(n.tags || []), ...(n.checklist || []).map((c) => c.text)].join(' ').toLowerCase().includes(term)
    }).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at)))
  }, [all, tab, q, tag])

  const fromProject = useMemo(() => projectNotes(user, data, branchFilter), [user, data.projects, branchFilter]) // eslint-disable-line react-hooks/exhaustive-deps
  const patch = async (n, p, msg) => { try { await save('notes', { ...n, ...p }); if (msg) notify(msg) } catch (e) { notify(e.message, 'err') } }
  const remove = async (n) => {
    await patch(n, { deleted_at: new Date().toISOString() })
    notify('Catatan dipindah ke Trash — buka tab Trash untuk memulihkan')
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold tracking-tight"><StickyNote className="h-5 w-5 text-ink-mute" />Notes</h1>
          <p className="text-sm text-ink-soft">Catatan pribadi Anda. Tidak terlihat oleh rekan lain kecuali Anda bagikan.</p>
        </div>
        <Button size="sm" variant="dark" onClick={() => open('note')}><Plus className="h-3.5 w-3.5" />Catatan Baru</Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TABS.map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)} aria-pressed={tab === k}
            className={cx('rounded-xl px-3 py-1.5 text-xs font-semibold ring-1 transition', tab === k ? 'bg-ink text-white ring-ink' : 'bg-white text-ink-soft ring-slate-200 hover:ring-brand')}>{l}</button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <label className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari judul, isi, atau tag…" aria-label="Cari catatan"
            className="w-full rounded-xl border-0 bg-white py-2.5 pl-9 pr-3 text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-brand" />
        </label>
        {tags.length > 0 && (
          <select value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Filter tag"
            className="rounded-xl border-0 bg-white py-2.5 pl-3 pr-8 text-sm font-semibold ring-1 ring-slate-200 focus:ring-2 focus:ring-brand">
            <option value="">Semua tag</option>{tags.map((t) => <option key={t}>{t}</option>)}
          </select>
        )}
      </div>

      {tab === 'project' ? (
        fromProject.length === 0
          ? <Card className="p-10 text-center text-sm text-ink-mute">Belum ada catatan pelanggan atau titipan print di project Anda.</Card>
          : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {fromProject.filter((x) => !q.trim() || [x.text, x.project.invoice_no, x.project.customer?.name].join(' ').toLowerCase().includes(q.trim().toLowerCase())).map((x) => (
                <Card key={x.id} className="flex flex-col gap-2 p-4">
                  <p className={cx('inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1',
                    x.kind === 'print' ? 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200' : 'bg-amber-50 text-amber-800 ring-amber-200')}>
                    {x.kind === 'print' ? <Printer className="h-3 w-3" /> : <MessageSquareQuote className="h-3 w-3" />}
                    {x.kind === 'print' ? 'Titipan print' : 'Catatan pelanggan / CS'}
                  </p>
                  <p className="whitespace-pre-line text-sm text-ink">{x.text}</p>
                  <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[11px]">
                    <button type="button" onClick={() => go(`projects/${x.project.id}`)} className="inline-flex items-center gap-1 font-semibold text-brand hover:underline">{x.project.invoice_no} · {x.project.customer?.name || '—'}<ExternalLink className="h-3 w-3" /></button>
                    <button type="button" onClick={() => open('note', { link: { project_id: x.project.id } })} className="rounded-lg px-2 py-1 font-semibold text-ink-soft ring-1 ring-slate-200 hover:ring-brand">Catat sendiri</button>
                  </div>
                </Card>
              ))}
            </div>
          )
      ) : rows.length === 0
        ? <Card className="p-10 text-center text-sm text-ink-mute">{tab === 'trash' ? 'Trash kosong.' : 'Belum ada catatan di sini.'}</Card>
        : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((n) => {
              const done = (n.checklist || []).filter((c) => c.done).length
              const p = data.projects.find((x) => x.id === n.project_id)
              return (
                <Card key={n.id} className="flex flex-col gap-2 p-4">
                  <div className="flex items-start gap-2">
                    <button type="button" onClick={() => open('note', { note: n })} className="min-w-0 flex-1 text-left">
                      <p className="truncate text-sm font-bold text-ink">{n.title || '(tanpa judul)'}</p>
                      <p className="mt-0.5 line-clamp-3 whitespace-pre-line text-xs text-ink-soft">{n.body || '—'}</p>
                    </button>
                    {!n.deleted_at && (
                      <button type="button" onClick={() => patch(n, { pinned: !n.pinned })} aria-label={n.pinned ? 'Lepas sematan' : 'Sematkan'} title={n.pinned ? 'Lepas sematan' : 'Sematkan'}
                        className={cx('shrink-0 rounded-lg p-1.5 ring-1 transition', n.pinned ? 'bg-amber-50 text-amber-700 ring-amber-200' : 'text-ink-mute ring-slate-200 hover:text-brand')}><Pin className="h-3.5 w-3.5" /></button>
                    )}
                  </div>
                  {!!(n.checklist || []).length && <p className="flex items-center gap-1 text-[11px] font-semibold text-ink-mute"><CheckSquare className="h-3 w-3" />{done}/{n.checklist.length} selesai</p>}
                  {!!(n.tags || []).length && <div className="flex flex-wrap gap-1">{n.tags.map((t) => <span key={t} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-ink-soft">#{t}</span>)}</div>}
                  {p && <button type="button" onClick={() => go(`projects/${p.id}`)} className="inline-flex w-fit items-center gap-1 text-[11px] font-semibold text-brand hover:underline">{p.invoice_no}<ExternalLink className="h-3 w-3" /></button>}
                  <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[10px] text-ink-mute">
                    <TimeAgo at={n.updated_at || n.created_at} />
                    <span className="flex gap-1">
                      {n.deleted_at
                        ? <>
                          <button type="button" onClick={() => patch(n, { deleted_at: null }, 'Catatan dipulihkan')} className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 font-semibold text-emerald-700 hover:bg-emerald-50"><Undo2 className="h-3 w-3" />Pulihkan</button>
                        </>
                        : <>
                          <button type="button" onClick={() => patch(n, { archived: !n.archived }, n.archived ? 'Dikembalikan dari arsip' : 'Diarsipkan')} aria-label="Arsipkan" title={n.archived ? 'Keluarkan dari arsip' : 'Arsipkan'} className="rounded-lg p-1 hover:bg-slate-100"><Archive className="h-3.5 w-3.5" /></button>
                          <button type="button" onClick={() => remove(n)} aria-label="Hapus" title="Pindah ke Trash" className="rounded-lg p-1 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
                        </>}
                    </span>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      <p className="text-[11px] text-ink-mute">Tab <b>Dari project</b> menampilkan catatan pelanggan/CS dan titipan print apa adanya dari project — hanya ditautkan, tidak disalin, jadi perubahannya selalu ikut project. Catatan yang Anda hapus masuk Trash dan bisa dipulihkan; berbagi catatan pribadi ke rekan belum tersedia di versi ini.</p>
    </div>
  )
}
