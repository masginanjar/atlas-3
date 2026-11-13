import { useMemo, useState } from 'react'
import { Handshake, Plus, Pencil, Trash2, Phone, Mail } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { Button, Card, Empty, Field, Input, Select, Sheet, Textarea, cx } from '../components/ui.jsx'
import { useTabel, Th, CariTabel } from '../components/TabelSortir.jsx'
import { BRANCHES, branchesOf } from '../config/access.js'
import { canSeeMitra, canEditMitra, mitraSemuaCabang, mitraTerlihat, mitraBaru, cekMitra, JENIS_MITRA, STATUS_MITRA } from '../lib/mitra.js'
import { KeAtas, TombolTambah } from '../components/SlotAtas.jsx'
import { tgl } from '../lib/format.js'

export { canSeeMitra }

const WARNA_STATUS = { Aktif: 'bg-emerald-50 text-emerald-700 ring-emerald-200', Jeda: 'bg-amber-50 text-amber-800 ring-amber-200', Berhenti: 'bg-slate-100 text-ink-mute ring-slate-200' }

const KOLOM = [
  { key: 'nama', label: 'Nama Mitra', w: '22%', sort: (r) => String(r.nama || '').toLowerCase(), cari: (r) => r.nama },
  { key: 'jenis', label: 'Jenis', w: '13%', sort: (r) => String(r.jenis || '').toLowerCase(), cari: (r) => r.jenis },
  { key: 'pic', label: 'PIC', w: '15%', sort: (r) => String(r.pic || '').toLowerCase(), cari: (r) => `${r.pic || ''} ${r.telepon || ''} ${r.email || ''}` },
  { key: 'kontak', label: 'Kontak', w: '18%', sort: (r) => String(r.telepon || '').toLowerCase() },
  { key: 'cabang', label: 'Cabang', w: '11%', sort: (r) => String(r.cabang || '').toLowerCase(), cari: (r) => r.cabang },
  { key: 'mulai', label: 'Mulai', w: '11%', sort: (r) => String(r.mulai || '') },
  { key: 'status', label: 'Status', w: '10%', sort: (r) => String(r.status || '').toLowerCase() },
]

/**
 * MITRA — daftar kemitraan per cabang, diisi manual oleh CS.
 * Bentuknya sengaja dibuat sama dengan Pelanggan supaya tidak perlu belajar
 * tampilan baru; bedanya data ini tidak dirangkum dari project.
 */
export default function Mitra() {
  const { user, data, branchFilter, save, remove, notify, ask } = useApp()
  const semuaCabang = mitraSemuaCabang(user)
  const bolehUbah = canEditMitra(user)
  const cabangSaya = branchesOf(user)
  const [form, setForm] = useState(null)   // null | objek mitra yang sedang diisi
  const [fJenis, setFJenis] = useState('')
  const [fStatus, setFStatus] = useState('')

  const semua = useMemo(() => mitraTerlihat(data.mitra || [], user, branchFilter), [data.mitra, user, branchFilter])
  const tersaring = useMemo(() => semua.filter((r) => (!fJenis || r.jenis === fJenis) && (!fStatus || r.status === fStatus)), [semua, fJenis, fStatus])
  const { rows, sortKey, sortDir, klikJudul, cari, setCari } = useTabel(tersaring, KOLOM, { awalKey: 'nama' })

  const pilihanCabang = semuaCabang ? BRANCHES : cabangSaya

  const simpan = async () => {
    const salah = cekMitra(form)
    if (salah) return notify(salah, 'err')
    if (!semuaCabang && !cabangSaya.includes(form.cabang)) return notify('Hanya bisa menambah mitra di cabang sendiri', 'err')
    try {
      await save('mitra', { ...form, nama: form.nama.trim() })
      notify(form.id ? 'Mitra diperbarui' : 'Mitra ditambahkan')
      setForm(null)
    } catch (e) { notify(e.message || 'Gagal menyimpan', 'err') }
  }
  const hapus = async (r) => {
    const yakin = await ask?.({ title: 'Hapus mitra?', text: `${r.nama} akan dihapus dari daftar mitra.`, ok: 'Hapus' })
    if (yakin === false) return
    try { await remove('mitra', r.id); notify('Mitra dihapus') }
    catch (e) { notify(e.message || 'Gagal menghapus', 'err') }
  }

  if (!canSeeMitra(user)) return <Card><Empty icon={Handshake} title="Tidak punya akses" text="Halaman Mitra hanya untuk Superadmin, Direktur, dan CS." /></Card>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[17px] font-extrabold leading-tight tracking-tight" title={semuaCabang ? 'Kemitraan seluruh cabang — diisi manual oleh CS masing-masing' : `Kemitraan cabang ${cabangSaya.join(', ')} — diisi manual oleh CS`}>Mitra</h1>
        </div>
        {bolehUbah && (
          <KeAtas slot="tambah"><TombolTambah label="Mitra" onClick={() => setForm(mitraBaru(semuaCabang ? (branchFilter !== 'Semua' ? branchFilter : '') : cabangSaya[0]))} data="mitra-baru" /></KeAtas>
        )}
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50/70 px-3 py-2">
          <CariTabel atas value={cari} onChange={setCari} label="Cari mitra…" />
          <select value={fJenis} onChange={(e) => setFJenis(e.target.value)} aria-label="Filter jenis"
            className="h-[34px] min-w-0 rounded-lg border-0 bg-white px-2.5 text-[13px] font-semibold ring-1 ring-slate-200 focus:ring-2 focus:ring-brand">
            <option value="">Semua jenis</option>{JENIS_MITRA.map((j) => <option key={j} value={j}>{j}</option>)}
          </select>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} aria-label="Filter status"
            className="h-[34px] min-w-0 rounded-lg border-0 bg-white px-2.5 text-[13px] font-semibold ring-1 ring-slate-200 focus:ring-2 focus:ring-brand">
            <option value="">Semua status</option>{STATUS_MITRA.map((j) => <option key={j} value={j}>{j}</option>)}
          </select>
          <span className="ml-auto shrink-0 text-xs font-semibold text-ink-mute" data-jml-mitra>{rows.length} mitra</span>
        </div>

        {rows.length === 0 ? (
          <Empty icon={Handshake} title="Belum ada mitra" text={bolehUbah ? 'Tekan "Mitra Baru" untuk menambah kemitraan pertama.' : 'Belum ada data kemitraan di cabang ini.'} />
        ) : (
          <div className="min-w-0 max-w-full overflow-x-auto">
            <table className="tbl-rapat w-full min-w-[720px] table-fixed border-collapse text-left">
              <thead>
                <tr>
                  {KOLOM.map((c) => <Th key={c.key} kolom={c} sortKey={sortKey} sortDir={sortDir} onKlik={klikJudul} className={c.num ? 'num' : ''} />)}
                  {bolehUbah && <th scope="col" className="w-[84px]">Aksi</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} data-mitra={r.id}>
                    <td className="truncate font-semibold text-ink" title={r.nama}>{r.nama}</td>
                    <td className="truncate">{r.jenis || '—'}</td>
                    <td className="truncate">{r.pic || '—'}</td>
                    <td className="truncate">
                      {r.telepon ? <a href={`tel:${r.telepon}`} className="inline-flex items-center gap-1 text-brand hover:underline"><Phone className="h-3 w-3" />{r.telepon}</a> : null}
                      {r.telepon && r.email ? ' · ' : null}
                      {r.email ? <a href={`mailto:${r.email}`} className="inline-flex items-center gap-1 text-brand hover:underline" title={r.email}><Mail className="h-3 w-3" />email</a> : null}
                      {!r.telepon && !r.email ? '—' : null}
                    </td>
                    <td className="truncate">{r.cabang || '—'}</td>
                    <td className="truncate">{r.mulai ? tgl(r.mulai) : '—'}</td>
                    <td><span className={cx('inline-flex h-6 items-center rounded-full px-2 text-[11px] font-bold ring-1', WARNA_STATUS[r.status] || WARNA_STATUS.Aktif)}>{r.status || 'Aktif'}</span></td>
                    {bolehUbah && (
                      <td className="aksi">
                        <button type="button" onClick={() => setForm({ ...r })} aria-label={`Ubah ${r.nama}`} title="Ubah"><Pencil className="h-4 w-4" /></button>
                        <button type="button" onClick={() => hapus(r)} aria-label={`Hapus ${r.nama}`} title="Hapus" className="hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Sheet open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Ubah Mitra' : 'Mitra Baru'}
        subtitle="Data kemitraan diisi manual — tidak diambil dari project"
        footer={<>
          <Button variant="outline" className="flex-1 sm:flex-none sm:px-6" onClick={() => setForm(null)}>Batal</Button>
          <Button className="flex-[2]" variant="dark" onClick={simpan} data-aksi="simpan-mitra">Simpan</Button>
        </>}>
        {form && (
          <div className="space-y-3">
            <Field label="Nama Mitra" required>
              <Input value={form.nama} onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))} placeholder="mis. PT Visa Cepat / Notaris Budi" aria-label="Nama mitra" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Jenis Kemitraan">
                <Select value={form.jenis} onChange={(e) => setForm((f) => ({ ...f, jenis: e.target.value }))} aria-label="Jenis kemitraan">
                  {JENIS_MITRA.map((j) => <option key={j}>{j}</option>)}
                </Select>
              </Field>
              <Field label="Cabang" required hint={semuaCabang ? undefined : 'Hanya cabang Anda'}>
                <Select value={form.cabang} onChange={(e) => setForm((f) => ({ ...f, cabang: e.target.value }))} aria-label="Cabang mitra">
                  <option value="">— Pilih cabang —</option>
                  {pilihanCabang.map((b) => <option key={b}>{b}</option>)}
                </Select>
              </Field>
              <Field label="Nama PIC">
                <Input value={form.pic} onChange={(e) => setForm((f) => ({ ...f, pic: e.target.value }))} placeholder="orang yang dihubungi" aria-label="Nama PIC" />
              </Field>
              <Field label="Telepon / WhatsApp">
                <Input value={form.telepon} onChange={(e) => setForm((f) => ({ ...f, telepon: e.target.value }))} type="tel" inputMode="tel" placeholder="08…" aria-label="Telepon mitra" inputMode="tel" />
              </Field>
              <Field label="Email">
                <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="nama@perusahaan.com" aria-label="Email mitra" />
              </Field>
              <Field label="Komisi / Kesepakatan">
                <Input value={form.komisi} onChange={(e) => setForm((f) => ({ ...f, komisi: e.target.value }))} placeholder="mis. 10% / harga khusus" aria-label="Komisi mitra" />
              </Field>
              <Field label="Mulai Kerja Sama">
                <Input type="date" value={form.mulai || ''} onChange={(e) => setForm((f) => ({ ...f, mulai: e.target.value }))} aria-label="Tanggal mulai" />
              </Field>
              <Field label="Status">
                <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} aria-label="Status mitra">
                  {STATUS_MITRA.map((j) => <option key={j}>{j}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Alamat">
              <Input value={form.alamat} onChange={(e) => setForm((f) => ({ ...f, alamat: e.target.value }))} aria-label="Alamat mitra" />
            </Field>
            <Field label="Catatan">
              <Textarea rows={3} value={form.catatan} onChange={(e) => setForm((f) => ({ ...f, catatan: e.target.value }))} placeholder="kesepakatan, syarat, riwayat singkat…" aria-label="Catatan mitra" />
            </Field>
          </div>
        )}
      </Sheet>
    </div>
  )
}
