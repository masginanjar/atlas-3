import { Fragment, useMemo, useState } from 'react'
import { Lock, Languages, Store, Stamp, UserCog, Calculator, ChevronDown, ChevronUp, MonitorCheck, AlertTriangle } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { tasksOf, summarize, dayKey } from '../lib/performance.js'
import { stageLabel, flowOf, DONE, totalPengajuan, termOf, isBilled, PAYMENT_TERMS } from '../config/workflows.js'
import { placeOf, invoiceLabel} from '../config/access.js'
import { rupiah, stageArrivedAt } from '../lib/format.js'
import TimeAgo from '../components/TimeAgo.jsx'
import { Card, Empty, Input, cx } from '../components/ui.jsx'
import { useTabel, Th } from '../components/TabelSortir.jsx'
import { addDays } from '../lib/performance.js'

import { canMonitor } from '../config/menuAccess.js'
export { canMonitor }

const dlText = (t, now) => {
  const late = t.dl.at < now
  const d = Math.round((new Date(`${t.dl.day}T12:00:00+08:00`) - new Date(`${dayKey(now)}T12:00:00+08:00`)) / 864e5)
  return { late, txt: late ? (d < 0 ? `Terlambat ${-d} hr` : `Lewat jam ${t.dl.time}`) : d === 0 ? `Hari ini ${t.dl.time}` : d === 1 ? `Besok ${t.dl.time}` : `${d} hari lagi` }
}

/** Kartu seksi yang bisa di-minimize. */
function Section({ id, icon: Icon, title, tone, chips, children }) {
  const k = `atlas-fold-mon-${id}`
  const [open, setOpen] = useState(() => { try { return localStorage.getItem(k) !== '0' } catch { return true } })
  const toggle = () => setOpen((o) => { try { localStorage.setItem(k, o ? '0' : '1') } catch { /* abaikan */ } return !o })
  return (
    <Card className="overflow-hidden">
      <div className={cx('card-head flex flex-wrap items-center gap-2 px-4 py-3', tone)}>
        <Icon className="h-4 w-4" /><h2 className="font-bold">{title}</h2>
        <div className="flex flex-wrap gap-1.5">{chips?.filter(Boolean).map(([label, v, warn], i) => <span key={i} className={cx('rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold ring-1', warn ? 'text-rose-700 ring-rose-200' : 'text-ink-soft ring-slate-200')}>{label} <b>{v}</b></span>)}</div>
        <button type="button" onClick={toggle} aria-expanded={open} aria-label={`${open ? 'Tutup' : 'Buka'} ${title}`} className="fold ml-auto grid h-8 w-8 place-items-center rounded-lg bg-white text-ink-soft ring-1 ring-slate-200 hover:text-brand"><ChevronUp className={cx('h-4 w-4 transition-transform', !open && 'rotate-180')} /></button>
      </div>
      {open && children}
    </Card>
  )
}

/** Tabel per orang: tugas aktif, terlambat, progres hari ini; klik baris untuk melihat daftar tugasnya. */
/** Kolom tabel Vendor — judulnya bisa diklik untuk mengurutkan. */
const KOLOM_VENDOR = [
  { key: 'vendor', label: 'Vendor', sort: (r) => r.v.name.toLowerCase() },
  { key: 'acc', label: 'Menunggu ACC', num: true, sort: (r) => r.acc.length },
  { key: 'pay', label: 'Menunggu bayar', num: true, sort: (r) => r.pay.length },
  { key: 'work', label: 'Dikerjakan', num: true, sort: (r) => r.work.length },
  { key: 'unbilled', label: 'Belum ditagih', num: true, sort: (r) => r.unbilled.length },
  { key: 'halaman', label: 'Halaman dikerjakan', num: true, sort: (r) => r.done.pages },
  { key: 'bills', label: 'Tagihan proses', num: true, sort: (r) => r.bills.length },
  { key: 'nilai', label: 'Nilai berjalan', num: true, sort: (r) => r.value },
]

function PeopleTable({ people, projects, now, extraCols = [] }) {
  const [openId, setOpenId] = useState(null)
  const today = dayKey(now)
  const rows = useMemo(() => people.map((u) => {
    const all = tasksOf(u, projects)
    const active = all.filter((t) => t.status === 'active').sort((a, b) => a.dl.at - b.dl.at)
    const s = summarize(u, projects, today, now)
    return { u, active, late: active.filter((t) => t.dl.at < now).length, todayN: active.filter((t) => t.dl.day === today).length, s,
      pages: active.reduce((a, t) => a + (Number(t.sub.pages) || 0), 0) }
  }).sort((a, b) => b.late - a.late || b.active.length - a.active.length || a.u.name.localeCompare(b.u.name)), [people, projects, today, now])
  // Judul kolom bisa diklik untuk mengurutkan; kolom tambahan per-role ikut.
  const kolomOrang = useMemo(() => [
    { key: 'nama', label: 'Nama', sort: (r) => r.u.name.toLowerCase() },
    { key: 'aktif', label: 'Tugas aktif', num: true, sort: (r) => r.active.length },
    { key: 'telat', label: 'Terlambat', num: true, sort: (r) => r.late },
    { key: 'hariini', label: 'Deadline hari ini', num: true, sort: (r) => r.todayN },
    ...extraCols.map((c, i) => ({ key: `x${i}`, label: c.label, num: true, sort: (r) => Number(c.get(r)) || 0 })),
    { key: 'performa', label: 'Performa hari ini', sort: (r) => (r.s.pct == null ? -1 : r.s.pct) },
    { key: 'terdekat', label: 'Tugas terdekat' },
  ], [extraCols])
  const { rows: urut, sortKey, sortDir, klikJudul } = useTabel(rows, kolomOrang)
  if (!rows.length) return <Empty title="Belum ada orang dengan role ini" />
  const TaskList = ({ r }) => (r.active.length === 0 ? <p className="py-2 text-xs text-ink-mute">Tidak ada tugas aktif.</p> : (
    <ul className="space-y-1.5">{r.active.map((t) => (
      <li key={t.sub.id} className="rounded-lg bg-white p-2 text-xs ring-1 ring-slate-200">
        <a href={`#/projects/${t.project.id}`} className="font-bold text-brand hover:underline">{invoiceLabel(t.project.invoice_no)}</a>
        <p className="truncate">{t.sub.title}{t.sub.pages ? ` · ${t.sub.pages} hlm` : ''}</p>
        <p className="text-ink-mute">{stageLabel(t.flow, t.sub.stage)} · <span className={cx(dlText(t, now).late && 'font-semibold text-rose-600')}>{dlText(t, now).txt}</span></p>
      </li>
    ))}</ul>
  ))
  return (
    <>
    {/* HP: tiap orang jadi kartu — nama, tugas aktif, terlambat, deadline terdekat */}
    <ul className="space-y-2 md:hidden">{rows.map((r) => {
      const isOpen = openId === r.u.id; const next = r.active[0]
      return (
        <li key={r.u.id} className={cx('rounded-2xl bg-white p-4 ring-1', isOpen ? 'ring-brand' : 'ring-slate-200')}>
          <button type="button" onClick={() => setOpenId(isOpen ? null : r.u.id)} aria-expanded={isOpen} className="flex w-full items-start gap-2 text-left">
            <span className="min-w-0 flex-1">
              <b className="block truncate text-sm">{r.u.name}</b>
              <span className="block truncate text-xs text-ink-mute">{placeOf(r.u)}{r.u.active === false ? ' · nonaktif' : ''}</span>
            </span>
            <ChevronDown className={cx('mt-0.5 h-5 w-5 shrink-0 text-ink-mute transition', isOpen && 'rotate-180')} />
          </button>
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold">Tugas aktif <b>{r.active.length}</b></span>
            <span className={cx('rounded-full px-2 py-0.5 font-semibold', r.late ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-200' : 'bg-slate-100')}>Terlambat <b>{r.late}</b></span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold">Deadline hari ini <b>{r.todayN}</b></span>
            {extraCols.map((c) => <span key={c.label} className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold">{c.label} <b>{c.get(r)}</b></span>)}
          </div>
          {r.s.pct !== null && (
            <p className="mt-2 flex items-center gap-2 text-xs"><span className="h-2 w-20 overflow-hidden rounded-full bg-slate-100"><span className={cx('block h-full rounded-full', r.s.pct >= 80 ? 'bg-emerald-500' : r.s.pct >= 50 ? 'bg-amber-400' : 'bg-orange-400')} style={{ width: `${r.s.pct}%` }} /></span><b className="tabular-nums">{r.s.pct}%</b><span className="text-ink-mute">{r.s.done.length}/{r.s.total} hari ini</span></p>
          )}
          {next && <p className="mt-2 text-xs"><span className="text-ink-mute">Tugas terdekat: </span><b>{invoiceLabel(next.project.invoice_no)}</b> · {next.sub.title}<span className={cx('block', dlText(next, now).late ? 'font-semibold text-rose-600' : 'text-ink-mute')}>{dlText(next, now).txt}</span></p>}
          {isOpen && <div className="mt-2 border-t border-slate-100 pt-2"><TaskList r={r} /></div>}
        </li>
      )
    })}</ul>
    <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[760px] text-sm">
      <thead><tr>
        {kolomOrang.map((c) => <Th key={c.key} kolom={c} sortKey={sortKey} sortDir={sortDir} onKlik={klikJudul} className={c.key === 'nama' ? 'px-4' : undefined} />)}
        <th className="w-8 border-b border-slate-200 bg-slate-50" /></tr></thead>
      <tbody className="divide-y divide-slate-100">{urut.map((r) => {
        const isOpen = openId === r.u.id; const next = r.active[0]
        return (
          <Fragment key={r.u.id}>
            <tr className={cx('cursor-pointer align-middle hover:bg-slate-50', isOpen && 'bg-brand-soft/40')} onClick={() => setOpenId(isOpen ? null : r.u.id)}>
              <td className="px-4 py-2.5"><b>{r.u.name}</b><p className="text-[11px] text-ink-mute">{placeOf(r.u)}{r.u.active === false ? ' · nonaktif' : ''}</p></td>
              <td className="px-2 py-2.5 text-right font-bold tabular-nums">{r.active.length}</td>
              <td className={cx('px-2 py-2.5 text-right tabular-nums', r.late ? 'font-bold text-rose-600' : 'text-ink-mute')}>{r.late}</td>
              <td className="px-2 py-2.5 text-right tabular-nums">{r.todayN}</td>
              {extraCols.map((c) => <td key={c.label} className="px-2 py-2.5 text-right tabular-nums">{c.get(r)}</td>)}
              <td className="px-2 py-2.5">{r.s.pct === null ? <span className="text-xs text-ink-mute">Belum ada deadline</span> : (
                <span className="flex items-center gap-2"><span className="h-2 w-20 overflow-hidden rounded-full bg-slate-100"><span className={cx('block h-full rounded-full', r.s.pct >= 80 ? 'bg-emerald-500' : r.s.pct >= 50 ? 'bg-amber-400' : 'bg-orange-400')} style={{ width: `${r.s.pct}%` }} /></span><b className="text-xs tabular-nums">{r.s.pct}%</b><span className="text-[11px] text-ink-mute">{r.s.done.length}/{r.s.total}</span></span>)}</td>
              <td className="max-w-[240px] px-4 py-2.5 text-xs">{next ? <><b>{invoiceLabel(next.project.invoice_no)}</b> · {next.sub.title}<p className={cx(dlText(next, now).late ? 'font-semibold text-rose-600' : 'text-ink-mute')}>{dlText(next, now).txt}</p></> : <span className="text-ink-mute">—</span>}</td>
              <td className="pr-3 text-ink-mute"><ChevronDown className={cx('h-4 w-4 transition', isOpen && 'rotate-180')} /></td>
            </tr>
            {isOpen && <tr><td colSpan={7 + extraCols.length} className="bg-slate-50/60 px-4 py-2">
              {r.active.length === 0 ? <p className="py-2 text-xs text-ink-mute">Tidak ada tugas aktif.</p> : (
                <table className="w-full text-xs"><thead className="text-left text-[10px] uppercase tracking-wide text-ink-mute"><tr><th className="py-1">Invoice</th><th>Dokumen</th><th>Tahap</th><th>Masuk</th><th className="text-right">Deadline</th></tr></thead>
                  <tbody className="divide-y divide-slate-200/70">{r.active.map((t) => (
                    <tr key={t.sub.id}><td className="py-1.5"><a href={`#/projects/${t.project.id}`} className="font-bold text-brand hover:underline">{invoiceLabel(t.project.invoice_no)}</a></td>
                      <td className="max-w-[260px] truncate">{t.sub.title}{t.sub.lang_from ? ` · ${t.sub.lang_from}→${t.sub.lang_to}` : ''}{t.sub.pages ? ` · ${t.sub.pages} hlm` : ''}</td>
                      <td className="font-semibold text-brand">{stageLabel(t.flow, t.sub.stage)}</td>
                      <td><TimeAgo at={stageArrivedAt(t.sub, t.project)} icon={false} /></td>
                      <td className={cx('text-right', dlText(t, now).late && 'font-semibold text-rose-600')}>{dlText(t, now).txt}</td></tr>
                  ))}</tbody></table>
              )}
            </td></tr>}
          </Fragment>
        )
      })}</tbody>
    </table></div>
    </>
  )
}

export default function Monitoring() {
  const { user, data } = useApp()
  const [now] = useState(() => new Date())
  // rentang tanggal untuk rekap hasil kerja (dokumen/halaman selesai) — default bulan berjalan
  const today = dayKey(now)
  const [range, setRange] = useState({ from: `${today.slice(0, 7)}-01`, to: today })
  const inRange = (iso) => { if (!iso) return false; const d = dayKey(new Date(iso)); return d >= range.from && d <= range.to }
  const docStats = (docs = [], pages = 0) => { const reg = docs.filter((d) => (d.kind || 'reguler') !== 'non_reguler').length; const non = docs.filter((d) => d.kind === 'non_reguler').length; return { reg: docs.length ? reg : 1, non, pages: Number(pages) || 0 } }
  const projects = useMemo(() => data.projects.filter((p) => !p.archive && !p.cancelled), [data.projects])
  const realProjects = useMemo(() => projects.filter((p) => !p.demo_perf), [projects])
  const usersOf = (role) => data.users.filter((u) => u.active !== false && (u.role === role || (u.extra_roles || []).includes(role)))
  const subs = useMemo(() => realProjects.flatMap((p) => (p.sub_projects || []).map((s) => ({ ...s, project: p, flow: flowOf(s, p) }))), [projects])

  // ---------- rekap penerjemah & proofreader dalam rentang ----------
  const allSubs = useMemo(() => projects.flatMap((p) => (p.sub_projects || []).map((s) => ({ ...s, project: p, flow: flowOf(s, p) }))), [projects])
  const trDone = (uid) => allSubs.filter((s) => (s.data?.translator === uid || s.translator === uid) && inRange(s.data?.translated_at))
    .reduce((a, s) => { const d = docStats(s.docs, s.pages); return { reg: a.reg + d.reg, non: a.non + d.non, pages: a.pages + d.pages } }, { reg: 0, non: 0, pages: 0 })
  const prDone = (uid) => allSubs.filter((s) => s.data?.proofreader === uid && inRange(s.data?.proofread_at))
    .reduce((a, s) => { const d = docStats(s.docs, s.pages); return { n: a.n + d.reg + d.non, pages: a.pages + d.pages } }, { n: 0, pages: 0 })
  const vendorDone = (vid) => allSubs.filter((s) => s.data?.vendor === vid && (s.stage === DONE || ['proses_vendor'].includes(s.stage) === false && s.data?.hasil_vendor) && inRange(s.data?.hasil_vendor?.uploaded_at || s.data?.received_at || s.stage_at))
    .reduce((a, s) => ({ n: a.n + 1, pages: a.pages + (Number(s.pages) || 0) }), { n: 0, pages: 0 })

  // ---------- vendor ----------
  const vendors = data.people.filter((p) => p.type === 'vendor')
  const vRows = useMemo(() => vendors.map((v) => {
    const mine = subs.filter((s) => s.data?.vendor === v.id && s.stage !== DONE && !s.cancelled)
    const by = (st) => mine.filter((s) => st.includes(s.stage))
    const unbilled = isBilled(v) ? subs.filter((s) => s.data?.vendor === v.id && s.flow === 'tr_bill' && !s.data?.bill_id) : []
    const bills = (data.vendor_bills || []).filter((b) => b.vendor_id === v.id && ['menunggu', 'disetujui'].includes(b.status))
    return { v, mine, acc: by(['pengajuan', 'persetujuan']), pay: by(['pembayaran']), work: by(['dibayar', 'kirim', 'dikirim', 'order', 'proses_vendor']), unbilled, bills, done: vendorDone(v.id),
      value: mine.reduce((a, s) => a + (totalPengajuan(s.data) || Number(s.data?.vendor_cost) || 0), 0) }
  }).filter((r) => r.mine.length || r.unbilled.length || r.bills.length || r.done.n).sort((a, b) => b.mine.length - a.mine.length), [vendors, subs, data.vendor_bills, range]) // eslint-disable-line react-hooks/exhaustive-deps
  const { rows: vUrut, sortKey: vSortKey, sortDir: vSortDir, klikJudul: vKlik } = useTabel(vRows, KOLOM_VENDOR)
  const [vOpen, setVOpen] = useState(null)

  // ---------- staf apostille: antrian belum ditugaskan ----------
  const apUnassigned = subs.filter((s) => ['ap_int', 'lg_int'].includes(s.flow) && s.stage === 'antrian' && !s.data?.staff_apostille).length
  // ---------- supervisor & akunting: ringkasan antrian ----------
  const needTr = subs.filter((s) => s.flow === 'tr_int' && s.stage === 'pilih_penerjemah').length
  const payQueue = subs.filter((s) => s.stage === 'pembayaran')
  const reqQueue = (data.requests || []).filter((r) => r.status === 'disetujui')
  const billQueue = (data.vendor_bills || []).filter((b) => b.status === 'disetujui')

  if (!canMonitor(user)) return <Card><Empty icon={Lock} title="Halaman Monitoring hanya untuk Superadmin" /></Card>

  const tr = usersOf('penerjemah'); const ap = usersOf('staf_apostille'); const spv = usersOf('supervisor'); const acc = usersOf('akunting')
  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-tight sm:text-2xl"><MonitorCheck className="h-6 w-6" />Monitoring</h1>
        <p className="text-[13px] text-ink-mute">Daftar tugas & pekerjaan tiap orang. Klik baris untuk melihat rincian tugasnya. Hanya terlihat oleh Superadmin.</p>
      </div>
      <Card className="flex flex-wrap items-center gap-2 px-4 py-2.5">
        <span className="text-xs font-bold uppercase tracking-wide text-ink-mute">Rekap hasil kerja</span>
        <label className="flex items-center gap-1 text-xs text-ink-soft">Dari <Input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className="!h-8 !w-[150px] !px-2 text-xs" /></label>
        <label className="flex items-center gap-1 text-xs text-ink-soft">Sampai <Input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className="!h-8 !w-[150px] !px-2 text-xs" /></label>
        <span className="flex flex-wrap gap-1">
          {[['Hari ini', today, today], ['7 hari', addDays(today, -6), today], ['Bulan ini', `${today.slice(0, 7)}-01`, today], ['Bulan lalu', (() => { const d = new Date(`${today.slice(0, 7)}-01T12:00:00+08:00`); d.setMonth(d.getMonth() - 1); return dayKey(d).slice(0, 7) + '-01' })(), addDays(`${today.slice(0, 7)}-01`, -1)]].map(([l, f, t]) => (
            <button key={l} type="button" onClick={() => setRange({ from: f, to: t })} className={cx('rounded-lg px-2 py-1 text-[11px] font-semibold ring-1', range.from === f && range.to === t ? 'bg-brand text-white ring-brand' : 'bg-white text-ink-soft ring-slate-200 hover:ring-brand')}>{l}</button>
          ))}
        </span>
        <span className="ml-auto text-[11px] text-ink-mute">Kolom "Dok. diterjemahkan", "Diproofread", dan "Halaman dikerjakan" mengikuti rentang ini.</span>
      </Card>

      <Section id="tr" icon={Languages} title={`Penerjemah (${tr.length})`} tone="bg-indigo-50"
        chips={[['Sedang diterjemahkan', subs.filter((s) => ['tr_int', 'tr_nt'].includes(s.flow) && s.stage === 'penerjemahan').length], ['Perlu penerjemah', needTr, needTr > 0]]}>
        <PeopleTable people={tr} projects={projects} now={now} extraCols={[
          { label: 'Halaman aktif', get: (r) => r.pages },
          { label: 'Dok. diterjemahkan (Reg / Non)', get: (r) => { const d = trDone(r.u.id); return <span title={`${d.pages} halaman`}><b>{d.reg + d.non}</b> <span className="text-ink-mute">({d.reg} / {d.non})</span> <span className="text-[10px] text-ink-mute">· {d.pages} hlm</span></span> } },
          { label: 'Diproofread', get: (r) => { const d = prDone(r.u.id); return <span title={`${d.pages} halaman`}><b>{d.n}</b> <span className="text-[10px] text-ink-mute">· {d.pages} hlm</span></span> } },
        ]} />
      </Section>

      <Section id="vendor" icon={Store} title={`Vendor (${vRows.length} aktif)`} tone="bg-violet-50"
        chips={[['Menunggu ACC', vRows.reduce((a, r) => a + r.acc.length, 0)], ['Menunggu bayar', vRows.reduce((a, r) => a + r.pay.length, 0)], ['Dikerjakan', vRows.reduce((a, r) => a + r.work.length, 0)], ['Nilai berjalan', rupiah(vRows.reduce((a, r) => a + r.value, 0))]]}>
        {vRows.length === 0 ? <Empty title="Tidak ada pekerjaan vendor berjalan" /> : (<>
          {/* HP: tiap vendor jadi kartu */}
          <ul className="space-y-2 md:hidden">{vRows.map((r) => {
            const isOpen = vOpen === r.v.id
            return (
              <li key={r.v.id} className={cx('rounded-2xl bg-white p-4 ring-1', isOpen ? 'ring-brand' : 'ring-slate-200')}>
                <button type="button" onClick={() => setVOpen(isOpen ? null : r.v.id)} aria-expanded={isOpen} className="flex w-full items-start gap-2 text-left">
                  <span className="min-w-0 flex-1"><b className="block truncate text-sm">{r.v.name}</b><span className="block text-xs text-ink-mute">{PAYMENT_TERMS[termOf(r.v)].short}</span></span>
                  <ChevronDown className={cx('mt-0.5 h-5 w-5 shrink-0 text-ink-mute transition', isOpen && 'rotate-180')} />
                </button>
                <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold">Menunggu ACC <b>{r.acc.length}</b></span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold">Menunggu bayar <b>{r.pay.length}</b></span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold">Dikerjakan <b>{r.work.length}</b></span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold">Belum ditagih <b>{r.unbilled.length}</b></span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold">Halaman <b>{r.done.pages}</b> · {r.done.n} order</span>
                </div>
                <p className="mt-2 text-xs"><span className="text-ink-mute">Nilai berjalan: </span>{r.value ? <b className="tabular-nums">{rupiah(r.value)}</b> : <span className="text-ink-mute">biaya belum diisi</span>}</p>
                {isOpen && <ul className="mt-2 space-y-1.5 border-t border-slate-100 pt-2">{r.mine.map((s) => (
                  <li key={s.id} className="rounded-lg bg-slate-50 p-2 text-xs ring-1 ring-slate-200">
                    <a href={`#/projects/${s.project.id}`} className="font-bold text-brand hover:underline">{invoiceLabel(s.project.invoice_no)}</a>
                    <p className="truncate">{s.title}{s.data?.vendor_service ? ` · ${s.data.vendor_service}` : ''}</p>
                    <p className="text-ink-mute">{stageLabel(s.flow, s.stage)} · <span className="tabular-nums">{rupiah(totalPengajuan(s.data) || Number(s.data?.vendor_cost) || 0)}</span></p>
                  </li>
                ))}</ul>}
              </li>
            )
          })}</ul>
          <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[760px] text-sm">
            <thead><tr>
              {KOLOM_VENDOR.map((c) => <Th key={c.key} kolom={c} sortKey={vSortKey} sortDir={vSortDir} onKlik={vKlik} className={c.key === 'vendor' || c.key === 'nilai' ? 'px-4' : undefined} />)}
              <th className="w-8 border-b border-slate-200 bg-slate-50" /></tr></thead>
            <tbody className="divide-y divide-slate-100">{vUrut.map((r) => {
              const isOpen = vOpen === r.v.id
              return (
                <Fragment key={r.v.id}>
                  <tr className={cx('cursor-pointer hover:bg-slate-50', isOpen && 'bg-brand-soft/40')} onClick={() => setVOpen(isOpen ? null : r.v.id)}>
                    <td className="px-4 py-2.5"><b>{r.v.name}</b><p className="text-[11px] text-ink-mute">{PAYMENT_TERMS[termOf(r.v)].short}</p></td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{r.acc.length}</td><td className="px-2 py-2.5 text-right tabular-nums">{r.pay.length}</td>
                    <td className="px-2 py-2.5 text-right font-bold tabular-nums">{r.work.length}</td><td className="px-2 py-2.5 text-right tabular-nums">{r.unbilled.length}</td><td className="px-2 py-2.5 text-right tabular-nums" title={`${r.done.n} order selesai dalam rentang`}><b>{r.done.pages}</b> <span className="text-[10px] text-ink-mute">hlm · {r.done.n} order</span></td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{r.bills.length}</td><td className="px-4 py-2.5 text-right font-semibold tabular-nums">{r.value ? rupiah(r.value) : <span className="font-normal text-ink-mute">biaya belum diisi</span>}</td>
                    <td className="pr-3 text-ink-mute"><ChevronDown className={cx('h-4 w-4 transition', isOpen && 'rotate-180')} /></td>
                  </tr>
                  {isOpen && <tr><td colSpan={9} className="bg-slate-50/60 px-4 py-2">
                    <table className="w-full text-xs"><thead className="text-left text-[10px] uppercase tracking-wide text-ink-mute"><tr><th className="py-1">Invoice</th><th>Dokumen</th><th>Tahap</th><th>Masuk</th><th className="text-right">Nilai</th></tr></thead>
                      <tbody className="divide-y divide-slate-200/70">{r.mine.map((s) => (
                        <tr key={s.id}><td className="py-1.5"><a href={`#/projects/${s.project.id}`} className="font-bold text-brand hover:underline">{invoiceLabel(s.project.invoice_no)}</a></td>
                          <td className="max-w-[260px] truncate">{s.title} · {s.data?.vendor_service || ''}</td><td className="font-semibold text-brand">{stageLabel(s.flow, s.stage)}</td>
                          <td><TimeAgo at={stageArrivedAt(s, s.project)} icon={false} /></td><td className="text-right tabular-nums">{rupiah(totalPengajuan(s.data) || Number(s.data?.vendor_cost) || 0)}</td></tr>
                      ))}</tbody></table>
                  </td></tr>}
                </Fragment>
              )
            })}</tbody>
          </table></div>
        </>)}
      </Section>

      <Section id="ap" icon={Stamp} title={`Staf Apostille & Legalisasi (${ap.length})`} tone="bg-emerald-50"
        chips={[['Antrian belum ditugaskan', apUnassigned, apUnassigned > 0], ['Diproses', subs.filter((s) => ['ap_int', 'lg_int'].includes(s.flow) && s.stage === 'diproses').length]]}>
        <PeopleTable people={ap} projects={projects} now={now} />
      </Section>

      <Section id="spv" icon={UserCog} title={`Supervisor (${spv.length})`} tone="bg-sky-50"
        chips={[['Perlu penerjemah', needTr, needTr > 0], ['Pengajuan vendor belum diajukan', subs.filter((s) => s.flow === 'tr_ext' && s.stage === 'pengajuan').length]]}>
        <PeopleTable people={spv} projects={projects} now={now} />
      </Section>

      <Section id="acc" icon={Calculator} title={`Akunting (${acc.length})`} tone="bg-amber-50"
        chips={[['Transfer vendor', `${payQueue.length} · ${rupiah(payQueue.reduce((a, s) => a + totalPengajuan(s.data), 0))}`, payQueue.length > 0], ['Pengajuan umum', `${reqQueue.length} · ${rupiah(reqQueue.reduce((a, r) => a + Number(r.amount || 0), 0))}`], ['Tagihan vendor', `${billQueue.length} · ${rupiah(billQueue.reduce((a, b) => a + Number(b.total || 0), 0))}`]]}>
        <PeopleTable people={acc} projects={projects} now={now} extraCols={[{ label: 'Pengajuan umum', get: () => reqQueue.length }, { label: 'Tagihan vendor', get: () => billQueue.length }]} />
        {(reqQueue.length > 0 || billQueue.length > 0) && <p className="flex items-center gap-1.5 border-t border-slate-100 px-4 py-2 text-[11px] text-ink-mute"><AlertTriangle className="h-3.5 w-3.5" />Pengajuan umum & tagihan vendor yang sudah di-ACC menunggu transfer Akunting.</p>}
      </Section>
    </div>
  )
}
