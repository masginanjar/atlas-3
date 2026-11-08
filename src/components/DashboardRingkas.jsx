import { useMemo, useState } from 'react'
import { AlarmClock, AlertTriangle, Banknote, ChevronDown, FolderKanban, Inbox, ReceiptText, Users, Wallet } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { go } from '../lib/router.js'
import { ROLES, roleLabel, can, branchesOf, isFreelance, invoiceLabel, APOSTILLE_FUND, pettyAccountsOf } from '../config/access.js'
import { DONE, totalPengajuan, stageShort, flowOf, VENDOR_PAID_STAGES } from '../config/workflows.js'
import { summarize, band, hasPersonalTasks, canSeeTeam, dayKey } from '../lib/performance.js'
import { daysLeft, rupiah } from '../lib/format.js'
import { sapaan } from '../lib/cover.js'
import { PriorityBadge } from './Priority.jsx'
import { Card, cx } from './ui.jsx'
import { KapasitasAcc, bolehAccKapasitas } from './Kapasitas.jsx'

// ============================================================
//  DASBOR RINGKAS (K1 / K8 / K14 + fitur Kotak Hambatan)
//  Dasbor hanya menjawab: apa yang menunggu saya, mana yang bermasalah,
//  apa yang harus saya setujui. Tabel lengkap tetap di halaman asalnya
//  (Keuangan, Penugasan, My Apostille) — di sini cukup angka + tautan.
// ============================================================

const JAM_24 = 24 * 60 * 60 * 1000
const VENDOR_ORDER_STAGES = ['pengajuan', 'persetujuan', 'pembayaran', ...VENDOR_PAID_STAGES, 'order']
const PETTY_RINCI = ['superadmin', 'supervisor', 'direktur']

/** Teks tenggat singkat untuk baris. */
export const teksTenggat = (d) => (d === null ? '' : d < 0 ? `Terlambat ${-d} hari` : d === 0 ? 'Hari ini' : d === 1 ? 'Besok' : `${d} hari lagi`)

/** Sapaan satu baris: nama, role · cabang, tanggal. Kutipan hari ini tidak lagi di sini. */
export function Sapaan({ user }) {
  const tanggal = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <section aria-label="Sapaan hari ini" data-sapaan
      className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1 rounded-2xl bg-white px-4 py-3 shadow-card ring-1 ring-slate-200 sm:px-5">
      <h1 className="min-w-0 truncate text-xl font-extrabold leading-tight tracking-tight sm:text-2xl">
        <span className="font-semibold text-ink-soft">{sapaan()}, </span>{user.display_name || user.name}
      </h1>
      <p className="text-xs font-semibold text-ink-mute">{roleLabel(user)}{user.branch && !isFreelance(user) ? ` · ${user.branch}` : ''}</p>
      <p className="ml-auto text-xs font-semibold text-ink-mute">{tanggal}</p>
    </section>
  )
}

/**
 * Enam kartu angka seragam. Klik kartu = buka halaman yang sudah tersaring.
 * Petty cash cabang & apostille digabung dalam satu kartu (dua angka).
 */
export function AngkaHariIni({ user, s, unlinked, todoCount }) {
  const { pettyBalance, branchFilter } = useApp()
  const accounts = pettyAccountsOf(user).filter((k) => k === APOSTILLE_FUND || branchFilter === 'Semua' || k === branchFilter)
  const pettyCabang = accounts.filter((k) => k !== APOSTILLE_FUND).reduce((a, k) => a + (pettyBalance(k) || 0), 0)
  const pettyApos = accounts.includes(APOSTILLE_FUND) ? (pettyBalance(APOSTILLE_FUND) || 0) : 0
  const act = s.active.filter((p) => !p.demo_perf)
  const late = act.filter((p) => { const d = daysLeft(p.about?.deadline); return d !== null && d < 0 }).length
  const today = act.filter((p) => daysLeft(p.about?.deadline) === 0).length
  const vendor = s.subs.filter((x) => VENDOR_ORDER_STAGES.includes(x.stage) && !x.project.demo_perf).length
  const tiles = [
    { k: 'dl', label: 'Tenggat hari ini', value: today, sub: late ? `${late} sudah terlambat` : 'tidak ada yang terlambat', icon: AlarmClock, href: '#/projects', tone: today + late ? 'danger' : 'ok' },
    { k: 'late', label: 'Terlambat', value: late, sub: 'belum selesai', icon: AlertTriangle, href: '#/projects', tone: late ? 'danger' : 'ok' },
    ...(unlinked !== undefined ? [{ k: 'faktur', label: 'Faktur belum jadi project', value: unlinked ?? 0, sub: 'dari Zoho', icon: ReceiptText, href: '#/faktur' }] : []),
    { k: 'todo', label: 'Kerja saya', value: todoCount, sub: 'menunggu saya', icon: Inbox, href: '#/dashboard' },
    { k: 'active', label: 'Project aktif', value: act.length, sub: `${s.done} selesai`, icon: FolderKanban, href: '#/projects' },
    { k: 'vendor', label: 'Order vendor', value: vendor, sub: `${s.approvals.length} menunggu ACC`, icon: Banknote, href: '#/keuangan' },
    PETTY_RINCI.includes(user.role)
      ? { k: 'petty', label: 'Petty cash', value: rupiah(pettyCabang), sub: `apostille ${rupiah(pettyApos)}`, icon: Wallet, href: '#/keuangan/petty', uang: true }
      : { k: 'petty', label: 'Petty cash', value: rupiah(accounts.reduce((a, k) => a + (pettyBalance(k) || 0), 0)), sub: 'saldo tersedia', icon: Wallet, href: '#/keuangan/petty', uang: true },
  ]
  return (
    <section aria-label="Angka hari ini" data-angka className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-7 [&>a:last-child:nth-child(odd)]:col-span-2 sm:[&>a:last-child:nth-child(odd)]:col-span-1">
      {tiles.map(({ k, label, value, sub, icon: Icon, href, tone, uang }) => (
        <a key={k} href={href} data-angka-kartu={k}
          className="group relative flex min-h-[72px] min-w-0 flex-col justify-end overflow-hidden rounded-2xl bg-white p-3 shadow-card ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:ring-brand/40">
          <span className="absolute right-2.5 top-2.5 text-ink-mute/50 transition group-hover:text-brand"><Icon className="h-4 w-4" /></span>
          <p className={cx('truncate font-extrabold leading-none tabular-nums', uang ? 'text-base' : 'text-2xl',
            tone === 'danger' ? 'text-rose-600' : tone === 'ok' ? 'text-emerald-600' : 'text-ink')}>{value}</p>
          <p className="mt-1 truncate text-[11px] font-semibold text-ink-soft" title={label}>{label}</p>
          <p className="truncate text-[10px] text-ink-mute">{sub}</p>
        </a>
      ))}
    </section>
  )
}

/**
 * Kotak Hambatan: satu daftar, satu baris per masalah, satu tombol aksi.
 * Sumbernya: tenggat lewat / hari ini, prioritas tinggi, belum ada penerjemah
 * atau vendor, pengajuan menunggu ACC > 24 jam, menunggu transfer > 24 jam.
 * Baris yang tampil mengikuti role (hanya yang bisa ditindaklanjuti orang itu).
 */
export function hitungHambatan(s, user, now = Date.now()) {
  const rows = []
  const act = s.active.filter((p) => !p.demo_perf)
  const subs = s.subs.filter((x) => x.stage !== DONE && !x.project.demo_perf)
  const byDl = (a, b) => new Date(a.about?.deadline || 0) - new Date(b.about?.deadline || 0)
  const pr = (p) => ({ id: p.id, inv: invoiceLabel(p.invoice_no), nama: p.customer?.name || '', prio: p.about?.priority, dl: daysLeft(p.about?.deadline), p })

  // 1) terlambat & tenggat hari ini (semua role yang melihat project itu)
  act.filter((p) => { const d = daysLeft(p.about?.deadline); return d !== null && d <= 0 }).sort(byDl).forEach((p) => {
    const d = daysLeft(p.about?.deadline)
    rows.push({ ...pr(p), key: `dl-${p.id}`, jenis: 'tenggat', bobot: d < 0 ? 0 : 1,
      masalah: d < 0 ? `Lewat tenggat ${-d} hari · ${tahapSekarang(p)}` : `Tenggat hari ini${p.about?.deadline_time ? ` ${p.about.deadline_time}` : ''} · ${tahapSekarang(p)}`,
      aksi: 'Buka', href: `#/projects/${p.id}` })
  })
  // 2) prioritas tinggi yang tenggatnya besok (belum masuk butir 1)
  act.filter((p) => p.about?.priority && p.about.priority !== 'Normal' && daysLeft(p.about?.deadline) === 1).sort(byDl).forEach((p) => {
    rows.push({ ...pr(p), key: `prio-${p.id}`, jenis: 'prioritas', bobot: 2, masalah: `${p.about.priority} · tenggat besok · ${tahapSekarang(p)}`, aksi: 'Buka', href: `#/projects/${p.id}` })
  })
  // 3) belum ada penerjemah / vendor — hanya yang berwenang membagi
  if (['superadmin', 'supervisor'].includes(user.role)) {
    s.needTr.forEach((x) => rows.push({ ...pr(x.project), key: `tr-${x.id}`, jenis: 'tugas', bobot: 3, masalah: `Belum ada penerjemah · ${x.title}`, aksi: 'Tetapkan', href: '#/penugasan' }))
    subs.filter((x) => ['ap_ext', 'lg_ext'].includes(x.flow) && x.stage === 'pengajuan' && !x.data?.vendor)
      .forEach((x) => rows.push({ ...pr(x.project), key: `vd-${x.id}`, jenis: 'tugas', bobot: 3, masalah: `Belum ada vendor · ${x.title}`, aksi: 'Pilih vendor', href: `#/projects/${x.project.id}` }))
  }
  // 4) pengajuan menunggu ACC > 24 jam — pemberi ACC
  if (['superadmin', 'direktur'].includes(user.role)) {
    subs.filter((x) => x.stage === 'persetujuan' && (!x.data?.submitted_at || now - new Date(x.data.submitted_at) > JAM_24))
      .forEach((x) => rows.push({ ...pr(x.project), key: `acc-${x.id}`, jenis: 'acc', bobot: 4, masalah: `Menunggu ACC ${umur(x.data?.submitted_at, now)} · ${rupiah(totalPengajuan(x.data))}`, aksi: 'ACC', href: '#/keuangan' }))
  }
  // 5) menunggu transfer > 24 jam — akunting
  if (['superadmin', 'akunting'].includes(user.role)) {
    subs.filter((x) => x.stage === 'pembayaran' && (!x.data?.approved_at || now - new Date(x.data.approved_at) > JAM_24))
      .forEach((x) => rows.push({ ...pr(x.project), key: `tf-${x.id}`, jenis: 'transfer', bobot: 4, masalah: `Disetujui, belum ditransfer · ${rupiah(totalPengajuan(x.data))}`, aksi: 'Transfer', href: '#/keuangan' }))
  }
  rows.sort((a, b) => a.bobot - b.bobot || (a.dl ?? 99) - (b.dl ?? 99))
  return rows
}

const tahapSekarang = (p) => {
  const subs = (p.sub_projects || []).filter((x) => x.stage !== DONE)
  if (!subs.length) return 'selesai'
  const x = subs[0]
  return stageShort(flowOf(x, p), x.stage) || x.stage
}
const umur = (iso, now) => {
  if (!iso) return ''
  const h = Math.floor((now - new Date(iso)) / 36e5)
  return h >= 48 ? `${Math.floor(h / 24)} hari` : `${h} jam`
}

export function Hambatan({ s, user }) {
  const [semua, setSemua] = useState(false)
  const rows = useMemo(() => hitungHambatan(s, user), [s, user])
  const bolehKap = bolehAccKapasitas(user)
  const BATAS = 6
  const tampil = semua ? rows : rows.slice(0, BATAS)
  const nada = { tenggat: 'bg-rose-50 text-rose-700 ring-rose-200', prioritas: 'bg-amber-50 text-amber-800 ring-amber-200', tugas: 'bg-indigo-50 text-indigo-700 ring-indigo-200', acc: 'bg-violet-50 text-violet-700 ring-violet-200', transfer: 'bg-emerald-50 text-emerald-700 ring-emerald-200' }
  return (
    <Card className="flex min-h-0 flex-col overflow-hidden" data-hambatan={rows.length}>
      <div className="card-head flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-rose-50"><AlertTriangle className="h-4 w-4 text-rose-600" /></span>
        <h2 className="min-w-0 flex-1 truncate font-bold">Hambatan <span className="font-normal text-ink-mute">({rows.length})</span>
          <span className="ml-2 hidden text-[11px] font-medium text-ink-mute sm:inline">yang perlu ditindaklanjuti sekarang</span></h2>
      </div>
      {rows.length === 0 && !bolehKap ? (
        <p className="px-4 py-6 text-center text-sm text-ink-mute">Tidak ada hambatan. Semua tenggat dan persetujuan aman.</p>
      ) : (
        <ul className="divide-y divide-slate-100" aria-label="Daftar hambatan">
          {tampil.map((r) => (
            <li key={r.key} className="flex min-w-0 items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4" data-hambatan-baris={r.jenis}>
              <span className={cx('hidden h-2 w-2 shrink-0 rounded-full sm:block', r.jenis === 'tenggat' ? 'bg-rose-500' : r.jenis === 'prioritas' ? 'bg-amber-500' : r.jenis === 'tugas' ? 'bg-indigo-500' : 'bg-violet-500')} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-1.5">
                  <a href={`#/projects/${r.id}`} className="truncate text-sm font-bold tabular-nums hover:underline">{r.inv}</a>
                  {r.prio && r.prio !== 'Normal' && <PriorityBadge p={r.prio} />}
                  <span className="hidden truncate text-xs text-ink-mute sm:inline">{r.nama}</span>
                </span>
                <span className={cx('mt-0.5 block truncate text-xs', r.jenis === 'tenggat' ? 'font-semibold text-rose-700' : 'text-ink-soft')}>{r.masalah}</span>
              </span>
              <button type="button" onClick={() => go(r.href.replace(/^#\//, ''))} data-aksi="hambatan"
                className={cx('h-11 shrink-0 rounded-lg px-3 text-xs font-bold ring-1 transition hover:brightness-95 md:h-8', nada[r.jenis])}>{r.aksi}</button>
            </li>
          ))}
        </ul>
      )}
      {rows.length > BATAS && (
        <button type="button" onClick={() => setSemua((v) => !v)} className="flex items-center gap-1 px-4 py-2 text-left text-[11px] font-semibold text-brand hover:underline" data-aksi="hambatan-semua">
          {semua ? 'Tampilkan lebih sedikit' : `+${rows.length - BATAS} lainnya`}<ChevronDown className={cx('h-3.5 w-3.5 transition', semua && 'rotate-180')} />
        </button>
      )}
      {/* Ajuan tambah kapasitas = hambatan bagi penerjemahnya; disetujui di sini juga */}
      {bolehKap && <div className="border-t border-slate-100 p-3 [&>*]:shadow-none [&>*]:ring-0" data-hambatan-kapasitas><KapasitasAcc /></div>}
    </Card>
  )
}

/** Ringkasan tim per role — angka saja; rinciannya di Monitoring. */
export function RingkasanTim() {
  const { user, data, branchFilter } = useApp()
  const today = dayKey()
  const now = new Date()
  const people = useMemo(() => data.users.filter((u) => u.active !== false && hasPersonalTasks(u) && u.id !== user.id
    && (isFreelance(u) || (can.seeAllBranches(user) ? (branchFilter === 'Semua' || u.branch === branchFilter || branchesOf(u).includes(branchFilter)) : branchesOf(user).some((b) => branchesOf(u).includes(b))))), [data.users, user, branchFilter])
  const grup = useMemo(() => {
    const m = {}
    for (const u of people) {
      const r = summarize(u, data.projects, today, now)
      const g = (m[u.role] ||= { role: u.role, orang: 0, done: 0, total: 0, overdue: 0 })
      g.orang += 1; g.done += r.done.length; g.total += r.total; g.overdue += r.overdue.length
    }
    return Object.values(m).sort((a, b) => b.total - a.total)
  }, [people, data.projects, today]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!canSeeTeam(user) || !people.length) return null
  const done = grup.reduce((a, g) => a + g.done, 0); const total = grup.reduce((a, g) => a + g.total, 0)
  const pct = total ? Math.round((done / total) * 100) : null
  const b = band(pct)
  return (
    <Card className="overflow-hidden" data-ringkasan-tim>
      <div className="card-head flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-violet-50"><Users className="h-4 w-4 text-violet-600" /></span>
        <h2 className="font-bold">Tim hari ini</h2>
        <span className={cx('rounded-full px-2 py-0.5 text-[11px] font-bold ring-1', b.bg, b.ring, b.text)}>{pct === null ? 'Belum ada tenggat' : `${pct}% · ${done}/${total} selesai`}</span>
        {user.role === 'superadmin' && <a href="#/monitoring" className="ml-auto text-[11px] font-semibold text-brand hover:underline">Rinci di Monitoring →</a>}
      </div>
      <ul className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-3 lg:grid-cols-4">
        {grup.map((g) => {
          const gp = g.total ? Math.round((g.done / g.total) * 100) : null
          const gb = band(gp)
          const isi = (
            <>
              <span className="block truncate text-xs font-semibold text-ink">{ROLES[g.role]?.label ?? g.role} <span className="text-ink-mute">· {g.orang}</span></span>
              <span className="mt-0.5 block text-sm tabular-nums">
                {gp === null ? <span className="text-ink-mute">—</span> : <><b className={gb.text}>{gp}%</b> <span className="text-ink-mute">· {g.done}/{g.total}</span></>}
                {g.overdue > 0 && <span className="ml-1 text-xs font-semibold text-rose-600">· {g.overdue} terlambat</span>}
              </span>
            </>
          )
          return (
            <li key={g.role} className="bg-white" data-tim-role={g.role}>
              {user.role === 'superadmin'
                ? <a href="#/monitoring" className="block px-3 py-2 hover:bg-slate-50">{isi}</a>
                : <div className="px-3 py-2">{isi}</div>}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

/** Ringkasan keuangan — angka + tautan; tabelnya tetap di Keuangan. */
export function RingkasanKeuangan({ s }) {
  const { user } = useApp()
  const transfer = s.payments.reduce((a, x) => a + totalPengajuan(x.data), 0)
  const acc = s.approvals.length
  const vendor = s.subs.filter((x) => VENDOR_ORDER_STAGES.includes(x.stage) && !x.project.demo_perf).length
  const item = [
    { l: 'Menunggu ACC', v: acc, sub: 'pengajuan vendor', href: '#/keuangan', hot: acc > 0 && ['superadmin', 'direktur'].includes(user.role) },
    { l: 'Menunggu transfer', v: rupiah(transfer), sub: `${s.payments.length} pengajuan`, href: '#/keuangan', hot: s.payments.length > 0 && ['superadmin', 'akunting'].includes(user.role) },
    { l: 'Order vendor berjalan', v: vendor, sub: 'semua tahap', href: '#/keuangan/tagihan' },
  ]
  return (
    <Card className="overflow-hidden" data-ringkasan-keuangan>
      <div className="card-head flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-50"><Banknote className="h-4 w-4 text-emerald-600" /></span>
        <h2 className="font-bold">Keuangan</h2>
        <a href="#/keuangan" className="ml-auto text-[11px] font-semibold text-brand hover:underline">Buka Keuangan →</a>
      </div>
      <ul className="grid grid-cols-3 gap-px bg-slate-100">
        {item.map((i) => (
          <li key={i.l} className="bg-white">
            <a href={i.href} className="block px-3 py-2 hover:bg-slate-50">
              <span className={cx('block truncate text-base font-extrabold tabular-nums', i.hot ? 'text-amber-700' : 'text-ink')}>{i.v}</span>
              <span className="block truncate text-[11px] font-semibold text-ink-soft">{i.l}</span>
              <span className="block truncate text-[10px] text-ink-mute">{i.sub}</span>
            </a>
          </li>
        ))}
      </ul>
    </Card>
  )
}

