// ============================================================
//  PENGIRIMAN — modul Shipping Everpro.
//  Ringkasan · Daftar · Buat · Cek Ongkir · Draft & Impor · Buku Alamat & Cabang ·
//  Label & Serah Terima · Kendala · Saldo & Mutasi · Laporan · Pengaturan.
//  Hak akses: Operasional (buat/label/lacak/kendala), Keuangan (saldo/mutasi/laporan),
//  Admin (pengaturan). Data cabang dibatasi RLS di server.
// ============================================================
import { lazy, Suspense, useEffect, useState } from 'react'
import { Truck, Loader2 } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { Tabs, Empty } from '../components/ui.jsx'
import { go } from '../lib/router.js'
import { bolehOps, bolehKeu, bolehPenting, PERAN_OPS, PERAN_KEU } from '../lib/kirim.js'
import { IS_DEMO } from '../lib/kirim.js'

const Ringkasan = lazy(() => import('../components/kirim/Ringkasan.jsx'))
const Daftar = lazy(() => import('../components/kirim/Daftar.jsx'))
const Buat = lazy(() => import('../components/kirim/Buat.jsx'))
const CekOngkir = lazy(() => import('../components/kirim/CekOngkir.jsx'))
const DraftImpor = lazy(() => import('../components/kirim/DraftImpor.jsx'))
const Saldo = lazy(() => import('../components/kirim/Saldo.jsx'))
const Laporan = lazy(() => import('../components/kirim/Laporan.jsx'))
const BukuAlamat = lazy(() => import('../components/kirim/Lainnya.jsx').then((m) => ({ default: m.BukuAlamat })))
const LabelSerah = lazy(() => import('../components/kirim/Lainnya.jsx').then((m) => ({ default: m.LabelSerah })))
const Kendala = lazy(() => import('../components/kirim/Lainnya.jsx').then((m) => ({ default: m.Kendala })))
const PengaturanKirim = lazy(() => import('../components/kirim/Lainnya.jsx').then((m) => ({ default: m.PengaturanKirim })))

export const PERAN_PENGIRIMAN = [...new Set([...PERAN_OPS, ...PERAN_KEU])]
export const canSeePengiriman = (u) => PERAN_PENGIRIMAN.includes(u?.role)

export default function Pengiriman({ tab, id }) {
  const { user } = useApp()
  const [filterDaftar, setFilterDaftar] = useState(null)
  const tabs = [
    { value: 'ringkasan', label: 'Ringkasan' },
    { value: 'daftar', label: 'Daftar Pengiriman' },
    bolehOps(user) && { value: 'buat', label: 'Buat Pengiriman' },
    { value: 'ongkir', label: 'Cek Ongkir' },
    bolehOps(user) && { value: 'draft', label: 'Draft & Impor' },
    { value: 'alamat', label: 'Buku Alamat & Cabang' },
    bolehOps(user) && { value: 'label', label: 'Label & Serah Terima' },
    { value: 'kendala', label: 'Kendala, Retur & Klaim' },
    bolehKeu(user) && { value: 'saldo', label: 'Saldo & Mutasi' },
    bolehPenting(user) && { value: 'laporan', label: 'Laporan' },
    bolehPenting(user) && { value: 'pengaturan', label: 'Pengaturan' },
  ].filter(Boolean)
  const aktif = tabs.some((t) => t.value === tab) ? tab : tab === 'kurir' ? 'pengaturan' : 'ringkasan'
  useEffect(() => { if (tab !== 'daftar') setFilterDaftar(null) }, [tab])
  if (!canSeePengiriman(user)) return <Empty icon={Truck} title="Tidak ada akses" text="Menu Pengiriman untuk tim operasional dan keuangan." />
  const pilih = (v) => go(v === 'ringkasan' ? 'pengiriman' : `pengiriman/${v}`)
  return (
    <div className="w-full space-y-3" data-halaman="pengiriman">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-[17px] font-extrabold leading-tight tracking-tight">Pengiriman <span className="text-[12px] font-semibold text-ink-mute">· Everpro</span></h1>
        {IS_DEMO && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200">Demo: data & tarif contoh, tanpa booking sungguhan</span>}
      </div>
      <Tabs tabs={tabs} value={aktif} onChange={pilih} />
      <Suspense fallback={<p className="flex items-center gap-2 p-4 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Memuat…</p>}>
        {aktif === 'ringkasan' && <Ringkasan bukaDaftar={(f) => { setFilterDaftar(f); go('pengiriman/daftar') }} />}
        {aktif === 'daftar' && <Daftar awal={filterDaftar} onBuat={() => go('pengiriman/buat')} />}
        {aktif === 'buat' && <Buat key={id || 'baru'} id={id} />}
        {aktif === 'ongkir' && <CekOngkir />}
        {aktif === 'draft' && <DraftImpor />}
        {aktif === 'alamat' && <BukuAlamat />}
        {aktif === 'label' && <LabelSerah />}
        {aktif === 'kendala' && <Kendala />}
        {aktif === 'saldo' && <Saldo />}
        {aktif === 'laporan' && <Laporan />}
        {aktif === 'pengaturan' && <PengaturanKirim />}
      </Suspense>
    </div>
  )
}
