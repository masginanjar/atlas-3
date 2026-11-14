import { useState } from 'react'
import { Maximize2, PanelTopClose, Minus, Plus, Star, X, Save, RotateCcw, ChevronDown, Settings2 } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { Button, Input, Popover, Sheet, cx } from './ui.jsx'
import UnduhData from './UnduhData.jsx'
import { DENSITIES } from '../lib/density.js'
import { PREF_BAWAAN } from '../lib/tampilanProject.js'

// ============================================================
//  MENU "TAMPILAN ▾" HALAMAN PROJECT
//  Satu tempat untuk semua pengaturan cara melihat daftar: layar penuh
//  data, sembunyikan toolbar, ukuran, kerapatan, zebra/garis, kolom, dan
//  tampilan tersimpan. PC = popover, HP = lembar bawah. Hanya mengubah
//  tampilan — data, saringan, dan kolom datanya tidak tersentuh.
// ============================================================

export const ZOOM_STEPS = [70, 80, 90, 100, 110, 125, 150]
const KEY_VIEWS = 'atlas-views'
const KEY_DEFAULT = 'atlas-views-default'
export const muatViews = () => { try { return JSON.parse(localStorage.getItem(KEY_VIEWS) || '[]') } catch { return [] } }
export const viewBawaan = () => { try { return localStorage.getItem(KEY_DEFAULT) || '' } catch { return '' } }

function Baris({ k, children }) {
  return <div className="flex min-h-[40px] items-center gap-2 rounded-lg px-1.5"><span className="flex-1 text-[12.5px] font-semibold text-ink">{k}</span>{children}</div>
}
function Seg({ value, onChange, opsi }) {
  return (
    <div className="flex gap-0.5 rounded-lg bg-slate-100 p-0.5">
      {opsi.map(([v, l]) => <button key={v} type="button" onClick={() => onChange(v)} aria-pressed={value === v} className={cx('h-8 rounded-md px-2.5 text-[11px] font-semibold', value === v ? 'bg-ink text-white' : 'text-ink-soft hover:text-ink')}>{l}</button>)}
    </div>
  )
}
function Saklar({ on, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={cx('relative h-6 w-10 shrink-0 rounded-full transition', on ? 'bg-[#141B34]' : 'bg-slate-300')}>
      <span className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition', on ? 'left-[18px]' : 'left-0.5')} />
    </button>
  )
}
function Judul({ children }) { return <p className="mt-3 px-1.5 text-[10.5px] font-extrabold uppercase tracking-wider text-ink-mute first:mt-0">{children}</p> }

/**
 * Isi menu. props:
 *  pref/setPref — preferensi tampilan (lib/tampilanProject)
 *  zoom/setZoom, density/setDensity, full/setFull
 *  view — 'list' | 'tabel'; kolom — { COLUMNS, colsAktif, saveCols, semua } (opsional)
 *  current/apply — untuk tampilan tersimpan
 */
export function TampilanPanel({ pref, setPref, zoom, setZoom, density, setDensity, setFull, view, setView, kolom, kolomTabel, current, apply, close, hp }) {
  const { notify } = useApp()
  const set = (k, v) => setPref({ ...pref, [k]: v })
  const zi = ZOOM_STEPS.indexOf(zoom) === -1 ? ZOOM_STEPS.indexOf(100) : ZOOM_STEPS.indexOf(zoom)
  const step = (d) => setZoom(ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, zi + d))])
  const [views, setViews] = useState(muatViews)
  const [def, setDef] = useState(viewBawaan)
  const [nama, setNama] = useState('')
  const [simpan, setSimpan] = useState(false)
  const persist = (next) => { setViews(next); try { localStorage.setItem(KEY_VIEWS, JSON.stringify(next)) } catch { /* abaikan */ } }
  const jadikanBawaan = (n) => { const v = def === n ? '' : n; setDef(v); try { localStorage.setItem(KEY_DEFAULT, v) } catch { /* abaikan */ } }
  const simpanView = () => {
    const n = nama.trim(); if (!n) return notify('Beri nama tampilan dulu', 'err')
    persist([...views.filter((v) => v.name !== n), { name: n, ...current, pref, zoom, density }])
    setNama(''); setSimpan(false); notify(`Tampilan "${n}" disimpan`)
  }
  const ringkasView = (v) => [v.status === 'selesai' ? 'Selesai' : v.status === 'semua' ? 'Semua status' : 'Aktif', v.view === 'tabel' ? 'tabel' : 'kartu', v.sort === 'baru' ? 'urut terbaru' : 'urut deadline', v.cepat === 'hambatan' ? 'hambatan' : null, v.dlFilter ? 'deadline' : null, v.zoom && v.zoom !== 100 ? `${v.zoom}%` : null].filter(Boolean).join(' · ')

  return (
    <div className={cx('space-y-0.5', hp && 'pb-2')} data-menu-tampilan>
      {setView && (
        <div className="mb-2 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1" role="group" aria-label="Bentuk daftar" data-saklar-view>
          {[['list', 'Kartu'], ['tabel', 'Tabel']].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setView(k)} aria-pressed={view === k} data-view={k}
              className={cx('h-10 rounded-lg text-[13px] font-bold transition', view === k ? 'bg-white text-ink shadow-sm ring-1 ring-slate-200' : 'text-ink-mute hover:text-ink')}>{l}</button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 pb-1">
        <button type="button" onClick={() => { setFull(true); close?.() }} data-tampilan="layar-penuh"
          className="flex min-h-[72px] flex-col items-start gap-1 rounded-xl p-3 text-left ring-1 ring-slate-200 hover:ring-brand">
          <Maximize2 className="h-4 w-4 text-brand" /><b className="text-[12.5px]">Layar penuh data</b><span className="text-[10.5px] leading-tight text-ink-mute">Hanya tabel/kartu, tanpa menu & toolbar. Esc untuk keluar.</span>
        </button>
        <button type="button" onClick={() => { set('toolbar', !pref.toolbar); close?.() }} aria-pressed={!pref.toolbar} data-tampilan="sembunyikan-toolbar"
          className={cx('flex min-h-[72px] flex-col items-start gap-1 rounded-xl p-3 text-left ring-1 hover:ring-brand', pref.toolbar ? 'ring-slate-200' : 'bg-brand-soft/60 ring-brand')}>
          <PanelTopClose className="h-4 w-4 text-brand" /><b className="text-[12.5px]">{pref.toolbar ? 'Sembunyikan toolbar' : 'Tampilkan toolbar'}</b><span className="text-[10.5px] leading-tight text-ink-mute">Judul, cari, strip & saringan dilipat jadi satu baris tipis.</span>
        </button>
      </div>

      <Judul>Daftar</Judul>
      <Baris k="Ukuran teks">
        <div className="flex items-center rounded-lg bg-slate-100 p-0.5">
          <button type="button" onClick={() => step(-1)} disabled={zi === 0} aria-label="Perkecil" className="grid h-8 w-8 place-items-center rounded-md text-ink-soft hover:bg-white disabled:opacity-30"><Minus className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={() => setZoom(100)} className="min-w-[48px] rounded-md bg-ink px-1 text-center text-[11px] font-bold tabular-nums text-white" title="Klik untuk 100%">{zoom}%</button>
          <button type="button" onClick={() => step(1)} disabled={zi === ZOOM_STEPS.length - 1} aria-label="Perbesar" className="grid h-8 w-8 place-items-center rounded-md text-ink-soft hover:bg-white disabled:opacity-30"><Plus className="h-3.5 w-3.5" /></button>
        </div>
      </Baris>
      <Baris k="Kerapatan baris"><Seg value={density} onChange={setDensity} opsi={DENSITIES} /></Baris>
      <Baris k="Selang-seling warna"><Saklar on={pref.zebra} onChange={(v) => set('zebra', v)} label="Selang-seling warna" /></Baris>
      <Baris k="Garis antar baris"><Saklar on={pref.garis} onChange={(v) => set('garis', v)} label="Garis antar baris" /></Baris>
      <Baris k="Teks panjang"><Seg value={pref.lipat ? 'lipat' : 'potong'} onChange={(v) => set('lipat', v === 'lipat')} opsi={[['potong', 'Potong…'], ['lipat', 'Lipat baris']]} /></Baris>
      <Baris k="Kelompokkan menurut tenggat"><Saklar on={pref.grup} onChange={(v) => set('grup', v)} label="Kelompokkan menurut tenggat" /></Baris>
      <Baris k="Garis urgensi di tepi kiri"><Saklar on={pref.urgensi} onChange={(v) => set('urgensi', v)} label="Garis urgensi" /></Baris>
      <Baris k="Stepper tahap"><Saklar on={pref.stepper} onChange={(v) => set('stepper', v)} label="Stepper tahap" /></Baris>
      <Baris k="Baris pelaksana di bawah tahap"><Saklar on={pref.pelaksana} onChange={(v) => set('pelaksana', v)} label="Baris pelaksana" /></Baris>

      {view === 'tabel' && <>
        <Judul>Tabel</Judul>
        <Baris k="Ukuran tabel"><Seg value={pref.ukuranTabel || 'normal'} onChange={(v) => set('ukuranTabel', v)} opsi={[['kecil', 'Kecil'], ['normal', 'Normal'], ['besar', 'Besar']]} /></Baris>
        <Baris k="Kolom invoice menempel kiri"><Saklar on={pref.stickyKiri} onChange={(v) => set('stickyKiri', v)} label="Kolom invoice menempel kiri" /></Baris>
        <Baris k="Judul kolom menempel atas"><Saklar on={pref.stickyAtas} onChange={(v) => set('stickyAtas', v)} label="Judul kolom menempel atas" /></Baris>
        <Baris k="Lebar kolom"><Seg value={pref.lebar} onChange={(v) => set('lebar', v)} opsi={[['pas', 'Pas isi'], ['rata', 'Rata']]} /></Baris>
        {kolomTabel && <>
          <p className="px-1.5 pt-1 text-[11px] font-semibold text-ink-soft">Kolom tabel</p>
          <div className="grid grid-cols-2 gap-x-2 px-1.5">
            {kolomTabel.map((c) => {
              const on = !pref.tabelCols || pref.tabelCols.includes(c.key)
              return (
                <label key={c.key} className="flex min-h-[32px] cursor-pointer items-center gap-2 text-[12px]">
                  <input type="checkbox" checked={on} disabled={c.key === 'invoice'}
                    onChange={(e) => { const semua = kolomTabel.map((x) => x.key); const next = e.target.checked ? semua.filter((k) => k === c.key || !pref.tabelCols || pref.tabelCols.includes(k)) : semua.filter((k) => k !== c.key && (!pref.tabelCols || pref.tabelCols.includes(k))); set('tabelCols', next.length === semua.length ? null : next) }}
                    className="h-4 w-4 rounded border-slate-300 text-brand disabled:opacity-40" />{c.label}
                </label>
              )
            })}
          </div>
          <p className="px-1.5 text-[10.5px] text-ink-mute">Lebar kolom bisa ditarik dari batas judul kolom di tabel.</p>
        </>}
      </>}
      {view === 'list' && kolom && <>
        <Judul>Kolom daftar</Judul>
        <div className="grid grid-cols-2 gap-x-2 px-1.5">
          {kolom.COLUMNS.map((c) => (
            <label key={c.key} className="flex min-h-[34px] cursor-pointer items-center gap-2 text-[12px]">
              <input type="checkbox" checked={kolom.colsAktif.includes(c.key)} disabled={c.key === 'invoice'}
                onChange={(e) => kolom.saveCols(e.target.checked ? kolom.semua.filter((k) => k === c.key || kolom.colsAktif.includes(k)) : kolom.colsAktif.filter((k) => k !== c.key))}
                className="h-4 w-4 rounded border-slate-300 text-brand disabled:opacity-40" />{c.label}
            </label>
          ))}
        </div>
        <button type="button" onClick={() => kolom.saveCols(kolom.semua)} className="px-1.5 text-left text-xs font-semibold text-brand hover:underline">Tampilkan semua kolom</button>
      </>}

      <Judul>Toolbar</Judul>
      <Baris k="Strip “Perlu Anda”"><Saklar on={pref.strip} onChange={(v) => set('strip', v)} label="Strip Perlu Anda" /></Baris>
      <Baris k="Panel saringan (map)"><Saklar on={pref.panel} onChange={(v) => set('panel', v)} label="Panel saringan" /></Baris>

      <div className="flex items-center justify-between border-t border-slate-100 px-1.5 pt-2"><span className="text-[12.5px] font-semibold">Unduh data</span><UnduhData /></div>

      <Judul>Tampilan tersimpan</Judul>
      {views.length === 0 && <p className="px-1.5 text-xs text-ink-mute">Belum ada. Atur saringan & tampilan, lalu simpan di bawah.</p>}
      <ul className="space-y-0.5">
        {views.map((v) => (
          <li key={v.name} className={cx('flex items-center gap-1 rounded-lg px-1', current?.name === v.name && 'bg-brand-soft/60')}>
            <button type="button" onClick={() => jadikanBawaan(v.name)} aria-label={def === v.name ? 'Hapus sebagai bawaan' : 'Jadikan bawaan'} title={def === v.name ? 'Bawaan saat halaman dibuka' : 'Jadikan bawaan saat halaman dibuka'}
              className={cx('grid h-8 w-8 shrink-0 place-items-center rounded-md', def === v.name ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400')}><Star className="h-4 w-4" fill={def === v.name ? 'currentColor' : 'none'} /></button>
            <button type="button" onClick={() => { apply(v); close?.() }} className="min-w-0 flex-1 rounded-lg py-1 text-left hover:text-brand">
              <span className="block truncate text-[12.5px] font-bold">{v.name}</span>
              <span className="block truncate text-[10.5px] text-ink-mute">{ringkasView(v)}</span>
            </button>
            <button type="button" onClick={() => { persist(views.filter((x) => x.name !== v.name)); if (def === v.name) jadikanBawaan(v.name) }} aria-label={`Hapus tampilan ${v.name}`} className="grid h-8 w-8 place-items-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600"><X className="h-3.5 w-3.5" /></button>
          </li>
        ))}
      </ul>
      {simpan ? (
        <div className="flex gap-1.5 px-1 pt-1">
          <Input autoFocus value={nama} onChange={(e) => setNama(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && simpanView()} placeholder="Nama tampilan, mis. Pagi — deadline" className="!h-10 !text-xs" aria-label="Nama tampilan" />
          <Button size="sm" className="!h-10" onClick={simpanView}><Save className="h-3.5 w-3.5" />Simpan</Button>
        </div>
      ) : (
        <div className="flex gap-1.5 px-1 pt-1">
          <Button variant="outline" size="sm" className="!h-10 flex-1" onClick={() => { setPref({ ...PREF_BAWAAN }); setZoom(100); setDensity('comfortable') }}><RotateCcw className="h-3.5 w-3.5" />Kembalikan bawaan</Button>
          <Button size="sm" variant="dark" className="!h-10 flex-[1.3]" onClick={() => setSimpan(true)} data-aksi="simpan-tampilan"><Plus className="h-3.5 w-3.5" />Simpan tampilan ini…</Button>
        </div>
      )}
      <p className="px-1.5 pt-1 text-[10.5px] text-ink-mute">Tampilan tersimpan memuat saringan, urutan, kolom, dan pengaturan di atas. ★ = dibuka otomatis saat masuk halaman Project.</p>
    </div>
  )
}

/** Tombol "Tampilan ▾": popover di PC, lembar bawah di HP. */
export default function TampilanMenu({ compact, ...props }) {
  const [sheet, setSheet] = useState(false)
  const aktif = props.pref && (!props.pref.zebra || !props.pref.garis || props.pref.lipat || props.zoom !== 100)
  return (
    <>
      <button type="button" onClick={() => setSheet(true)} aria-label="Tampilan" data-aksi="tampilan"
        className={cx('relative grid shrink-0 place-items-center sm:hidden', compact ? 'h-8 w-8 rounded-full bg-white/15 text-white' : cx('h-11 w-11 rounded-[10px] bg-white ring-1 ring-slate-200', aktif ? 'text-brand' : 'text-ink-mute'))}>
        <Settings2 className="h-4 w-4" />{aktif && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-brand" />}
      </button>
      <div className="hidden sm:block">
        <Popover label="Tampilan" width="w-[360px]" panelClass="max-h-[min(78vh,720px)] overflow-y-auto" button={({ open, toggle }) => (
          compact
            ? <button type="button" onClick={toggle} aria-expanded={open} aria-label="Tampilan" data-aksi="tampilan" className="grid h-8 w-8 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25"><Settings2 className="h-4 w-4" /></button>
            : <button type="button" onClick={toggle} aria-expanded={open} data-aksi="tampilan"
              className={cx('flex h-11 shrink-0 items-center gap-1.5 rounded-lg bg-white px-2.5 text-[13px] font-semibold ring-1 transition md:h-8 dark:bg-white/5', open ? 'text-brand ring-brand' : 'text-ink-soft ring-slate-200 hover:text-brand')}>
              <Settings2 className="h-4 w-4" />Tampilan{props.setView && <span className="font-medium text-ink-mute">· {props.view === 'tabel' ? 'Tabel' : 'Kartu'}</span>}<ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </button>
        )}>
          {({ close }) => <TampilanPanel {...props} close={close} />}
        </Popover>
      </div>
      <Sheet open={sheet} onClose={() => setSheet(false)} title="Tampilan">
        <TampilanPanel {...props} close={() => setSheet(false)} hp />
      </Sheet>
    </>
  )
}
