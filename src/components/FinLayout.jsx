import { cx } from './ui.jsx'
import CopyText from './CopyText.jsx'
import { rupiah } from '../lib/format.js'

// ============================================================
//  TATA LETAK SERAGAM "Keuangan & Pengajuan" — semua tab memakai kolom yang sama:
//  Pengajuan | Nominal | Rekening / Tujuan | Status | Aksi
//  sehingga saat ganti tab, posisi informasi tetap di tempat yang sama.
// ============================================================
export const FIN_GRID = 'lg:grid lg:grid-cols-[minmax(0,1.5fr)_112px_minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,1.7fr)] lg:items-center lg:gap-3'
const COLS = ['Pengajuan', 'Nominal', 'Rekening / Tujuan', 'Status', 'Aksi']

/** Judul kolom (desktop). */
export function FinHead({ cols = COLS }) {
  return (
    <div className={cx('hidden border-b border-slate-100 bg-slate-50 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-mute', FIN_GRID)}>
      {cols.map((c, i) => <span key={c} className={cx(i === 1 && 'lg:text-right', i === 4 && 'lg:text-right')}>{c}</span>)}
    </div>
  )
}

/** Baris alat: kiri (sub-tab / filter), kanan total + tombol utama. Selalu setinggi sama di semua tab. */
export function FinBar({ left, total, right, note }) {
  return (
    <div className="flex min-h-[40px] flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-1.5">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">{left}{note && <span className="text-[11px] text-ink-mute">{note}</span>}</div>
      {total !== undefined && <span className="text-xs font-bold tabular-nums text-ink">Total {rupiah(total)}</span>}
      {right}
    </div>
  )
}

/** Satu baris data. children = 5 sel (atau kurang; sel kosong tetap diberi <span />). */
export function FinRow({ children, className, onClick, highlight }) {
  return (
    <li className={cx('px-4 py-2 text-sm', FIN_GRID, 'space-y-1.5 lg:space-y-0', highlight, onClick && 'cursor-pointer hover:bg-slate-50/70', className)} onClick={onClick}>
      {children}
    </li>
  )
}

/** Sel nominal: tebal, rata kanan di desktop, sub-teks kecil (mis. sumber dana). */
export function FinAmount({ value, sub, className }) {
  return (
    <span className={cx('flex items-baseline gap-2 lg:block lg:text-right', className)}>
      <b className="text-sm font-extrabold tabular-nums text-ink">{rupiah(value)}</b>
      {sub && <span className="text-[11px] font-semibold text-ink-mute lg:block">{sub}</span>}
    </span>
  )
}

/** Sel aksi: selalu rata kanan & dibungkus rapi. */
export function FinActions({ children, className }) {
  return <span className={cx('flex flex-wrap items-center justify-end gap-1.5', className)}>{children}</span>
}

/** Rekening ringkas: BANK · nomor (copy) / nama penerima. */
export function Rek({ acc, empty = '—', emptyHref }) {
  if (!acc?.number) return emptyHref ? <a href={emptyHref} className="text-xs font-semibold text-rose-600 hover:underline">{empty}</a> : <span className="text-xs text-ink-mute">{empty}</span>
  return (
    <span className="block min-w-0 text-xs leading-tight">
      <span className="flex items-center gap-1.5"><b className="shrink-0 text-ink">{acc.bank}</b><CopyText text={acc.number} label="No. Rekening" strong mono /></span>
      <span className="block truncate text-ink-mute"><CopyText text={acc.holder} label="Nama Penerima" /></span>
    </span>
  )
}

/** Sumber dana (chip kecil hitam). */
export const DanaChip = ({ code }) => (code ? <span className="rounded-md bg-ink px-1.5 py-0.5 text-[10px] font-bold text-white" title="Sumber dana">{code}</span> : null)
