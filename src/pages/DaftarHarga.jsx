import { useMemo, useState } from 'react'
import { Tags, Pencil, Check, Plus, Trash2, AlertTriangle, Copy } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { Button, Card, cx } from '../components/ui.jsx'
import { canEditHarga, KATEGORI, SATUAN, rupiah, belumDiisi } from '../lib/harga.js'
import { useTabel, Th, CariTabel } from '../components/TabelSortir.jsx'

/** Satu angka harga — "Belum diisi" bila kosong, supaya tidak ada yang salah menawar. */
function Harga({ nilai, kuat }) {
  const t = rupiah(nilai)
  if (t === null) return <span className="text-xs font-semibold text-amber-700">Belum diisi</span>
  return <span className={cx('tabular-nums', kuat ? 'text-sm font-bold text-ink' : 'text-sm text-ink-soft')}>{t}</span>
}

/** Kolom tabel Katalog — judulnya bisa diklik untuk mengurutkan. */
const KOLOM = [
  { key: 'kategori', label: 'Kategori', w: '16%', sort: (r) => String(r.kategori || '').toLowerCase() },
  { key: 'layanan', label: 'Layanan', w: '26%', sort: (r) => String(r.layanan || '').toLowerCase() },
  { key: 'satuan', label: 'Satuan', w: '12%', sort: (r) => String(r.satuan || '').toLowerCase() },
  { key: 'normal', label: 'Harga Normal', w: '14%', num: true, sort: (r) => (r.harga_normal == null ? -1 : Number(r.harga_normal)) },
  { key: 'kilat', label: 'Harga Kilat', w: '14%', num: true, sort: (r) => (r.harga_kilat == null ? -1 : Number(r.harga_kilat)) },
  { key: 'catatan', label: 'Catatan', w: '18%', sort: (r) => String(r.catatan || '').toLowerCase() },
]

export default function DaftarHarga() {
  const { user, data, save, remove, notify } = useApp()
  const bolehUbah = canEditHarga(user)
  const [sunting, setSunting] = useState(false)
  const [fKat, setFKat] = useState('')
  const [fIsi, setFIsi] = useState('')

  const rows = data.daftar_harga || []
  const kategoriAda = useMemo(
    () => [...new Set(rows.map((r) => r.kategori).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'id')),
    [rows],
  )
  const tersaring = useMemo(() => rows.filter((r) => {
    if (fKat && r.kategori !== fKat) return false
    if (fIsi === 'ada' && r.harga_normal == null) return false
    if (fIsi === 'kosong' && r.harga_normal != null) return false
    return true
  }), [rows, fKat, fIsi])
  // Pencarian, filter & urutan disimpan di sini, jadi tidak hilang saat mode ubah dinyalakan.
  const { rows: baris, sortKey, sortDir, klikJudul, cari, setCari } = useTabel(tersaring, KOLOM, { awalKey: 'kategori' })
  const kosong = belumDiisi(rows)

  const simpan = async (r, patch) => {
    const nilai = { ...r, ...patch }
    if (JSON.stringify(nilai) === JSON.stringify(r)) return
    try { await save('daftar_harga', nilai); notify('Harga diperbarui') }
    catch (e) { notify(e.message || 'Gagal menyimpan', 'err') }
  }
  const hapus = async (r) => {
    try { await remove('daftar_harga', r.id); notify('Baris dihapus') }
    catch (e) { notify(e.message || 'Gagal menghapus', 'err') }
  }
  const tambah = async (kategori) => {
    const urut = Math.max(0, ...rows.map((x) => Number(x.urutan) || 0)) + 1
    try { await save('daftar_harga', { kategori, layanan: 'Layanan baru', satuan: 'per halaman', harga_normal: null, harga_kilat: null, catatan: '', urutan: urut }) }
    catch (e) { notify(e.message || 'Gagal menambah', 'err') }
  }
  const salin = async (r) => {
    const n = rupiah(r.harga_normal), k = rupiah(r.harga_kilat)
    const teks = `${r.layanan} — ${n ?? 'harga belum diisi'}${r.satuan ? ` ${r.satuan}` : ''}${k ? ` · kilat ${k}` : ''}`
    try { await navigator.clipboard.writeText(teks); notify('Teks harga disalin') }
    catch { notify('Tidak bisa menyalin di perangkat ini', 'err') }
  }

  const angka = (v) => (v === '' || v === null || v === undefined ? null : Number(v))

  return (
    <div className="min-w-0 space-y-4">
      <header className="flex min-w-0 flex-wrap items-center gap-2">
        <Tags className="h-5 w-5 shrink-0 text-ink-mute" aria-hidden="true" />
        <h1 className="min-w-0 text-lg font-bold">Katalog</h1>
        {bolehUbah && (
          <Button size="sm" variant={sunting ? 'solid' : 'outline'} className="ml-auto" onClick={() => setSunting((v) => !v)}>
            {sunting ? <><Check className="h-3.5 w-3.5" />Selesai</> : <><Pencil className="h-3.5 w-3.5" />Ubah harga</>}
          </Button>
        )}
      </header>

      <p className="rounded-2xl bg-slate-50 p-4 text-sm leading-relaxed text-ink-soft ring-1 ring-slate-200">
        Harga jual ke pelanggan — panduan saat menawarkan. Bisa dilihat semua staf;
        yang mengubah hanya Superadmin dan Direktur.
      </p>

      {kosong > 0 && (
        <p className="flex items-start gap-2 rounded-2xl bg-amber-50 p-4 text-sm leading-relaxed text-amber-900 ring-1 ring-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <b>{kosong} layanan belum ada harganya.</b> Jangan dipakai menawar ke pelanggan sebelum diisi —
            tanyakan dulu ke Direktur. {bolehUbah && 'Tekan “Ubah harga” untuk mengisinya.'}
          </span>
        </p>
      )}

      {/* Toolbar: cari · filter kategori — tinggi kontrol 34px */}
      <div className="flex flex-wrap items-center gap-2">
        <CariTabel value={cari} onChange={setCari} label="Cari layanan, kategori, catatan…" className="basis-60" />
        <select value={fKat} onChange={(e) => setFKat(e.target.value)} aria-label="Filter kategori"
          className="h-[34px] w-auto max-w-full rounded-lg border-0 bg-white pl-2.5 pr-7 text-[13px] font-semibold text-ink ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-brand">
          <option value="">Semua kategori</option>
          {kategoriAda.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <select value={fIsi} onChange={(e) => setFIsi(e.target.value)} aria-label="Filter kelengkapan harga"
          className="h-[34px] w-auto max-w-full rounded-lg border-0 bg-white pl-2.5 pr-7 text-[13px] font-semibold text-ink ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-brand">
          <option value="">Semua harga</option>
          <option value="ada">Sudah ada harga</option>
          <option value="kosong">Belum diisi</option>
        </select>
        {bolehUbah && sunting && (
          <Button size="sm" variant="outline" onClick={() => tambah(fKat || kategoriAda[0] || KATEGORI[0])}>
            <Plus className="h-3.5 w-3.5" />Tambah baris
          </Button>
        )}
        <span className="ml-auto text-[11px] text-ink-mute">{baris.length} dari {rows.length} layanan</span>
      </div>

      {baris.length === 0 ? (
        <p className="rounded-2xl bg-white px-4 py-10 text-center text-sm text-ink-mute ring-1 ring-slate-200">Tidak ada yang cocok.</p>
      ) : (
        <Card className="overflow-hidden">
          <div className="min-w-0 max-w-full overflow-x-auto">
            <table className="tbl-rapat" style={{ minWidth: '880px' }}>
              <thead>
                <tr>
                  {KOLOM.map((c) => <Th key={c.key} kolom={c} sortKey={sortKey} sortDir={sortDir} onKlik={klikJudul} />)}
                  <th style={{ width: '96px' }} className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {baris.map((r) => (
                  <tr key={r.id}>
                    <td><span className="text-ink-soft">{r.kategori}</span></td>
                    <td>
                      {sunting ? (
                        <input defaultValue={r.layanan} aria-label={`Nama layanan ${r.layanan}`}
                          onBlur={(e) => simpan(r, { layanan: e.target.value })}
                          className="h-8 w-full min-w-0 rounded-lg border-0 bg-white px-2 text-[13px] ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-brand" />
                      ) : <span className="font-semibold text-ink">{r.layanan}</span>}
                    </td>
                    <td>
                      {sunting ? (
                        <select defaultValue={r.satuan} aria-label={`Satuan ${r.layanan}`} onChange={(e) => simpan(r, { satuan: e.target.value })}
                          className="h-8 w-full min-w-0 rounded-lg border-0 bg-white px-1.5 text-[12px] ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-brand">
                          {SATUAN.map((x) => <option key={x}>{x}</option>)}
                        </select>
                      ) : <span className="text-[12px] text-ink-mute">{r.satuan}</span>}
                    </td>
                    <td className="num">
                      {sunting ? (
                        <input type="number" inputMode="numeric" defaultValue={r.harga_normal ?? ''} placeholder="Normal"
                          aria-label={`Harga normal ${r.layanan}`} onBlur={(e) => simpan(r, { harga_normal: angka(e.target.value) })}
                          className="h-8 w-full min-w-0 rounded-lg border-0 bg-white px-2 text-right text-[13px] tabular-nums ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-brand" />
                      ) : <Harga nilai={r.harga_normal} kuat />}
                    </td>
                    <td className="num">
                      {sunting ? (
                        <input type="number" inputMode="numeric" defaultValue={r.harga_kilat ?? ''} placeholder="Kilat"
                          aria-label={`Harga kilat ${r.layanan}`} onBlur={(e) => simpan(r, { harga_kilat: angka(e.target.value) })}
                          className="h-8 w-full min-w-0 rounded-lg border-0 bg-white px-2 text-right text-[13px] tabular-nums ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-brand" />
                      ) : (rupiah(r.harga_kilat)
                        ? <span className="whitespace-nowrap rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-200">{rupiah(r.harga_kilat)}</span>
                        : <span className="text-ink-mute">—</span>)}
                    </td>
                    <td>
                      {sunting ? (
                        <input defaultValue={r.catatan || ''} placeholder="mis. minimal 2 halaman" aria-label={`Catatan ${r.layanan}`}
                          onBlur={(e) => simpan(r, { catatan: e.target.value })}
                          className="h-8 w-full min-w-0 rounded-lg border-0 bg-white px-2 text-[12px] ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-brand" />
                      ) : <span className="text-[12px] text-ink-mute">{r.catatan || '—'}</span>}
                    </td>
                    <td>
                      <span className="aksi">
                        <button type="button" onClick={() => salin(r)} title="Salin teks harga untuk dikirim ke pelanggan"
                          aria-label={`Salin harga ${r.layanan}`} className="text-ink-mute hover:bg-slate-100 hover:text-brand">
                          <Copy className="h-4 w-4" />
                        </button>
                        {sunting && (
                          <button type="button" onClick={() => hapus(r)} aria-label={`Hapus ${r.layanan}`} title="Hapus baris"
                            className="text-rose-500 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
