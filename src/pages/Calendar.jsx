import { useMemo, useState, useEffect } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, FolderKanban, ListTodo, AlarmClock, Plus, Plane } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { scopeByBranch, invoiceLabel} from '../config/access.js'
import { TZ } from '../components/WorkspacePanel.jsx'
import { myTodos } from './Todos.jsx'
import { myReminders, nextAt } from './Reminders.jsx'
import { go } from '../lib/router.js'
import { usePanel } from '../components/WorkspacePanel.jsx'
import { Card, Button, cx } from '../components/ui.jsx'
import { indeksJadwal, yangLibur, namaPendek, cabangBolehLihat, isiHari } from '../lib/jadwal.js'
import { shiftLabel } from '../config/shifts.js'
import { BRANCHES, branchesOf } from '../config/access.js'

const dayKey = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(d))
const jam = (d) => new Date(d).toLocaleTimeString('id-ID', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
const DOW = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
const TYPES = {
  deadline: { label: 'Deadline project', icon: FolderKanban, cls: 'bg-[#FFD9E2] text-[#A3123E] ring-transparent' },
  todo: { label: 'To-do', icon: ListTodo, cls: 'bg-[#EEF0F5] text-[#4A4F6A] ring-transparent' },
  reminder: { label: 'Pengingat', icon: AlarmClock, cls: 'bg-[#DFF1FB] text-[#0B5C8A] ring-transparent' },
}
/** Warna titik per jenis agenda — dipakai pada tampilan kalender di HP. */
const DOT = { deadline: 'bg-[#C62828]', todo: 'bg-[#5E6380]', reminder: 'bg-[#0B5C8A]' }

/** Semua item bertanggal — diambil dari sumber data yang sama, tanpa pencatatan tanggal terpisah. */
export function calendarItems(user, data, branchFilter) {
  const out = []
  for (const p of scopeByBranch(user, data.projects, branchFilter)) {
    if (p.about?.deadline) out.push({ id: `p${p.id}`, type: 'deadline', at: p.about.deadline, title: `${invoiceLabel(p.invoice_no)} ${p.customer?.name || ''}`.trim(), open: () => go(`projects/${p.id}`) })
  }
  for (const t of myTodos(data, user)) if (t.due && !t.done) out.push({ id: `t${t.id}`, type: 'todo', at: t.due, title: t.title, ref: { todo: t } })
  for (const r of myReminders(data, user)) { const n = nextAt(r); if (n) out.push({ id: `r${r.id}`, type: 'reminder', at: n, title: r.title, ref: { reminder: r } }) }
  return out
}

export default function Calendar({ embedded, onPick }) {
  const { user, data, branchFilter, nameOf } = useApp()
  const { open } = usePanel()
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() } })
  const [show, setShow] = useState({ deadline: true, todo: true, reminder: true })
  const [pick, setPick] = useState(() => dayKey(new Date())) // tanggal terpilih (HP: kartu di bawah; PC: panel kanan)
  useEffect(() => { onPick?.(pick) }, [pick, onPick])

  const [showLibur, setShowLibur] = useState(true)
  // Siapa yang libur — dibaca dari Jadwal, dibatasi cabang yang boleh dilihat,
  // supaya mudah menghindari menaruh deadline di hari orangnya libur.
  const cabangSaya = useMemo(() => {
    const boleh = cabangBolehLihat(user)
    return branchFilter && branchFilter !== 'Semua' && boleh.includes(branchFilter) ? [branchFilter] : boleh
  }, [user, branchFilter])
  const liburHari = useMemo(() => {
    const peta = indeksJadwal(data.jadwal)
    const out = {}
    for (const r of data.jadwal || []) {
      if (r.shift !== 'libur' || !cabangSaya.includes(r.cabang)) continue
      out[r.tanggal] ||= []
    }
    for (const iso of Object.keys(out)) {
      out[iso] = cabangSaya.flatMap((cb) => yangLibur(peta, iso, cb)
        .map((r) => ({ nama: namaPendek(nameOf(r.user_id)), cabang: cb })))
    }
    return out
  }, [data.jadwal, cabangSaya, nameOf])

  const items = useMemo(() => calendarItems(user, data, branchFilter).filter((i) => show[i.type]), [user, data, branchFilter, show])
  const byDay = useMemo(() => {
    const m = {}
    for (const i of items) (m[dayKey(i.at)] ||= []).push(i)
    for (const k of Object.keys(m)) m[k].sort((a, b) => String(a.at).localeCompare(String(b.at)))
    return m
  }, [items])

  const peta = useMemo(() => indeksJadwal(data.jadwal), [data.jadwal])
  // Jadwal (shift) pada tanggal terpilih — cabang yang boleh dilihat
  const shiftHari = useMemo(() => {
    if (!pick) return []
    return cabangSaya.flatMap((cb) => isiHari(peta, pick, cb).map((r) => ({ nama: namaPendek(nameOf(r.user_id)), shift: r.shift, cabang: cb })))
  }, [peta, pick, cabangSaya, nameOf])
  // Ringkasan minggu berjalan (Senin–Minggu) untuk panel kanan PC
  const minggu = useMemo(() => {
    const t = new Date(); const dow = (t.getDay() + 6) % 7
    const sen = new Date(t.getFullYear(), t.getMonth(), t.getDate() - dow)
    const kunci = Array.from({ length: 7 }, (_, i) => dayKey(new Date(sen.getFullYear(), sen.getMonth(), sen.getDate() + i)))
    const semua = calendarItems(user, data, branchFilter)
    const now = Date.now()
    const dalam = semua.filter((i) => kunci.includes(dayKey(i.at)))
    return {
      kunci,
      deadline: dalam.filter((i) => i.type === 'deadline').length,
      todo: dalam.filter((i) => i.type === 'todo').length,
      terlambat: semua.filter((i) => i.type !== 'reminder' && new Date(i.at).getTime() < now),
      cuti: kunci.flatMap((k) => (liburHari[k] || []).map((x) => ({ ...x, k }))),
    }
  }, [user, data, branchFilter, liburHari])
  const first = new Date(cursor.y, cursor.m, 1)
  const startPad = (first.getDay() + 6) % 7 // Senin = 0
  const days = new Date(cursor.y, cursor.m + 1, 0).getDate()
  const cells = [...Array(startPad).fill(null), ...Array.from({ length: days }, (_, i) => new Date(cursor.y, cursor.m, i + 1))]
  const todayK = dayKey(new Date())
  const move = (d) => setCursor((c) => { const n = new Date(c.y, c.m + d, 1); return { y: n.getFullYear(), m: n.getMonth() } })
  const keHariIni = () => { const d = new Date(); setCursor({ y: d.getFullYear(), m: d.getMonth() }); setPick(todayK) }

  const openItem = (i) => { if (i.open) i.open(); else if (i.ref?.todo) open('todo', { todo: i.ref.todo }); else if (i.ref?.reminder) open('reminder', { reminder: i.ref.reminder }) }

  return (
    <div className="space-y-3">
      {!embedded && <div>
        <h1 className="text-[17px] font-extrabold leading-tight tracking-tight flex items-center gap-2"><CalendarDays className="h-5 w-5 text-ink-mute" />Linimasa</h1>
        <p className="text-sm text-ink-soft">Deadline project, to-do, dan pengingat dalam satu tampilan — sumbernya data yang sama.</p>
      </div>}

      {/* Baris alat: ‹ Bulan › · Hari ini · legenda yang sekaligus saringan */}
      <div className="flex flex-wrap items-center gap-2" data-alat-kalender>
        <div className="flex items-center gap-0.5 rounded-xl bg-white p-0.5 ring-1 ring-slate-200">
          <button type="button" onClick={() => move(-1)} aria-label="Bulan sebelumnya" className="grid h-10 w-10 place-items-center rounded-lg text-ink-soft hover:bg-slate-100"><ChevronLeft className="h-4 w-4" /></button>
          <span className="min-w-[128px] text-center text-sm font-bold" data-label-bulan>{first.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</span>
          <button type="button" onClick={() => move(1)} aria-label="Bulan berikutnya" className="grid h-10 w-10 place-items-center rounded-lg text-ink-soft hover:bg-slate-100"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <button type="button" onClick={keHariIni} className="h-11 rounded-xl bg-white px-3 text-xs font-semibold text-ink-soft ring-1 ring-slate-200 hover:ring-brand">Hari ini</button>
        <div className="-mx-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-1 py-0.5 [scrollbar-width:none] sm:justify-end" role="group" aria-label="Saring jenis agenda">
          {Object.entries(TYPES).map(([k, t]) => (
            <button key={k} type="button" onClick={() => setShow((s) => ({ ...s, [k]: !s[k] }))} aria-pressed={show[k]} data-saring={k}
              className={cx('inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold ring-1 transition', show[k] ? t.cls : 'bg-white text-ink-mute ring-slate-200 line-through decoration-slate-300')}>
              <span className={cx('h-2 w-2 rounded-full', show[k] ? DOT[k] : 'bg-slate-300')} />{t.label.replace('Deadline project', 'Deadline')}
            </button>
          ))}
          <button type="button" onClick={() => setShowLibur((v) => !v)} aria-pressed={showLibur} data-saring="libur"
            className={cx('inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold ring-1 transition',
              showLibur ? 'bg-rose-50 text-rose-700 ring-rose-200' : 'bg-white text-ink-mute ring-slate-200 line-through decoration-slate-300')}>
            <Plane className="h-3.5 w-3.5" />Libur
          </button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <div className="min-w-0 space-y-3">
      <Card className="overflow-hidden p-0">
        <div className="grid grid-cols-7 bg-[#E6E8F2] text-center text-xs font-semibold text-[#3F4563] dark:bg-white/10 dark:text-slate-200">
          {DOW.map((d) => <span key={d} className="py-2">{d}</span>)}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) => {
            const k = d ? dayKey(d) : ''
            const list = (k && byDay[k]) || []
            const kinds = [...new Set(list.map((x) => x.type))]
            return (
              <div key={i} className={cx('border-b border-r border-[#E7E8F0] last:border-r-0 md:min-h-[92px] md:p-1.5 dark:border-white/10', !d && 'bg-[#FAFAFC] dark:bg-white/[.02]')}>
                {/* HP: hanya tanggal + titik/jumlah; ketuk untuk melihat jam lengkapnya */}
                <button type="button" disabled={!d} onClick={() => setPick(k === pick ? '' : k)} aria-label={d ? `${d.getDate()} — ${list.length} agenda` : undefined}
                  className={cx('flex h-14 w-full flex-col items-center justify-center gap-1 md:hidden', k === pick && 'bg-brand-soft ring-1 ring-inset ring-brand')}>
                  {d && <span className={cx('text-xs font-bold', k === todayK ? 'text-brand' : 'text-ink')}>{d.getDate()}</span>}
                  {list.length > 0 && (list.length > 3
                    ? <span className="rounded-full bg-ink px-1.5 text-[10px] font-bold text-white">{list.length}</span>
                    : <span className="flex gap-0.5">{kinds.map((t) => <span key={t} className={cx('h-1.5 w-1.5 rounded-full', DOT[t])} />)}</span>)}
                  {showLibur && (liburHari[k] || []).length > 0 && <Plane className="h-2.5 w-2.5 text-rose-500" />}
                </button>
                {/* md ke atas: daftar agenda seperti biasa */}
                <div className="group/day relative hidden md:block">
                  {d && (
                    <div className="mb-1 flex items-center gap-1">
                      <button type="button" onClick={() => setPick(k)} aria-label={`Pilih tanggal ${d.getDate()}`}
                        className={cx('grid h-[26px] min-w-[26px] place-items-center rounded-full px-1 text-xs font-bold hover:bg-[#F3F4F9]', k === todayK ? 'bg-[#141B34] text-white hover:bg-[#141B34]' : k === pick ? 'bg-[#DFF1FB] text-[#0B5C8A]' : 'text-[#141B34]')}>{d.getDate()}</button>
                      {/* tanda + : buat To-do pada tanggal ini */}
                      <button type="button" onClick={() => open('todo', { todo: { due: k } })}
                        aria-label={`Buat to-do tanggal ${d.getDate()}`} title="Buat To-do pada tanggal ini"
                        className="ml-auto grid h-5 w-5 place-items-center rounded text-ink-mute opacity-0 transition hover:bg-brand hover:text-white focus:opacity-100 group-hover/day:opacity-100">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  {showLibur && (liburHari[k] || []).length > 0 && (
                    <p className="mb-0.5 flex items-start gap-1 rounded bg-rose-50 px-1 py-0.5 text-[10px] font-semibold text-rose-700"
                      title={`Libur: ${(liburHari[k] || []).map((x) => `${x.nama} (${x.cabang})`).join(', ')}`}>
                      <Plane className="mt-px h-2.5 w-2.5 shrink-0" />
                      <span className="min-w-0 truncate">{(liburHari[k] || []).map((x) => x.nama).join(', ')}</span>
                    </p>
                  )}
                  <ul className="space-y-0.5">
                    {list.slice(0, 3).map((it) => (
                      <li key={it.id}>
                        <button type="button" onClick={() => openItem(it)} title={`${jam(it.at)} · ${it.title}`}
                          className={cx('block w-full truncate rounded-md px-1.5 py-0.5 text-left text-[11px] font-semibold', TYPES[it.type].cls)}>
                          {jam(it.at)} {it.title}
                        </button>
                      </li>
                    ))}
                    {list.length > 3 && <li className="px-1.5 text-[10px] text-ink-mute">+{list.length - 3} lagi</li>}
                  </ul>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* HP: rincian tanggal yang diketuk — jam lengkap & judulnya */}
      <Card className="p-4 lg:hidden">
        {!pick ? <p className="text-sm text-ink-mute">Ketuk sebuah tanggal untuk melihat jam dan rincian agendanya.</p> : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <p className="min-w-0 flex-1 text-sm font-bold">{new Date(`${pick}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <Button size="sm" variant="outline" onClick={() => open('todo', { todo: { due: pick } })}><Plus className="h-3.5 w-3.5" />To-do</Button>
            </div>
            {showLibur && (liburHari[pick] || []).length > 0 && (
              <p className="mt-1.5 flex flex-wrap items-center gap-1 rounded-lg bg-rose-50 px-2 py-1.5 text-xs font-semibold text-rose-700">
                <Plane className="h-3.5 w-3.5" />Libur: {(liburHari[pick] || []).map((x) => `${x.nama} (${x.cabang})`).join(', ')}
              </p>
            )}
            {(byDay[pick] || []).length === 0 ? <p className="mt-1 text-sm text-ink-mute">Tidak ada agenda pada tanggal ini.</p> : (
              <ul className="mt-2 space-y-1.5">
                {(byDay[pick] || []).map((it) => (
                  <li key={it.id}>
                    <button type="button" onClick={() => openItem(it)} className={cx('flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold ring-1', TYPES[it.type].cls)}>
                      <span className="shrink-0 tabular-nums">{jam(it.at)}</span><span className="min-w-0 flex-1">{it.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Card>
      </div>

      {/* PC: panel kanan — agenda tanggal terpilih, jadwal hari itu, ringkasan minggu */}
      <aside className="hidden space-y-3 lg:block" data-panel-kalender>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 text-sm font-bold">{pick ? new Date(`${pick}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' }) : 'Pilih tanggal'}</p>
            {pick && <Button size="sm" variant="outline" onClick={() => open('todo', { todo: { due: pick } })}><Plus className="h-3.5 w-3.5" />To-do</Button>}
          </div>
          {showLibur && (liburHari[pick] || []).length > 0 && (
            <p className="mt-2 flex flex-wrap items-center gap-1 rounded-lg bg-rose-50 px-2 py-1.5 text-xs font-semibold text-rose-700">
              <Plane className="h-3.5 w-3.5" />Libur: {(liburHari[pick] || []).map((x) => `${x.nama} (${x.cabang})`).join(', ')}
            </p>
          )}
          {(byDay[pick] || []).length === 0 ? <p className="mt-2 text-sm text-ink-mute">Tidak ada agenda.</p> : (
            <ul className="mt-2 max-h-[300px] space-y-1.5 overflow-y-auto pr-0.5">
              {(byDay[pick] || []).map((it) => (
                <li key={it.id}>
                  <button type="button" onClick={() => openItem(it)} className={cx('flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold ring-1', TYPES[it.type].cls)}>
                    <span className="shrink-0 tabular-nums">{jam(it.at)}</span><span className="min-w-0 flex-1 break-words">{it.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-mute">Jadwal hari ini{cabangSaya.length === 1 ? ` · ${cabangSaya[0]}` : ''}</p>
          {shiftHari.length === 0 ? <p className="mt-1.5 text-sm text-ink-mute">Belum ada jadwal shift.</p> : (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {shiftHari.map((r, i) => (
                <span key={i} className={cx('inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold ring-1',
                  r.shift === 'libur' ? 'bg-rose-50 text-rose-700 ring-rose-200' : 'bg-slate-50 text-ink ring-slate-200')}>
                  {r.nama}<span className="text-ink-mute">· {shiftLabel(r.shift)}{cabangSaya.length > 1 ? ` · ${r.cabang}` : ''}</span>
                </span>
              ))}
            </div>
          )}
          <button type="button" onClick={() => go('agenda/jadwal')} className="mt-2 text-xs font-semibold text-brand hover:underline">Buka Jadwal →</button>
        </Card>

        <Card className="p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-mute">Minggu ini</p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-rose-50 p-2"><p className="text-lg font-extrabold text-rose-700">{minggu.deadline}</p><p className="text-[10px] font-semibold text-rose-700/80">Deadline</p></div>
            <div className="rounded-xl bg-sky-50 p-2"><p className="text-lg font-extrabold text-sky-700">{minggu.todo}</p><p className="text-[10px] font-semibold text-sky-700/80">To-do</p></div>
            <div className="rounded-xl bg-amber-50 p-2"><p className="text-lg font-extrabold text-amber-800">{minggu.terlambat.length}</p><p className="text-[10px] font-semibold text-amber-800/80">Terlambat</p></div>
          </div>
          {minggu.terlambat.length > 0 && (
            <ul className="mt-2 space-y-1">
              {minggu.terlambat.slice(0, 4).map((it) => (
                <li key={it.id}><button type="button" onClick={() => openItem(it)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-slate-50">
                  <span className={cx('h-2 w-2 shrink-0 rounded-full', DOT[it.type])} /><span className="min-w-0 flex-1 truncate font-semibold">{it.title}</span>
                  <span className="shrink-0 text-[10px] text-ink-mute">{new Date(it.at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span></button></li>
              ))}
              {minggu.terlambat.length > 4 && <li className="px-2 text-[11px] text-ink-mute">+{minggu.terlambat.length - 4} lagi</li>}
            </ul>
          )}
          <p className="mt-3 text-xs font-bold uppercase tracking-wider text-ink-mute">Cuti / libur</p>
          {minggu.cuti.length === 0 ? <p className="mt-1 text-xs text-ink-mute">Tidak ada yang libur minggu ini.</p> : (
            <ul className="mt-1 space-y-0.5 text-xs">
              {minggu.cuti.slice(0, 6).map((x, i) => <li key={i} className="flex items-center gap-2"><Plane className="h-3 w-3 text-rose-500" /><span className="font-semibold">{x.nama}</span><span className="text-ink-mute">{x.cabang} · {new Date(`${x.k}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' })}</span></li>)}
            </ul>
          )}
        </Card>
      </aside>
      </div>

      <p className="text-[11px] text-ink-mute">Kalender menampilkan tanggal yang sudah ada di project, to-do, dan pengingat Anda. Tanda libur dibaca dari menu Jadwal — berguna agar deadline tidak jatuh saat orangnya libur.</p>
    </div>
  )
}
