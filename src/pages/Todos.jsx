// Helper data to-do. Tampilannya digabung dengan pengingat di halaman My Reminders.
import { TZ } from '../components/WorkspacePanel.jsx'

/** To-do milik saya: yang saya buat sendiri + yang dikirim rekan kepada saya. */
export const myTodos = (data, user) => (data.todos || []).filter((t) => (t.assigned_to ? t.assigned_to === user.id : t.owner_id === user.id))
/** To-do yang SAYA kirim ke orang lain. */
export const sentTodos = (data, user) => (data.todos || []).filter((t) => t.assigned_to && t.assigned_to !== user.id && (t.assigned_by === user.id || t.owner_id === user.id))

export const TODO_STATES = {
  belum: { label: 'Belum', cls: 'bg-slate-100 text-ink-soft ring-slate-200' },
  sedang: { label: 'Sedang', cls: 'bg-amber-50 text-amber-800 ring-amber-200' },
  sudah: { label: 'Sudah', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
}
export const stateOf = (t) => (t.done ? 'sudah' : t.state || 'belum')
export const dayKey = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(d))
export const bucketOf = (t) => {
  if (t.done || stateOf(t) === 'sudah') return 'selesai'
  if (!t.due) return 'tanpa-tanggal'
  const d = dayKey(t.due); const n = dayKey(new Date())
  return d < n ? 'terlambat' : d === n ? 'hari-ini' : 'mendatang'
}
