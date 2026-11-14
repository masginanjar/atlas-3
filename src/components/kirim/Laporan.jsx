// Laporan pengiriman — mengikuti filter aktif; mencantumkan waktu dibuat & sumber data.
import { useMemo, useState } from 'react'
import { Download, BarChart3 } from 'lucide-react'
import { useApp } from '../../lib/store.jsx'
import { Button, Input, Select, Empty } from '../ui.jsx'
import { rupiah } from '../../lib/format.js'
import { bolehKeu, fmtWaktu, labelTahap, resiOf } from '../../lib/kirim.js'
import { bukuExcel } from '../UnduhData.jsx'
import { saveBlob } from '../../lib/download.js'
import { useKirim, Kotak, Catatan } from './bersama.jsx'
import { saring } from './Daftar.jsx'
import { JENIS_MUTASI } from './Saldo.jsx'

const DEFINISI = [
  ['Pengiriman', 'Semua catatan pengiriman non-draft dalam rentang tanggal pesan (atau tanggal dibuat bila belum dipesan).'],
  ['Ongkir aktual', 'Total biaya dari Everpro (biaya_aktual) bila sudah ditarik; bila belum, tidak dihitung — dipisah dari estimasi.'],
  ['Tepat waktu', 'Terkirim & tanggal diterima ≤ tanggal pesan + estimasi maksimum kurir. Hanya dihitung bila kedua tanggal ada.'],
  ['Masalah', 'Gagal pickup, gagal kirim, dikembalikan/retur, hilang/rusak.'],
  ['Cashback/refund/COD', 'Dari mutasi hasil impor laporan (bukan real-time).'],
]

export default function Laporan() {
  const { user } = useApp()
  const { kirim, mutasi } = useKirim()
  const [f, setF] = useState({ dari: new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10), sampai: '', kurir: '' })
  const [per, setPer] = useState('cabang')
  const rows = useMemo(() => saring(kirim, f).filter((r) => !['draft', 'siap', 'gagal_order'].includes(r.tahap)), [kirim, f])
  const grup = useMemo(() => {
    const kunci = (r) => (per === 'cabang' ? r.cabang || '(tanpa cabang)' : per === 'kurir' ? r.kurir?.kurir || '(tanpa kurir)' : String(r.dipesan_at || r.dibuat_at || r.created_at || '').slice(0, 7))
    const m = new Map()
    for (const r of rows) {
      const k = kunci(r); const g = m.get(k) || { k, n: 0, est: 0, akt: 0, nAkt: 0, tepat: 0, ukurTepat: 0, gp: 0, gk: 0, retur: 0, hilang: 0, batal: 0, terkirim: 0 }
      g.n++; g.est += Number(r.biaya?.total || 0)
      if (r.biaya_aktual?.total) { g.akt += Number(r.biaya_aktual.total); g.nAkt++ }
      if (r.tahap === 'terkirim') { g.terkirim++; const mulai = r.dipesan_at, sampai = r.diterima_at, maks = Number(r.kurir?.max_hari); if (mulai && sampai && maks > 0) { g.ukurTepat++; if ((new Date(sampai) - new Date(mulai)) / 864e5 <= maks + 0.999) g.tepat++ } }
      if (r.tahap === 'gagal_pickup') g.gp++; if (r.tahap === 'gagal_kirim') g.gk++; if (['retur_proses', 'dikembalikan'].includes(r.tahap)) g.retur++; if (r.tahap === 'hilang_rusak') g.hilang++; if (['dibatalkan', 'batal_diajukan'].includes(r.tahap)) g.batal++
      m.set(k, g)
    }
    return [...m.values()].sort((a, b) => String(a.k).localeCompare(String(b.k)))
  }, [rows, per])
  const mts = mutasi.filter((x) => x.jenis !== 'saldo_snapshot' && (!f.dari || String(x.tanggal).slice(0, 10) >= f.dari) && (!f.sampai || String(x.tanggal).slice(0, 10) <= f.sampai))
  const sumM = (j, st = 'berhasil') => mts.filter((x) => x.jenis === j && x.status === st).reduce((a, x) => a + Number(x.jumlah || 0), 0)
  const selisih = rows.filter((r) => r.biaya?.total && r.biaya_aktual?.total && Math.abs(r.biaya.total - r.biaya_aktual.total) >= 1)
  const byO = new Set(kirim.map((r) => r.everpro?.client_order_no).filter(Boolean)), byA = new Set(kirim.map((r) => resiOf(r)).filter(Boolean))
  const belumCocok = mts.filter((x) => !['topup', 'penarikan', 'transfer'].includes(x.jenis) && !byO.has(x.order) && !byA.has(x.resi))
  const dibuat = new Date().toISOString()
  const unduh = async () => {
    const head = [per === 'bulan' ? 'Bulan' : per === 'kurir' ? 'Kurir' : 'Cabang', 'Pengiriman', 'Terkirim', 'Tepat waktu (terukur)', 'Gagal pickup', 'Gagal kirim', 'Retur', 'Hilang/rusak', 'Dibatalkan', 'Biaya estimasi', 'Ongkir aktual', 'Jumlah ber-biaya aktual']
    const isi = grup.map((g) => [g.k, g.n, g.terkirim, g.ukurTepat ? `${g.tepat}/${g.ukurTepat}` : '-', g.gp, g.gk, g.retur, g.hilang, g.batal, Math.round(g.est), Math.round(g.akt), g.nAkt])
    const info = [['Dibuat', fmtWaktu(dibuat)], ['Oleh', user.name], ['Filter', `${f.dari || 'awal'} s/d ${f.sampai || 'kini'}${f.kurir ? ` · ${f.kurir}` : ''}`], ['Sumber', 'Tabel pengiriman ATLAS (dibuat di ATLAS / ditarik dari Everpro / impor); mutasi dari impor laporan'], ...DEFINISI]
    const lembar = [{ judul: 'Ringkasan', head, rows: isi }, { judul: 'Selisih biaya', head: ['Kode', 'Order', 'Estimasi', 'Aktual', 'Selisih'], rows: selisih.map((r) => [r.kode, r.everpro?.client_order_no || '', Math.round(r.biaya.total), Math.round(r.biaya_aktual.total), Math.round(r.biaya_aktual.total - r.biaya.total)]) }, { judul: 'Info', head: ['Keterangan', 'Isi'], rows: info }]
    if (bolehKeu(user)) lembar.splice(2, 0, { judul: 'Mutasi belum cocok', head: ['Tanggal', 'Jenis', 'Order', 'Resi', 'Jumlah', 'Referensi'], rows: belumCocok.map((x) => [String(x.tanggal).slice(0, 16), JENIS_MUTASI[x.jenis] || x.jenis, x.order || '', x.resi || '', Math.round(x.jumlah || 0), x.referensi || '']) })
    await saveBlob(`Laporan pengiriman ${f.dari || 'awal'} sd ${f.sampai || 'kini'}.xlsx`, await bukuExcel(lembar))
  }
  return (
    <div className="space-y-3" data-laporan-kirim>
      <Kotak className="flex flex-wrap items-end gap-2">
        <label className="text-[11px] font-semibold text-ink-mute">Dari<Input type="date" value={f.dari} onChange={(e) => setF({ ...f, dari: e.target.value })} /></label>
        <label className="text-[11px] font-semibold text-ink-mute">Sampai<Input type="date" value={f.sampai} onChange={(e) => setF({ ...f, sampai: e.target.value })} /></label>
        <label className="text-[11px] font-semibold text-ink-mute">Kurir<Select value={f.kurir} onChange={(e) => setF({ ...f, kurir: e.target.value })}><option value="">Semua</option>{[...new Set(kirim.map((r) => r.kurir?.kurir).filter(Boolean))].map((k) => <option key={k}>{k}</option>)}</Select></label>
        <label className="text-[11px] font-semibold text-ink-mute">Kelompokkan per<Select value={per} onChange={(e) => setPer(e.target.value)}><option value="cabang">Cabang</option><option value="kurir">Kurir</option><option value="bulan">Bulan</option></Select></label>
        <Button size="sm" className="ml-auto" disabled={!rows.length} onClick={unduh}><Download className="h-4 w-4" />Unduh Excel</Button>
      </Kotak>
      <p className="text-[11px] text-ink-mute">Dibuat {fmtWaktu(dibuat)} · cabang mengikuti pilihan cabang aktif · sumber: data pengiriman ATLAS (bukan real-time).</p>
      {!rows.length ? <Empty icon={BarChart3} title="Belum ada data untuk laporan" text="Ubah rentang tanggal, atau buat/tarik pengiriman dulu." /> : (
        <div className="overflow-x-auto rounded-2xl ring-1 ring-[#E7E8F0]">
          <table className="w-full min-w-[860px] bg-white text-[12px] dark:bg-white/5">
            <thead className="bg-slate-50 text-[11px] text-ink-mute"><tr>{[per === 'bulan' ? 'Bulan' : per === 'kurir' ? 'Kurir' : 'Cabang', 'Kiriman', 'Terkirim', 'Tepat waktu', 'Gagal pickup', 'Gagal kirim', 'Retur', 'Hilang/rusak', 'Batal', 'Estimasi biaya', 'Ongkir aktual'].map((h) => <th key={h} className="p-2 text-left">{h}</th>)}</tr></thead>
            <tbody>{grup.map((g) => <tr key={g.k} className="border-t border-slate-100"><td className="p-2 font-semibold">{g.k}</td><td className="p-2">{g.n}</td><td className="p-2">{g.terkirim}</td><td className="p-2">{g.ukurTepat ? `${g.tepat}/${g.ukurTepat}` : 'data kurang'}</td><td className="p-2">{g.gp}</td><td className="p-2">{g.gk}</td><td className="p-2">{g.retur}</td><td className="p-2">{g.hilang}</td><td className="p-2">{g.batal}</td><td className="p-2">{rupiah(g.est)}</td><td className="p-2">{g.nAkt ? `${rupiah(g.akt)} (${g.nAkt})` : '-'}</td></tr>)}</tbody>
          </table>
        </div>
      )}
      {bolehKeu(user) && (
        <Kotak className="grid grid-cols-2 gap-2 sm:grid-cols-5">{[['Cashback cair', sumM('cashback')], ['Cashback tertunda', sumM('cashback', 'tertunda')], ['Refund', sumM('refund')], ['COD dikumpulkan', sumM('cod_dikumpulkan')], ['Mutasi belum cocok', belumCocok.length]].map(([l, v]) => <div key={l}><p className="text-[11px] text-ink-mute">{l}</p><p className="font-bold">{typeof v === 'number' && l !== 'Mutasi belum cocok' ? rupiah(v) : v}</p></div>)}</Kotak>
      )}
      <Kotak><p className="mb-1 text-[12px] font-bold">Selisih biaya ({selisih.length})</p>{selisih.slice(0, 50).map((r) => <p key={r.id} className="text-[12px]">{r.kode} · {labelTahap(r.tahap)} · estimasi {rupiah(r.biaya.total)} → aktual {rupiah(r.biaya_aktual.total)}</p>)}{!selisih.length && <p className="text-[12px] text-ink-mute">Tidak ada selisih pada data yang sudah punya biaya aktual.</p>}</Kotak>
      <Kotak><p className="mb-1 text-[12px] font-bold">Definisi metrik</p>{DEFINISI.map(([k, v]) => <p key={k} className="text-[12px]"><b>{k}</b>: {v}</p>)}</Kotak>
      <Catatan>Laporan keuangan (cashback, refund, COD, mutasi) hanya untuk peran keuangan.</Catatan>
    </div>
  )
}
