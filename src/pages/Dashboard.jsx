import { useMemo } from 'react'
import { FolderKanban, CheckCircle2, AlarmClock, Wallet, Banknote, ArrowRight, Inbox, Stamp, ChevronDown, Hand, Upload, Loader2, FileCheck2, Send, Languages, ChevronUp, Users, Undo2, CalendarDays, X , Sunrise, Moon, Waves, Activity, Target, Sprout, Sparkles, Coffee, ReceiptText, ArrowUp, ArrowDown, StickyNote} from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { kapasitasHarian, KAP_DEFAULT } from '../components/Kapasitas.jsx'
import { Sapaan, AngkaHariIni, Hambatan, RingkasanTim, RingkasanKeuangan } from '../components/DashboardRingkas.jsx'
import { go } from '../lib/router.js'
import { BRANCHES, ROLES, can, scopeByBranch, activeClaim, WORKER_ROLES, roleLabel, branchesOf, isMultiBranch, APOSTILLE_FUND, pettyLabel, pettyAccountsOf, foreignLang, coordinatorFor, placeOf, invoiceLabel} from '../config/access.js'
import { CATEGORIES, DONE, isDone, stagesOf, stageLabel, flowOf, totalPengajuan, stafStatus, PAYMENT_TERMS, termOf, isBilled, recommendFund, VENDOR_PAID_STAGES, stageShort, stageIndex } from '../config/workflows.js'
import { kindPages } from '../config/subtypes.js'
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
import { useTabel, Th } from '../components/TabelSortir.jsx'
import { useEffect, useState } from 'react'
import { coverHariIni, sapaan } from '../lib/cover.js'
import { myReminders, nextAt } from './Reminders.jsx'
import PingBoard from '../components/PingBoard.jsx'
import { TypeBadge, PrintBadge, DemoBadge } from '../components/badges.jsx'
import { Card, Empty, Input, Sheet, cx } from '../components/ui.jsx'
import { daysLeft, rupiah, tgl, jam, stageArrivedAt } from '../lib/format.js'
import TimeAgo from '../components/TimeAgo.jsx'
import { FinHead, FinBar, FinRow, FinAmount, FinActions, Rek, DanaChip, FinCell } from '../components/FinLayout.jsx'

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
  const { user, data, unlinkedInvoices } = useApp()
  const s = useDashStats()
  const [todoOpen, toggleTodo] = useFold('todo')

  const exec = ['superadmin', 'direktur', 'akunting'].includes(user.role)
  // Admin Pusat bisa memproses banyak tahap, tetapi tugasnya hanya Nomor Registrasi; role pimpinan tidak memuat tugas tahap.
  const todoTasks = user.role === 'admin_pusat' ? s.myTasks.filter((t) => t.stage === 'registrasi') : s.myTasks
  if (['penerjemah', 'proofreader', 'otorisator'].includes(user.role)) return <WorkerDesk user={user} tasks={s.myTasks} />

  // Papan khusus peran yang bukan salinan halaman lain: koordinator bahasa &
  // daftar kerja Staf Apostille. Kapasitas (→ Penugasan), Sumber Dana &
  // Pengajuan (→ Keuangan), Apostille untuk Supervisor (→ My Apostille)
  // tidak lagi diulang di sini (keputusan K1).
  const ops = [
    user.coordinator_lang && <CoordBoard key="coord" lang={user.coordinator_lang} />,
    user.role === 'staf_apostille' && s.staf.length > 0 && <StafBoard key="staf" rows={s.staf} />,
  ].filter(Boolean)
  const todoCount = TODO_GROUP_ROLES.includes(user.role) ? roleGroupCount(s, user, data.people) : todoTasks.length
  const kerjaSaya = user.role !== 'staf_apostille'

  return (
    <div className="space-y-4">
      <PingBoard />
      <Sapaan user={user} />
      <AngkaHariIni user={user} s={s} unlinked={WORKER_ROLES.includes(user.role) ? undefined : (unlinkedInvoices?.length ?? unlinkedInvoices ?? 0)} todoCount={todoCount} />
      <CatatanTersemat />

      {/* Hambatan (kiri) + Kerja saya (kanan) — dua pertanyaan utama dalam satu layar */}
      <div className={cx('grid gap-4', kerjaSaya && 'lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-start')}>
        <Hambatan s={s} user={user} />
        {kerjaSaya && <Card className={cx('flex min-h-0 flex-col overflow-hidden')} data-kerja-saya>
          <div className="card-head flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-white ring-1 ring-slate-200"><Inbox className="h-4 w-4 text-ink-soft" /></span>
            <h2 className="mr-auto font-bold">Kerja saya <span className="text-ink-mute">({todoCount})</span><span className="ml-2 hidden text-[11px] font-medium text-ink-mute sm:inline">{TODO_GROUP_ROLES.includes(user.role) ? 'tugas sesuai peran' : 'tahap yang harus saya kerjakan'}</span></h2>
            <FoldBtn open={todoOpen} onClick={toggleTodo} label="Kerja saya" className="h-7 w-7" />
          </div>
          {!todoOpen ? null : (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain lg:max-h-[520px]">
              <PengingatTodo user={user} />
              {TODO_GROUP_ROLES.includes(user.role) ? <RoleTodo s={s} user={user} />
                : todoTasks.length === 0 ? <Empty icon={Inbox} title="Tidak ada tugas" text="Semua tahap yang menjadi bagian Anda sudah diproses." />
                : (
                  <ul className="divide-y divide-slate-100" aria-label="Kerja saya">
                    {todoTasks.map((t) => <TaskRow key={t.id} t={t} user={user} />)}
                  </ul>
                )}
            </div>
          )}
        </Card>}
      </div>

      {/* Ringkasan — angka saja; tabel lengkap di halamannya masing-masing */}
      {(canSeeTeam(user) || exec) && (
        <div className={cx('grid gap-4', canSeeTeam(user) && exec && 'lg:grid-cols-2 lg:items-start')}>
          {canSeeTeam(user) && <RingkasanTim />}
          {exec && <RingkasanKeuangan s={s} />}
        </div>
      )}

      {hasPersonalTasks(user) && user.role !== 'staf_apostille' && <PerformanceCard narrow />}
      {ops}
    </div>
  )
}

/**
 * Catatan project yang disematkan tepat di bawah cover dashboard.
 * Satu catatan satu baris supaya tetap ringkas, dan otomatis hilang begitu
 * projectnya selesai — jadi yang tersisa selalu catatan yang masih berlaku.
 */
function CatatanTersemat() {
  const { user, data, branchFilter } = useApp()
  const [buka, setBuka] = useState(false)
  const rows = useMemo(() => scopeByBranch(user, data.projects, branchFilter)
    .filter((p) => !isDone(p) && !p.cancelled && String(p.about?.notes || '').trim())
    .map((p) => ({ p, teks: String(p.about.notes).replace(/\s*\n+\s*/g, ' · ').trim() }))
    .sort((a, b) => String(a.p.about?.deadline || '').localeCompare(String(b.p.about?.deadline || ''))),
  [user, data.projects, branchFilter])
  if (!rows.length) return null
  const tampil = buka ? rows : rows.slice(0, 5)

  return (
    <section className="rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-200" aria-label="Catatan project" data-catatan-tersemat>
      <p className="mb-1.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-amber-900">
        <StickyNote className="h-3.5 w-3.5" />Catatan project <span className="font-semibold normal-case text-amber-700">({rows.length} aktif · hilang saat project selesai)</span>
      </p>
      <ul className="divide-y divide-amber-200/70">
        {tampil.map(({ p, teks }) => (
          <li key={p.id} data-catatan={p.id}>
            <a href={`#/projects/${p.id}`} className="flex min-h-[32px] items-center gap-2 py-1 text-xs text-amber-900 hover:underline">
              <b className="shrink-0 font-bold tabular-nums">{invoiceLabel(p.invoice_no)}</b>
              <span className="hidden shrink-0 text-amber-700 sm:inline">{p.customer?.name || '—'}</span>
              <span className="min-w-0 flex-1 truncate" title={teks}>{teks}</span>
            </a>
          </li>
        ))}
      </ul>
      {rows.length > 5 && (
        <button type="button" onClick={() => setBuka((v) => !v)} className="mt-1 text-[11px] font-bold text-amber-800 hover:underline" data-aksi="catatan-lainnya">
          {buka ? 'Tampilkan lebih sedikit' : `Lihat ${rows.length - 5} catatan lainnya`}
        </button>
      )}
    </section>
  )
}

const VENDOR_ORDER_STAGES = ['pengajuan', 'persetujuan', 'pembayaran', ...VENDOR_PAID_STAGES, 'order']
const dlText = (d) => (d === null ? '' : d < 0 ? `Terlambat ${-d} hr` : d === 0 ? 'Hari ini' : d === 1 ? 'Besok' : `${d} hari lagi`)

/** Perlu Perhatian: 1) pelanggan prioritas hari ini, 2) deadline hari ini, 3) order ke vendor, 4) deadline 1–2 hari. */
/** Sapaan + ringkasan angka hari ini (klik untuk lompat). */
/**
 * Pengingat pribadi (My Reminders) yang jatuh tempo hari ini atau sudah
 * lewat — ditampilkan menyatu dengan To-Do List supaya tidak ada dua
 * daftar tugas yang terpisah. Dicentang di sini = selesai di My Reminders.
 */
function PengingatTodo({ user }) {
  const { data, save, notify } = useApp()
  const { list, judul } = useMemo(() => {
    const batas = new Date(); batas.setHours(23, 59, 59, 999)
    const semua = myReminders(data, user)
      .filter((r) => !r.done_at && r.active !== false)
      .map((r) => ({ r, at: nextAt(r) }))
      .filter((x) => x.at)
      .sort((a, b) => String(a.at).localeCompare(String(b.at)))
    const jatuhTempo = semua.filter((x) => new Date(x.at) <= batas)
    // Kalau hari ini sudah bersih, tampilkan yang terdekat supaya tetap terpantau.
    return jatuhTempo.length
      ? { list: jatuhTempo, judul: 'Pengingat saya' }
      : { list: semua.slice(0, 3), judul: 'Pengingat terdekat' }
  }, [data.reminders, user]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!list.length) return null
  const selesai = async (r) => {
    try { await save('reminders', { ...r, done_at: new Date().toISOString() }); notify('Pengingat selesai') }
    catch (e) { notify(e.message || 'Gagal menyimpan', 'err') }
  }
  return (
    <div className="border-b border-slate-100 bg-amber-50/60">
      <p className="flex items-center gap-1.5 px-4 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-amber-800">
        <AlarmClock className="h-3.5 w-3.5" aria-hidden="true" />{judul} ({list.length})
      </p>
      <ul>
        {list.map(({ r, at }) => {
          const telat = new Date(at) < new Date()
          return (
            <li key={r.id}>
              <label className="flex w-full cursor-pointer items-center gap-2.5 px-4 py-2 hover:bg-amber-100/60">
                <input type="checkbox" checked={false} onChange={() => selesai(r)}
                  aria-label={`Tandai selesai: ${r.title}`} className="h-4 w-4 shrink-0 rounded border-slate-300 text-brand" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{r.title}</span>
                  {r.note && <span className="block truncate text-[11px] text-ink-mute">{r.note}</span>}
                </span>
                <span className={cx('shrink-0 text-[11px] font-semibold tabular-nums', telat ? 'text-rose-600' : 'text-amber-800')}>
                  {telat ? 'Terlambat · ' : ''}{jam(at)}
                </span>
              </label>
            </li>
          )
        })}
      </ul>
      <a href="#/agenda" className="block px-4 pb-2 text-[11px] font-semibold text-brand hover:underline">Buka Agenda →</a>
    </div>
  )
}

// Hero (kutipan) dan Perlu Perhatian 3 kolom digantikan Sapaan + AngkaHariIni + Hambatan (DashboardRingkas.jsx).

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
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className="whitespace-nowrap text-sm font-bold">{invoiceLabel(t.project.invoice_no)}</span><TypeBadge type={t.type} /><span className="hidden sm:inline-flex"><PrintBadge project={t.project} /></span><span className="sm:hidden"><PrintBadge project={t.project} iconOnly /></span><DemoBadge project={t.project} /></div>
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
  const sub = (x, right) => ({ id: x.id, href: `#/projects/${x.project.id}`, inv: invoiceLabel(x.project.invoice_no), text: `${x.title} · ${x.project.customer?.name || ''}`, right, p: x.project, s: x })
  const prj = (p, right) => ({ id: p.id, href: `#/projects/${p.id}`, inv: invoiceLabel(p.invoice_no), text: p.customer?.name || '', right, p })
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
  const [openDoc, setOpenDoc] = useState(null)
  /** Dokumen satu tugas — tampilan sederhana di bawah barisnya. */
  const DaftarDok = ({ it }) => {
    const subs = it.s ? [it.s] : (it.p?.sub_projects || [])
    const baris = subs.flatMap((sb) => {
      const d = (sb.docs || []).filter((x) => x?.desc?.trim())
      return d.length ? d.map((x) => ({ nama: x.desc.trim(), hlm: x.pages, sub: sb.title }))
        : [{ nama: sb.title, hlm: sb.pages, sub: sb.title }]
    })
    if (!baris.length) return <p className="px-3 py-2 text-xs text-ink-mute">Belum ada dokumen.</p>
    return (
      <ul className="divide-y divide-slate-100 border-t border-slate-100 bg-slate-50/70">
        {baris.map((d, i) => (
          <li key={i} className="flex min-w-0 items-center gap-2 px-3 py-1.5 pl-8">
            <span className="min-w-0 flex-1 truncate text-xs text-ink" title={d.nama}>{d.nama}</span>
            {d.hlm ? <span className="shrink-0 text-[11px] tabular-nums text-ink-mute">{d.hlm} hlm</span> : null}
          </li>
        ))}
      </ul>
    )
  }
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
                const terbuka = openDoc === it.id
                // Satu tugas = satu baris, dua data bertumpuk: nomor invoice di
                // atas, pelanggan/layanan di bawah. Tidak pernah menyatu jadi
                // satu baris walau layar sempit.
                const body = (
                  <>
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className={cx('truncate text-sm font-bold tabular-nums', done && 'text-ink-mute line-through')}>{it.inv}</span>
                        {it.right?.prio && <PriorityBadge p={it.right.prio} />}
                        {it.p && <DemoBadge project={it.p} />}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-ink-mute">{it.text}</span>
                    </span>
                    {it.right?.txt && <span className={cx('shrink-0 text-right text-[11px] font-semibold tabular-nums md:min-w-[110px]', it.right.hot ? 'text-ink' : 'text-ink-soft')}>{it.right.txt}</span>}
                  </>
                )
                return (
                  <li key={it.id}>
                    {it.reminder ? (
                      <label className="flex w-full max-w-4xl cursor-pointer items-center gap-2 px-3 py-2 hover:bg-slate-50 sm:gap-3">
                        <input type="checkbox" checked={done} onChange={() => toggleDone(it.id)} className="h-4 w-4 rounded border-slate-300 text-brand" aria-label={`Tandai selesai: ${it.inv}`} />{body}
                      </label>
                    ) : (
                      <div className="flex w-full max-w-4xl items-center gap-1">
                        <button type="button" onClick={() => setOpenDoc(terbuka ? null : it.id)} aria-expanded={terbuka}
                          title="Lihat daftar dokumen" className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 sm:gap-3">
                          {body}
                          <ChevronDown className={cx('h-4 w-4 shrink-0 text-slate-300 transition', terbuka && 'rotate-180 text-brand')} />
                        </button>
                        <a href={it.href} title="Buka project" aria-label={`Buka project ${it.inv}`}
                          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-slate-300 hover:bg-slate-50 hover:text-brand md:h-8 md:w-8">
                          <ArrowRight className="h-4 w-4" />
                        </a>
                      </div>
                    )}
                    {terbuka && <DaftarDok it={it} />}
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
    try { await processStage(r.project, r.id, { sumber_dana: dana }, true); notify(`Pengajuan ${invoiceLabel(r.project.invoice_no)} disetujui · sumber dana ${dana}`); setAccFor(null); setSumber('') }
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
                  <span className="block min-w-0">
                    <span className="flex min-w-0 flex-wrap items-center gap-x-2"><b className="whitespace-nowrap text-[15px]">{invoiceLabel(r.project.invoice_no)}</b><DemoBadge project={r.project} /></span>
                    <span className="mt-0.5 flex min-w-0 items-center gap-2"><TimeAgo at={(r.data?.submitted_at || stageArrivedAt(r, r.project))} prefix="Diajukan" className="!mt-0" />
                      <button type="button" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id} className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-brand hover:underline">{open === r.id ? 'Tutup' : 'Rincian'}<ChevronDown className={cx('h-3 w-3 transition', open === r.id && 'rotate-180')} /></button></span>
                  </span>
                  <FinCell title={r.title} top={`${r.title} · ${r.data?.vendor_service || '—'}`}
                    bottom={`${r.project.about?.cs_name || nameOf(r.project.created_by) || '—'} · ${r.project.branch}`} />
                  <FinAmount value={totalPengajuan(r.data)} sub={r.data?.sumber_dana && mode !== 'acc' ? `Dana ${r.data.sumber_dana}` : null} />
                  <span className="min-w-0"><span className="block truncate text-xs font-semibold text-ink">{v?.name || 'Vendor'}</span><Rek acc={v?.accounts?.[0]} empty="Belum ada rekening vendor" emptyHref="#/settings/vendor" /></span>
                  <span><PengajuanStatus stage={r.stage} revision={!!r.data?.revision_note} /></span>
                  <FinActions>
                    {mode === 'acc'
                      ? (accFor === r.id ? <Button size="sm" variant="outline" onClick={() => setAccFor(null)}>Batal</Button>
                        : <QuickAcc branch={r.project.branch} busy={busy === r.id} onAcc={(d) => acc(r, d)} onPick={(d) => { setAccFor(r.id); setSumber(r.data?.sumber_dana || d) }} />)
                      : <Button size="sm" variant="outline" onClick={() => go(`projects/${r.project.id}`)}>Proses Bayar</Button>}
                    <Button size="sm" variant="outline" className="!h-11 !w-11 !text-rose-700 !ring-rose-300 hover:!bg-rose-50 sm:!h-8 sm:!w-10" title="Tolak / Perbaiki — kembalikan ke pengaju" aria-label="Tolak / Perbaiki" onClick={() => setRejectFor(rejectFor === r.id ? null : r.id)}><Undo2 className="h-4 w-4" /></Button>
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
    try { await processStage(r.project, r.id, { rekening, paid_date: f.date, bukti_transfer: f.file }, true); notify(`${invoiceLabel(r.project.invoice_no)}: Sudah Dibayar`) }
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
                <span className="block min-w-0">
                  <CopyText text={invoiceLabel(r.project.invoice_no)} label="No. Invoice" strong />
                  <span className="mt-0.5 flex min-w-0 items-center gap-2"><TimeAgo at={r.data?.approved_at || stageArrivedAt(r, r.project)} prefix="ACC" className="!mt-0" /><a href={`#/projects/${r.project.id}`} className="text-[11px] font-semibold text-brand hover:underline">Buka</a></span>
                </span>
                <FinCell title={r.title} top={`${r.title} · ${r.data?.vendor_service || '—'}`}
                  bottom={<>{r.project.customer?.name || '—'} · {r.project.about?.cs_name || '—'} · {r.project.branch}</>} />
                <FinAmount value={totalPengajuan(r.data)} sub={r.data?.sumber_dana ? `Dana ${r.data.sumber_dana}` : null} />
                <Rek acc={acc} empty="Belum ada rekening — isi di Setting → Vendor" emptyHref="#/settings/vendor" />
                <span><PengajuanStatus stage={r.stage} revision={!!r.data?.revision_note} /></span>
                <FinActions>
                  <Input type="date" value={f.date} onChange={(e) => set(r.id, { date: e.target.value })} className="!h-8 !w-[116px] shrink-0 !px-1.5 text-xs" aria-label="Tanggal bayar" />
                  {f.file ? <span className="inline-flex max-w-[110px] items-center gap-1 truncate text-xs font-semibold text-emerald-700"><FileCheck2 className="h-4 w-4 shrink-0" />{f.file.name}</span> : (
                    <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg bg-white px-2.5 text-xs font-semibold text-ink-soft ring-1 ring-slate-300 hover:text-brand hover:ring-brand">
                      {f.uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => upload(r, e.target.files?.[0])} aria-label={`Upload bukti ${invoiceLabel(r.project.invoice_no)}`} />
                    </label>
                  )}
                  <Button size="sm" className="!h-11 !w-11 sm:!h-8 sm:!w-10" loading={f.busy} disabled={!f.file || !acc || f.uploading} onClick={() => pay(r)} title="Tandai sudah dibayar" aria-label="Tandai sudah dibayar"><Banknote className="h-4 w-4" /></Button>
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
                <span className="block min-w-0">
                  <a href={`#/projects/${r.project.id}`} className="block truncate text-[15px] font-bold text-ink hover:text-brand">{invoiceLabel(r.project.invoice_no)}</a>
                  <TimeAgo at={r.data?.paid_at || stageArrivedAt(r, r.project)} prefix="Dibayar" className="!mt-0.5" />
                </span>
                <FinCell top={`${vendorOf(r)?.name || '—'} · ${r.data?.vendor_service || '—'}`} bottom={r.project.customer?.name || ''} />
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
  // Judul kolom tabel order vendor bisa diklik untuk mengurutkan.
  const kolomVendorOrder = useMemo(() => [
    { key: 'invoice', label: 'Invoice & Pelanggan', sort: (r) => `${r.project.invoice_no || ''} ${r.project.customer?.name || ''}`.toLowerCase() },
    { key: 'pemesan', label: 'Pemesan', sort: (r) => `${r.project.branch || ''} ${r.project.about?.cs_name || ''}`.toLowerCase() },
    { key: 'dokumen', label: 'Dokumen', sort: (r) => String(r.title || '').toLowerCase() },
    { key: 'deadline', label: 'Deadline', sort: (r) => new Date(r.project.about?.deadline || 0).getTime() },
    { key: 'vendor', label: tab === 'ajukan' ? 'Vendor · Layanan · Ongkir · Tagihan' : 'Vendor & Status', sort: (r) => String(r.data?.vendor || '') },
  ], [tab])

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
  const { rows: urut, sortKey, sortDir, klikJudul } = useTabel(list, kolomVendorOrder)
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
      notify(isBilled(v) ? `${invoiceLabel(r.project.invoice_no)}: order dicatat — dibayar lewat tagihan ${PAYMENT_TERMS[termOf(v)].short.toLowerCase()}` : `${invoiceLabel(r.project.invoice_no)}: diajukan ke Direktur`)
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
          <table className="card-table w-full min-w-[980px] text-sm">
            <thead>
              <tr>
                {kolomVendorOrder.map((c) => <Th key={c.key} kolom={c} sortKey={sortKey} sortDir={sortDir} onKlik={klikJudul} className={c.key === 'invoice' ? 'px-4' : undefined} />)}
                <th className="border-b border-slate-200 bg-slate-50 px-4" /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {urut.map((r) => {
                const f = get(r.id); const v = vendors.find((x) => x.id === (f.vendor || r.data?.vendor)); const dl = daysLeft(r.project.about?.deadline)
                const docs = r.docs?.length ? r.docs : [{ desc: r.title, pages: r.pages }]
                return (
                  <tr key={r.id} className="align-top hover:bg-slate-50/60">
                    <td data-label="Invoice" className="px-4 py-2.5">
                      <CopyText text={invoiceLabel(r.project.invoice_no)} label="No. Invoice" strong />
                      <div className="max-w-[190px] text-xs text-ink-soft"><CopyText text={r.project.customer?.name} label="Nama Pelanggan" /></div>
                      <a href={`#/projects/${r.project.id}`} className="text-[11px] font-semibold text-brand hover:underline">buka</a>
                    </td>
                    <td data-label="Pemesan" className="px-2 py-2.5 text-xs"><p className="font-semibold">{r.project.branch}</p><p className="text-ink-mute">{r.project.about?.cs_name}</p></td>
                    <td data-label="Dokumen" className="px-2 py-2.5 text-xs"><ul className="max-w-[170px]">{docs.map((x, i) => <li key={i} className="truncate"><b>{x.desc || r.title}</b> · {x.pages || 1} hal</li>)}</ul><p className="font-semibold text-rose-700">{r.lang_from} → {r.lang_to}</p></td>
                    <td data-label="Deadline" className="px-2 py-2.5"><p className={cx('whitespace-nowrap text-xs font-semibold', dl !== null && dl <= 1 && 'text-rose-600')}>{tgl(r.project.about?.deadline)}</p><PriorityBadge p={r.project.about?.priority} className="mt-0.5 whitespace-nowrap" /></td>
                    {tab === 'ajukan' ? (
                      <td data-label="Vendor & Status" className="px-2 py-2.5">
                        <div className="grid w-[330px] grid-cols-2 gap-1.5">
                          <select className={sel} value={f.vendor} onChange={(e) => pickVendor(r, e.target.value)} aria-label={`Vendor ${invoiceLabel(r.project.invoice_no)}`}>
                            <option value="">— Vendor —</option>{vendors.map((x) => <option key={x.id} value={x.id}>{x.name}{(x.languages || []).length ? ` · ${x.languages.join(', ')}` : ''} · {PAYMENT_TERMS[termOf(x)].short}</option>)}
                          </select>
                          <select className={sel} value={f.svc} onChange={(e) => set(r.id, { svc: e.target.value })} disabled={!v} aria-label={`Layanan ${invoiceLabel(r.project.invoice_no)}`}>
                            <option value="">— Layanan —</option>{(v?.services || []).map((x, i) => <option key={i} value={i}>{x.name} — {rupiah(x.price)}</option>)}
                          </select>
                          <Input type="number" inputMode="numeric" placeholder="Ongkir (Rp)" value={f.ongkir} onChange={(e) => set(r.id, { ongkir: e.target.value })} className="text-xs" aria-label={`Ongkir ${invoiceLabel(r.project.invoice_no)}`} />
                          {f.file ? <span className="flex items-center gap-1 truncate text-xs font-semibold text-emerald-700"><FileCheck2 className="h-4 w-4 shrink-0" />{f.file.name}</span> : (
                            <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-white px-2 py-1.5 text-xs font-semibold text-ink-soft ring-1 ring-slate-300 hover:text-brand hover:ring-brand">
                              <Upload className="h-3.5 w-3.5" />Tagihan Vendor
                              <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => upload(r, e.target.files?.[0])} aria-label={`Upload tagihan ${invoiceLabel(r.project.invoice_no)}`} />
                            </label>
                          )}
                        </div>
                        {v && f.svc !== '' && <p className="mt-1 text-[11px] text-ink-mute">Total: <b className="text-ink">{rupiah((Number(v.services?.[Number(f.svc)]?.price) || 0) + (Number(f.ongkir) || 0))}</b>{isBilled(v) && <span className="ml-1 rounded bg-violet-50 px-1.5 font-semibold text-violet-700">tidak langsung dibayar · masuk tagihan {PAYMENT_TERMS[termOf(v)].short.toLowerCase()}</span>}</p>}
                      </td>
                    ) : (
                      <td data-label="Rincian" className="px-2 py-2.5 text-xs">
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
const isoDay = (dt) => new Date(dt.getTime() - dt.getTimezoneOffset() * 6e4).toISOString().slice(0, 10)
/** Label rentang deadline: Hari ini / Besok / tanggal / tanggal – tanggal. */
const rangeLabel = (r) => {
  if (!r?.from && !r?.to) return ''
  const today = isoDay(new Date()); const tmr = isoDay(new Date(Date.now() + 864e5))
  if (r.from === r.to) return r.from === today ? 'Hari ini' : r.from === tmr ? 'Besok' : tgl(r.from)
  return `${r.from ? tgl(r.from) : '…'} – ${r.to ? tgl(r.to) : '…'}`
}
/** Jumlah halaman satu sub-project — dipakai sama untuk "aktif" maupun "selesai". */
const halamanSub = (sb, flow) => {
  const k = kindPages(sb)
  return flow === 'tr_nt' ? (Number(sb.pages) || 1) : ((k.reguler || 0) + (k.non_reguler || 0)) || (Number(sb.pages) || 1)
}

export function TranslatorLoad({ range: rangeProp, setRange: setRangeProp, ringkas }) {
  const { data } = useApp()
  const [open, toggle] = useFold('load')
  const [rangeLocal, setRangeLocal] = useState({ from: '', to: '' })
  const range = rangeProp ?? rangeLocal; const setRange = setRangeProp ?? setRangeLocal
  const ranged = !!(range.from || range.to)
  const preset = (days) => { const a = new Date(); const b = new Date(Date.now() + days * 864e5); setRange({ from: isoDay(a), to: isoDay(b) }) }
  // Halaman yang SUDAH dikerjakan — perhitungannya sama dengan statistik
  // "Jumlah Terjemahan Saya": halaman dihitung saat tahap penerjemahan lewat,
  // memakai tanggal selesai terjemahan, bukan deadline.
  const bulanIni = isoDay(new Date()).slice(0, 7)
  const halSelesai = useMemo(() => {
    const per = new Map()
    for (const p of data.projects) {
      for (const sb of p.sub_projects || []) {
        const flow = flowOf(sb, p)
        if (!['tr_int', 'tr_nt'].includes(flow)) continue
        const uid = sb.data?.translator
        if (!uid) continue
        const lewat = sb.stage === DONE || stageIndex(flow, sb.stage) > stageIndex(flow, 'penerjemahan')
        if (!lewat) continue
        const at = sb.data?.translated_at || (sb.history || []).find((h) => /^Penerjemahan/.test(h.action || ''))?.at
        if (!at) continue
        const hari = String(isoDay(new Date(at)))
        const masuk = (range.from || range.to)
          ? (!range.from || hari >= range.from) && (!range.to || hari <= range.to)
          : hari.slice(0, 7) === bulanIni
        if (!masuk) continue
        per.set(uid, (per.get(uid) || 0) + halamanSub(sb, flow))
      }
    }
    return per
  }, [data.projects, range.from, range.to, bulanIni])

  const rows = useMemo(() => {
    const inRange = (dl) => { if (!dl) return false; const day = String(dl).slice(0, 10); return (!range.from || day >= range.from) && (!range.to || day <= range.to) }
    const subs = data.projects.flatMap((p) => (p.sub_projects || []).map((x) => ({ ...x, project: p, flow: flowOf(x, p) })))
    const trSubs = subs.filter((x) => ['tr_int', 'tr_nt'].includes(x.flow) && x.data?.translator && (ranged ? inRange(x.project.about?.deadline) : x.stage === 'penerjemahan'))
    const trs = data.users.filter((u) => u.role === 'penerjemah' && u.active !== false).map((u) => {
      const jobs = trSubs.filter((x) => x.data.translator === u.id)
      const act = jobs.filter((x) => x.stage === 'penerjemahan'); const done = jobs.filter((x) => x.stage !== 'penerjemahan')
      const next = act.map((x) => x.project.about?.deadline).filter(Boolean).sort()[0]
      // halAktif = halaman yang SEDANG dipegang (langsung berubah begitu penerjemah dipilih)
      const halAktif = act.reduce((a, x) => a + halamanSub(x, x.flow), 0)
      return { u, n: act.length, done: done.length, halAktif, pages: jobs.reduce((a, x) => a + halamanSub(x, x.flow), 0), next }
    }).sort((a, b) => a.n - b.n || a.halAktif - b.halAktif)
    const vendorJobs = subs.filter((x) => x.flow === 'tr_ext' && x.stage !== DONE && x.data?.vendor && (!ranged || inRange(x.project.about?.deadline))).length
    return { trs, vendorJobs }
  }, [data.projects, data.users, range, ranged])
  // Batas dihitung dari kapasitas harian tiap orang (halaman/hari, bawaan 10),
  // bukan satu angka untuk semua — Supervisor bisa menaikkannya lewat pengajuan.
  const kapRows = data.kapasitas
  const max = Math.max(KAP_DEFAULT, ...rows.trs.map((r) => Math.max(r.halAktif, kapasitasHarian(r.u, kapRows))))
  const tone = (hal, kap) => (hal === 0 ? ['bg-emerald-500', 'Kosong', 'text-emerald-700']
    : hal < kap * 0.7 ? ['bg-brand', 'Tersedia', 'text-brand']
    : hal < kap ? ['bg-amber-500', 'Hampir penuh', 'text-amber-700'] : ['bg-rose-500', 'Penuh', 'text-rose-700'])
  const total = rows.trs.reduce((a, r) => a + r.n + r.done, 0)
  const totalHal = rows.trs.reduce((a, r) => a + (halSelesai.get(r.u.id) || 0), 0)
  const totalAktif = rows.trs.reduce((a, r) => a + r.halAktif, 0)
  const chip = (on) => cx('rounded-lg px-2.5 py-1 text-xs font-semibold ring-1', on ? 'bg-indigo-600 text-white ring-indigo-600' : 'bg-white text-ink-soft ring-slate-200 hover:ring-indigo-400')
  const today = isoDay(new Date())
  return (
    <Card className="overflow-hidden">
      <div className="card-head flex flex-wrap items-center gap-2 bg-indigo-50/60 px-4 py-3">
        <Users className="h-4 w-4 text-indigo-600" />
        <h2 className="font-bold">Kapasitas Penerjemah</h2>
        <span className="text-xs text-ink-mute">{ranged
          ? `${rangeLabel(range)} · ${totalAktif} hal berjalan · ${totalHal} hal selesai`
          : `bulan ini · ${totalAktif} hal berjalan · ${totalHal} hal selesai · kapasitas harian masing-masing`}</span>
        <FoldBtn open={open} onClick={toggle} label="Kapasitas Penerjemah" className="ml-auto" />
      </div>
      {open && (
        <>
          {!ringkas && <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 px-4 py-2">
            <button className={chip(!ranged)} onClick={() => setRange({ from: '', to: '' })}>Saat ini</button>
            <button className={chip(ranged && range.from === today && range.to === today)} onClick={() => preset(0)}>Hari ini</button>
            <button className={chip(ranged && range.from === today && range.to === isoDay(new Date(Date.now() + 864e5)))} onClick={() => preset(1)}>s/d Besok</button>
            <button className={chip(ranged && range.from === today && range.to === isoDay(new Date(Date.now() + 6 * 864e5)))} onClick={() => preset(6)}>7 hari</button>
            <button className={chip(ranged && range.from === today && range.to === isoDay(new Date(Date.now() + 29 * 864e5)))} onClick={() => preset(29)}>30 hari</button>
            <span className="ml-auto flex items-center gap-1.5 text-xs text-ink-mute">Deadline
              <Input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className="w-36 !py-1 text-xs" aria-label="Dari tanggal" />
              –<Input type="date" value={range.to} min={range.from || undefined} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className="w-36 !py-1 text-xs" aria-label="Sampai tanggal" />
            </span>
          </div>}
          <div className="space-y-2.5 px-4 py-4">
            {rows.trs.map(({ u, n, done, halAktif, next }) => {
              const kap = kapasitasHarian(u, kapRows)
              const [bar, label, txt] = tone(halAktif, kap)
              return (
                <div key={u.id} className={cx('grid items-center gap-3', ringkas ? 'grid-cols-[110px_1fr] sm:grid-cols-[130px_1fr_auto]' : 'grid-cols-[120px_1fr_auto] sm:grid-cols-[170px_1fr_320px]')}>
                  <p className="truncate text-sm font-semibold">{u.name} <span className="text-[11px] font-normal text-ink-mute">· {placeOf(u)}</span></p>
                  <div className="relative flex h-3 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${u.name}: ${halAktif} dari ${kap} halaman kapasitas harian, ${n} dokumen berjalan`}>
                    <div className={cx('h-3', bar)} style={{ width: `${halAktif ? Math.max(6, Math.min(100, (halAktif / max) * 100)) : 0}%` }} />
                    <span className="absolute inset-y-0 border-l-2 border-dashed border-slate-400/70" style={{ left: `${Math.min(100, (kap / max) * 100)}%` }} title={`Kapasitas harian ${kap} halaman`} />
                  </div>
                  <p className="text-right text-xs tabular-nums sm:text-left">
                    <b data-hal="berjalan">{halAktif}</b><span className="text-ink-mute">/{kap}</span> hal <span className="text-ink-mute">berjalan</span>
                    <span className="text-ink-mute"> · <span data-hal="selesai">{halSelesai.get(u.id) || 0}</span> selesai</span>
                    <span className={cx('ml-1 font-semibold', txt)}>{label}</span>
                    {next && <span className="hidden text-ink-mute sm:inline"> · DL {tgl(next)}</span>}</p>
                </div>
              )
            })}
            <p className="flex flex-wrap items-center gap-x-3 pt-1 text-[11px] text-ink-mute">
              <span className="inline-flex items-center gap-1"><span className="h-2 w-3 rounded bg-brand" />sedang diterjemahkan</span>
              {ranged && <span className="inline-flex items-center gap-1"><span className="h-2 w-3 rounded bg-slate-300" />sudah selesai diterjemahkan</span>}
              <span>garis putus-putus = kapasitas harian orang itu (bawaan {KAP_DEFAULT} hal/hari)</span>
              <span>· berjalan = halaman yang sedang dipegang, selesai = halaman yang tahap penerjemahannya sudah lewat</span>
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
          <span className="block text-base font-bold text-ink">Buka Project — {tasks.length} tugas menunggu</span>
          <span className="block text-xs text-ink-mute">Semua pekerjaan dikerjakan di sana: Mulai → Upload hasil → Kirim</span>
        </span>
        <ArrowRight className="h-5 w-5 shrink-0" />
      </a>

      {/* Pengingat pribadi juga tampil untuk pelaksana freelance,
          yang dashboard-nya tidak punya kartu To-Do List. */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-slate-200 empty:hidden">
        <PengingatTodo user={user} />
      </div>

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
/** Kolom tabel Perlu Penerjemah. Deadline dirender khusus (sortir + filter rentang). */
const KOLOM_ASSIGN = [
  { key: 'invoice', label: 'No. Invoice & Pelanggan', sort: (r) => `${r.project.invoice_no || ''} ${r.project.customer?.name || ''}`.toLowerCase() },
  { key: 'dokumen', label: 'Dokumen', sort: (r) => String(r.title || '').toLowerCase() },
  { key: 'bahasa', label: 'Bahasa', sort: (r) => `${r.lang_from || ''} ${r.lang_to || ''}`.toLowerCase() },
  { key: 'deadline', label: 'Deadline', sort: (r) => new Date(r.project.about?.deadline || 0).getTime() },
  { key: 'orang', label: 'Penerjemah / Vendor', sort: (r) => String(r.data?.translator || r.data?.vendor || '') },
]

export function AssignTable({ rows: allRows, range = { from: '', to: '' }, setRange = () => {} }) {
  const { data, assignTranslator, notify } = useApp()
  const [open, toggle] = useFold('assign')
  // filter deadline dari judul kolom (rentang / tanggal tertentu) — Kapasitas Penerjemah di atas ikut tanggal yang sama
  const ranged = !!(range.from || range.to)
  const rows = useMemo(() => (ranged ? allRows.filter((r) => { const d = r.project.about?.deadline; if (!d) return false; const day = String(d).slice(0, 10); return (!range.from || day >= range.from) && (!range.to || day <= range.to) }) : allRows), [allRows, range, ranged])
  const { rows: tUrut, sortKey: tSortKey, sortDir: tSortDir, klikJudul: tKlik } = useTabel(rows, KOLOM_ASSIGN)
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
  // Saran penerjemah (F5): pernah mengerjakan pasangan bahasa yang sama diutamakan,
  // lalu sisa kapasitas harian terbesar. Supervisor tetap yang memutuskan.
  const halAktif = useMemo(() => {
    const m = {}
    data.projects.forEach((p) => (p.sub_projects || []).forEach((x) => { if (x.stage === 'penerjemahan' && x.data?.translator) m[x.data.translator] = (m[x.data.translator] || 0) + halamanSub(x, flowOf(x, p)) }))
    return m
  }, [data.projects])
  const pernah = useMemo(() => {
    const m = {}
    data.projects.forEach((p) => (p.sub_projects || []).forEach((x) => { if (x.data?.translator && x.lang_from && x.lang_to) (m[`${x.lang_from}>${x.lang_to}`] ||= new Set()).add(x.data.translator) }))
    return m
  }, [data.projects])
  const sisaOf = (u) => kapasitasHarian(u, data.kapasitas) - (halAktif[u.id] || 0)
  const saranOf = (r) => {
    if (!translators.length) return null
    const key = `${r.lang_from}>${r.lang_to}`; const pasangan = pernah[key] || new Set()
    const urut = [...translators].sort((a, b) => (pasangan.has(b.id) - pasangan.has(a.id)) || (sisaOf(b) - sisaOf(a)) || a.name.localeCompare(b.name))
    const u = urut[0]
    return { u, sisa: sisaOf(u), alasan: pasangan.has(u.id) ? `pernah ${r.lang_from} → ${r.lang_to}` : 'sisa kapasitas terbesar' }
  }
  const pickOf = (r) => form[r.id]?.pick ?? (coordOf(r) ? `coord:${coordOf(r).id}` : saranOf(r) ? `internal:${saranOf(r).u.id}` : '')
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
      notify(kind === 'coord' ? `${invoiceLabel(r.project.invoice_no)}: diserahkan ke ${data.users.find((u) => u.id === id)?.name}`
        : kind === 'internal' ? `${invoiceLabel(r.project.invoice_no)}: masuk To-Do ${translators.find((u) => u.id === id)?.name}`
        : service ? `${invoiceLabel(r.project.invoice_no)}: diajukan ke Direktur` : `${invoiceLabel(r.project.invoice_no)}: vendor ditetapkan`)
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
          <table className="card-table w-full min-w-[880px] text-sm">
            <thead>
              <tr>
                {KOLOM_ASSIGN.slice(0, 3).map((c) => <Th key={c.key} kolom={c} sortKey={tSortKey} sortDir={tSortDir} onKlik={tKlik} className={c.key === 'invoice' ? 'px-4' : undefined} />)}
                {/* Deadline: judulnya punya dua fungsi — klik teks untuk mengurutkan, klik panah untuk menyaring rentang */}
                <th scope="col" className="h-9 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-2 text-left text-[11px] font-bold uppercase tracking-wide text-ink-mute">
                  <span className="flex items-center gap-1">
                    <button type="button" onClick={() => tKlik('deadline')} title="Urutkan menurut Deadline" aria-label="Urutkan menurut Deadline"
                      className="inline-flex items-center gap-1 hover:text-ink">
                      Deadline
                      {tSortKey === 'deadline' && (tSortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                    </button>
                    <button type="button" onClick={() => setDlOpen(true)} className={cx('inline-flex items-center gap-1 rounded px-0.5 hover:text-brand', ranged && 'text-brand')}
                      title="Atur rentang / tanggal deadline" aria-label="Filter deadline perlu penerjemah">
                      <ChevronDown className="h-3 w-3" />{ranged && <span className="rounded-full bg-brand px-1.5 py-px text-[10px] normal-case tracking-normal text-white">{rangeLabel(range)}</span>}
                    </button>
                  </span>
                </th>
                {KOLOM_ASSIGN.slice(4).map((c) => <Th key={c.key} kolom={c} sortKey={tSortKey} sortDir={tSortDir} onKlik={tKlik} />)}
                <th className="border-b border-slate-200 bg-slate-50 px-4" /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tUrut.map((r) => {
                const f = { ...get(r.id), pick: pickOf(r) }; const [kind, pid] = f.pick.split(':'); const co = coordOf(r)
                const v = kind === 'vendor' ? vendors.find((x) => x.id === pid) : null
                const svc = v && f.svc !== '' ? v.services?.[Number(f.svc)] : null
                const dl = daysLeft(r.project.about?.deadline)
                const docs = r.docs?.length ? r.docs : [{ desc: r.title, pages: r.pages }]
                return (
                  <tr key={r.id} className="align-middle hover:bg-slate-50/60">
                    <td data-label="Invoice" className="px-4 py-2.5">
                      <CopyText text={invoiceLabel(r.project.invoice_no)} label="No. Invoice" strong />
                      <div className="max-w-[200px] text-xs text-ink-soft"><CopyText text={r.project.customer?.name} label="Nama Pelanggan" /></div>
                      <p className="text-[11px] text-ink-mute"><span className="font-semibold text-ink-soft">{r.project.branch}</span> · <a href={`#/projects/${r.project.id}`} className="font-semibold text-brand hover:underline">buka</a></p>
                    </td>
                    <td data-label="Dokumen" className="px-2 py-2.5">
                      <ul className="max-w-[170px] text-xs">{docs.map((x, i) => <li key={i} className="truncate"><b>{x.desc || r.title}</b> <span className="text-ink-mute">· {x.pages || 1} hal</span></li>)}</ul>
                      {r.flow === 'tr_ext' && <span className="mt-0.5 inline-block rounded bg-violet-50 px-1.5 text-[10px] font-semibold text-violet-700">Pengajuan vendor — vendor kosong</span>}
                    </td>
                    <td data-label="Bahasa" className="whitespace-nowrap px-2 py-2.5 text-xs font-semibold">{r.lang_from} → {r.lang_to}</td>
                    <td data-label="Deadline" className="px-2 py-2.5">
                      <p className={cx('whitespace-nowrap text-xs font-semibold', dl !== null && dl <= 1 ? 'text-rose-600' : '')}>{tgl(r.project.about?.deadline)}</p>
                      <p className="text-[11px] text-ink-mute">{dl === null ? '' : dl < 0 ? `Terlambat ${-dl} hr` : dl === 0 ? 'Hari ini' : `${dl} hari lagi`}</p>
                      <PriorityBadge p={r.project.about?.priority} className="mt-0.5 whitespace-nowrap" />
                    </td>
                    <td data-label="Penerjemah / Vendor" className="px-2 py-2.5">
                      <select value={f.pick} onChange={(e) => choose(r, e.target.value)} aria-label={`Penerjemah ${invoiceLabel(r.project.invoice_no)} ${r.title}`}
                        className="w-56 rounded-lg border-0 bg-white px-2.5 py-1.5 text-xs ring-1 ring-slate-300 focus:ring-2 focus:ring-brand">
                        <option value="">— Pilih —</option>
                        {co && <optgroup label={`Koordinator Bahasa ${co.coordinator_lang}`}><option value={`coord:${co.id}`}>Serahkan ke {co.name}</option></optgroup>}
                        <optgroup label="Penerjemah (internal)">{translators.map((u) => <option key={u.id} value={`internal:${u.id}`}>{u.name} · {placeOf(u)} · {load[u.id] || 0} tugas · sisa {sisaOf(u)} hlm</option>)}</optgroup>
                        <optgroup label="Vendor (eksternal)">{vendors.map((p) => <option key={p.id} value={`vendor:${p.id}`}>{p.name} · {PAYMENT_TERMS[termOf(p)].short}</option>)}</optgroup>
                      </select>
                      {!co && saranOf(r) && kind !== 'vendor' && <p className="mt-0.5 text-[11px] text-emerald-700" data-saran>Saran: <b>{saranOf(r).u.name}</b> · sisa {saranOf(r).sisa} hlm · {saranOf(r).alasan}</p>}
                      {v && (
                        <select value={f.svc} onChange={(e) => set(r.id, { svc: e.target.value })} aria-label={`Layanan vendor ${invoiceLabel(r.project.invoice_no)}`}
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
      <FinHead cols={['Pengajuan', 'Deskripsi', 'Nominal', 'Vendor / Layanan', 'Status', '']} />
      {!rows.length ? <p className="px-4 py-6 text-center text-sm text-ink-mute">Belum ada pengajuan vendor dari Anda.</p> : (
      <ul className="divide-y divide-slate-100">
        {rows.slice(0, 8).map((r) => (
          <FinRow key={r.id} onClick={() => go(`projects/${r.project.id}`)}>
            <span className="block min-w-0">
              <b className="block truncate text-[15px]">{invoiceLabel(r.project.invoice_no)}</b>
              <TimeAgo at={(r.data?.submitted_at || stageArrivedAt(r, r.project))} prefix="Diajukan" className="!mt-0.5" />
            </span>
            <FinCell title={r.title} top={r.title} bottom={r.project.customer?.name || ''} />
            <FinAmount value={totalPengajuan(r.data)} sub={r.data?.sumber_dana ? `Dana ${r.data.sumber_dana}` : null} />
            <span className="min-w-0 text-xs"><span className="block truncate font-semibold text-ink">{vendorOf(r)?.name || '—'}</span><span className="block truncate text-ink-mute">{r.data?.vendor_service || '—'}</span></span>
            <span><PengajuanStatus stage={r.stage} revision={!!r.data?.revision_note} /></span>
            <span />
            <span className="lg:col-span-6"><PengajuanTracker sub={r} compact /><RevisionNote sub={r} className="mt-1.5" /></span>
          </FinRow>
        ))}
      </ul>)}
    </Wrap>
  )
}

/** Kolom tabel pekerjaan Apostille / Legalisasi. */
const KOLOM_APOS = [
  { key: 'project', label: 'Project & Pelanggan', sort: (r) => `${r.project.invoice_no || ''} ${r.project.customer?.name || ''}`.toLowerCase() },
  { key: 'layanan', label: 'Layanan', sort: (r) => String(r.type || '').toLowerCase() },
  { key: 'negara', label: 'Negara / Lembaga', sort: (r) => String(r.country || r.institution || '').toLowerCase() },
  { key: 'deadline', label: 'Deadline', sort: (r) => new Date(r.project.about?.deadline || 0).getTime() },
  { key: 'status', label: 'Status', sort: (r) => String(r.stage || '').toLowerCase() },
]

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
  const { rows: aUrut, sortKey: aSortKey, sortDir: aSortDir, klikJudul: aKlik } = useTabel(list, KOLOM_APOS)
  const start = async (r) => {
    setBusy(r.id)
    try { await processStage(r.project, r.id, {}, true); notify(`${invoiceLabel(r.project.invoice_no)}: Sedang Diproses`) } catch (e) { notify(e.message, 'err') } finally { setBusy(null) }
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
          <table className="card-table w-full min-w-[760px] text-sm">
            <thead>
              <tr>
                {KOLOM_APOS.map((c) => <Th key={c.key} kolom={c} sortKey={aSortKey} sortDir={aSortDir} onKlik={aKlik} className={c.key === 'project' ? 'px-4' : undefined} />)}
                <th className="border-b border-slate-200 bg-slate-50 px-4" /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {aUrut.map((r) => {
                const st = stafStatus(r.stage); const S = STATUS_STYLE[st]; const d = daysLeft(r.project.about?.deadline)
                return (
                  <tr key={r.id} className="hover:bg-slate-50/60">
                    <td data-label="Project" className="px-4 py-2.5"><a href={`#/projects/${r.project.id}`} className="font-bold hover:text-brand">{invoiceLabel(r.project.invoice_no)}</a><TimeAgo at={stageArrivedAt(r, r.project)} prefix="Masuk" /><p className="max-w-[200px] truncate text-xs text-ink-mute">{r.project.customer?.name} · {r.title}</p></td>
                    <td data-label="Layanan" className="px-2 py-2.5"><TB type={r.type} /></td>
                    <td data-label="Negara / Lembaga" className="px-2 py-2.5 text-ink-soft">{r.type === 'legalisasi' ? (nameOf(r.institution) || '—') : (r.country || '—')}</td>
                    <td data-label="Deadline" className="px-2 py-2.5"><div className="flex items-center gap-1.5"><span className={cx('text-xs', d !== null && d <= 1 && r.stage !== DONE ? 'font-semibold text-rose-600' : 'text-ink-soft')}>{tgl(r.project.about?.deadline)}</span><PriorityBadge p={r.project.about?.priority} iconOnly /></div></td>
                    <td data-label="Status" className="px-2 py-2.5"><span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1', S.cls)}><S.icon className="h-3 w-3" />{st}</span></td>
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
