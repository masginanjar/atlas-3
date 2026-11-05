import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { StickyNote, ListTodo, AlarmClock, FilePlus2, FolderPlus, Plus, Check, Trash2 } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { can } from '../config/access.js'
import { Button, Field, Input, Select, Sheet, Textarea, cx } from './ui.jsx'
import ProjectForm from '../pages/ProjectForm.jsx'
import { RequestForm } from './Requests.jsx'

// ============================================================
//  SATU PANEL KANAN untuk semua aksi cepat.
//  Hanya satu panel terbuka dalam satu waktu; ganti konteks akan
//  menanyakan dulu bila ada isian yang belum disimpan.
// ============================================================
const Ctx = createContext(null)
export const usePanel = () => useContext(Ctx)

export const PANELS = {
  project: { label: 'Project Baru', icon: FolderPlus, tip: 'Buat Project', allow: (u) => can.editProject(u) },
  note: { label: 'Catatan Baru', icon: StickyNote, tip: 'Buat Catatan', allow: () => true },
  todo: { label: 'To-do Baru', icon: ListTodo, tip: 'Buat To-do', allow: () => true },
  reminder: { label: 'Pengingat Baru', icon: AlarmClock, tip: 'Buat Pengingat / Alarm', allow: () => true },
  pengajuan: { label: 'Pengajuan Baru', icon: FilePlus2, tip: 'Buat Pengajuan', allow: (u) => !!u },
}
export const PANEL_ORDER = ['project', 'note', 'todo', 'reminder', 'pengajuan']

export function PanelProvider({ children }) {
  const { ask } = useApp()
  const [panel, setPanel] = useState(null) // { kind, props }
  const dirty = useRef(false)
  const setDirty = useCallback((v) => { dirty.current = v }, [])

  const close = useCallback(async (force) => {
    if (!force && dirty.current && !(await ask('Ada isian yang belum disimpan. Tutup dan buang isian itu?'))) return false
    dirty.current = false; setPanel(null); return true
  }, [ask])

  const open = useCallback(async (kind, props = {}) => {
    if (panel && panel.kind === kind && !props.force) return // sudah terbuka
    if (panel && !(await close())) return
    dirty.current = false
    setPanel({ kind, props })
  }, [panel, close])

  const value = useMemo(() => ({ panel, open, close, setDirty }), [panel, open, close, setDirty])
  return <Ctx.Provider value={value}>{children}<PanelHost /></Ctx.Provider>
}

function PanelHost() {
  const { panel, close, setDirty } = usePanel()
  if (!panel) return null
  const p = panel.props || {}
  const shut = () => close()
  // Ketikan apa pun di dalam panel menandai "belum disimpan" (React meneruskan event dari portal).
  const guard = (el) => <div onInput={() => setDirty(true)} onChange={() => setDirty(true)}>{el}</div>
  if (panel.kind === 'project') return guard(<ProjectForm side preset={p.preset} onClose={shut} onSaved={(saved) => { setDirty(false); p.onSaved?.(saved) }} />)
  if (panel.kind === 'pengajuan') return guard(<RequestForm open side onClose={shut} onSaved={() => setDirty(false)} />)
  if (panel.kind === 'note') return guard(<NoteForm note={p.note} link={p.link} onDirty={setDirty} onClose={shut} />)
  if (panel.kind === 'todo') return guard(<TodoForm todo={p.todo} link={p.link} onDirty={setDirty} onClose={shut} />)
  if (panel.kind === 'reminder') return guard(<ReminderForm reminder={p.reminder} link={p.link} onDirty={setDirty} onClose={shut} />)
  return null
}

// ---------------- bantu ----------------
export const TZ = 'Asia/Makassar'
const todayStr = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
/** Tanggal+jam lokal (WITA) → ISO. Dipakai agar pengingat mengikuti zona waktu, bukan jam server. */
export function toISO(date, time = '09:00', tz = TZ) {
  if (!date) return null
  const off = tz === TZ ? '+08:00' : ''
  const iso = new Date(`${date}T${(time || '09:00').slice(0, 5)}:00${off}`)
  return Number.isNaN(iso.getTime()) ? null : iso.toISOString()
}
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()))

/** Tautan opsional ke project — disimpan sebagai id, bukan salinan data. */
function LinkProject({ value, onChange }) {
  const { user, data } = useApp()
  const list = useMemo(() => data.projects.slice().sort((a, b) => String(b.invoice_no).localeCompare(String(a.invoice_no))).slice(0, 200), [data.projects])
  if (!user) return null
  return (
    <Field label="Hubungkan ke project (opsional)" hint="Hanya ditautkan — datanya tidak disalin.">
      <Select value={value || ''} onChange={(e) => onChange(e.target.value || '')}>
        <option value="">— Tidak ditautkan —</option>
        {list.map((p) => <option key={p.id} value={p.id}>{p.invoice_no} · {p.customer?.name || '—'}</option>)}
      </Select>
    </Field>
  )
}

const SAVE_LABEL = { idle: '', saving: 'Menyimpan…', saved: 'Tersimpan', err: 'Gagal menyimpan' }
function SaveState({ state }) {
  if (!state || state === 'idle') return null
  return <span className={cx('text-[11px] font-semibold', state === 'err' ? 'text-rose-600' : state === 'saved' ? 'text-emerald-600' : 'text-ink-mute')}>{SAVE_LABEL[state]}</span>
}

// ---------------- CATATAN ----------------
export function NoteForm({ note, link, onClose, onDirty }) {
  const { user, save, notify } = useApp()
  const [f, setF] = useState(() => ({
    id: note?.id, title: note?.title || '', body: note?.body || '', tags: (note?.tags || []).join(', '),
    checklist: note?.checklist || [], project_id: note?.project_id || link?.project_id || '', pinned: !!note?.pinned,
  }))
  const [state, setState] = useState('idle')
  const idRef = useRef(note?.id || null)
  const first = useRef(true)
  const up = (patch) => { setF((x) => ({ ...x, ...patch })); onDirty?.(true) }

  // autosave: indikator kecil, tanpa toast berulang
  useEffect(() => {
    if (first.current) { first.current = false; return }
    if (!f.title.trim() && !f.body.trim() && !f.checklist.length) return
    setState('saving')
    const t = setTimeout(async () => {
      try {
        const row = {
          ...(idRef.current ? { id: idRef.current } : {}),
          owner_id: user.id, title: f.title.trim(), body: f.body, tags: f.tags.split(',').map((s) => s.trim()).filter(Boolean),
          checklist: f.checklist, project_id: f.project_id || null, pinned: f.pinned, archived: note?.archived || false, deleted_at: null,
        }
        const saved = await save('notes', row)
        idRef.current = saved.id
        setState('saved'); onDirty?.(false)
      } catch { setState('err') }
    }, 700)
    return () => clearTimeout(t)
  }, [f]) // eslint-disable-line react-hooks/exhaustive-deps

  const addItem = () => up({ checklist: [...f.checklist, { id: uid(), text: '', done: false }] })
  const setItem = (id, patch) => up({ checklist: f.checklist.map((c) => (c.id === id ? { ...c, ...patch } : c)) })
  const delItem = (id) => up({ checklist: f.checklist.filter((c) => c.id !== id) })

  return (
    <Sheet open side wide onClose={onClose} title={note ? 'Edit Catatan' : 'Catatan Baru'} subtitle="Pribadi — hanya Anda yang bisa melihatnya"
      footer={<><SaveState state={state} /><Button variant="outline" className="ml-auto" onClick={onClose}>Tutup</Button>
        <Button onClick={async () => { if (!f.title.trim() && !f.body.trim()) return notify('Isi judul atau isi catatan', 'err'); onDirty?.(false); onClose(); notify('Catatan tersimpan') }}>Selesai</Button></>}>
      <div className="space-y-4">
        <Field label="Judul"><Input value={f.title} onChange={(e) => up({ title: e.target.value })} placeholder="Judul catatan" autoFocus /></Field>
        <Field label="Isi"><Textarea rows={8} value={f.body} onChange={(e) => up({ body: e.target.value })} placeholder="Tulis catatan… (baris baru, daftar dengan - , **tebal**)" /></Field>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-mute">Checklist</p>
            <button type="button" onClick={addItem} className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"><Plus className="h-3 w-3" />Tambah baris</button>
          </div>
          <ul className="space-y-1.5">
            {f.checklist.map((c) => (
              <li key={c.id} className="flex items-center gap-2">
                <input type="checkbox" checked={c.done} onChange={(e) => setItem(c.id, { done: e.target.checked })} aria-label="Selesai" className="h-4 w-4 rounded border-slate-300 text-brand" />
                <input value={c.text} onChange={(e) => setItem(c.id, { text: e.target.value })} placeholder="Item…" className={cx('min-w-0 flex-1 rounded-lg border-0 bg-white px-2 py-1.5 text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-brand', c.done && 'text-ink-mute line-through')} />
                <button type="button" onClick={() => delItem(c.id)} aria-label="Hapus baris" className="rounded-lg p-1 text-ink-mute hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
              </li>
            ))}
            {!f.checklist.length && <li className="text-xs text-ink-mute">Belum ada item.</li>}
          </ul>
        </div>
        <Field label="Tag" hint="Pisahkan dengan koma"><Input value={f.tags} onChange={(e) => up({ tags: e.target.value })} placeholder="mis. pribadi, ide, follow-up" /></Field>
        <LinkProject value={f.project_id} onChange={(v) => up({ project_id: v })} />
        <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={f.pinned} onChange={(e) => up({ pinned: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-brand" />Sematkan di atas</label>
      </div>
    </Sheet>
  )
}

// ---------------- TO-DO ----------------
export const TODO_PRIORITY = ['Normal', 'Penting', 'Mendesak']
export function TodoForm({ todo, link, onClose, onDirty }) {
  const { user, data, save, notify } = useApp()
  const lists = useMemo(() => [...new Set((data.todos || []).filter((t) => t.owner_id === user.id).map((t) => t.list).filter(Boolean))], [data.todos, user.id])
  const mates = useMemo(() => data.users.filter((u) => u.active !== false && u.id !== user.id).sort((a, b) => a.name.localeCompare(b.name)), [data.users, user.id])
  const [f, setF] = useState(() => ({
    title: todo?.title || '', list: todo?.list || 'Umum', due: todo?.due ? todo.due.slice(0, 10) : '', due_time: todo?.due_time || '',
    priority: todo?.priority || 'Normal', note: todo?.note || '', project_id: todo?.project_id || link?.project_id || '', remind: !!todo?.reminder_id,
    assigned_to: todo?.assigned_to || link?.assigned_to || '',
  }))
  const [busy, setBusy] = useState(false)
  const up = (patch) => { setF((x) => ({ ...x, ...patch })); onDirty?.(true) }

  const submit = async () => {
    if (!f.title.trim()) return notify('Isi judul to-do', 'err')
    setBusy(true)
    try {
      const row = {
        ...(todo?.id ? { id: todo.id } : {}), owner_id: todo?.owner_id || user.id, title: f.title.trim(), list: f.list.trim() || 'Umum',
        due: f.due ? toISO(f.due, f.due_time || '17:00') : null, due_time: f.due_time || '', priority: f.priority,
        note: f.note, project_id: f.project_id || null, done: todo?.done || false, done_at: todo?.done_at || null,
        order: todo?.order ?? Date.now(), reminder_id: todo?.reminder_id || null,
        // Kirim ke rekan (mention): jadi permintaan dengan status Belum / Sedang / Sudah
        assigned_to: f.assigned_to || null,
        assigned_by: f.assigned_to ? (todo?.assigned_by || user.id) : null,
        assigned_at: f.assigned_to ? (todo?.assigned_at || new Date().toISOString()) : null,
        state: f.assigned_to ? (todo?.state || 'belum') : (todo?.state || null),
      }
      const saved = await save('todos', row)
      // beri tahu penerima — hanya sekali, saat pertama dikirim
      if (f.assigned_to && f.assigned_to !== todo?.assigned_to) {
        await save('notifications', { to_user: f.assigned_to, text: `${user.name} mengirim permintaan: ${row.title}${row.due ? ` (tenggat ${new Date(row.due).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })})` : ''}`, by: user.name, read_by: [] }).catch(() => {})
      }
      // pengingat opsional: dibuat sebagai Reminder biasa yang menautkan to-do ini (bukan pencatatan tanggal terpisah)
      if (f.remind && f.due && !saved.reminder_id) {
        const r = await save('reminders', { owner_id: user.id, title: `To-do: ${row.title}`, at: row.due, tz: TZ, repeat: 'none', note: '', todo_id: saved.id, project_id: row.project_id, active: true, done_at: null, snooze_until: null })
        await save('todos', { ...saved, reminder_id: r.id })
      }
      onDirty?.(false); onClose(); notify(todo ? 'To-do diperbarui' : f.assigned_to ? 'Permintaan terkirim' : 'To-do dibuat')
    } catch (e) { notify(e.message, 'err') } finally { setBusy(false) }
  }

  return (
    <Sheet open side onClose={onClose} title={todo ? 'Edit To-do' : 'To-do Baru'} subtitle="Pekerjaan pribadi — terpisah dari tahapan project"
      footer={<><Button variant="outline" className="flex-1 sm:flex-none sm:px-6" onClick={onClose}>Batal</Button><Button className="flex-1" loading={busy} onClick={submit}>{todo ? 'Simpan' : 'Tambah To-do'}</Button></>}>
      <div className="space-y-4">
        <Field label="Judul" required><Input value={f.title} onChange={(e) => up({ title: e.target.value })} placeholder="Apa yang mau dikerjakan?" autoFocus /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Daftar"><Input list="todo-lists" value={f.list} onChange={(e) => up({ list: e.target.value })} placeholder="Umum" />
            <datalist id="todo-lists">{lists.map((l) => <option key={l} value={l} />)}</datalist>
          </Field>
          <Field label="Prioritas"><Select value={f.priority} onChange={(e) => up({ priority: e.target.value })}>{TODO_PRIORITY.map((p) => <option key={p}>{p}</option>)}</Select></Field>
          <Field label="Tenggat (opsional)"><Input type="date" value={f.due} onChange={(e) => up({ due: e.target.value })} /></Field>
          <Field label="Jam"><Input type="time" value={f.due_time} onChange={(e) => up({ due_time: e.target.value })} disabled={!f.due} /></Field>
        </div>
        <Field label="Catatan singkat"><Textarea rows={3} value={f.note} onChange={(e) => up({ note: e.target.value })} /></Field>
        <Field label="Kirim ke rekan (opsional)" hint="Jadi permintaan pribadi: penerima menandai Belum / Sedang / Sudah, dan Anda bisa memantaunya di My Reminders → Saya kirim.">
          <Select value={f.assigned_to} onChange={(e) => up({ assigned_to: e.target.value })}>
            <option value="">— Untuk saya sendiri —</option>
            {mates.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
        </Field>
        <LinkProject value={f.project_id} onChange={(v) => up({ project_id: v })} />
        <label className={cx('flex items-center gap-2 text-sm', !f.due && 'opacity-50')}>
          <input type="checkbox" disabled={!f.due} checked={f.remind} onChange={(e) => up({ remind: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-brand" />
          Ingatkan saya di waktu tenggat
        </label>
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-ink-mute ring-1 ring-slate-200">
          To-do dan permintaan di sini bersifat pribadi: tidak mengubah tahap project. Penugasan kerja resmi (penerjemah, proofreader, otorisator) tetap lewat My Project.
        </p>
      </div>
    </Sheet>
  )
}

// ---------------- PENGINGAT ----------------
export const REPEATS = [['none', 'Sekali saja'], ['daily', 'Setiap hari'], ['weekly', 'Setiap minggu'], ['weekday', 'Setiap hari kerja (Sen–Jum)'], ['monthly', 'Setiap bulan']]
export function ReminderForm({ reminder, link, onClose, onDirty }) {
  const { user, save, notify } = useApp()
  const [f, setF] = useState(() => ({
    title: reminder?.title || '', date: reminder?.at ? new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(reminder.at)) : todayStr(),
    time: reminder?.at ? new Intl.DateTimeFormat('id-ID', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(reminder.at)).replace('.', ':') : '09:00',
    repeat: reminder?.repeat || 'none', note: reminder?.note || '', project_id: reminder?.project_id || link?.project_id || '',
  }))
  const [busy, setBusy] = useState(false)
  const up = (patch) => { setF((x) => ({ ...x, ...patch })); onDirty?.(true) }
  const at = toISO(f.date, f.time)

  const submit = async () => {
    if (!f.title.trim()) return notify('Isi judul pengingat', 'err')
    if (!at) return notify('Tanggal / jam belum benar', 'err')
    setBusy(true)
    try {
      await save('reminders', {
        ...(reminder?.id ? { id: reminder.id } : {}), owner_id: user.id, title: f.title.trim(), at, tz: TZ,
        repeat: f.repeat, note: f.note, project_id: f.project_id || null, todo_id: reminder?.todo_id || link?.todo_id || null,
        note_id: reminder?.note_id || link?.note_id || null, active: reminder ? reminder.active !== false : true,
        done_at: null, snooze_until: null, fired_at: reminder?.fired_at || null,
      })
      onDirty?.(false); onClose(); notify(reminder ? 'Pengingat diperbarui' : 'Pengingat dibuat')
    } catch (e) { notify(e.message, 'err') } finally { setBusy(false) }
  }

  return (
    <Sheet open side onClose={onClose} title={reminder ? 'Edit Pengingat' : 'Pengingat Baru'} subtitle={`Zona waktu ${TZ.split('/')[1]} (WITA)`}
      footer={<><Button variant="outline" className="flex-1 sm:flex-none sm:px-6" onClick={onClose}>Batal</Button><Button className="flex-1" loading={busy} onClick={submit}>{reminder ? 'Simpan' : 'Buat Pengingat'}</Button></>}>
      <div className="space-y-4">
        <Field label="Judul" required><Input value={f.title} onChange={(e) => up({ title: e.target.value })} placeholder="Mis. Telepon vendor Jepang" autoFocus /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tanggal" required><Input type="date" value={f.date} onChange={(e) => up({ date: e.target.value })} /></Field>
          <Field label="Jam" required><Input type="time" value={f.time} onChange={(e) => up({ time: e.target.value })} /></Field>
        </div>
        <Field label="Ulangi"><Select value={f.repeat} onChange={(e) => up({ repeat: e.target.value })}>{REPEATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
        <Field label="Catatan"><Textarea rows={3} value={f.note} onChange={(e) => up({ note: e.target.value })} /></Field>
        <LinkProject value={f.project_id} onChange={(v) => up({ project_id: v })} />
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-ink-mute ring-1 ring-slate-200">
          Pengingat muncul di dalam aplikasi selama ATLAS terbuka (zona waktu WITA). Notifikasi saat aplikasi tertutup belum didukung, jadi jangan dipakai untuk alarm yang wajib berbunyi.
        </p>
      </div>
    </Sheet>
  )
}

export { Check }
