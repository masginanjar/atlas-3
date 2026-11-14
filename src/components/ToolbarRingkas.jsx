import { CalendarRange, SlidersHorizontal, X } from 'lucide-react'
import { Input, Popover, cx } from './ui.jsx'
import { tgl } from '../lib/format.js'

// ============================================================
//  TOOLBAR RINGKAS
//  Dua alat yang dipakai berulang di beberapa halaman supaya barisnya
//  tidak penuh: pemilih periode (gabungan tombol cepat + tanggal bebas)
//  dan tombol "Filter" yang menampung saringan yang jarang diubah.
//  Tidak ada fungsi yang hilang — hanya pindah satu ketukan.
// ============================================================

export const hariIni = () => new Date().toISOString().slice(0, 10)
export const tambahHari = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }

/** Daftar periode cepat yang sama di semua halaman. */
export const periodeCepat = (today = hariIni()) => [
  ['Hari ini', { from: today, to: today }],
  ['Kemarin', { from: tambahHari(today, -1), to: tambahHari(today, -1) }],
  ['7 hari', { from: tambahHari(today, -6), to: today }],
  ['30 hari', { from: tambahHari(today, -29), to: today }],
  ['Bulan ini', { from: `${today.slice(0, 7)}-01`, to: today }],
  ['Semua', { from: '', to: '' }],
]

/** Nama periode yang sedang aktif — dipakai sebagai label tombol. */
export function labelPeriode(range, today = hariIni(), pilihan) {
  const daftar = pilihan || periodeCepat(today)
  const sama = daftar.find(([, v]) => v.from === (range.from || '') && v.to === (range.to || ''))
  if (sama) return sama[0]
  if (range.from && range.to) return `${tgl(range.from)} – ${tgl(range.to)}`
  if (range.from) return `sejak ${tgl(range.from)}`
  if (range.to) return `s/d ${tgl(range.to)}`
  return 'Semua'
}

/**
 * Pemilih periode: satu tombol, isinya tombol cepat + tanggal bebas.
 * Menggantikan 5 tombol + 2 kolom tanggal yang sebelumnya berbaris di layar.
 */
export function PilihPeriode({ range, setRange, today = hariIni(), pilihan, className, label = 'Periode' }) {
  const daftar = pilihan || periodeCepat(today)
  const aktif = labelPeriode(range, today, daftar)
  const bawaan = !range.from && !range.to
  return (
    <Popover label={label} width="min-w-[260px]" button={({ open, toggle }) => (
      <button type="button" onClick={toggle} aria-expanded={open} aria-label={`${label}: ${aktif}`} title={`${label} — pilih cepat atau tanggal sendiri`}
        data-pilih-periode
        className={cx('flex h-11 shrink-0 items-center gap-1.5 rounded-lg bg-white px-2.5 text-[13px] font-semibold ring-1 transition md:h-8 dark:bg-white/5',
          open ? 'text-brand ring-brand' : bawaan ? 'text-ink-mute ring-slate-200 hover:text-brand' : 'text-ink ring-slate-300 hover:text-brand', className)}>
        <CalendarRange className="h-4 w-4 shrink-0" />
        <span className="max-w-[130px] truncate">{aktif}</span>
      </button>
    )}>
      {({ close }) => (
        <div className="space-y-2">
          <p className="px-1 text-[11px] font-bold uppercase tracking-wide text-ink-mute">{label}</p>
          <div className="grid grid-cols-2 gap-1">
            {daftar.map(([nama, v]) => {
              const on = v.from === (range.from || '') && v.to === (range.to || '')
              return (
                <button key={nama} type="button" onClick={() => { setRange(v); close() }} aria-pressed={on}
                  className={cx('rounded-lg px-2 py-1.5 text-xs font-semibold', on ? 'bg-ink text-white' : 'text-ink-soft ring-1 ring-slate-200 hover:text-brand')}>{nama}</button>
              )
            })}
          </div>
          <div className="border-t border-slate-100 pt-2">
            <p className="mb-1 px-1 text-[11px] font-bold uppercase tracking-wide text-ink-mute">Tanggal sendiri</p>
            <div className="flex items-center gap-1.5">
              <Input type="date" value={range.from || ''} onChange={(e) => setRange({ ...range, from: e.target.value })} className="!h-9 min-w-0 flex-1 !py-1 text-xs" aria-label="Dari tanggal" />
              <span className="text-xs text-ink-mute">–</span>
              <Input type="date" value={range.to || ''} min={range.from || undefined} onChange={(e) => setRange({ ...range, to: e.target.value })} className="!h-9 min-w-0 flex-1 !py-1 text-xs" aria-label="Sampai tanggal" />
            </div>
          </div>
        </div>
      )}
    </Popover>
  )
}

/**
 * Tombol "Filter" untuk saringan yang jarang diubah. Angka kecil di
 * tombolnya menunjukkan berapa saringan yang sedang hidup, jadi tidak perlu
 * dibuka hanya untuk memastikan.
 */
export function FilterLainnya({ aktif = 0, onReset, children, label = 'Filter' }) {
  return (
    <Popover label="Filter lainnya" width="min-w-[250px]" button={({ open, toggle }) => (
      <button type="button" onClick={toggle} aria-expanded={open} aria-label={aktif ? `${label}, ${aktif} sedang aktif` : label}
        title="Saringan lain" data-filter-lainnya
        className={cx('flex h-11 shrink-0 items-center gap-1.5 rounded-lg bg-white px-2.5 text-[13px] font-semibold ring-1 transition md:h-8 dark:bg-white/5',
          open ? 'text-brand ring-brand' : aktif ? 'text-brand ring-brand/40' : 'text-ink-mute ring-slate-200 hover:text-brand')}>
        <SlidersHorizontal className="h-4 w-4 shrink-0" />
        <span className="hidden sm:inline">{label}</span>
        {aktif > 0 && <span className="grid h-4 min-w-[16px] place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-white" data-filter-jml>{aktif}</span>}
      </button>
    )}>
      {({ close }) => (
        <div className="space-y-2">
          <p className="px-1 text-[11px] font-bold uppercase tracking-wide text-ink-mute">Saringan</p>
          {children}
          {aktif > 0 && onReset && (
            <button type="button" onClick={() => { onReset(); close() }}
              className="flex w-full items-center gap-1.5 border-t border-slate-100 px-1 pt-2 text-left text-xs font-bold text-rose-600 hover:underline" data-reset-filter>
              <X className="h-3.5 w-3.5" />Hapus semua saringan
            </button>
          )}
        </div>
      )}
    </Popover>
  )
}

/** Deretan penanda saringan aktif — bisa dilepas satu per satu. */
export function ChipAktif({ items = [], className }) {
  const ada = items.filter(Boolean)
  if (!ada.length) return null
  return (
    <div className={cx('flex flex-wrap items-center gap-1.5', className)} data-chip-aktif>
      {ada.map((c) => (
        <span key={c.label} className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand">
          {c.label}
          <button type="button" onClick={c.clear} aria-label={`Hapus saringan ${c.label}`} className="grid h-4 w-4 place-items-center rounded-full hover:bg-brand hover:text-white"><X className="h-3 w-3" /></button>
        </span>
      ))}
    </div>
  )
}
