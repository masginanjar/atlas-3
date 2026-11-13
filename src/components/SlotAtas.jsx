import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus } from 'lucide-react'

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

/** Baris kontrol paling atas di area isi halaman. */
export function BarisAtas({ cariBawaan, tambahBawaan }) {
  const c = useContext(Ctx)
  if (!c) return null
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2" data-baris-atas>
      <div ref={c.pasang.cari} className="flex min-w-0 flex-[1_1_220px] items-center sm:max-w-[420px]" data-slot="cari">
        {!c.klaim.cari && cariBawaan}
      </div>
      <div ref={c.pasang.sesudah} className="flex min-w-0 flex-wrap items-center gap-2 empty:hidden" data-slot="sesudah" />
      <div ref={c.pasang.tambah} className="ml-auto flex shrink-0 items-center gap-2" data-slot="tambah">
        {!c.klaim.tambah && tambahBawaan}
      </div>
    </div>
  )
}

/** Tombol tambah standar di kanan baris atas: ikon + label di desktop, ikon saja (dengan aria-label) di HP. */
export function TombolTambah({ label, onClick, data, disabled, ...rest }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} data-aksi={data} aria-label={`Tambah ${label.toLowerCase()}`} title={`Tambah ${label.toLowerCase()}`} {...rest}
      className="inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-[10px] bg-[#141B34] md:h-9 md:min-w-9 px-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60 sm:px-4 dark:bg-[var(--brand)]">
      <Plus className="h-[18px] w-[18px]" aria-hidden="true" /><span className="hidden sm:inline">{label}</span>
    </button>
  )
}
