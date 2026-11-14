import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Search, X, ChevronRight } from 'lucide-react'
import { cx } from './ui.jsx'

// ============================================================
//  BARIS ATAS ISI HALAMAN (pengganti top bar global)
//  Kiri: pencarian · kanan: tombol tambah. Satu tempat untuk semua
//  halaman. Halaman yang punya pencarian / tombol tambah sendiri
//  "memindahkan" kontrolnya ke sini lewat <KeAtas slot="cari|tambah">,
//  jadi fungsi & state tetap milik halaman itu (filter, hasil, izin).
//  Halaman tanpa kontrol sendiri memakai bawaan (pencarian global &
//  menu Buat baru).
// ============================================================

const Ctx = createContext(null)

export function SlotProvider({ children }) {
  const [node, setNode] = useState({ cari: null, tambah: null, sesudah: null })
  const [klaim, setKlaim] = useState({ cari: 0, tambah: 0, sesudah: 0 })
  // fungsi stabil (sekali buat) supaya ref tidak berganti tiap render
  const alat = useMemo(() => {
    const ref = (slot) => (el) => { if (el) setNode((n) => (n[slot] === el ? n : { ...n, [slot]: el })) }
    return {
      atur: (slot, d) => setKlaim((k) => ({ ...k, [slot]: Math.max(0, (k[slot] || 0) + d) })),
      pasang: { cari: ref('cari'), tambah: ref('tambah'), sesudah: ref('sesudah') },
    }
  }, [])
  const nilai = useMemo(() => ({ node, klaim, ...alat }), [node, klaim, alat])
  return <Ctx.Provider value={nilai}>{children}</Ctx.Provider>
}

/** Pindahkan kontrol halaman ke baris atas. Di luar layout utama (panel samping, mode klasik) tampil di tempat asalnya. */
export function KeAtas({ slot, children }) {
  const c = useContext(Ctx)
  useEffect(() => { if (!c) return undefined; c.atur(slot, 1); return () => c.atur(slot, -1) }, [slot]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!c) return children
  if (!c.node[slot]) return null
  return createPortal(children, c.node[slot])
}

/** Gaya tombol ikon kanan atas (30–32 px di desktop, 44 px di layar sentuh). */
export const IKON_ATAS = 'relative grid h-11 w-11 shrink-0 place-items-center rounded-lg text-[#4A4F6A] transition hover:bg-[#E9EBF3] hover:text-[#141B34] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand md:h-8 md:w-8 dark:text-slate-300 dark:hover:bg-white/10'

/** Pencarian yang melebar ke kiri saat ikon diklik. Isi input milik halaman (slot "cari"). */
function CariMelebar({ c, bawaan }) {
  const [buka, setBuka] = useState(false)
  const [isi, setIsi] = useState('')
  const [ph, setPh] = useState('Cari')
  const bungkus = useRef(null)
  const tombol = useRef(null)
  const panel = useRef(null)
  const cTerkini = useRef(c); cTerkini.current = c // listener DOM memakai nilai terbaru (hindari closure lama)
  const input = () => cTerkini.current.node.cari?.querySelector('input')
  const baca = () => { setIsi(input()?.value || ''); setPh((input()?.placeholder || 'Cari').replace(/…$/, '')) }
  useEffect(() => { baca(); const t = setTimeout(baca, 400); return () => clearTimeout(t) }, [c.node.cari, c.klaim.cari]) // eslint-disable-line react-hooks/exhaustive-deps
  // Pindah halaman: tutup panel & baca ulang placeholder/isi milik halaman baru
  useEffect(() => {
    const f = () => { setBuka(false); setTimeout(baca, 350) }
    window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const el = panel.current; if (!el) return undefined
    const f = () => baca(); el.addEventListener('input', f); return () => el.removeEventListener('input', f)
  }, [c.klaim.cari]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!buka) return undefined
    const t = setTimeout(() => input()?.focus(), 30)
    const luar = (e) => { if (bungkus.current && !bungkus.current.contains(e.target)) { setBuka(false); baca() } }
    document.addEventListener('mousedown', luar); document.addEventListener('touchstart', luar)
    return () => { clearTimeout(t); document.removeEventListener('mousedown', luar); document.removeEventListener('touchstart', luar) }
  }, [buka]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (panel.current) panel.current.inert = !buka }, [buka, c.klaim.cari]) // tertutup: tidak bisa di-Tab
  const tutup = (fokus) => { setBuka(false); baca(); if (fokus) setTimeout(() => tombol.current?.focus(), 0) }
  // Input berasal dari halaman (portal) → event React tidak naik ke sini; pakai listener DOM asli
  useEffect(() => {
    const el = bungkus.current; if (!el) return undefined
    const kunci = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); tutup(true) } } // preventDefault: input type=search bawaan browser mengosongkan isi saat Esc
    const lepas = (e) => { if (e.target === input() && !el.contains(e.relatedTarget) && !input()?.value) setBuka(false) }
    el.addEventListener('keydown', kunci, true); el.addEventListener('focusout', lepas)
    return () => { el.removeEventListener('keydown', kunci, true); el.removeEventListener('focusout', lepas) }
  }, [c.klaim.cari]) // eslint-disable-line react-hooks/exhaustive-deps
  const hapus = () => {
    const el = input(); if (!el) return
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    set.call(el, ''); el.dispatchEvent(new Event('input', { bubbles: true })); setIsi(''); el.focus()
  }
  // Halaman tanpa pencarian sendiri → ikon membuka pencarian umum (Ctrl K)
  if (!c.klaim.cari) return <>{bawaan}<div ref={c.pasang.cari} hidden data-slot="cari" /></>
  return (
    <div ref={bungkus} className="h-11 w-11 shrink-0 md:relative md:h-8 md:w-8" data-cari-melebar={buka ? 'buka' : 'tutup'}
>
      <button ref={tombol} type="button" onClick={() => setBuka(true)} aria-expanded={buka} aria-label={isi ? `${ph} — aktif: ${isi}` : ph} title={isi ? `Pencarian aktif: “${isi}”` : ph} data-tombol-cari
        className={cx(IKON_ATAS, buka && 'invisible')}>
        <Search className="h-[17px] w-[17px]" aria-hidden="true" />
        {isi && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-brand ring-2 ring-[#F3F4F9] dark:ring-[#0f1424]" aria-hidden="true" />}
      </button>
      {/* panel melebar ke KIRI dari posisi ikon; menimpa (bukan mendorong) kontrol lain */}
      <div ref={panel} role="search" aria-hidden={!buka}
        className={cx('absolute right-0 top-0 z-30 flex h-full items-center gap-1 overflow-hidden rounded-[10px] transition-[width,opacity] duration-200 ease-out motion-reduce:transition-none',
          buka ? 'w-[calc(100vw-32px)] max-w-[360px] bg-[#F3F4F9] opacity-100 md:w-[min(300px,40vw)] md:bg-transparent dark:bg-[#0f1424] md:dark:bg-transparent' : 'pointer-events-none w-0 opacity-0')}>
        <div ref={c.pasang.cari} className="flex h-full min-w-0 flex-1 items-center [&_input]:pr-7 [&>*]:h-full [&>*]:w-full [&>*]:shadow-sm" data-slot="cari" />
        {isi && <button type="button" onClick={hapus} aria-label="Hapus kata pencarian" title="Hapus pencarian" tabIndex={buka ? 0 : -1}
          className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-[#5E6380] hover:bg-slate-100 hover:text-[#141B34]"><X className="h-3.5 w-3.5" aria-hidden="true" /></button>}
        <button type="button" onClick={() => tutup(true)} aria-label="Tutup pencarian" tabIndex={buka ? 0 : -1}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-white text-[#5E6380] shadow-sm ring-1 ring-[#D9DBE7] md:hidden"><ChevronRight className="h-4 w-4" aria-hidden="true" /></button>
      </div>
    </div>
  )
}

/** Baris kontrol paling atas di area isi halaman: kiri = kontrol halaman (filter/urutan/tampilan), kanan = [Cari] [Tim online] [Notifikasi] [+]. */
export function BarisAtas({ cariBawaan, tambahBawaan, ikonLain }) {
  const c = useContext(Ctx)
  if (!c) return null
  return (
    <div className="mb-3 flex min-h-11 flex-wrap items-center gap-2 md:min-h-8" data-baris-atas>
      <div ref={c.pasang.sesudah} className="flex min-w-0 flex-wrap items-center gap-2 empty:hidden" data-slot="sesudah" />
      <div className="relative ml-auto flex shrink-0 items-center gap-0.5 md:gap-1.5" data-ikon-atas>
        <CariMelebar c={c} bawaan={cariBawaan} />
        {ikonLain}
        <div ref={c.pasang.tambah} className="flex shrink-0 items-center" data-slot="tambah">
          {!c.klaim.tambah && tambahBawaan}
        </div>
      </div>
    </div>
  )
}

/** Tombol tambah: ikon + saja (warna utama), ukuran sama dengan ikon lain; label lengkap di tooltip & aria-label. */
export const KELAS_PLUS = 'grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#141B34] text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-60 md:h-8 md:w-8 dark:bg-[var(--brand)]'
export function TombolTambah({ label, onClick, data, disabled, ...rest }) {
  const teks = label ? `Tambah ${label.toLowerCase()}` : 'Buat…'
  return (
    <button type="button" onClick={onClick} disabled={disabled} data-aksi={data} aria-label={teks} title={teks} {...rest} className={KELAS_PLUS}>
      <Plus className="h-[17px] w-[17px]" aria-hidden="true" />
    </button>
  )
}
