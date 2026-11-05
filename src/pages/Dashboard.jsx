import { useMemo } from 'react'
import { FolderKanban, CheckCircle2, AlarmClock, Wallet, Banknote, ArrowRight, Inbox, Stamp, ChevronDown, Hand, Upload, Loader2, FileCheck2, Send, Languages, ChevronUp, Users, Undo2, CalendarDays, X } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { go } from '../lib/router.js'
import { BRANCHES, ROLES, can, scopeByBranch, activeClaim, WORKER_ROLES, roleLabel, branchesOf, isMultiBranch, APOSTILLE_FUND, pettyLabel, pettyAccountsOf, foreignLang, coordinatorFor, placeOf } from '../config/access.js'
import { CATEGORIES, DONE, isDone, stagesOf, stageLabel, flowOf, totalPengajuan, stafStatus, PAYMENT_TERMS, termOf, isBilled, recommendFund, VENDOR_PAID_STAGES, stageShort } from '../config/workflows.js'
import { PriorityBadge } from '../components/Priority.jsx'
import { TypeBadge as TB } from '../components/badges.jsx'
import { PengajuanSummary, PengajuanStatus, SumberDanaPicker, QuickAcc, PengajuanTracker, DownloadBukti, RejectPengajuan, RevisionNote } from '../components/Pengajuan.jsx'
import { drive } from '../lib/integrations.js'
import CopyText from '../components/CopyText.jsx'
import { RequestBoard, scopeRequests } from '../components/Requests.jsx'
import { PerformanceCard, TeamPerformance } from '../components/Performance.jsx'
import AuthStats, { TranslatorStats, ProofreaderStats } from '../components/AuthStats.jsx'
import FundSummary from '../components/FundSummary.jsx'
import VendorBills, { useUnbilled, billBadgeCount } from '../components/VendorBills.jsx'
import { hasPersonalTasks, canSeeTeam } from '../lib/performance.js'
import { Button } from '../components/ui.jsx'
import { useState } from 'react'
import { TypeBadge, PrintBadge, DemoBadge } from '../components/badges.jsx'
import { Card, Empty, Input, Sheet, cx } from '../components/ui.jsx'
import { daysLeft, rupiah, tgl, stageArrivedAt } from '../lib/format.js'
import TimeAgo from '../components/TimeAgo.jsx'
import { FinHead, FinBar, FinRow, FinAmount, FinActions, Rek, DanaChip } from '../components/FinLayout.jsx'

/** Statistik dashboard (dipakai Dashboard & halaman Keuangan). */
export function useDashStats() {
  const { user, data, branchFilter } = useApp()
  const projects = useMemo(() => scopeByBranch(user, data.projects, branchFilter), [user, data.projects, branchFilter])

  const s = useMemo(() => {
    const active = projects.filter((p) => !isDone(p))
    const due = active.filter((p) => { if (p.demo_perf) return false; const d = daysLeft(p.about?.deadline); return d !== null && d <= 2 })
    const subs = projects.flatMap((p) => (p.sub_projects || []).map((sp) => ({ ...sp, project: p, flow: flowOf(sp, p) })))
    const vendorQueue = subs.filter((x) => ['persetujuan', 'pembayaran'].includes(x.stage) && (can.seeAllFinance(user) || branchesOf(user).includes(x.project.branch)))
    const approvals = subs.filter((x) => x.stage === 'persetujuan')
    const payments = subs.filter((x) => x.stage === 'pembayaran')
    const paidRows = subs.filter((x) => VENDOR_PAID_STAGES.includes(x.stage))
    const needTr = subs.filter((x) => x.type === 'terjemahan' && ((x.flow === 'tr_int' && x.stage === 'pilih_penerjemah') || (x.flow === 'tr_ext' && x.stage === 'pengajuan' && !x.data?.vendor && !x.data?.coordinator)))
      .sort((a, b) => new Date(a.project.about?.deadline || 0) - new Date(b.project.about?.deadline || 0))
    const staf = subs.filter((x) => ['ap_int', 'lg_int'].includes(x.flow) && x.stage !== 'cs_upload'
      && (user.role !== 'staf_apostille' || !x.data?.staff_apostille || x.data.staff_apostille === user.id))
    const mine = data.projects.flatMap((p) => (p.sub_projects || []).map((sp) => ({ ...sp, project: p })))
      .filter((x) => x.data?.submitted_by === user.id).sort((a, b) => new Date(b.data.submitted_at || 0) - new Date(a.data.submitted_at || 0))
    const myTasks = subs.filter((x) => {
      if (x.stage === DONE) return false
      const st = stagesOf(x.flow).find((k) => k.key === x.stage)
      // To-do bersama (otorisasi) tetap tampil walau sedang diambil orang lain — dengan penanda
      return can.processStage(user, st, x, x.project) || (st?.claimable && st.roles.includes(user.role) && !!activeClaim(x))
    }).sort((a, b) => new Date(a.project.about?.deadline || 0) - new Date(b.project.about?.deadline || 0))
    return { active, done: projects.length - active.length, due, vendorQueue, myTasks, subs, approvals, payments, paidRows, mine, staf, needTr }
  }, [projects, user, data.projects])
  return s
}

export default function Dashboard() {
  const { user, data, branchFilter, pettyBalance } = useApp()
  const s = useDashStats()
  // kas yang boleh dilihat (Supervisor: cabangnya + kas apostille), ikut filter cabang di atas
  const accounts = pettyAccountsOf(user).filter((k) => k === APOSTILLE_FUND || branchFilter === 'Semua' || k === branchFilter)
  const [todoOpen, toggleTodo] = useFold('todo')
  // Rentang deadline bersama: dipilih dari judul kolom Deadline di "Perlu Penerjemah" → Kapasitas Penerjemah ikut tanggal yang sama
  const [trRange, setTrRange] = useState({ from: '', to: '' })

  const exec = ['superadmin', 'direktur', 'akunting'].includes(user.role)
  // Admin Pusat bisa memproses banyak tahap, tetapi tugasnya hanya Nomor Registrasi; role pimpinan tidak memuat tugas tahap.
  const todoTasks = user.role === 'admin_pusat' ? s.myTasks.filter((t) => t.stage === 'registrasi') : s.myTasks
  if (['penerjemah', 'proofreader', 'otorisator'].includes(user.role)) return <WorkerDesk user={user} tasks={s.myTasks} />

  const ops = [
    user.coordinator_lang && <CoordBoard key="coord" lang={user.coordinator_lang} />,
    ['superadmin', 'supervisor'].includes(user.role) && <TranslatorLoad key="load" range={trRange} setRange={setTrRange} />,
    ['superadmin', 'supervisor'].includes(user.role) && <AssignTable key="assign" rows={s.needTr} range={trRange} setRange={setTrRange} />,
    ['superadmin', 'supervisor', 'staf_apostille'].includes(user.role) && s.staf.length > 0 && <StafBoard key="staf" rows={s.staf} />,
    ['superadmin', 'admin_pusat', 'supervisor'].includes(user.role) && <FlowPositions key="flow" subs={s.subs} />,
  ].filter(Boolean)
  const hello = new Date().getHours() < 11 ? 'Selamat pagi' : new Date().getHours() < 15 ? 'Selamat siang' : new Date().getHours() < 18 ? 'Selamat sore' : 'Selamat malam'

  return (
    <div className="space-y-7">
      <Hero user={user} hello={hello} s={s} todoCount={TODO_GROUP_ROLES.includes(user.role) ? roleGroupCount(s, user, data.people) : todoTasks.length} />

      {/* Kerja saya: Performa (prioritas) + To-Do List berdampingan di layar lebar */}
      <Segment title="Kerja Saya">
        <div className={cx('grid gap-4', hasPersonalTasks(user) && user.role !== 'staf_apostille' && 'lg:grid-cols-2 lg:items-stretch')}>
        {user.role !== 'staf_apostille' && <Card className={cx('flex min-h-0 flex-col overflow-hidden', !todoOpen && 'lg:self-start')}>
          <div className="card-head flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-white ring-1 ring-slate-200"><Inbox className="h-4 w-4 text-ink-soft" /></span>
            <h2 className="mr-auto font-bold">To-Do List{WORKER_ROLES.includes(user.role) ? ` ${roleLabel(user)}` : ''} <span className="text-ink-mute">({TODO_GROUP_ROLES.includes(user.role) ? roleGroupCount(s, user, data.people) : todoTasks.length})</span><span className="ml-2 hidden text-[11px] font-medium text-ink-mute sm:inline">{TODO_GROUP_ROLES.includes(user.role) ? 'tugas sesuai peran' : 'tugas tahap yang harus saya kerjakan'}</span></h2>
            <FoldBtn open={todoOpen} onClick={toggleTodo} label="To-Do List" className="h-7 w-7" />
          </div>
          {!todoOpen ? null : TODO_GROUP_ROLES.includes(user.role) ? <RoleTodo s={s} user={user} /> : todoTasks.length === 0 ? <Empty icon={Inbox} title="Tidak ada tugas" text="Semua tahap yang menjadi bagian Anda sudah diproses." /> : (
            <ul className="max-h-[440px] min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto overscroll-contain" aria-label="To-Do List">
              {todoTasks.map((t) => <TaskRow key={t.id} t={t} user={user} />)}
            </ul>
          )}
        </Card>}
          {hasPersonalTasks(user) && <PerformanceCard narrow />}
        </div>
      <Attention s={s} />
      </Segment>

      {/* Pimpinan: Tim → Keuangan (setelah Kerja Saya) */}
      {exec && <Segment title="Tim"><TeamPerformance /></Segment>}
      {exec && <Segment title="Keuangan" action={<a href="#/keuangan" className="text-xs font-semibold text-brand hover:underline">Buka halaman Keuangan →</a>}>
        {can.seeFunding(user) && <FundSummary />}
        <FinanceGroup s={s} />
      </Segment>}


      {!exec && canSeeTeam(user) && <Segment title="Tim"><TeamPerformance /></Segment>}

      {ops.length > 0 && <Segment title="Operasional">{ops}</Segment>}

      {!exec && !WORKER_ROLES.includes(user.role) && (
        <Segment title="Keuangan" action={<a href="#/keuangan" className="text-xs font-semibold text-brand hover:underline">Buka halaman Keuangan →</a>}>
          {accounts.length > 0 && <PettyStrip accounts={accounts} balance={pettyBalance} />}
        </Segment>
      )}
    </div>
  )
}

const VENDOR_ORDER_STAGES = ['pengajuan', 'persetujuan', 'pembayaran', ...VENDOR_PAID_STAGES, 'order']
const dlText = (d) => (d === null ? '' : d < 0 ? `Terlambat ${-d} hr` : d === 0 ? 'Hari ini' : d === 1 ? 'Besok' : `${d} hari lagi`)

/** Perlu Perhatian: 1) pelanggan prioritas hari ini, 2) deadline hari ini, 3) order ke vendor, 4) deadline 1–2 hari. */
/** Sapaan + ringkasan angka hari ini (klik untuk lompat). */
function Hero({ user, hello, s, todoCount }) {
  const act = s.active.filter((p) => !p.demo_perf)
  const late = act.filter((p) => { const d = daysLeft(p.about?.deadline); return d !== null && d < 0 }).length
  const today = act.filter((p) => daysLeft(p.about?.deadline) === 0).length
  const vendor = s.subs.filter((x) => VENDOR_ORDER_STAGES.includes(x.stage) && !x.project.demo_perf).length
  const urgent = today + late > 0
  const tiles = [
    { k: 'todo', label: 'To-Do saya', value: todoCount, sub: 'tugas menunggu', icon: Inbox, href: '#/dashboard' },
    { k: 'active', label: 'Project aktif', value: act.length, sub: `${s.done} selesai`, icon: FolderKanban, href: '#/projects' },
    { k: 'dl', label: 'Deadline hari ini', value: today + late, sub: late ? `${late} terlambat` : 'tidak ada yang terlambat', icon: AlarmClock, href: '#/projects', tone: urgent ? 'danger' : 'ok' },
    { k: 'vendor', label: 'Order vendor berjalan', value: vendor, sub: `${s.approvals.length} menunggu ACC`, icon: Banknote, href: '#/keuangan' },
  ]
  return (
    <section aria-label="Ringkasan hari ini" className="overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-slate-200">
      <div className="relative px-5 pb-4 pt-5 sm:px-6">

        <div className="relative flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[13px] font-medium text-ink-mute">{hello},</p>
            <h1 className="text-2xl font-extrabold leading-tight sm:text-[30px]">{user.display_name || user.name}</h1>
            <p className="mt-1 text-xs text-ink-mute">{roleLabel(user)} · {user.branch}</p>
          </div>
          <p className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-ink-soft ring-1 ring-slate-200">{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5 px-4 pb-4 sm:px-5 lg:grid-cols-4">
        {tiles.map(({ k, label, value, sub, icon: Icon, href, tone }) => (
          <a key={k} href={href} className="group relative overflow-hidden rounded-2xl bg-slate-50 p-3.5 ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:ring-brand/40">
            <span className="absolute right-3 top-3 text-ink-mute/60 transition group-hover:text-brand"><Icon className="h-5 w-5" /></span>
            <p className={cx('text-3xl font-extrabold leading-none tabular-nums', tone === 'danger' ? 'text-rose-600' : tone === 'ok' ? 'text-emerald-600' : 'text-ink')}>{value}</p>
            <p className="mt-1.5 text-xs font-semibold text-ink-soft">{label}</p>
            <p className="text-[11px] text-ink-mute">{sub}</p>
          </a>
        ))}
      </div>
    </section>
  )
}

/** Perlu Perhatian: 1) pelanggan prioritas, 2) deadline hari ini, 3) order ke vendor — tiga kartu berdampingan. */
function Attention({ s }) {
  const [open, toggle] = useFold('attention')
  const byDl = (a, b) => new Date(a.about?.deadline || 0) - new Date(b.about?.deadline || 0)
  const act = s.active.filter((p) => !p.demo_perf)
  const prio = act.filter((p) => p.about?.priority && p.about.priority !== 'Normal').sort(byDl)
  const todayDl = act.filter((p) => { const d = daysLeft(p.about?.deadline); return d !== null && d <= 0 }).sort(byDl)
  const vendor = s.subs.filter((x) => VENDOR_ORDER_STAGES.includes(x.stage) && !x.project.demo_perf)
    .sort((a, b) => VENDOR_ORDER_STAGES.indexOf(b.stage) - VENDOR_ORDER_STAGES.indexOf(a.stage) || byDl(a.project, b.project))
  const total = prio.length + todayDl.length + vendor.length
  if (!total) return null
  const Row = ({ p, right, sub }) => (
    <a href={`#/projects/${p.id}`} className="flex items-center justify-between gap-2 px-3 py-2 text-sm transition hover:bg-white">
      <span className="min-w-0"><span className="block truncate font-semibold">{p.invoice_no}</span><span className="block truncate text-[11px] text-ink-mute">{p.customer?.name}{sub ? ` · ${sub}` : ''}</span></span>
      <span className="shrink-0 text-right text-[11px]">{right}</span>
    </a>
  )
  const Group = ({ n, title, items, tone, render, href }) => items.length > 0 && (
    <div className={cx('flex min-w-0 flex-col overflow-hidden rounded-2xl ring-1', tone.ring)}>
      <div className={cx('flex items-center gap-2 px-3 py-2', tone.head)}>
        <span className={cx('grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold', tone.num)}>{n}</span>
        <p className={cx('min-w-0 flex-1 truncate text-xs font-bold uppercase tracking-wide', tone.text)}>{title}</p>
        <span className={cx('rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums', tone.num)}>{items.length}</span>
      </div>
      <div className={cx('flex-1 divide-y', tone.body)}>{items.slice(0, 5).map(render)}</div>
      {items.length > 5 && <a href={href || '#/projects'} className={cx('block px-3 py-1.5 text-[11px] font-semibold hover:underline', tone.text)}>+{items.length - 5} lainnya →</a>}
    </div>
  )
  const T = {
    prio: { ring: 'ring-slate-200', head: 'bg-slate-50', num: 'bg-white text-ink-soft ring-1 ring-slate-300', text: 'text-ink', body: 'divide-slate-100 bg-white' },
    dl: { ring: 'ring-rose-200', head: 'bg-rose-50', num: 'bg-white text-rose-700 ring-1 ring-rose-200', text: 'text-rose-700', body: 'divide-slate-100 bg-white' },
    vendor: { ring: 'ring-amber-200', head: 'bg-amber-50', num: 'bg-white text-amber-700 ring-1 ring-amber-200', text: 'text-amber-700', body: 'divide-slate-100 bg-white' },
  }
  const cols = [prio.length, todayDl.length, vendor.length].filter(Boolean).length
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-rose-50"><AlarmClock className="h-4 w-4 text-rose-600" /></span>
        <h2 className="min-w-0 font-bold">Perlu Perhatian <span className="font-normal text-ink-mute">({total})</span><span className="ml-2 hidden text-[11px] font-medium text-ink-mute sm:inline">follow-up & pantauan — bukan tugas tahap</span></h2>
        {!open && <span className="ml-1 hidden flex-wrap gap-1 text-[11px] font-semibold sm:flex">
          {prio.length > 0 && <span className="rounded-full bg-fuchsia-50 px-2 py-0.5 text-fuchsia-700 ring-1 ring-fuchsia-200">{prio.length} prioritas</span>}
          {todayDl.length > 0 && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-rose-700 ring-1 ring-rose-200">{todayDl.length} deadline hari ini</span>}
          {vendor.length > 0 && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700 ring-1 ring-amber-200">{vendor.length} order vendor</span>}
        </span>}
        <FoldBtn open={open} onClick={toggle} label="Perlu perhatian" className="ml-auto h-7 w-7" />
      </div>
      {open && (
        <div className={cx('grid gap-3 p-3', cols >= 3 ? 'lg:grid-cols-3' : cols === 2 ? 'md:grid-cols-2' : '')}>
          <Group n={1} title="Ekspres / Super Ekspres / Sameday" items={prio} tone={T.prio}
            render={(p) => <Row key={p.id} p={p} right={<span className="flex flex-col items-end gap-0.5"><PriorityBadge p={p.about.priority} /><span className={cx(daysLeft(p.about?.deadline) <= 0 ? 'font-semibold text-rose-600' : 'text-ink-mute')}>{dlText(daysLeft(p.about?.deadline))}</span></span>} />} />
          <Group n={2} title="Deadline hari ini" items={todayDl} tone={T.dl}
            render={(p) => <Row key={p.id} p={p} right={<span className="font-semibold text-rose-600">{dlText(daysLeft(p.about?.deadline))}<span className="block font-normal text-ink-mute">{p.about?.deadline_time || tgl(p.about?.deadline)}</span></span>} />} />
          <Group n={3} title="Order ke Vendor" items={vendor} tone={T.vendor} href="#/keuangan"
            render={(x) => <Row key={x.id} p={x.project} sub={x.title} right={<span className="inline-block max-w-[150px] whitespace-normal font-semibold leading-tight text-amber-700">{stageShort(x.flow, x.stage)}</span>} />} />
        </div>
      )}
    </Card>
  )
}


const TODO_GROUP_ROLES = ['direktur', 'superadmin', 'supervisor', 'akunting']
const TR_PROGRESS = ['penerjemahan', 'proofread', 'otorisasi', 'registrasi']
const AP_PROGRESS = ['antrian', 'proses']
const monthKey = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Makassar' }).slice(0, 7)
const dayOfMonth = () => Number(new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Makassar' }).slice(8, 10))
const reminderDone = (id) => { try { return localStorage.getItem(`atlas-todo-done:${id}:${monthKey()}`) === '1' } catch { return false } }

/** Satu baris tugas tahap (dipakai daftar datar & kelompok per role). */
function TaskRow({ t, user }) {
  const d = daysLeft(t.project.about?.deadline)
  return (
    <li>
      <a href={`#/projects/${t.project.id}`} className="flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50 sm:gap-3 sm:px-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className="whitespace-nowrap text-sm font-bold">{t.project.invoice_no}</span><TypeBadge type={t.type} /><span className="hidden sm:inline-flex"><PrintBadge project={t.project} /></span><span className="sm:hidden"><PrintBadge project={t.project} iconOnly /></span><DemoBadge project={t.project} /></div>
          <p className="truncate text-xs text-ink-mute">{t.title} · {t.project.customer?.name}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold text-brand">{stageLabel(t.flow, t.stage)}</p>
          {activeClaim(t) && <p className={cx('inline-flex items-center gap-1 text-[11px] font-semibold', activeClaim(t).by === user.id ? 'text-violet-700' : 'text-amber-700')}><Hand className="h-3 w-3" />{activeClaim(t).by === user.id ? 'Anda ambil' : 'Diambil rekan'}</p>}
          <p className={cx('text-[11px]', d !== null && d <= 1 ? 'font-semibold text-rose-600' : 'text-ink-mute')}>{d === null ? '' : d < 0 ? `Terlambat ${-d} hr` : d === 0 ? 'Hari ini' : `${d} hari lagi`}</p>
        </div>
        <ArrowRight className="h-4 w-4 text-slate-300" />
      </a>
    </li>
  )
}

/** Kelompok To-Do per role: Direktur, Supervisor, CS/Admin Pusat, Akunting. */
function todoGroups(s, user, people = []) {
  const byDl = (a, b) => new Date((a.project || a).about?.deadline || 0) - new Date((b.project || b).about?.deadline || 0)
  const subs = s.subs.filter((x) => x.stage !== DONE && !x.project.demo_perf)
  const act = s.active.filter((p) => !p.demo_perf)
  const used = new Set()
  const take = (list) => { list.forEach((x) => used.add(x.id)); return list }
  const groups = []
  const sub = (x, right) => ({ id: x.id, href: `#/projects/${x.project.id}`, inv: x.project.invoice_no, text: `${x.title} · ${x.project.customer?.name || ''}`, right, p: x.project })
  const prj = (p, right) => ({ id: p.id, href: `#/projects/${p.id}`, inv: p.invoice_no, text: p.customer?.name || '', right, p })
  const dl = (p) => { const d = daysLeft(p.about?.deadline); return { txt: d === null ? '' : d < 0 ? `Terlambat ${-d} hr` : d === 0 ? 'Hari ini' : d === 1 ? 'Besok' : `${d} hari lagi`, hot: d !== null && d <= 0 } }
  if (['direktur', 'superadmin'].includes(user.role)) {
    groups.push({ title: 'ACC Pengajuan', items: take(subs.filter((x) => x.stage === 'persetujuan').sort(byDl)).map((x) => sub(x, { txt: rupiah(totalPengajuan(x.data)), hot: true })), empty: 'Tidak ada pengajuan menunggu ACC' })
    const req = (s.requestsWaiting || 0)
    if (req) groups[0].items.push({ id: 'req', href: '#/keuangan', inv: 'Pengajuan Umum', text: `${req} pengajuan menunggu persetujuan`, right: { txt: 'Lihat', hot: false } })
  }
  if (user.role === 'supervisor') {
    groups.push({ title: 'Bagi Penerjemah', items: take(s.needTr).map((x) => sub(x, dl(x.project))), empty: 'Semua terjemahan sudah punya penerjemah' })
    groups.push({ title: 'Bagi Vendor Apostille / Legalisasi', items: take(subs.filter((x) => ['ap_ext', 'lg_ext'].includes(x.flow) && x.stage === 'pengajuan' && !x.data?.vendor).sort(byDl)).map((x) => sub(x, dl(x.project))), empty: 'Tidak ada yang menunggu vendor' })
    groups.push({ title: 'Project Apostille / Legalisasi', items: take(subs.filter((x) => ['apostille', 'legalisasi'].includes(x.type)).sort(byDl)).map((x) => sub(x, { txt: stageLabel(x.flow, x.stage), hot: false })), empty: 'Tidak ada project apostille / legalisasi aktif' })
  }
  if (user.role === 'akunting') {
    groups.push({ title: 'Transfer Pengajuan', items: take(subs.filter((x) => x.stage === 'pembayaran').sort(byDl)).map((x) => sub(x, { txt: rupiah(totalPengajuan(x.data)), hot: true })), empty: 'Tidak ada pengajuan yang perlu ditransfer' })
    const unb = s.subs.filter((x) => x.flow === 'tr_bill' && ['proses_vendor', DONE].includes(x.stage) && x.data?.vendor && !x.data?.bill_id)
    const byV = Object.entries(unb.reduce((a, x) => { (a[x.data.vendor] ||= []).push(x); return a }, {}))
    const vName = (id) => people.find((v) => v.id === id)?.name || 'Vendor'
    const vLang = (id) => (people.find((v) => v.id === id)?.languages || []).join('/')
    groups.push({ title: 'Rekap Pembayaran Vendor Terjemahan', items: byV.map(([vid, rows]) => ({ id: `v-${vid}`, href: '#/keuangan', inv: vName(vid), text: `${vLang(vid) ? vLang(vid) + ' · ' : ''}${rows.length} order belum ditagih`, right: { txt: rupiah(rows.reduce((a, x) => a + totalPengajuan(x.data), 0)), hot: false } })), empty: 'Semua order vendor sudah direkap' })
    if (dayOfMonth() <= 7) groups.push({ title: 'Laporan Bulanan (sebelum tanggal 7)', items: [
      { id: 'lap-bagi-hasil', reminder: true, inv: 'Laporan Bagi Hasil', text: `Periode ${new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`, right: { txt: `Tenggat tgl 7`, hot: dayOfMonth() >= 5 } },
      { id: 'lap-bagi-hasil-smg', reminder: true, inv: 'Laporan Bagi Hasil Semarang', text: `Periode ${new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`, right: { txt: `Tenggat tgl 7`, hot: dayOfMonth() >= 5 } },
    ] })
  }
  const rest = s.myTasks.filter((t) => !used.has(t.id))
  return { groups, rest }
}
export const roleGroupCount = (s, user, people) => todoGroups(s, user, people).groups.reduce((a, g) => a + g.items.filter((i) => !(i.reminder && reminderDone(i.id))).length, 0)

function RoleTodo({ s, user, offset = 0 }) {
  const { data } = useApp()
  const [, bump] = useState(0)
  const { groups } = useMemo(() => todoGroups(s, user, data.people), [s, user, data.people])
  const toggleDone = (id) => { try { const k = `atlas-todo-done:${id}:${monthKey()}`; localStorage.setItem(k, reminderDone(id) ? '0' : '1') } catch { /* abaikan */ } bump((n) => n + 1) }
  const LIMIT = 6
  return (
    <div className="space-y-3" aria-label="Follow-up per role">
      {groups.map((g, gi) => (
        <section key={g.title}>
          <p className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-ink-soft"><span className="grid h-5 w-5 place-items-center rounded-full bg-brand/10 text-[11px] text-brand">{offset + gi + 1}</span>{g.title}<span className="font-semibold normal-case tracking-normal text-ink-mute">({g.items.length})</span></p>
          {g.items.length === 0 ? <p className="rounded-xl bg-slate-50 px-3 py-1.5 text-xs text-ink-mute ring-1 ring-slate-200">{g.empty}</p> : (
            <ul className="divide-y divide-slate-100 rounded-xl bg-white/70 ring-1 ring-slate-200">
              {g.items.slice(0, LIMIT).map((it) => {
                const done = it.reminder && reminderDone(it.id)
                const body = (
                  <>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5"><span className={cx('whitespace-nowrap text-sm font-bold', done && 'line-through text-ink-mute')}>{it.inv}</span>{it.right?.prio && <PriorityBadge p={it.right.prio} />}{it.p && <DemoBadge project={it.p} />}</div>
                      <p className="truncate text-xs text-ink-mute">{it.text}</p>
                    </div>
                    {it.right?.txt && <span className={cx('shrink-0 text-right text-[11px] font-semibold tabular-nums md:min-w-[110px]', it.right.hot ? 'text-ink' : 'text-ink-soft')}>{it.right.txt}</span>}
                  </>
                )
                return (
                  <li key={it.id}>
                    {it.reminder ? (
                      <label className="flex w-full max-w-4xl cursor-pointer items-center gap-2 px-3 py-2 hover:bg-slate-50 sm:gap-3">
                        <input type="checkbox" checked={done} onChange={() => toggleDone(it.id)} className="h-4 w-4 rounded border-slate-300 text-brand" aria-label={`Tandai selesai: ${it.inv}`} />{body}
                      </label>
                    ) : <a href={it.href} className="flex w-full max-w-4xl items-center gap-2 px-3 py-2 hover:bg-slate-50 sm:gap-3">{body}<ArrowRight className="h-4 w-4 text-slate-300" /></a>}
                  </li>
                )
              })}
            </ul>
          )}
          {g.items.length > LIMIT && <a href="#/projects" className="mt-1 block text-[11px] font-semibold text-brand">+{g.items.length - LIMIT} lainnya — lihat di My Project →</a>}
        </section>
      ))}
    </div>
  )
}

/** Pengelompokan segmen dashboard: judul kecil bergaris + isi. */
export function Segment({ title, action, children }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3"><p className="seg-title flex-1">{title}</p>{action}</div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function Stat({ icon: Icon, label, value, sub, tone = 'blue', onClick }) {
  const t = { blue: 'text-brand bg-brand-soft', emerald: 'text-emerald-600 bg-emerald-50', rose: 'text-rose-600 bg-rose-50', violet: 'text-violet-600 bg-violet-50', slate: 'text-slate-500 bg-slate-100' }[tone]
  return (
    <Card className={cx('p-4', onClick && 'cursor-pointer hover:ring-brand')} onClick={onClick}>
      <div className={cx('mb-3 inline-flex rounded-xl p-2', t)}><Icon className="h-4 w-4" /></div>
      <p className="text-2xl font-extrabold leading-none">{value}</p>
      <p className="mt-1 text-xs text-ink-mute">{label}</p>
      {sub && <p className="mt-0.5 text-xs font-semibold text-ink-soft">{sub}</p>}
    </Card>
  )
}

function PengajuanBoard({ title, rows, mode, empty, bare }) {
  const { processStage, notify, data } = useApp()
  const [open, setOpen] = useState(null)
  const [busy, setBusy] = useState(null)
  const [accFor, setAccFor] = useState(null) // id pengajuan yang sedang memilih sumber dana
  const [sumber, setSumber] = useState('')
  const [rejectFor, setRejectFor] = useState(null) // id pengajuan yang sedang ditolak / diminta perbaikan
  const total = rows.filter((r) => !r.project.demo_perf).reduce((a, r) => a + totalPengajuan(r.data), 0)
  const vendorOf = (r) => data.people.find((p) => p.id === r.data?.vendor)
  const acc = async (r, dana = sumber) => {
    if (!dana) return notify('Pilih sumber dana dulu', 'err')
    setBusy(r.id)
    try { await processStage(r.project, r.id, { sumber_dana: dana }, true); notify(`Pengajuan ${r.project.invoice_no} disetujui · sumber dana ${dana}`); setAccFor(null); setSumber('') }
    catch (e) { notify(e.message, 'err') } finally { setBusy(null) }
  }
  const Wrap = bare ? 'div' : Card
  return (
    <Wrap className={bare ? '' : 'overflow-hidden'}>
      {bare ? <FinBar note={mode === 'acc' ? 'Pengajuan vendor menunggu persetujuan' : 'Pengajuan vendor disetujui — menunggu pembayaran'} total={total} /> : (
      <div className={cx('flex flex-wrap items-center gap-2 px-4 py-3', mode === 'acc' ? 'bg-amber-50' : 'bg-sky-50')}>
        <Stamp className={cx('h-4 w-4', mode === 'acc' ? 'text-amber-600' : 'text-sky-600')} />
        <h2 className="font-bold">{title} <span className="text-ink-mute">({rows.length})</span></h2>
        <span className="ml-auto text-sm font-extrabold tabular-nums">{rupiah(total)}</span>
      </div>)}
      <FinHead />
      {rows.length === 0 ? <p className="px-4 py-6 text-center text-sm text-ink-mute">{empty}</p> : (
        <ul className="divide-y divide-slate-100">
          {rows.map((r) => {
            const v = vendorOf(r); const expanded = open === r.id || accFor === r.id
            return (
              <li key={r.id} className={cx(expanded && 'bg-brand-soft/20')}>
                <FinRow>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5"><b className="whitespace-nowrap text-sm">{r.project.invoice_no}</b><DemoBadge project={r.project} /><span className="text-xs text-ink-mute">{r.project.branch}</span></span>
                    <span className="block truncate text-xs text-ink-soft">{r.title} · {r.data?.vendor_service || '—'}</span>
                    <span className="flex items-center gap-2"><TimeAgo at={(r.data?.submitted_at || stageArrivedAt(r, r.project))} prefix="Diajukan" className="!mt-0" />
                      <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id} className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-brand hover:underline">{open === r.id ? 'Tutup rincian' : 'Rincian'}<ChevronDown className={cx('h-3 w-3 transition', open === r.id && 'rotate-180')} /></button></span>
                  </span>
                  <FinAmount value={totalPengajuan(r.data)} sub={r.data?.sumber_dana && mode !== 'acc' ? `Dana ${r.data.sumber_dana}` : null} />
                  <span className="min-w-0"><span className="block truncate text-xs font-semibold text-ink">{v?.name || 'Vendor'}</span><Rek acc={v?.accounts?.[0]} empty="Belum ada rekening vendor" emptyHref="#/settings/vendor" /></span>
                  <span><PengajuanStatus stage={r.stage} revision={!!r.data?.revision_note} /></span>
                  <FinActions>
                    {mode === 'acc'
                      ? (accFor === r.id ? <Button size="sm" variant="outline" onClick={() => setAccFor(null)}>Batal</Button>
                        : <QuickAcc branch={r.project.branch} busy={busy === r.id} onAcc={(d) => acc(r, d)} onPick={(d) => { setAccFor(r.id); setSumber(r.data?.sumber_dana || d) }} />)
                      : <Button size="sm" variant="outline" onClick={() => go(`projects/${r.project.id}`)}>Proses Bayar</Button>}
                    <Button size="sm" variant="outline" className="!text-rose-700 !ring-rose-300 hover:!bg-rose-50" title="Kembalikan ke pengaju untuk diperbaiki" onClick={() => setRejectFor(rejectFor === r.id ? null : r.id)}><Undo2 className="h-3.5 w-3.5" /><span className="hidden sm:inline">Tolak / Perbaiki</span></Button>
                  </FinActions>
                </FinRow>
                {rejectFor === r.id && <div className="px-4 pb-3"><RejectPengajuan project={r.project} sub={r} defaultOpen onDone={() => setRejectFor(null)} /></div>}
                {expanded && <div className="px-4 pb-3"><PengajuanSummary sub={r} />
                  {accFor === r.id && (
                    <div className="mt-2 rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200">
                      <p className="mb-2 text-[13px] font-semibold text-ink">Pilih sumber dana <span className="text-rose-500">*</span> <span className="font-normal text-ink-mute">— rekening yang dipakai Akunting untuk transfer</span></p>
                      <SumberDanaPicker value={sumber} onChange={setSumber} recommended={recommendFund(r.project.branch)} />
                      <div className="mt-3 flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => setAccFor(null)}>Batal</Button>
                        <Button size="sm" loading={busy === r.id} disabled={!sumber} onClick={() => acc(r)}><CheckCircle2 className="h-3.5 w-3.5" />ACC{sumber ? ` · ${sumber}` : ''}</Button>
                      </div>
                    </div>
                  )}
                </div>}
              </li>
            )
          })}
        </ul>
      )}
    </Wrap>
  )
}

/** Tabel cepat Akunting: pilih rekening, tanggal, upload bukti → Tandai Dibayar — tanpa membuka project. */
function PayTable({ rows, paid, bare }) {
  const { data, processStage, notify } = useApp()
  const [form, setForm] = useState({}) // per id: { acc, date, file, uploading, busy }
  const today = new Date().toISOString().slice(0, 10)
  const get = (id) => ({ acc: '', date: today, file: null, ...form[id] })
  const set = (id, patch) => setForm((f) => ({ ...f, [id]: { ...get(id), ...f[id], ...patch } }))
  const vendorOf = (r) => data.people.find((p) => p.id === r.data?.vendor)

  const upload = async (r, file) => {
    if (!file) return
    set(r.id, { uploading: true })
    try { set(r.id, { file: await drive.upload(file, { branch: r.project.branch, invoice: r.project.invoice_no }), uploading: false }) }
    catch (e) { notify(e.message, 'err'); set(r.id, { uploading: false }) }
  }
  const pay = async (r) => {
    const f = get(r.id)
    const rekening = vendorOf(r)?.accounts?.[0] // rekening penerima dari Setting → Vendor
    if (!rekening) return notify('Vendor belum punya rekening — isi di Setting → Vendor', 'err')
    if (!f.file) return notify('Upload bukti transfer dulu', 'err')
    set(r.id, { busy: true })
    try { await processStage(r.project, r.id, { rekening, paid_date: f.date, bukti_transfer: f.file }, true); notify(`${r.project.invoice_no}: Sudah Dibayar`) }
    catch (e) { notify(e.message, 'err') } finally { set(r.id, { busy: false }) }
  }

  const Wrap = bare ? 'div' : Card
  const total = rows.reduce((a, r) => a + totalPengajuan(r.data), 0)
  return (
    <Wrap className={bare ? '' : 'overflow-hidden'}>
      {bare ? <FinBar note="Disetujui Direktur — isi tanggal, unggah bukti, tandai dibayar" total={total} /> : (
      <div className="flex flex-wrap items-center gap-2 bg-sky-50 px-4 py-3">
        <Wallet className="h-4 w-4 text-sky-600" />
        <h2 className="font-bold">Perlu Dibayar <span className="text-ink-mute">({rows.length})</span></h2>
        <span className="ml-auto text-sm font-extrabold tabular-nums">{rupiah(total)}</span>
      </div>)}
      <FinHead />
      {rows.length === 0 ? <p className="px-4 py-6 text-center text-sm text-ink-mute">Tidak ada pengajuan yang perlu dibayar. 🎉</p> : (
        <ul className="divide-y divide-slate-100">
          {rows.map((r) => {
            const f = get(r.id); const acc = vendorOf(r)?.accounts?.[0]
            return (
              <FinRow key={r.id}>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5"><CopyText text={r.project.invoice_no} label="No. Invoice" strong /><span className="text-xs text-ink-mute">{r.project.branch}</span></span>
                  <span className="block truncate text-xs text-ink-soft"><CopyText text={r.project.customer?.name} label="Nama Pelanggan" /> · {vendorOf(r)?.name} · {r.data?.vendor_service}</span>
                  <span className="flex items-center gap-2"><TimeAgo at={r.data?.approved_at || stageArrivedAt(r, r.project)} prefix="ACC" className="!mt-0" /><a href={`#/projects/${r.project.id}`} className="text-[11px] font-semibold text-brand hover:underline">Buka project</a></span>
                </span>
                <FinAmount value={totalPengajuan(r.data)} sub={r.data?.sumber_dana ? `Dana ${r.data.sumber_dana}` : null} />
                <Rek acc={acc} empty="Belum ada rekening — isi di Setting → Vendor" emptyHref="#/settings/vendor" />
                <span><PengajuanStatus stage={r.stage} revision={!!r.data?.revision_note} /></span>
                <FinActions>
                  <Input type="date" value={f.date} onChange={(e) => set(r.id, { date: e.target.value })} className="!h-8 !w-[130px] !px-2 text-xs" aria-label="Tanggal bayar" />
                  {f.file ? <span className="inline-flex max-w-[110px] items-center gap-1 truncate text-xs font-semibold text-emerald-700"><FileCheck2 className="h-4 w-4 shrink-0" />{f.file.name}</span> : (
                    <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-white px-2.5 text-xs font-semibold text-ink-soft ring-1 ring-slate-300 hover:text-brand hover:ring-brand">
                      {f.uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}Bukti
                      <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => upload(r, e.target.files?.[0])} aria-label={`Upload bukti ${r.project.invoice_no}`} />
                    </label>
                  )}
                  <Button size="sm" loading={f.busy} disabled={!f.file || !acc || f.uploading} onClick={() => pay(r)}>Tandai Dibayar</Button>
                </FinActions>
              </FinRow>
            )
          })}
        </ul>
      )}
      {paid.length > 0 && (
        <div className="border-t border-slate-200">
          <p className="bg-emerald-50 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-800">Sudah Dibayar — order dilanjutkan CS: hasil vendor → no. resi → dikirim → selesai ({paid.length})</p>
          <ul className="divide-y divide-slate-100">
            {paid.map((r) => (
              <FinRow key={r.id}>
                <span className="min-w-0"><a href={`#/projects/${r.project.id}`} className="block"><b className="text-sm">{r.project.invoice_no}</b><span className="block truncate text-xs text-ink-soft">{vendorOf(r)?.name} · {r.data?.vendor_service}</span></a><TimeAgo at={r.data?.paid_at || stageArrivedAt(r, r.project)} prefix="Dibayar" className="!mt-0" /></span>
                <FinAmount value={totalPengajuan(r.data)} sub={r.data?.sumber_dana ? `Dana ${r.data.sumber_dana}` : null} />
                <Rek acc={r.data?.rekening || vendorOf(r)?.accounts?.[0]} />
                <span><PengajuanStatus stage={r.stage} revision={!!r.data?.revision_note} /></span>
                <FinActions><DownloadBukti file={r.data?.bukti_transfer} /><span className="text-[11px] text-ink-mute">{stageLabel(flowOf(r, r.project), r.stage)}</span></FinActions>
              </FinRow>
            ))}
          </ul>
        </div>
      )}
    </Wrap>
  )
}

/** Satu grup Keuangan & Pengajuan: vendor (ACC / bayar / milik saya) + pengajuan umum, dalam tab. */
export function FinanceGroup({ s }) {
  const { user, data, branchFilter } = useApp()
  const [open, toggle] = useFold('finance')
  const req = scopeRequests(user, data.requests || [], branchFilter)
  const unbilled = useUnbilled()
  const reqActive = req.filter((r) => (user.role === 'direktur' ? r.status === 'menunggu' : user.role === 'akunting' ? r.status === 'disetujui' : ['menunggu', 'disetujui'].includes(r.status))).length
  const tabs = [
    can.approveVendor(user) && { k: 'acc', label: 'Menunggu ACC', n: s.approvals.length, el: <PengajuanBoard bare rows={s.approvals} mode="acc" empty="Tidak ada pengajuan vendor yang menunggu persetujuan." /> },
    ['superadmin', 'akunting'].includes(user.role) && { k: 'pay', label: 'Perlu Dibayar', n: s.payments.length + s.paidRows.length, el: <PayTable bare rows={s.payments} paid={s.paidRows} /> },
    !['direktur', 'akunting'].includes(user.role) && { k: 'mine', label: 'Pengajuan Saya', n: s.mine.filter((x) => x.stage !== DONE).length, el: <MySubmissions bare rows={s.mine} /> },
    { k: 'umum', label: 'Pengajuan Umum', n: reqActive, el: <RequestBoard bare /> },
    (can.seeFunding(user) || user.coordinator_lang) && { k: 'bill', label: can.seeFunding(user) ? 'Tagihan Vendor' : 'Tagihan Vendor Saya', n: billBadgeCount(user, data.vendor_bills || [], unbilled.length), el: <VendorBills /> },
  ].filter(Boolean)
  const [tab, setTab] = useState(() => (tabs.find((t) => t.n > 0) ?? tabs[0]).k)
  const cur = tabs.find((t) => t.k === tab) ?? tabs[0]
  const total = tabs.reduce((a, t) => a + t.n, 0)
  return (
    <Card className="overflow-hidden">
      <div className="card-head flex flex-wrap items-center gap-2 bg-gradient-to-r from-amber-50 to-orange-50/40 px-4 py-2">
        <Banknote className="h-4 w-4 text-amber-600" />
        <h2 className="min-w-0 font-bold leading-tight">Keuangan & Pengajuan <span className="text-xs font-semibold text-ink-mute">({total} perlu perhatian)</span></h2>
        {open && <div role="tablist" className="order-last flex w-full gap-1 overflow-x-auto pt-1 sm:order-none sm:ml-3 sm:w-auto sm:flex-1 sm:pt-0 [scrollbar-width:none]">
          {tabs.map((t) => (
            <button key={t.k} role="tab" aria-selected={t.k === cur.k} onClick={() => setTab(t.k)}
              className={cx('flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition', t.k === cur.k ? 'bg-ink text-white shadow-sm' : 'bg-white/70 text-ink-soft ring-1 ring-slate-200 hover:text-ink')}>
              {t.label}<span className={cx('rounded-full px-1.5 text-[10px] font-bold', t.k === cur.k ? 'bg-white/20 text-white' : t.n ? 'bg-rose-500 text-white' : 'bg-slate-100 text-ink-mute')}>{t.n}</span>
            </button>
          ))}
        </div>}
        <FoldBtn open={open} onClick={toggle} label="Keuangan & Pengajuan" className="ml-auto" />
      </div>
      {open && cur.el}
    </Card>
  )
}

/** Koordinator bahasa (mis. Emma = Jepang): kontrol semua order bahasa tsb ke vendor, lintas cabang. */
function CoordBoard({ lang }) {
  const { data, user, assignTranslator, save, notify } = useApp()
  const [open, toggle] = useFold('coord')
  const [tab, setTab] = useState('ajukan')
  const [form, setForm] = useState({})
  const get = (id) => ({ vendor: '', svc: '', ongkir: '', file: null, busy: false, ...form[id] })
  const set = (id, patch) => setForm((f) => ({ ...f, [id]: { ...get(id), ...f[id], ...patch } }))
  const vendors = useMemo(() => data.people.filter((p) => p.type === 'vendor')
    .sort((a, b) => Number((b.languages || []).includes(lang) || (b.services || []).some((x) => x.name.includes(lang))) - Number((a.languages || []).includes(lang) || (a.services || []).some((x) => x.name.includes(lang)))), [data.people, lang])
  const all = useMemo(() => data.projects.flatMap((p) => (p.sub_projects || []).map((x) => ({ ...x, project: p, flow: flowOf(x, p) })))
    .filter((x) => x.type === 'terjemahan' && foreignLang(x) === lang && (['tr_ext', 'tr_bill'].includes(x.flow) || x.stage === 'pilih_penerjemah'))
    .sort((a, b) => new Date(a.project.about?.deadline || 0) - new Date(b.project.about?.deadline || 0)), [data.projects, lang])
  const groups = {
    ajukan: all.filter((x) => (x.flow === 'tr_ext' && x.stage === 'pengajuan') || (x.flow === 'tr_bill' && x.stage === 'order')),
    proses: all.filter((x) => (x.flow === 'tr_ext' && ['persetujuan', 'pembayaran', ...VENDOR_PAID_STAGES].includes(x.stage)) || (x.flow === 'tr_bill' && x.stage === 'proses_vendor')),
    spv: all.filter((x) => x.flow === 'tr_int'),
    selesai: all.filter((x) => x.stage === DONE),
  }
  const list = groups[tab]
  const upload = async (r, file) => {
    if (!file) return
    set(r.id, { busy: true })
    try { set(r.id, { file: await drive.upload(file, { branch: r.project.branch, invoice: r.project.invoice_no }), busy: false }) } catch (e) { notify(e.message, 'err'); set(r.id, { busy: false }) }
  }
  const submit = async (r) => {
    const f = get(r.id); const v = vendors.find((x) => x.id === f.vendor); const service = v?.services?.[Number(f.svc)]
    if (!v || !service) return notify('Pilih vendor & layanan dulu', 'err')
    set(r.id, { busy: true })
    try {
      await assignTranslator(r.project, r.id, { kind: 'vendor', id: v.id, service, extra: { ongkir_cost: Number(f.ongkir) || 0, ...(f.file ? { tagihan_vendor: f.file } : {}), coordinator: user.id } })
      notify(isBilled(v) ? `${r.project.invoice_no}: order dicatat — dibayar lewat tagihan ${PAYMENT_TERMS[termOf(v)].short.toLowerCase()}` : `${r.project.invoice_no}: diajukan ke Direktur`)
    } catch (e) { notify(e.message, 'err'); set(r.id, { busy: false }) }
  }
  const pickVendor = (r, id) => {
    const v = vendors.find((x) => x.id === id)
    const i = (v?.services || []).findIndex((x) => x.name.includes(lang) && x.name.startsWith(`Terjemahan ${r.lang_from}`))
    set(r.id, { vendor: id, svc: i >= 0 ? String(i) : (v?.services?.length ? '0' : '') })
  }
  const TABS = [['ajukan', 'Perlu Order / Ajukan'], ['proses', 'Proses Vendor'], ['spv', 'Menunggu Supervisor'], ['selesai', 'Selesai']]
  const sel = 'w-full rounded-lg border-0 bg-white px-2 py-1.5 text-xs ring-1 ring-slate-300 focus:ring-2 focus:ring-brand'

  return (
    <Card className="overflow-hidden ring-2 ring-rose-200">
      <div className="flex flex-wrap items-center gap-2 bg-rose-50 px-4 py-3">
        <Languages className="h-4 w-4 text-rose-600" />
        <h2 className="font-bold">Koordinator Bahasa {lang} <span className="text-ink-mute">({all.filter((x) => x.stage !== DONE).length} order aktif)</span></h2>
        <div className="ml-auto flex flex-wrap rounded-lg bg-white p-0.5 ring-1 ring-rose-200">
          {TABS.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={cx('rounded-md px-2.5 py-1 text-xs font-semibold', tab === k ? 'bg-ink text-white' : 'text-ink-soft hover:bg-slate-100')}>{l} {groups[k].length}</button>)}
        </div>
        <FoldBtn open={open} onClick={toggle} label={`Koordinator Bahasa ${lang}`} />
      </div>
      {open && (list.length === 0 ? <p className="px-4 py-6 text-center text-sm text-ink-mute">Tidak ada order di sini.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-ink-mute">
              <tr><th className="px-4 py-2 font-semibold">Invoice & Pelanggan</th><th className="px-2 py-2 font-semibold">Pemesan</th><th className="px-2 py-2 font-semibold">Dokumen</th>
                <th className="px-2 py-2 font-semibold">Deadline</th><th className="px-2 py-2 font-semibold">{tab === 'ajukan' ? 'Vendor · Layanan · Ongkir · Tagihan' : 'Vendor & Status'}</th><th className="px-4 py-2" /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((r) => {
                const f = get(r.id); const v = vendors.find((x) => x.id === (f.vendor || r.data?.vendor)); const dl = daysLeft(r.project.about?.deadline)
                const docs = r.docs?.length ? r.docs : [{ desc: r.title, pages: r.pages }]
                return (
                  <tr key={r.id} className="align-top hover:bg-slate-50/60">
                    <td className="px-4 py-2.5">
                      <CopyText text={r.project.invoice_no} label="No. Invoice" strong />
                      <div className="max-w-[190px] text-xs text-ink-soft"><CopyText text={r.project.customer?.name} label="Nama Pelanggan" /></div>
                      <a href={`#/projects/${r.project.id}`} className="text-[11px] font-semibold text-brand hover:underline">buka</a>
                    </td>
                    <td className="px-2 py-2.5 text-xs"><p className="font-semibold">{r.project.branch}</p><p className="text-ink-mute">{r.project.about?.cs_name}</p></td>
                    <td className="px-2 py-2.5 text-xs"><ul className="max-w-[170px]">{docs.map((x, i) => <li key={i} className="truncate"><b>{x.desc || r.title}</b> · {x.pages || 1} hal</li>)}</ul><p className="font-semibold text-rose-700">{r.lang_from} → {r.lang_to}</p></td>
                    <td className="px-2 py-2.5"><p className={cx('whitespace-nowrap text-xs font-semibold', dl !== null && dl <= 1 && 'text-rose-600')}>{tgl(r.project.about?.deadline)}</p><PriorityBadge p={r.project.about?.priority} className="mt-0.5 whitespace-nowrap" /></td>
                    {tab === 'ajukan' ? (
                      <td className="px-2 py-2.5">
                        <div className="grid w-[330px] grid-cols-2 gap-1.5">
                          <select className={sel} value={f.vendor} onChange={(e) => pickVendor(r, e.target.value)} aria-label={`Vendor ${r.project.invoice_no}`}>
                            <option value="">— Vendor —</option>{vendors.map((x) => <option key={x.id} value={x.id}>{x.name}{(x.languages || []).length ? ` · ${x.languages.join(', ')}` : ''} · {PAYMENT_TERMS[termOf(x)].short}</option>)}
                          </select>
                          <select className={sel} value={f.svc} onChange={(e) => set(r.id, { svc: e.target.value })} disabled={!v} aria-label={`Layanan ${r.project.invoice_no}`}>
                            <option value="">— Layanan —</option>{(v?.services || []).map((x, i) => <option key={i} value={i}>{x.name} — {rupiah(x.price)}</option>)}
                          </select>
                          <Input type="number" inputMode="numeric" placeholder="Ongkir (Rp)" value={f.ongkir} onChange={(e) => set(r.id, { ongkir: e.target.value })} className="text-xs" aria-label={`Ongkir ${r.project.invoice_no}`} />
                          {f.file ? <span className="flex items-center gap-1 truncate text-xs font-semibold text-emerald-700"><FileCheck2 className="h-4 w-4 shrink-0" />{f.file.name}</span> : (
                            <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-white px-2 py-1.5 text-xs font-semibold text-ink-soft ring-1 ring-slate-300 hover:text-brand hover:ring-brand">
                              <Upload className="h-3.5 w-3.5" />Tagihan Vendor
                              <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => upload(r, e.target.files?.[0])} aria-label={`Upload tagihan ${r.project.invoice_no}`} />
                            </label>
                          )}
                        </div>
                        {v && f.svc !== '' && <p className="mt-1 text-[11px] text-ink-mute">Total: <b className="text-ink">{rupiah((Number(v.services?.[Number(f.svc)]?.price) || 0) + (Number(f.ongkir) || 0))}</b>{isBilled(v) && <span className="ml-1 rounded bg-violet-50 px-1.5 font-semibold text-violet-700">tidak langsung dibayar · masuk tagihan {PAYMENT_TERMS[termOf(v)].short.toLowerCase()}</span>}</p>}
                      </td>
                    ) : (
                      <td className="px-2 py-2.5 text-xs">
                        <p className="font-semibold">{v?.name || (r.flow === 'tr_int' ? 'Belum diserahkan Supervisor' : '—')}</p>
                        {r.data?.vendor_service && <p className="text-ink-mute">{r.data.vendor_service} · {rupiah(totalPengajuan(r.data))}</p>}
                        {r.flow === 'tr_ext' && <PengajuanStatus stage={r.stage} revision={!!r.data?.revision_note} />}
                        {r.flow === 'tr_bill' && <span className="inline-block rounded-full bg-violet-50 px-2 py-0.5 font-semibold text-violet-700 ring-1 ring-violet-200">{r.stage === 'proses_vendor' ? 'Dikerjakan vendor' : r.stage === DONE ? 'Hasil diterima' : 'Order'} · {r.data?.bill_id ? 'sudah masuk tagihan' : 'belum ditagih'}</span>}
                        <div className="mt-1 flex flex-wrap gap-1.5">{r.data?.tagihan_vendor && <DownloadBukti file={r.data.tagihan_vendor} label="Tagihan" />}{r.data?.bukti_transfer && <DownloadBukti file={r.data.bukti_transfer} />}</div>
                      </td>
                    )}
                    <td className="px-4 py-2.5 text-right">{tab === 'ajukan' && <Button size="sm" className="whitespace-nowrap" loading={f.busy} disabled={!f.vendor || f.svc === ''} onClick={() => submit(r)}>{isBilled(v) ? 'Order' : 'Ajukan'}</Button>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}
    </Card>
  )
}

/** Posisi sub project per alur — ringkas (1 baris per alur, hanya tahap yang berisi). Khusus Superadmin/Admin Pusat/Supervisor. */
function FlowPositions({ subs }) {
  const [open, toggle] = useFold('flows')
  const flows = Object.entries(CATEGORIES).map(([key, c]) => {
    const list = subs.filter((x) => x.flow === key)
    const stages = [...c.stages.map((x) => x.key), DONE].map((k) => ({ k, n: list.filter((x) => x.stage === k).length })).filter((x) => x.n)
    return { key, c, total: list.length, done: list.filter((x) => x.stage === DONE).length, stages }
  }).filter((f) => f.total)
  return (
    <Card className="overflow-hidden">
      <div className="card-head flex items-center gap-2 px-4 py-3">
        <FolderKanban className="h-4 w-4 text-brand" />
        <h2 className="font-bold">Posisi sub project per alur</h2>
        <span className="text-xs text-ink-mute">{subs.length} sub project</span>
        <FoldBtn open={open} onClick={toggle} label="Posisi sub project per alur" className="ml-auto" />
      </div>
      {open && (
        <ul className="divide-y divide-slate-100 border-t border-slate-100">
          {flows.map(({ key, c, total, done, stages }) => (
            <li key={key} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5">
              <span className="w-40 shrink-0 text-sm font-semibold">{c.label} <span className="text-xs font-normal text-ink-mute">· {total}</span></span>
              <span className="flex min-w-0 flex-1 flex-wrap gap-1">
                {stages.map(({ k, n }) => (
                  <span key={k} className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ring-1', k === DONE ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-50 text-ink-soft ring-slate-200')}>
                    {stageLabel(key, k)}<b className="tabular-nums">{n}</b>
                  </span>
                ))}
              </span>
              <span className="w-20 text-right text-xs font-semibold tabular-nums text-emerald-700">{Math.round((done / total) * 100)}% selesai</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

/** Buka/tutup seksi dashboard — tersimpan per perangkat. */
function useFold(key) {
  const k = `atlas-fold-${key}`
  const [open, setOpen] = useState(() => { try { return localStorage.getItem(k) !== '0' } catch { return true } })
  const toggle = () => setOpen((o) => { try { localStorage.setItem(k, o ? '0' : '1') } catch { /* abaikan */ } return !o })
  return [open, toggle]
}
function FoldBtn({ open, onClick, label, className }) {
  return (
    <button type="button" onClick={onClick} aria-expanded={open} aria-label={`${open ? 'Tutup' : 'Buka'} ${label}`} title={open ? 'Minimize' : 'Buka'}
      className={cx('fold grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-ink-soft ring-1 ring-slate-200 hover:text-brand hover:ring-brand', className)}>
      <ChevronUp className={cx('h-4 w-4 transition-transform', !open && 'rotate-180')} />
    </button>
  )
}

/** Saldo petty cash — di atas agar langsung terlihat. Kas Apostille (Supervisor) terpisah dari kas cabang. */
export function PettyStrip({ accounts, balance }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {accounts.map((k) => {
        const v = balance(k); const ap = k === APOSTILLE_FUND
        return (
          <a key={k} href="#/settings/petty" title="Buka Petty Cash" className={cx('min-w-[170px] flex-1 rounded-2xl p-3.5 shadow-sm ring-1 transition hover:ring-brand', ap ? 'bg-emerald-50 ring-emerald-200' : 'bg-white ring-slate-200')}>
            <p className={cx('flex items-center gap-1.5 text-[11px] font-semibold', ap ? 'text-emerald-800' : 'text-ink-mute')}>{ap ? <Stamp className="h-3.5 w-3.5" /> : <Wallet className="h-3.5 w-3.5" />}{pettyLabel(k)}</p>
            <p className={cx('mt-0.5 text-lg font-extrabold tabular-nums', v < 500000 && 'text-rose-600')}>{rupiah(v)}</p>
          </a>
        )
      })}
    </div>
  )
}

/** Grafik kapasitas penerjemah internal. Tanpa rentang = beban saat ini; dengan rentang tanggal = order ber-deadline di rentang itu. */
const CAP = 4 // ≥ 4 dokumen aktif dianggap penuh
const isoDay = (dt) => new Date(dt.getTime() - dt.getTimezoneOffset() * 6e4).toISOString().slice(0, 10)
/** Label rentang deadline: Hari ini / Besok / tanggal / tanggal – tanggal. */
const rangeLabel = (r) => {
  if (!r?.from && !r?.to) return ''
  const today = isoDay(new Date()); const tmr = isoDay(new Date(Date.now() + 864e5))
  if (r.from === r.to) return r.from === today ? 'Hari ini' : r.from === tmr ? 'Besok' : tgl(r.from)
  return `${r.from ? tgl(r.from) : '…'} – ${r.to ? tgl(r.to) : '…'}`
}
function TranslatorLoad({ range: rangeProp, setRange: setRangeProp }) {
  const { data } = useApp()
  const [open, toggle] = useFold('load')
  const [rangeLocal, setRangeLocal] = useState({ from: '', to: '' })
  const range = rangeProp ?? rangeLocal; const setRange = setRangeProp ?? setRangeLocal
  const ranged = !!(range.from || range.to)
  const preset = (days) => { const a = new Date(); const b = new Date(Date.now() + days * 864e5); setRange({ from: isoDay(a), to: isoDay(b) }) }
  const rows = useMemo(() => {
    const inRange = (dl) => { if (!dl) return false; const day = String(dl).slice(0, 10); return (!range.from || day >= range.from) && (!range.to || day <= range.to) }
    const subs = data.projects.flatMap((p) => (p.sub_projects || []).map((x) => ({ ...x, project: p, flow: flowOf(x, p) })))
    const trSubs = subs.filter((x) => ['tr_int', 'tr_nt'].includes(x.flow) && x.data?.translator && (ranged ? inRange(x.project.about?.deadline) : x.stage === 'penerjemahan'))
    const trs = data.users.filter((u) => u.role === 'penerjemah' && u.active !== false).map((u) => {
      const jobs = trSubs.filter((x) => x.data.translator === u.id)
      const act = jobs.filter((x) => x.stage === 'penerjemahan'); const done = jobs.filter((x) => x.stage !== 'penerjemahan')
      const next = act.map((x) => x.project.about?.deadline).filter(Boolean).sort()[0]
      return { u, n: act.length, done: done.length, pages: jobs.reduce((a, x) => a + (Number(x.pages) || 1), 0), next }
    }).sort((a, b) => a.n - b.n || a.pages - b.pages)
    const vendorJobs = subs.filter((x) => x.flow === 'tr_ext' && x.stage !== DONE && x.data?.vendor && (!ranged || inRange(x.project.about?.deadline))).length
    return { trs, vendorJobs }
  }, [data.projects, data.users, range, ranged])
  const max = Math.max(CAP, ...rows.trs.map((r) => r.n + r.done))
  const tone = (n) => (n === 0 ? ['bg-emerald-500', 'Kosong', 'text-emerald-700'] : n < CAP - 1 ? ['bg-brand', 'Tersedia', 'text-brand'] : n < CAP ? ['bg-amber-500', 'Hampir penuh', 'text-amber-700'] : ['bg-rose-500', 'Penuh', 'text-rose-700'])
  const total = rows.trs.reduce((a, r) => a + r.n + r.done, 0)
  const chip = (on) => cx('rounded-lg px-2.5 py-1 text-xs font-semibold ring-1', on ? 'bg-indigo-600 text-white ring-indigo-600' : 'bg-white text-ink-soft ring-slate-200 hover:ring-indigo-400')
  const today = isoDay(new Date())
  return (
    <Card className="overflow-hidden">
      <div className="card-head flex flex-wrap items-center gap-2 bg-indigo-50/60 px-4 py-3">
        <Users className="h-4 w-4 text-indigo-600" />
        <h2 className="font-bold">Kapasitas Penerjemah</h2>
        <span className="text-xs text-ink-mute">{ranged ? `deadline ${rangeLabel(range)} · ${total} dokumen` : `dokumen sedang diterjemahkan · kapasitas ${CAP}/orang`}</span>
        <FoldBtn open={open} onClick={toggle} label="Kapasitas Penerjemah" className="ml-auto" />
      </div>
      {open && (
        <>
          <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 px-4 py-2">
            <button className={chip(!ranged)} onClick={() => setRange({ from: '', to: '' })}>Saat ini</button>
            <button className={chip(ranged && range.from === today && range.to === today)} onClick={() => preset(0)}>Hari ini</button>
            <button className={chip(ranged && range.from === today && range.to === isoDay(new Date(Date.now() + 864e5)))} onClick={() => preset(1)}>s/d Besok</button>
            <button className={chip(ranged && range.from === today && range.to === isoDay(new Date(Date.now() + 6 * 864e5)))} onClick={() => preset(6)}>7 hari</button>
            <button className={chip(ranged && range.from === today && range.to === isoDay(new Date(Date.now() + 29 * 864e5)))} onClick={() => preset(29)}>30 hari</button>
            <span className="ml-auto flex items-center gap-1.5 text-xs text-ink-mute">Deadline
              <Input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className="w-36 !py-1 text-xs" aria-label="Dari tanggal" />
              –<Input type="date" value={range.to} min={range.from || undefined} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className="w-36 !py-1 text-xs" aria-label="Sampai tanggal" />
            </span>
          </div>
          <div className="space-y-2.5 px-4 py-4">
            {rows.trs.map(({ u, n, done, pages, next }) => {
              const [bar, label, txt] = tone(n)
              return (
                <div key={u.id} className="grid grid-cols-[120px_1fr_auto] items-center gap-3 sm:grid-cols-[170px_1fr_320px]">
                  <p className="truncate text-sm font-semibold">{u.name} <span className="text-[11px] font-normal text-ink-mute">· {placeOf(u)}</span></p>
                  <div className="relative flex h-3 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${u.name}: ${n} dokumen dikerjakan${done ? `, ${done} sudah selesai diterjemahkan` : ''}`}>
                    <div className={cx('h-3', bar)} style={{ width: `${n ? Math.max(6, (n / max) * 100) : 0}%` }} />
                    {done > 0 && <div className="h-3 bg-slate-300" style={{ width: `${(done / max) * 100}%` }} title="Sudah selesai diterjemahkan" />}
                    <span className="absolute inset-y-0 border-l-2 border-dashed border-slate-400/70" style={{ left: `${(CAP / max) * 100}%` }} title="Batas kapasitas" />
                  </div>
                  <p className="text-right text-xs tabular-nums sm:text-left"><b>{n}</b> dok{done ? <span className="text-ink-mute"> (+{done} selesai)</span> : ''} · {pages} hal <span className={cx('ml-1 font-semibold', txt)}>{label}</span>
                    {next && <span className="hidden text-ink-mute sm:inline"> · DL {tgl(next)}</span>}</p>
                </div>
              )
            })}
            <p className="flex flex-wrap items-center gap-x-3 pt-1 text-[11px] text-ink-mute">
              <span className="inline-flex items-center gap-1"><span className="h-2 w-3 rounded bg-brand" />sedang diterjemahkan</span>
              {ranged && <span className="inline-flex items-center gap-1"><span className="h-2 w-3 rounded bg-slate-300" />sudah selesai diterjemahkan</span>}
              <span>garis putus-putus = batas kapasitas</span>
              <span>· Vendor eksternal: {rows.vendorJobs} dokumen</span>
            </p>
          </div>
        </>
      )}
    </Card>
  )
}

/** Dashboard Penerjemah, Proofreader & Otorisator — di layar web pas satu layar (tanpa scroll halaman):
 *  kiri = Daftar Pekerjaan (scroll di dalam kartu, bisa di-minimize), kanan = performa & statistik. */
function WorkerDesk({ user, tasks }) {
  const late = tasks.filter((t) => { const d = daysLeft(t.project.about?.deadline); return d !== null && d < 0 }).length
  const soon = tasks.filter((t) => { const d = daysLeft(t.project.about?.deadline); return d !== null && d >= 0 && d <= 1 }).length
  const noun = user.role === 'penerjemah' ? 'terjemahan' : user.role === 'proofreader' ? 'untuk diperiksa' : 'untuk diotorisasi'
  // Daftar pekerjaan dihapus dari Dashboard — semua tugas dikerjakan di My Project agar tidak dua tempat.
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
        <div>
          <p className="text-sm text-ink-mute">Halo,</p>
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight">{user.name}</h1>
        </div>
        <p className="pb-0.5 text-base text-ink-soft">Anda punya <b className="text-ink">{tasks.length}</b> order {noun}.</p>
        <div className="ml-auto flex gap-1.5 pb-0.5 text-xs font-semibold">
          {late > 0 && <span className="rounded-full bg-rose-50 px-2.5 py-1 text-rose-700 ring-1 ring-rose-200">{late} terlambat</span>}
          {soon > 0 && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-800 ring-1 ring-amber-200">{soon} deadline ≤ 1 hari</span>}
        </div>
      </div>

      <a href="#/projects" className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 shadow-card ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:ring-brand/40">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand"><Inbox className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-bold text-ink">Buka My Project — {tasks.length} tugas menunggu</span>
          <span className="block text-xs text-ink-mute">Semua pekerjaan dikerjakan di sana: Mulai → Upload hasil → Kirim</span>
        </span>
        <ArrowRight className="h-5 w-5 shrink-0" />
      </a>

      <div className="grid gap-3 lg:grid-cols-2">
        <PerformanceCard narrow />
        {user.role === 'penerjemah' && <TranslatorStats narrow />}
        {user.role === 'proofreader' && <ProofreaderStats narrow />}
        {user.role === 'otorisator' && <AuthStats narrow />}
      </div>
    </div>
  )
}

/** Supervisor/Superadmin: tetapkan penerjemah internal / vendor langsung dari dashboard. */
function AssignTable({ rows: allRows, range = { from: '', to: '' }, setRange = () => {} }) {
  const { data, assignTranslator, notify } = useApp()
  const [open, toggle] = useFold('assign')
  // filter deadline dari judul kolom (rentang / tanggal tertentu) — Kapasitas Penerjemah di atas ikut tanggal yang sama
  const ranged = !!(range.from || range.to)
  const rows = useMemo(() => (ranged ? allRows.filter((r) => { const d = r.project.about?.deadline; if (!d) return false; const day = String(d).slice(0, 10); return (!range.from || day >= range.from) && (!range.to || day <= range.to) }) : allRows), [allRows, range, ranged])
  const [dlOpen, setDlOpen] = useState(false)
  const today = isoDay(new Date())
  const [draft, setDraft] = useState({ date: today, from: today, to: isoDay(new Date(Date.now() + 6 * 864e5)) })
  const pick = (r) => { setRange(r); setDlOpen(false) }
  const [form, setForm] = useState({}) // per sub id: { pick: 'internal:u-x' | 'vendor:p-x', svc: index, busy }
  const get = (id) => ({ pick: '', svc: '', ...form[id] })
  const set = (id, patch) => setForm((f) => ({ ...f, [id]: { ...get(id), ...f[id], ...patch } }))
  const translators = data.users.filter((u) => u.role === 'penerjemah' && u.active !== false)
  const vendors = data.people.filter((p) => p.type === 'vendor')
  const load = useMemo(() => {
    const m = {}
    data.projects.forEach((p) => (p.sub_projects || []).forEach((x) => { if (x.stage === 'penerjemahan' && x.data?.translator) m[x.data.translator] = (m[x.data.translator] || 0) + 1 }))
    return m
  }, [data.projects])
  // layanan vendor yang cocok dengan pasangan bahasa didahulukan
  const guessSvc = (v, r) => {
    const lang = [r.lang_from, r.lang_to].find((l) => l && l !== 'Indonesia')
    const i = (v?.services || []).findIndex((x) => lang && x.name.toLowerCase().includes(lang.toLowerCase()))
    return i >= 0 ? String(i) : ''
  }
  const coordOf = (r) => coordinatorFor(data.users, foreignLang(r))
  const pickOf = (r) => form[r.id]?.pick ?? (coordOf(r) ? `coord:${coordOf(r).id}` : '')
  const choose = (r, val) => {
    const [kind, id] = val.split(':')
    set(r.id, { pick: val, svc: kind === 'vendor' ? guessSvc(vendors.find((v) => v.id === id), r) : '' })
  }
  const assign = async (r) => {
    const f = { ...get(r.id), pick: pickOf(r) }; const [kind, id] = f.pick.split(':')
    if (!id) return notify('Pilih penerjemah atau vendor dulu', 'err')
    const v = kind === 'vendor' ? vendors.find((x) => x.id === id) : null
    const service = v && f.svc !== '' ? v.services?.[Number(f.svc)] : null
    set(r.id, { busy: true })
    try {
      await assignTranslator(r.project, r.id, { kind, id, service })
      notify(kind === 'coord' ? `${r.project.invoice_no}: diserahkan ke ${data.users.find((u) => u.id === id)?.name}`
        : kind === 'internal' ? `${r.project.invoice_no}: masuk To-Do ${translators.find((u) => u.id === id)?.name}`
        : service ? `${r.project.invoice_no}: diajukan ke Direktur` : `${r.project.invoice_no}: vendor ditetapkan`)
    } catch (e) { notify(e.message, 'err'); set(r.id, { busy: false }) }
  }

  return (
    <Card className="overflow-hidden">
      <div className="card-head flex flex-wrap items-center gap-2 bg-indigo-50 px-4 py-3">
        <Languages className="h-4 w-4 text-indigo-600" />
        <h2 className="font-bold">Perlu Penerjemah <span className="text-ink-mute">({rows.length}{ranged && allRows.length !== rows.length ? ` dari ${allRows.length}` : ''})</span></h2>
        {ranged && <button type="button" onClick={() => setRange({ from: '', to: '' })} className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-2.5 py-0.5 text-[11px] font-semibold text-white hover:bg-indigo-700" title="Hapus filter deadline"><CalendarDays className="h-3 w-3" />Deadline {rangeLabel(range)}<X className="h-3 w-3" /></button>}
        <span className="ml-auto hidden text-xs text-ink-mute sm:inline">Klik judul <b>Deadline</b> untuk memilih tanggal · Pilih penerjemah/vendor lalu Tetapkan</span>
        <FoldBtn open={open} onClick={toggle} label="Perlu Penerjemah" className="ml-auto sm:ml-0" />
      </div>
      <Sheet open={dlOpen} onClose={() => setDlOpen(false)} title="Deadline perlu penerjemah"
        footer={<><Button variant="outline" className="flex-1" onClick={() => pick({ from: '', to: '' })}>Tampilkan semua</Button><Button className="flex-[2]" onClick={() => pick({ from: draft.from <= draft.to ? draft.from : draft.to, to: draft.from <= draft.to ? draft.to : draft.from })}>Terapkan rentang</Button></>}>
        <div className="space-y-4">
          <p className="rounded-xl bg-indigo-50 px-3 py-2 text-xs text-indigo-900 ring-1 ring-indigo-200">Daftar <b>Perlu Penerjemah</b> dan grafik <b>Kapasitas Penerjemah</b> di atasnya mengikuti tanggal yang dipilih — jadi terlihat siapa yang masih longgar di tanggal deadline tersebut.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Button variant={range.from === today && range.to === today ? 'primary' : 'outline'} onClick={() => pick({ from: today, to: today })}>Hari ini</Button>
            <Button variant={range.from === isoDay(new Date(Date.now() + 864e5)) && range.from === range.to ? 'primary' : 'outline'} onClick={() => { const d = isoDay(new Date(Date.now() + 864e5)); pick({ from: d, to: d }) }}>Besok</Button>
            <Button variant="outline" onClick={() => pick({ from: today, to: isoDay(new Date(Date.now() + 6 * 864e5)) })}>7 hari</Button>
            <Button variant="outline" onClick={() => pick({ from: today, to: isoDay(new Date(Date.now() + 29 * 864e5)) })}>30 hari</Button>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold text-ink-soft">Deadline di tanggal tertentu</p>
            <div className="flex gap-2">
              <Input type="date" value={draft.date} onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))} aria-label="Tanggal deadline" />
              <Button variant="outline" disabled={!draft.date} onClick={() => pick({ from: draft.date, to: draft.date })}>Pilih tanggal</Button>
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold text-ink-soft">Rentang tanggal</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-ink-mute">Dari<Input type="date" value={draft.from} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))} aria-label="Dari tanggal deadline" /></label>
              <label className="text-xs text-ink-mute">Sampai<Input type="date" value={draft.to} min={draft.from || undefined} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} aria-label="Sampai tanggal deadline" /></label>
            </div>
          </div>
          {ranged && <p className="text-xs text-ink-mute">Filter aktif: <b className="text-indigo-700">{rangeLabel(range)}</b></p>}
        </div>
      </Sheet>
      {!open ? null : rows.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-ink-mute">
          {ranged && allRows.length ? <>Tidak ada yang perlu penerjemah dengan deadline <b>{rangeLabel(range)}</b>. <button type="button" onClick={() => setRange({ from: '', to: '' })} className="font-semibold text-brand hover:underline">Tampilkan semua ({allRows.length})</button></> : 'Semua dokumen sudah punya penerjemah. 🎉'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-ink-mute">
              <tr><th className="px-4 py-2 font-semibold">No. Invoice & Pelanggan</th><th className="px-2 py-2 font-semibold">Dokumen</th><th className="px-2 py-2 font-semibold">Bahasa</th>
                <th className="px-2 py-2 font-semibold">
                  <button type="button" onClick={() => setDlOpen(true)} className={cx('flex items-center gap-1 uppercase hover:text-brand', ranged && 'text-brand')} title="Atur rentang / tanggal deadline" aria-label="Filter deadline perlu penerjemah">
                    Deadline <ChevronDown className="h-3 w-3" />{ranged && <span className="rounded-full bg-brand px-1.5 py-px text-[10px] normal-case tracking-normal text-white">{rangeLabel(range)}</span>}
                  </button>
                </th><th className="px-2 py-2 font-semibold">Penerjemah / Vendor</th><th className="px-4 py-2" /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => {
                const f = { ...get(r.id), pick: pickOf(r) }; const [kind, pid] = f.pick.split(':'); const co = coordOf(r)
                const v = kind === 'vendor' ? vendors.find((x) => x.id === pid) : null
                const svc = v && f.svc !== '' ? v.services?.[Number(f.svc)] : null
                const dl = daysLeft(r.project.about?.deadline)
                const docs = r.docs?.length ? r.docs : [{ desc: r.title, pages: r.pages }]
                return (
                  <tr key={r.id} className="align-middle hover:bg-slate-50/60">
                    <td className="px-4 py-2.5">
                      <CopyText text={r.project.invoice_no} label="No. Invoice" strong />
                      <div className="max-w-[200px] text-xs text-ink-soft"><CopyText text={r.project.customer?.name} label="Nama Pelanggan" /></div>
                      <p className="text-[11px] text-ink-mute"><span className="font-semibold text-ink-soft">{r.project.branch}</span> · <a href={`#/projects/${r.project.id}`} className="font-semibold text-brand hover:underline">buka</a></p>
                    </td>
                    <td className="px-2 py-2.5">
                      <ul className="max-w-[170px] text-xs">{docs.map((x, i) => <li key={i} className="truncate"><b>{x.desc || r.title}</b> <span className="text-ink-mute">· {x.pages || 1} hal</span></li>)}</ul>
                      {r.flow === 'tr_ext' && <span className="mt-0.5 inline-block rounded bg-violet-50 px-1.5 text-[10px] font-semibold text-violet-700">Pengajuan vendor — vendor kosong</span>}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-xs font-semibold">{r.lang_from} → {r.lang_to}</td>
                    <td className="px-2 py-2.5">
                      <p className={cx('whitespace-nowrap text-xs font-semibold', dl !== null && dl <= 1 ? 'text-rose-600' : '')}>{tgl(r.project.about?.deadline)}</p>
                      <p className="text-[11px] text-ink-mute">{dl === null ? '' : dl < 0 ? `Terlambat ${-dl} hr` : dl === 0 ? 'Hari ini' : `${dl} hari lagi`}</p>
                      <PriorityBadge p={r.project.about?.priority} className="mt-0.5 whitespace-nowrap" />
                    </td>
                    <td className="px-2 py-2.5">
                      <select value={f.pick} onChange={(e) => choose(r, e.target.value)} aria-label={`Penerjemah ${r.project.invoice_no} ${r.title}`}
                        className="w-56 rounded-lg border-0 bg-white px-2.5 py-1.5 text-xs ring-1 ring-slate-300 focus:ring-2 focus:ring-brand">
                        <option value="">— Pilih —</option>
                        {co && <optgroup label={`Koordinator Bahasa ${co.coordinator_lang}`}><option value={`coord:${co.id}`}>Serahkan ke {co.name}</option></optgroup>}
                        <optgroup label="Penerjemah (internal)">{translators.map((u) => <option key={u.id} value={`internal:${u.id}`}>{u.name} · {placeOf(u)} · {load[u.id] || 0} tugas</option>)}</optgroup>
                        <optgroup label="Vendor (eksternal)">{vendors.map((p) => <option key={p.id} value={`vendor:${p.id}`}>{p.name} · {PAYMENT_TERMS[termOf(p)].short}</option>)}</optgroup>
                      </select>
                      {v && (
                        <select value={f.svc} onChange={(e) => set(r.id, { svc: e.target.value })} aria-label={`Layanan vendor ${r.project.invoice_no}`}
                          className="mt-1 block w-56 rounded-lg border-0 bg-violet-50 px-2.5 py-1.5 text-xs ring-1 ring-violet-200">
                          <option value="">Layanan diisi CS nanti</option>
                          {(v.services || []).map((x, i) => <option key={i} value={i}>{x.name} — {rupiah(x.price)}</option>)}
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Button size="sm" className="whitespace-nowrap" loading={f.busy} disabled={!f.pick} onClick={() => assign(r)}>{svc ? (isBilled(v) ? 'Order ke Vendor' : 'Ajukan ke Direktur') : kind === 'coord' ? 'Serahkan' : 'Tetapkan'}</Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

/** Daftar pengajuan yang diajukan user ini + progresnya. */
function MySubmissions({ rows, bare }) {
  const { data } = useApp()
  const Wrap = bare ? 'div' : Card
  const vendorOf = (r) => data.people.find((p) => p.id === r.data?.vendor)
  return (
    <Wrap className={bare ? '' : 'overflow-hidden'}>
      {bare ? <FinBar note="Pengajuan vendor yang Anda ajukan" total={rows.filter((r) => r.stage !== DONE).reduce((a, r) => a + totalPengajuan(r.data), 0)} /> : <div className="flex items-center gap-2 bg-violet-50 px-4 py-3">
        <Send className="h-4 w-4 text-violet-600" />
        <h2 className="font-bold">Pengajuan Saya <span className="text-ink-mute">({rows.length})</span></h2>
      </div>}
      <FinHead cols={['Pengajuan', 'Nominal', 'Vendor / Layanan', 'Status', '']} />
      {!rows.length ? <p className="px-4 py-6 text-center text-sm text-ink-mute">Belum ada pengajuan vendor dari Anda.</p> : (
      <ul className="divide-y divide-slate-100">
        {rows.slice(0, 8).map((r) => (
          <FinRow key={r.id} onClick={() => go(`projects/${r.project.id}`)}>
            <span className="min-w-0"><b className="text-sm">{r.project.invoice_no}</b><span className="block truncate text-xs text-ink-soft">{r.title}</span><TimeAgo at={(r.data?.submitted_at || stageArrivedAt(r, r.project))} prefix="Diajukan" className="!mt-0" /></span>
            <FinAmount value={totalPengajuan(r.data)} sub={r.data?.sumber_dana ? `Dana ${r.data.sumber_dana}` : null} />
            <span className="min-w-0 text-xs"><span className="block truncate font-semibold text-ink">{vendorOf(r)?.name || '—'}</span><span className="block truncate text-ink-mute">{r.data?.vendor_service || '—'}</span></span>
            <span><PengajuanStatus stage={r.stage} revision={!!r.data?.revision_note} /></span>
            <span />
            <span className="lg:col-span-5"><PengajuanTracker sub={r} compact /><RevisionNote sub={r} className="mt-1.5" /></span>
          </FinRow>
        ))}
      </ul>)}
    </Wrap>
  )
}

const STATUS_STYLE = {
  'Belum Diproses': { cls: 'bg-slate-100 text-slate-700 ring-slate-300', icon: Inbox },
  'Sedang Diproses': { cls: 'bg-amber-50 text-amber-800 ring-amber-300', icon: Hand },
  Selesai: { cls: 'bg-emerald-50 text-emerald-800 ring-emerald-300', icon: CheckCircle2 },
}
/** Dashboard Staf Apostille: daftar pekerjaan apostille & legalisasi internal. */
function StafBoard({ rows }) {
  const { processStage, notify, nameOf } = useApp()
  const [open, toggle] = useFold('staf')
  const [tab, setTab] = useState('aktif')
  const [busy, setBusy] = useState(null)
  const list = rows.filter((r) => (tab === 'aktif' ? r.stage !== DONE : tab === 'selesai' ? r.stage === DONE : true))
    .sort((a, b) => new Date(a.project.about?.deadline || 0) - new Date(b.project.about?.deadline || 0))
  const start = async (r) => {
    setBusy(r.id)
    try { await processStage(r.project, r.id, {}, true); notify(`${r.project.invoice_no}: Sedang Diproses`) } catch (e) { notify(e.message, 'err') } finally { setBusy(null) }
  }
  const count = (k) => rows.filter((r) => (k === 'aktif' ? r.stage !== DONE : k === 'selesai' ? r.stage === DONE : true)).length
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 bg-emerald-50 px-4 py-3">
        <Stamp className="h-4 w-4 text-emerald-600" />
        <h2 className="font-bold">Pekerjaan Apostille & Legalisasi</h2>
        <div className="ml-auto flex rounded-lg bg-white p-0.5 ring-1 ring-emerald-200">
          {[['aktif', 'Aktif'], ['selesai', 'Selesai'], ['semua', 'Semua']].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={cx('rounded-md px-2.5 py-1 text-xs font-semibold', tab === k ? 'bg-emerald-600 text-white' : 'text-ink-soft hover:bg-emerald-50')}>{l} {count(k)}</button>
          ))}
        </div>
        <FoldBtn open={open} onClick={toggle} label="Pekerjaan Apostille & Legalisasi" />
      </div>
      {!open ? null : list.length === 0 ? <p className="px-4 py-6 text-center text-sm text-ink-mute">Tidak ada pekerjaan.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-ink-mute">
              <tr><th className="px-4 py-2 font-semibold">Project & Pelanggan</th><th className="px-2 py-2 font-semibold">Layanan</th><th className="px-2 py-2 font-semibold">Negara / Lembaga</th>
                <th className="px-2 py-2 font-semibold">Deadline</th><th className="px-2 py-2 font-semibold">Status</th><th className="px-4 py-2" /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((r) => {
                const st = stafStatus(r.stage); const S = STATUS_STYLE[st]; const d = daysLeft(r.project.about?.deadline)
                return (
                  <tr key={r.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5"><a href={`#/projects/${r.project.id}`} className="font-bold hover:text-brand">{r.project.invoice_no}</a><TimeAgo at={stageArrivedAt(r, r.project)} prefix="Masuk" /><p className="max-w-[200px] truncate text-xs text-ink-mute">{r.project.customer?.name} · {r.title}</p></td>
                    <td className="px-2 py-2.5"><TB type={r.type} /></td>
                    <td className="px-2 py-2.5 text-ink-soft">{r.type === 'legalisasi' ? (nameOf(r.institution) || '—') : (r.country || '—')}</td>
                    <td className="px-2 py-2.5"><div className="flex items-center gap-1.5"><span className={cx('text-xs', d !== null && d <= 1 && r.stage !== DONE ? 'font-semibold text-rose-600' : 'text-ink-soft')}>{tgl(r.project.about?.deadline)}</span><PriorityBadge p={r.project.about?.priority} iconOnly /></div></td>
                    <td className="px-2 py-2.5"><span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1', S.cls)}><S.icon className="h-3 w-3" />{st}</span></td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
                        {(r.data?.hasil_akhir || r.data?.hasil_vendor) && <DownloadBukti file={r.data?.hasil_akhir || r.data?.hasil_vendor} label={`Hasil ${r.type === 'legalisasi' ? 'Legalisasi' : 'Apostille'}`} />}
                        {r.stage === 'antrian' ? <Button size="sm" loading={busy === r.id} onClick={() => start(r)}>Mulai Proses</Button>
                          : <Button size="sm" variant="outline" onClick={() => go(`projects/${r.project.id}`)}>{r.stage === 'diproses' ? 'Upload Hasil' : 'Buka'}</Button>}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
