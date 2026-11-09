import { cx } from './ui.jsx'
import CopyText, { NominalCopy } from './CopyText.jsx'
import { rupiah } from '../lib/format.js'

// ============================================================
//  TATA LETAK SERAGAM "Keuangan & Pengajuan" — semua tab memakai kolom yang sama:
//  Pengajuan | Nominal | Rekening / Tujuan | Status | Aksi
//  sehingga saat ganti tab, posisi informasi tetap di tempat yang sama.
// ============================================================
// Tiap informasi punya kolomnya sendiri, dan SETIAP kolom memakai bentuk yang sama:
// baris atas = nilai utama, baris bawah = keterangan pendukung. Jadi satu data
// selalu pas 2 baris, lurus dari kolom pertama sampai terakhir.
export const FIN_GRID = 'lg:grid lg:grid-cols-[minmax(0,148px)_minmax(0,1.5fr)_minmax(0,120px)_minmax(0,1.25fr)_minmax(0,1.05fr)_minmax(212px,1.25fr)] lg:items-start lg:gap-4 xl:lg:gap-5'
const COLS = ['Jenis', 'Deskripsi', 'Nominal', 'Rekening / Tujuan', 'Status', 'Aksi']

/** Satu data maksimal 2 baris: apa pun isinya, sel dipotong di baris ke-2 (teks penuh tetap di tooltip). */
export const FIN_CLAMP = '[&_p]:line-clamp-2 [&>span]:line-clamp-2'

/**
 * Satu sel bentuk baku: atas (utama) + bawah (pendukung).
 * Dipakai semua kolom supaya barisnya sejajar dan tidak pernah lebih dari 2 baris.
 */
export function FinCell({ top, bottom, title, strong = true, className }) {
  return (
    <span className={cx('block min-w-0', className)}>
      <span className={cx('block truncate', strong ? 'text-[15px] font-bold leading-snug text-ink' : 'text-sm text-ink')} title={title}>{top}</span>
      {bottom ? <span className="mt-0.5 block truncate text-[13px] leading-snug text-ink-mute">{bottom}</span> : null}
    </span>
  )
}

/** Judul kolom (desktop). */
export function FinHead({ cols = COLS }) {
  return (
    <div className={cx('hidden border-b border-slate-200 bg-slate-50 px-5 py-2.5 text-[11px] font-bold uppercase tracking-wide text-ink-mute', FIN_GRID)}>
      {cols.map((c, i) => <span key={c || i} className={cx(i === 2 && 'lg:text-right', i === 5 && 'lg:text-right')}>{c}</span>)}
    </div>
  )
}

/** Baris alat: kiri (sub-tab / filter), kanan total + tombol utama. Selalu setinggi sama di semua tab. */
export function FinBar({ left, total, right, note }) {
  return (
    // HP: filter satu baris yang bisa digeser, lalu Total & tombol aksi turun ke baris berikutnya.
    // sm ke atas: semuanya kembali dalam satu baris seperti semula.
    <div className="min-h-[40px] border-b border-slate-100 px-4 py-1.5 sm:flex sm:flex-wrap sm:items-center sm:gap-2">
      <div className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none] sm:mx-0 sm:min-w-0 sm:flex-1 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
        {left}{note && <span className="whitespace-nowrap text-[11px] text-ink-mute sm:whitespace-normal">{note}</span>}
      </div>
      {(total !== undefined || right) && (
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 sm:mt-0 sm:contents">
          {total !== undefined && <span className="text-xs font-bold tabular-nums text-ink">Total {rupiah(total)}</span>}
          {right}
        </div>
      )}
    </div>
  )
}

/**
 * Satu baris data. children = 5 sel (atau kurang; sel kosong tetap diberi <span />).
 * Dibuat lega: padding lebih tinggi, jarak antar kolom lebar, dan tiap sel
 * dibatasi 3 baris supaya satu data tidak pernah memanjang ke bawah.
 */
export function FinRow({ children, className, onClick, highlight }) {
  return (
    // [&>*]:block — di HP tiap sel turun ke barisnya sendiri (span inline bisa saling tumpuk)
    // HP: tiap baris jadi kartu berjarak & bergaris, selang-seling putih/abu (pola yang sama dengan halaman Project)
    <li className={cx('px-4 py-3.5 text-sm [&>*]:block sm:px-5', FIN_GRID, FIN_CLAMP, 'space-y-2 lg:space-y-0', 'max-lg:mx-2.5 max-lg:my-2 max-lg:rounded-2xl max-lg:bg-white max-lg:ring-1 max-lg:ring-slate-300 max-lg:odd:bg-slate-100', highlight, onClick && 'cursor-pointer hover:bg-slate-50/70', className)} onClick={onClick}>
      {children}
    </li>
  )
}

/**
 * Sel nominal: tebal, rata kanan di desktop, sub-teks kecil (mis. sumber dana).
 * Tulisan "Rp" sengaja dihilangkan dan diberi ikon copy — yang tersalin hanya
 * angkanya (tanpa titik ribuan), jadi langsung bisa ditempel di m-banking.
 */
export function FinAmount({ value, sub, className, label = 'nominal' }) {
  return (
    <span className={cx('flex items-baseline gap-2 lg:block lg:text-right', className)}>
      <NominalCopy nilai={value} label={label} besar className="lg:justify-end" />
      {sub && <span className="text-xs font-semibold text-ink-mute lg:mt-0.5 lg:block">{sub}</span>}
    </span>
  )
}

/** Sel aksi: selalu rata kanan & dibungkus rapi. */
export function FinActions({ children, className }) {
  // lg: tetap satu baris supaya satu data tidak melebihi 3 baris; di HP boleh turun baris
  return <span className={cx('flex flex-wrap items-center justify-end gap-1.5 lg:flex-nowrap', className)}>{children}</span>
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
