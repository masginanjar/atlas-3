import { Fragment, useMemo, useState } from 'react'
import { Lock, Languages, Store, Stamp, UserCog, Calculator, ChevronDown, ChevronUp, MonitorCheck, AlertTriangle } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { tasksOf, summarize, dayKey } from '../lib/performance.js'
import { stageLabel, flowOf, DONE, totalPengajuan, termOf, isBilled, PAYMENT_TERMS } from '../config/workflows.js'
import { placeOf } from '../config/access.js'
import { rupiah, stageArrivedAt } from '../lib/format.js'
import TimeAgo from '../components/TimeAgo.jsx'
import { Card, Empty, Input, cx } from '../components/ui.jsx'
import { addDays } from '../lib/performance.js'

export const canMonitor = (u) => u?.role === 'superadmin'

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
  if (!rows.length) return <Empty title="Belum ada orang dengan role ini" />
  return (
    <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm">
      <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-ink-mute"><tr>
        <th className="px-4 py-2">Nama</th><th className="px-2 py-2 text-right">Tugas aktif</th><th className="px-2 py-2 text-right">Terlambat</th><th className="px-2 py-2 text-right">Deadline hari ini</th>
        {extraCols.map((c) => <th key={c.label} className="px-2 py-2 text-right">{c.label}</th>)}
        <th className="px-2 py-2">Performa hari ini</th><th className="px-4 py-2">Tugas terdekat</th><th className="w-8" /></tr></thead>
      <tbody className="divide-y divide-slate-100">{rows.map((r) => {
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
              <td className="max-w-[240px] px-4 py-2.5 text-xs">{next ? <><b>{next.project.invoice_no}</b> · {next.sub.title}<p className={cx(dlText(next, now).late ? 'font-semibold text-rose-600' : 'text-ink-mute')}>{dlText(next, now).txt}</p></> : <span className="text-ink-mute">—</span>}</td>
              <td className="pr-3 text-ink-mute"><ChevronDown className={cx('h-4 w-4 transition', isOpen && 'rotate-180')} /></td>
            </tr>
            {isOpen && <tr><td colSpan={7 + extraCols.length} className="bg-slate-50/60 px-4 py-2">
              {r.active.length === 0 ? <p className="py-2 text-xs text-ink-mute">Tidak ada tugas aktif.</p> : (
                <table className="w-full text-xs"><thead className="text-left text-[10px] uppercase tracking-wide text-ink-mute"><tr><th className="py-1">Invoice</th><th>Dokumen</th><th>Tahap</th><th>Masuk</th><th className="text-right">Deadline</th></tr></thead>
                  <tbody className="divide-y divide-slate-200/70">{r.active.map((t) => (
                    <tr key={t.sub.id}><td className="py-1.5"><a href={`#/projects/${t.project.id}`} className="font-bold text-brand hover:underline">{t.project.invoice_no}</a></td>
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
    return { v, mine, acc: by(['pengajuan', 'persetujuan']), pay: by(['pembayaran']), work: by(['dibayar', 'order', 'proses_vendor']), unbilled, bills, done: vendorDone(v.id),
      value: mine.reduce((a, s) => a + (totalPengajuan(s.data) || Number(s.data?.vendor_cost) || 0), 0) }
  }).filter((r) => r.mine.length || r.unbilled.length || r.bills.length || r.done.n).sort((a, b) => b.mine.length - a.mine.length), [vendors, subs, data.vendor_bills, range]) // eslint-disable-line react-hooks/exhaustive-deps
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
        {vRows.length === 0 ? <Empty title="Tidak ada pekerjaan vendor berjalan" /> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-ink-mute"><tr><th className="px-4 py-2">Vendor</th><th className="px-2 py-2 text-right">Menunggu ACC</th><th className="px-2 py-2 text-right">Menunggu bayar</th><th className="px-2 py-2 text-right">Dikerjakan</th><th className="px-2 py-2 text-right">Belum ditagih</th><th className="px-2 py-2 text-right">Halaman dikerjakan</th><th className="px-2 py-2 text-right">Tagihan proses</th><th className="px-4 py-2 text-right">Nilai berjalan</th><th className="w-8" /></tr></thead>
            <tbody className="divide-y divide-slate-100">{vRows.map((r) => {
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
                        <tr key={s.id}><td className="py-1.5"><a href={`#/projects/${s.project.id}`} className="font-bold text-brand hover:underline">{s.project.invoice_no}</a></td>
                          <td className="max-w-[260px] truncate">{s.title} · {s.data?.vendor_service || ''}</td><td className="font-semibold text-brand">{stageLabel(s.flow, s.stage)}</td>
                          <td><TimeAgo at={stageArrivedAt(s, s.project)} icon={false} /></td><td className="text-right tabular-nums">{rupiah(totalPengajuan(s.data) || Number(s.data?.vendor_cost) || 0)}</td></tr>
                      ))}</tbody></table>
                  </td></tr>}
                </Fragment>
              )
            })}</tbody>
          </table></div>
        )}
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
