import { useMemo, useState } from 'react'
import { Tags, Search, Pencil, Check, Plus, Trash2, AlertTriangle, Copy } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { Button, Card, cx } from '../components/ui.jsx'
import { canEditHarga, KATEGORI, SATUAN, rupiah, perKategori, belumDiisi } from '../lib/harga.js'

/** Satu angka harga — "Belum diisi" bila kosong, supaya tidak ada yang salah menawar. */
function Harga({ nilai, kuat }) {
  const t = rupiah(nilai)
  if (t === null) return <span className="text-xs font-semibold text-amber-700">Belum diisi</span>
  return <span className={cx('tabular-nums', kuat ? 'text-sm font-bold text-ink' : 'text-sm text-ink-soft')}>{t}</span>
}

export default function DaftarHarga() {
  const { user, data, save, remove, notify } = useApp()
  const bolehUbah = canEditHarga(user)
  const [sunting, setSunting] = useState(false)
  const [q, setQ] = useState('')

  const rows = data.daftar_harga || []
  const cocok = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return rows
    return rows.filter((r) => [r.layanan, r.kategori, r.catatan].filter(Boolean).some((v) => String(v).toLowerCase().includes(s)))
  }, [rows, q])
  const grup = useMemo(() => perKategori(cocok), [cocok])
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
        <h1 className="min-w-0 text-lg font-bold">Daftar Harga</h1>
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

      <label className="relative block min-w-0">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" aria-hidden="true" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari layanan atau bahasa…"
          aria-label="Cari daftar harga"
          className="w-full max-w-full rounded-xl border-0 bg-white py-2.5 pl-9 pr-3 text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-brand" />
      </label>

      {grup.length === 0 ? (
        <p className="rounded-2xl bg-white px-4 py-10 text-center text-sm text-ink-mute ring-1 ring-slate-200">Tidak ada yang cocok.</p>
      ) : grup.map(([kategori, list]) => (
        <Card key={kategori} className="min-w-0 p-4 md:p-6">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 className="min-w-0 flex-1 truncate text-sm font-bold">{kategori}</h2>
            {sunting && <Button size="sm" variant="outline" onClick={() => tambah(kategori)}><Plus className="h-3.5 w-3.5" />Tambah</Button>}
          </div>
          <ul className="mt-3 space-y-1.5">
            {list.map((r) => (
              <li key={r.id} className="min-w-0 border-t border-slate-100 pt-1.5 first:border-0 first:pt-0">
                {sunting ? (
                  <div className="grid min-w-0 gap-1.5 md:grid-cols-[minmax(0,1.4fr)_120px_120px_120px_44px] md:items-center">
                    <input defaultValue={r.layanan} aria-label={`Nama layanan ${r.layanan}`}
                      onBlur={(e) => simpan(r, { layanan: e.target.value })}
                      className="min-w-0 rounded-lg border-0 bg-white px-2 py-2 text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-brand" />
                    <select defaultValue={r.satuan} aria-label="Satuan" onChange={(e) => simpan(r, { satuan: e.target.value })}
                      className="min-w-0 rounded-lg border-0 bg-white px-2 py-2 text-xs ring-1 ring-slate-200 focus:ring-2 focus:ring-brand">
                      {SATUAN.map((x) => <option key={x}>{x}</option>)}
                    </select>
                    <input type="number" inputMode="numeric" defaultValue={r.harga_normal ?? ''} placeholder="Normal"
                      aria-label={`Harga normal ${r.layanan}`} onBlur={(e) => simpan(r, { harga_normal: angka(e.target.value) })}
                      className="min-w-0 rounded-lg border-0 bg-white px-2 py-2 text-right text-sm tabular-nums ring-1 ring-slate-200 focus:ring-2 focus:ring-brand" />
                    <input type="number" inputMode="numeric" defaultValue={r.harga_kilat ?? ''} placeholder="Kilat"
                      aria-label={`Harga kilat ${r.layanan}`} onBlur={(e) => simpan(r, { harga_kilat: angka(e.target.value) })}
                      className="min-w-0 rounded-lg border-0 bg-white px-2 py-2 text-right text-sm tabular-nums ring-1 ring-slate-200 focus:ring-2 focus:ring-brand" />
                    <button type="button" onClick={() => hapus(r)} aria-label={`Hapus ${r.layanan}`} title="Hapus baris"
                      className="grid h-11 w-11 place-items-center rounded-lg text-rose-500 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
                    <input defaultValue={r.catatan || ''} placeholder="Catatan (mis. minimal 2 halaman)" aria-label="Catatan"
                      onBlur={(e) => simpan(r, { catatan: e.target.value })}
                      className="min-w-0 rounded-lg border-0 bg-white px-2 py-2 text-xs ring-1 ring-slate-200 focus:ring-2 focus:ring-brand md:col-span-5" />
                  </div>
                ) : (
                  <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{r.layanan}</span>
                    <span className="shrink-0 text-[11px] text-ink-mute">{r.satuan}</span>
                    <Harga nilai={r.harga_normal} kuat />
                    {rupiah(r.harga_kilat) && (
                      <span className="shrink-0 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-200">
                        Kilat {rupiah(r.harga_kilat)}
                      </span>
                    )}
                    <button type="button" onClick={() => salin(r)} title="Salin teks harga untuk dikirim ke pelanggan"
                      aria-label={`Salin harga ${r.layanan}`}
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-ink-mute hover:bg-slate-50 hover:text-brand md:h-7 md:w-7">
                      <Copy className="h-4 w-4" />
                    </button>
                    {r.catatan && <span className="w-full text-[11px] leading-relaxed text-ink-mute">{r.catatan}</span>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  )
}
