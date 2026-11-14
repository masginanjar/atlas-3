import { useRef, useState } from 'react'
import { Upload, Eye, Trash2, Loader2, Lock } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { drive } from '../lib/integrations.js'
import { kindOf } from '../lib/printing.js'
import { Button, Card, Field, Input, Textarea, cx } from './ui.jsx'
import MiniPratinjau from './MiniPratinjau.jsx'

// ============================================================
//  DATA PRIBADI KARYAWAN (rahasia): KTP, KK, alamat tinggal,
//  kontak darurat, tempat & tanggal lahir.
//  Disimpan TERPISAH dari data pengguna (tabel `data_pribadi`) supaya
//  hanya pemilik + Superadmin + Direktur yang bisa membaca — dibatasi
//  di database (RLS), bukan hanya disembunyikan di layar.
//  Berkas KTP/KK disimpan di folder "pribadi/<id pengguna>/" yang juga dikunci.
// ============================================================

export const BOLEH_LIHAT_SEMUA = ['superadmin', 'direktur']
const KOSONG = { tempat_lahir: '', tanggal_lahir: '', alamat: '', darurat_nama: '', darurat_hubungan: '', darurat_telp: '' }
const BATAS_MB = 10
const TIPE = 'image/*,application/pdf'

function BerkasIdentitas({ label, nilai, onUnggah, onHapus, bisaUbah }) {
  const { notify } = useApp()
  const input = useRef(null)
  const [sibuk, setSibuk] = useState(false)
  const pilih = async (e) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    if (file.size > BATAS_MB * 1048576) return notify(`${label}: lebih dari ${BATAS_MB} MB`, 'err')
    if (!/^image\/|application\/pdf/.test(file.type)) return notify(`${label}: hanya foto atau PDF`, 'err')
    setSibuk(true)
    try { await onUnggah(file) } catch (er) { notify(er?.message || `Gagal mengunggah ${label}`, 'err') } finally { setSibuk(false) }
  }
  const lihat = async () => {
    try { const b = await drive.blob(nilai); window.open(URL.createObjectURL(b), '_blank', 'noopener') } catch (er) { notify(er?.message || 'Berkas tidak bisa dibuka', 'err') }
  }
  const jenis = nilai ? kindOf(nilai) : null
  return (
    <div className="flex items-center gap-3 rounded-xl p-3 ring-1 ring-slate-200 dark:ring-white/10" data-berkas-pribadi={label}>
      <div className="grid h-[76px] w-[60px] shrink-0 place-items-center overflow-hidden rounded-md bg-slate-100 dark:bg-white/5">
        {nilai && ['pdf', 'image'].includes(jenis)
          ? <MiniPratinjau key={nilai.path || nilai.name} f={nilai} jenis={jenis} ambilBlob={(f) => drive.blob(f)} fallback={<span className="text-[10px] font-bold text-ink-mute">{jenis === 'pdf' ? 'PDF' : 'FOTO'}</span>} />
          : <span className="px-1 text-center text-[10px] font-semibold text-ink-mute">Belum ada</span>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-ink">{label}</p>
        <p className="truncate text-xs text-ink-mute">{nilai ? nilai.name : 'Foto atau PDF, maks. 10 MB'}</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {nilai && <button type="button" onClick={lihat} className="inline-flex h-9 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold ring-1 ring-slate-200 hover:bg-slate-50"><Eye className="h-3.5 w-3.5" />Lihat</button>}
          {bisaUbah && <button type="button" onClick={() => input.current?.click()} disabled={sibuk} className="inline-flex h-9 items-center gap-1 rounded-lg bg-[#141B34] px-2.5 text-xs font-semibold text-white disabled:opacity-60">
            {sibuk ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}{nilai ? 'Ganti' : 'Unggah'}</button>}
          {bisaUbah && nilai && <button type="button" onClick={onHapus} aria-label={`Hapus ${label}`} className="inline-flex h-9 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /></button>}
        </div>
        <input ref={input} type="file" accept={TIPE} className="hidden" onChange={pilih} aria-label={`Unggah ${label}`} />
      </div>
    </div>
  )
}

/** Kartu data pribadi seorang pengguna (`target` = baris users). Pemilik bisa mengubah; Superadmin/Direktur bisa melihat & mengubah. */
export default function DataPribadi({ target }) {
  const { user, data, save, notify } = useApp()
  const milikSendiri = target.id === user.id
  const bolehLihat = milikSendiri || BOLEH_LIHAT_SEMUA.includes(user.role)
  const baris = (data.data_pribadi || []).find((r) => r.user_id === target.id)
  const awal = { ...KOSONG, ...(baris || {}) }
  const [f, setF] = useState(awal)
  const [busy, setBusy] = useState(false)
  if (!bolehLihat) return null
  const bidang = Object.keys(KOSONG)
  const dirty = bidang.some((k) => (f[k] || '') !== (awal[k] || ''))
  const simpan = async (extra = {}) => {
    const row = { ...(baris || {}), ...Object.fromEntries(bidang.map((k) => [k, (f[k] || '').trim()])), ...extra, user_id: target.id, diubah_oleh: user.id, diubah_at: new Date().toISOString() }
    return save('data_pribadi', row)
  }
  const simpanForm = async () => {
    if (f.darurat_telp && !/^[+\d][\d\s-]{6,}$/.test(f.darurat_telp.trim())) return notify('Nomor darurat tidak valid', 'err')
    setBusy(true)
    try { await simpan(); notify('Data pribadi disimpan') } catch (e) { notify(e.message, 'err') } finally { setBusy(false) }
  }
  const unggah = (kunci) => async (file) => {
    const up = await drive.upload(file, { branch: 'pribadi', invoice: target.id }, `${kunci}-${file.name}`)
    await simpan({ [kunci]: up }); notify(`${kunci.toUpperCase()} tersimpan`)
  }
  const hapus = (kunci) => async () => { await simpan({ [kunci]: null }); notify(`${kunci.toUpperCase()} dihapus`) }

  return (
    <Card className="space-y-4 p-5" data-data-pribadi>
      <div className="flex items-start gap-2">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-ink-mute" aria-hidden="true" />
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-ink-mute">Data pribadi (rahasia)</p>
          <p className="mt-0.5 text-[12px] text-ink-mute">Hanya {milikSendiri ? 'Anda' : target.name}, Superadmin, dan Direktur yang bisa melihat bagian ini.</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <BerkasIdentitas label="KTP" nilai={baris?.ktp} bisaUbah onUnggah={unggah('ktp')} onHapus={hapus('ktp')} />
        <BerkasIdentitas label="Kartu Keluarga (KK)" nilai={baris?.kk} bisaUbah onUnggah={unggah('kk')} onHapus={hapus('kk')} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tempat lahir"><Input value={f.tempat_lahir} onChange={(e) => setF({ ...f, tempat_lahir: e.target.value })} placeholder="mis. Denpasar" autoComplete="off" /></Field>
        <Field label="Tanggal lahir"><Input type="date" value={f.tanggal_lahir} onChange={(e) => setF({ ...f, tanggal_lahir: e.target.value })} max={new Date().toISOString().slice(0, 10)} /></Field>
        <div className="sm:col-span-2"><Field label="Alamat tempat tinggal"><Textarea rows={2} value={f.alamat} onChange={(e) => setF({ ...f, alamat: e.target.value })} placeholder="Jalan, nomor, RT/RW, kelurahan, kecamatan, kota" autoComplete="street-address" /></Field></div>
      </div>
      <div>
        <p className="mb-2 text-[13px] font-semibold text-ink-soft">Nomor darurat</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Nama"><Input value={f.darurat_nama} onChange={(e) => setF({ ...f, darurat_nama: e.target.value })} autoComplete="off" /></Field>
          <Field label="Hubungan"><Input value={f.darurat_hubungan} onChange={(e) => setF({ ...f, darurat_hubungan: e.target.value })} placeholder="mis. Istri, Ayah" autoComplete="off" /></Field>
          <Field label="No. telepon"><Input value={f.darurat_telp} onChange={(e) => setF({ ...f, darurat_telp: e.target.value })} inputMode="tel" placeholder="08xx…" autoComplete="off" /></Field>
        </div>
      </div>
      <div className={cx('flex items-center gap-2 border-t border-slate-100 pt-4 dark:border-white/10')}>
        <Button size="sm" loading={busy} disabled={!dirty} onClick={simpanForm}>Simpan data pribadi</Button>
        {dirty && <button type="button" onClick={() => setF(awal)} className="text-xs font-semibold text-ink-mute hover:text-ink">Batalkan</button>}
        {baris?.diubah_at && <span className="ml-auto text-[11px] text-ink-mute">Terakhir diubah {new Date(baris.diubah_at).toLocaleDateString('id-ID')}</span>}
      </div>
    </Card>
  )
}
