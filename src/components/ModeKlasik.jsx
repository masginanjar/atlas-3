// ============================================================
//  MODE KLASIK — tampilan sederhana layar penuh untuk komputer.
//  Hanya 2 menu: Project & Keuangan (pengajuan vendor + statusnya).
//  Tanpa harga proyek, pembayaran pelanggan, maupun omset.
//  Pilihan disimpan per pengguna di perangkat ini. Di HP tidak tersedia.
// ============================================================
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Search, Plus, ChevronDown, ArrowLeft, ExternalLink, Maximize2, Minimize2, X, FolderOpen, Wallet, Eye, Copy, Languages, Stamp, UserCheck, Printer, LogOut, MoreHorizontal, Smartphone, Monitor, Hash } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { go } from '../lib/router.js'
import { scopeByBranch, can, branchesOf, BRANCHES, invoiceLabel, isMultiBranch, activeClaim, ROLES, rolesOf, coordinatorFor, foreignLang, diKoordinasi, vendorKoordinator } from '../config/access.js'
import { projectRow, statusOf } from '../lib/projectRow.js'
import { flowOf, stageLabel, stageIndex, DONE, isVendorFlow } from '../config/workflows.js'
import { ProjectTypes } from './badges.jsx'
import NotificationBell from './NotificationBell.jsx'
import Avatar from './Avatar.jsx'
import { cx, Sheet, bisaDitekan } from './ui.jsx'
import ProjectDetail, { StagePanel, TabDetailProject } from '../pages/ProjectDetail.jsx'
import ProjectForm from '../pages/ProjectForm.jsx'
import { InvoiceNo } from './badges.jsx'
import FileManager, { uploadProjectFiles } from './FileManager.jsx'
import { tanggalJam, tanggal } from '../lib/waktu.js'
import { grupOf, sisaWaktu } from '../lib/urgensi.js'
import { stagesOf } from '../config/workflows.js'
import { SUB_TYPES, kindPages } from '../config/subtypes.js'
import { kapasitasHarian } from './Kapasitas.jsx'
import { createPortal } from 'react-dom'
import { rupiah } from '../lib/format.js'
import { copyText } from './CopyText.jsx'
import { menuBoleh, canSeeApostille, canSeeRegister } from '../config/menuAccess.js'
import { drive } from '../lib/integrations.js'
import { scopeRequests, RequestForm } from './Requests.jsx'
// Sama dengan aturan di Requests.jsx: pelaksana lepas tidak membuat pengajuan
const bolehAju = (u) => !!u && !['penerjemah', 'proofreader', 'otorisator', 'staf_apostille'].includes(u.role)
import { SUMBER_DANA, recommendFund } from '../config/workflows.js'

import { readTheme, simpanTema, ACCENTS } from './ThemePicker.jsx'

const RegisterPage = lazy(() => import('../pages/Register.jsx'))
import { kunciKlasik } from '../config/rilis.js'
import { KLASIK_ROLES_BAWAAN, bolehKlasik, setKlasik, useHp, useLayarSentuh, usePaksaHp, usePaksaPc, tukarTampilan, useKlasik, layarPenuh, SaklarMode } from './klasikSaklar.jsx'
export { KLASIK_ROLES_BAWAAN, bolehKlasik, setKlasik, useHp, useKlasik, SaklarMode }

/** Jam WITA & WIB (jam:menit) + tanggal. */
function JamKlasik() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 10000); return () => clearInterval(t) }, [])
  const j = (tz) => now.toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' })
  const tgl = now.toLocaleDateString('id-ID', { timeZone: 'Asia/Makassar', weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })
  return (
    <div className="flex shrink-0 items-center gap-4 rounded-lg bg-white/10 px-4 py-1.5" data-jam-klasik>
      <div className="text-center leading-tight"><p className="text-[9px] font-bold tracking-wider text-white/50">WITA</p><p className="font-mono text-[17px] font-bold tabular-nums">{j('Asia/Makassar')}</p></div>
      <span className="hidden h-7 w-px bg-white/20 min-[1440px]:block" />
      <div className="hidden text-center leading-tight min-[1440px]:block"><p className="text-[9px] font-bold tracking-wider text-white/50">WIB</p><p className="font-mono text-[17px] font-bold tabular-nums">{j('Asia/Jakarta')}</p></div>
      <span className="hidden h-7 w-px bg-white/20 min-[1800px]:block" />
      <div className="hidden leading-tight min-[1800px]:block"><p className="text-[9px] font-bold tracking-wider text-white/50">TANGGAL</p><p className="text-[14px] font-bold">{tgl}</p></div>
    </div>
  )
}

export 
/** Jam ringkas untuk HP: WITA · WIB · tanggal. */
function JamHp() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 10000); return () => clearInterval(t) }, [])
  const j = (tz) => now.toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' })
  return (
    <div className="min-w-0 leading-tight" data-jam-klasik>
      <p className="whitespace-nowrap font-mono text-[12px] font-bold tabular-nums"><span className="text-[9px] text-white/50">WITA </span>{j('Asia/Makassar')} <span className="text-[9px] text-white/50">WIB </span>{j('Asia/Jakarta')}</p>
      <p className="whitespace-nowrap text-[10px] text-white/60">{now.toLocaleDateString('id-ID', { timeZone: 'Asia/Makassar', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</p>
    </div>
  )
}

function TombolLayarPenuh({ terang }) {
  const [full, setFull] = useState(() => !!document.fullscreenElement)
  useEffect(() => { const f = () => setFull(!!document.fullscreenElement); document.addEventListener('fullscreenchange', f); return () => document.removeEventListener('fullscreenchange', f) }, [])
  const I = full ? Minimize2 : Maximize2
  return <button type="button" onClick={() => layarPenuh(!full)} title={full ? 'Keluar layar penuh' : 'Layar penuh'} aria-label={full ? 'Keluar layar penuh' : 'Layar penuh'} data-aksi="layar-penuh" className={terang ? 'flex h-9 shrink-0 items-center gap-1 rounded-lg bg-white px-2.5 text-xs font-semibold text-ink-soft ring-1 ring-slate-200 hover:text-brand' : 'grid h-9 w-9 place-items-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white'}><I className="h-4 w-4" />{terang && (full ? 'Keluar layar penuh' : 'Layar penuh')}</button>
}

// ------------------------------------------------------------
//  PROJECT — tabel lebar tanpa harga
// ------------------------------------------------------------
const hariKey = (v) => { const t = v ? new Date(v) : null; return t && !Number.isNaN(t.getTime()) ? t.toLocaleDateString('sv-SE', { timeZone: 'Asia/Makassar' }) : '' }
function labelDeadline(r) {
  if (!r.deadline) return { t: '—', cls: 'text-ink-mute' }
  const jam = r.p.about?.deadline_time || '17:00'
  const hari = hariKey(r.deadline); const ini = hariKey(new Date())
  const selisih = Math.round((new Date(`${hari}T12:00:00+08:00`) - new Date(`${ini}T12:00:00+08:00`)) / 864e5)
  const dm = `${hari.slice(8)}/${hari.slice(5, 7)}`
  if (r.status === 'Selesai') return { t: `${dm} ${jam}`, cls: 'text-ink-mute' }
  if (selisih < 0) return { t: `${dm} · telat ${-selisih} hr`, cls: 'font-semibold text-rose-600' }
  if (selisih === 0) return { t: `Hari ini ${jam}`, cls: 'font-semibold text-amber-600' }
  if (selisih === 1) return { t: `Besok ${jam}`, cls: 'text-ink' }
  return { t: `${dm} ${jam}`, cls: 'text-ink' }
}
const NADA = (s) => (/vendor/i.test(s) ? 'bg-violet-100 text-violet-700' : /kirim|selesai/i.test(s) ? 'bg-emerald-100 text-emerald-700' : /stempel|scan|print|cetak/i.test(s) ? 'bg-sky-100 text-sky-700' : /verif|kemen|apostille|legal/i.test(s) ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-ink-soft')

const TS = (v) => (v ? new Date(v).toLocaleString('id-ID', { timeZone: 'Asia/Makassar', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '') : '—')
const subStatus = (x, p) => (x.stage === DONE ? 'Selesai' : stageLabel(flowOf(x, p), x.stage))
const subOrang = (x, nameOf) => { const id = x.data?.translator || x.translator || x.data?.vendor; return id ? nameOf(id) : '' }
const subHal = (x) => (x.docs?.length ? x.docs.reduce((a, d) => a + (Number(d.pages) || 0), 0) : Number(x.pages) || 0)
const subDok = (x) => x.docs?.length || x.file_count || 0
const KOLOM = [
  { key: 'timestamp', label: 'Timestamp', sort: (r) => r.timestamp },
  { key: 'invoice', label: 'No. Invoice', sort: (r) => r.invoice },
  { key: 'pelanggan', label: 'Nama Pelanggan', sort: (r) => r.pelanggan.toLowerCase() },
  { key: 'prioritas', label: 'Prioritas', sort: (r) => r.prioRank },
  { key: 'deadline', label: 'Deadline', sort: (r) => r.deadline || '9' },
  { key: 'status', label: 'Status', sort: (r) => r.status.toLowerCase() },
  { key: 'cabang', label: 'Cabang', sort: (r) => r.cabang },
  { key: 'print', label: 'Print', sort: (r) => r.print },
  { key: 'cs', label: 'CS', sort: (r) => r.cs.toLowerCase() },
  { key: 'arah', label: 'Arah Bahasa' },
  { key: 'orang', label: 'Penerjemah/Vendor' },
  { key: 'jmlDok', label: 'Dok', num: true, sort: (r) => r.jmlDok },
  { key: 'jmlHal', label: 'Hal', num: true, sort: (r) => r.jmlHal },
  { key: 'layanan', label: 'Detail Layanan' },
]

/** Kapsul warna — sama dengan aturan tampilan Tabel. */
export function Lingkar({ warna, judul, children }) {
  if (!warna) return children
  const w = { hitam: 'bg-ink', hijau: 'bg-emerald-600', merah: 'bg-rose-600', oranye: 'bg-orange-500' }[warna]
  return <span title={judul} data-kapsul={warna} className={cx('inline-block max-w-full truncate whitespace-nowrap rounded-full px-2 py-0.5 font-semibold text-white', w)}>{children}</span>
}

/** Info melayang saat kursor diarahkan (posisi tetap, tidak terpotong tabel). */
function InfoHover({ isi, children, inline }) {
  const [pos, setPos] = useState(null)
  const tunda = useRef(null)
  // Popup hilang saat tabel digulir, diklik, atau jendela berubah — supaya tidak "membeku" menutupi tabel.
  useEffect(() => {
    if (!pos) return
    const tutup = () => { clearTimeout(tunda.current); setPos(null) }
    window.addEventListener('scroll', tutup, true); window.addEventListener('pointerdown', tutup, true); window.addEventListener('resize', tutup); window.addEventListener('blur', tutup)
    return () => { window.removeEventListener('scroll', tutup, true); window.removeEventListener('pointerdown', tutup, true); window.removeEventListener('resize', tutup); window.removeEventListener('blur', tutup) }
  }, [pos])
  useEffect(() => () => clearTimeout(tunda.current), [])
  const masuk = (e) => {
    const el = e.currentTarget
    clearTimeout(tunda.current)
    tunda.current = setTimeout(() => {
      if (!el.isConnected || !el.matches(':hover')) return
      const r = el.getBoundingClientRect()
      setPos({ x: Math.max(8, Math.min(r.left, window.innerWidth - 380)), y: r.bottom + 6, atas: r.bottom + 260 > window.innerHeight ? r.top - 6 : null })
    }, 350)
  }
  const keluar = () => { clearTimeout(tunda.current); setPos(null) }
  const Bungkus = inline ? 'span' : 'div'
  return (
    <Bungkus onMouseEnter={masuk} onMouseLeave={keluar} className={inline ? 'inline-block align-middle' : undefined}>
      {children}
      {pos && createPortal(
        <div className="pointer-events-none fixed z-[95] w-[360px] rounded-xl bg-ink p-3 text-[12px] text-white shadow-2xl" style={pos.atas != null ? { left: pos.x, bottom: window.innerHeight - pos.atas } : { left: pos.x, top: pos.y }} data-info-layanan>{isi}</div>, document.body)}
    </Bungkus>
  )
}

function InfoLayanan({ r, nameOf }) {
  return (
    <div className="space-y-2">
      {r.subs.map((x, i) => {
        const dok = x.docs || []
        return (
          <div key={x.id} className={cx(i && 'border-t border-white/15 pt-2')}>
            <p className="font-bold">{i + 1}. {x.title || '—'}</p>
            <p className="text-white/70">{SUB_TYPES[x.type]?.label || x.type}{x.lang_from && x.lang_to ? ` · ${x.lang_from} → ${x.lang_to}` : ''}{subOrang(x, nameOf) ? ` · ${subOrang(x, nameOf)}` : ''}</p>
            <p className="text-white/70">Tahap: <b className="text-white">{subStatus(x, r.p)}</b> · {subDok(x)} dok · {subHal(x)} hal</p>
            {dok.length > 0 && <ul className="mt-1 space-y-0.5 text-white/80">{dok.slice(0, 6).map((d, k) => <li key={k} className="truncate">• {d.name || d.title || `Dokumen ${k + 1}`}{d.pages ? ` · ${d.pages} hal` : ''}{d.reguler === false || d.non_reguler ? ' · Non Reguler' : ''}</li>)}{dok.length > 6 && <li>+{dok.length - 6} lainnya</li>}</ul>}
          </div>
        )
      })}
      <p className={cx('border-t border-white/15 pt-2', r.p.about?.notes ? 'whitespace-pre-wrap text-amber-200' : 'text-white/50')}>Catatan: {r.p.about?.notes || 'tidak ada'}</p>
    </div>
  )
}

/** Isi popup ringkas satu pengajuan (tab Keuangan). Tanpa harga proyek — hanya nominal pengajuan. */
function InfoPengajuan({ r }) {
  const baris = [['Jenis', r.jenis], ['No invoice', r.invoice], ['Pelanggan', r.pelanggan], ['Nominal', r.total ? rupiah(r.total) : ''], ['Sumber dana', r.sumber], ['Kantor', r.kantor], ['Diajukan', r.cs],
    ['Penerima', r.penerima], ['Bank', r.rek?.bank], ['No. rekening', r.rek?.number]].filter(([, v]) => v)
  return (
    <div className="space-y-1.5">
      <dl className="grid grid-cols-[96px_1fr] gap-x-2 gap-y-1">{baris.flatMap(([k, v]) => [<dt key={`k${k}`} className="text-white/60">{k}</dt>, <dd key={`v${k}`} className="break-words font-semibold">{v}</dd>])}</dl>
      {r.catatan && <p className="border-t border-white/15 pt-1.5 text-amber-200">Catatan: {r.catatan}</p>}
    </div>
  )
}

// ---------- proses ringkas: No · Nama · Tahap · Isian · Tombol (rata kiri) ----------
const TIPE_RINGKAS = (t) => ['file', 'text', 'date', 'choice', 'money', 'sumber_dana', 'checklist'].includes(t) || /^(user|person):/.test(t)
const kotak = 'h-9 rounded-lg border-0 bg-white px-2.5 text-[12.5px] ring-1 ring-slate-300 focus:ring-2 focus:ring-brand'

/** Label unggah dipersingkat: "Upload Hasil Apostille / Legalisasi" → "Upload Hasil". */
const labelPendek = (l) => String(l || '').replace(/\s+(apostille|legalisasi)(\s*\/\s*(apostille|legalisasi))?$/i, '').trim() || l

/** Ceklis ringkas: satu tombol "2/6 · berikutnya", isinya muncul saat diklik. */
function CeklisRingkas({ f, v, set }) {
  const { user } = useApp()
  const [pos, setPos] = useState(null)
  const ref = useRef(null)
  useEffect(() => {
    if (!pos) return
    const tutup = (e) => { if (!ref.current?.contains(e.target) && !e.target.closest?.('[data-ceklis-pop]')) setPos(null) }
    const esc = (e) => e.key === 'Escape' && setPos(null)
    document.addEventListener('mousedown', tutup); document.addEventListener('keydown', esc); window.addEventListener('scroll', tutup, true)
    return () => { document.removeEventListener('mousedown', tutup); document.removeEventListener('keydown', esc); window.removeEventListener('scroll', tutup, true) }
  }, [pos])
  const items = (f.items || []).filter((it) => !f.itemRoles?.[it] || f.itemRoles[it].includes(user.role))
  const cur = v[f.key] || []
  const selesai = items.filter((it) => cur.includes(it)).length
  const berikut = items.find((it) => !cur.includes(it))
  const penuh = items.length > 0 && selesai === items.length
  const buka = () => { const r = ref.current.getBoundingClientRect(); setPos({ x: Math.min(r.left, window.innerWidth - 230), y: r.bottom + 4 }) }
  return (
    <>
      <button ref={ref} type="button" onClick={() => (pos ? setPos(null) : buka())} aria-expanded={!!pos} aria-label={`${f.label || 'Ceklis'}: ${selesai} dari ${items.length}`} data-ceklis={f.key}
        className={cx('inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-bold ring-1', penuh ? 'bg-emerald-50 text-emerald-800 ring-emerald-300' : 'bg-white text-ink ring-slate-300 hover:ring-ink')}>
        <span className="tabular-nums">{penuh ? '✓' : '☐'} {selesai}/{items.length}</span>
        {!penuh && berikut && <span className="max-w-[110px] truncate font-semibold text-ink-soft">· {berikut}</span>}
        <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
      </button>
      {pos && createPortal(
        <div data-ceklis-pop className="fixed z-[96] w-[220px] rounded-xl bg-white p-1.5 text-[12.5px] text-ink shadow-2xl ring-1 ring-slate-200" style={{ left: pos.x, top: pos.y }}>
          {items.map((it) => { const on = cur.includes(it); return (
            <button key={it} type="button" role="menuitemcheckbox" aria-checked={on} onClick={() => set({ [f.key]: on ? cur.filter((x) => x !== it) : [...cur, it] })}
              className="flex min-h-[38px] w-full items-center gap-2 rounded-lg px-2 text-left hover:bg-slate-100">
              <span className={cx('grid h-5 w-5 place-items-center rounded text-[11px] font-bold', on ? 'bg-emerald-500 text-white' : 'ring-1 ring-slate-300')}>{on ? '✓' : ''}</span>{it}
            </button>) })}
        </div>, document.body)}
    </>
  )
}

function IsianRingkas({ f, v, set, project, sub, stage }) {
  const { user, data, notify } = useApp()
  const [up, setUp] = useState(false)
  if (f.type === 'file') {
    const list = v[`${f.key}_list`] || (v[f.key] ? [v[f.key]] : [])
    return (
      <label className={cx('inline-flex h-9 max-w-[260px] cursor-pointer items-center gap-1.5 rounded-lg border border-dashed px-2.5 text-[12.5px]', list.length ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : 'border-slate-300 text-ink-soft hover:border-brand')} title={f.label}>
        <span className="truncate">{up ? 'Mengunggah…' : list.length ? `✓ ${list.length > 1 ? `${list.length} file` : list[0].name}` : `⤒ ${labelPendek(f.label)}`}</span>
        <input type="file" multiple className="sr-only" accept={f.accept || 'image/*,application/pdf,.doc,.docx'} onChange={async (e) => {
          const fl = [...e.target.files]; e.target.value = ''; if (!fl.length) return
          setUp(true)
          try { const hasil = await uploadProjectFiles(fl.map((file) => ({ file, name: file.name, sub_id: sub.id })), { branch: project.branch, invoice: project.invoice_no, by: user.name }); const n = [...list, ...hasil]; set({ [f.key]: n[0], [`${f.key}_list`]: n }) }
          catch (er) { notify(er.message, 'err') } finally { setUp(false) }
        }} />
      </label>
    )
  }
  if (f.type === 'checklist') return <CeklisRingkas f={f} v={v} set={set} />
  if (f.type === 'sumber_dana') return <select value={v[f.key] || ''} onChange={(e) => set({ [f.key]: e.target.value })} aria-label={f.label} className={cx(kotak, 'pr-7')}>{SUMBER_DANA.map((d) => <option key={d.code} value={d.code}>Dana {d.code}</option>)}</select>
  if (f.type === 'choice') return <select value={v[f.key] || ''} onChange={(e) => set({ [f.key]: e.target.value })} aria-label={f.label} className={cx(kotak, 'pr-7')}><option value="">{f.label}</option>{(f.options || []).map((o) => <option key={o}>{o}</option>)}</select>
  if (/^user:/.test(f.type)) {
    const role = f.type.slice(5)
    const list = (data.users || []).filter((u) => u.active !== false && (u.role === role || (u.extra_roles || []).includes(role)))
    return <select value={v[f.key] || ''} onChange={(e) => set({ [f.key]: e.target.value })} aria-label={f.label} className={cx(kotak, 'max-w-[220px] pr-7')}><option value="">{f.label} ▾</option>{list.map((u) => <option key={u.id} value={u.id}>{String(u.name).replace(/\s*\(.*\)\s*$/, '')}</option>)}</select>
  }
  if (/^person:/.test(f.type)) {
    const type = f.type.slice(7)
    const list = (data.people || []).filter((x) => x.type === type && (x.branch === project.branch || x.branch === 'Semua' || !x.branch))
    return <select value={v[f.key] || ''} onChange={(e) => set({ [f.key]: e.target.value })} aria-label={f.label} className={cx(kotak, 'max-w-[220px] pr-7')}><option value="">{f.label} ▾</option>{list.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
  }
  return <input type={f.type === 'date' ? 'date' : f.type === 'money' ? 'number' : 'text'} value={v[f.key] ?? ''} onChange={(e) => set({ [f.key]: e.target.value })} placeholder={f.label} aria-label={f.label} className={cx(kotak, f.type === 'text' ? 'w-[200px]' : 'w-[150px]')} />
}

function BarisProses({ n, p, x, sel }) {
  const { user, processStage, notify, nameOf, sendPing } = useApp()
  const flow = flowOf(x, p); const st = stagesOf(flow).find((s) => s.key === x.stage)
  const [v, setV] = useState({})
  const [busy, setBusy] = useState(false)
  const [penuh, setPenuh] = useState(false)
  const [ok, setOk] = useState(false)
  useEffect(() => {
    if (!st) return
    const init = {}
    for (const f of st.fields || []) {
      init[f.key] = x.data?.[f.key] ?? (f.type === 'date' ? new Date().toISOString().slice(0, 10) : f.type === 'sumber_dana' ? recommendFund(p.branch) : f.type === 'checklist' ? [] : '')
      if (f.type === 'file') init[`${f.key}_list`] = x.data?.[`${f.key}_list`] || (x.data?.[f.key] ? [x.data[f.key]] : [])
    }
    setV(init)
  }, [x.stage, x.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const pad = sel ? 'flex flex-nowrap items-center gap-2 text-[12.5px]' : 'flex flex-wrap items-center gap-2 px-4 py-2 text-[12.5px]'
  const nama = sel ? null : <><span className="w-5 shrink-0 text-right font-bold text-ink-mute">{n}</span><span className="max-w-[260px] truncate font-bold text-ink" title={x.title}>{x.title}</span></>
  if (x.stage === DONE || !st) return (
    <div className={pad} data-baris-proses="selesai">{nama}<span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11.5px] font-bold text-emerald-700">✓ Selesai</span></div>
  )
  const normal = can.processStage(user, st, x, p)
  const claim = activeClaim(x)
  const needClaim = st.claimable && user.role !== 'superadmin' && (!claim || claim.by !== user.id)
  const wajib = (st.fields || []).filter((f) => f.required)
  const ringkas = normal && !needClaim && wajib.every((f) => TIPE_RINGKAS(f.type)) && wajib.length <= 3
  const tahap = sel ? null : <span className={cx('whitespace-nowrap rounded-md px-2 py-0.5 text-[11.5px] font-bold', normal ? 'bg-indigo-50 text-ink' : 'bg-slate-100 text-ink-soft')}>{st.label}</span>
  if (!normal) {
    const tid = st.assignee ? x.data?.[st.assignee] : null
    const who = claim && st.claimable ? `${claim.name} (sedang diproses)` : tid ? nameOf(tid) : st.printBranch ? `staf cabang ${p.about?.print_location || p.branch}` : st.roles.filter((r) => r !== 'superadmin').map((r) => ROLES[r]?.label || r).join(' / ')
    const bisaLewati = ['superadmin', 'direktur', 'admin_pusat'].includes(user.role)
    return (
      <div className={sel ? '' : 'bg-slate-50/70'} data-baris-proses="menunggu">
        <div className={cx(pad, 'text-ink-soft')}>{nama}{tahap}<span className="text-[11.5px]">🔒 menunggu {who}</span>
          {tid && tid !== user.id && <button type="button" onClick={async () => { try { await sendPing({ to_user: tid, project: p, sub: x, stage: st, message: `Mohon dicek: ${st.label}` }); notify('Ping terkirim') } catch (e) { notify(e.message, 'err') } }} className="h-8 rounded-lg bg-white px-3 font-semibold text-ink ring-1 ring-slate-300">🔔 Ping</button>}
          {bisaLewati && <button type="button" onClick={() => setPenuh((o) => !o)} className="h-8 rounded-lg px-2 text-[11.5px] font-semibold text-amber-700 hover:bg-amber-50">{penuh ? 'Tutup' : 'Lanjutkan tanpa menunggu…'}</button>}
        </div>
        {penuh && <div className={sel ? 'whitespace-normal pt-2' : 'pb-2 [&>div]:mx-4'}><StagePanel project={p} sub={x} stage={st} /></div>}
      </div>
    )
  }
  const jalan = async () => {
    setBusy(true)
    try {
      const clean = Object.fromEntries(Object.entries(v).map(([k, val]) => [k, (st.fields || []).find((f) => f.key === k)?.type === 'money' ? Number(val) || '' : val]))
      await processStage(p, x.id, clean, true)
      setOk(true); setTimeout(() => setOk(false), 2000); notify(`${x.title}: ${st.label} selesai`)
    } catch (e) { notify(e.message, 'err') } finally { setBusy(false) }
  }
  return (
    <div data-baris-proses="aktif">
      <div className={pad}>
        {nama}{tahap}
        {ringkas ? <>
          {wajib.map((f) => <IsianRingkas key={f.key} f={f} v={v} set={(o) => setV((cur) => ({ ...cur, ...o }))} project={p} sub={x} stage={st} />)}
          <button type="button" onClick={jalan} disabled={busy} data-aksi="jalankan-tahap" className={cx('h-9 whitespace-nowrap rounded-lg px-3.5 font-bold text-white disabled:opacity-50', /acc|setuju/i.test(st.action || '') ? 'bg-emerald-600' : 'bg-ink')}>{busy ? '…' : `${st.action || 'Lanjut'} →`}</button>
          {(st.fields || []).some((f) => !f.required) && <button type="button" onClick={() => setPenuh((o) => !o)} className="h-9 rounded-lg px-2 text-[11.5px] font-semibold text-ink-soft hover:bg-slate-100">{penuh ? 'Tutup' : '+ lainnya'}</button>}
        </> : <button type="button" onClick={() => setPenuh((o) => !o)} className="h-9 rounded-lg bg-ink px-3.5 font-bold text-white" data-aksi="proses-lengkap">{penuh ? 'Tutup' : `${st.action || 'Proses'} ▾`}</button>}
        {ok && <span className="font-bold text-emerald-600">✓</span>}
      </div>
      {penuh && <div className={sel ? 'whitespace-normal pt-2' : 'pb-2 [&>div]:mx-4'}><StagePanel project={p} sub={x} stage={st} /></div>}
    </div>
  )
}

/** Proses langsung di bawah baris — satu baris per sub project. */
function ProsesInline({ p }) {
  const subs = (p.sub_projects || []).filter((x) => !x.cancelled)
  return (
    <div className="sticky left-0 w-[calc(100vw-24px)] max-w-[1400px] divide-y divide-slate-100 border-l-4 border-ink bg-[var(--klasik-detail)]" data-klasik-proses>
      {subs.map((x, i) => <BarisProses key={x.id} n={i + 1} p={p} x={x} />)}
    </div>
  )
}

const PRIO_WARNA = (p) => (/sameday/i.test(p) ? 'bg-rose-600 text-white' : /super/i.test(p) ? 'bg-rose-100 text-rose-700' : /ekspres|speed/i.test(p) ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-ink-soft')

/** Judul kolom yang bisa diklik: urutkan + saring (nilai / rentang tanggal). */
function JudulKolom({ c, urut, setUrut, f, setF, opsi, kanan, lebar, setLebar }) {
  const [pos, setPos] = useState(null)
  const [cari, setCari] = useState('')
  const ref = useRef(null)
  useEffect(() => {
    if (!pos) return
    const tutup = (e) => { if (!ref.current?.contains(e.target) && !e.target.closest?.('[data-judul-pop]')) setPos(null) }
    const esc = (e) => e.key === 'Escape' && setPos(null)
    document.addEventListener('mousedown', tutup); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', tutup); document.removeEventListener('keydown', esc) }
  }, [pos])
  const v = f[c.key]
  const aktif = c.tanggal ? !!(v?.dari || v?.sampai) : !!v
  const bisa = c.sort || c.nilai || c.tanggal
  const buka = () => { const r = ref.current.getBoundingClientRect(); setPos({ x: Math.min(r.left, window.innerWidth - 270), y: r.bottom + 4 }) }
  const daftar = (opsi || []).filter((o) => !cari || String(o).toLowerCase().includes(cari.toLowerCase()))
  const setV = (x) => setF((o) => ({ ...o, [c.key]: x || undefined }))
  return (
    <th ref={ref} className={cx('group/th relative whitespace-nowrap px-2 py-1.5', kanan && 'text-right')}>
      <span role="separator" aria-orientation="vertical" aria-label={`Lebar kolom ${c.label}`} tabIndex={0} data-tarik-kolom={c.key}
        title="Tarik untuk melebarkan / menyempitkan · klik 2× untuk ukuran semula"
        onPointerDown={(e) => {
          e.preventDefault(); e.stopPropagation()
          const x0 = e.clientX, w0 = ref.current.offsetWidth
          document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'
          const gerak = (ev) => setLebar(c.key, w0 + ev.clientX - x0)
          const lepas = () => { document.body.style.cursor = ''; document.body.style.userSelect = ''; window.removeEventListener('pointermove', gerak); window.removeEventListener('pointerup', lepas) }
          window.addEventListener('pointermove', gerak); window.addEventListener('pointerup', lepas)
        }}
        onDoubleClick={(e) => { e.stopPropagation(); setLebar(c.key, null) }}
        onKeyDown={(e) => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); setLebar(c.key, (lebar || ref.current.offsetWidth) + (e.key === 'ArrowRight' ? 20 : -20)) } }}
        className="absolute right-0 top-0 z-[1] h-full w-2 cursor-col-resize touch-none after:absolute after:right-0 after:top-1/4 after:h-1/2 after:w-0.5 after:rounded after:bg-slate-300 after:opacity-0 hover:after:bg-brand hover:after:opacity-100 focus-visible:after:opacity-100 group-hover/th:after:opacity-100" />
      {bisa ? (
        <button type="button" onClick={() => (pos ? setPos(null) : buka())} aria-expanded={!!pos} data-judul={c.key}
          className={cx('inline-flex items-center gap-1 rounded-md px-1.5 py-1 uppercase hover:bg-slate-200/70', (aktif || urut.key === c.key) && 'text-ink', aktif && 'bg-ink !text-white hover:bg-ink')}>
          {c.label}{urut.key === c.key ? (urut.dir === 'desc' ? ' ↓' : ' ↑') : ''}<ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      ) : <span className="px-1.5">{c.label}</span>}
      {pos && createPortal(
        <div data-judul-pop className="fixed z-[96] w-[260px] rounded-xl bg-white p-2 text-[12.5px] normal-case tracking-normal text-ink shadow-2xl ring-1 ring-slate-200" style={{ left: pos.x, top: pos.y }}>
          {c.sort && <>
            <button type="button" onClick={() => { setUrut({ key: c.key, dir: 'asc' }); setPos(null) }} className={cx('flex h-9 w-full items-center rounded-lg px-2 text-left hover:bg-slate-100', urut.key === c.key && urut.dir === 'asc' && 'font-bold')}>↑ Urutkan {c.tanggal ? 'terlama' : c.num ? 'terkecil' : 'A–Z'}</button>
            <button type="button" onClick={() => { setUrut({ key: c.key, dir: 'desc' }); setPos(null) }} className={cx('flex h-9 w-full items-center rounded-lg px-2 text-left hover:bg-slate-100', urut.key === c.key && urut.dir === 'desc' && 'font-bold')}>↓ Urutkan {c.tanggal ? 'terbaru' : c.num ? 'terbesar' : 'Z–A'}</button>
          </>}
          {c.tanggal && (
            <div className="mt-1 space-y-1.5 border-t border-slate-100 px-1 pt-2">
              <p className="text-[11px] font-bold text-ink-mute">Saring tanggal</p>
              <input type="date" value={v?.dari || ''} onChange={(e) => setV({ ...(v || {}), dari: e.target.value })} aria-label={`${c.label} dari`} className="h-9 w-full rounded-lg border-0 text-[12.5px] ring-1 ring-slate-200" />
              <input type="date" value={v?.sampai || ''} onChange={(e) => setV({ ...(v || {}), sampai: e.target.value })} aria-label={`${c.label} sampai`} className="h-9 w-full rounded-lg border-0 text-[12.5px] ring-1 ring-slate-200" />
            </div>
          )}
          {c.nilai && (
            <div className="mt-1 border-t border-slate-100 pt-1.5">
              {(opsi || []).length > 8 && <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari…" autoFocus className="mb-1 h-9 w-full rounded-lg border-0 text-[12.5px] ring-1 ring-slate-200" />}
              <div className="max-h-[260px] overflow-y-auto">
                <button type="button" onClick={() => { setV(''); setPos(null) }} className={cx('flex h-9 w-full items-center rounded-lg px-2 text-left hover:bg-slate-100', !v && 'font-bold')}>{!v ? '✓ ' : ''}Semua</button>
                {daftar.map((o) => <button key={o} type="button" onClick={() => { setV(o); setPos(null) }} className={cx('flex min-h-[36px] w-full items-center rounded-lg px-2 text-left hover:bg-slate-100', v === o && 'font-bold text-brand')}>{v === o ? '✓ ' : ''}{o}</button>)}
                {!daftar.length && <p className="px-2 py-2 text-ink-mute">Tidak ada pilihan</p>}
              </div>
            </div>
          )}
          {aktif && <button type="button" onClick={() => { setV(''); setPos(null) }} className="mt-1 flex h-9 w-full items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50">Hapus saringan</button>}
        </div>, document.body)}
    </th>
  )
}

/** Saring & urutkan baris sesuai definisi kolom. */
export function useTabel(rows, cols, awal, nama) {
  const [f, setF] = useState({})
  // Lebar kolom hasil tarik pengguna — disimpan per tabel di perangkat ini.
  const kunciLebar = `atlas-klasik-lebar:${nama}`
  const [lebar, setLebarSemua] = useState(() => { try { return JSON.parse(localStorage.getItem(kunciLebar) || '{}') } catch { return {} } })
  useEffect(() => { try { localStorage.setItem(kunciLebar, JSON.stringify(lebar)) } catch { /* abaikan */ } }, [kunciLebar, lebar])
  const setLebar = useCallback((key, px) => setLebarSemua((o) => { const n = { ...o }; if (px == null) delete n[key]; else n[key] = Math.round(Math.min(800, Math.max(48, px))); return n }), [])
  const gayaLebar = cols.map((c, i) => lebar[c.key] ? `[data-lebar="${nama}"]>thead>tr>th:nth-child(${i + 1}),[data-lebar="${nama}"]>tbody>tr>td:not([colspan]):nth-child(${i + 1}){width:${lebar[c.key]}px;min-width:${lebar[c.key]}px;max-width:${lebar[c.key]}px;overflow:hidden;text-overflow:ellipsis}[data-lebar="${nama}"]>tbody>tr>td:not([colspan]):nth-child(${i + 1}) :is(.truncate,[class*="max-w-"]){max-width:100%}` : '').join('')
  const [urut, setUrut] = useState(awal)
  const opsi = useMemo(() => Object.fromEntries(cols.filter((c) => c.nilai).map((c) => [c.key, [...new Set(rows.flatMap((r) => c.nilai(r)).filter((x) => x !== '' && x != null))].sort((a, b) => String(a).localeCompare(String(b), 'id', { numeric: true }))])), [rows]) // eslint-disable-line react-hooks/exhaustive-deps
  const hasil = useMemo(() => {
    const out = rows.filter((r) => cols.every((c) => {
      const v = f[c.key]; if (!v) return true
      if (c.tanggal) { const d = hariKey(c.tanggal(r)); return (!v.dari || (d && d >= v.dari)) && (!v.sampai || (d && d <= v.sampai)) }
      return c.nilai(r).includes(v)
    }))
    const col = cols.find((c) => c.key === urut.key)
    if (!col?.sort) return out
    const ar = urut.dir === 'asc' ? 1 : -1
    return [...out].sort((a, b) => { const x = col.sort(a), y = col.sort(b); return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x ?? '').localeCompare(String(y ?? ''), 'id', { numeric: true })) * ar })
  }, [rows, f, urut]) // eslint-disable-line react-hooks/exhaustive-deps
  const nAktif = Object.values(f).filter((v) => v && (typeof v === 'string' || v.dari || v.sampai)).length
  const Judul = ({ c }) => <JudulKolom c={c} urut={urut} setUrut={setUrut} f={f} setF={setF} opsi={opsi[c.key]} kanan={c.num} lebar={lebar[c.key]} setLebar={setLebar} />
  const GayaLebar = () => (gayaLebar ? <style>{gayaLebar}</style> : null)
  const adaLebar = Object.keys(lebar).length > 0
  return { hasil, Judul, nAktif, reset: () => setF({}), f, setF, urut, setUrut, opsi, GayaLebar, adaLebar, resetLebar: () => setLebarSemua({}) }
}


/** HP: semua saringan & urutan kolom dalam satu lembar dari bawah. */
export function LembarSaring({ cols, f, setF, urut, setUrut, opsi, jumlah, onClose, satuan }) {
  const setV = (k, v) => setF((o) => ({ ...o, [k]: v || undefined }))
  const sortable = cols.filter((c) => c.sort && (c.tanggal || c.key === 'prioritas' || c.key === 'total' || c.key === 'pelanggan'))
  return (
    <Sheet open onClose={onClose} title="Saring & urutkan" footer={<><button type="button" onClick={() => setF({})} className="h-11 rounded-xl px-4 text-sm font-semibold text-rose-600">Reset</button><span className="flex-1" /><button type="button" onClick={onClose} className="h-11 flex-1 rounded-xl bg-ink text-sm font-bold text-white" data-aksi="tampilkan-saring">Tampilkan {jumlah} {satuan}</button></>}>
      <div className="space-y-3 text-[13px]" data-lembar-saring>
        <div><p className="text-[11px] font-bold uppercase text-ink-mute">Urutkan</p>
          <div className="mt-1 flex flex-wrap gap-1.5">{sortable.flatMap((c) => [['desc', c.tanggal ? `${c.label} terbaru` : c.num ? `${c.label} terbesar` : `${c.label} Z–A`], ['asc', c.tanggal ? `${c.label} terlama` : c.num ? `${c.label} terkecil` : `${c.label} A–Z`]].map(([d, l]) => (
            <button key={c.key + d} type="button" onClick={() => setUrut({ key: c.key, dir: d })} className={cx('min-h-[36px] rounded-full px-3', urut.key === c.key && urut.dir === d ? 'bg-ink font-semibold text-white' : 'ring-1 ring-slate-200')}>{l}</button>)))}</div></div>
        <div className="grid grid-cols-2 gap-2">
          {cols.filter((c) => c.nilai).map((c) => (
            <label key={c.key} className="block min-w-0"><span className="text-[11px] font-bold text-ink-mute">{c.label}</span>
              <select value={f[c.key] || ''} onChange={(e) => setV(c.key, e.target.value)} className={cx('mt-1 h-11 w-full rounded-lg border-0 pr-7 text-[13px] ring-1', f[c.key] ? 'bg-ink font-semibold text-white ring-ink' : 'ring-slate-200')}>
                <option value="">Semua</option>{(opsi[c.key] || []).map((o) => <option key={o} value={o}>{o}</option>)}
              </select></label>
          ))}
        </div>
        {cols.filter((c) => c.tanggal).map((c) => (
          <div key={c.key}><p className="text-[11px] font-bold uppercase text-ink-mute">{c.label}</p>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <input type="date" value={f[c.key]?.dari || ''} onChange={(e) => setV(c.key, { ...(f[c.key] || {}), dari: e.target.value })} aria-label={`${c.label} dari`} className="h-11 rounded-lg border-0 text-[13px] ring-1 ring-slate-200" />
              <input type="date" value={f[c.key]?.sampai || ''} onChange={(e) => setV(c.key, { ...(f[c.key] || {}), sampai: e.target.value })} aria-label={`${c.label} sampai`} className="h-11 rounded-lg border-0 text-[13px] ring-1 ring-slate-200" />
            </div></div>
        ))}
      </div>
    </Sheet>
  )
}

/** Nomor register sub project (yang sudah ada); terbit = sudah lewat tahap Nomor Registrasi. */
const regSub = (x) => (x?.data?.reg_numbers || []).filter(Boolean)
const regTerbit = (x) => regSub(x).length > 0 && x.stage !== 'registrasi'
/** Sel nomor register: nomor + salin; belum terbit → keterangan. */
function SelRegister({ x }) {
  const n = regSub(x)
  if (!n.length) return null
  if (!regTerbit(x)) return <span className="text-[11px] font-semibold text-amber-700" title={n.join(', ')}>⏳ menunggu terbit</span>
  return <span className="inline-flex items-center"><span className="font-mono text-[12px] font-bold text-emerald-800">{n[0]}</span>{n.length > 1 && <InfoHover inline isi={<div className="space-y-0.5 font-mono text-xs">{n.map((v) => <p key={v}>{v}</p>)}</div>}><span className="ml-1 rounded bg-emerald-50 px-1 text-[10px] font-bold text-emerald-700">+{n.length - 1}</span></InfoHover>}<Salin teks={n.join('\n')} label="Nomor register" /></span>
}
const jenisLayanan = (x) => SUB_TYPES[x.type]?.label || x.type || ''
const KOLOM_P = [
  { key: 'timestamp', label: 'Timestamp', sort: (r) => r.timestamp, tanggal: (r) => r.timestamp },
  { key: 'invoice', label: 'No. Invoice', sort: (r) => r.invoice },
  { key: 'pelanggan', label: 'Nama Pelanggan', sort: (r) => r.pelanggan.toLowerCase() },
  { key: 'prioritas', label: 'Prioritas', sort: (r) => r.prioRank, nilai: (r) => [r.prioritas] },
  { key: 'deadline', label: 'Deadline', sort: (r) => r.deadline || '9', tanggal: (r) => r.deadline },
  { key: 'status', label: 'Status', sort: (r) => r.status.toLowerCase(), nilai: (r) => r.subs.map((x) => subStatus(x, r.p)) },
  { key: 'cabang', label: 'Cabang', sort: (r) => r.cabang, nilai: (r) => [r.cabang] },
  { key: 'print', label: 'Print', sort: (r) => r.print, nilai: (r) => [r.print] },
  { key: 'cs', label: 'CS', sort: (r) => r.cs.toLowerCase(), nilai: (r) => [r.cs] },
  { key: 'arah', label: 'Arah Bahasa', sort: (r) => r.arahAll[0] || '', nilai: (r) => r.arahAll },
  { key: 'orang', label: 'Penerjemah/Vendor', sort: (r) => r.orangAll[0] || '', nilai: (r) => r.orangAll },
  { key: 'jmlDok', label: 'Dok', num: true, sort: (r) => r.jmlDok },
  { key: 'jmlHal', label: 'Hal', num: true, sort: (r) => r.jmlHal },
  { key: 'layanan', label: 'Detail Layanan', sort: (r) => r.layananAll[0] || '', nilai: (r) => r.subs.map(jenisLayanan) },  { key: 'register', label: 'No. Register', sort: (r) => regSub(r.subs.find((x) => regSub(x).length)).join(',') },
]

function KlasikProject({ jenis = 'projects' }) {
  const { user, data, nameOf, personaList, setActiveRole } = useApp()
  const [ajuBaru, setAjuBaru] = useState(false)
  const [baru, setBaru] = useState(false)
  // Penugasan lewat jabatan tersembunyi: proses harus atas nama persona (mis. Laila Fina)
  const personaTugas = jenis === 'k-penugasan' && !rolesOf(user).some((r) => PERAN_TUGAS.includes(r)) ? personaList.find((x) => PERAN_TUGAS.includes(x.role)) : null
  const saringTab = TAB_PROYEK.find((t) => t.key === jenis)?.saring
  const [cepat, setCepat] = useState('aktif')
  const [q, setQ] = useState('')
  const [buka, setBuka] = useState(null)
  const [lihat, setLihat] = useState(null)
  const [folder, setFolder] = useState(null) // ikon folder → file project langsung
  const [batas, setBatas] = useState(60)
  const semua = useMemo(() => scopeByBranch(user, data.projects || []).filter((p) => !p.cancelled && !p.demo_perf && (!saringTab || saringTab(p, user, data)))
    .map((p) => projectRow(p, nameOf)), [user, data, nameOf, saringTab])
  const n = {
    aktif: semua.filter((r) => r.status !== 'Selesai').length,
    terlambat: semua.filter((r) => r.terlambat).length,
    hariini: semua.filter((r) => r.dlHariIni && r.status !== 'Selesai').length,
    besok: semua.filter((r) => r.dlBesok && r.status !== 'Selesai').length,
  }
  const s = q.trim().toLowerCase()
  const dasar = useMemo(() => semua.filter((r) => (cepat === 'aktif' ? r.status !== 'Selesai' : cepat === 'terlambat' ? r.terlambat : cepat === 'hariini' ? r.dlHariIni && r.status !== 'Selesai' : cepat === 'besok' ? r.dlBesok && r.status !== 'Selesai' : cepat === 'selesai' ? r.status === 'Selesai' : true))
    .filter((r) => !s || [r.invoice, invoiceLabel(r.invoice), r.pelanggan, r.cs, ...r.layananAll, ...r.arahAll, ...r.orangAll, r.status].some((v) => String(v || '').toLowerCase().includes(s))), [semua, cepat, s])
  const tb = useTabel(dasar, KOLOM_P, { key: 'timestamp', dir: 'desc' }, 'p')
  const [geser, setGeser] = useState(false) // tabel digulir ke kanan → kolom No. Invoice dibekukan & diringkas
  const { hasil: rows, Judul, nAktif, reset } = tb
  const tampil = rows.slice(0, batas)
  const tabs = [['aktif', `Aktif ${n.aktif}`], ['terlambat', `Terlambat ${n.terlambat}`], ['hariini', `Hari ini ${n.hariini}`], ['besok', `Besok ${n.besok}`], ['selesai', 'Selesai'], ['semua', 'Semua']]
  const projLihat = lihat && (data.projects || []).find((x) => x.id === lihat)
  const formBaru = baru && <ProjectForm minimal onClose={() => setBaru(false)} onSaved={() => {}} />
  const lembarDetail = projLihat && (
    <Sheet open side onClose={() => setLihat(null)} title={invoiceLabel(projLihat.invoice_no)} subtitle={`${projLihat.customer?.name || ''} · ${projLihat.branch}`}>
      <div data-klasik-detail><DetailRingkas id={projLihat.id} onClose={() => setLihat(null)} /></div>
    </Sheet>
  )
  const hp = useHp()
  const [saring, setSaring] = useState(false)
  if (hp) return (
    <div className="min-w-0" data-klasik-hp>
      <div className="flex gap-1.5 overflow-x-auto px-3 pt-2.5 text-[12px] font-semibold">
        {[['aktif', `Aktif ${n.aktif}`], ['terlambat', `Telat ${n.terlambat}`], ['hariini', `Hari ini ${n.hariini}`], ['besok', `Besok ${n.besok}`], ['selesai', 'Selesai'], ['semua', 'Semua']].map(([k, l]) => <button key={k} type="button" onClick={() => setCepat(k)} aria-pressed={cepat === k} className={cx('min-h-[36px] shrink-0 whitespace-nowrap rounded-full px-3', cepat === k ? 'bg-ink text-white' : 'bg-white ring-1 ring-slate-200')}>{l}</button>)}
      </div>
      <div className="flex gap-2 px-3 py-2">
        <label className="relative block min-w-0 flex-1"><Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari invoice / pelanggan" aria-label="Cari project" className="h-11 w-full rounded-lg border-0 bg-white pl-9 pr-2 text-[14px] ring-1 ring-slate-200" /></label>
        <button type="button" onClick={() => setSaring(true)} className="flex h-11 shrink-0 items-center gap-1 rounded-lg bg-ink px-3 text-[13px] font-bold text-white" data-aksi="buka-saring">⚲ Saring{nAktif > 0 && <span className="rounded-full bg-white px-1.5 text-[10px] text-ink">{nAktif}</span>}</button>
      </div>
      <div className="divide-y divide-slate-200 bg-white text-[12.5px]">
        {tampil.map((r) => {
          const dipilih = buka === r.id
          const [tg, jm] = String(tanggalJam(r.timestamp) || '').split(/\s(?=\d{1,2}[.:]\d{2}$)/)
          const sisa = r.status !== 'Selesai' ? sisaWaktu(r.p) : null
          const x0 = r.subs[0]
          return (
            <div key={r.id}>
              <button type="button" onClick={() => setBuka(dipilih ? null : r.id)} aria-expanded={dipilih} className={cx('block w-full px-3 py-2.5 text-left', dipilih ? 'bg-[var(--klasik-pilih)]' : r.terlambat ? 'bg-rose-50' : '')} data-klasik-baris>
                <span className="flex items-center gap-2"><Lingkar warna={r.dibuatHariIni ? 'hijau' : ''} judul="Diinput hari ini"><span className="text-[11px] tabular-nums">{tg}</span></Lingkar><span className="text-[10px] text-ink-mute">{jm}</span><span className="ml-auto"><InvoiceNo project={r.p} /></span><span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); setLihat(r.id) }} aria-label="Lihat detail project" data-aksi="mata" className="grid h-8 w-8 place-items-center rounded-md text-ink-mute"><Eye className="h-4 w-4" /></span></span>
                <span className="mt-1 flex items-center gap-2"><b className="min-w-0 flex-1 truncate">{r.pelanggan || '—'}</b><Lingkar warna={r.status === 'Selesai' ? '' : r.dlHariIni ? 'merah' : r.dlBesok ? 'oranye' : ''} judul="Deadline"><span className="shrink-0 text-[12px] tabular-nums">{r.deadline ? tanggal(r.deadline) : '—'}</span></Lingkar></span>
                <span className="mt-0.5 flex items-center gap-1 text-[11.5px] text-ink-soft">
                  {r.prioritas !== 'Normal' && <span className="rounded bg-rose-50 px-1 font-semibold text-rose-700">{r.prioritas}</span>}
                  <span className="truncate"><span className="font-semibold text-brand">{x0 ? subStatus(x0, r.p) : r.status}</span>{r.subs.length > 1 ? ` · ${r.subs.length} sub` : x0 ? ` · ${x0.lang_from && x0.lang_to ? `${x0.lang_from} → ${x0.lang_to} · ` : ''}${subDok(x0)} dok · ${subHal(x0)} hal` : ''}</span>
                  <span className="ml-auto shrink-0 text-ink-mute">{sisa ? <span className={grupOf(r.p) === 'terlambat' ? 'font-semibold text-rose-600' : 'font-semibold text-orange-600'}>{sisa}</span> : r.cs}</span>
                </span>
              </button>
              {r.subs.some((x) => regSub(x).length) && (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 pb-2 text-[11px]" data-register-hp>
                  <span className="font-bold text-ink-mute">No. Register</span>
                  {r.subs.filter((x) => regSub(x).length).map((x) => <SelRegister key={x.id} x={x} />)}
                </div>
              )}
              {dipilih && <div onClick={(e) => e.stopPropagation()} className="[&_[data-klasik-proses]]:!w-full [&_[data-klasik-proses]]:!static"><ProsesInline p={(data.projects || []).find((x) => x.id === r.id) || r.p} /></div>}
            </div>
          )
        })}
        {!tampil.length && <p className="px-4 py-10 text-center text-ink-mute">Tidak ada project sesuai saringan.</p>}
      </div>
      {rows.length > batas && <button type="button" onClick={() => setBatas((b) => b + 60)} className="m-3 h-11 w-[calc(100%-24px)] rounded-xl bg-white font-semibold text-brand ring-1 ring-slate-200">Tampilkan lebih banyak ({rows.length - batas})</button>}
      {saring && <LembarSaring cols={KOLOM_P} {...tb} jumlah={rows.length} satuan="project" onClose={() => setSaring(false)} />}
      {lembarDetail}{formBaru}<LembarFile id={folder} onClose={() => setFolder(null)} />{ajuBaru && <RequestForm open side onClose={() => setAjuBaru(false)} onSaved={() => setAjuBaru(false)} />}
    </div>
  )
  const Tumpuk = ({ r, fn, cls }) => (
    <div className="space-y-1">{r.subs.map((x) => <div key={x.id} className={cx('h-[22px] truncate leading-[22px]', cls)}>{fn(x) || <span className="text-ink-mute">—</span>}</div>)}</div>
  )

  return (
    <div className="min-w-0">
      {personaTugas && (
        <div className="flex flex-wrap items-center gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900" data-banner-persona>
          <UserCheck className="h-4 w-4" aria-hidden="true" />Penugasan diproses sebagai <b>{personaTugas.name}</b>.
          <button type="button" onClick={() => setActiveRole(`as:${personaTugas.id}`)} data-aksi="pakai-persona" className="h-8 rounded-lg bg-amber-500 px-3 font-bold text-white hover:bg-amber-600">Beralih ke {personaTugas.name}</button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-[var(--klasik-latar)] px-3 py-2 text-[12.5px]" data-klasik-filter>
        <span className="flex shrink-0 gap-0.5 rounded-lg bg-white p-0.5 font-semibold ring-1 ring-slate-200" role="group" aria-label="Filter cepat">
          {tabs.map(([k, l]) => <button key={k} type="button" onClick={() => setCepat(k)} aria-pressed={cepat === k} className={cx('h-8 whitespace-nowrap rounded-md px-2.5', cepat === k ? 'bg-ink text-white' : 'text-ink-soft hover:bg-slate-50')}>{l}</button>)}
        </span>
        <label className="relative block w-[260px] shrink-0">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-mute" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari invoice, pelanggan, dokumen…" aria-label="Cari project" className="h-9 w-full rounded-lg border-0 bg-white pl-8 pr-2 text-[12.5px] ring-1 ring-slate-200 focus:ring-2 focus:ring-brand" />
        </label>
        {tb.adaLebar && <button type="button" onClick={tb.resetLebar} data-aksi="reset-lebar" className="text-[11px] font-semibold text-brand hover:underline">Lebar semula</button>}
        {nAktif > 0 && <button type="button" onClick={reset} className="flex h-9 items-center gap-1 rounded-lg px-2 font-semibold text-rose-600 hover:bg-rose-50" data-reset-saring><X className="h-3.5 w-3.5" />Hapus {nAktif} saringan</button>}
      </div>
      <div className="overflow-x-auto" onScroll={(e) => { const g = e.currentTarget.scrollLeft > 8; if (g !== geser) setGeser(g) }}>
        <tb.GayaLebar />
        <table className="w-full text-[12.5px]" data-klasik-tabel data-lebar="p" data-beku-invoice data-geser={geser ? '' : undefined}>
          <thead className="bg-slate-50 text-left text-[10.5px] uppercase tracking-wide text-ink-mute">
            <tr className="border-b border-slate-200">{KOLOM_P.map((c) => <Judul key={c.key} c={c} />)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tampil.map((r) => {
              const dipilih = buka === r.id
              const [tg, jm] = String(tanggalJam(r.timestamp) || '').split(/\s(?=\d{1,2}[.:]\d{2}$)/)
              const sisa = r.status !== 'Selesai' ? sisaWaktu(r.p) : null
              return [
                <tr key={r.id} onClick={() => setBuka(dipilih ? null : r.id)} {...bisaDitekan(() => setBuka(dipilih ? null : r.id))} aria-expanded={dipilih} className="cursor-pointer whitespace-nowrap align-top" data-pilih={dipilih ? '' : undefined} data-telat={r.terlambat ? '' : undefined} data-klasik-baris>
                  <td className="px-3 py-2 leading-tight"><Lingkar warna={r.dibuatHariIni ? 'hijau' : ''} judul="Diinput hari ini"><span className="text-xs tabular-nums">{tg}</span></Lingkar>{jm && <span className="mt-0.5 block text-[11px] tabular-nums text-ink-mute">{jm}</span>}</td>
                  <td className="px-3 py-2"><InfoHover inline isi={<InfoLayanan r={r} nameOf={nameOf} />}><Lingkar warna={r.prioMendesak && !r.p.about?.priority?.match(/sameday|super|ekspres|speed/i) ? 'hitam' : ''} judul={`Prioritas ${r.prioritas}`}><InvoiceNo project={r.p} /></Lingkar></InfoHover>{r.subs.length > 1 && <span data-sub-count className="ml-1 rounded bg-slate-200 px-1 text-[10px] font-semibold text-ink-soft">{r.subs.length} sub</span>}<IkonBaris id={r.id} inv={r.invoice} lihat={setLihat} folder={setFolder} /></td>
                  <td className="max-w-[170px] truncate px-3 py-2">{r.pelanggan || '—'}</td>
                  <td className="px-3 py-2"><span className={cx('inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold', r.prioritas === 'Normal' ? 'bg-slate-100 text-ink-soft' : 'bg-rose-50 text-rose-700 ring-1 ring-rose-200')}>{r.prioritas}</span></td>
                  <td className="px-3 py-2"><Lingkar warna={r.status === 'Selesai' ? '' : r.dlHariIni ? 'merah' : r.dlBesok ? 'oranye' : ''} judul={r.dlHariIni ? 'Deadline hari ini' : 'Deadline besok'}><span className="tabular-nums">{r.deadline ? tanggal(r.deadline) : '—'}</span></Lingkar>{sisa && <span className={cx('block text-[10.5px] font-bold', grupOf(r.p) === 'terlambat' ? 'text-rose-600' : 'text-orange-600')}>{sisa}</span>}</td>
                  <td className="px-3 py-2"><Tumpuk r={r} fn={(x) => <span className="text-xs font-semibold text-brand">{subStatus(x, r.p)}</span>} /></td>
                  <td className="px-3 py-2">{r.cabang}</td>
                  <td className="px-3 py-2">{r.print}</td>
                  <td className="px-3 py-2">{r.cs || '—'}</td>
                  <td className="px-3 py-2"><Tumpuk r={r} fn={(x) => (x.lang_from && x.lang_to ? `${x.lang_from} → ${x.lang_to}` : '')} /></td>
                  <td className="max-w-[170px] px-3 py-2"><Tumpuk r={r} fn={(x) => subOrang(x, nameOf)} /></td>
                  <td className="px-3 py-2 text-right tabular-nums"><Tumpuk r={r} fn={(x) => subDok(x) || ''} /></td>
                  <td className="px-3 py-2 text-right tabular-nums"><Tumpuk r={r} fn={(x) => subHal(x) || ''} /></td>
                  <td className="max-w-[240px] px-3 py-2"><InfoHover isi={<InfoLayanan r={r} nameOf={nameOf} />}><Tumpuk r={r} fn={(x) => x.title || x.type} cls="cursor-help underline decoration-dotted decoration-slate-300 underline-offset-2" /></InfoHover></td>
                  <td className="px-3 py-2"><Tumpuk r={r} fn={(x) => <SelRegister x={x} />} /></td>
                </tr>,
                dipilih && <tr key={`${r.id}-p`}><td colSpan={KOLOM_P.length} className="p-0" onClick={(e) => e.stopPropagation()}><ProsesInline p={(data.projects || []).find((x) => x.id === r.id) || r.p} /></td></tr>,
              ]
            })}
            {!tampil.length && <tr><td colSpan={KOLOM_P.length} className="px-5 py-12 text-center text-ink-mute">Tidak ada project sesuai saringan.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex items-center border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs text-ink-mute">
        <span>Menampilkan {tampil.length} dari {rows.length} project · klik baris untuk proses langsung · klik judul kolom untuk saring/urutkan</span>
        {rows.length > batas && <button type="button" onClick={() => setBatas((b) => b + 60)} className="ml-3 font-semibold text-brand">Tampilkan lebih banyak</button>}
        <span className="ml-auto">{n.terlambat} terlambat · {n.hariini} deadline hari ini</span>
      </div>
      {lembarDetail}{formBaru}<LembarFile id={folder} onClose={() => setFolder(null)} />{ajuBaru && <RequestForm open side onClose={() => setAjuBaru(false)} onSaved={() => setAjuBaru(false)} />}
    </div>
  )
}

// ------------------------------------------------------------
//  KEUANGAN — hanya pengajuan vendor + statusnya (1 tab)
// ------------------------------------------------------------
const STATUS_AJU = {
  draf: ['Belum diajukan', 'bg-slate-100 text-ink-soft'],
  menunggu: ['Menunggu ACC', 'bg-amber-100 text-amber-700'],
  disetujui: ['Siap Transfer', 'bg-sky-100 text-sky-700'],
  dibayar: ['Sudah dibayar', 'bg-emerald-100 text-emerald-700'],
  dikembalikan: ['Dikembalikan', 'bg-rose-100 text-rose-700'],
}
function statusPengajuan(sub, flow) {
  const i = stageIndex(flow, sub.stage)
  const iP = stageIndex(flow, 'persetujuan'); const iB = stageIndex(flow, 'pembayaran')
  if (sub.stage === DONE || i > iB) return 'dibayar'
  if (sub.stage === 'pembayaran') return 'disetujui'
  if (sub.stage === 'persetujuan') return 'menunggu'
  if (i < iP) return (sub.history || []).some((h) => h.rejected) ? 'dikembalikan' : 'draf'
  return 'draf'
}

const LABEL_REQ = { topup: 'Top Up Petty Cash', refund: 'Refund Pelanggan', lain: 'Pengajuan Lain' }
const STATUS_REQ = { menunggu: 'menunggu', disetujui: 'disetujui', dibayar: 'dibayar', ditolak: 'dikembalikan' }
STATUS_AJU.dikembalikan = ['Ditolak / dikembalikan', 'bg-rose-100 text-rose-700']
const fileSatu = (v) => (Array.isArray(v) ? v[0] : v) || null
const rekeningDari = (v, people, vendorId) => {
  const acc = v && typeof v === 'object' ? v : null
  if (acc) return { bank: acc.bank || '', number: acc.number || acc.no || '', holder: acc.holder || acc.name || '' }
  if (typeof v === 'string' && v) { const m = v.match(/^(\S+)\s+([\d\-\s]+)\s*(?:a\.?n\.?|—|-)?\s*(.*)$/i); return m ? { bank: m[1], number: m[2].trim(), holder: m[3] } : { bank: v, number: '', holder: '' } }
  const vd = (people || []).find((x) => x.id === vendorId)?.accounts?.[0]
  return vd ? { bank: vd.bank, number: vd.number, holder: vd.holder } : { bank: '', number: '', holder: '' }
}

function FileLink({ f, label }) {
  const { notify } = useApp()
  if (!f) return <span className="text-ink-mute">—</span>
  const buka = async (e) => { e.stopPropagation(); try { const url = (await drive.url?.(f)) ?? f.url; if (!url) throw new Error('File tidak tersedia di demo'); window.open(url, '_blank', 'noopener') } catch (er) { notify(er.message, 'err') } }
  return <button type="button" onClick={buka} title={f.name} className="max-w-[120px] truncate font-semibold text-brand underline">{label || f.name || 'Lihat'}</button>
}

const KOLOM_K = [
  { key: 'at', label: 'Timestamp', sort: (r) => r.at, tanggal: (r) => r.at },
  { key: 'invoice', label: 'No Invoice', sort: (r) => r.invoice, nilai: (r) => [r.invoice || '—'] },
  { key: 'status', label: 'Status', sort: (r) => r.st, nilai: (r) => [STATUS_AJU[r.st][0]] },
  { key: 'jenis', label: 'Jenis Transaksi', sort: (r) => r.jenis, nilai: (r) => [r.jenis] },
  { key: 'sumber', label: 'Sumber', sort: (r) => r.sumber, nilai: (r) => [r.sumber || '—'] },
  { key: 'pelanggan', label: 'Nama Pelanggan', sort: (r) => r.pelanggan, nilai: (r) => [r.pelanggan || '—'] },
  { key: 'total', label: 'Total Pembayaran', num: true, sort: (r) => r.total },
  { key: 'kantor', label: 'Kantor', sort: (r) => r.kantor, nilai: (r) => [r.kantor || '—'] },
  { key: 'cs', label: 'CS/Admin', sort: (r) => r.cs, nilai: (r) => [r.cs || '—'] },
  { key: 'penerima', label: 'Nama Penerima', sort: (r) => r.penerima, nilai: (r) => [r.penerima || '—'] },
  { key: 'bank', label: 'Bank Penerima', sort: (r) => r.rek.bank, nilai: (r) => [r.rek.bank || '—'] },
  { key: 'rek', label: 'No. Rekening' },
  { key: 'catatan', label: 'Catatan' },
  { key: 'nota', label: 'Nota/Tagihan', nilai: (r) => [r.nota ? 'Ada' : 'Belum ada'] },
  { key: 'bukti', label: 'Bukti Transfer', nilai: (r) => [r.bukti ? 'Ada' : 'Belum ada'] },
  { key: 'tglTf', label: 'Tanggal Transfer', sort: (r) => r.tglTf || '', tanggal: (r) => r.tglTf },
]

/** Ikon salin kecil di sel tabel Keuangan (untuk Akunting: tempel cepat ke m-banking). */
function Salin({ teks, label }) {
  const { notify } = useApp()
  if (!teks) return null
  return (
    <button type="button" aria-label={`Salin ${label}`} title={`Salin ${label}`} data-salin={label}
      onClick={async (e) => { e.stopPropagation(); const ok = await copyText(String(teks)); notify(ok ? `${label} disalin` : 'Gagal menyalin — salin manual', ok ? 'ok' : 'err') }}
      className="ml-1 inline-grid h-6 w-6 shrink-0 place-items-center rounded text-slate-400 align-middle hover:bg-brand-soft hover:text-brand">
      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  )
}

/** Aksi pengajuan umum langsung di tabel: ACC / tolak (Direktur) · bayar (Akunting). */
function ProsesRequest({ r }) {
  const { user, save, notify } = useApp()
  const [dana, setDana] = useState(r.sumber_dana || recommendFund(r.branch))
  const [alasan, setAlasan] = useState('')
  const [file, setFile] = useState(null)
  const [tgl, setTgl] = useState(new Date().toISOString().slice(0, 10))
  const [busy, setBusy] = useState(false)
  const hist = (action) => [...(r.history || []), { at: new Date().toISOString(), by: user.name, action }]
  const msg = (text, to) => save('notifications', { ...to, text: `Pengajuan ${LABEL_REQ[r.kind] || 'umum'} ${rupiah(r.amount)}: ${text}`, by: user.name, read_by: [] }).catch(() => {})
  const jalan = async (fn) => { setBusy(true); try { await fn() } catch (e) { notify(e.message, 'err') } finally { setBusy(false) } }
  const bolehAcc = can.approveVendor(user) && r.status === 'menunggu'
  const bolehBayar = ['superadmin', 'akunting'].includes(user.role) && r.status === 'disetujui'
  if (!bolehAcc && !bolehBayar) return <p className="mt-2 text-[12px] text-ink-mute">{r.status === 'menunggu' ? 'Menunggu ACC Direktur.' : r.status === 'disetujui' ? 'Menunggu transfer Akunting.' : r.status === 'ditolak' ? `Ditolak: ${r.rejected_reason || '—'}` : 'Selesai — sudah dibayar.'}</p>
  return (
    <div className="mt-3 flex flex-wrap items-end gap-2 rounded-xl bg-white p-3 ring-1 ring-slate-200 text-[12.5px]" data-klasik-req-proses>
      {bolehAcc && <>
        <label className="text-[11px] font-bold text-ink-soft">Sumber dana
          <select value={dana} onChange={(e) => setDana(e.target.value)} className="mt-1 block h-10 rounded-lg border-0 pr-8 text-[12.5px] ring-1 ring-slate-200">{SUMBER_DANA.map((d) => <option key={d.code} value={d.code}>{d.code} — {d.name.replace('PT ', '')}</option>)}</select></label>
        <button type="button" disabled={busy} onClick={() => jalan(async () => { await save('requests', { ...r, status: 'disetujui', sumber_dana: dana, approved_by: user.id, approved_name: user.name, approved_at: new Date().toISOString(), history: hist(`ACC · dana ${dana}`) }); await msg(`disetujui (dana ${dana}) — menunggu transfer`, { to_role: 'akunting' }); notify('Pengajuan disetujui') })} className="h-10 rounded-lg bg-emerald-600 px-4 font-bold text-white">✓ ACC</button>
        <input value={alasan} onChange={(e) => setAlasan(e.target.value)} placeholder="Alasan bila ditolak" className="h-10 w-[220px] rounded-lg border-0 text-[12.5px] ring-1 ring-slate-200" />
        <button type="button" disabled={busy || !alasan.trim()} onClick={() => jalan(async () => { await save('requests', { ...r, status: 'ditolak', rejected_reason: alasan, rejected_name: user.name, rejected_at: new Date().toISOString(), history: hist(`Ditolak: ${alasan}`) }); await msg(`ditolak — ${alasan}`, { to_user: r.requested_by }); notify('Pengajuan ditolak') })} className="h-10 rounded-lg px-4 font-semibold text-rose-600 ring-1 ring-rose-200 disabled:opacity-40">Tolak</button>
      </>}
      {bolehBayar && <>
        <label className="flex h-10 cursor-pointer items-center gap-1 rounded-lg px-3 font-semibold ring-1 ring-slate-300">⤒ {file ? file.name : 'Bukti transfer'}
          <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) jalan(async () => setFile(await drive.upload(f, { branch: r.branch, invoice: 'PENGAJUAN' }))) }} /></label>
        <input type="date" value={tgl} onChange={(e) => setTgl(e.target.value)} aria-label="Tanggal transfer" className="h-10 rounded-lg border-0 text-[12.5px] ring-1 ring-slate-200" />
        <button type="button" disabled={busy || !file} onClick={() => jalan(async () => {
          await save('requests', { ...r, status: 'dibayar', bukti_transfer: file, paid_date: tgl, paid_by: user.id, paid_name: user.name, paid_at: new Date().toISOString(), history: hist('Dibayar') })
          if (r.kind === 'topup') await save('petty_cash', { branch: r.fund || r.branch, type: 'in', amount: Number(r.amount), note: `Top up (pengajuan ${r.requested_name})${r.purpose ? ` — ${r.purpose}` : ''}`, project_id: null, request_id: r.id, by: user.name })
          await msg('sudah dibayar — bukti transfer tersedia', { to_user: r.requested_by, kind: 'payment' }); notify('Pengajuan dibayar')
        })} className="h-10 rounded-lg bg-ink px-4 font-bold text-white disabled:opacity-40">Tandai dibayar</button>
      </>}
    </div>
  )
}

function KlasikKeuangan() {
  const { user, data, nameOf } = useApp()
  const [ajuBaru, setAjuBaru] = useState(false)
  const [cepat, setCepat] = useState('semua')
  const [q, setQ] = useState('')
  const [buka, setBuka] = useState(null)
  const list = useMemo(() => {
    const vendor = scopeByBranch(user, data.projects || []).filter((p) => !p.cancelled && !p.demo_perf).flatMap((p) => (p.sub_projects || [])
      .filter((x) => !x.cancelled && isVendorFlow(flowOf(x, p)) && (x.data?.vendor || x.stage !== 'pengajuan'))
      .map((x) => {
        const flow = flowOf(x, p); const st = statusPengajuan(x, flow)
        const hist = (x.history || []).filter((h) => h.at)
        const aju = [...hist].reverse().find((h) => /persetujuan|diajukan|pengajuan/i.test(h.action || '') && !h.rejected)
        const vend = (data.people || []).find((v) => v.id === x.data?.vendor)
        const rek = rekeningDari(x.data?.rekening, data.people, x.data?.vendor)
        return { id: `${p.id}:${x.id}`, tipe: 'vendor', p, x, flow, st, hist, at: aju?.at || x.data?.submitted_at || p.created_at,
          invoice: invoiceLabel(p.invoice_no), jenis: `Vendor · ${x.type === 'terjemahan' ? 'Terjemahan' : SUB_TYPES[x.type]?.label || x.type}`, sumber: x.data?.sumber_dana || '',
          pelanggan: p.customer?.name || '', total: Number(x.data?.total_pengajuan || x.data?.vendor_cost || 0), kantor: p.branch,
          cs: String(x.data?.submitted_name || p.about?.cs_name || '').replace(/\s*\(.*\)\s*$/, ''), penerima: rek.holder || vend?.name || '', rek,
          catatan: [x.title, x.data?.vendor_service].filter(Boolean).join(' · '), nota: fileSatu(x.data?.tagihan_vendor), bukti: fileSatu(x.data?.bukti_transfer), tglTf: x.data?.paid_date || '' }
      }))
    const reqs = scopeRequests(user, data.requests || []).map((r) => {
      const pr = (data.projects || []).find((p) => p.id === r.project_id)
      const rek = rekeningDari(r.recipient)
      return { id: `r:${r.id}`, tipe: 'req', r, st: STATUS_REQ[r.status] || 'menunggu', hist: (r.history || []).filter((h) => h.at), at: r.created_at,
        invoice: pr ? invoiceLabel(pr.invoice_no) : '', jenis: LABEL_REQ[r.kind] || 'Pengajuan Lain', sumber: r.sumber_dana || '', pelanggan: pr?.customer?.name || '',
        total: Number(r.amount || 0), kantor: r.fund && r.fund !== r.branch ? `${r.branch} (${r.fund})` : r.branch, cs: String(r.requested_name || nameOf(r.requested_by) || '').replace(/\s*\(.*\)\s*$/, ''),
        penerima: rek.holder, rek, catatan: r.purpose || '', nota: fileSatu(r.attachment), bukti: fileSatu(r.bukti_transfer), tglTf: r.paid_date || '' }
    })
    return [...vendor, ...reqs]
  }, [user, data.projects, data.requests, data.people, nameOf])
  const n = (k) => list.filter((r) => r.st === k).length
  const s = q.trim().toLowerCase()
  const dasar = list.filter((r) => cepat === 'semua' || r.st === cepat)
    .filter((r) => !s || [r.invoice, r.jenis, r.pelanggan, r.penerima, r.catatan, r.cs, r.rek.bank, r.rek.number].some((v) => String(v || '').toLowerCase().includes(s)))
  const salin = ['akunting', 'superadmin'].includes(user?.role) // ikon salin untuk transfer
  const tb = useTabel(dasar, KOLOM_K, { key: 'at', dir: 'desc' }, 'k')
  const [geser, setGeser] = useState(false) // digulir ke kanan → No Invoice dibekukan & diringkas
  const { hasil: rows, Judul, nAktif, reset } = tb
  const hp = useHp()
  const [saring, setSaring] = useState(false)
  const tabs = [['semua', `Semua ${list.length}`], ['menunggu', `Menunggu ACC ${n('menunggu')}`], ['disetujui', `Siap Transfer ${n('disetujui')}`], ['dibayar', `Dibayar ${n('dibayar')}`], ['dikembalikan', `Ditolak ${n('dikembalikan')}`], ['draf', `Belum diajukan ${n('draf')}`]]
  const jam = (v) => (v ? new Date(v).toLocaleString('id-ID', { timeZone: 'Asia/Makassar', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '') : '—')
  const Detail = ({ r }) => (
    <div className="px-3 py-2.5 text-[12.5px]">
      <p className="text-[11.5px] text-ink-soft"><b className="text-ink-mute">Riwayat:</b> {r.hist.length ? r.hist.slice(-3).map((h, i) => <span key={i} className={cx(h.rejected && 'text-rose-700')}>{i ? ' → ' : ''}{jam(h.at)} {String(h.action || '').split(' · ')[0].split(' → ')[0]}</span>) : 'belum ada'}</p>
      {r.tipe === 'vendor'
        ? <div className="mt-2 rounded-lg bg-white ring-1 ring-slate-200 [&>div>div]:!px-3" data-klasik-aju-proses><BarisProses n="" p={(data.projects || []).find((pp) => pp.id === r.p.id) || r.p} x={((data.projects || []).find((pp) => pp.id === r.p.id) || r.p).sub_projects.find((xx) => xx.id === r.x.id) || r.x} /></div>
        : <ProsesRequest r={r.r} />}
    </div>
  )
  if (hp) return (
    <div className="min-w-0" data-klasik-hp>
      <div className="flex gap-1.5 overflow-x-auto px-3 py-2.5 text-[12px] font-semibold">
        {tabs.map(([k, l]) => <button key={k} type="button" onClick={() => setCepat(k)} aria-pressed={cepat === k} className={cx('min-h-[36px] shrink-0 whitespace-nowrap rounded-full px-3', cepat === k ? 'bg-ink text-white' : 'bg-white ring-1 ring-slate-200')}>{l}</button>)}
      </div>
      <div className="flex gap-2 px-3 pb-2">
        <label className="relative block min-w-0 flex-1"><Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari invoice / penerima" aria-label="Cari pengajuan" className="h-11 w-full rounded-lg border-0 bg-white pl-9 pr-2 text-[14px] ring-1 ring-slate-200" /></label>
        <button type="button" onClick={() => setSaring(true)} className="flex h-11 shrink-0 items-center gap-1 rounded-lg bg-ink px-3 text-[13px] font-bold text-white">⚲ Saring{nAktif > 0 && <span className="rounded-full bg-white px-1.5 text-[10px] text-ink">{nAktif}</span>}</button>
      </div>
      <div className="divide-y divide-slate-200 bg-white text-[12.5px]">
        {rows.map((r) => {
          const [lbl, cls] = STATUS_AJU[r.st]; const terbuka = buka === r.id
          return (
            <div key={r.id}>
              <button type="button" onClick={() => setBuka(terbuka ? null : r.id)} aria-expanded={terbuka} className={cx('block w-full px-3 py-2.5 text-left', terbuka && 'bg-[var(--klasik-pilih)]')} data-klasik-aju={r.st}>
                <span className="flex items-center gap-2"><span className={cx('rounded px-1.5 text-[10px] font-semibold', cls)}>{lbl}</span><span className="text-[10px] text-ink-mute">{jam(r.at)}</span><b className="ml-auto tabular-nums">{r.total ? rupiah(r.total) : '—'}</b></span>
                <span className="mt-1 flex"><b className="min-w-0 flex-1 truncate">{r.jenis}</b><span className="ml-2 shrink-0 text-ink-soft">{r.kantor} · {r.cs || '—'}</span></span>
                <span className="block truncate text-[11.5px] text-ink-soft">{[r.invoice, r.penerima, [r.rek.bank, r.rek.number].filter(Boolean).join(' '), r.sumber].filter(Boolean).join(' · ') || '—'}</span>
              </button>
              {terbuka && <div className="bg-[var(--klasik-detail)]" onClick={(e) => e.stopPropagation()}>
                <div className="flex flex-wrap gap-2 px-3 pt-2 text-[12px]"><span className="rounded-lg bg-white px-2 py-1.5 ring-1 ring-slate-200">Nota: <FileLink f={r.nota} label="Lihat" /></span><span className="rounded-lg bg-white px-2 py-1.5 ring-1 ring-slate-200">Bukti: <FileLink f={r.bukti} label="Lihat" /></span>{r.tglTf && <span className="rounded-lg bg-white px-2 py-1.5 ring-1 ring-slate-200">Transfer {String(r.tglTf).slice(0, 10)}</span>}{r.pelanggan && <span className="rounded-lg bg-white px-2 py-1.5 ring-1 ring-slate-200">{r.pelanggan}</span>}</div>
                {r.catatan && <p className="px-3 pt-1 text-[12px] text-ink-soft">{r.catatan}</p>}
                <Detail r={r} />
              </div>}
            </div>
          )
        })}
        {!rows.length && <p className="px-4 py-10 text-center text-ink-mute">Belum ada pengajuan sesuai saringan.</p>}
      </div>
      {saring && <LembarSaring cols={KOLOM_K} {...tb} jumlah={rows.length} satuan="pengajuan" onClose={() => setSaring(false)} />}
    </div>
  )
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-[var(--klasik-latar)] px-3 py-2 text-[12.5px]">
        <p className="font-bold text-ink">Pengajuan</p>
        <span className="flex flex-wrap gap-0.5 rounded-lg bg-white p-0.5 font-semibold ring-1 ring-slate-200" role="group" aria-label="Status pengajuan">
          {tabs.map(([k, l]) => <button key={k} type="button" onClick={() => setCepat(k)} aria-pressed={cepat === k} className={cx('h-8 whitespace-nowrap rounded-md px-2.5', cepat === k ? 'bg-ink text-white' : 'text-ink-soft hover:bg-slate-50')}>{l}</button>)}
        </span>
        <label className="relative block w-[240px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-mute" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari invoice, penerima, catatan…" aria-label="Cari pengajuan" className="h-9 w-full rounded-lg border-0 bg-white pl-8 pr-2 text-[12.5px] ring-1 ring-slate-200 focus:ring-2 focus:ring-brand" />
        </label>
        {nAktif > 0 && <button type="button" onClick={reset} className="flex h-9 items-center gap-1 rounded-lg px-2 font-semibold text-rose-600 hover:bg-rose-50"><X className="h-3.5 w-3.5" />Hapus {nAktif} saringan</button>}
        {tb.adaLebar && <button type="button" onClick={tb.resetLebar} data-aksi="reset-lebar" className="text-[11px] font-semibold text-brand hover:underline">Lebar semula</button>}
        {ajuBaru && <RequestForm open side onClose={() => setAjuBaru(false)} onSaved={() => setAjuBaru(false)} />}
      </div>
      <div className="overflow-x-auto" onScroll={(e) => { const g = e.currentTarget.scrollLeft > 8; if (g !== geser) setGeser(g) }}>
        <tb.GayaLebar />
        <table className="w-full text-[12.5px]" data-klasik-pengajuan data-lebar="k" data-beku-invoice data-geser={geser ? '' : undefined}>
          <thead className="bg-slate-50 text-left text-[10.5px] uppercase tracking-wide text-ink-mute"><tr className="border-b border-slate-200">{KOLOM_K.map((c) => <Judul key={c.key} c={c} />)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => {
              const [lbl, cls] = STATUS_AJU[r.st]; const terbuka = buka === r.id
              return [
                <tr key={r.id} onClick={() => setBuka(terbuka ? null : r.id)} {...bisaDitekan(() => setBuka(terbuka ? null : r.id))} className="cursor-pointer whitespace-nowrap" data-pilih={terbuka ? '' : undefined} data-klasik-aju={r.st}>
                  <td className="px-3 py-2 leading-tight">{(() => { const [tg, jm] = String(tanggalJam(r.at) || '').split(/\s(?=\d{1,2}[.:]\d{2}$)/); return r.at ? <><Lingkar warna={hariKey(r.at) === hariKey(new Date().toISOString()) ? 'hijau' : ''} judul="Diajukan hari ini"><span className="text-xs tabular-nums">{tg}</span></Lingkar>{jm && <span className="mt-0.5 block text-[11px] tabular-nums text-ink-mute">{jm}</span>}</> : '—' })()}</td>
                  <td className="px-3"><span className="inline-flex items-center"><InfoHover inline isi={<InfoPengajuan r={r} />}>{r.tipe === 'vendor' ? <InvoiceNo project={r.p} /> : <span className="font-bold">{r.invoice || '—'}</span>}</InfoHover>{salin && <Salin teks={r.invoice ? invoiceLabel(r.invoice) : ''} label="No invoice" />}</span></td>
                  <td className="px-3"><span className={cx('rounded px-2 py-0.5 text-[11px] font-semibold', cls)}>{lbl}</span></td>
                  <td className="px-3"><InfoHover isi={<InfoPengajuan r={r} />}><span className="cursor-help underline decoration-dotted decoration-slate-300 underline-offset-2">{r.jenis}</span></InfoHover></td>
                  <td className="px-3">{r.sumber || '—'}</td>
                  <td className="px-3"><span className="inline-flex max-w-[190px] items-center"><span className="truncate">{r.pelanggan || '—'}</span>{salin && <Salin teks={r.pelanggan} label="Nama pelanggan" />}</span></td>
                  <td className="px-3 text-right font-semibold tabular-nums">{r.total ? rupiah(r.total) : '—'}{salin && <Salin teks={r.total ? String(Math.round(r.total)) : ''} label="Nominal" />}</td>
                  <td className="px-3">{r.kantor || '—'}</td>
                  <td className="px-3">{r.cs || '—'}</td>
                  <td className="px-3"><span className="inline-flex max-w-[190px] items-center"><span className="truncate">{r.penerima || '—'}</span>{salin && <Salin teks={r.penerima} label="Nama penerima" />}</span></td>
                  <td className="px-3">{r.rek.bank || '—'}{salin && <Salin teks={r.rek.bank} label="Bank penerima" />}</td>
                  <td className="px-3 tabular-nums">{r.rek.number || '—'}{salin && <Salin teks={String(r.rek.number || '').replace(/[^0-9]/g, '')} label="No rekening" />}</td>
                  <td className="max-w-[220px] px-3 text-ink-soft">{r.catatan ? <InfoHover isi={<p className="whitespace-pre-wrap">{r.catatan}</p>}><span className="block cursor-help truncate">{r.catatan}</span></InfoHover> : '—'}</td>
                  <td className="px-3"><FileLink f={r.nota} label="Nota" /></td>
                  <td className="px-3"><FileLink f={r.bukti} label="Bukti" /></td>
                  <td className="px-3">{r.tglTf ? new Date(`${String(r.tglTf).slice(0, 10)}T12:00:00+08:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                </tr>,
                terbuka && (
                  <tr key={`${r.id}-d`} className="bg-[var(--klasik-detail)]"><td colSpan={KOLOM_K.length} className="p-0" onClick={(e) => e.stopPropagation()}>
                    <div className="sticky left-0 w-[calc(100vw-24px)] max-w-[1400px] px-4 py-3 text-[12.5px]">
                      <p className="text-[11.5px] text-ink-soft"><b className="text-ink-mute">Riwayat:</b> {r.hist.length ? r.hist.slice(-3).map((h, i) => <span key={i} className={cx(h.rejected && 'text-rose-700')}>{i ? ' → ' : ''}{jam(h.at)} {String(h.action || '').split(' · ')[0].split(' → ')[0]} ({String(h.by || '').replace(/\s*\(.*\)\s*$/, '')})</span>) : 'belum ada'}</p>
                      {r.tipe === 'vendor'
                        ? <div className="mt-2 rounded-lg bg-white ring-1 ring-slate-200 [&>div>div]:!px-3" data-klasik-aju-proses><BarisProses n="" p={(data.projects || []).find((pp) => pp.id === r.p.id) || r.p} x={((data.projects || []).find((pp) => pp.id === r.p.id) || r.p).sub_projects.find((xx) => xx.id === r.x.id) || r.x} /></div>
                        : <ProsesRequest r={r.r} />}
                    </div>
                  </td></tr>
                ),
              ]
            })}
            {!rows.length && <tr><td colSpan={KOLOM_K.length} className="px-5 py-12 text-center text-ink-mute">Belum ada pengajuan{cepat !== 'semua' || nAktif ? ' sesuai saringan' : ''}.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs text-ink-mute">{rows.length} pengajuan · biaya vendor & pengajuan umum. Harga proyek, pembayaran pelanggan &amp; omset tidak ditampilkan di Mode Klasik.</p>
    </div>
  )
}

/** Tombol "+ Project baru" & "+ Pengajuan" — tampil di semua tab Mode Klasik (header). */
function TombolBaru({ hp, setBaru, setAju }) {
  const { user } = useApp()
  const proj = can.editProject(user) && menuBoleh(user, 'projects')
  const aju = bolehAju(user) && menuBoleh(user, 'keuangan')
  if (!proj && !aju) return null
  if (hp) return (
    <div className="fixed bottom-5 right-4 z-30 flex items-center gap-2" data-tombol-baru>
      {aju && <button type="button" onClick={() => setAju(true)} data-aksi="pengajuan-baru" className="flex h-12 items-center gap-1 rounded-full bg-white px-4 text-[13px] font-bold text-ink shadow-xl ring-1 ring-slate-200"><Plus className="h-4 w-4" />Pengajuan</button>}
      {proj && <button type="button" onClick={() => setBaru(true)} aria-label="Project baru" data-aksi="project-baru" className="flex h-12 items-center gap-1 rounded-full bg-ink px-4 text-[13px] font-bold text-white shadow-xl"><Plus className="h-4 w-4" />Project</button>}
    </div>
  )
  return (
    <span className="flex items-center gap-1.5" data-tombol-baru>
      {aju && <button type="button" onClick={() => setAju(true)} data-aksi="pengajuan-baru" title="Pengajuan baru" aria-label="Pengajuan baru" className="flex h-9 items-center gap-1 whitespace-nowrap rounded-lg bg-white/10 px-3 text-[13px] font-bold text-white ring-1 ring-white/25 hover:bg-white/20"><Plus className="h-4 w-4" /><Wallet className="h-4 w-4 min-[1440px]:hidden" aria-hidden="true" /><span className="hidden min-[1440px]:inline">Pengajuan</span></button>}
      {proj && <button type="button" onClick={() => setBaru(true)} data-aksi="project-baru" className="flex h-9 items-center gap-1 whitespace-nowrap rounded-lg bg-white px-3 text-[13px] font-bold text-ink hover:bg-white/90"><Plus className="h-4 w-4" />Project<span className="hidden min-[1800px]:inline">&nbsp;baru</span></button>}
    </span>
  )
}

/** Ikon setelah No. Invoice: mata (detail ringkas) & folder (file project). */
export function IkonBaris({ id, inv, lihat, folder }) {
  const k = 'inline-grid h-7 w-7 place-items-center rounded-md align-middle text-ink-mute hover:bg-slate-200 hover:text-ink'
  return (
    <span className="ml-1 inline-flex items-center align-middle" data-ikon-baris>
      <button type="button" onClick={(e) => { e.stopPropagation(); lihat(id) }} title="Lihat detail project" aria-label={`Detail ${invoiceLabel(inv)}`} data-aksi="mata" className={k}><Eye className="h-4 w-4" /></button>
      <button type="button" onClick={(e) => { e.stopPropagation(); folder(id) }} title="File project" aria-label={`File ${invoiceLabel(inv)}`} data-aksi="folder" className={k}><FolderOpen className="h-4 w-4" /></button>
    </span>
  )
}
export function LembarFile({ id, onClose }) {
  const { data } = useApp()
  const p = id && (data.projects || []).find((x) => x.id === id)
  if (!p) return null
  return <Sheet open side onClose={onClose} title={`File · ${invoiceLabel(p.invoice_no)}`} subtitle={`${p.customer?.name || ''} · ${p.branch}`}><FileManager project={p} /></Sheet>
}

// ------------------------------------------------------------
//  DETAIL RINGKAS — panel dari kanan setelah klik ikon mata.
//  Hanya yang perlu dilihat cepat; detail lengkap lewat satu tombol.
// ------------------------------------------------------------
const waDigit = (t) => { const d = String(t || '').replace(/\D/g, ''); return d.startsWith('0') ? `62${d.slice(1)}` : d }
export function DetailRingkas({ id, onClose }) {
  const { data, nameOf } = useApp()
  const p = (data.projects || []).find((x) => x.id === id)
  if (!p) return <p className="p-6 text-sm text-ink-mute">Project tidak ditemukan.</p>
  const r = projectRow(p, nameOf)
  const subs = subsOf(p).filter((x) => !x.cancelled)
  const telp = p.customer?.phone || p.customer?.ship?.phone
  const sisa = sisaWaktu(p)
  return (
    <div className="space-y-4 text-[13px]" data-detail-ringkas>
      <div className="flex flex-wrap items-center gap-1.5">
        <Lingkar warna={r.status === 'Selesai' ? '' : r.dlHariIni ? 'merah' : r.dlBesok ? 'oranye' : ''} judul="Deadline"><span className="tabular-nums">⏰ {r.deadline ? tanggalJam(r.deadline) : 'tanpa deadline'}</span></Lingkar>
        {sisa && <span className={cx('text-[11.5px] font-semibold', /lewat/.test(sisa) ? 'text-rose-600' : 'text-orange-600')}>{sisa}</span>}
        <span className={cx('rounded-full px-2 py-0.5 text-[11px] font-semibold', PRIO_WARNA(r.prioritas))}>{r.prioritas}</span>
      </div>
      <dl className="grid grid-cols-[92px_1fr] gap-x-3 gap-y-1.5">
        <dt className="text-ink-mute">Pelanggan</dt><dd className="flex min-w-0 items-center gap-2 font-semibold"><span className="truncate">{r.pelanggan || '—'}</span>
          {telp && <a href={`https://wa.me/${waDigit(telp)}`} target="_blank" rel="noreferrer" className="shrink-0 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200">WA</a>}</dd>
        <dt className="text-ink-mute">Cabang</dt><dd>{p.branch}{r.print && r.print !== p.branch ? <span className="text-ink-mute"> · print di {r.print}</span> : ''}</dd>
        <dt className="text-ink-mute">CS</dt><dd>{r.cs || '—'}</dd>
        <dt className="text-ink-mute">Status</dt><dd className="font-semibold">{r.status}</dd>
      </dl>
      {p.about?.notes && <p className="whitespace-pre-wrap rounded-lg bg-amber-50 px-3 py-2 text-amber-900 ring-1 ring-amber-200">📝 {p.about.notes}</p>}
      <div>
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-mute">Dokumen ({subs.length})</p>
        <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
          {subs.map((x, i) => {
            const st = stagesOf(flowOf(x, p)); const idx = x.stage === DONE ? st.length : Math.max(0, st.findIndex((t) => t.key === x.stage))
            const pct = st.length ? Math.round((idx / st.length) * 100) : 0
            return (
              <li key={x.id} className="space-y-1.5 px-3 py-2.5">
                <div className="flex items-start gap-2">
                  <span className="w-4 shrink-0 pt-0.5 text-[11px] font-bold text-ink-mute">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-ink" title={x.title}>{x.title || '—'}</p>
                    <p className="truncate text-[11.5px] text-ink-mute">{SUB_TYPES[x.type]?.label || x.type}{x.lang_from && x.lang_to ? ` · ${x.lang_from} → ${x.lang_to}` : ''} · {subHal(x)} hlm{subOrang(x, nameOf) ? ` · ${subOrang(x, nameOf)}` : ''}</p>
                  </div>
                  <span className={cx('shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold', x.stage === DONE ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-50 text-ink')}>{subStatus(x, p)}</span>
                </div>
                <div className="ml-6 h-1 overflow-hidden rounded-full bg-slate-100" title={`Tahap ${Math.min(idx + 1, st.length)} dari ${st.length}`}><div className={cx('h-full rounded-full', x.stage === DONE ? 'bg-emerald-500' : 'bg-brand')} style={{ width: `${Math.max(pct, 4)}%` }} /></div>
                {x.stage !== DONE && <div className="ml-6"><BarisProses p={p} x={x} sel /></div>}
              </li>
            )
          })}
        </ul>
      </div>
      <div className="space-y-2 [&_[data-tab-detail]]:flex-wrap" data-tab-ringkas><TabDetailProject project={p} ringkas /></div>
      <button type="button" onClick={() => { onClose?.(); go(`projects/${p.id}`) }} data-aksi="detail-lengkap" className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl text-[13px] font-semibold text-ink-soft ring-1 ring-slate-200 hover:bg-slate-50 hover:text-ink">
        Buka detail lengkap <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  )
}

// ------------------------------------------------------------
//  APOSTILLE / LEGALISASI — satu baris = satu dokumen (tanpa dropdown).
//  Invoice/pelanggan/deadline ditulis sekali per project; aksi langsung di baris.
// ------------------------------------------------------------
const JENIS_AL = { apostille: ['APOSTILLE', 'bg-violet-100 text-violet-800'], legalisasi: ['LEGALISASI', 'bg-sky-100 text-sky-800'] }
const KOLOM_A = [
  { key: 'invoice', label: 'No. Invoice', sort: (d) => d.r.invoice, nilai: (d) => [d.r.invoice || '—'] },
  { key: 'pelanggan', label: 'Pelanggan', sort: (d) => d.r.pelanggan, nilai: (d) => [d.r.pelanggan || '—'] },
  { key: 'deadline', label: 'Deadline', sort: (d) => d.r.deadline || '9', tanggal: (d) => d.r.deadline },
  { key: 'dokumen', label: 'Dokumen', sort: (d) => d.x.title || '' },
  { key: 'jenis', label: 'Jenis', sort: (d) => d.x.type, nilai: (d) => [JENIS_AL[d.x.type]?.[0] || d.x.type] },
  { key: 'tujuan', label: 'Negara / Instansi', sort: (d) => d.tujuan, nilai: (d) => [d.tujuan || '—'] },
  { key: 'tahap', label: 'Tahap', sort: (d) => d.tahap, nilai: (d) => [d.tahap] },
  { key: 'aksi', label: 'Aksi' },
  { key: 'cabang', label: 'Cabang', sort: (d) => d.r.cabang || d.p.branch, nilai: (d) => [d.p.branch || '—'] },
]

function KlasikApostille() {
  const { user, data, nameOf } = useApp()
  const [cepat, setCepat] = useState('aktif')
  const [q, setQ] = useState('')
  const [lihat, setLihat] = useState(null)
  const [folder, setFolder] = useState(null) // ikon folder → file project langsung
  const semua = useMemo(() => {
    const orang = Object.fromEntries((data.people || []).map((x) => [x.id, x.name]))
    return scopeByBranch(user, data.projects || []).filter((p) => !p.cancelled && !p.demo_perf && tabApostille(p)).flatMap((p) => {
      const r = projectRow(p, nameOf)
      return subsOf(p).filter((x) => !x.cancelled && ['apostille', 'legalisasi'].includes(x.type))
        .map((x) => ({ id: `${p.id}:${x.id}`, p, x, r, tahap: subStatus(x, p), selesai: x.stage === DONE, tujuan: x.country || orang[x.institution] || x.institution || '' }))
    })
  }, [user, data.projects, data.people, nameOf])
  const n = {
    aktif: semua.filter((d) => !d.selesai).length,
    terlambat: semua.filter((d) => !d.selesai && d.r.terlambat).length,
    hariini: semua.filter((d) => !d.selesai && d.r.dlHariIni).length,
    besok: semua.filter((d) => !d.selesai && d.r.dlBesok).length,
  }
  const s = q.trim().toLowerCase()
  const dasar = useMemo(() => semua.filter((d) => (cepat === 'aktif' ? !d.selesai : cepat === 'terlambat' ? !d.selesai && d.r.terlambat : cepat === 'hariini' ? !d.selesai && d.r.dlHariIni : cepat === 'besok' ? !d.selesai && d.r.dlBesok : cepat === 'selesai' ? d.selesai : true))
    .filter((d) => !s || [d.r.invoice, invoiceLabel(d.r.invoice), d.r.pelanggan, d.x.title, d.tujuan, d.tahap].some((v) => String(v || '').toLowerCase().includes(s))), [semua, cepat, s])
  // urutan bawaan: project terbaru dulu, dokumen tetap berkelompok
  const tb = useTabel(dasar, KOLOM_A, { key: '', dir: 'desc' }, 'a')
  const [geser, setGeser] = useState(false)
  const { hasil: rows, Judul, nAktif, reset } = tb
  const tabs = [['aktif', `Aktif ${n.aktif}`], ['terlambat', `Terlambat ${n.terlambat}`], ['hariini', `Hari ini ${n.hariini}`], ['besok', `Besok ${n.besok}`], ['selesai', 'Selesai'], ['semua', 'Semua']]
  let grup = 0
  return (
    <div className="min-w-0" data-klasik-apostille>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-[var(--klasik-latar)] px-3 py-2">
        <span className="flex rounded-xl bg-white p-1 ring-1 ring-slate-200" role="group" aria-label="Filter cepat">
          {tabs.map(([k, l]) => <button key={k} type="button" onClick={() => setCepat(k)} aria-pressed={cepat === k} className={cx('min-h-[32px] whitespace-nowrap rounded-lg px-3 text-[12.5px] font-semibold', cepat === k ? 'bg-ink text-white' : 'text-ink-soft hover:text-ink')}>{l}</button>)}
        </span>
        <label className="relative min-w-[220px] flex-1 md:max-w-[320px]"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari invoice, pelanggan, dokumen…" aria-label="Cari" className="h-10 w-full rounded-xl border-0 bg-white pl-9 pr-3 text-[13px] ring-1 ring-slate-200 focus:ring-2 focus:ring-brand" /></label>
        {nAktif > 0 && <button type="button" onClick={reset} className="text-[11px] font-semibold text-rose-600 hover:underline">Hapus saringan ({nAktif})</button>}
        {tb.adaLebar && <button type="button" onClick={tb.resetLebar} data-aksi="reset-lebar" className="text-[11px] font-semibold text-brand hover:underline">Lebar semula</button>}
      </div>
      <div className="overflow-x-auto" onScroll={(e) => { const g = e.currentTarget.scrollLeft > 8; if (g !== geser) setGeser(g) }}>
        <tb.GayaLebar />
        <table className="w-full text-[12.5px]" data-klasik-tabel data-lebar="a" data-beku-pertama data-geser={geser ? '' : undefined}>
          <thead className="bg-slate-50 text-left text-[10.5px] uppercase tracking-wide text-ink-mute"><tr className="border-b border-slate-200">{KOLOM_A.map((c) => <Judul key={c.key} c={c} />)}</tr></thead>
          <tbody>
            {rows.map((d, i) => {
              const awal = i === 0 || rows[i - 1].p.id !== d.p.id
              if (awal) grup += 1
              const [jl, jc] = JENIS_AL[d.x.type] || [d.x.type, 'bg-slate-100 text-ink-soft']
              return (
                <tr key={d.id} data-klasik-dok data-awal={awal ? '' : undefined} data-zebra={grup % 2 === 0 ? '' : undefined} data-telat={d.r.terlambat && !d.selesai ? '' : undefined} className="whitespace-nowrap align-middle">
                  <td className="px-3 py-2">{awal && <span className="inline-flex items-center gap-1"><InfoHover inline isi={<InfoLayanan r={d.r} nameOf={nameOf} />}><InvoiceNo project={d.p} /></InfoHover>
                    <IkonBaris id={d.p.id} inv={d.r.invoice} lihat={setLihat} folder={setFolder} /></span>}</td>
                  <td className="max-w-[200px] truncate px-3">{awal ? (d.r.pelanggan || '—') : ''}</td>
                  <td className="px-3">{awal && <Lingkar warna={d.r.status === 'Selesai' ? '' : d.r.dlHariIni ? 'merah' : d.r.dlBesok ? 'oranye' : ''} judul="Deadline"><span className="tabular-nums">{d.r.deadline ? tanggal(d.r.deadline) : '—'}</span></Lingkar>}</td>
                  <td className="max-w-[240px] truncate px-3 font-bold text-ink" title={d.x.title}>{d.x.title || '—'}</td>
                  <td className="px-3"><span className={cx('rounded px-1.5 py-0.5 text-[10.5px] font-extrabold', jc)}>{jl}</span></td>
                  <td className="max-w-[180px] truncate px-3">{d.tujuan || '—'}</td>
                  <td className="px-3"><span className={cx('rounded-md px-2 py-0.5 text-[11.5px] font-bold', d.selesai ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-50 text-ink')}>{d.tahap}</span></td>
                  <td className="px-3 py-1.5"><BarisProses p={d.p} x={d.x} sel /></td>
                  <td className="px-3">{awal ? d.p.branch : ''}</td>
                </tr>
              )
            })}
            {!rows.length && <tr><td colSpan={KOLOM_A.length} className="px-5 py-12 text-center text-ink-mute">Tidak ada dokumen apostille / legalisasi{cepat !== 'semua' || nAktif || s ? ' sesuai saringan' : ''}.</td></tr>}
          </tbody>
        </table>
      </div>
      <Sheet open={!!lihat} onClose={() => setLihat(null)} title={invoiceLabel((data.projects || []).find((x) => x.id === lihat)?.invoice_no || 'Detail project')} side>{lihat && <DetailRingkas id={lihat} onClose={() => setLihat(null)} />}</Sheet>
      <LembarFile id={folder} onClose={() => setFolder(null)} />
    </div>
  )
}

// ------------------------------------------------------------
//  PENUGASAN — dokumen yang perlu penerjemah (tugas Supervisor).
//  Satu baris = satu dokumen; pilih penerjemah (tanpa rekomendasi; kuota
//  sisa kapasitas) lalu Tugaskan langsung di baris.
// ------------------------------------------------------------
const hlmDok = (x, p) => { const f = flowOf(x, p); const k = kindPages(x); return f === 'tr_nt' ? (Number(x.pages) || 1) : ((k.reguler || 0) + (k.non_reguler || 0)) || (Number(x.pages) || 1) }
const perluPenerjemah = (x) => x.type === 'terjemahan' && ((x.flow === 'tr_int' && x.stage === 'pilih_penerjemah') || (x.flow === 'tr_ext' && x.stage === 'pengajuan' && !x.data?.vendor && !x.data?.coordinator))
const KOLOM_T = [
  { key: 'invoice', label: 'No. Invoice', sort: (d) => d.r.invoice, nilai: (d) => [d.r.invoice || '—'] },
  { key: 'pelanggan', label: 'Pelanggan', sort: (d) => d.r.pelanggan },
  { key: 'deadline', label: 'Deadline', sort: (d) => d.r.deadline || '9', tanggal: (d) => d.r.deadline },
  { key: 'dokumen', label: 'Dokumen', sort: (d) => d.x.title || '' },
  { key: 'arah', label: 'Arah', sort: (d) => d.arah, nilai: (d) => [d.arah] },
  { key: 'hal', label: 'Hal', num: true, sort: (d) => d.hal },
  { key: 'cabang', label: 'Cabang', sort: (d) => d.p.branch, nilai: (d) => [d.p.branch || '—'] },
  { key: 'tugas', label: 'Penerjemah' },
]

function KlasikPenugasan() {
  const { user, data, nameOf, assignTranslator, notify, personaList, setActiveRole } = useApp()
  const [cepat, setCepat] = useState('semua')
  const [q, setQ] = useState('')
  const [pilihan, setPilihan] = useState({})
  const [sibuk, setSibuk] = useState({})
  const [lihat, setLihat] = useState(null)
  const [folder, setFolder] = useState(null) // ikon folder → file project langsung
  const [tglKuota, setTglKuota] = useState('') // klik tanggal deadline → kuota penerjemah di tanggal itu
  const personaTugas = !rolesOf(user).some((r) => PERAN_TUGAS.includes(r)) ? personaList.find((x) => PERAN_TUGAS.includes(x.role)) : null
  // beban penerjemah: halaman yang sedang dikerjakan (atau yang deadline-nya di tanggal terpilih) vs kapasitas harian
  const tim = useMemo(() => {
    const pakai = {}
    for (const p of data.projects || []) for (const x of p.sub_projects || []) if (x.data?.translator && x.stage === 'penerjemahan' && (!tglKuota || hariKey(p.about?.deadline) === tglKuota)) pakai[x.data.translator] = (pakai[x.data.translator] || 0) + hlmDok(x, p)
    return (data.users || []).filter((u) => u.role === 'penerjemah' && u.active !== false)
      .map((u) => { const kap = kapasitasHarian(u, data.kapasitas); return { u, kap, pakai: pakai[u.id] || 0, sisa: kap - (pakai[u.id] || 0) } })
      .sort((a, b) => b.sisa - a.sisa)
  }, [data.projects, data.users, data.kapasitas, tglKuota])
  const semua = useMemo(() => scopeByBranch(user, data.projects || []).filter((p) => !p.cancelled && !p.demo_perf).flatMap((p) => {
    const r = projectRow(p, nameOf)
    return subsOf(p).filter((x) => !x.cancelled && perluPenerjemah(x)).map((x) => ({ id: `${p.id}:${x.id}`, p, x, r, hal: hlmDok(x, p), arah: `${x.lang_from || '?'} → ${x.lang_to || '?'}` }))
  }), [user, data.projects, nameOf])
  // Koordinator bahasa (bila ada) ikut jadi pilihan; tanpa rekomendasi otomatis
  const koordOf = (d) => coordinatorFor(data.users || [], foreignLang(d.x))
  const n = { semua: semua.length, terlambat: semua.filter((d) => d.r.terlambat).length, hariini: semua.filter((d) => d.r.dlHariIni).length, besok: semua.filter((d) => d.r.dlBesok).length }
  const s = q.trim().toLowerCase()
  const dasar = useMemo(() => semua.filter((d) => (cepat === 'terlambat' ? d.r.terlambat : cepat === 'hariini' ? d.r.dlHariIni : cepat === 'besok' ? d.r.dlBesok : true))
    .filter((d) => !s || [d.r.invoice, invoiceLabel(d.r.invoice), d.r.pelanggan, d.x.title, d.arah].some((v) => String(v || '').toLowerCase().includes(s))), [semua, cepat, s])
  const tb = useTabel(dasar, KOLOM_T, { key: 'deadline', dir: 'asc' }, 't')
  const [geser, setGeser] = useState(false)
  const { hasil: rows, Judul } = tb
  // koordinator bahasa (Emma/Debby) → diserahkan ke koordinator; selain itu penerjemah internal
  const jenisTugas = (id) => ((data.users || []).find((u) => u.id === id)?.coordinator_lang ? 'coord' : 'internal')
  const tugaskan = async (d, id) => {
    if (!id) return notify('Pilih penerjemah dulu', 'err')
    setSibuk((m) => ({ ...m, [d.id]: true }))
    try {
      await assignTranslator(d.p, d.x.id, { kind: jenisTugas(id), id, service: null })
      notify(`${invoiceLabel(d.r.invoice)} · ${d.x.title} → ${(data.users || []).find((u) => u.id === id)?.name || ''}`)
    } catch (e) { notify(e.message, 'err') }
    setSibuk((m) => ({ ...m, [d.id]: false }))
  }
  const tugaskanSemua = async () => {
    let ok = 0
    for (const d of rows) { const sr = pilihan[d.id]; if (!sr) continue; try { await assignTranslator(d.p, d.x.id, { kind: jenisTugas(sr), id: sr, service: null }); ok++ } catch { /* lanjut */ } }
    notify(`${ok} dokumen ditugaskan`)
  }
  const tabs = [['semua', `Perlu penerjemah ${n.semua}`], ['terlambat', `Terlambat ${n.terlambat}`], ['hariini', `Hari ini ${n.hariini}`], ['besok', `Besok ${n.besok}`]]
  let grup = 0
  return (
    <div className="min-w-0" data-klasik-penugasan>
      {personaTugas && (
        <div className="flex flex-wrap items-center gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900" data-banner-persona>
          <UserCheck className="h-4 w-4" aria-hidden="true" />Penugasan diproses sebagai <b>{personaTugas.name}</b>.
          <button type="button" onClick={() => setActiveRole(`as:${personaTugas.id}`)} data-aksi="pakai-persona" className="h-8 rounded-lg bg-amber-500 px-3 font-bold text-white hover:bg-amber-600">Beralih ke {personaTugas.name}</button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-[var(--klasik-latar)] px-3 py-2">
        <span className="flex rounded-xl bg-white p-1 ring-1 ring-slate-200" role="group" aria-label="Filter cepat">
          {tabs.map(([k, l]) => <button key={k} type="button" onClick={() => setCepat(k)} aria-pressed={cepat === k} className={cx('min-h-[32px] whitespace-nowrap rounded-lg px-3 text-[12.5px] font-semibold', cepat === k ? 'bg-ink text-white' : 'text-ink-soft hover:text-ink')}>{l}</button>)}
        </span>
        <label className="relative min-w-[220px] flex-1 md:max-w-[320px]"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari invoice, pelanggan, dokumen…" aria-label="Cari" className="h-10 w-full rounded-xl border-0 bg-white pl-9 pr-3 text-[13px] ring-1 ring-slate-200 focus:ring-2 focus:ring-brand" /></label>
        {tb.adaLebar && <button type="button" onClick={tb.resetLebar} data-aksi="reset-lebar" className="text-[11px] font-semibold text-brand hover:underline">Lebar semula</button>}
        {!personaTugas && rows.some((d) => pilihan[d.id]) && <button type="button" onClick={tugaskanSemua} data-aksi="tugaskan-semua" className="ml-auto h-10 rounded-xl bg-emerald-600 px-4 text-[13px] font-bold text-white hover:bg-emerald-700">Tugaskan yang sudah dipilih ({rows.filter((d) => pilihan[d.id]).length})</button>}
      </div>
      {/* ringkasan kapasitas penerjemah */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-100 bg-white px-3 py-2 [scrollbar-width:none]" data-kapasitas-ringkas>
        <span className={cx('inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11.5px] font-bold', tglKuota ? 'bg-indigo-50 text-ink ring-1 ring-indigo-200' : 'text-ink-mute')} data-kuota-tanggal>
          {tglKuota ? <>Kuota {tanggal(`${tglKuota}T12:00:00+08:00`)}<button type="button" onClick={() => setTglKuota('')} aria-label="Kembali ke kuota saat ini" className="ml-1 grid h-5 w-5 place-items-center rounded hover:bg-indigo-100"><X className="h-3 w-3" /></button></> : 'Kuota saat ini'}
        </span>
        {tim.map((t) => (
          <span key={t.u.id} className={cx('inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ring-1', t.sisa <= 0 ? 'bg-rose-50 text-rose-700 ring-rose-200' : t.sisa < t.kap * 0.3 ? 'bg-amber-50 text-amber-800 ring-amber-200' : 'bg-emerald-50 text-emerald-800 ring-emerald-200')}>
            {String(t.u.name).replace(/\s*\(.*\)\s*$/, '')}<span className="tabular-nums opacity-75">{Math.max(0, t.sisa)}/{t.kap} hlm</span>
          </span>
        ))}
      </div>
      <div className="overflow-x-auto" onScroll={(e) => { const g = e.currentTarget.scrollLeft > 8; if (g !== geser) setGeser(g) }}>
        <tb.GayaLebar />
        <table className="w-full text-[12.5px]" data-klasik-tabel data-lebar="t" data-beku-pertama data-geser={geser ? '' : undefined}>
          <thead className="bg-slate-50 text-left text-[10.5px] uppercase tracking-wide text-ink-mute"><tr className="border-b border-slate-200">{KOLOM_T.map((c) => <Judul key={c.key} c={c} />)}</tr></thead>
          <tbody>
            {rows.map((d, i) => {
              const awal = i === 0 || rows[i - 1].p.id !== d.p.id
              if (awal) grup += 1
              const koord = koordOf(d)
              const nilai = pilihan[d.id] ?? ''
              return (
                <tr key={d.id} data-klasik-dok data-awal={awal ? '' : undefined} data-zebra={grup % 2 === 0 ? '' : undefined} data-telat={d.r.terlambat ? '' : undefined} className="whitespace-nowrap align-middle">
                  <td className="px-3 py-2">{awal && <span className="inline-flex items-center gap-1"><InfoHover inline isi={<InfoLayanan r={d.r} nameOf={nameOf} />}><InvoiceNo project={d.p} /></InfoHover>
                    <IkonBaris id={d.p.id} inv={d.r.invoice} lihat={setLihat} folder={setFolder} /></span>}</td>
                  <td className="max-w-[200px] truncate px-3">{awal ? (d.r.pelanggan || '—') : ''}</td>
                  <td className="px-3">{awal && d.r.deadline && (
                    <button type="button" onClick={() => setTglKuota((t) => (t === hariKey(d.r.deadline) ? '' : hariKey(d.r.deadline)))} title="Lihat kuota penerjemah di tanggal ini" data-aksi="kuota-tanggal"
                      className={cx('rounded-full', tglKuota === hariKey(d.r.deadline) && 'ring-2 ring-brand ring-offset-1')}>
                      <Lingkar warna={d.r.dlHariIni ? 'merah' : d.r.dlBesok ? 'oranye' : ''} judul="Deadline"><span className="tabular-nums underline decoration-dotted underline-offset-2">{tanggal(d.r.deadline)}</span></Lingkar>
                    </button>)}</td>
                  <td className="max-w-[240px] truncate px-3 font-bold text-ink" title={d.x.title}>{d.x.title || '—'}</td>
                  <td className="px-3">{d.arah}</td>
                  <td className="px-3 text-right tabular-nums">{d.hal}</td>
                  <td className="px-3">{awal ? d.p.branch : ''}</td>
                  <td className="px-3 py-1.5">
                    {personaTugas ? <span className="text-[11.5px] text-ink-mute">🔒 beralih ke {personaTugas.name} untuk menugaskan</span> : (
                      <span className="flex items-center gap-2">
                        <select value={nilai} onChange={(e) => setPilihan((m) => ({ ...m, [d.id]: e.target.value }))} aria-label={`Penerjemah untuk ${d.x.title}`} className={cx(kotak, 'max-w-[230px] pr-7')} data-pilih-penerjemah>
                          <option value="">Pilih penerjemah ▾</option>
                          {koord && <option value={koord.id}>{String(koord.name).replace(/\s*\(.*\)\s*$/, '')} · koordinator {koord.coordinator_lang}</option>}
                          {tim.map((t) => <option key={t.u.id} value={t.u.id}>{String(t.u.name).replace(/\s*\(.*\)\s*$/, '')} · sisa {Math.max(0, t.sisa)} hlm</option>)}
                        </select>
                        <button type="button" onClick={() => tugaskan(d, nilai)} disabled={sibuk[d.id] || !nilai} data-aksi="tugaskan" className="h-9 rounded-lg bg-ink px-3.5 font-bold text-white disabled:opacity-40">{sibuk[d.id] ? 'Menyimpan…' : 'Tugaskan →'}</button>
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
            {!rows.length && <tr><td colSpan={KOLOM_T.length} className="px-5 py-12 text-center text-ink-mute">Tidak ada dokumen yang menunggu penerjemah{cepat !== 'semua' || s ? ' sesuai saringan' : ''}. 🎉</td></tr>}
          </tbody>
        </table>
      </div>
      <Sheet open={!!lihat} onClose={() => setLihat(null)} title={invoiceLabel((data.projects || []).find((x) => x.id === lihat)?.invoice_no || 'Detail project')} side>{lihat && <DetailRingkas id={lihat} onClose={() => setLihat(null)} />}</Sheet>
      <LembarFile id={folder} onClose={() => setFolder(null)} />
    </div>
  )
}

// ------------------------------------------------------------
//  TAB PROJECT KLASIK — semua memakai tabel Project yang sama persis
//  (kolom, saringan, lebar kolom, warna). Tab tambahan muncul sesuai
//  tugas tambahan orangnya; Superadmin & Direktur melihat semua.
// ------------------------------------------------------------
const PERAN_TUGAS = ['superadmin', 'supervisor', 'direktur']
const PEMERIKSA_K = (u) => rolesOf(u).some((r) => ['superadmin', 'direktur'].includes(r))
const subsOf = (p) => p.sub_projects || []
const tabKoordinator = (p, u, d) => subsOf(p).some((x) => PEMERIKSA_K(u)
  ? !!(x.data?.coordinator || (x.type === 'terjemahan' && coordinatorFor(d.users || [], foreignLang(x))))
  : diKoordinasi(u, x) || (!!u.coordinator_lang && x.type === 'terjemahan' && foreignLang(x) === u.coordinator_lang))
const tabApostille = (p) => subsOf(p).some((x) => ['apostille', 'legalisasi'].includes(x.type))
const tabPenugasan = (p) => subsOf(p).some((x) => x.type === 'terjemahan' && ((x.flow === 'tr_int' && x.stage === 'pilih_penerjemah') || (x.flow === 'tr_ext' && x.stage === 'pengajuan' && !x.data?.vendor && !x.data?.coordinator)))
const tabTitip = (p, u) => { const loc = p.about?.print_location; if (!loc || loc === p.branch) return false; if (PEMERIKSA_K(u)) return true; const b = branchesOf(u); return b.includes(loc) || b.includes(p.branch) }
export const TAB_PROYEK = [
  { key: 'projects', label: 'Project', ikon: FolderOpen },
  { key: 'k-koordinator', label: 'Koordinator', ikon: Languages, saring: tabKoordinator, boleh: (u) => PEMERIKSA_K(u) || !!u.coordinator_lang || vendorKoordinator(u).length > 0 },
  { key: 'k-apostille', label: 'Apostille/Legalisasi', ikon: Stamp, saring: tabApostille, boleh: (u) => canSeeApostille(u) },
  { key: 'k-penugasan', label: 'Penugasan', ikon: UserCheck, saring: tabPenugasan, boleh: (u, d, persona = []) => rolesOf(u).some((r) => PERAN_TUGAS.includes(r)) || persona.some((x) => PERAN_TUGAS.includes(x.role)) },
  { key: 'k-titip', label: 'Titip Print', ikon: Printer, saring: tabTitip, boleh: (u, d) => PEMERIKSA_K(u) || (d.projects || []).some((p) => tabTitip(p, u)) },
]
let tabTerakhir = 'projects' // untuk tombol "Kembali ke daftar" dari detail project

/** Avatar + menu akun (nama, peran, Keluar) di header Mode Klasik. */
function MenuAkun({ hp }) {
  const { user, data, signOut, ask, personaList, setActiveRole } = useApp()
  const [buka, setBuka] = useState(false)
  // Ganti peran / persona (jabatan tersembunyi) — sama seperti pemilih peran di Mode Baru
  const asli = user?._actor ? (data.users || []).find((u) => u.id === user._actor) || user : user
  const pilihan = user && !user._hantu ? [
    ...rolesOf(asli).map((r) => ({ v: r, l: `Peran: ${ROLES[r]?.label || r}` })),
    ...(personaList || []).map((x) => ({ v: `as:${x.id}`, l: `Sebagai: ${String(x.name).replace(/\s*\(.*\)\s*$/, '')}` })),
  ] : []
  const nilai = user?._actor ? `as:${user.id}` : user?.role
  const ref = useRef(null)
  useEffect(() => {
    if (!buka) return
    const tutup = (e) => { if (!ref.current?.contains(e.target)) setBuka(false) }
    const esc = (e) => e.key === 'Escape' && setBuka(false)
    document.addEventListener('mousedown', tutup); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', tutup); document.removeEventListener('keydown', esc) }
  }, [buka])
  const nama = String(user?.name || '').replace(/\s*\(.*\)\s*$/, '')
  const keluar = async () => { setBuka(false); if (await ask('Keluar dari ATLAS?')) signOut() }
  return (
    <span ref={ref} className="relative shrink-0">
      <button type="button" onClick={() => setBuka((b) => !b)} aria-expanded={buka} aria-haspopup="menu" aria-label="Menu akun" data-aksi="menu-akun"
        className="flex min-h-[40px] items-center gap-2 rounded-lg px-1 text-sm hover:bg-white/10">
        <Avatar user={user} size={hp ? 30 : 32} ring={false} />
        {!hp && <span className="hidden leading-tight 2xl:block"><b>{nama}</b></span>}
      </button>
      {buka && (
        <div role="menu" className="absolute right-0 top-[calc(100%+6px)] z-50 w-[272px] rounded-xl bg-white p-1.5 text-ink shadow-2xl ring-1 ring-slate-200">
          <div className="px-3 py-2">
            <p className="truncate text-sm font-bold">{nama}</p>
            <p className="truncate text-xs text-ink-mute">{ROLES[user?.role]?.label || user?.role}{user?.branch ? ` · ${user.branch}` : ''}</p>
          </div>
          {hp && bolehKlasik(user, data) && !kunciKlasik(user) && (
            <div className="mx-1.5 mb-1.5 flex items-center justify-between gap-2 rounded-lg py-1.5 pl-3 pr-1.5 text-white" style={{ background: 'var(--klasik-head, #0e1540)' }}>
              <span className="text-xs font-semibold text-white/80">Tampilan</span>
              <SaklarMode klasik selalu />
            </div>
          )}
          {pilihan.length > 1 && (
            <div className="border-y border-slate-100 py-1" data-ganti-peran-klasik>
              {pilihan.map((o) => (
                <button key={o.v} type="button" role="menuitemradio" aria-checked={nilai === o.v} onClick={() => { setBuka(false); if (nilai !== o.v) setActiveRole(o.v) }}
                  className={cx('flex min-h-[40px] w-full items-center gap-2 rounded-lg px-3 text-left text-[13px]', nilai === o.v ? 'bg-indigo-50 font-bold text-ink' : 'text-ink-soft hover:bg-slate-50', o.v.startsWith('as:') && nilai === o.v && 'bg-amber-50 text-amber-900')}>
                  <span className={cx('h-2 w-2 rounded-full', nilai === o.v ? (o.v.startsWith('as:') ? 'bg-amber-500' : 'bg-brand') : 'bg-slate-300')} />{o.l}
                </button>
              ))}
            </div>
          )}
          <TemaDiMenu />
          <button type="button" role="menuitem" onClick={keluar} data-aksi="keluar"
            className="flex min-h-[44px] w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50">
            <LogOut className="h-4 w-4" aria-hidden="true" />Keluar
          </button>
        </div>
      )}
    </span>
  )
}

// ------------------------------------------------------------
//  KERANGKA LAYAR
// ------------------------------------------------------------
/** Pilihan tampilan (HP/PC) & tema warna — di dalam menu akun. */
function TemaDiMenu() {
  const hp = useHp()
  const [t, setT] = useState(readTheme)
  const ubah = (patch) => { const n = { ...t, ...patch }; setT(n); simpanTema(n) }
  const pil = (on) => cx('flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-[12.5px] font-semibold', on ? 'bg-ink text-white' : 'bg-slate-100 text-ink-soft hover:bg-slate-200')
  return (
    <div className="space-y-2.5 border-t border-slate-100 px-2 py-2.5" data-tema-menu>
      <div>
        <p className="mb-1 px-1 text-[10.5px] font-bold uppercase tracking-wide text-ink-mute">Versi tampilan</p>
        <div className="flex gap-1.5">
          <button type="button" onClick={() => hp || tukarTampilan(false)} aria-pressed={hp} data-aksi="tampilan-hp" className={pil(hp)}><Smartphone className="h-4 w-4" />HP</button>
          <button type="button" onClick={() => !hp || tukarTampilan(true)} aria-pressed={!hp} data-aksi="tampilan-pc" className={pil(!hp)}><Monitor className="h-4 w-4" />PC</button>
        </div>
      </div>
      <div>
        <p className="mb-1 px-1 text-[10.5px] font-bold uppercase tracking-wide text-ink-mute">Tema</p>
        <div className="mb-2 flex gap-1.5">
          <button type="button" onClick={() => ubah({ mode: 'light' })} aria-pressed={t.mode !== 'dark'} className={pil(t.mode !== 'dark')}>Terang</button>
          <button type="button" onClick={() => ubah({ mode: 'dark' })} aria-pressed={t.mode === 'dark'} className={pil(t.mode === 'dark')}>Gelap</button>
        </div>
        <div className="grid grid-cols-10 gap-1" role="group" aria-label="Warna aksen">
          {ACCENTS.map(([c, nama]) => (
            <button key={c} type="button" onClick={() => ubah({ accent: c })} title={nama} aria-label={nama} aria-pressed={t.accent === c}
              className={cx('h-5 w-5 rounded-full ring-offset-1', t.accent === c && 'ring-2 ring-ink')} style={{ background: c }} />
          ))}
        </div>
      </div>
    </div>
  )
}

/** Ikon tukar tampilan HP ⇄ PC (on/off). */
function TombolTampilan({ hp }) {
  const I = hp ? Monitor : Smartphone
  const label = hp ? 'Ganti ke tampilan PC' : 'Ganti ke tampilan HP'
  return (
    <button type="button" onClick={() => tukarTampilan(hp)} aria-label={label} title={label} data-aksi="tukar-tampilan"
      className={cx('grid shrink-0 place-items-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white', hp ? 'h-10 w-9' : 'h-11 w-11')}>
      <I className="h-[18px] w-[18px]" aria-hidden="true" />
    </button>
  )
}

/** Lingkaran merah jumlah (mis. yang baru / perlu ditindaklanjuti). */
const Lencana = ({ n, gelap }) => (n > 0 ? <span className={cx('absolute -top-2 left-2.5 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-none text-white ring-2', gelap ? 'ring-[var(--klasik-head,#0e1540)]' : 'ring-white dark:ring-[#141a2e]')} aria-label={`${n} perlu ditindaklanjuti`} data-lencana>{n > 99 ? '99+' : n}</span> : null)
const labelTab = (l) => (l === 'Apostille/Legalisasi' ? 'Apostille' : l)
/** Menu bawah Mode Klasik (HP & iPad): tab + tombol "+" di tengah. Tab yang tidak muat masuk "Lainnya". */
function NavBawah({ tabs, aktif, maks, onPlus, lencana = {} }) {
  const [lain, setLain] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!lain) return
    const tutup = (e) => { if (!ref.current?.contains(e.target)) setLain(false) }
    const esc = (e) => e.key === 'Escape' && setLain(false)
    document.addEventListener('pointerdown', tutup); document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', tutup); document.removeEventListener('keydown', esc) }
  }, [lain])
  // Yang selalu terlihat: Project & Keuangan, lalu tab yang sedang aktif, lalu sisanya sesuai urutan
  let tampil = tabs, sisa = []
  if (tabs.length > maks) {
    const prio = [...tabs].sort((a, b) => {
      const n = (t) => (t.key === 'projects' ? 0 : t.key === aktif ? 1 : t.key === 'keuangan' ? 2 : 3)
      return n(a) - n(b)
    })
    const pilih = new Set(prio.slice(0, maks - 1).map((t) => t.key))
    tampil = tabs.filter((t) => pilih.has(t.key)); sisa = tabs.filter((t) => !pilih.has(t.key))
  }
  const item = ({ key: k, label: l, ikon: I, judul }) => (
    <a key={k} href={`#/${k}`} title={judul || l} aria-current={aktif === k ? 'page' : undefined} data-tab-klasik
      className={cx('flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[10.5px] leading-none', aktif === k ? 'font-extrabold text-ink' : 'font-semibold text-slate-500')}>
      <span className={cx('grid h-7 w-12 place-items-center rounded-full', aktif === k && 'bg-[var(--klasik-pilih,#e6e9f5)]')}><span className="relative"><I className="h-[18px] w-[18px]" aria-hidden="true" /><Lencana n={lencana[k]} /></span></span>
      <span className="max-w-full truncate px-0.5">{labelTab(l)}</span>
    </a>
  )
  const semua = sisa.length ? [...tampil, { key: '__lain' }] : tampil
  const tengah = Math.ceil(semua.length / 2)
  const render = (t) => t.key !== '__lain' ? item(t) : (
    <span key="__lain" ref={ref} className="relative flex min-w-0 flex-1">
      <button type="button" onClick={() => setLain((b) => !b)} aria-expanded={lain} aria-haspopup="menu" data-aksi="tab-lainnya"
        className={cx('flex min-h-[52px] w-full flex-col items-center justify-center gap-1 text-[10.5px] font-semibold leading-none', lain ? 'text-ink' : 'text-slate-500')}>
        <span className={cx('grid h-7 w-12 place-items-center rounded-full', lain && 'bg-[var(--klasik-pilih,#e6e9f5)]')}><span className="relative"><MoreHorizontal className="h-[18px] w-[18px]" aria-hidden="true" /><Lencana n={sisa.reduce((t, x) => t + (lencana[x.key] || 0), 0)} /></span></span>Lainnya
      </button>
      {lain && (
        <div role="menu" className="absolute bottom-[calc(100%+10px)] right-0 z-50 w-52 rounded-xl bg-white p-1.5 text-ink shadow-2xl ring-1 ring-slate-200">
          {sisa.map(({ key: k, label: l, ikon: I }) => (
            <a key={k} role="menuitem" href={`#/${k}`} onClick={() => setLain(false)} className="flex min-h-[44px] items-center gap-2.5 rounded-lg px-3 text-sm font-semibold hover:bg-slate-50"><I className="h-4 w-4 text-ink-mute" aria-hidden="true" />{l}{lencana[k] > 0 && <span className="ml-auto rounded-full bg-rose-600 px-1.5 text-[11px] font-bold text-white">{lencana[k]}</span>}</a>
          ))}
        </div>
      )}
    </span>
  )
  return (
    <nav aria-label="Menu Mode Klasik" data-nav-bawah
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-1 pb-[max(6px,env(safe-area-inset-bottom))] pt-1 shadow-[0_-6px_18px_rgba(14,21,64,.06)] backdrop-blur dark:border-white/10 dark:bg-[#141a2e]/95">
      <div className="mx-auto flex max-w-[760px] items-end">
        {semua.slice(0, tengah).map(render)}
        {onPlus && (
          <button type="button" onClick={onPlus} aria-label="Buat baru: Project atau Pengajuan" data-aksi="plus-baru"
            className="mx-1 -mt-6 grid h-14 w-14 shrink-0 place-items-center self-center rounded-full border-4 border-white text-white shadow-[0_8px_20px_rgba(14,21,64,.35)] dark:border-[#141a2e]"
            style={{ background: 'var(--klasik-head, #0e1540)' }}>
            <Plus className="h-6 w-6" aria-hidden="true" />
          </button>
        )}
        {semua.slice(tengah).map(render)}
      </div>
    </nav>
  )
}

/** Lembar pilihan dari tombol "+": Project baru atau Pengajuan. */
function PilihBaru({ onClose, onProject, onAju }) {
  useEffect(() => { const esc = (e) => e.key === 'Escape' && onClose(); document.addEventListener('keydown', esc); return () => document.removeEventListener('keydown', esc) }, [onClose])
  return createPortal(
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Buat baru" data-pilih-baru>
      <button type="button" aria-label="Tutup" onClick={onClose} className="absolute inset-0 h-full w-full bg-[#0e1540]/45" />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-[560px] rounded-t-2xl bg-white px-4 pb-[max(18px,env(safe-area-inset-bottom))] pt-2.5 text-ink shadow-2xl dark:bg-[#141a2e] dark:text-white">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-300" />
        {onProject && (
          <button type="button" onClick={onProject} data-aksi="project-baru" className="mb-2 flex min-h-[64px] w-full items-center gap-3 rounded-2xl p-3 text-left ring-1 ring-slate-200 hover:bg-slate-50 dark:ring-white/15 dark:hover:bg-white/5">
            <span className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: 'var(--klasik-head, #0e1540)' }}><FolderOpen className="h-5 w-5" aria-hidden="true" /></span>
            <span><b className="block text-[15px]">Project baru</b><span className="text-xs text-ink-mute">Pelanggan, invoice, dokumen</span></span>
          </button>
        )}
        {onAju && (
          <button type="button" onClick={onAju} data-aksi="pengajuan-baru" className="flex min-h-[64px] w-full items-center gap-3 rounded-2xl p-3 text-left ring-1 ring-slate-200 hover:bg-slate-50 dark:ring-white/15 dark:hover:bg-white/5">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-amber-100 text-amber-800"><Wallet className="h-5 w-5" aria-hidden="true" /></span>
            <span><b className="block text-[15px]">Pengajuan</b><span className="text-xs text-ink-mute">Biaya, transfer, kas</span></span>
          </button>
        )}
      </div>
    </div>, document.body)
}

export function KlasikApp({ page, param, detail }) {
  const { user, data, personaList } = useApp()
  const tabs = [
    ...TAB_PROYEK.filter((t) => menuBoleh(user, 'projects') && (!t.boleh || t.boleh(user, data, personaList))),
    ...(menuBoleh(user, 'keuangan') ? [{ key: 'keuangan', label: 'Keuangan', ikon: Wallet }] : []),
    ...(canSeeRegister(user) && menuBoleh(user, 'register') ? [{ key: 'register', label: 'Register', ikon: Hash, judul: 'Nomor Register' }] : []),
  ]
  // Lingkaran merah di tab: jumlah yang perlu ditindaklanjuti
  const lencana = useMemo(() => {
    const ps = scopeByBranch(user, data.projects || []).filter((p) => !p.cancelled && !p.demo_perf)
    let tugas = 0, apos = 0, reg = 0
    for (const p of ps) for (const x of subsOf(p)) {
      if (x.cancelled) continue
      if (perluPenerjemah(x)) tugas++
      if (['apostille', 'legalisasi'].includes(x.type) && x.stage !== DONE && x.stage === stagesOf(flowOf(x, p))[0]?.key) apos++
      if (x.stage === 'registrasi' && (x.data?.reg_numbers || []).some(Boolean)) reg += x.data.reg_numbers.filter(Boolean).length
    }
    return { 'k-penugasan': tugas, 'k-apostille': apos, register: ['superadmin', 'supervisor', 'admin_pusat'].includes(user?.role) ? reg : 0 }
  }, [user, data.projects])
  const tab = page === 'pengajuan' ? 'keuangan' : tabs.some((t) => t.key === page) ? page : 'projects'
  if (!detail) tabTerakhir = tab
  const kembali = detail ? tabTerakhir : tab
  useEffect(() => { if (!['projects', 'pengajuan', ...tabs.map((t) => t.key)].includes(page)) go('projects') }, [page]) // eslint-disable-line react-hooks/exhaustive-deps
  const aktifTab = detail ? tabTerakhir : tab
  const [baru, setBaru] = useState(false)
  const [ajuBaru, setAjuBaru] = useState(false)
  const formBaruApp = <>{baru && <ProjectForm minimal onClose={() => setBaru(false)} onSaved={() => {}} />}{ajuBaru && <RequestForm open side onClose={() => setAjuBaru(false)} onSaved={() => setAjuBaru(false)} />}</>
  const isi = tab === 'register' ? <Suspense fallback={null}><RegisterPage /></Suspense> : tab === 'keuangan' ? <KlasikKeuangan /> : tab === 'k-apostille' ? <KlasikApostille /> : tab === 'k-penugasan' ? <KlasikPenugasan /> : <KlasikProject key={tab} jenis={tab} />
  const hp = useHp()
  const sentuh = useLayarSentuh()
  const paksaHp = usePaksaHp()
  const paksaPc = usePaksaPc()
  // Tampilan PC di HP: layar diperkecil seperti "situs desktop" agar seluruh lebar PC terlihat
  useEffect(() => {
    const m = document.querySelector('meta[name="viewport"]')
    if (!m) return
    const asli = m.getAttribute('content')
    if (paksaPc) { const k = Math.min(1, (window.screen?.width || 360) / 1280).toFixed(3); m.setAttribute('content', `width=1280, initial-scale=${k}, minimum-scale=${k}`) }
    return () => { m.setAttribute('content', asli) }
  }, [paksaPc])
  const [pilihBaru, setPilihBaru] = useState(false)
  const bolehProj = can.editProject(user) && menuBoleh(user, 'projects')
  const bolehPengajuan = bolehAju(user) && menuBoleh(user, 'keuangan')
  const plus = bolehProj && bolehPengajuan ? () => setPilihBaru(true) : bolehProj ? () => setBaru(true) : bolehPengajuan ? () => setAjuBaru(true) : null
  const bawah = (
    <>
      <NavBawah tabs={tabs} aktif={aktifTab} maks={hp ? 4 : 7} onPlus={plus} lencana={lencana} />
      {pilihBaru && <PilihBaru onClose={() => setPilihBaru(false)} onProject={bolehProj ? () => { setPilihBaru(false); setBaru(true) } : null} onAju={bolehPengajuan ? () => { setPilihBaru(false); setAjuBaru(true) } : null} />}
    </>
  )
  const gayaHead = { '--head-ink': '#fff', '--head-mute': 'rgba(255,255,255,.6)', '--head-hover': 'rgba(255,255,255,.1)', '--head-line': 'rgba(255,255,255,.2)', background: 'var(--klasik-head, #0e1540)' }
  if (hp) return (
    <div className="min-h-screen bg-[var(--klasik-latar)] pb-28" data-mode-klasik data-paksa-hp={paksaHp || undefined}>
      {formBaruApp}
      <header className="app-head sticky top-0 z-30 px-3 py-2 text-white" style={gayaHead}>
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white text-xs font-extrabold text-ink">A</span>
          <JamHp />
          <span data-headbtn className="ml-auto shrink-0"><NotificationBell /></span>
          <MenuAkun hp />
        </div>
      </header>
      <main className="min-w-0">
        {detail ? (
          <div className="px-3 py-3">
            <button type="button" onClick={() => go(kembali)} className="mb-3 flex min-h-[44px] items-center gap-1 rounded-lg bg-white px-3 text-sm font-semibold ring-1 ring-slate-200"><ArrowLeft className="h-4 w-4" />Kembali ke daftar</button>
            {detail}
          </div>
        ) : isi}
      </main>
      {bawah}
    </div>
  )
  if (sentuh) return (
    <div className="min-h-screen bg-[var(--klasik-latar)] pb-28" data-mode-klasik>
      {formBaruApp}
      <header className="app-head sticky top-0 z-30 flex h-14 items-center gap-3 px-4 text-white" style={gayaHead}>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-sm font-extrabold text-ink">A</span><span className="font-extrabold">ATLAS</span>
        <span className="ml-2"><JamHp /></span>
        <span className="ml-auto"><SaklarMode klasik selalu /></span>
        <span data-headbtn className="shrink-0"><NotificationBell /></span>
        <MenuAkun />
      </header>
      <main className="min-w-0">
        {detail ? (
          <div className="px-4 py-4">
            <button type="button" onClick={() => go(kembali)} className="mb-3 flex min-h-[44px] items-center gap-1 rounded-lg bg-white px-3 text-sm font-semibold ring-1 ring-slate-200"><ArrowLeft className="h-4 w-4" />Kembali ke daftar</button>
            {detail}
          </div>
        ) : <div className="bg-white">{isi}</div>}
      </main>
      {bawah}
    </div>
  )
  return (
    <div className="min-h-screen bg-[var(--klasik-latar)]" data-mode-klasik>
      {formBaruApp}
      {paksaPc && (
        <button type="button" onClick={() => tukarTampilan(false)} aria-label="Kembali ke tampilan HP" data-aksi="kembali-hp"
          className="fixed bottom-10 right-10 z-[80] flex h-[150px] items-center gap-5 rounded-full px-12 text-[44px] font-bold text-white shadow-2xl" style={{ background: 'var(--klasik-head, #0e1540)' }}>
          <Smartphone className="h-16 w-16" aria-hidden="true" />Tampilan HP
        </button>
      )}
      <header className="app-head sticky top-0 z-30 flex h-14 items-center gap-3 bg-ink px-5 text-white" style={gayaHead}>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-sm font-extrabold text-ink">A</span><span className="font-extrabold">ATLAS</span>
        <nav className="ml-3 flex h-14 items-end gap-1" aria-label="Menu Mode Klasik">
          {tabs.map(({ key: k, label: l, ikon: I, judul }) => (
            <a key={k} href={`#/${k}`} title={judul || l} aria-current={aktifTab === k ? 'page' : undefined} data-tab-klasik className={cx('flex h-12 shrink-0 items-center justify-center whitespace-nowrap rounded-t-lg text-sm', aktifTab === k ? 'min-w-[116px] gap-1.5 px-3' : cx(tabs.length > 6 ? 'w-[60px]' : 'w-[84px]', 'flex-col gap-1'), aktifTab === k ? 'bg-[var(--klasik-latar)] font-bold text-ink' : 'font-semibold text-white/70 hover:text-white')}><span className="relative"><I className="h-4 w-4" aria-hidden="true" />{aktifTab !== k && <Lencana gelap n={lencana[k]} />}</span>{aktifTab === k ? <>{l === 'Apostille/Legalisasi' ? 'Apostille' : l}{lencana[k] > 0 && <span className="rounded-full bg-rose-600 px-1.5 text-[10px] font-bold text-white">{lencana[k]}</span>}</> : <span className="block text-[9.5px] font-semibold leading-none">{l === 'Apostille/Legalisasi' ? 'Apostille' : l}</span>}</a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <TombolBaru setBaru={setBaru} setAju={setAjuBaru} />
          <JamKlasik />
          <SaklarMode klasik />
          <span data-headbtn className="shrink-0"><NotificationBell /></span>
          <MenuAkun />
          <TombolLayarPenuh />
        </div>
      </header>
      <main className="min-w-0">
        {detail ? (
          <div className="px-5 py-4">
            <button type="button" onClick={() => go(kembali)} className="mb-3 flex min-h-[40px] items-center gap-1 rounded-lg bg-white px-3 text-sm font-semibold ring-1 ring-slate-200"><ArrowLeft className="h-4 w-4" />Kembali ke daftar</button>
            <div className="mx-auto max-w-[1280px]">{detail}</div>
          </div>
        ) : (
          <div className="bg-white">{isi}</div>
        )}
      </main>
    </div>
  )
}
