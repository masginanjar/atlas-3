import { useEffect, useState } from 'react'
import { CalendarRange, Plus, List, CalendarDays, StickyNote, AlarmClock } from 'lucide-react'
import MyReminders from './MyReminders.jsx'
import Calendar from './Calendar.jsx'
import Notes from './Notes.jsx'
import { usePanel } from '../components/WorkspacePanel.jsx'
import { Button, cx } from '../components/ui.jsx'

// ============================================================
//  AGENDA (K5) — Pengingat + Linimasa + Catatan dalam satu menu.
//  Tiga tampilan: Daftar (to-do, pengingat, permintaan rekan), Kalender
//  (tenggat project, to-do, pengingat, libur tim), Catatan. Datanya sama
//  persis dengan tiga halaman lamanya; alamat lama (#/reminders, #/calendar,
//  #/notes) tetap bekerja dan membuka tab yang sesuai.
// ============================================================
export const TAB_AGENDA = [
  ['daftar', 'Daftar', List],
  ['kalender', 'Kalender', CalendarDays],
  ['catatan', 'Catatan', StickyNote],
]
export const tabAgendaDari = (page, param) => (page === 'calendar' ? 'kalender' : page === 'notes' ? 'catatan' : (page === 'reminders' || page === 'todo') ? 'daftar' : (TAB_AGENDA.some(([k]) => k === param) ? param : 'daftar'))

export default function Agenda({ tab: tabProp = 'daftar' }) {
  const { open } = usePanel()
  const [tab, setTab] = useState(tabProp)
  useEffect(() => { setTab(tabProp) }, [tabProp])
  const pilih = (k) => { setTab(k); if (window.location.hash !== `#/agenda/${k}`) window.history.replaceState(null, '', `#/agenda/${k}`) }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2" data-alat>
        <h1 className="mr-1 flex items-center gap-2 text-xl font-extrabold tracking-tight sm:text-2xl"><CalendarRange className="h-5 w-5 text-ink-mute" />Agenda</h1>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]" role="tablist" aria-label="Tampilan agenda" data-tab-agenda>
          {TAB_AGENDA.map(([k, l, Icon]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => pilih(k)} data-tab-agenda-item={k}
              className={cx('flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold ring-1 transition', tab === k ? 'bg-ink text-white ring-ink' : 'bg-white text-ink-soft ring-slate-200 hover:ring-brand')}>
              <Icon className="h-3.5 w-3.5" />{l}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-1.5">
          <Button size="sm" variant="outline" onClick={() => open('todo')} title="To-do baru"><Plus className="h-3.5 w-3.5" />To-do</Button>
          <Button size="sm" variant="outline" onClick={() => open('reminder')} title="Pengingat / alarm baru"><AlarmClock className="h-3.5 w-3.5" /><span className="hidden sm:inline">Pengingat</span></Button>
          <Button size="sm" variant="dark" onClick={() => open('note')} title="Catatan baru"><StickyNote className="h-3.5 w-3.5" /><span className="hidden sm:inline">Catatan</span></Button>
        </div>
      </div>
      <div data-isi-agenda={tab}>
        {tab === 'daftar' && <MyReminders embedded />}
        {tab === 'kalender' && <Calendar embedded />}
        {tab === 'catatan' && <Notes embedded />}
      </div>
    </div>
  )
}
