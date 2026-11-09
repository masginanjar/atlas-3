import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, FolderKanban, StickyNote, ListTodo, AlarmClock, FilePlus2, ReceiptText, Users, UserRound, Menu as MenuIcon, ChevronLeft, X, Clock, Copy, FolderOpen, CalendarRange, AlertTriangle, CalendarClock } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { scopeByBranch, branchesOf, can, branchOfInvoice, invoiceLabel } from '../config/access.js'
import { canSeeInvoices, menuBoleh, canSeePenugasan, canSeeAffidavit, canMonitor, canSeeBeranda, canSeeKeuangan } from '../config/menuAccess.js'
import { roleLabel } from '../config/access.js'
import { daysLeft } from '../lib/format.js'
import { isDone, progressOf, stageLabel, flowOf } from '../config/workflows.js'
import { statusOf } from '../lib/presence.js'
import Avatar from './Avatar.jsx'
import { scopeRequests, REQ_KINDS } from './Requests.jsx'
import { myNotes } from '../lib/personal.js'
import { myTodos } from '../pages/Todos.jsx'
import { myReminders } from '../pages/Reminders.jsx'
import { usePanel } from './WorkspacePanel.jsx'
import { go } from '../lib/router.js'
import { cx } from './ui.jsx'

const ICON = { tim: UserRound, menu: MenuIcon, project: FolderKanban, note: StickyNote, todo: ListTodo, reminder: AlarmClock, pengajuan: FilePlus2, faktur: ReceiptText, pelanggan: Users }
const LABEL = { tim: 'Tim', menu: 'Menu', project: 'Project', note: 'Catatan', todo: 'To-do', reminder: 'Pengingat', pengajuan: 'Pengajuan', faktur: 'Faktur', pelanggan: 'Pelanggan' }

/** Pencarian lintas item — hanya yang boleh dilihat user ini. */
export function searchAll(user, data, branchFilter, term, invoices = []) {
  const q = term.trim().toLowerCase()
  if (q.length < 2) return []
  const hit = (s) => String(s || '').toLowerCase().includes(q)
  const out = []
  for (const p of scopeByBranch(user, data.projects, branchFilter)) {
    if (hit(p.invoice_no) || hit(p.customer?.name) || (p.sub_projects || []).some((s) => hit(s.title))) {
      out.push({ kind: 'project', id: p.id, title: p.invoice_no, sub: p.customer?.name || '', open: () => go(`projects/${p.id}`) })
    }
  }
  for (const n of myNotes(data, user)) if (!n.deleted_at && (hit(n.title) || hit(n.body) || (n.tags || []).some(hit))) out.push({ kind: 'note', id: n.id, title: n.title || '(tanpa judul)', sub: (n.tags || []).join(', '), panel: ['note', { note: n }] })
  for (const t of myTodos(data, user)) if (hit(t.title) || hit(t.note)) out.push({ kind: 'todo', id: t.id, title: t.title, sub: t.list || 'Umum', panel: ['todo', { todo: t }] })
  for (const r of myReminders(data, user)) if (hit(r.title) || hit(r.note)) out.push({ kind: 'reminder', id: r.id, title: r.title, sub: '', panel: ['reminder', { reminder: r }] })
  for (const r of scopeRequests(user, data.requests || [], branchFilter)) if (hit(r.purpose) || hit(REQ_KINDS[r.kind]?.label)) out.push({ kind: 'pengajuan', id: r.id, title: r.purpose || REQ_KINDS[r.kind]?.label, sub: REQ_KINDS[r.kind]?.label || '', open: () => go('pengajuan') })
  // F3: faktur Zoho yang belum jadi project (hak lihat sama dengan menu Faktur: cabang dari 3 angka awal)
  if (canSeeInvoices(user) && invoices?.length) {
    const punya = new Set(data.projects.map((p) => String(p.invoice_no || '').toUpperCase()))
    const mine = branchesOf(user); const semua = can.seeAllBranches(user)
    const qNum = q.replace(/^inv-?/i, '')
    for (const i of invoices) {
      const b = i.branch || branchOfInvoice(i.invoice_no)
      if (!(semua ? (branchFilter === 'Semua' || b === branchFilter) : (b && mine.includes(b)))) continue
      if (punya.has(String(i.invoice_no || '').toUpperCase())) continue
      if (String(i.invoice_no || '').toLowerCase().includes(qNum) || hit(i.customer_name)) out.push({ kind: 'faktur', id: i.invoice_no, title: invoiceLabel(i.invoice_no), sub: `${i.customer_name || ''} · belum jadi project`, open: () => go('faktur') })
    }
    // pelanggan unik dari faktur yang terlihat
    const seen = new Set()
    for (const i of invoices) {
      const b = i.branch || branchOfInvoice(i.invoice_no)
      if (!(semua ? (branchFilter === 'Semua' || b === branchFilter) : (b && mine.includes(b)))) continue
      const nama = i.customer_name || ''
      if (!nama || seen.has(nama) || !hit(nama)) continue
      seen.add(nama)
      out.push({ kind: 'pelanggan', id: `c-${nama}`, title: nama, sub: 'pelanggan Zoho', open: () => go(can.seeAllBranches(user) && user.role === 'superadmin' ? 'pelanggan' : 'faktur') })
    }
  }
  return out.slice(0, 60)
}


// ---------------- Pencarian v2 (desain 10 Nov 2026) ----------------
// Batas data: hanya yang boleh dilihat akun ini — project cabangnya sendiri
// atau yang bersinggungan (titip print, multi cabang, tugas yang diberikan
// kepadanya), faktur/pelanggan cabangnya, catatan/to-do MILIKNYA, dan data umum
// (nama tim, menu). Catatan pribadi, pengajuan libur, dan data staf lain tidak ikut.
// Di mode live, data yang sampai ke aplikasi sendiri sudah dibatasi RLS Supabase.

const MENU_CARI = [
  ['beranda', 'Beranda', canSeeBeranda], ['dashboard', 'Dasbor'], ['projects', 'Project'], ['projects/new', 'Project baru'],
  ['faktur', 'Faktur', canSeeInvoices], ['penugasan', 'Penugasan', canSeePenugasan], ['keuangan', 'Keuangan', canSeeKeuangan],
  ['agenda', 'Agenda'], ['notes', 'Catatan'], ['jadwal', 'Jadwal'], ['affidavit', 'Affidavit', canSeeAffidavit], ['faq', 'FAQ'],
  ['monitoring', 'Monitoring', canMonitor], ['settings', 'Pengaturan'], ['settings/profile', 'Profil & kata sandi'],
]
const GRUP = [['tim', 'Tim'], ['project', 'Project'], ['faktur', 'Faktur'], ['pelanggan', 'Pelanggan'], ['note', 'Catatan'], ['todo', 'To-do'], ['reminder', 'Pengingat'], ['pengajuan', 'Pengajuan'], ['menu', 'Menu']]
const CHIP = [['semua', 'Semua'], ['project', 'Project'], ['faktur', 'Faktur'], ['pelanggan', 'Pelanggan'], ['tim', 'Tim'], ['pribadi', 'Catatan & to-do'], ['menu', 'Menu']]
const masukChip = (chip, kind) => chip === 'semua' || chip === kind || (chip === 'pribadi' && ['note', 'todo', 'reminder', 'pengajuan'].includes(kind))
const kunciRiwayat = (uid) => `atlas-cari-riwayat:${uid}`
const bacaRiwayat = (uid) => { try { return JSON.parse(localStorage.getItem(kunciRiwayat(uid)) || '{"q":[],"p":[]}') } catch { return { q: [], p: [] } } }
const simpanRiwayat = (uid, v) => { try { localStorage.setItem(kunciRiwayat(uid), JSON.stringify(v)) } catch { /* abaikan */ } }

/** Tandai bagian teks yang cocok. */
function Sorot({ teks, q }) {
  const t = String(teks || ''); const k = q.trim().toLowerCase()
  if (k.length < 2) return t
  const i = t.toLowerCase().indexOf(k)
  if (i < 0) return t
  return <>{t.slice(0, i)}<mark className="rounded bg-yellow-200 px-px text-ink">{t.slice(i, i + k.length)}</mark>{t.slice(i + k.length)}</>
}

/** Cari v2: menambah Tim, Menu, filter #cabang / @orang / >menu. */
function cariV2(user, data, branchFilter, raw, invoices) {
  let term = raw.trim(); let cabang = ''; let paksa = ''
  const tag = term.match(/(^|\s)#(\w+)/); if (tag) { cabang = tag[2].toLowerCase(); term = term.replace(tag[0], ' ').trim() }
  if (term.startsWith('@')) { paksa = 'tim'; term = term.slice(1) }
  else if (term.startsWith('>')) { paksa = 'menu'; term = term.slice(1) }
  const q = term.toLowerCase()
  const out = []
  if (!paksa && (q.length >= 2 || cabang)) {
    for (const r of searchAll(user, data, branchFilter, q.length >= 2 ? q : '  ', invoices)) out.push(r)
    if (cabang && q.length < 2) for (const p of scopeByBranch(user, data.projects, branchFilter).filter((x) => !isDone(x))) out.push({ kind: 'project', id: p.id, title: p.invoice_no, sub: p.customer?.name || '', open: () => go(`projects/${p.id}`) })
  }
  const hit = (s) => !q || String(s || '').toLowerCase().includes(q)
  if ((q.length >= 2 || paksa === 'tim') && paksa !== 'menu') {
    for (const u of (data.users || []).filter((x) => x.active !== false && x.id !== user.id)) {
      if (!hit(u.name) && !hit(roleLabel(u)) && !hit(u.branch)) continue
      out.push({ kind: 'tim', id: u.id, title: u.name, sub: `${roleLabel(u)}${u.branch ? ` · ${u.branch}` : ''}`, user: u, cabang: u.branch, open: () => go('jadwal') })
    }
  }
  if ((q.length >= 2 || paksa === 'menu') && paksa !== 'tim') {
    for (const [k, l, f] of MENU_CARI) if (menuBoleh(user, k.split('/')[0]) && (!f || f(user)) && hit(l)) out.push({ kind: 'menu', id: k, title: l, sub: `Buka ${l}`, open: () => go(k) })
  }
  // filter #cabang
  const projOf = (r) => (r.kind === 'project' ? data.projects.find((p) => p.id === r.id) : null)
  return out.filter((r) => !cabang || String(r.cabang || projOf(r)?.branch || '').toLowerCase().startsWith(cabang) || r.kind === 'menu')
    .map((r) => (r.kind === 'project' ? { ...r, p: projOf(r) } : r))
}

/** Pintasan saat kotak cari masih kosong. */
function pintasan(user, data, branchFilter, invoices) {
  const proj = scopeByBranch(user, data.projects, branchFilter).filter((p) => !isDone(p) && !p.demo_perf)
  const telat = proj.filter((p) => { const d = daysLeft(p.about?.deadline); return d !== null && d < 0 }).length
  const hariIni = proj.filter((p) => daysLeft(p.about?.deadline) === 0).length
  const out = [
    { label: 'Project terlambat', n: telat, icon: AlertTriangle, tone: 'text-rose-600', go: 'projects' },
    { label: 'Deadline hari ini', n: hariIni, icon: CalendarClock, tone: 'text-amber-600', go: 'projects' },
  ]
  if (canSeeInvoices(user)) {
    const punya = new Set(data.projects.map((p) => String(p.invoice_no || '').toUpperCase()))
    out.push({ label: 'Faktur belum project', n: (invoices || []).filter((i) => !punya.has(String(i.invoice_no || '').toUpperCase())).length, icon: ReceiptText, go: 'faktur' })
  }
  if (canSeePenugasan(user)) out.push({ label: 'Perlu penerjemah', n: proj.filter((p) => (p.sub_projects || []).some((x) => x.stage === 'pilih_penerjemah')).length, icon: Users, go: 'penugasan' })
  out.push({ label: 'Jadwal saya', icon: CalendarRange, go: 'jadwal' })
  if (menuBoleh(user, 'projects') && can.editProject?.(user)) out.push({ label: 'Project baru', icon: FilePlus2, go: 'projects/new' })
  return out
}

function Pratinjau({ r, nameOf }) {
  if (!r) return <p className="p-6 text-center text-xs text-ink-mute">Arahkan ke hasil untuk melihat pratinjau.</p>
  if (r.kind === 'project' && r.p) {
    const p = r.p; const d = daysLeft(p.about?.deadline)
    return (
      <div className="space-y-3 p-4" data-pratinjau>
        <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
          <span className="rounded-md bg-ink px-1.5 py-0.5 text-[12px] font-bold text-white">{invoiceLabel(p.invoice_no)}</span>
          <p className="mt-1.5 text-[15px] font-extrabold text-ink">{p.customer?.name || '—'}</p>
          <p className="text-[11px] text-ink-mute">{p.branch}{p.about?.cs_name ? ` · CS ${p.about.cs_name}` : ''}{p.about?.priority && p.about.priority !== 'Normal' ? ` · ${p.about.priority}` : ''}</p>
          {p.about?.deadline && <p className={cx('mt-1 text-[11px] font-bold', d !== null && d < 0 && !isDone(p) ? 'text-rose-600' : 'text-ink-soft')}>Deadline {new Date(p.about.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}{d !== null && d < 0 && !isDone(p) ? ' · lewat' : d === 0 ? ' · hari ini' : ''}</p>}
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-brand" style={{ width: `${progressOf(p) || 0}%` }} /></div>
          <div className="mt-2 space-y-1 text-[12px]">{(p.sub_projects || []).slice(0, 5).map((x) => (
            <p key={x.id} className="flex justify-between gap-2"><span className="truncate">{x.title}</span><span className="shrink-0 text-ink-mute">{stageLabel(flowOf(x, p), x.stage)}</span></p>
          ))}</div>
        </div>
        <div className="grid grid-cols-2 gap-1.5 text-[12px] font-bold">
          <button type="button" onClick={r.open} className="h-10 rounded-lg bg-brand text-white">Buka project ↵</button>
          <button type="button" onClick={() => navigator.clipboard?.writeText(p.invoice_no || '')} className="flex h-10 items-center justify-center gap-1 rounded-lg bg-white ring-1 ring-slate-200"><Copy className="h-3.5 w-3.5" />Salin invoice</button>
        </div>
      </div>
    )
  }
  if (r.kind === 'tim') {
    const st = statusOf(r.user)
    return (
      <div className="p-4 text-center" data-pratinjau>
        <div className="mx-auto w-fit"><Avatar user={r.user} size={64} /></div>
        <p className="mt-2 text-[15px] font-extrabold">{r.user.name}</p>
        <p className="text-[12px] text-ink-mute">{r.sub}</p>
        <p className="mt-1 text-[11px] font-semibold text-emerald-700">{st?.label || ''}</p>
        <button type="button" onClick={r.open} className="mt-3 h-10 w-full rounded-lg bg-white text-[12px] font-bold ring-1 ring-slate-200"><CalendarRange className="mr-1 inline h-4 w-4" />Lihat jadwal</button>
      </div>
    )
  }
  return <div className="p-4"><p className="text-[15px] font-extrabold">{r.title}</p><p className="text-[12px] text-ink-mute">{r.sub}</p><button type="button" onClick={r.open} className="mt-3 h-10 w-full rounded-lg bg-brand text-[12px] font-bold text-white">Buka ↵</button></div>
}

export default function GlobalSearch({ pill }) {
  const { user, data, branchFilter, invoices, nameOf } = useApp()
  const { open: openPanel } = usePanel()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [chip, setChip] = useState('semua')
  const [i, setI] = useState(0)
  const [riwayat, setRiwayat] = useState(() => bacaRiwayat(user.id))
  const input = useRef(null)
  const semua = useMemo(() => (open ? cariV2(user, data, branchFilter, q, invoices || []) : []), [open, user, data, branchFilter, q, invoices])
  const hasil = semua.filter((r) => masukChip(chip, r.kind))
  // urutan tampil = per grup; di "Semua" tiap grup maksimal 5
  const grup = GRUP.map(([k, l]) => { const all = hasil.filter((r) => r.kind === k); return { k, l, n: all.length, rows: chip === 'semua' ? all.slice(0, 5) : all.slice(0, 40) } }).filter((g) => g.n)
  const datar = grup.flatMap((g) => g.rows)
  const hitChip = (c) => semua.filter((r) => masukChip(c, r.kind)).length
  const aktif = datar[Math.min(i, datar.length - 1)]
  const kosong = q.trim().length < 2 && !/^[@>#]/.test(q.trim())

  useEffect(() => {
    const key = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(true); setQ(''); setChip('semua') }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])
  useEffect(() => { if (open) { setTimeout(() => input.current?.focus(), 30); setRiwayat(bacaRiwayat(user.id)) } }, [open, user.id])
  useEffect(() => { setI(0) }, [q, chip])

  const catat = (r) => {
    const v = bacaRiwayat(user.id)
    if (q.trim().length >= 2) v.q = [q.trim(), ...v.q.filter((x) => x !== q.trim())].slice(0, 5)
    if (r?.kind === 'project') v.p = [r.id, ...v.p.filter((x) => x !== r.id)].slice(0, 4)
    simpanRiwayat(user.id, v); setRiwayat(v)
  }
  const pick = (r) => { catat(r); setOpen(false); if (r.open) r.open(); else if (r.panel) openPanel(...r.panel) }
  const hapusRiwayat = (x) => { const v = { ...riwayat, q: riwayat.q.filter((y) => y !== x) }; simpanRiwayat(user.id, v); setRiwayat(v) }
  const proyekTerakhir = riwayat.p.map((id) => data.projects.find((p) => p.id === id)).filter(Boolean).filter((p) => scopeByBranch(user, [p], 'Semua').length)

  return (
    <>
      {pill ? (
        <button type="button" onClick={() => setOpen(true)} title="Cari (Ctrl+K)" aria-label="Cari"
          className="flex h-11 w-full items-center gap-2 rounded-full border px-3 text-left text-sm transition md:h-9"
          style={{ borderColor: 'var(--head-line)', color: 'var(--head-mute)' }}>
          <Search className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">Cari project, faktur, pelanggan…</span>
          <span className="hidden shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold sm:inline" style={{ background: 'var(--head-hover)' }}>Ctrl K</span>
        </button>
      ) : (
        <button type="button" onClick={() => setOpen(true)} title="Cari (Ctrl+K)" aria-label="Cari"
          className="grid h-11 w-11 place-items-center rounded-xl text-ink-mute transition hover:bg-white hover:text-brand"><Search className="h-[17px] w-[17px]" /></button>
      )}
      {open && (
        <div className="fixed inset-0 z-[120] flex items-start justify-center bg-ink/30 backdrop-blur-[2px] md:px-4 md:pt-[8vh]" onClick={() => setOpen(false)}>
          <div role="dialog" aria-label="Pencarian" data-cari-v2 onClick={(e) => e.stopPropagation()}
            className={cx('flex h-full w-full flex-col overflow-hidden bg-white text-ink shadow-2xl ring-1 ring-slate-200 md:h-auto md:max-h-[80vh] md:rounded-2xl', !kosong && datar.length ? 'md:max-w-5xl' : 'md:max-w-3xl')}>
            <label className="flex items-center gap-2 border-b border-slate-100 px-3 py-2 md:px-4">
              <button type="button" onClick={() => setOpen(false)} aria-label="Tutup pencarian" className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-ink-soft md:hidden"><ChevronLeft className="h-5 w-5" /></button>
              <Search className="hidden h-4 w-4 shrink-0 text-ink-mute md:block" />
              <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari no. invoice, pelanggan, @orang, #cabang, >menu…" aria-label="Kata kunci" data-input-cari
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(x + 1, datar.length - 1)) }
                  if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(x - 1, 0)) }
                  if (e.key === 'Tab') { e.preventDefault(); const k = CHIP.map((c) => c[0]); setChip(k[(k.indexOf(chip) + (e.shiftKey ? k.length - 1 : 1)) % k.length]) }
                  if (e.key === 'Enter' && aktif) pick(aktif)
                }}
                className="h-11 min-w-0 flex-1 border-0 bg-transparent text-[15px] focus:outline-none focus:ring-0" />
              {q && <button type="button" onClick={() => setQ('')} aria-label="Hapus kata kunci" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-mute hover:bg-slate-100"><X className="h-4 w-4" /></button>}
              <span className="hidden shrink-0 rounded border border-slate-200 bg-slate-50 px-1.5 text-[10px] font-bold text-ink-soft md:inline">Esc</span>
            </label>
            <div className="flex gap-1.5 overflow-x-auto border-b border-slate-100 px-3 py-2 [scrollbar-width:none] md:px-4" role="tablist">
              {CHIP.map(([k, l]) => (
                <button key={k} type="button" role="tab" aria-selected={chip === k} onClick={() => setChip(k)} data-chip-cari={k}
                  className={cx('h-8 shrink-0 rounded-full px-3 text-[12px] font-bold ring-1 transition', chip === k ? 'bg-ink text-white ring-ink' : 'bg-white text-ink-soft ring-slate-200 hover:ring-slate-300')}>
                  {l}{!kosong && <span className={cx('ml-1 tabular-nums', chip === k ? 'text-white/70' : 'text-ink-mute')}>{hitChip(k)}</span>}
                </button>
              ))}
            </div>

            {kosong ? (
              <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-4 md:grid-cols-2" data-cari-kosong>
                <div>
                  {riwayat.q.length > 0 && <>
                    <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-ink-mute">Terakhir dicari</p>
                    {riwayat.q.map((x) => (
                      <div key={x} className="flex min-h-11 items-center gap-2 rounded-lg px-2 hover:bg-slate-50">
                        <button type="button" onClick={() => setQ(x)} className="flex min-w-0 flex-1 items-center gap-2 text-left text-[13px]"><Clock className="h-4 w-4 shrink-0 text-ink-mute" /><span className="truncate">{x}</span></button>
                        <button type="button" onClick={() => hapusRiwayat(x)} aria-label={`Hapus ${x}`} className="grid h-8 w-8 place-items-center rounded text-ink-mute hover:bg-slate-100"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    ))}
                  </>}
                  {proyekTerakhir.length > 0 && <>
                    <p className="mb-1.5 mt-4 text-[10px] font-extrabold uppercase tracking-wider text-ink-mute">Terakhir dibuka</p>
                    {proyekTerakhir.map((p) => (
                      <button key={p.id} type="button" onClick={() => { setOpen(false); go(`projects/${p.id}`) }} className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] hover:bg-slate-50">
                        <span className="rounded-md bg-ink px-1.5 text-[11px] font-bold text-white">{invoiceLabel(p.invoice_no)}</span><span className="truncate">{p.customer?.name}</span>
                      </button>
                    ))}
                  </>}
                  {!riwayat.q.length && !proyekTerakhir.length && <p className="text-xs text-ink-mute">Belum ada riwayat pencarian.</p>}
                </div>
                <div>
                  <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-ink-mute">Pintasan</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {pintasan(user, data, branchFilter, invoices).map((s) => (
                      <button key={s.label} type="button" onClick={() => { setOpen(false); go(s.go) }} className="flex min-h-11 items-center gap-2 rounded-xl bg-slate-50 px-2.5 py-2 text-left text-[12px] font-semibold ring-1 ring-slate-200 hover:ring-brand">
                        <s.icon className={cx('h-4 w-4 shrink-0', s.tone || 'text-ink-mute')} /><span className="min-w-0 flex-1 truncate">{s.label}</span>{s.n != null && <b className={cx('tabular-nums', s.tone)}>{s.n}</b>}
                      </button>
                    ))}
                  </div>
                  <p className="mb-1.5 mt-4 text-[10px] font-extrabold uppercase tracking-wider text-ink-mute">Tips</p>
                  <p className="text-[12px] leading-relaxed text-ink-soft"><code className="rounded bg-slate-100 px-1">@nama</code> cari orang · <code className="rounded bg-slate-100 px-1">#bali</code> per cabang · <code className="rounded bg-slate-100 px-1">&gt;jadwal</code> buka menu · cukup ketik 4 digit terakhir invoice.</p>
                </div>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1">
                <ul className="min-h-0 flex-1 overflow-y-auto p-2" data-hasil-cari>
                  {!datar.length && <li className="px-3 py-8 text-center text-xs text-ink-mute">Tidak ada yang cocok{chip !== 'semua' ? ' di kategori ini' : ''}.</li>}
                  {grup.map((g) => (
                    <li key={g.k}>
                      <p className="px-2 pb-1 pt-2 text-[10px] font-extrabold uppercase tracking-wider text-ink-mute">{g.l} · {g.n}</p>
                      <ul>{g.rows.map((r) => {
                        const n = datar.indexOf(r); const Icon = ICON[r.kind] || Search; const p = r.p
                        const d = p ? daysLeft(p.about?.deadline) : null
                        return (
                          <li key={`${r.kind}${r.id}`}>
                            <button type="button" onMouseEnter={() => setI(n)} onClick={() => pick(r)} data-hasil={r.kind}
                              className={cx('flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left', n === i ? 'bg-brand-soft/70 ring-1 ring-brand/30' : 'hover:bg-slate-50')}>
                              {r.kind === 'tim' ? <Avatar user={r.user} size={32} /> : r.kind === 'project' ? null : <Icon className="h-4 w-4 shrink-0 text-ink-mute" />}
                              {r.kind === 'project' && <span className="shrink-0 rounded-md bg-ink px-1.5 py-0.5 text-[11.5px] font-bold text-white"><Sorot teks={invoiceLabel(r.title)} q={q} /></span>}
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13px] font-semibold text-ink">{r.kind === 'project' ? <Sorot teks={r.sub} q={q} /> : <Sorot teks={r.title} q={q} />}</span>
                                <span className="block truncate text-[11px] text-ink-mute">{r.kind === 'project' ? `${p?.branch || ''}${p?.sub_projects?.length ? ` · ${p.sub_projects.length} sub` : ''}` : r.sub}</span>
                              </span>
                              {p && p.about?.deadline && <span className={cx('shrink-0 rounded px-1.5 text-[10px] font-bold', isDone(p) ? 'bg-emerald-50 text-emerald-700' : d < 0 ? 'bg-rose-600 text-white' : d === 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-ink-soft')}>{isDone(p) ? 'Selesai' : new Date(p.about.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>}
                              {!p && r.kind !== 'tim' && <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-ink-soft">{LABEL[r.kind]}</span>}
                            </button>
                          </li>
                        )
                      })}</ul>
                      {chip === 'semua' && g.n > g.rows.length && <button type="button" onClick={() => setChip(CHIP.find(([k]) => masukChip(k, g.k) && k !== 'semua')?.[0] || 'semua')} className="px-2.5 py-1 text-[11px] font-bold text-brand hover:underline">+ {g.n - g.rows.length} {g.l.toLowerCase()} lain →</button>}
                    </li>
                  ))}
                </ul>
                {datar.length > 0 && <aside className="hidden w-[340px] shrink-0 overflow-y-auto border-l border-slate-100 bg-slate-50 md:block"><p className="px-4 pt-3 text-[10px] font-extrabold uppercase tracking-wider text-ink-mute">Pratinjau</p><Pratinjau r={aktif} nameOf={nameOf} /></aside>}
              </div>
            )}
            <div className="hidden items-center gap-3 border-t border-slate-100 bg-slate-50 px-4 py-2 text-[11px] text-ink-mute md:flex">
              <span>↑↓ pilih</span><span>Enter buka</span><span>Tab ganti kategori</span><span className="ml-auto">Hasil sesuai hak akses & cabang Anda — data pribadi orang lain tidak ikut</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
