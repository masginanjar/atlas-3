import { useState } from 'react'
import { createPortal } from 'react-dom'
import { SUB_TYPES } from '../config/subtypes.js'
import { Printer, StickyNote } from 'lucide-react'
import { cx } from './ui.jsx'
import { useApp } from '../lib/store.jsx'
import { branchesOf, invoiceLabel} from '../config/access.js'

/** Ikon PRINT bila dokumen dititipkan cetak di cabang lain. */
export function PrintBadge({ project, iconOnly, className }) {
  const { user } = useApp()
  const loc = project?.about?.print_location
  if (!loc || loc === project.branch) return null
  if (loc === 'Vendor') return <span title="Dicetak oleh vendor (eksternal)" className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-violet-50 font-semibold text-violet-700 ring-1 ring-violet-200', iconOnly ? 'px-1.5 py-0.5' : 'px-2 py-0.5 text-[11px]', className)}><Printer className="h-3 w-3" />{!iconOnly && 'Print Vendor'}</span>
  const incoming = branchesOf(user).includes(loc) && !branchesOf(user).includes(project.branch)
  const label = incoming ? `Titipan print dari ${project.branch}` : `Titip print di ${loc}`
  return (
    <span title={label} className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-fuchsia-50 font-semibold text-fuchsia-700 ring-1 ring-fuchsia-200', iconOnly ? 'px-1.5 py-0.5' : 'px-2 py-0.5 text-[11px]', className)}>
      <Printer className="h-3 w-3" />{!iconOnly && (incoming ? `Titipan ${project.branch}` : `Print ${loc}`)}
    </span>
  )
}

// Badge jenis layanan: netral (abu) — warna disisakan untuk status & prioritas yang bermakna
const TONE = {
  terjemahan: 'bg-slate-100 text-ink-soft ring-slate-200',
  terjemahan_nt: 'bg-slate-100 text-ink-soft ring-slate-200',
  apostille: 'bg-slate-100 text-ink-soft ring-slate-200',
  legalisasi: 'bg-slate-100 text-ink-soft ring-slate-200',
  jasa_lain: 'bg-slate-100 text-ink-soft ring-slate-200',
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
/** Prioritas cepat (Ekspres / Super Ekspres / Sameday). */
export const isCepat = (p) => ['Ekspres', 'Super Ekspres', 'Sameday'].includes(p?.about?.priority)
/**
 * Nomor invoice sebagai kapsul solid (aturan 8 Nov 2026):
 *  • prioritas cepat (Ekspres/Super Ekspres/Sameday) → latar hitam, teks putih tebal
 *  • project dibuat hari ini (created_at, zona WITA) → latar hijau, teks putih tebal
 *  • keduanya → kapsul hitam + penanda kecil hijau "Baru"
 *  • selain itu → tampilan biasa
 */
export function InvoiceNo({ project, className, size = 'sm' }) {
  const fresh = isNewToday(project)
  const cepat = isCepat(project)
  const txt = size === 'base' ? 'text-base' : 'text-sm'
  if (!fresh && !cepat) return <span className={cx('whitespace-nowrap font-bold', txt, className)}>{invoiceLabel(project.invoice_no)}</span>
  const kapsul = 'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 font-bold text-white'
  if (cepat) return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap', className)}>
      <span title={`Prioritas ${project.about.priority}`} data-invoice-badge="cepat" className={cx(kapsul, 'bg-ink', txt)}>{invoiceLabel(project.invoice_no)}</span>
      {fresh && <span title="Baru diinput hari ini" data-invoice-badge="baru-kecil" className="inline-flex items-center rounded-full bg-emerald-600 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-white">Baru</span>}
    </span>
  )
  return <span title="Baru diinput hari ini" data-invoice-badge="baru" className={cx(kapsul, 'bg-emerald-600', txt, className)}>{invoiceLabel(project.invoice_no)}</span>
}
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
/** Peran pelaksana yang melihat deadline internal H-1 (kecuali prioritas Sameday). */
export const DEADLINE_H1_ROLES = ['penerjemah', 'proofreader', 'otorisator']
/** Deadline dua baris: "7 Nov" / "3 hari lagi" · Hari ini merah, Besok oranye, terlambat merah. */
export function DeadlineCell({ project, done, className, align = 'right' }) {
  const { user } = useApp()
  // Pelaksana (penerjemah/proofreader/otorisator) melihat deadline INTERNAL:
  // H-1 dari deadline pelanggan, supaya masih ada satu hari untuk proofread,
  // otorisasi, cetak & kirim. Khusus Sameday tidak digeser — yang ditampilkan
  // jamnya, karena selisihnya tinggal hitungan jam.
  const pelaksana = DEADLINE_H1_ROLES.includes(user?.role)
  const sameday = (project?.about?.priority || 'Normal') === 'Sameday'
  const geser = pelaksana && !sameday
  const asli = project?.about?.deadline
  const iso = geser && asli ? new Date(new Date(asli).getTime() - 864e5).toISOString() : asli
  if (done) return <span className={cx('block text-xs font-semibold text-emerald-600', className)}>Selesai</span>
  if (!iso) return <span className={cx('block text-xs text-ink-mute', className)}>—</span>
  const dayKeyOf = (d) => WITA_DAY(d)
  const today = new Date(`${WITA_DAY()}T12:00:00+08:00`); const dl = new Date(`${dayKeyOf(new Date(iso))}T12:00:00+08:00`)
  const d = Math.round((dl - today) / 864e5)
  const w = new Date(new Date(iso).getTime() + 8 * 3600e3)
  const jamDl = sameday ? (project?.about?.deadline_time || '17:00').replace(':', '.') : ''
  const date = `${w.getUTCDate()} ${BLN[w.getUTCMonth()]}${jamDl ? ` ${jamDl}` : ''}`
  const judul = geser ? `Deadline internal (H-1). Deadline ke pelanggan: ${new Date(asli).getDate()} ${BLN[new Date(asli).getMonth()]}`
    : sameday ? `Sameday — harus selesai jam ${jamDl} WITA` : undefined
  const [txt, tone] = d < 0 ? [`Terlambat ${-d} hari`, 'text-rose-600'] : d === 0 ? ['Hari ini', 'text-rose-600'] : d === 1 ? ['Besok', 'text-orange-500'] : [`${d} hari lagi`, 'text-ink-mute']
  // Hari ini: seluruh teks dibungkus indikator berkedip merah agar langsung terlihat
  // Hari ini → kapsul merah solid; Besok → kapsul oranye solid (teks putih). Ditentukan per tanggal kalender WITA.
  if (d === 0 || d === 1) return (
    <span className={cx('inline-block leading-tight', align === 'right' ? 'text-right' : 'text-left', className)} data-deadline={geser ? 'h1' : sameday ? 'sameday' : 'asli'} data-deadline-badge={d === 0 ? 'hari-ini' : 'besok'}>
      <span className={cx('inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold text-white', d === 0 ? 'bg-rose-600' : 'bg-orange-500')} title={judul || (d === 0 ? 'Deadline hari ini' : 'Deadline besok')}>{date}</span>
      <span className={cx('block whitespace-nowrap text-[11px] font-semibold', tone)}>{txt}</span>
    </span>
  )
  return (
    <span className={cx('block leading-tight', align === 'right' ? 'text-right' : 'text-left', className)} title={judul} data-deadline={geser ? 'h1' : sameday ? 'sameday' : 'asli'}>
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
