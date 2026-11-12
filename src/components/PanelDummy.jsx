// Tombol "Tambah Dummy" / "Hapus semua dummy" — khusus Superadmin, untuk mencoba semua fitur.
import { useState } from 'react'
import { FlaskConical, Loader2, Trash2 } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { db, MODE } from '../lib/db.js'
import { buatDummy, hitungDummy } from '../lib/dummy.js'
import { cx } from './ui.jsx'

export default function PanelDummy({ ringkas }) {
  const { user, data, save, refresh, notify } = useApp()
  const [jml, setJml] = useState(20)
  const [sibuk, setSibuk] = useState('')
  const [progres, setProgres] = useState('')
  // Di versi live (Supabase) panel dummy disembunyikan agar tidak menulis data uji ke database asli.
  if (user?.role !== 'superadmin' || MODE !== 'demo') return null
  const ada = hitungDummy(data.projects)
  const tambah = async () => {
    setSibuk('tambah')
    try {
      const h = await buatDummy({ jumlah: jml, data, user, save, onProgres: (a, b) => setProgres(`${a}/${b}`) })
      notify(`${h.dibuat} project dummy ditambahkan${h.nomorDibuat ? ` · ${h.nomorDibuat} nomor register dummy` : ''}`)
      await refresh?.()
    } catch (e) { notify(`Gagal menambah dummy: ${e.message}`, 'err') } finally { setSibuk(''); setProgres('') }
  }
  const hapus = async () => {
    if (!window.confirm(`Hapus SEMUA data dummy (${ada} project beserta nomor register dummy)? Data asli tidak ikut terhapus.`)) return
    setSibuk('hapus')
    try { const h = await db.hapusDummy(); notify(`Dummy dihapus: ${h?.projects ?? 0} project · ${h?.registrations ?? 0} nomor register`); await refresh?.() }
    catch (e) { notify(`Gagal menghapus dummy: ${e.message}`, 'err') } finally { setSibuk('') }
  }
  return (
    <div className={cx('rounded-lg bg-violet-50 text-ink ring-1 ring-violet-200', ringkas ? 'mx-1.5 my-1.5 p-2' : 'p-3')} data-panel-dummy onClick={(e) => e.stopPropagation()}>
      <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-bold text-violet-900"><FlaskConical className="h-3.5 w-3.5" />Data dummy uji coba <span className="ml-auto rounded-full bg-white px-1.5 text-[11px] font-semibold text-violet-800 ring-1 ring-violet-200">{ada} ada</span></p>
      <div className="flex items-center gap-1.5">
        <select value={jml} onChange={(e) => setJml(Number(e.target.value))} aria-label="Jumlah dummy" className="h-9 rounded-lg border-0 bg-white px-2 text-[12.5px] ring-1 ring-violet-200">
          {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <button type="button" onClick={tambah} disabled={!!sibuk} data-aksi="tambah-dummy" className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-violet-700 px-3 text-[12.5px] font-bold text-white disabled:opacity-60">{sibuk === 'tambah' ? <><Loader2 className="h-4 w-4 animate-spin" />{progres}</> : '+ Tambah Dummy'}</button>
      </div>
      {ada > 0 && <button type="button" onClick={hapus} disabled={!!sibuk} data-aksi="hapus-dummy" className="mt-1.5 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg text-[12px] font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60">{sibuk === 'hapus' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}Hapus semua dummy</button>}
      <p className="mt-1 text-[10.5px] leading-snug text-violet-800/80">Campuran terjemahan tersumpah (semua tahap + nomor register 9xxxxx), non-tersumpah, apostille, legalisasi, titip print, Sameday & telat.</p>
    </div>
  )
}
