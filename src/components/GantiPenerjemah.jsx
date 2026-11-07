import { useMemo, useState } from 'react'
import { UserCog, Undo2, AlertTriangle } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { Button, cx } from './ui.jsx'
import { GANTI_PENERJEMAH } from '../config/workflows.js'
import { placeOf } from '../config/access.js'
import { jam } from '../lib/format.js'

// ============================================================
//  GANTI PENERJEMAH & TOLAK TUGAS
//  Kenyataan di lapangan: penerjemah kadang minta diganti setelah
//  tugasnya terlanjur dikirim. Dua jalur resmi, dua-duanya WAJIB
//  memakai alasan supaya terekam di riwayat:
//   1. Supervisor/Superadmin → "Ganti Penerjemah" (langsung ke orang lain)
//   2. Penerjemah sendiri    → "Tolak Tugas" (balik ke Pilih Penerjemah)
// ============================================================

export const bolehGanti = (u) => GANTI_PENERJEMAH.includes(u?.role)
/** Penerjemah yang sedang memegang dokumen ini boleh menolaknya. */
export const bolehTolak = (u, sub) => u?.role === 'penerjemah' && (sub?.data?.translator || sub?.translator) === u?.id

/** Catatan penolakan terakhir — tampil di tahap Pilih Penerjemah. */
export function TolakNote({ sub, className }) {
  const d = sub?.data || {}
  if (!d.tolak_note || sub.stage !== 'pilih_penerjemah') return null
  return (
    <div className={cx('flex gap-2 bg-rose-50 p-3 text-xs text-rose-900 ring-1 ring-rose-200', className)}>
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span><b className="font-semibold">Ditolak {d.tolak_name}</b>{d.tolak_at ? ` · ${jam(d.tolak_at)}` : ''}{d.tolak_count > 1 ? ` · penolakan ke-${d.tolak_count}` : ''}: {d.tolak_note}
        <span className="block text-[11px] text-rose-700">Tunjuk penerjemah lain untuk dokumen ini.</span></span>
    </div>
  )
}

/** Catatan penggantian terakhir — tampil di tahap Penerjemahan. */
export function GantiNote({ sub, className }) {
  const d = sub?.data || {}
  if (!d.ganti_note || sub.stage !== 'penerjemahan') return null
  return (
    <div className={cx('flex gap-2 bg-amber-50 p-3 text-xs text-amber-900 ring-1 ring-amber-200', className)}>
      <UserCog className="h-4 w-4 shrink-0" />
      <span><b className="font-semibold">Penerjemah diganti oleh {d.ganti_name}</b>{d.ganti_at ? ` · ${jam(d.ganti_at)}` : ''}
        {d.ganti_dari_nama ? ` · sebelumnya ${d.ganti_dari_nama}` : ''}: {d.ganti_note}</span>
    </div>
  )
}

/** Tombol + form "Ganti Penerjemah" (Supervisor / Superadmin / Direktur / Admin Pusat). */
export function GantiPenerjemahBtn({ project, sub, size = 'sm', className }) {
  const { user, data, gantiPenerjemah, notify, nameOf } = useApp()
  const [buka, setBuka] = useState(false)
  const [ke, setKe] = useState('')
  const [alasan, setAlasan] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const kini = sub?.data?.translator || sub?.translator || ''
  const daftar = useMemo(() => (data.users || []).filter((u) => u.role === 'penerjemah' && u.active !== false && u.id !== kini), [data.users, kini])
  if (!bolehGanti(user) || sub?.stage !== 'penerjemahan') return null

  const kirim = async () => {
    setSibuk(true)
    try {
      await gantiPenerjemah(project, sub.id, ke, alasan)
      notify(`Penerjemah diganti ke ${nameOf(ke) || 'penerjemah baru'}`)
      setBuka(false); setKe(''); setAlasan('')
    } catch (e) { notify(e.message, 'err') } finally { setSibuk(false) }
  }

  if (!buka) return (
    <Button size={size} variant="outline" className={className} onClick={() => setBuka(true)}
      title="Ganti penerjemah yang sedang memegang dokumen ini — wajib isi alasan" data-aksi="ganti-penerjemah">
      <UserCog className="h-3.5 w-3.5" />Ganti Penerjemah
    </Button>
  )
  return (
    <div className="w-full space-y-2 rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200" data-form="ganti-penerjemah">
      <p className="text-xs font-bold text-amber-900">Ganti Penerjemah</p>
      <p className="text-[11px] text-amber-800">Sekarang dipegang <b>{nameOf(kini) || '—'}</b>. Tugas langsung pindah ke penerjemah baru dan keduanya dapat pemberitahuan.</p>
      <label className="block text-xs font-semibold text-ink-soft">Penerjemah pengganti <span className="text-rose-500">*</span>
        <select value={ke} onChange={(e) => setKe(e.target.value)} aria-label="Penerjemah pengganti"
          className="mt-1 h-11 w-full rounded-xl border-0 bg-white px-3 text-sm ring-1 ring-slate-300 focus:ring-2 focus:ring-brand md:h-10">
          <option value="">— Pilih penerjemah —</option>
          {daftar.map((u) => <option key={u.id} value={u.id}>{u.name} · {placeOf(u)}</option>)}
        </select>
      </label>
      <label className="block text-xs font-semibold text-ink-soft">Alasan penggantian <span className="text-rose-500">*</span>
        <textarea rows={2} value={alasan} onChange={(e) => setAlasan(e.target.value)} aria-label="Alasan penggantian"
          placeholder="Contoh: penerjemah sedang penuh / izin sakit / minta dialihkan"
          className="mt-1 w-full rounded-xl border-0 p-3 text-sm ring-1 ring-slate-300 focus:ring-2 focus:ring-brand" />
      </label>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => { setBuka(false); setAlasan('') }}>Batal</Button>
        <Button size="sm" variant="dark" loading={sibuk} disabled={!ke || !alasan.trim()} onClick={kirim}>Ganti &amp; Kirim</Button>
      </div>
    </div>
  )
}

/** Tombol + form "Tolak Tugas" untuk penerjemah yang memegang dokumen. */
export function TolakTugasBtn({ project, sub, onDone, size = 'sm', className, blok }) {
  const { user, tolakTugas, notify } = useApp()
  const [buka, setBuka] = useState(false)
  const [alasan, setAlasan] = useState('')
  const [sibuk, setSibuk] = useState(false)
  if (!bolehTolak(user, sub) || sub?.stage !== 'penerjemahan') return null

  const kirim = async () => {
    setSibuk(true)
    try {
      await tolakTugas(project, sub.id, alasan)
      notify('Tugas ditolak — Supervisor sudah diberi tahu')
      setBuka(false); setAlasan(''); onDone?.()
    } catch (e) { notify(e.message, 'err') } finally { setSibuk(false) }
  }

  if (!buka) return (
    <Button size={size} variant="outline" onClick={() => setBuka(true)} data-aksi="tolak-tugas"
      className={cx('!text-rose-700 !ring-rose-300 hover:!bg-rose-50', blok && 'w-full', className)}
      title="Tolak tugas ini — wajib isi alasan, dokumen kembali ke Supervisor">
      <Undo2 className="h-3.5 w-3.5" />Tolak Project
    </Button>
  )
  return (
    <div className="w-full space-y-2 rounded-xl bg-rose-50 p-3 ring-1 ring-rose-200" data-form="tolak-tugas">
      <p className="text-xs font-bold text-rose-900">Tolak Project</p>
      <p className="text-[11px] text-rose-800">Dokumen kembali ke Supervisor untuk ditunjuk ke penerjemah lain. Alasan Anda ikut terkirim.</p>
      <label className="block text-xs font-semibold text-ink-soft">Alasan <span className="text-rose-500">*</span>
        <textarea rows={2} value={alasan} onChange={(e) => setAlasan(e.target.value)} aria-label="Alasan penolakan"
          placeholder="Contoh: jadwal penuh sampai Jumat / bidangnya di luar kemampuan saya"
          className="mt-1 w-full rounded-xl border-0 p-3 text-sm ring-1 ring-slate-300 focus:ring-2 focus:ring-brand" />
      </label>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => { setBuka(false); setAlasan('') }}>Batal</Button>
        <Button size="sm" variant="dark" loading={sibuk} disabled={!alasan.trim()} onClick={kirim}
          className="!bg-rose-600 hover:!bg-rose-700">Kirim Penolakan</Button>
      </div>
    </div>
  )
}
