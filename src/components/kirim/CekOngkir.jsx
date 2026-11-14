// Cek Ongkir mandiri (tanpa membuat order). Hasil bisa langsung dijadikan draft.
import { useState } from 'react'
import { Calculator } from 'lucide-react'
import { useApp } from '../../lib/store.jsx'
import { Button, Input, Select, Empty } from '../ui.jsx'
import { go } from '../../lib/router.js'
import { BRANCHES } from '../../config/access.js'
import { kodeposOk, fmtWaktu, nomorKode, bolehOps, zonaCabang } from '../../lib/kirim.js'
import { cekTarif } from '../../lib/kirimApi.js'
import { useKirim, Kotak, Catatan } from './bersama.jsx'
import { PilihLokasi, TabelTarif } from './Buat.jsx'

export default function CekOngkir() {
  const { user, save, notify } = useApp()
  const { alamatCabang } = useKirim()
  const [cabang, setCabang] = useState(user.branch && BRANCHES.includes(user.branch) ? user.branch : 'Bali')
  const [asal, setAsal] = useState(() => ({ kodepos: alamatCabang[cabang]?.kodepos || '' }))
  const [tujuan, setTujuan] = useState({ kodepos: '' })
  const [pk, setPk] = useState({ berat_gram: 300, p: '', l: '', t: '', nilai: 0, asuransi: false, cod: false, cod_nilai: '', jenis: 'PICKUP', lat: '', lng: '' })
  const [hasil, setHasil] = useState(null)
  const [urut, setUrut] = useState('harga')
  const [muat, setMuat] = useState(false)
  const ubah = (p) => setPk((x) => ({ ...x, ...p }))

  const cek = async () => {
    if (!kodeposOk(asal.kodepos) || !kodeposOk(tujuan.kodepos)) return notify('Kode pos asal & tujuan harus 5 angka', 'err')
    if (!(Number(pk.berat_gram) > 0)) return notify('Isi berat', 'err')
    setMuat(true)
    const x = await cekTarif({ asal_kodepos: asal.kodepos, asal_kel: asal.kelurahan, tujuan_kodepos: tujuan.kodepos, tujuan_kel: tujuan.kelurahan, berat_gram: pk.berat_gram, length: pk.p, width: pk.l, height: pk.t, jenis: pk.jenis, nilai: pk.nilai, asuransi: pk.asuransi, cod: pk.cod, cod_nilai: pk.cod_nilai, destination_latitude: pk.lat || undefined, destination_longitude: pk.lng || undefined })
    setMuat(false)
    setHasil(x.ok ? x : { galat: x.alasan || 'Gagal cek ongkir. Periksa kode pos/kelurahan atau coba lagi.' })
  }
  const list = (hasil?.tarif || []).slice().sort(urut === 'harga' ? (a, b) => a.total - b.total : (a, b) => (a.max_hari ?? 99) - (b.max_hari ?? 99) || a.total - b.total)
  const jadiDraft = async (t) => {
    const ac = alamatCabang[cabang] || {}
    const s = await save('kirim', { kode: nomorKode(), sumber: 'ATLAS', sumber_status: 'Input manual', tahap: 'draft', cabang, jenis_kirim: 'keluar', pic: user.name, ongkir_ditanggung: 'kantor', checklist: {}, dokumen: {},
      pengirim: { nama: ac.nama || '', telp: ac.telp || '', alamat: ac.alamat || '', kodepos: asal.kodepos, kelurahan: asal.kelurahan, terverifikasi: !!asal.terverifikasi },
      penerima: { kodepos: tujuan.kodepos, kelurahan: tujuan.kelurahan, terverifikasi: !!tujuan.terverifikasi },
      paket: { isi: 'Dokumen terjemahan', jumlah: 1, berat_gram: pk.berat_gram, p: pk.p, l: pk.l, t: pk.t, nilai: pk.nilai, asuransi: pk.asuransi, cod: pk.cod, cod_nilai: pk.cod_nilai },
      kurir: { jenis: pk.jenis, kurir: t.kurir, layanan: t.layanan, logo: t.logo || '', rate_code: t.rate_code, ongkir: t.ongkir, asuransi: t.asuransi, biaya_tambahan: t.biaya_tambahan, total: t.total, cashback: t.cashback, min_hari: t.min_hari, max_hari: t.max_hari, tarif_at: hasil.diambil_at },
      riwayat: [{ at: new Date().toISOString(), by: user.name, aksi: 'Draft dari Cek Ongkir' }] })
    notify('Draft dibuat — lengkapi penerima'); go(`pengiriman/buat/${s.id}`)
  }

  return (
    <div className="space-y-3" data-cek-ongkir>
      <Kotak className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-2">
          <p className="text-[12px] font-bold">Asal</p>
          <label className="text-[11px] font-semibold text-ink-mute">Cabang<Select value={cabang} onChange={(e) => { setCabang(e.target.value); setAsal({ kodepos: alamatCabang[e.target.value]?.kodepos || '' }) }}>{BRANCHES.map((b) => <option key={b}>{b}</option>)}</Select></label>
          <label className="text-[11px] font-semibold text-ink-mute">Kode pos asal<Input value={asal.kodepos || ''} onChange={(e) => setAsal({ kodepos: e.target.value.replace(/\D/g, '').slice(0, 5) })} inputMode="numeric" /></label>
          <PilihLokasi nilai={asal} onPilih={(l) => setAsal(l)} />
        </div>
        <div className="space-y-2">
          <p className="text-[12px] font-bold">Tujuan</p>
          <label className="text-[11px] font-semibold text-ink-mute">Kode pos tujuan<Input value={tujuan.kodepos || ''} onChange={(e) => setTujuan({ kodepos: e.target.value.replace(/\D/g, '').slice(0, 5) })} inputMode="numeric" data-f="tujuan-kodepos" /></label>
          <PilihLokasi nilai={tujuan} onPilih={(l) => setTujuan(l)} />
          <details className="text-[12px]"><summary className="cursor-pointer text-ink-mute">Koordinat tujuan (hanya bila layanan instan/same day mewajibkan)</summary>
            <div className="mt-1 grid grid-cols-2 gap-2"><Input placeholder="Latitude" value={pk.lat} onChange={(e) => ubah({ lat: e.target.value })} /><Input placeholder="Longitude" value={pk.lng} onChange={(e) => ubah({ lng: e.target.value })} /></div>
          </details>
        </div>
        <div className="grid gap-2 sm:grid-cols-4 lg:col-span-2">
          <label className="text-[11px] font-semibold text-ink-mute">Berat (gram)<Input type="number" min="1" value={pk.berat_gram} onChange={(e) => ubah({ berat_gram: Number(e.target.value) })} /></label>
          <label className="text-[11px] font-semibold text-ink-mute">Panjang (cm)<Input type="number" min="0" value={pk.p} onChange={(e) => ubah({ p: Number(e.target.value) })} /></label>
          <label className="text-[11px] font-semibold text-ink-mute">Lebar (cm)<Input type="number" min="0" value={pk.l} onChange={(e) => ubah({ l: Number(e.target.value) })} /></label>
          <label className="text-[11px] font-semibold text-ink-mute">Tinggi (cm)<Input type="number" min="0" value={pk.t} onChange={(e) => ubah({ t: Number(e.target.value) })} /></label>
          <label className="text-[11px] font-semibold text-ink-mute">Metode<Select value={pk.jenis} onChange={(e) => ubah({ jenis: e.target.value })}><option value="PICKUP">Pickup</option><option value="DROP">Drop-off</option></Select></label>
          <label className="text-[11px] font-semibold text-ink-mute">Nilai barang (Rp)<Input type="number" min="0" value={pk.nilai} onChange={(e) => ubah({ nilai: Number(e.target.value) })} /></label>
          <label className="mt-4 flex items-center gap-2 text-[13px]"><input type="checkbox" checked={pk.asuransi} onChange={(e) => ubah({ asuransi: e.target.checked })} />Asuransi</label>
          <div className="mt-4 flex items-center gap-2 text-[13px]"><label className="flex items-center gap-2"><input type="checkbox" checked={pk.cod} onChange={(e) => ubah({ cod: e.target.checked })} />COD</label>{pk.cod && <Input type="number" className="w-28" placeholder="Nilai COD" value={pk.cod_nilai} onChange={(e) => ubah({ cod_nilai: Number(e.target.value) })} />}</div>
        </div>
        <div className="flex items-center gap-2 lg:col-span-2">
          <Button loading={muat} onClick={cek} data-aksi="cek-ongkir"><Calculator className="h-4 w-4" />Cek ongkir</Button>
          <label className="ml-auto text-[11px] font-semibold text-ink-mute">Urutkan<Select value={urut} onChange={(e) => setUrut(e.target.value)}><option value="harga">Termurah</option><option value="waktu">Tercepat</option></Select></label>
        </div>
      </Kotak>
      {hasil?.galat && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-800 ring-1 ring-rose-200">{hasil.galat}</p>}
      {hasil?.tarif && (list.length ? (
        <>
          <p className="text-[11px] text-ink-mute">Diambil {fmtWaktu(hasil.diambil_at, zonaCabang(cabang))}{hasil.contoh ? ' · CONTOH DEMO, bukan tarif sungguhan' : ' · sumber Everpro'}. Tarif dapat berubah — dicek ulang saat order dibuat.</p>
          <TabelTarif list={list} onPilih={bolehOps(user) ? jadiDraft : null} />
          <Catatan>Tombol Pilih membuat draft pengiriman dengan layanan ini. Performa kurir tidak ditampilkan karena Everpro belum menyediakan datanya lewat API.</Catatan>
        </>
      ) : <Empty icon={Calculator} title="Tidak ada layanan" text="Rute tidak terjangkau untuk metode/berat ini, atau COD/asuransi tidak didukung. Ubah metode (pickup/drop-off), matikan COD, atau periksa kode pos." />)}
    </div>
  )
}
