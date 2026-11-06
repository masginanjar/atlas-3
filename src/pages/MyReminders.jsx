import { useMemo, useState } from 'react'
import { AlarmClock, ListTodo, Plus, ExternalLink, Trash2, BellOff, Bell, Check, Timer, Send, Inbox } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { usePanel, TZ } from '../components/WorkspacePanel.jsx'
import { myTodos, sentTodos, TODO_STATES, stateOf, bucketOf, dayKey } from './Todos.jsx'
import { myReminders, nextAt } from './Reminders.jsx'
import { REPEATS } from '../components/WorkspacePanel.jsx'
import { go } from '../lib/router.js'
import Avatar from '../components/Avatar.jsx'
import { Button, Card, cx } from '../components/ui.jsx'
import { invoiceLabel } from '../config/access.js'

const when = (iso) => (iso ? new Date(iso).toLocaleString('id-ID', { timeZone: TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '')
const PRIO = { Mendesak: 'bg-rose-50 text-rose-700 ring-rose-200', Penting: 'bg-amber-50 text-amber-800 ring-amber-200', Normal: '' }
const repeatLabel = (v) => REPEATS.find(([k]) => k === v)?.[1] || ''
const VIEWS = [['hari-ini', 'Hari Ini'], ['mendatang', 'Mendatang'], ['terlambat', 'Terlambat'], ['tanpa-tanggal', 'Tanpa tanggal'], ['selesai', 'Selesai']]

const remBucket = (r) => {
  if (r.done_at) return 'selesai'
  const n = nextAt(r)
  if (!n) return 'selesai'
  const d = dayKey(n); const t = dayKey(new Date())
  return d < t ? 'terlambat' : d === t ? 'hari-ini' : 'mendatang'
}

/**
 * My Reminders — to-do pribadi + pengingat/alarm dalam satu daftar,
 * termasuk permintaan yang dikirim rekan kerja (mention) beserta statusnya.
 */
export default function MyReminders() {
  const { user, data, save, remove, notify, nameOf } = useApp()
  const { open } = usePanel()
  const [view, setView] = useState('hari-ini')
  const [kind, setKind] = useState('') // '' | 'todo' | 'reminder'
  const [box, setBox] = useState('masuk') // masuk | terkirim

  const todos = useMemo(() => myTodos(data, user), [data.todos, user]) // eslint-disable-line react-hooks/exhaustive-deps
  const sent = useMemo(() => sentTodos(data, user), [data.todos, user]) // eslint-disable-line react-hooks/exhaustive-deps
  const rems = useMemo(() => myReminders(data, user), [data.reminders, user]) // eslint-disable-line react-hooks/exhaustive-deps

  const items = useMemo(() => {
    const a = todos.map((t) => ({ id: `t${t.id}`, type: 'todo', at: t.due, bucket: bucketOf(t), row: t }))
    const b = rems.map((r) => ({ id: `r${r.id}`, type: 'reminder', at: nextAt(r) || r.at, bucket: remBucket(r), row: r }))
    return [...a, ...b].sort((x, y) => String(x.at || '9999').localeCompare(String(y.at || '9999')))
  }, [todos, rems])

  const counts = useMemo(() => Object.fromEntries(VIEWS.map(([k]) => [k, items.filter((i) => i.bucket === k).length])), [items])
  const rows = items.filter((i) => i.bucket === view && (!kind || i.type === kind))
  const inbox = todos.filter((t) => t.assigned_to === user.id && stateOf(t) !== 'sudah').length

  const patch = async (table, row, p, msg) => { try { await save(table, { ...row, ...p }); if (msg) notify(msg) } catch (e) { notify(e.message, 'err') } }
  const setState = async (t, s) => {
    await patch('todos', t, { state: s, done: s === 'sudah', done_at: s === 'sudah' ? new Date().toISOString() : null })
    // kabari pengirim bila ini permintaan dari orang lain
    if (t.assigned_by && t.assigned_by !== user.id) {
      await save('notifications', { to_user: t.assigned_by, text: `${user.name} menandai "${t.title}" → ${TODO_STATES[s].label}`, by: user.name, read_by: [] }).catch(() => {})
    }
  }

  const TodoRow = ({ t, readOnly }) => {
    const p = data.projects.find((x) => x.id === t.project_id)
    const from = t.assigned_by && t.assigned_by !== user.id ? nameOf(t.assigned_by) : null
    const to = t.assigned_to && t.assigned_to !== user.id ? nameOf(t.assigned_to) : null
    const st = stateOf(t)
    return (
      <li className="flex flex-wrap items-start gap-x-3 gap-y-1.5 px-4 py-2.5">
        <ListTodo className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
        <div className="min-w-0 flex-1">
          <button type="button" onClick={() => open('todo', { todo: t })} className="block max-w-full truncate text-left text-sm font-semibold text-ink">
            <span className={cx(st === 'sudah' && 'text-ink-mute line-through')}>{t.title}</span>
          </button>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink-mute">
            {from && <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-1.5 font-semibold text-violet-700 ring-1 ring-violet-200"><Inbox className="h-3 w-3" />dari {from}</span>}
            {to && <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-1.5 font-semibold text-sky-700 ring-1 ring-sky-200"><Send className="h-3 w-3" />ke {to}</span>}
            <span className="rounded-full bg-slate-100 px-1.5 font-semibold">{t.list || 'Umum'}</span>
            {t.priority !== 'Normal' && <span className={cx('rounded-full px-1.5 font-semibold ring-1', PRIO[t.priority])}>{t.priority}</span>}
            {t.due && <span className={cx(bucketOf(t) === 'terlambat' && 'font-bold text-rose-600')}>{when(t.due)}</span>}
            {p && <button type="button" onClick={() => go(`projects/${p.id}`)} className="inline-flex items-center gap-0.5 font-semibold text-brand hover:underline">{invoiceLabel(p.invoice_no)}<ExternalLink className="h-2.5 w-2.5" /></button>}
          </p>
          {t.note && <p className="mt-0.5 line-clamp-2 text-[11px] text-ink-soft">{t.note}</p>}
        </div>
        <span className="flex shrink-0 items-center gap-1">
          {readOnly
            ? <span className={cx('rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1', TODO_STATES[st].cls)}>{TODO_STATES[st].label}</span>
            : (
              <span className="flex overflow-hidden rounded-lg ring-1 ring-slate-200" role="group" aria-label="Status">
                {Object.entries(TODO_STATES).map(([k, v]) => (
                  <button key={k} type="button" onClick={() => setState(t, k)} aria-pressed={st === k}
                    className={cx('px-2 py-1 text-[11px] font-semibold transition', st === k ? v.cls.replace('ring-1', '') + ' ring-0' : 'bg-white text-ink-mute hover:bg-slate-50')}>{v.label}</button>
                ))}
              </span>
            )}
          {!readOnly && !t.assigned_by && (
            <button type="button" onClick={async () => { await remove('todos', t.id); notify('To-do dihapus') }} aria-label="Hapus" className="rounded-lg p-1 text-ink-mute hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
          )}
        </span>
      </li>
    )
  }

  const RemRow = ({ r }) => {
    const p = data.projects.find((x) => x.id === r.project_id)
    const n = nextAt(r)
    return (
      <li className="flex flex-wrap items-start gap-x-3 gap-y-1.5 px-4 py-2.5">
        <AlarmClock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <button type="button" onClick={() => open('reminder', { reminder: r })} className="block max-w-full truncate text-left text-sm font-semibold text-ink">{r.title}</button>
          <p className="flex flex-wrap items-center gap-x-2 text-[11px] text-ink-mute">
            <span className={cx(n && new Date(n) < new Date() && 'font-bold text-rose-600')}>{r.done_at ? `Selesai ${when(r.done_at)}` : n ? when(n) : 'Nonaktif'}</span>
            {r.repeat !== 'none' && <span className="rounded-full bg-slate-100 px-1.5 font-semibold">{repeatLabel(r.repeat)}</span>}
            {r.snooze_until && new Date(r.snooze_until) > new Date() && <span className="inline-flex items-center gap-0.5 text-amber-700"><Timer className="h-3 w-3" />ditunda</span>}
            {p && <button type="button" onClick={() => go(`projects/${p.id}`)} className="inline-flex items-center gap-0.5 font-semibold text-brand hover:underline">{invoiceLabel(p.invoice_no)}<ExternalLink className="h-2.5 w-2.5" /></button>}
          </p>
          {r.note && <p className="mt-0.5 line-clamp-2 text-[11px] text-ink-soft">{r.note}</p>}
        </div>
        <span className="flex shrink-0 flex-wrap items-center gap-1">
          {!r.done_at && r.active !== false && <button type="button" onClick={() => patch('reminders', r, { snooze_until: new Date(Date.now() + 10 * 60000).toISOString() }, 'Ditunda 10 menit')} className="rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-ink-soft ring-1 ring-slate-200 hover:ring-brand">Snooze 10m</button>}
          {!r.done_at && <button type="button" onClick={() => patch('reminders', r, { done_at: new Date().toISOString() }, 'Pengingat selesai')} aria-label="Selesai" className="rounded-lg p-1.5 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50"><Check className="h-3.5 w-3.5" /></button>}
          <button type="button" onClick={() => patch('reminders', r, { active: r.active === false, done_at: null })} aria-label={r.active === false ? 'Aktifkan' : 'Nonaktifkan'} className="rounded-lg p-1.5 text-ink-mute ring-1 ring-slate-200 hover:text-brand">{r.active === false ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}</button>
          <button type="button" onClick={async () => { await remove('reminders', r.id); notify('Pengingat dihapus') }} aria-label="Hapus" className="rounded-lg p-1.5 text-ink-mute ring-1 ring-slate-200 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
        </span>
      </li>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold tracking-tight"><AlarmClock className="h-5 w-5 text-ink-mute" />My Reminders</h1>
          <p className="text-sm text-ink-soft">To-do pribadi, permintaan dari rekan, dan alarm — satu tempat. Terpisah dari tahapan project.</p>
        </div>
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" onClick={() => open('todo')}><Plus className="h-3.5 w-3.5" />To-do</Button>
          <Button size="sm" variant="dark" onClick={() => open('reminder')}><Plus className="h-3.5 w-3.5" />Alarm</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setBox('masuk')} aria-pressed={box === 'masuk'}
          className={cx('rounded-xl px-3 py-1.5 text-xs font-semibold ring-1 transition', box === 'masuk' ? 'bg-ink text-white ring-ink' : 'bg-white text-ink-soft ring-slate-200 hover:ring-brand')}>
          Untuk saya {inbox > 0 && <span className="ml-0.5 rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">{inbox}</span>}
        </button>
        <button type="button" onClick={() => setBox('terkirim')} aria-pressed={box === 'terkirim'}
          className={cx('rounded-xl px-3 py-1.5 text-xs font-semibold ring-1 transition', box === 'terkirim' ? 'bg-ink text-white ring-ink' : 'bg-white text-ink-soft ring-slate-200 hover:ring-brand')}>
          Saya kirim <span className="tabular-nums opacity-70">{sent.length}</span>
        </button>
      </div>

      {box === 'masuk' && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {VIEWS.map(([k, l]) => (
              <button key={k} type="button" onClick={() => setView(k)} aria-pressed={view === k}
                className={cx('rounded-xl px-3 py-1.5 text-xs font-semibold ring-1 transition', view === k ? 'bg-brand text-white ring-brand' : 'bg-white text-ink-soft ring-slate-200 hover:ring-brand')}>
                {l} <span className="tabular-nums opacity-70">{counts[k]}</span>
              </button>
            ))}
            <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Jenis"
              className="ml-auto rounded-xl border-0 bg-white py-1.5 pl-3 pr-8 text-xs font-semibold ring-1 ring-slate-200 focus:ring-2 focus:ring-brand">
              <option value="">To-do &amp; alarm</option><option value="todo">To-do saja</option><option value="reminder">Alarm saja</option>
            </select>
          </div>
          {rows.length === 0
            ? <Card className="p-10 text-center text-sm text-ink-mute">Tidak ada apa-apa di tampilan ini.</Card>
            : <Card className="p-0"><ul className="divide-y divide-slate-100">{rows.map((i) => (i.type === 'todo' ? <TodoRow key={i.id} t={i.row} /> : <RemRow key={i.id} r={i.row} />))}</ul></Card>}
        </>
      )}

      {box === 'terkirim' && (
        sent.length === 0
          ? <Card className="p-10 text-center text-sm text-ink-mute">Belum ada permintaan yang Anda kirim. Buat To-do lalu isi "Kirim ke" untuk menugaskan ke rekan.</Card>
          : (
            <Card className="p-0">
              <ul className="divide-y divide-slate-100">
                {sent.map((t) => {
                  const u = data.users.find((x) => x.id === t.assigned_to)
                  return (
                    <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                      {u && <Avatar user={u} size={28} ring={false} className="shrink-0 ring-1 ring-slate-200" />}
                      <div className="min-w-0 flex-1"><TodoRowInline t={t} nameOf={nameOf} /></div>
                      <span className={cx('shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1', TODO_STATES[stateOf(t)].cls)}>{TODO_STATES[stateOf(t)].label}</span>
                    </li>
                  )
                })}
              </ul>
            </Card>
          )
      )}
      <p className="text-[11px] text-ink-mute">Permintaan antar-rekan di sini bersifat pribadi: statusnya tidak mengubah tahap penerjemahan, proofread, atau otorisasi di My Project.</p>
    </div>
  )
}

function TodoRowInline({ t, nameOf }) {
  return (
    <>
      <p className="truncate text-sm font-semibold text-ink">{t.title}</p>
      <p className="truncate text-[11px] text-ink-mute">Untuk {nameOf(t.assigned_to)}{t.due ? ` · ${when(t.due)}` : ''}{t.list ? ` · ${t.list}` : ''}</p>
    </>
  )
}
