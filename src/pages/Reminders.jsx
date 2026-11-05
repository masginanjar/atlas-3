import { useEffect, useRef, useState } from 'react'
import { AlarmClock } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { TZ } from '../components/WorkspacePanel.jsx'
import { playPing, soundEnabled } from '../lib/sounds.js'

export const myReminders = (data, user) => (data.reminders || []).filter((r) => r.owner_id === user.id)

const DAY = 864e5
/** Jadwal ini sudah waktunya tayang dan belum pernah ditayangkan? */
export function isDue(r, now = Date.now()) {
  if (!r || r.active === false || r.done_at) return false
  if (r.snooze_until) return new Date(r.snooze_until).getTime() <= now
  const t = new Date(r.at).getTime()
  if (Number.isNaN(t) || t > now) return false
  return !(r.fired_at && new Date(r.fired_at).getTime() >= t) // sudah ditayangkan untuk jadwal ini
}

/** Waktu tayang berikutnya (ISO) — memperhitungkan pengulangan & snooze. null bila sudah selesai. */
export function nextAt(r, now = Date.now()) {
  if (!r || r.active === false || r.done_at) return null
  if (r.snooze_until && new Date(r.snooze_until).getTime() > now) return r.snooze_until
  if (isDue(r, now)) return new Date(r.at).toISOString() // jadwal yang lewat & belum tayang → tampil terlambat
  let t = new Date(r.at).getTime()
  if (Number.isNaN(t)) return null
  if (t > now || r.repeat === 'none' || !r.repeat) return new Date(t).toISOString()
  let guard = 0
  while (t <= now && guard++ < 500) {
    const d = new Date(t)
    if (r.repeat === 'daily') t += DAY
    else if (r.repeat === 'weekly') t += 7 * DAY
    else if (r.repeat === 'monthly') { d.setMonth(d.getMonth() + 1); t = d.getTime() }
    else if (r.repeat === 'weekday') { do { t += DAY } while ([0, 6].includes(new Date(t).getUTCDay())) }
    else return new Date(t).toISOString()
  }
  return new Date(t).toISOString()
}

/**
 * Pengingat dalam aplikasi: dicek tiap 30 detik selama ATLAS terbuka.
 * Beberapa pengingat yang jatuh bersamaan digabung jadi satu toast.
 */
export function ReminderWatcher() {
  const { user, data, save, notify } = useApp()
  const seen = useRef(new Set())
  const [ringing, setRinging] = useState([]) // alarm yang sedang berbunyi di tengah layar
  const beat = useRef(null)
  useEffect(() => {
    if (!user) return
    const tick = async () => {
      const now = Date.now()
      const due = myReminders(data, user).filter((r) => {
        if (!isDue(r, now)) return false
        // sudah ditayangkan baru saja (mis. oleh tab lain) → lewati
        if (r.fired_at && now - new Date(r.fired_at).getTime() < 120000) return false
        return !seen.current.has(`${r.id}:${r.snooze_until || r.at}`)
      })
      if (due.length) setRinging((cur) => [...cur, ...due.filter((r) => !cur.some((x) => x.id === r.id))])
      for (const r of due) {
        seen.current.add(`${r.id}:${r.snooze_until || r.at}`)
        try {
          await save('reminders', {
            ...r, fired_at: new Date().toISOString(), snooze_until: null,
            ...(r.repeat && r.repeat !== 'none' ? { at: nextAt({ ...r, snooze_until: null, fired_at: new Date().toISOString() }, now + 1000) } : { done_at: new Date().toISOString() }),
          })
        } catch { /* abaikan */ }
      }
    }
    tick()
    const t = setInterval(tick, 30000)
    return () => clearInterval(t)
  }, [data.reminders, user]) // eslint-disable-line react-hooks/exhaustive-deps

  // bunyi alarm berulang selama kotak alarm masih terbuka (bisa dimatikan lewat Setting → Suara)
  useEffect(() => {
    clearInterval(beat.current)
    if (!ringing.length || !soundEnabled()) return
    playPing(); beat.current = setInterval(() => playPing(), 4000)
    return () => clearInterval(beat.current)
  }, [ringing.length])

  if (!ringing.length) return null
  const close = () => setRinging([])
  const act = async (r, p, msg) => {
    try { await save('reminders', { ...r, ...p }) } catch { /* abaikan */ }
    setRinging((cur) => cur.filter((x) => x.id !== r.id))
    if (msg) notify(msg)
  }
  return (
    <div role="alertdialog" aria-label="Alarm pengingat" className="fixed inset-0 z-[95] grid place-items-center bg-ink/50 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-amber-200">
        <div className="flex items-center gap-2.5 bg-amber-50 px-5 py-3.5 text-amber-900">
          <span className="grid h-9 w-9 animate-pulse place-items-center rounded-full bg-amber-200"><AlarmClock className="h-5 w-5" /></span>
          <div><p className="text-sm font-extrabold">{ringing.length > 1 ? `${ringing.length} pengingat jatuh tempo` : 'Pengingat'}</p>
            <p className="text-[11px]">{new Date().toLocaleString('id-ID', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} WITA</p></div>
        </div>
        <ul className="max-h-[48vh] divide-y divide-slate-100 overflow-auto">
          {ringing.map((r) => (
            <li key={r.id} className="px-5 py-3">
              <p className="text-[15px] font-bold text-ink">{r.title}</p>
              {r.note && <p className="mt-0.5 whitespace-pre-line text-xs text-ink-soft">{r.note}</p>}
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button type="button" onClick={() => act(r, { snooze_until: new Date(Date.now() + 10 * 60000).toISOString(), done_at: null }, 'Ditunda 10 menit')}
                  className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-ink-soft ring-1 ring-slate-300 hover:ring-brand">Snooze 10 menit</button>
                <button type="button" onClick={() => act(r, { done_at: new Date().toISOString(), snooze_until: null }, 'Pengingat selesai')}
                  className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">Selesai</button>
              </div>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-5 py-3">
          <a href="#/reminders" onClick={close} className="text-xs font-semibold text-brand hover:underline">Buka My Reminders</a>
          <button type="button" onClick={close} className="rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white">Tutup</button>
        </div>
      </div>
    </div>
  )
}

