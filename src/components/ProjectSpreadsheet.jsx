import { useEffect, useMemo, useRef, useState } from 'react'
import { InvoiceNo } from './badges.jsx'
import { Eye, MoreHorizontal, Search, SlidersHorizontal, X, ArrowUp, ArrowDown, FolderOpen, Printer } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { Button, cx } from './ui.jsx'
import { invoiceLabel } from '../config/access.js'
import { tanggalJam, tanggal } from '../lib/waktu.js'
import { projectRow, TABLE_COLS, sortRows, filterOptions, applyFilters, FILTER_LABEL } from '../lib/projectRow.js'
import { stageLabel, flowOf } from '../config/workflows.js'
import { SUB_TYPES } from '../config/subtypes.js'

const PAGE = 36

/** Lingkaran penanda: hitam = prioritas mendesak, hijau = diinput hari ini,
 *  merah = deadline hari ini, oranye = deadline besok. */
function Lingkar({ warna, judul, children }) {
  if (!warna) return children
  // Kapsul solid (latar penuh, teks putih) — sama dengan aturan kapsul di tampilan List
  const w = { hitam: 'bg-ink', hijau: 'bg-emerald-600', merah: 'bg-rose-600', oranye: 'bg-orange-500' }[warna]
  return (
    <span title={judul} data-kapsul={warna} className={cx('inline-block max-w-full truncate rounded-full px-2 py-0.5 font-semibold text-white', w)}>{children}</span>
  )
}

/** Sel yang isinya bisa lebih dari satu — klik untuk melihat semuanya. */
function SelGanda({ ringkas, semua, align }) {
  const [buka, setBuka] = useState(false)
  if (!semua?.length) return <span className="text-ink-mute">—</span>
  if (semua.length === 1) return <span className="block truncate" title={semua[0]}>{semua[0]}</span>
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); setBuka((b) => !b) }}
      title={semua.join('\n')} aria-expanded={buka}
      className={cx('block w-full min-w-0 text-left hover:underline', align)}>
      {buka
        ? <span className="block space-y-0.5">{semua.map((v, i) => <span key={i} className="block break-words">{v}</span>)}</span>
        : <span className="block truncate">{ringkas}</span>}
    </button>
  )
}

/** Menu titik tiga untuk aksi tambahan. */
function MenuAksi({ row, onFiles, onPrint }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const tutup = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', tutup)
    return () => document.removeEventListener('pointerdown', tutup)
  }, [open])
  return (
    <span ref={ref} className="relative inline-block">
      <button type="button" onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
        title="Tindakan lain" aria-label={`Tindakan lain untuk ${invoiceLabel(row.invoice)}`} aria-haspopup="menu" aria-expanded={open}
        className="grid h-11 w-11 place-items-center rounded-lg text-ink-mute ring-1 ring-slate-200 hover:bg-white hover:text-brand md:h-7 md:w-7">
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <span role="menu" className="absolute right-0 z-30 mt-1 w-44 overflow-hidden rounded-xl bg-white p-1 shadow-xl ring-1 ring-slate-200">
          <button type="button" role="menuitem" onClick={(e) => { e.stopPropagation(); setOpen(false); onFiles(row.p) }}
            title="Buka folder file project"
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-slate-50">
            <FolderOpen className="h-4 w-4 text-ink-mute" />File project
          </button>
          <button type="button" role="menuitem" onClick={(e) => { e.stopPropagation(); setOpen(false); onPrint(row.p) }}
            title="Cetak dokumen sesuai alur dan izin yang berlaku"
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-slate-50">
            <Printer className="h-4 w-4 text-ink-mute" />Cetak dokumen
          </button>
        </span>
      )}
    </span>
  )
}

/** Rincian sub project — tabel sederhana yang muncul di bawah baris induk. */
function BarisSub({ subs, kolom }) {
  if (!subs.length) return <p className="px-3 py-3 text-xs text-ink-mute">Belum ada sub project.</p>
  return (
    <div className="min-w-0 max-w-full overflow-x-auto px-3 py-2">
      <table className="w-full border-collapse text-left text-xs">
        <thead>
          <tr className="text-ink-mute">
            {['#', 'Kategori', 'Judul', 'Arah Bahasa', 'Penerjemah/Vendor', 'Dok.', 'Hlm.', 'Tahap'].map((h) => (
              <th key={h} scope="col" className="whitespace-nowrap px-2 py-1.5 font-bold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {subs.map((x, i) => (
            <tr key={x.id || i} className="border-t border-slate-100">
              <td className="whitespace-nowrap px-2 py-1.5 tabular-nums text-ink-mute">{i + 1}</td>
              <td className="whitespace-nowrap px-2 py-1.5 text-ink-soft">{x.kategori || '—'}</td>
              <td className="max-w-[220px] truncate px-2 py-1.5 font-semibold" title={x.judul}>{x.judul || '—'}</td>
              <td className="whitespace-nowrap px-2 py-1.5">{x.arah || '—'}</td>
              <td className="max-w-[160px] truncate px-2 py-1.5" title={x.orang}>{x.orang || '—'}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{x.dok}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{x.hal}</td>
              <td className="whitespace-nowrap px-2 py-1.5 text-brand">{x.tahap || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function ProjectSpreadsheet({ list, detailFor, onDetail, onFiles, onPrint, state, setState, hideCols = [], renderAksi }) {
  // Kolom yang disembunyikan untuk peran tertentu (mis. pelaksana freelance tidak punya cabang).
  const KOLOM = hideCols.length ? TABLE_COLS.filter((c) => !hideCols.includes(c.key)) : TABLE_COLS
  const { data } = useApp()
  const namaUser = useMemo(() => {
    const peta = new Map()
    for (const u of data.users || []) peta.set(u.id, (u.name || '').replace(/\s*\(.*\)\s*$/, ''))
    for (const o of data.people || []) peta.set(o.id, o.name || '')
    return (id) => peta.get(id) || ''
  }, [data.users, data.people])

  // Pencarian, filter, dan urutan disimpan di induk supaya tetap bertahan
  // ketika panel detail dibuka-tutup atau setelah aksi cetak.
  const { q = '', sortKey = 'timestamp', sortDir = 'desc', filters = {}, shownN = PAGE } = state
  const set = (patch) => setState((s) => ({ ...s, ...patch }))
  const [buka, setBuka] = useState(() => new Set())
  const toggleBaris = (id) => setBuka((v) => { const n = new Set(v); n.has(id) ? n.delete(id) : n.add(id); return n })
  const [filterOpen, setFilterOpen] = useState(false)
  const filterRef = useRef(null)
  useEffect(() => {
    if (!filterOpen) return
    const tutup = (e) => { if (!filterRef.current?.contains(e.target)) setFilterOpen(false) }
    document.addEventListener('pointerdown', tutup)
    return () => document.removeEventListener('pointerdown', tutup)
  }, [filterOpen])

  const semuaRow = useMemo(() => list.map((p) => projectRow(p, namaUser)), [list, namaUser])
  const opsi = useMemo(() => filterOptions(semuaRow), [semuaRow])

  const hasil = useMemo(() => {
    const s = q.trim().toLowerCase()
    let r = semuaRow
    if (s) r = r.filter((x) => invoiceLabel(x.invoice).toLowerCase().includes(s) || x.pelanggan.toLowerCase().includes(s))
    r = applyFilters(r, filters)
    return sortRows(r, sortKey, sortDir) // diurutkan utuh dulu, baru dipotong
  }, [semuaRow, q, filters, sortKey, sortDir])

  const tampil = hasil.slice(0, shownN)
  const chips = Object.entries(filters).filter(([, v]) => v)

  const klikJudul = (key) => {
    if (key === sortKey) set({ sortDir: sortDir === 'asc' ? 'desc' : 'asc' })
    else set({ sortKey: key, sortDir: key === 'timestamp' ? 'desc' : 'asc' })
  }

  const nilai = (r, key) => {
    if (key === 'timestamp') return (
      <Lingkar warna={r.dibuatHariIni ? 'hijau' : ''} judul={r.dibuatHariIni ? 'Diinput hari ini' : tanggalJam(r.timestamp)}>
        <span className="tabular-nums">{tanggalJam(r.timestamp)}</span>
      </Lingkar>)
    if (key === 'invoice') return (
      <Lingkar warna={r.prioMendesak ? 'hitam' : ''} judul={r.prioMendesak ? `Prioritas ${r.prioritas}` : ''}>
        <InvoiceNo project={r.p} />
      </Lingkar>)
    if (key === 'deadline') {
      const w = r.dlHariIni ? 'merah' : r.dlBesok ? 'oranye' : ''
      return (
        <Lingkar warna={w} judul={r.dlHariIni ? 'Deadline hari ini' : r.dlBesok ? 'Deadline besok' : tanggal(r.deadline)}>
          <span className="tabular-nums">{r.deadline ? tanggal(r.deadline) : '—'}</span>
        </Lingkar>)
    }
    if (key === 'arah') return <SelGanda ringkas={r.arah} semua={r.arahAll} />
    if (key === 'orang') return <SelGanda ringkas={r.orang} semua={r.orangAll} />
    if (key === 'layanan') return <SelGanda ringkas={r.layanan} semua={r.layananAll} />
    if (key === 'jmlDok' || key === 'jmlHal') return <span className="block tabular-nums md:text-right">{r[key] || 0}</span>
    if (key === 'prioritas') return <span className={cx('inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold',
      r.prioritas === 'Normal' ? 'bg-slate-100 text-ink-soft' : 'bg-rose-50 text-rose-700 ring-1 ring-rose-200')}>{r.prioritas}</span>
    if (key === 'status') return <span className="block truncate text-xs font-semibold text-brand" title={r.status}>{r.status}</span>
    const v = r[key]
    return <span className="block truncate" title={v}>{v || '—'}</span>
  }

  return (
    <div className="min-w-0 space-y-3">
      {/* ---------- Pencarian & filter ---------- */}
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <label className="relative block min-w-0 flex-1 basis-full sm:basis-60">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" aria-hidden="true" />
          <input value={q} onChange={(e) => set({ q: e.target.value, shownN: PAGE })}
            placeholder="Cari no. invoice atau nama pelanggan…" aria-label="Cari project"
            className="w-full max-w-full rounded-xl border-0 bg-white py-2.5 pl-9 pr-3 text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-brand" />
        </label>
        <span ref={filterRef} className="relative">
          <Button variant="outline" onClick={() => setFilterOpen((o) => !o)} aria-expanded={filterOpen} title="Saring hasil">
            <SlidersHorizontal className="h-4 w-4" />Filter{chips.length > 0 && <span className="ml-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-ink px-1 text-[11px] font-bold text-white">{chips.length}</span>}
          </Button>
          {filterOpen && (
            <div className="absolute right-0 z-30 mt-1 w-[min(92vw,20rem)] max-w-[92vw] space-y-2.5 rounded-xl bg-white p-3 shadow-xl ring-1 ring-slate-200">
              {[['prioritas', opsi.prioritas], ['status', opsi.status], ['cabang', opsi.cabang], ['cs', opsi.cs], ['arah', opsi.arah], ['orang', opsi.orang]].filter(([k]) => !hideCols.includes(k)).map(([k, list]) => (
                <label key={k} className="block">
                  <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-mute">{FILTER_LABEL[k]}</span>
                  <select value={filters[k] || ''} onChange={(e) => set({ filters: { ...filters, [k]: e.target.value }, shownN: PAGE })}
                    className="w-full max-w-full rounded-lg border-0 bg-slate-50 py-2 pl-2.5 pr-7 text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-brand">
                    <option value="">Semua</option>
                    {list.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </label>
              ))}
              {[['Dibuat', 'dibuatDari', 'dibuatSampai'], ['Deadline', 'dlDari', 'dlSampai']].map(([judul, a, b]) => (
                <div key={judul}>
                  <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-mute">{judul}</span>
                  <div className="flex min-w-0 gap-2">
                    {[a, b].map((k) => (
                      <input key={k} type="date" value={filters[k] || ''} aria-label={FILTER_LABEL[k]}
                        onChange={(e) => set({ filters: { ...filters, [k]: e.target.value }, shownN: PAGE })}
                        className="min-w-0 flex-1 rounded-lg border-0 bg-slate-50 px-2 py-2 text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-brand" />
                    ))}
                  </div>
                </div>
              ))}
              <Button variant="outline" className="w-full" onClick={() => { set({ filters: {}, shownN: PAGE }); setFilterOpen(false) }}>Reset semua filter</Button>
            </div>
          )}
        </span>
      </div>

      {/* ---------- Chip filter aktif ---------- */}
      {chips.length > 0 && (
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {chips.map(([k, v]) => (
            <span key={k} className="inline-flex max-w-full items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand">
              <span className="truncate">{FILTER_LABEL[k]}: {v}</span>
              <button type="button" onClick={() => set({ filters: { ...filters, [k]: '' }, shownN: PAGE })}
                aria-label={`Hapus filter ${FILTER_LABEL[k]}`} className="rounded-full p-0.5 hover:bg-white/70"><X className="h-3 w-3" /></button>
            </span>
          ))}
          <button type="button" onClick={() => set({ filters: {}, shownN: PAGE })} className="rounded-full px-2 py-1 text-xs font-semibold text-ink-mute hover:bg-slate-100">Reset</button>
        </div>
      )}

      {/* ---------- Tabel ---------- */}
      {hasil.length === 0 ? (
        <p className="rounded-2xl bg-white px-4 py-10 text-center text-sm text-ink-mute ring-1 ring-slate-200">Tidak ada project yang cocok.</p>
      ) : (
        <div className="min-w-0 max-w-full overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
          <table className="card-table w-full border-collapse text-left align-top text-sm">
            <thead>
              <tr>
                {KOLOM.map((c) => (
                  <th key={c.key} scope="col" style={{ width: c.w, minWidth: c.w }}
                    className={cx('sticky top-0 z-10 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-ink-soft',
                      c.sticky && 'md:left-0 md:z-20')}>
                    <button type="button" onClick={() => klikJudul(c.key)}
                      title={`Urutkan menurut ${c.label}`} aria-label={`Urutkan menurut ${c.label}`}
                      className={cx('inline-flex items-center gap-1 hover:text-ink', c.num && 'md:w-full md:justify-end')}>
                      {c.label}
                      {sortKey === c.key && (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                    </button>
                  </th>
                ))}
                <th scope="col" style={{ width: renderAksi ? '250px' : '104px', minWidth: renderAksi ? '250px' : '104px' }} className="sticky top-0 z-20 whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-ink-soft md:right-0">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {tampil.map((r, i) => (
                <tr key={r.id} onClick={() => toggleBaris(r.id)} aria-expanded={buka.has(r.id)}
                  title="Klik untuk melihat sub project"
                  className={cx('cursor-pointer border-b border-slate-100 align-top last:border-0 md:hover:bg-brand-soft/40',
                    detailFor?.id === r.id ? 'bg-brand-soft/60' : buka.has(r.id) ? 'bg-brand-soft/40' : i % 2 === 1 && 'md:bg-slate-50/60')}>
                  {KOLOM.map((c) => (
                    <td key={c.key} data-label={c.label}
                      className={cx('min-w-0 max-w-full px-3 py-2.5', c.sticky && 'md:sticky md:left-0 md:bg-inherit')}>
                      {nilai(r, c.key)}
                    </td>
                  ))}
                  <td data-label="Aksi" className="px-3 py-2.5 md:sticky md:right-0 md:z-10 md:bg-white md:shadow-[-8px_0_10px_-8px_rgba(15,23,42,.18)]">
                    {renderAksi ? renderAksi(r.p) : <span className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button type="button" onClick={() => onDetail(r.p)} title="Lihat detail project"
                        aria-label={`Lihat detail ${invoiceLabel(r.invoice)}`}
                        className={cx('grid h-11 w-11 place-items-center rounded-lg ring-1 transition md:h-7 md:w-7',
                          detailFor?.id === r.id ? 'bg-brand text-white ring-brand' : 'bg-white text-brand ring-brand/30 hover:bg-brand hover:text-white')}>
                        <Eye className="h-4 w-4" />
                      </button>
                      <MenuAksi row={r} onFiles={onFiles} onPrint={onPrint} />
                    </span>}
                  </td>
                </tr>
              )).flatMap((tr, idx) => {
                const r = tampil[idx]
                if (!buka.has(r.id)) return [tr]
                return [tr, (
                  <tr key={`${r.id}-sub`} className="border-b border-slate-100 bg-slate-50/70">
                    <td colSpan={KOLOM.length + 1} className="p-0">
                      <BarisSub kolom={KOLOM} subs={(r.subs || []).map((x) => ({
                        id: x.id, judul: x.title, kategori: (SUB_TYPES[x.type] || SUB_TYPES.jasa_lain).label,
                        arah: x.lang_from && x.lang_to ? `${x.lang_from} → ${x.lang_to}` : '',
                        orang: namaUser(x.data?.translator || x.translator || x.data?.vendor || ''),
                        dok: x.docs?.length || x.file_count || 0,
                        hal: x.docs?.length ? x.docs.reduce((a, d) => a + (Number(d.pages) || 0), 0) : (Number(x.pages) || 0),
                        // nama tahap yang terbaca, bukan kode mentah ('siap_print')
                        tahap: x.stage ? stageLabel(flowOf(x, r.p), x.stage) : '',
                      }))} />
                    </td>
                  </tr>
                )]
              })}
            </tbody>
          </table>
        </div>
      )}

      {hasil.length > shownN && (
        <Button variant="outline" className="w-full" onClick={() => set({ shownN: shownN + PAGE })}>
          Tampilkan {PAGE} lagi ({hasil.length - shownN} tersisa)
        </Button>
      )}
    </div>
  )
}
