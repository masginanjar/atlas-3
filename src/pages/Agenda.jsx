import { useEffect, useState, lazy, Suspense } from 'react'
import { CalendarRange, Plus, List, CalendarDays, StickyNote, AlarmClock, ListTodo, Clock, ChevronDown } from 'lucide-react'
import MyReminders from './MyReminders.jsx'
import Calendar from './Calendar.jsx'
import Notes from './Notes.jsx'
import { usePanel } from '../components/WorkspacePanel.jsx'
import { KeAtas } from '../components/SlotAtas.jsx'
import { Button, Sheet, Popover, cx } from '../components/ui.jsx'

const Jadwal = lazy(() => import('./Jadwal.jsx'))

// ============================================================
//  AGENDA (K5) — Kalender + Jadwal + Daftar + Catatan dalam satu menu.
//  Tampilan awal = Kalender. Satu tombol "+" untuk To-do / Pengingat /
//  Catatan (membawa tanggal yang sedang dipilih di kalender).
//  Alamat lama (#/reminders, #/calendar, #/notes) tetap membuka tab yang sesuai.
// ============================================================
export const TAB_AGENDA = [
  ['kalender', 'Kalender', CalendarDays],
  ['jadwal', 'Jadwal', Clock],
  ['daftar', 'Daftar', List],
  ['catatan', 'Catatan', StickyNote],
]
export const tabAgendaDari = (page, param) => (
  page === 'calendar' ? 'kalender'
    : page === 'notes' ? 'catatan'
      : (page === 'reminders' || page === 'todo') ? 'daftar'
        : (TAB_AGENDA.some(([k]) => k === param) ? param : 'kalender'))

const TAMBAH = [
  ['todo', 'To-do', 'Tugas pribadi bertenggat', ListTodo, 'bg-sky-50 text-sky-700'],
  ['reminder', 'Pengingat', 'Alarm sekali atau berulang', AlarmClock, 'bg-amber-50 text-amber-800'],
  ['note', 'Catatan', 'Catatan bebas / tempel', StickyNote, 'bg-emerald-50 text-emerald-800'],
]

export default function Agenda({ tab: tabProp = 'kalender' }) {
  const { open } = usePanel()
  const [tab, setTab] = useState(tabProp)
  const [tanggal, setTanggal] = useState('') // tanggal terpilih di kalender → dibawa ke form To-do
  const [sheet, setSheet] = useState(false)
  useEffect(() => { setTab(tabProp) }, [tabProp])
  const pilih = (k) => { setTab(k); if (window.location.hash !== `#/agenda/${k}`) window.history.replaceState(null, '', `#/agenda/${k}`) }
  const buat = (jenis) => {
    setSheet(false)
    if (jenis === 'todo') open('todo', tanggal ? { todo: { due: tanggal } } : undefined)
    else open(jenis)
  }
  const labelTanggal = tanggal ? new Date(`${tanggal}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }) : ''

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2" data-alat>
        <h1 className="text-[17px] font-extrabold leading-tight tracking-tight flex items-center gap-2">Agenda</h1>
        <KeAtas slot="tambah"><div className="flex items-center gap-1.5">
          {/* HP: satu tombol + → lembar pilihan */}
          <button type="button" onClick={() => setSheet(true)} aria-label="Tambah agenda" data-aksi="tambah-agenda"
            className="grid h-11 w-11 place-items-center rounded-xl bg-[#141B34] text-white shadow-sm sm:hidden"><Plus className="h-5 w-5" /></button>
          {/* PC: menu kecil */}
          <div className="hidden sm:block">
            <Popover label="Tambah agenda" width="min-w-[260px]" button={({ toggle, open: o }) => (
              <button type="button" onClick={toggle} aria-expanded={o} aria-haspopup="menu" data-aksi="tambah-agenda" className="inline-flex h-9 items-center gap-2 rounded-[10px] bg-[#141B34] px-4 text-sm font-semibold text-white hover:opacity-90 dark:bg-[var(--brand)]"><Plus className="h-[18px] w-[18px]" aria-hidden="true" />Agenda<ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden="true" /></button>
            )}>
              {({ close }) => <MenuTambah onPilih={(j) => { close(); buat(j) }} labelTanggal={labelTanggal} />}
            </Popover>
          </div>
        </div></KeAtas>
      {/* Tab bersegmen di baris yang sama dengan judul (HP: keempatnya sama lebar, ≥44px) */}
      <div className="flex min-w-0 flex-1 flex-wrap gap-1.5" role="tablist" aria-label="Tampilan agenda" data-tab-agenda>
        {TAB_AGENDA.map(([k, l, Icon]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => pilih(k)} data-tab-agenda-item={k}
            className={cx('flex h-11 flex-1 items-center justify-center gap-1.5 rounded-[8px] border px-3 text-[12.5px] font-bold transition sm:flex-none md:h-8',
              tab === k ? 'border-[#141B34] bg-[#141B34] text-white' : 'border-[#D9DBE7] bg-white text-[#141B34] hover:border-[#B9BDD0]')}>
            <Icon className="h-3.5 w-3.5" /><span>{l}</span>
          </button>
        ))}
      </div>
      </div>

      <div data-isi-agenda={tab}>
        {tab === 'kalender' && <Calendar embedded onPick={setTanggal} />}
        {tab === 'jadwal' && <Suspense fallback={<p className="p-4 text-sm text-ink-mute">Memuat jadwal…</p>}><Jadwal embedded /></Suspense>}
        {tab === 'daftar' && <MyReminders embedded />}
        {tab === 'catatan' && <Notes embedded />}
      </div>

      <Sheet open={sheet} onClose={() => setSheet(false)} title="Tambah" subtitle={labelTanggal ? `Tanggal terpilih: ${labelTanggal}` : undefined}>
        <MenuTambah onPilih={buat} labelTanggal={labelTanggal} besar />
      </Sheet>
    </div>
  )
}

function MenuTambah({ onPilih, labelTanggal, besar }) {
  return (
    <ul className={cx('space-y-1.5', besar && 'pb-2')}>
      {TAMBAH.map(([k, l, ket, Icon, tone]) => (
        <li key={k}>
          <button type="button" onClick={() => onPilih(k)} data-tambah={k}
            className={cx('flex w-full items-center gap-3 rounded-xl px-3 text-left ring-1 ring-slate-200 hover:ring-brand', besar ? 'min-h-[56px] py-2' : 'min-h-[44px] py-1.5')}>
            <span className={cx('grid h-9 w-9 shrink-0 place-items-center rounded-lg', tone)}><Icon className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-ink">{l}{k === 'todo' && labelTanggal ? <span className="ml-1 text-xs font-semibold text-ink-mute">· {labelTanggal}</span> : null}</span>
              <span className="block text-xs text-ink-mute">{ket}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
