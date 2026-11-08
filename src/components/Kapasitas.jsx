import { useMemo, useState } from 'react'
import { Gauge, Plus, Check, X, Clock } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { Button, Card, Field, Input, Sheet, Textarea, cx } from './ui.jsx'
import { branchesOf, placeOf, rolesOf } from '../config/access.js'
import TimeAgo from './TimeAgo.jsx'

// ============================================================
//  KAPASITAS HARIAN PENERJEMAH
//  Semua orang mulai dengan 10 halaman/hari. Kalau sanggup lebih,
//  penerjemah mengajukan angkanya sendiri dan Direktur
//  yang menyetujui — bukan diubah diam-diam.
// ============================================================

export const KAP_DEFAULT = 10
/**
 * Kapasitas harian seseorang (halaman/hari).
 * Sumbernya pengajuan yang TERAKHIR disetujui — bukan kolom di tabel users,
 * karena Direktur memang tidak boleh (dan tidak perlu) mengubah data user.
 * Belum pernah ada yang disetujui = 10.
 */
export function kapasitasHarian(u, rows) {
  const disetujui = (rows || [])
    .filter((k) => k.user_id === u?.id && k.status === 'disetujui' && Number(k.ke) > 0)
    .sort((a, b) => String(a.diputus_at || a.at || '').localeCompare(String(b.diputus_at || b.at || '')))
  if (disetujui.length) return Number(disetujui[disetujui.length - 1].ke)
  return Number(u?.kapasitas_harian) || KAP_DEFAULT
}
/** Peran yang punya kapasitas harian. */
export const PUNYA_KAPASITAS = ['penerjemah']
export const punyaKapasitas = (u) => PUNYA_KAPASITAS.some((r) => rolesOf(u).includes(r))
/** Peran yang boleh menyetujui penambahan kapasitas. */
export const bolehAccKapasitas = (u) => ['superadmin', 'direktur', 'supervisor'].some((r) => rolesOf(u).includes(r))

const STATUS = {
  diajukan: ['Menunggu persetujuan', 'bg-amber-50 text-amber-800 ring-amber-200'],
  disetujui: ['Disetujui', 'bg-emerald-50 text-emerald-700 ring-emerald-200'],
  ditolak: ['Ditolak', 'bg-slate-100 text-slate-600 ring-slate-200'],
}

/**
 * Strip kapasitas untuk penerjemah sendiri — tampil di My Project.
 * Menunjukkan angkanya, lalu tombol mengajukan penambahan.
 */
export function KapasitasSaya({ className }) {
  const { user, data, save, notify } = useApp()
  const [form, setForm] = useState(null)
  const [sibuk, setSibuk] = useState(false)
  const pengajuan = useMemo(() => (data.kapasitas || []).filter((k) => k.user_id === user?.id), [data.kapasitas, user])
  const kap = kapasitasHarian(user, data.kapasitas)
  const menunggu = pengajuan.find((k) => k.status === 'diajukan')
  if (!punyaKapasitas(user)) return null

  const kirim = async () => {
    const ke = Number(form.ke)
    if (!ke || ke < 1) return notify('Isi angka kapasitas yang diajukan', 'err')
    if (ke <= kap) return notify(`Angkanya harus lebih dari kapasitas sekarang (${kap} halaman/hari)`, 'err')
    setSibuk(true)
    try {
      await save('kapasitas', {
        user_id: user.id, nama: user.name, cabang: branchesOf(user)[0] || user.branch || '',
        dari: kap, ke, alasan: form.alasan || '', status: 'diajukan', at: new Date().toISOString(),
      })
      await save('notifications', { to_role: 'supervisor', ...(branchesOf(user)[0] || user.branch ? { to_branch: branchesOf(user)[0] || user.branch } : {}),
        kind: 'kapasitas', text: `${user.name} mengajukan tambah kapasitas: ${kap} → ${ke} halaman/hari`, by: user.name, read_by: [] }).catch(() => {})
      notify('Pengajuan dikirim — menunggu persetujuan Direktur')
      setForm(null)
    } catch (e) { notify(e.message || 'Gagal mengirim', 'err') } finally { setSibuk(false) }
  }

  return (
    <>
      <div className={cx('flex flex-wrap items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200', className)} data-kapasitas-saya>
        <Gauge className="h-4 w-4 shrink-0 text-brand" />
        <span className="text-xs text-ink-soft">Kapasitas harian saya <b className="text-sm text-ink" data-kap-angka>{kap}</b> halaman/hari</span>
        {menunggu ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 ring-1 ring-amber-200" data-kap-menunggu>
            <Clock className="h-3 w-3" />Diajukan jadi {menunggu.ke} — menunggu persetujuan
          </span>
        ) : (
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => setForm({ ke: kap + 5, alasan: '' })} data-aksi="ajukan-kapasitas">
            <Plus className="h-3.5 w-3.5" />Ajukan Tambah Kapasitas
          </Button>
        )}
      </div>

      <Sheet open={!!form} onClose={() => setForm(null)} title="Ajukan Tambah Kapasitas"
        subtitle="Disetujui dulu oleh Direktur"
        footer={<>
          <Button variant="outline" className="flex-1 sm:flex-none sm:px-6" onClick={() => setForm(null)}>Batal</Button>
          <Button className="flex-[2]" variant="dark" loading={sibuk} onClick={kirim} data-aksi="kirim-kapasitas">Kirim Pengajuan</Button>
        </>}>
        {form && (
          <div className="space-y-3">
            <p className="rounded-xl bg-slate-50 p-3 text-xs text-ink-soft ring-1 ring-slate-200">
              Kapasitas Anda sekarang <b className="text-ink">{kap} halaman/hari</b>. Sebutkan angka baru yang Anda sanggupi.
            </p>
            <Field label="Kapasitas baru (halaman/hari)" required>
              <Input type="number" min={kap + 1} inputMode="numeric" value={form.ke}
                onChange={(e) => setForm((f) => ({ ...f, ke: e.target.value }))} aria-label="Kapasitas baru" />
            </Field>
            <Field label="Alasan" hint="Opsional — membantu Direktur memutuskan.">
              <Textarea rows={3} value={form.alasan} onChange={(e) => setForm((f) => ({ ...f, alasan: e.target.value }))}
                placeholder="mis. dokumennya sejenis dan saya sudah terbiasa" aria-label="Alasan pengajuan kapasitas" />
            </Field>
          </div>
        )}
      </Sheet>

      {pengajuan.filter((k) => k.status !== 'diajukan').slice(0, 3).length > 0 && (
        <ul className="mt-1.5 space-y-1 text-[11px] text-ink-mute">
          {pengajuan.filter((k) => k.status !== 'diajukan').slice(0, 3).map((k) => (
            <li key={k.id}>Pengajuan {k.dari} → {k.ke} halaman/hari: <b className={k.status === 'disetujui' ? 'text-emerald-700' : 'text-ink-soft'}>{STATUS[k.status][0]}</b>{k.catatan ? ` — ${k.catatan}` : ''}</li>
          ))}
        </ul>
      )}
    </>
  )
}

/** Daftar pengajuan kapasitas untuk Direktur / Superadmin. */
export function KapasitasAcc() {
  const { user, data, save, notify, branchFilter } = useApp()
  const [catatan, setCatatan] = useState({})
  const semuaCabang = ['superadmin', 'direktur'].some((r) => rolesOf(user).includes(r))
  const milik = branchesOf(user)
  const rows = useMemo(() => (data.kapasitas || [])
    .filter((k) => k.status === 'diajukan')
    // Penerjemah freelance tidak terikat cabang — pengajuannya terlihat oleh
    // semua Direktur, supaya tidak menggantung tanpa yang menyetujui.
    .filter((k) => semuaCabang ? (branchFilter === 'Semua' || !branchFilter || !k.cabang || k.cabang === branchFilter) : (!k.cabang || milik.includes(k.cabang))),
  [data.kapasitas, semuaCabang, milik, branchFilter])

  if (!bolehAccKapasitas(user) || rows.length === 0) return null

  const putuskan = async (k, status) => {
    try {
      // Angka barunya cukup tersimpan di baris pengajuan ini — tidak perlu
      // (dan tidak boleh) mengubah data user, supaya Direktur tetap bisa ACC.
      await save('kapasitas', { ...k, status, catatan: catatan[k.id] || '', diputus_oleh: user.name, diputus_at: new Date().toISOString() })
      await save('notifications', { to_user: k.user_id, kind: 'kapasitas',
        text: status === 'disetujui' ? `Kapasitas harian Anda dinaikkan jadi ${k.ke} halaman/hari` : `Pengajuan tambah kapasitas (${k.ke} halaman/hari) ditolak${catatan[k.id] ? ` — ${catatan[k.id]}` : ''}`,
        by: user.name, read_by: [] }).catch(() => {})
      notify(status === 'disetujui' ? `Kapasitas ${k.nama} jadi ${k.ke} halaman/hari` : 'Pengajuan ditolak')
    } catch (e) { notify(e.message || 'Gagal menyimpan', 'err') }
  }

  return (
    <Card className="p-4" data-acc-kapasitas>
      <p className="mb-2 flex items-center gap-2 text-sm font-bold text-ink">
        <Gauge className="h-4 w-4 text-brand" />Pengajuan Tambah Kapasitas
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">{rows.length} menunggu</span>
      </p>
      <div className="space-y-2">
        {rows.map((k) => (
          <div key={k.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200" data-kap-row={k.id}>
            <p className="min-w-0 flex-1 text-xs text-ink">
              <b>{k.nama}</b> · {k.cabang} · <b className="tabular-nums">{k.dari} → {k.ke}</b> halaman/hari
              {k.alasan ? <span className="text-ink-soft"> · {k.alasan}</span> : null}
              <span className="ml-1 text-ink-mute"><TimeAgo at={k.at} /></span>
            </p>
            <Input value={catatan[k.id] || ''} onChange={(e) => setCatatan((c) => ({ ...c, [k.id]: e.target.value }))}
              placeholder="Catatan (opsional)" aria-label={`Catatan untuk ${k.nama}`} className="!h-9 !w-full !py-1 text-xs sm:!w-44" />
            <Button size="sm" onClick={() => putuskan(k, 'disetujui')} data-aksi="setujui-kapasitas"><Check className="h-3.5 w-3.5" />Setujui</Button>
            <Button size="sm" variant="outline" onClick={() => putuskan(k, 'ditolak')}><X className="h-3.5 w-3.5" />Tolak</Button>
          </div>
        ))}
      </div>
    </Card>
  )
}

/** Satu baris ringkas kapasitas seseorang — dipakai di kartu Kapasitas Penerjemah. */
export const labelKapasitas = (u, rows) => `${kapasitasHarian(u, rows)} hal/hari${placeOf(u) ? ` · ${placeOf(u)}` : ''}`
