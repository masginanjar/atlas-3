import { useMemo, useState } from 'react'
import { ArrowUp, ArrowDown, Search, X } from 'lucide-react'
import { cx } from './ui.jsx'
import { KeAtas } from './SlotAtas.jsx'

/**
 * Sortir & saring untuk tabel biasa di seluruh aplikasi.
 *
 * Pemakaian:
 *   const { rows, sortKey, sortDir, klikJudul, cari, setCari } = useTabel(data, KOLOM)
 *   <Th kolom={c} sortKey={sortKey} sortDir={sortDir} onKlik={klikJudul} />
 *
 * KOLOM = [{ key, label, num, sort: (row) => nilai, cari: (row) => teks }]
 * Kolom tanpa `sort` tetap tampil sebagai judul biasa (mis. kolom Aksi).
 */
export function useTabel(semua, kolom, { awalKey = '', awalDir = 'asc' } = {}) {
  const [sortKey, setSortKey] = useState(awalKey)
  const [sortDir, setSortDir] = useState(awalDir)
  const [cari, setCari] = useState('')

  const klikJudul = (k) => {
    const c = kolom.find((x) => x.key === k)
    if (!c?.sort) return
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(k); setSortDir('asc') }
  }
  const resetSortir = () => { setSortKey(awalKey); setSortDir(awalDir) }

  const rows = useMemo(() => {
    let out = semua || []
    const q = cari.trim().toLowerCase()
    if (q) {
      const teksDari = (r) => kolom
        .map((c) => (c.cari ? c.cari(r) : c.sort ? c.sort(r) : ''))
        .join(' ')
        .toLowerCase()
      out = out.filter((r) => teksDari(r).includes(q))
    }
    const c = kolom.find((x) => x.key === sortKey && x.sort)
    if (!c) return out
    const arah = sortDir === 'asc' ? 1 : -1
    return [...out].sort((a, b) => {
      const x = c.sort(a), y = c.sort(b)
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * arah
      return String(x ?? '').localeCompare(String(y ?? ''), 'id') * arah
    })
  }, [semua, kolom, sortKey, sortDir, cari])

  return { rows, sortKey, sortDir, klikJudul, resetSortir, cari, setCari }
}

/** Judul kolom yang bisa diklik untuk mengurutkan. */
export function Th({ kolom: c, sortKey, sortDir, onKlik, className }) {
  const aktif = sortKey === c.key
  return (
    <th scope="col" style={c.w ? { width: c.w } : undefined}
      className={cx('h-9 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 text-[11px] font-bold uppercase tracking-wide text-ink-mute',
        c.num ? 'text-right' : 'text-left', className)}>
      {c.sort ? (
        <button type="button" onClick={() => onKlik(c.key)}
          title={`Urutkan menurut ${c.label}`} aria-label={`Urutkan menurut ${c.label}`}
          aria-sort={aktif ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
          className={cx('inline-flex items-center gap-1 hover:text-ink', c.num && 'w-full justify-end')}>
          {c.label}
          {aktif && (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
        </button>
      ) : c.label}
    </th>
  )
}

/** Kolom cari ringkas untuk toolbar tabel — tinggi 34px. */
export function CariTabel({ value, onChange, label = 'Cari di tabel', className, atas }) {
  // atas: dipindah ke baris atas isi halaman (kiri), gaya seragam dengan pencarian halaman lain
  if (atas) return (
    <KeAtas slot="cari">
      <span className="relative flex h-11 w-full min-w-0 items-center gap-2 rounded-[10px] md:h-9 border border-[#D9DBE7] bg-white px-3 dark:border-white/15 dark:bg-white/5" data-cari-halaman>
        <Search className="h-[18px] w-[18px] shrink-0 text-[#5E6380]" aria-hidden="true" />
        <input type="search" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} placeholder={label}
          className="h-full min-w-0 flex-1 border-0 !bg-transparent p-0 !ring-0 !shadow-none text-sm text-[#141B34] outline-none placeholder:text-[#8A8FA8] focus:ring-0 dark:text-slate-100" />
      </span>
    </KeAtas>
  )
  return (
    <span className={cx('relative inline-block min-w-0', className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-mute" />
      <input value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} placeholder={label}
        className="h-[34px] w-full min-w-0 rounded-lg border-0 bg-white pl-8 pr-7 text-[13px] text-ink ring-1 ring-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand" />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Hapus pencarian"
          className="absolute right-1 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-ink-mute hover:bg-slate-100 hover:text-ink">
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  )
}
