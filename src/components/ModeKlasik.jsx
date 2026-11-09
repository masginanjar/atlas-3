// ============================================================
//  MODE KLASIK — tampilan sederhana layar penuh untuk komputer.
//  Hanya 2 menu: Project & Keuangan (pengajuan vendor + statusnya).
//  Tanpa harga proyek, pembayaran pelanggan, maupun omset.
//  Pilihan disimpan per pengguna di perangkat ini. Di HP tidak tersedia.
// ============================================================
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Search, Plus, ChevronDown, ArrowLeft, ExternalLink, Maximize2, Minimize2, X, FolderOpen, Wallet, Eye } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { go } from '../lib/router.js'
import { scopeByBranch, can, branchesOf, BRANCHES, invoiceLabel, isMultiBranch, activeClaim, ROLES } from '../config/access.js'
import { projectRow, statusOf } from '../lib/projectRow.js'
import { flowOf, stageLabel, stageIndex, DONE, isVendorFlow } from '../config/workflows.js'
import { ProjectTypes } from './badges.jsx'
import NotificationBell from './NotificationBell.jsx'
import Avatar from './Avatar.jsx'
import { cx, Sheet } from './ui.jsx'
import ProjectDetail, { StagePanel } from '../pages/ProjectDetail.jsx'
import { InvoiceNo } from './badges.jsx'
import { uploadProjectFiles } from './FileManager.jsx'
import { tanggalJam, tanggal } from '../lib/waktu.js'
import { grupOf, sisaWaktu } from '../lib/urgensi.js'
import { stagesOf } from '../config/workflows.js'
import { SUB_TYPES } from '../config/subtypes.js'
import { createPortal } from 'react-dom'
import { rupiah } from '../lib/format.js'
import { drive } from '../lib/integrations.js'
import { scopeRequests } from './Requests.jsx'
import { SUMBER_DANA, recommendFund } from '../config/workflows.js'

/** Role yang boleh memakai Mode Klasik (bawaan; bisa diubah Superadmin di app_settings 'mode_klasik'). */
export const KLASIK_ROLES_BAWAAN = ['superadmin', 'direktur', 'supervisor', 'admin_pusat', 'cs', 'helper', 'akunting']
export const bolehKlasik = (user, data) => {
  const s = (data?.app_settings || []).find((r) => r.key === 'mode_klasik')
  const roles = s?.roles || KLASIK_ROLES_BAWAAN
  return !!user && roles.includes(user.base_role || user.role)
}

// ---- status klasik per pengguna (localStorage) + lebar layar ----
const kunci = (uid) => `atlas-mode-klasik:${uid}`
const subs = new Set()
const beritahu = () => subs.forEach((f) => f())
export function setKlasik(uid, on) { try { localStorage.setItem(kunci(uid), on ? '1' : '0') } catch { /* abaikan */ } beritahu() }
function bacaKlasik(uid) { try { return localStorage.getItem(kunci(uid)) === '1' } catch { return false } }
const subscribe = (f) => { subs.add(f); window.addEventListener('resize', f); return () => { subs.delete(f); window.removeEventListener('resize', f) } }
/** true bila pengguna memilih Mode Klasik (komputer & HP). */
export const useHp = () => useSyncExternalStore(subscribe, () => window.innerWidth < 768)
export function useKlasik(user, data) {
  const on = useSyncExternalStore(subscribe, () => !!user && bacaKlasik(user.id))
  return on && bolehKlasik(user, data)
}

async function layarPenuh(on) {
  try {
    if (on && !document.fullscreenElement) await document.documentElement.requestFullscreen?.()
    if (!on && document.fullscreenElement) await document.exitFullscreen?.()
  } catch { /* browser menolak — abaikan */ }
}

/** Saklar Klasik / Baru. tema 'gelap' untuk header. */
export function SaklarMode({ klasik, className, selalu }) {
  const { user, data } = useApp()
  const [tanya, setTanya] = useState(false)
  const [full, setFull] = useState(true)
  if (!bolehKlasik(user, data)) return null
  const pilih = (k) => {
    if (k === klasik) return
    if (k) setTanya(true)
    else { setKlasik(user.id, false); layarPenuh(false) }
  }
  return (
    <>
      <span className={cx('shrink-0 items-center rounded-full bg-white/10 p-1 text-xs font-bold', selalu ? 'flex' : 'hidden lg:flex', className)} role="group" aria-label="Mode tampilan" data-saklar-mode>
        <button type="button" onClick={() => pilih(true)} aria-pressed={klasik} className={cx('min-h-[30px] rounded-full px-3', klasik ? 'bg-amber-400 text-ink' : 'opacity-70 hover:opacity-100')}>Klasik</button>
        <button type="button" onClick={() => pilih(false)} aria-pressed={!klasik} className={cx('min-h-[30px] rounded-full px-3', !klasik ? 'bg-white text-ink' : 'opacity-70 hover:opacity-100')}>Baru</button>
      </span>
      {tanya && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-ink/50 p-4 text-ink" role="dialog" aria-modal="true" aria-label="Pindah ke Mode Klasik">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <p className="font-bold">Pindah ke Mode Klasik?</p>
            <p className="mt-1 text-[13px] text-ink-soft">Layar jadi penuh, hanya menu Project &amp; Keuangan. Harga proyek dan omset tidak ditampilkan. Bisa kembali kapan saja lewat saklar di kanan atas.</p>
            <label className="mt-3 hidden items-center gap-2 text-[13px] md:flex"><input type="checkbox" checked={full} onChange={(e) => setFull(e.target.checked)} className="h-4 w-4 rounded" />Buka langsung layar penuh</label>
            <div className="mt-4 flex gap-2">
              <button type="button" data-aksi="ya-klasik" onClick={() => { setKlasik(user.id, true); setTanya(false); if (full && window.innerWidth >= 768) layarPenuh(true); go('projects') }} className="h-11 flex-1 rounded-lg bg-ink text-sm font-bold text-white">Ya, Mode Klasik</button>
              <button type="button" onClick={() => setTanya(false)} className="h-11 rounded-lg px-4 text-sm font-semibold ring-1 ring-slate-200">Batal</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/** Jam WITA & WIB berdetik + tanggal. */
function JamKlasik() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])
  const j = (tz) => now.toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const tgl = now.toLocaleDateString('id-ID', { timeZone: 'Asia/Makassar', weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })
  return (
    <div className="flex shrink-0 items-center gap-4 rounded-lg bg-white/10 px-4 py-1.5" data-jam-klasik>
      <div className="text-center leading-tight"><p className="text-[9px] font-bold tracking-wider text-white/50">WITA</p><p className="font-mono text-[17px] font-bold tabular-nums">{j('Asia/Makassar')}</p></div>
      <span className="h-7 w-px bg-white/20" />
      <div className="text-center leading-tight"><p className="text-[9px] font-bold tracking-wider text-white/50">WIB</p><p className="font-mono text-[17px] font-bold tabular-nums">{j('Asia/Jakarta')}</p></div>
      <span className="hidden h-7 w-px bg-white/20 xl:block" />
      <div className="hidden leading-tight xl:block"><p className="text-[9px] font-bold tracking-wider text-white/50">TANGGAL</p><p className="text-[14px] font-bold">{tgl}</p></div>
    </div>
  )
}

export 
/** Jam ringkas untuk HP: WITA berdetik · WIB · tanggal. */
function JamHp() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])
  const j = (tz, d) => now.toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', ...(d ? { second: '2-digit' } : {}) })
  return (
    <div className="min-w-0 leading-tight" data-jam-klasik>
      <p className="whitespace-nowrap font-mono text-[12px] font-bold tabular-nums"><span className="text-[9px] text-white/50">WITA </span>{j('Asia/Makassar', true)} <span className="text-[9px] text-white/50">WIB </span>{j('Asia/Jakarta')}</p>
      <p className="text-[10px] text-white/60">{now.toLocaleDateString('id-ID', { timeZone: 'Asia/Makassar', weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}</p>
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
function Lingkar({ warna, judul, children }) {
  if (!warna) return children
  const w = { hitam: 'bg-ink', hijau: 'bg-emerald-600', merah: 'bg-rose-600', oranye: 'bg-orange-500' }[warna]
  return <span title={judul} data-kapsul={warna} className={cx('inline-block max-w-full truncate whitespace-nowrap rounded-full px-2 py-0.5 font-semibold text-white', w)}>{children}</span>
}

/** Info melayang saat kursor diarahkan (posisi tetap, tidak terpotong tabel). */
function InfoHover({ isi, children }) {
  const [pos, setPos] = useState(null)
  return (
    <div onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setPos({ x: Math.min(r.left, window.innerWidth - 380), y: r.bottom + 6, atas: r.bottom + 260 > window.innerHeight ? r.top - 6 : null }) }} onMouseLeave={() => setPos(null)}>
      {children}
      {pos && createPortal(
        <div className="pointer-events-none fixed z-[95] w-[360px] rounded-xl bg-ink p-3 text-[12px] text-white shadow-2xl" style={pos.atas != null ? { left: pos.x, bottom: window.innerHeight - pos.atas } : { left: pos.x, top: pos.y }} data-info-layanan>{isi}</div>, document.body)}
    </div>
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
      {r.p.about?.notes && <p className="border-t border-white/15 pt-2 text-amber-200">Catatan: {r.p.about.notes}</p>}
    </div>
  )
}

// ---------- proses ringkas: No · Nama · Tahap · Isian · Tombol (rata kiri) ----------
const TIPE_RINGKAS = (t) => ['file', 'text', 'date', 'choice', 'money', 'sumber_dana', 'checklist'].includes(t) || /^(user|person):/.test(t)
const kotak = 'h-9 rounded-lg border-0 bg-white px-2.5 text-[12.5px] ring-1 ring-slate-300 focus:ring-2 focus:ring-brand'

function IsianRingkas({ f, v, set, project, sub, stage }) {
  const { user, data, notify } = useApp()
  const [up, setUp] = useState(false)
  if (f.type === 'file') {
    const list = v[`${f.key}_list`] || (v[f.key] ? [v[f.key]] : [])
    return (
      <label className={cx('inline-flex h-9 max-w-[260px] cursor-pointer items-center gap-1.5 rounded-lg border border-dashed px-2.5 text-[12.5px]', list.length ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : 'border-slate-300 text-ink-soft hover:border-brand')} title={f.label}>
        <span className="truncate">{up ? 'Mengunggah…' : list.length ? `✓ ${list.length > 1 ? `${list.length} file` : list[0].name}` : `⤒ ${f.label}`}</span>
        <input type="file" multiple className="sr-only" accept={f.accept || 'image/*,application/pdf,.doc,.docx'} onChange={async (e) => {
          const fl = [...e.target.files]; e.target.value = ''; if (!fl.length) return
          setUp(true)
          try { const hasil = await uploadProjectFiles(fl.map((file) => ({ file, name: file.name, sub_id: sub.id })), { branch: project.branch, invoice: project.invoice_no, by: user.name }); const n = [...list, ...hasil]; set({ [f.key]: n[0], [`${f.key}_list`]: n }) }
          catch (er) { notify(er.message, 'err') } finally { setUp(false) }
        }} />
      </label>
    )
  }
  if (f.type === 'checklist') {
    const boleh = (it) => !f.itemRoles?.[it] || f.itemRoles[it].includes(user.role)
    const cur = v[f.key] || []
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        {(f.items || []).filter(boleh).map((it) => { const on = cur.includes(it); return (
          <button key={it} type="button" onClick={() => set({ [f.key]: on ? cur.filter((x) => x !== it) : [...cur, it] })} aria-pressed={on}
            className={cx('h-8 rounded-md px-2 text-[11.5px] font-bold', on ? 'bg-emerald-500 text-white' : 'bg-white text-ink ring-1 ring-slate-300 hover:ring-ink')}>{on ? '✓ ' : '☐ '}{it}</button>) })}
      </span>
    )
  }
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

function BarisProses({ n, p, x }) {
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
  const nama = <><span className="w-5 shrink-0 text-right font-bold text-ink-mute">{n}</span><span className="max-w-[260px] truncate font-bold text-ink" title={x.title}>{x.title}</span></>
  if (x.stage === DONE || !st) return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2 text-[12.5px]" data-baris-proses="selesai">{nama}<span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11.5px] font-bold text-emerald-700">✓ Selesai</span></div>
  )
  const normal = can.processStage(user, st, x, p)
  const claim = activeClaim(x)
  const needClaim = st.claimable && user.role !== 'superadmin' && (!claim || claim.by !== user.id)
  const wajib = (st.fields || []).filter((f) => f.required)
  const ringkas = normal && !needClaim && wajib.every((f) => TIPE_RINGKAS(f.type)) && wajib.length <= 3
  const tahap = <span className={cx('whitespace-nowrap rounded-md px-2 py-0.5 text-[11.5px] font-bold', normal ? 'bg-indigo-50 text-ink' : 'bg-slate-100 text-ink-soft')}>{st.label}</span>
  if (!normal) {
    const tid = st.assignee ? x.data?.[st.assignee] : null
    const who = claim && st.claimable ? `${claim.name} (sedang diproses)` : tid ? nameOf(tid) : st.printBranch ? `staf cabang ${p.about?.print_location || p.branch}` : st.roles.filter((r) => r !== 'superadmin').map((r) => ROLES[r]?.label || r).join(' / ')
    const bisaLewati = ['superadmin', 'direktur', 'admin_pusat'].includes(user.role)
    return (
      <div className="bg-slate-50/70" data-baris-proses="menunggu">
        <div className="flex flex-wrap items-center gap-2 px-4 py-2 text-[12.5px] text-ink-soft">{nama}{tahap}<span className="text-[11.5px]">🔒 menunggu {who}</span>
          {tid && tid !== user.id && <button type="button" onClick={async () => { try { await sendPing({ to_user: tid, project: p, sub: x, stage: st, message: `Mohon dicek: ${st.label}` }); notify('Ping terkirim') } catch (e) { notify(e.message, 'err') } }} className="h-8 rounded-lg bg-white px-3 font-semibold text-ink ring-1 ring-slate-300">🔔 Ping</button>}
          {bisaLewati && <button type="button" onClick={() => setPenuh((o) => !o)} className="h-8 rounded-lg px-2 text-[11.5px] font-semibold text-amber-700 hover:bg-amber-50">{penuh ? 'Tutup' : 'Lanjutkan tanpa menunggu…'}</button>}
        </div>
        {penuh && <div className="pb-2 [&>div]:mx-4"><StagePanel project={p} sub={x} stage={st} /></div>}
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
      <div className="flex flex-wrap items-center gap-2 px-4 py-2 text-[12.5px]">
        {nama}{tahap}
        {ringkas ? <>
          {wajib.map((f) => <IsianRingkas key={f.key} f={f} v={v} set={(o) => setV((cur) => ({ ...cur, ...o }))} project={p} sub={x} stage={st} />)}
          <button type="button" onClick={jalan} disabled={busy} data-aksi="jalankan-tahap" className={cx('h-9 whitespace-nowrap rounded-lg px-3.5 font-bold text-white disabled:opacity-50', /acc|setuju/i.test(st.action || '') ? 'bg-emerald-600' : 'bg-ink')}>{busy ? '…' : `${st.action || 'Lanjut'} →`}</button>
          {(st.fields || []).some((f) => !f.required) && <button type="button" onClick={() => setPenuh((o) => !o)} className="h-9 rounded-lg px-2 text-[11.5px] font-semibold text-ink-soft hover:bg-slate-100">{penuh ? 'Tutup' : '+ lainnya'}</button>}
        </> : <button type="button" onClick={() => setPenuh((o) => !o)} className="h-9 rounded-lg bg-ink px-3.5 font-bold text-white" data-aksi="proses-lengkap">{penuh ? 'Tutup' : `${st.action || 'Proses'} ▾`}</button>}
        {ok && <span className="font-bold text-emerald-600">✓</span>}
      </div>
      {penuh && <div className="pb-2 [&>div]:mx-4"><StagePanel project={p} sub={x} stage={st} /></div>}
    </div>
  )
}

/** Proses langsung di bawah baris — satu baris per sub project. */
function ProsesInline({ p }) {
  const subs = (p.sub_projects || []).filter((x) => !x.cancelled)
  return (
    <div className="sticky left-0 w-[calc(100vw-24px)] max-w-[1400px] divide-y divide-slate-100 border-l-4 border-ink bg-[#f8faff]" data-klasik-proses>
      {subs.map((x, i) => <BarisProses key={x.id} n={i + 1} p={p} x={x} />)}
    </div>
  )
}

const PRIO_WARNA = (p) => (/sameday/i.test(p) ? 'bg-rose-600 text-white' : /super/i.test(p) ? 'bg-rose-100 text-rose-700' : /ekspres|speed/i.test(p) ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-ink-soft')

/** Judul kolom yang bisa diklik: urutkan + saring (nilai / rentang tanggal). */
function JudulKolom({ c, urut, setUrut, f, setF, opsi, kanan }) {
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
    <th ref={ref} className={cx('whitespace-nowrap px-2 py-1.5', kanan && 'text-right')}>
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
function useTabel(rows, cols, awal) {
  const [f, setF] = useState({})
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
  const Judul = ({ c }) => <JudulKolom c={c} urut={urut} setUrut={setUrut} f={f} setF={setF} opsi={opsi[c.key]} kanan={c.num} />
  return { hasil, Judul, nAktif, reset: () => setF({}), f, setF, urut, setUrut, opsi }
}


/** HP: semua saringan & urutan kolom dalam satu lembar dari bawah. */
function LembarSaring({ cols, f, setF, urut, setUrut, opsi, jumlah, onClose, satuan }) {
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
  { key: 'layanan', label: 'Detail Layanan', sort: (r) => r.layananAll[0] || '', nilai: (r) => r.subs.map(jenisLayanan) },
]

function KlasikProject() {
  const { user, data, nameOf } = useApp()
  const [cepat, setCepat] = useState('aktif')
  const [q, setQ] = useState('')
  const [buka, setBuka] = useState(null)
  const [lihat, setLihat] = useState(null)
  const [batas, setBatas] = useState(60)
  const semua = useMemo(() => scopeByBranch(user, data.projects || []).filter((p) => !p.cancelled && !p.demo_perf)
    .map((p) => projectRow(p, nameOf)), [user, data.projects, nameOf])
  const n = {
    aktif: semua.filter((r) => r.status !== 'Selesai').length,
    terlambat: semua.filter((r) => r.terlambat).length,
    hariini: semua.filter((r) => r.dlHariIni && r.status !== 'Selesai').length,
  }
  const s = q.trim().toLowerCase()
  const dasar = useMemo(() => semua.filter((r) => (cepat === 'aktif' ? r.status !== 'Selesai' : cepat === 'terlambat' ? r.terlambat : cepat === 'hariini' ? r.dlHariIni && r.status !== 'Selesai' : cepat === 'selesai' ? r.status === 'Selesai' : true))
    .filter((r) => !s || [r.invoice, invoiceLabel(r.invoice), r.pelanggan, r.cs, ...r.layananAll, ...r.arahAll, ...r.orangAll, r.status].some((v) => String(v || '').toLowerCase().includes(s))), [semua, cepat, s])
  const tb = useTabel(dasar, KOLOM_P, { key: 'timestamp', dir: 'desc' })
  const { hasil: rows, Judul, nAktif, reset } = tb
  const tampil = rows.slice(0, batas)
  const tabs = [['aktif', `Aktif ${n.aktif}`], ['terlambat', `Terlambat ${n.terlambat}`], ['hariini', `Hari ini ${n.hariini}`], ['selesai', 'Selesai'], ['semua', 'Semua']]
  const projLihat = lihat && (data.projects || []).find((x) => x.id === lihat)
  const lembarDetail = projLihat && (
    <Sheet open side wide onClose={() => setLihat(null)} title={invoiceLabel(projLihat.invoice_no)} subtitle={`${projLihat.customer?.name || ''} · ${projLihat.branch}`}>
      <div data-klasik-detail><ProjectDetail id={projLihat.id} embedded /></div>
    </Sheet>
  )
  const hp = useHp()
  const [saring, setSaring] = useState(false)
  if (hp) return (
    <div className="min-w-0" data-klasik-hp>
      <div className="flex gap-1.5 overflow-x-auto px-3 pt-2.5 text-[12px] font-semibold">
        {[['aktif', `Aktif ${n.aktif}`], ['terlambat', `Telat ${n.terlambat}`], ['hariini', `Hari ini ${n.hariini}`], ['selesai', 'Selesai'], ['semua', 'Semua']].map(([k, l]) => <button key={k} type="button" onClick={() => setCepat(k)} aria-pressed={cepat === k} className={cx('min-h-[36px] shrink-0 whitespace-nowrap rounded-full px-3', cepat === k ? 'bg-ink text-white' : 'bg-white ring-1 ring-slate-200')}>{l}</button>)}
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
              <button type="button" onClick={() => setBuka(dipilih ? null : r.id)} aria-expanded={dipilih} className={cx('block w-full px-3 py-2.5 text-left', dipilih ? 'bg-[#eef2ff]' : r.terlambat ? 'bg-rose-50' : '')} data-klasik-baris>
                <span className="flex items-center gap-2"><Lingkar warna={r.dibuatHariIni ? 'hijau' : ''} judul="Diinput hari ini"><span className="text-[11px] tabular-nums">{tg}</span></Lingkar><span className="text-[10px] text-ink-mute">{jm}</span><span className="ml-auto"><InvoiceNo project={r.p} /></span><span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); setLihat(r.id) }} aria-label="Lihat detail project" data-aksi="mata" className="grid h-8 w-8 place-items-center rounded-md text-ink-mute"><Eye className="h-4 w-4" /></span></span>
                <span className="mt-1 flex items-center gap-2"><b className="min-w-0 flex-1 truncate">{r.pelanggan || '—'}</b><Lingkar warna={r.status === 'Selesai' ? '' : r.dlHariIni ? 'merah' : r.dlBesok ? 'oranye' : ''} judul="Deadline"><span className="shrink-0 text-[12px] tabular-nums">{r.deadline ? tanggal(r.deadline) : '—'}</span></Lingkar></span>
                <span className="mt-0.5 flex items-center gap-1 text-[11.5px] text-ink-soft">
                  {r.prioritas !== 'Normal' && <span className="rounded bg-rose-50 px-1 font-semibold text-rose-700">{r.prioritas}</span>}
                  <span className="truncate"><span className="font-semibold text-brand">{x0 ? subStatus(x0, r.p) : r.status}</span>{r.subs.length > 1 ? ` · ${r.subs.length} sub` : x0 ? ` · ${x0.lang_from && x0.lang_to ? `${x0.lang_from} → ${x0.lang_to} · ` : ''}${subDok(x0)} dok · ${subHal(x0)} hal` : ''}</span>
                  <span className="ml-auto shrink-0 text-ink-mute">{sisa ? <span className={grupOf(r.p) === 'terlambat' ? 'font-semibold text-rose-600' : 'font-semibold text-orange-600'}>{sisa}</span> : r.cs}</span>
                </span>
              </button>
              {dipilih && <div onClick={(e) => e.stopPropagation()} className="[&_[data-klasik-proses]]:!w-full [&_[data-klasik-proses]]:!static"><ProsesInline p={(data.projects || []).find((x) => x.id === r.id) || r.p} /></div>}
            </div>
          )
        })}
        {!tampil.length && <p className="px-4 py-10 text-center text-ink-mute">Tidak ada project sesuai saringan.</p>}
      </div>
      {rows.length > batas && <button type="button" onClick={() => setBatas((b) => b + 60)} className="m-3 h-11 w-[calc(100%-24px)] rounded-xl bg-white font-semibold text-brand ring-1 ring-slate-200">Tampilkan lebih banyak ({rows.length - batas})</button>}
      {can.editProject(user) && <button type="button" onClick={() => go('projects/new')} aria-label="Project baru" className="fixed bottom-5 right-4 z-30 grid h-14 w-14 place-items-center rounded-full bg-ink text-white shadow-xl"><Plus className="h-6 w-6" /></button>}
      {saring && <LembarSaring cols={KOLOM_P} {...tb} jumlah={rows.length} satuan="project" onClose={() => setSaring(false)} />}
      {lembarDetail}
    </div>
  )
  const Tumpuk = ({ r, fn, cls }) => (
    <div className="space-y-1">{r.subs.map((x) => <div key={x.id} className={cx('h-[22px] truncate leading-[22px]', cls)}>{fn(x) || <span className="text-ink-mute">—</span>}</div>)}</div>
  )

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-[#f6f7fb] px-3 py-2 text-[12.5px]" data-klasik-filter>
        <span className="flex shrink-0 gap-0.5 rounded-lg bg-white p-0.5 font-semibold ring-1 ring-slate-200" role="group" aria-label="Filter cepat">
          {tabs.map(([k, l]) => <button key={k} type="button" onClick={() => setCepat(k)} aria-pressed={cepat === k} className={cx('h-8 whitespace-nowrap rounded-md px-2.5', cepat === k ? 'bg-ink text-white' : 'text-ink-soft hover:bg-slate-50')}>{l}</button>)}
        </span>
        <label className="relative block w-[260px] shrink-0">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-mute" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari invoice, pelanggan, dokumen…" aria-label="Cari project" className="h-9 w-full rounded-lg border-0 bg-white pl-8 pr-2 text-[12.5px] ring-1 ring-slate-200 focus:ring-2 focus:ring-brand" />
        </label>
        <span className="text-[11px] text-ink-mute">Saring &amp; urutkan lewat judul kolom ▾</span>
        {nAktif > 0 && <button type="button" onClick={reset} className="flex h-9 items-center gap-1 rounded-lg px-2 font-semibold text-rose-600 hover:bg-rose-50" data-reset-saring><X className="h-3.5 w-3.5" />Hapus {nAktif} saringan</button>}
        {can.editProject(user) && (
          <button type="button" onClick={() => go('projects/new')} className="ml-auto flex h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-ink px-3 font-bold text-white"><Plus className="h-4 w-4" />Project baru</button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]" data-klasik-tabel>
          <thead className="bg-slate-50 text-left text-[10.5px] uppercase tracking-wide text-ink-mute">
            <tr className="border-b border-slate-200">{KOLOM_P.map((c) => <Judul key={c.key} c={c} />)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tampil.map((r) => {
              const dipilih = buka === r.id
              const [tg, jm] = String(tanggalJam(r.timestamp) || '').split(/\s(?=\d{1,2}[.:]\d{2}$)/)
              const sisa = r.status !== 'Selesai' ? sisaWaktu(r.p) : null
              return [
                <tr key={r.id} onClick={() => setBuka(dipilih ? null : r.id)} aria-expanded={dipilih} className={cx('cursor-pointer whitespace-nowrap align-top hover:bg-slate-50', dipilih ? 'bg-[#eef2ff]' : r.terlambat ? 'bg-rose-50/60' : '')} data-klasik-baris>
                  <td className="px-3 py-2 leading-tight"><Lingkar warna={r.dibuatHariIni ? 'hijau' : ''} judul="Diinput hari ini"><span className="text-xs tabular-nums">{tg}</span></Lingkar>{jm && <span className="mt-0.5 block text-[11px] tabular-nums text-ink-mute">{jm}</span>}</td>
                  <td className="px-3 py-2"><Lingkar warna={r.prioMendesak && !r.p.about?.priority?.match(/sameday|super|ekspres|speed/i) ? 'hitam' : ''} judul={`Prioritas ${r.prioritas}`}><InvoiceNo project={r.p} /></Lingkar>{r.subs.length > 1 && <span className="ml-1 rounded bg-slate-200 px-1 text-[10px] font-semibold text-ink-soft">{r.subs.length} sub</span>}<button type="button" onClick={(e) => { e.stopPropagation(); setLihat(r.id) }} title="Lihat detail project" aria-label={`Detail ${invoiceLabel(r.invoice)}`} data-aksi="mata" className="ml-1 inline-grid h-7 w-7 place-items-center rounded-md align-middle text-ink-mute hover:bg-slate-200 hover:text-ink"><Eye className="h-4 w-4" /></button></td>
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
      {lembarDetail}
    </div>
  )
}

// ------------------------------------------------------------
//  KEUANGAN — hanya pengajuan vendor + statusnya (1 tab)
// ------------------------------------------------------------
const STATUS_AJU = {
  draf: ['Belum diajukan', 'bg-slate-100 text-ink-soft'],
  menunggu: ['Menunggu ACC', 'bg-amber-100 text-amber-700'],
  disetujui: ['Disetujui', 'bg-sky-100 text-sky-700'],
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
  const tb = useTabel(dasar, KOLOM_K, { key: 'at', dir: 'desc' })
  const { hasil: rows, Judul, nAktif, reset } = tb
  const hp = useHp()
  const [saring, setSaring] = useState(false)
  const tabs = [['semua', `Semua ${list.length}`], ['menunggu', `Menunggu ACC ${n('menunggu')}`], ['disetujui', `Disetujui ${n('disetujui')}`], ['dibayar', `Dibayar ${n('dibayar')}`], ['dikembalikan', `Ditolak ${n('dikembalikan')}`], ['draf', `Belum diajukan ${n('draf')}`]]
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
              <button type="button" onClick={() => setBuka(terbuka ? null : r.id)} aria-expanded={terbuka} className={cx('block w-full px-3 py-2.5 text-left', terbuka && 'bg-[#eef2ff]')} data-klasik-aju={r.st}>
                <span className="flex items-center gap-2"><span className={cx('rounded px-1.5 text-[10px] font-semibold', cls)}>{lbl}</span><span className="text-[10px] text-ink-mute">{jam(r.at)}</span><b className="ml-auto tabular-nums">{r.total ? rupiah(r.total) : '—'}</b></span>
                <span className="mt-1 flex"><b className="min-w-0 flex-1 truncate">{r.jenis}</b><span className="ml-2 shrink-0 text-ink-soft">{r.kantor} · {r.cs || '—'}</span></span>
                <span className="block truncate text-[11.5px] text-ink-soft">{[r.invoice, r.penerima, [r.rek.bank, r.rek.number].filter(Boolean).join(' '), r.sumber].filter(Boolean).join(' · ') || '—'}</span>
              </button>
              {terbuka && <div className="bg-[#f8faff]" onClick={(e) => e.stopPropagation()}>
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
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-[#f6f7fb] px-3 py-2 text-[12.5px]">
        <p className="font-bold text-ink">Pengajuan</p>
        <span className="flex flex-wrap gap-0.5 rounded-lg bg-white p-0.5 font-semibold ring-1 ring-slate-200" role="group" aria-label="Status pengajuan">
          {tabs.map(([k, l]) => <button key={k} type="button" onClick={() => setCepat(k)} aria-pressed={cepat === k} className={cx('h-8 whitespace-nowrap rounded-md px-2.5', cepat === k ? 'bg-ink text-white' : 'text-ink-soft hover:bg-slate-50')}>{l}</button>)}
        </span>
        <label className="relative block w-[240px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-mute" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari invoice, penerima, catatan…" aria-label="Cari pengajuan" className="h-9 w-full rounded-lg border-0 bg-white pl-8 pr-2 text-[12.5px] ring-1 ring-slate-200 focus:ring-2 focus:ring-brand" />
        </label>
        {nAktif > 0 && <button type="button" onClick={reset} className="flex h-9 items-center gap-1 rounded-lg px-2 font-semibold text-rose-600 hover:bg-rose-50"><X className="h-3.5 w-3.5" />Hapus {nAktif} saringan</button>}
        <span className="ml-auto text-[11px] text-ink-mute">Saring &amp; urutkan lewat judul kolom ▾</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]" data-klasik-pengajuan>
          <thead className="bg-slate-50 text-left text-[10.5px] uppercase tracking-wide text-ink-mute"><tr className="border-b border-slate-200">{KOLOM_K.map((c) => <Judul key={c.key} c={c} />)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => {
              const [lbl, cls] = STATUS_AJU[r.st]; const terbuka = buka === r.id
              return [
                <tr key={r.id} onClick={() => setBuka(terbuka ? null : r.id)} className={cx('cursor-pointer whitespace-nowrap hover:bg-slate-50', terbuka && 'bg-[#eef2ff]')} data-klasik-aju={r.st}>
                  <td className="px-3 py-2.5 text-ink-soft">{jam(r.at)}</td>
                  <td className="px-3">{r.tipe === 'vendor' ? <InvoiceNo project={r.p} /> : <span className="font-bold">{r.invoice || '—'}</span>}</td>
                  <td className="px-3"><span className={cx('rounded px-2 py-0.5 text-[11px] font-semibold', cls)}>{lbl}</span></td>
                  <td className="px-3">{r.jenis}</td>
                  <td className="px-3">{r.sumber || '—'}</td>
                  <td className="max-w-[160px] truncate px-3">{r.pelanggan || '—'}</td>
                  <td className="px-3 text-right font-semibold tabular-nums">{r.total ? rupiah(r.total) : '—'}</td>
                  <td className="px-3">{r.kantor || '—'}</td>
                  <td className="px-3">{r.cs || '—'}</td>
                  <td className="max-w-[160px] truncate px-3">{r.penerima || '—'}</td>
                  <td className="px-3">{r.rek.bank || '—'}</td>
                  <td className="px-3 tabular-nums">{r.rek.number || '—'}</td>
                  <td className="max-w-[220px] truncate px-3 text-ink-soft" title={r.catatan}>{r.catatan || '—'}</td>
                  <td className="px-3"><FileLink f={r.nota} label="Nota" /></td>
                  <td className="px-3"><FileLink f={r.bukti} label="Bukti" /></td>
                  <td className="px-3">{r.tglTf ? new Date(`${String(r.tglTf).slice(0, 10)}T12:00:00+08:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
                </tr>,
                terbuka && (
                  <tr key={`${r.id}-d`} className="bg-[#f8faff]"><td colSpan={KOLOM_K.length} className="p-0" onClick={(e) => e.stopPropagation()}>
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

// ------------------------------------------------------------
//  KERANGKA LAYAR
// ------------------------------------------------------------
export function KlasikApp({ page, param, detail }) {
  const { user } = useApp()
  const tab = page === 'keuangan' || page === 'pengajuan' ? 'keuangan' : 'projects'
  useEffect(() => { if (!['projects', 'keuangan', 'pengajuan'].includes(page)) go('projects') }, [page])
  const hp = useHp()
  if (hp) return (
    <div className="min-h-screen bg-[#f6f7fb] pb-24" data-mode-klasik>
      <header className="app-head sticky top-0 z-30 px-3 pb-2 pt-2 text-white" style={{ '--head-ink': '#fff', '--head-mute': 'rgba(255,255,255,.6)', '--head-hover': 'rgba(255,255,255,.1)', '--head-line': 'rgba(255,255,255,.2)', background: '#0e1540' }}>
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white text-xs font-extrabold text-ink">A</span>
          <JamHp />
          <span className="ml-auto"><SaklarMode klasik selalu /></span>
          <span data-headbtn className="shrink-0"><NotificationBell /></span>
        </div>
        <nav className="mt-2 grid grid-cols-2 gap-1 rounded-xl bg-white/10 p-1 text-[13px] font-bold" aria-label="Menu Mode Klasik">
          {[['projects', 'Project', FolderOpen], ['keuangan', 'Keuangan', Wallet]].map(([k, l, I]) => (
            <a key={k} href={`#/${k}`} aria-current={tab === k ? 'page' : undefined} className={cx('flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg', tab === k ? 'bg-white text-ink' : 'text-white/70')}><I className="h-4 w-4" />{l}</a>
          ))}
        </nav>
      </header>
      <main className="min-w-0">
        {detail ? (
          <div className="px-3 py-3">
            <button type="button" onClick={() => go(tab)} className="mb-3 flex min-h-[44px] items-center gap-1 rounded-lg bg-white px-3 text-sm font-semibold ring-1 ring-slate-200"><ArrowLeft className="h-4 w-4" />Kembali ke daftar</button>
            {detail}
          </div>
        ) : tab === 'keuangan' ? <KlasikKeuangan /> : <KlasikProject />}
      </main>
    </div>
  )
  return (
    <div className="min-h-screen bg-[#f6f7fb]" data-mode-klasik>
      <header className="app-head sticky top-0 z-30 flex h-14 items-center gap-4 bg-ink px-5 text-white" style={{ '--head-ink': '#fff', '--head-mute': 'rgba(255,255,255,.6)', '--head-hover': 'rgba(255,255,255,.1)', '--head-line': 'rgba(255,255,255,.2)', background: '#0e1540' }}>
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-sm font-extrabold text-ink">A</span><span className="font-extrabold">ATLAS</span>
        <nav className="ml-3 flex h-14 items-end gap-1" aria-label="Menu Mode Klasik">
          {[['projects', 'Project', FolderOpen], ['keuangan', 'Keuangan', Wallet]].map(([k, l, I]) => (
            <a key={k} href={`#/${k}`} aria-current={tab === k ? 'page' : undefined} className={cx('flex items-center gap-1.5 rounded-t-lg px-6 py-3 text-sm', tab === k ? 'bg-[#f6f7fb] font-bold text-ink' : 'font-semibold text-white/70 hover:text-white')}><I className="h-4 w-4" />{l}</a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <JamKlasik />
          <SaklarMode klasik />
          <span data-headbtn className="shrink-0"><NotificationBell /></span>
          <span className="flex items-center gap-2 text-sm"><Avatar user={user} size={32} ring={false} /><span className="hidden leading-tight 2xl:block"><b>{String(user.name).replace(/\s*\(.*\)\s*$/, '')}</b></span></span>
          <TombolLayarPenuh />
        </div>
      </header>
      <main className="min-w-0">
        {detail ? (
          <div className="px-5 py-4">
            <button type="button" onClick={() => go(tab)} className="mb-3 flex min-h-[40px] items-center gap-1 rounded-lg bg-white px-3 text-sm font-semibold ring-1 ring-slate-200"><ArrowLeft className="h-4 w-4" />Kembali ke daftar</button>
            <div className="mx-auto max-w-[1280px]">{detail}</div>
          </div>
        ) : (
          <div className="bg-white">{tab === 'keuangan' ? <KlasikKeuangan /> : <KlasikProject />}</div>
        )}
      </main>
    </div>
  )
}
