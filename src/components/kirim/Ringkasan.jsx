// Ringkasan pengiriman + Perlu Perhatian. Angka dari data tersimpan/tersinkron (tabel kirim).
import { useMemo, useState } from 'react'
import { Settings2, AlertTriangle, PackageOpen } from 'lucide-react'
import { useApp } from '../../lib/store.jsx'
import { Button, Input, Select, Sheet, Empty, cx } from '../ui.jsx'
import { KARTU, perluPerhatian, PERHATIAN_LABEL, fmtWaktu, resiOf } from '../../lib/kirim.js'
import { useKirim, Kotak, Catatan } from './bersama.jsx'
import { saring, DetailKirim } from './Daftar.jsx'

const KARTU_KEY = 'atlas-kirim-kartu'
const bacaKartu = () => { try { return JSON.parse(localStorage.getItem(KARTU_KEY)) || KARTU.map((k) => k.key) } catch { return KARTU.map((k) => k.key) } }

export default function Ringkasan({ bukaDaftar }) {
  const { kirim, kendala, mutasi, ambang, sinkron } = useKirim()
  const [f, setF] = useState(() => ({ dari: new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10), sampai: '' }))
  const [tampil, setTampil] = useState(bacaKartu)
  const [atur, setAtur] = useState(false)
  const [buka, setBuka] = useState(null)
  const [grup, setGrup] = useState(null)
  const rows = useMemo(() => saring(kirim, f), [kirim, f])
  const hitung = (k) => (k.tahap ? rows.filter((r) => k.tahap.includes(r.tahap)).length : rows.length)
  const perhatian = useMemo(() => perluPerhatian(kirim, kendala, mutasi, ambang), [kirim, kendala, mutasi, ambang])
  const opsi = (fn) => [...new Set(kirim.map(fn).filter(Boolean))].sort()

  return (
    <div className="space-y-3" data-ringkasan-kirim>
      <Kotak className="flex flex-wrap items-end gap-2">
        <label className="text-[11px] font-semibold text-ink-mute">Dari<Input type="date" value={f.dari} onChange={(e) => setF((x) => ({ ...x, dari: e.target.value }))} className="mt-0.5 w-[150px]" /></label>
        <label className="text-[11px] font-semibold text-ink-mute">Sampai<Input type="date" value={f.sampai} onChange={(e) => setF((x) => ({ ...x, sampai: e.target.value }))} className="mt-0.5 w-[150px]" /></label>
        <label className="text-[11px] font-semibold text-ink-mute">Kurir<Select value={f.kurir || ''} onChange={(e) => setF((x) => ({ ...x, kurir: e.target.value }))} className="mt-0.5"><option value="">Semua</option>{opsi((r) => r.kurir?.kurir).map((k) => <option key={k}>{k}</option>)}</Select></label>
        <label className="text-[11px] font-semibold text-ink-mute">Layanan<Select value={f.layanan || ''} onChange={(e) => setF((x) => ({ ...x, layanan: e.target.value }))} className="mt-0.5"><option value="">Semua</option>{opsi((r) => r.kurir?.layanan).map((k) => <option key={k}>{k}</option>)}</Select></label>
        <label className="text-[11px] font-semibold text-ink-mute">Penanggung jawab<Select value={f.pic || ''} onChange={(e) => setF((x) => ({ ...x, pic: e.target.value }))} className="mt-0.5"><option value="">Semua</option>{opsi((r) => r.pic || r.dipesan_oleh).map((k) => <option key={k}>{k}</option>)}</Select></label>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setAtur(true)}><Settings2 className="h-4 w-4" />Atur kartu</Button>
      </Kotak>
      <p className="text-[11px] text-ink-mute">Cabang mengikuti pilihan cabang di atas. Data dari pengiriman tersimpan di ATLAS{sinkron?.at ? ` · tarik Everpro terakhir ${fmtWaktu(sinkron.at)}` : ' · belum pernah tarik dari Everpro'} — bukan real-time.</p>

      {!kirim.length ? <Empty icon={PackageOpen} title="Belum ada data pengiriman" text="Buat pengiriman pertama, atau tarik data dari Everpro di Daftar Pengiriman." /> : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {KARTU.filter((k) => tampil.includes(k.key)).map((k) => (
            <button key={k.key} type="button" onClick={() => bukaDaftar({ ...f, tab: 'semua', tahap: k.tahap || undefined })} className="rounded-2xl bg-white p-3 text-left ring-1 ring-[#E7E8F0] transition hover:ring-brand dark:bg-white/5" data-kartu={k.key}>
              <p className="text-[11px] font-semibold text-ink-mute">{k.label}</p>
              <p className="text-2xl font-extrabold tabular-nums">{hitung(k)}</p>
            </button>
          ))}
        </div>
      )}

      <Kotak>
        <p className="mb-2 flex items-center gap-1.5 text-sm font-extrabold"><AlertTriangle className="h-4 w-4 text-amber-600" />Perlu Perhatian</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(PERHATIAN_LABEL).map(([key, [label, dasar]]) => {
            const n = perhatian[key]?.length || 0
            return (
              <button key={key} type="button" disabled={!n} onClick={() => setGrup(key)} className={cx('rounded-xl p-2.5 text-left ring-1', n ? 'bg-amber-50 ring-amber-200 hover:ring-amber-400' : 'bg-slate-50 ring-slate-200 opacity-70')} data-perhatian={key}>
                <p className="flex items-center justify-between text-[13px] font-semibold"><span>{label}</span><span className="tabular-nums">{n}</span></p>
                <p className="text-[11px] text-ink-mute">{dasar(ambang)}</p>
              </button>
            )
          })}
        </div>
        <Catatan>Ambang bisa diubah di Pengiriman → Pengaturan. Estimasi kurir = data Everpro saat cek ongkir; target internal = standar operasional kita sendiri.</Catatan>
      </Kotak>

      {grup && (
        <Sheet open onClose={() => setGrup(null)} title={PERHATIAN_LABEL[grup][0]} subtitle={PERHATIAN_LABEL[grup][1](ambang)}>
          <ul className="space-y-1.5">
            {(perhatian[grup] || []).map((r) => (
              <li key={r.id}><button type="button" className="w-full rounded-lg p-2 text-left text-[13px] ring-1 ring-slate-200 hover:ring-brand" onClick={() => (r.kirim_id !== undefined || r.arah ? null : setBuka(r.id))}>
                <b>{r.kode || r.judul || r.referensi || r.id}</b> {r.penerima?.nama ? `→ ${r.penerima.nama}` : ''} {resiOf(r) ? `· ${resiOf(r)}` : ''}{r.jumlah ? ` · Rp ${Number(r.jumlah).toLocaleString('id-ID')}` : ''}
              </button></li>
            ))}
          </ul>
        </Sheet>
      )}
      {atur && (
        <Sheet open onClose={() => setAtur(false)} title="Kartu yang ditampilkan">
          <div className="grid gap-2">{KARTU.map((k) => <label key={k.key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={tampil.includes(k.key)} onChange={() => { const n = tampil.includes(k.key) ? tampil.filter((x) => x !== k.key) : [...tampil, k.key]; setTampil(n); try { localStorage.setItem(KARTU_KEY, JSON.stringify(n)) } catch { /* abaikan */ } }} />{k.label}</label>)}</div>
        </Sheet>
      )}
      {buka && <DetailKirim id={buka} onClose={() => setBuka(null)} />}
    </div>
  )
}
