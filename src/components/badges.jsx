import { useState } from 'react'
import { createPortal } from 'react-dom'
import { SUB_TYPES } from '../config/subtypes.js'
import { Printer, StickyNote } from 'lucide-react'
import { cx } from './ui.jsx'
import { useApp } from '../lib/store.jsx'
import { branchesOf } from '../config/access.js'

/** Ikon PRINT bila dokumen dititipkan cetak di cabang lain. */
export function PrintBadge({ project, iconOnly, className }) {
  const { user } = useApp()
  const loc = project?.about?.print_location
  if (!loc || loc === project.branch) return null
  const incoming = branchesOf(user).includes(loc) && !branchesOf(user).includes(project.branch)
  const label = incoming ? `Titipan print dari ${project.branch}` : `Titip print di ${loc}`
  return (
    <span title={label} className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-fuchsia-50 font-semibold text-fuchsia-700 ring-1 ring-fuchsia-200', iconOnly ? 'px-1.5 py-0.5' : 'px-2 py-0.5 text-[11px]', className)}>
      <Printer className="h-3 w-3" />{!iconOnly && (incoming ? `Titipan ${project.branch}` : `Print ${loc}`)}
    </span>
  )
}

const TONE = {
  terjemahan: 'bg-blue-50 text-blue-700 ring-blue-200',
  terjemahan_nt: 'bg-cyan-50 text-cyan-700 ring-cyan-200',
  apostille: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  legalisasi: 'bg-violet-50 text-violet-700 ring-violet-200',
  jasa_lain: 'bg-slate-100 text-slate-700 ring-slate-200',
}

export function TypeBadge({ type, count, className }) {
  return (
    <span className={cx('inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1', TONE[type] ?? TONE.jasa_lain, className)}>
      {(SUB_TYPES[type] ?? SUB_TYPES.jasa_lain).short || (SUB_TYPES[type] ?? SUB_TYPES.jasa_lain).label}{count > 1 && <span className="ml-1 opacity-70">×{count}</span>}
    </span>
  )
}

/** Tag jenis layanan sebuah project, diambil dari sub project-nya. */
export function ProjectTypes({ project, className }) {
  const counts = {}
  for (const s of project.sub_projects || []) { const t = s.type || 'jasa_lain'; counts[t] = (counts[t] || 0) + 1 }
  return (
    <span className={cx('inline-flex flex-wrap gap-1', className)}>
      {Object.keys(SUB_TYPES).filter((t) => counts[t]).map((t) => <TypeBadge key={t} type={t} count={counts[t]} />)}
    </span>
  )
}

/** Penanda project contoh (tugas harian demo) — tidak dihitung sebagai uang. */
export function DemoBadge({ project, className }) {
  if (!project?.demo_perf) return null
  return <span title="Tugas contoh harian — bukan pekerjaan nyata" className={cx('inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 ring-1 ring-amber-200', className)}>Contoh</span>
}

const WITA_DAY = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(d)
/** Project dibuat hari ini (zona waktu aplikasi) — berdasarkan created_at, bukan perubahan data. */
export const isNewToday = (p) => !!p?.created_at && WITA_DAY(new Date(p.created_at)) === WITA_DAY()
/** Nomor invoice; bila project dibuat hari ini: badge membulat latar hijau lembut (tanpa label). */
export function InvoiceNo({ project, className, size = 'sm' }) {
  const fresh = isNewToday(project)
  const txt = size === 'base' ? 'text-base' : 'text-sm'
  if (!fresh) return <span className={cx('whitespace-nowrap font-bold', txt, className)}>{project.invoice_no}</span>
  return <span title="Baru diinput hari ini" className={cx('inline-flex items-center whitespace-nowrap rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 px-2 py-0.5 font-extrabold text-emerald-700 ring-1 ring-emerald-300', txt, className)}>{project.invoice_no}</span>
}
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
/** Deadline dua baris: "7 Nov" / "3 hari lagi" · Hari ini merah, Besok oranye, terlambat merah. */
export function DeadlineCell({ project, done, className, align = 'right' }) {
  const iso = project?.about?.deadline
  if (done) return <span className={cx('block text-xs font-semibold text-emerald-600', className)}>Selesai</span>
  if (!iso) return <span className={cx('block text-xs text-ink-mute', className)}>—</span>
  const dayKeyOf = (d) => WITA_DAY(d)
  const today = new Date(`${WITA_DAY()}T12:00:00+08:00`); const dl = new Date(`${dayKeyOf(new Date(iso))}T12:00:00+08:00`)
  const d = Math.round((dl - today) / 864e5)
  const w = new Date(new Date(iso).getTime() + 8 * 3600e3)
  const date = `${w.getUTCDate()} ${BLN[w.getUTCMonth()]}`
  const [txt, tone] = d < 0 ? [`Terlambat ${-d} hari`, 'text-rose-600'] : d === 0 ? ['Hari ini', 'text-rose-600'] : d === 1 ? ['Besok', 'text-orange-500'] : [`${d} hari lagi`, 'text-ink-mute']
  // Hari ini: seluruh teks dibungkus indikator berkedip merah agar langsung terlihat
  if (d === 0) return (
    <span className={cx('inline-block leading-tight', align === 'right' ? 'text-right' : 'text-left', className)}>
      <span className="inline-block rounded-lg bg-rose-600 px-2 py-0.5 text-white shadow-sm" title="Deadline hari ini">
        <span className="block text-xs font-bold">{date}</span>
        <span className="block whitespace-nowrap text-[11px] font-semibold">Hari ini</span>
      </span>
    </span>
  )
  return (
    <span className={cx('block leading-tight', align === 'right' ? 'text-right' : 'text-left', className)}>
      <span className={cx('block text-xs font-bold', d <= 1 ? tone : 'text-ink')}>{date}</span>
      <span className={cx('block whitespace-nowrap text-[11px] font-semibold', tone)}>{txt}</span>
    </span>
  )
}

/** Ikon catatan project: hanya tampil bila ada catatan; pop-up (portal, di atas seluruh layar) saat kursor diarahkan / fokus / disentuh. */
export function NoteIcon({ note, className }) {
  const txt = String(note || '').trim()
  const [pos, setPos] = useState(null)
  if (!txt) return null
  const show = (e) => {
    const r = e.currentTarget.getBoundingClientRect(); const w = Math.min(288, window.innerWidth - 16)
    const left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2))
    const below = r.bottom + 6; const up = window.innerHeight - below < 160
    setPos({ left, w, top: up ? null : below, bottom: up ? window.innerHeight - r.top + 6 : null })
  }
  const hide = () => setPos(null)
  return (
    <span className={cx('relative inline-flex cursor-help', className)} tabIndex={0} aria-label={`Catatan: ${txt}`}
      onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide} onClick={(e) => { e.preventDefault(); e.stopPropagation(); pos ? hide() : show(e) }}>
      <StickyNote className="h-4 w-4 text-amber-500" />
      {pos && createPortal(
        <span role="tooltip" style={{ left: pos.left, width: pos.w, top: pos.top ?? undefined, bottom: pos.bottom ?? undefined }}
          className="pointer-events-none fixed z-[90] whitespace-pre-line rounded-xl bg-ink px-3 py-2 text-left text-xs font-medium leading-snug text-white shadow-xl ring-1 ring-white/10">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-amber-300">Catatan</span>{txt}
        </span>, document.body)}
    </span>
  )
}
