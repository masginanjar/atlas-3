import { useMemo } from 'react'
import { StickyNote, ListTodo, AlarmClock, Plus } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { usePanel, TZ } from './WorkspacePanel.jsx'
import { myNotes } from '../lib/personal.js'
import { myTodos } from '../pages/Todos.jsx'
import { myReminders, nextAt } from '../pages/Reminders.jsx'
import { Card, cx } from './ui.jsx'

const when = (iso) => (iso ? new Date(iso).toLocaleString('id-ID', { timeZone: TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '')

/**
 * Catatan / to-do / pengingat PRIBADI yang ditautkan ke project ini.
 * Hanya tautan — datanya tetap tinggal di menu masing-masing, tidak disalin ke project.
 */
export default function ProjectItems({ project }) {
  const { user, data } = useApp()
  const { open } = usePanel()
  const link = { project_id: project.id }

  const notes = useMemo(() => myNotes(data, user).filter((n) => n.project_id === project.id && !n.deleted_at), [data.notes, user, project.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const todos = useMemo(() => myTodos(data, user).filter((t) => t.project_id === project.id), [data.todos, user, project.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const rems = useMemo(() => myReminders(data, user).filter((r) => r.project_id === project.id && !r.done_at), [data.reminders, user, project.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const total = notes.length + todos.length + rems.length

  const Add = ({ kind, icon: Icon, label }) => (
    <button type="button" onClick={() => open(kind, { link })} className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-ink-soft ring-1 ring-slate-200 hover:ring-brand">
      <Plus className="h-3 w-3" /><Icon className="h-3 w-3" />{label}
    </button>
  )
  const Row = ({ onClick, icon: Icon, title, sub, done }) => (
    <li>
      <button type="button" onClick={onClick} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50">
        <Icon className="h-3.5 w-3.5 shrink-0 text-ink-mute" />
        <span className="min-w-0 flex-1">
          <span className={cx('block truncate text-[13px] font-semibold text-ink', done && 'text-ink-mute line-through')}>{title}</span>
          {sub && <span className="block truncate text-[11px] text-ink-mute">{sub}</span>}
        </span>
      </button>
    </li>
  )

  return (
    <Card className="space-y-2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-mute">Catatan &amp; pengingat saya <span className="font-normal normal-case">(pribadi, {total})</span></p>
        <span className="flex flex-wrap gap-1">
          <Add kind="note" icon={StickyNote} label="Catatan" />
          <Add kind="todo" icon={ListTodo} label="To-do" />
          <Add kind="reminder" icon={AlarmClock} label="Pengingat" />
        </span>
      </div>
      {total === 0
        ? <p className="text-xs text-ink-mute">Belum ada. Yang dibuat di sini otomatis tertaut ke project {project.invoice_no} dan tetap tersimpan di menu Notes / My To-do / Reminders.</p>
        : (
          <ul className="space-y-0.5">
            {notes.map((n) => <Row key={n.id} icon={StickyNote} title={n.title || '(tanpa judul)'} sub={(n.body || '').slice(0, 60)} onClick={() => open('note', { note: n })} />)}
            {todos.map((t) => <Row key={t.id} icon={ListTodo} title={t.title} done={t.done} sub={t.due ? `Tenggat ${when(t.due)}` : t.list} onClick={() => open('todo', { todo: t })} />)}
            {rems.map((r) => <Row key={r.id} icon={AlarmClock} title={r.title} sub={nextAt(r) ? `Berikutnya ${when(nextAt(r))}` : 'Nonaktif'} onClick={() => open('reminder', { reminder: r })} />)}
          </ul>
        )}
    </Card>
  )
}
