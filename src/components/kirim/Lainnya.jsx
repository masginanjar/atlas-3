// Buku Alamat & Cabang · Label & Serah Terima · Kendala, Retur & Klaim · Pengaturan.
import { useMemo, useState } from 'react'
import { BookUser, Printer, ClipboardList, AlertTriangle, Plus, Pencil, Trash2, Check, ExternalLink } from 'lucide-react'
import { useApp } from '../../lib/store.jsx'
import { Button, Input, Select, Sheet, Empty, Textarea, Tabs, cx } from '../ui.jsx'
import { rupiah } from '../../lib/format.js'
import { BRANCHES } from '../../config/access.js'
import { normalHp, kodeposOk, bolehOps, bolehAturKirim, bolehPenting, fmtWaktu, zonaCabang, AMBANG_BAWAAN, labelTahap, resiOf, isEverpro, PENYEDIA, penyediaCabang } from '../../lib/kirim.js'
import { bukaLabelKirim } from '../../lib/kirimApi.js'
import { useKirim, Kotak, Catatan, BadgeTahap, LogoKurir } from './bersama.jsx'
import { PilihLokasi } from './Buat.jsx'
import { DetailKirim, FormKendala, EVERPRO_DASHBOARD } from './Daftar.jsx'
import { AlamatKirim, Couriers } from '../../pages/Settings.jsx'
import EverproLangsung from './EverproLangsung.jsx'

// ---------------- Buku Alamat & Cabang ----------------
export function BukuAlamat() {
  const { user, save, remove, notify, ask } = useApp()
  const { alamat } = useKirim()
  const [tab, setTab] = useState('buku')
  const [ed, setEd] = useState(null)
  const [q, setQ] = useState('')
  const daftar = alamat.filter((a) => !q || `${a.label} ${a.nama} ${a.telp} ${a.alamat} ${a.kodepos}`.toLowerCase().includes(q.toLowerCase()))
  const simpan = async () => {
    const hp = normalHp(ed.telp)
    if (!ed.nama || !hp.ok || String(ed.alamat || '').length < 10 || !kodeposOk(ed.kodepos)) return notify('Lengkapi nama, No. HP valid, alamat, dan kode pos 5 angka', 'err')
    await save('kirim_alamat', { ...ed, telp: hp.nomor, label: ed.label || ed.nama }); notify('Alamat tersimpan'); setEd(null)
  }
  return (
    <div className="space-y-3" data-buku-alamat>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'buku', label: 'Buku alamat', count: alamat.length }, bolehPenting(user) && { value: 'cabang', label: 'Alamat pengirim cabang' }].filter(Boolean)} />
      {tab === 'cabang' && bolehPenting(user) ? <AlamatKirim /> : (
        <>
          <div className="flex flex-wrap gap-2"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama / HP / alamat / kode pos" className="max-w-sm" />{bolehOps(user) && <Button size="sm" onClick={() => setEd({ jenis: 'pelanggan', cabang: '' })}><Plus className="h-4 w-4" />Tambah alamat</Button>}</div>
          {!daftar.length ? <Empty icon={BookUser} title="Buku alamat kosong" text="Alamat tersimpan saat membuat pengiriman (centang Simpan ke buku alamat) atau tambah manual." /> : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {daftar.map((a) => (
                <li key={a.id} className="rounded-2xl bg-white p-3 text-[13px] ring-1 ring-[#E7E8F0] dark:bg-white/5">
                  <p className="font-semibold">{a.label || a.nama} <span className="text-[11px] font-normal text-ink-mute">· {a.jenis === 'pengirim' ? 'pengirim' : 'penerima'}{a.cabang ? ` · ${a.cabang}` : ' · semua cabang'}</span></p>
                  <p className="text-ink-soft">{a.nama} · {a.telp}</p>
                  <p>{a.alamat}{a.kelurahan ? `, ${a.kelurahan}` : ''} {a.kodepos}</p>
                  <p className={cx('text-[11px]', a.terverifikasi ? 'text-emerald-700' : 'text-amber-700')}>{a.terverifikasi ? '✓ kelurahan/kode pos terverifikasi' : 'belum diverifikasi'}</p>
                  {bolehOps(user) && <div className="mt-1 flex gap-1"><Button size="sm" variant="outline" onClick={() => setEd(a)}><Pencil className="h-4 w-4" />Ubah</Button><Button size="sm" variant="ghost" aria-label="Hapus" onClick={async () => { if (await ask(`Hapus alamat ${a.label || a.nama}?`)) { await remove('kirim_alamat', a.id); notify('Dihapus') } }}><Trash2 className="h-4 w-4" /></Button></div>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {ed && (
        <Sheet open onClose={() => setEd(null)} title={ed.id ? 'Ubah alamat' : 'Tambah alamat'}>
          <div className="grid gap-2 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] font-semibold text-ink-mute">Jenis<Select value={ed.jenis} onChange={(e) => setEd({ ...ed, jenis: e.target.value })}><option value="pelanggan">Penerima / pelanggan</option><option value="pengirim">Pengirim</option></Select></label>
              <label className="text-[11px] font-semibold text-ink-mute">Cabang<Select value={ed.cabang || ''} onChange={(e) => setEd({ ...ed, cabang: e.target.value })}><option value="">Semua cabang</option>{BRANCHES.map((b) => <option key={b}>{b}</option>)}</Select></label>
            </div>
            <label className="text-[11px] font-semibold text-ink-mute">Label (mis. "PT X — kantor")<Input value={ed.label || ''} onChange={(e) => setEd({ ...ed, label: e.target.value })} /></label>
            <div className="grid grid-cols-2 gap-2"><label className="text-[11px] font-semibold text-ink-mute">Nama<Input value={ed.nama || ''} onChange={(e) => setEd({ ...ed, nama: e.target.value })} /></label><label className="text-[11px] font-semibold text-ink-mute">No. HP<Input value={ed.telp || ''} onChange={(e) => setEd({ ...ed, telp: e.target.value })} /></label></div>
            <label className="text-[11px] font-semibold text-ink-mute">Alamat lengkap<Textarea rows={2} value={ed.alamat || ''} onChange={(e) => setEd({ ...ed, alamat: e.target.value })} /></label>
            <PilihLokasi nilai={ed} onPilih={(l) => setEd({ ...ed, ...l })} />
            <label className="text-[11px] font-semibold text-ink-mute">Kode pos<Input value={ed.kodepos || ''} onChange={(e) => setEd({ ...ed, kodepos: e.target.value.replace(/\D/g, '').slice(0, 5), terverifikasi: false })} /></label>
            <label className="text-[11px] font-semibold text-ink-mute">Catatan<Input value={ed.catatan || ''} onChange={(e) => setEd({ ...ed, catatan: e.target.value })} /></label>
            <Button onClick={simpan}>Simpan</Button>
          </div>
        </Sheet>
      )}
    </div>
  )
}

// ---------------- Label & Serah Terima ----------------
const UKURAN = [['a4', 'Satu label per halaman'], ['8x10', '8 × 10 cm'], ['8x15', '8 × 15 cm'], ['10x10', '10 × 10 cm'], ['10x15', '10 × 15 cm']]
export function LabelSerah() {
  const { user, save, notify } = useApp()
  const { kirim } = useKirim()
  const [tab, setTab] = useState('label')
  const [pilih, setPilih] = useState(new Set())
  const [sibuk, setSibuk] = useState(false)
  const [f, setF] = useState({ tanggal: new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10), kurir: '', cabang: '' })
  const siap = kirim.filter((r) => isEverpro(r) && resiOf(r) && ['dibuat', 'menunggu_jemput', 'gagal_pickup'].includes(r.tahap))
  const serah = useMemo(() => kirim.filter((r) => resiOf(r) && !['dibatalkan', 'batal_diajukan', 'draft'].includes(r.tahap) && (!f.kurir || r.kurir?.kurir === f.kurir) && (!f.cabang || r.cabang === f.cabang) && String(r.dipesan_at || r.created_at).slice(0, 10) === f.tanggal), [kirim, f])
  const tandaiCetak = async (ids) => { const at = new Date().toISOString(); for (const id of ids) { const r = kirim.find((x) => x.id === id); if (r) await save('kirim', { id, label_dicetak_at: at, label_dicetak_oleh: user.name, riwayat: [...(r.riwayat || []), { at, by: user.name, aksi: 'Label ditandai sudah dicetak fisik' }] }) } notify('Ditandai sudah dicetak') }
  const cetakSerah = () => {
    const w = window.open('', '_blank'); if (!w) return notify('Izinkan pop-up untuk mencetak', 'err')
    const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
    const baris = serah.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(resiOf(r))}</td><td>${esc(r.kurir?.kurir)} ${esc(r.kurir?.layanan)}</td><td>${esc(r.penerima?.nama)}</td><td>${esc(r.paket?.jumlah || 1)}</td><td></td></tr>`).join('')
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Serah terima ${esc(f.tanggal)}</title><style>body{font-family:system-ui,sans-serif;font-size:12px;margin:24px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #999;padding:6px;text-align:left}h1{font-size:16px;margin:0}.int{color:#b00;font-weight:bold}.ttd{display:flex;gap:40px;margin-top:40px}.ttd div{flex:1;border-top:1px solid #000;padding-top:4px}</style></head><body>
      <p class="int">DOKUMEN INTERNAL — tidak untuk pelanggan</p><h1>Daftar Serah Terima Paket ke Kurir</h1>
      <p>Tanggal: ${esc(f.tanggal)} · Cabang: ${esc(f.cabang || 'semua')} · Kurir: ${esc(f.kurir || 'semua')} · Jumlah resi: ${serah.length} · Total koli: ${serah.reduce((a, r) => a + Number(r.paket?.jumlah || 1), 0)} · Petugas: ${esc(user.name)}</p>
      <table><thead><tr><th>No</th><th>Resi</th><th>Kurir</th><th>Penerima</th><th>Koli</th><th>Paraf kurir</th></tr></thead><tbody>${baris}</tbody></table>
      <div class="ttd"><div>Diserahkan (petugas)<br><br>${esc(user.name)}</div><div>Diterima (kurir)<br><br>Nama:</div></div>
      <script>window.onload=()=>window.print()</script></body></html>`)
    w.document.close()
  }
  return (
    <div className="space-y-3" data-label-serah>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'label', label: 'Label', count: siap.length }, { value: 'serah', label: 'Serah terima' }]} />
      {tab === 'label' ? (
        <>
          <Kotak>
            <p className="text-sm font-bold">Ukuran & isi label</p>
            <p className="mt-1 text-[12px]">Label yang dicetak adalah <b>label resmi kurir dari Everpro (PDF)</b> — ATLAS tidak membuat resi atau barcode sendiri supaya data wajib kurir tidak berubah dan barcode tetap terbaca.</p>
            <ul className="mt-2 grid gap-1 text-[12px] sm:grid-cols-2">{UKURAN.map(([k, l]) => <li key={k}>• {l}: <span className="text-ink-mute">mengikuti file dari Everpro; API Everpro belum menyediakan pilihan ukuran</span></li>)}</ul>
            <p className="mt-2 text-[12px] text-ink-mute">Pilihan tampil ongkir, alamat/telepon pengirim, kelurahan/telepon penerima, logo, tanggal cetak, dan salinan pelanggan tidak tersedia lewat API — atur di pengaturan label dashboard Everpro, lalu cetak dari sini atau dari dashboard. Saat mencetak, pakai skala 100% (jangan &quot;fit to page&quot;) agar barcode tidak terdistorsi.</p>
            <a href={EVERPRO_DASHBOARD} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold underline"><ExternalLink className="h-3 w-3" />Buka dashboard Everpro</a>
          </Kotak>
          {!siap.length ? <Empty icon={Printer} title="Tidak ada label menunggu" text="Label muncul untuk pengiriman yang sudah punya resi dan belum dijemput." /> : (
            <>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setPilih(new Set(siap.map((r) => r.id)))}>Pilih semua</Button>
                <Button size="sm" disabled={!pilih.size} loading={sibuk} onClick={async () => { setSibuk(true); const x = await bukaLabelKirim([...pilih], notify); setSibuk(false); return x }}><Printer className="h-4 w-4" />Buka label ({pilih.size})</Button>
                <Button size="sm" variant="outline" disabled={!pilih.size} onClick={() => tandaiCetak([...pilih])}><Check className="h-4 w-4" />Tandai sudah dicetak</Button>
              </div>
              <ul className="space-y-1.5">{siap.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-2 text-[13px] ring-1 ring-[#E7E8F0] dark:bg-white/5">
                  <input type="checkbox" checked={pilih.has(r.id)} onChange={() => setPilih((s) => { const n = new Set(s); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n })} aria-label={`Pilih ${resiOf(r)}`} />
                  <LogoKurir nama={r.kurir?.kurir} logo={r.kurir?.logo} ukuran={24} /><b className="font-mono">{resiOf(r)}</b><span>{r.kurir?.kurir} {r.kurir?.layanan}</span><span className="text-ink-mute">→ {r.penerima?.nama}</span>
                  <span className="ml-auto text-[11px] text-ink-mute">{r.label_dicetak_at ? `dicetak ${fmtWaktu(r.label_dicetak_at, zonaCabang(r.cabang))}` : r.label_log?.length ? `dibuka ${r.label_log.length}× · belum ditandai dicetak` : 'belum dibuka'}</span>
                </li>
              ))}</ul>
            </>
          )}
        </>
      ) : (
        <>
          <Kotak className="flex flex-wrap items-end gap-2">
            <label className="text-[11px] font-semibold text-ink-mute">Tanggal pesan<Input type="date" value={f.tanggal} onChange={(e) => setF({ ...f, tanggal: e.target.value })} /></label>
            <label className="text-[11px] font-semibold text-ink-mute">Cabang<Select value={f.cabang} onChange={(e) => setF({ ...f, cabang: e.target.value })}><option value="">Semua</option>{BRANCHES.map((b) => <option key={b}>{b}</option>)}</Select></label>
            <label className="text-[11px] font-semibold text-ink-mute">Kurir<Select value={f.kurir} onChange={(e) => setF({ ...f, kurir: e.target.value })}><option value="">Semua</option>{[...new Set(kirim.map((r) => r.kurir?.kurir).filter(Boolean))].map((k) => <option key={k}>{k}</option>)}</Select></label>
            <Button size="sm" disabled={!serah.length} onClick={cetakSerah}><ClipboardList className="h-4 w-4" />Cetak daftar serah terima ({serah.length})</Button>
          </Kotak>
          {!serah.length ? <Empty icon={ClipboardList} title="Tidak ada paket untuk diserahkan" text="Ubah tanggal/cabang/kurir." /> : <ul className="space-y-1 text-[13px]">{serah.map((r) => <li key={r.id} className="flex flex-wrap items-center gap-1.5 rounded-lg bg-white p-2 ring-1 ring-slate-200 dark:bg-white/5"><LogoKurir nama={r.kurir?.kurir} logo={r.kurir?.logo} ukuran={22} /><b className="font-mono">{resiOf(r)}</b> · {r.kurir?.kurir} · {r.penerima?.nama} · {r.paket?.jumlah || 1} koli · <BadgeTahap tahap={r.tahap} /></li>)}</ul>}
        </>
      )}
    </div>
  )
}

// ---------------- Kendala, Retur & Klaim ----------------
export function Kendala() {
  const { user } = useApp()
  const { kirim, kendala } = useKirim()
  const [ed, setEd] = useState(null)
  const [buka, setBuka] = useState(null)
  const [st, setSt] = useState('buka')
  const bermasalah = kirim.filter((r) => ['gagal_pickup', 'gagal_kirim', 'kendala', 'retur_proses', 'dikembalikan', 'hilang_rusak', 'perlu_dicek', 'force_majeure'].includes(r.tahap))
  const tanpaCatatan = bermasalah.filter((r) => !kendala.some((k) => k.kirim_id === r.id))
  const daftar = kendala.filter((k) => (st === 'buka' ? !['selesai', 'ditolak'].includes(k.status) : st === 'tutup' ? ['selesai', 'ditolak'].includes(k.status) : true)).sort((a, b) => String(a.tenggat || 'z').localeCompare(String(b.tenggat || 'z')))
  const kodeKirim = (id) => kirim.find((r) => r.id === id)
  return (
    <div className="space-y-3" data-kendala>
      {tanpaCatatan.length > 0 && (
        <Kotak>
          <p className="mb-1 text-sm font-bold">Pengiriman bermasalah tanpa catatan tindak lanjut ({tanpaCatatan.length})</p>
          <ul className="space-y-1">{tanpaCatatan.map((r) => <li key={r.id} className="flex flex-wrap items-center gap-2 text-[13px]"><button type="button" className="font-semibold text-brand hover:underline" onClick={() => setBuka(r.id)}>{r.kode}</button><BadgeTahap tahap={r.tahap} /><span className="text-ink-mute">{resiOf(r)}</span>{bolehOps(user) && <Button size="sm" variant="outline" className="ml-auto" onClick={() => setEd({ kirim_id: r.id, cabang: r.cabang, jenis: r.tahap === 'hilang_rusak' ? 'klaim' : /retur|dikembalikan/.test(r.tahap) ? 'retur' : r.tahap === 'gagal_kirim' ? 'gagal_kirim' : 'kendala', status: 'terbuka', judul: labelTahap(r.tahap), pic: user.name })}>Catat tindak lanjut</Button>}</li>)}</ul>
        </Kotak>
      )}
      <div className="flex flex-wrap items-center gap-2"><Tabs value={st} onChange={setSt} tabs={[{ value: 'buka', label: 'Belum selesai' }, { value: 'tutup', label: 'Selesai/ditolak' }, { value: 'semua', label: 'Semua' }]} /></div>
      {!daftar.length ? <Empty icon={AlertTriangle} title="Tidak ada catatan kendala" /> : (
        <ul className="space-y-2">{daftar.map((k) => { const r = kodeKirim(k.kirim_id); const telat = k.tenggat && !['selesai', 'ditolak'].includes(k.status) && String(k.tenggat).slice(0, 10) < new Date().toISOString().slice(0, 10); return (
          <li key={k.id} className="rounded-2xl bg-white p-3 text-[13px] ring-1 ring-[#E7E8F0] dark:bg-white/5">
            <p className="font-semibold">{k.judul || k.jenis} <span className="text-[11px] font-normal text-ink-mute">· {k.jenis} · {k.status}</span>{telat && <span className="ml-1 rounded-full bg-rose-50 px-2 text-[11px] text-rose-700 ring-1 ring-rose-200">lewat tenggat</span>}</p>
            <p className="text-ink-mute">{r ? <button type="button" className="underline" onClick={() => setBuka(r.id)}>{r.kode} {resiOf(r)}</button> : 'pengiriman tidak terlihat'} · PIC {k.pic || '-'} · tenggat {k.tenggat ? String(k.tenggat).slice(0, 10) : '-'}{k.tiket ? ` · tiket ${k.tiket}` : ''}{k.awb_retur ? ` · resi retur ${k.awb_retur}` : ''}{k.nilai_klaim ? ` · klaim ${rupiah(k.nilai_klaim)}` : ''}</p>
            {k.catatan && <p>{k.catatan}</p>}{k.hasil && <p className="text-emerald-800">Hasil: {k.hasil}</p>}
            {bolehOps(user) && <Button size="sm" variant="outline" className="mt-1" onClick={() => setEd(k)}><Pencil className="h-4 w-4" />Perbarui</Button>}
          </li>) })}</ul>
      )}
      <Catatan>Klaim resmi diajukan lewat dashboard Everpro; ATLAS mencatat tindak lanjut, PIC, tenggat, nomor tiket, dan hasilnya.</Catatan>
      {ed && <FormKendala awal={ed} onClose={() => setEd(null)} />}
      {buka && <DetailKirim id={buka} onClose={() => setBuka(null)} />}
    </div>
  )
}

// ---------------- Pengaturan ----------------
export function PengaturanKirim() {
  const { user, data, save, remove, notify, ask } = useApp()
  const { templat, setel, ambang } = useKirim()
  const [tab, setTab] = useState('umum')
  const [a, setA] = useState(ambang)
  const [peny, setPeny] = useState(() => setel?.penyedia_cabang || {})
  const [ed, setEd] = useState(null)
  const atur = bolehAturKirim(user)
  const simpanAmbang = async () => {
    try { const row = setel ? { id: setel.id, ambang: a } : { key: 'kirim_setel', ambang: a, penyedia_cabang: peny }; await save('app_settings', row); notify('Ambang tersimpan') } catch (e) { notify(e.message, 'err') }
  }
  return (
    <div className="space-y-3" data-pengaturan-kirim>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'umum', label: 'Ambang & integrasi' }, { value: 'ekspedisi', label: 'Ekspedisi per cabang' }, { value: 'templat', label: 'Templat paket', count: templat.length }, { value: 'kurir', label: 'Kurir' }, { value: 'everpro', label: 'Data langsung Everpro' }]} />
      {tab === 'umum' && (
        <>
          <Kotak className="space-y-2">
            <p className="text-sm font-bold">Ambang &quot;Perlu Perhatian&quot;</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {[['pickup_jam', 'Pickup terlambat setelah (jam)'], ['target_hari', 'Target internal pengiriman (hari)'], ['lewat_estimasi', 'Toleransi di atas estimasi kurir (hari)'], ['basi_1', 'Status basi tingkat 1 (hari)'], ['basi_2', 'Tingkat 2 (hari)'], ['basi_3', 'Tingkat 3 (hari)']].map(([k, l]) => <label key={k} className="text-[11px] font-semibold text-ink-mute">{l}<Input type="number" min="0" disabled={!atur} value={a[k] ?? AMBANG_BAWAAN[k]} onChange={(e) => setA({ ...a, [k]: Number(e.target.value) })} /></label>)}
            </div>
            {atur && <Button size="sm" onClick={simpanAmbang}>Simpan ambang</Button>}
          </Kotak>
          <Kotak className="space-y-1 text-[12px]">
            <p className="text-sm font-bold">Status integrasi Everpro</p>
            <p>• <b>Terhubung lewat server</b>: cek ongkir, cari kelurahan/kode pos, jadwal jemput, buat order, resi, label PDF, lacak, ajukan batal, tarik daftar order.</p>
            <p>• <b>Kabar status otomatis (callback)</b>: aktif bila alamat callback ATLAS sudah didaftarkan di akun Everpro. Setiap kabar dicatat & dicegah dobel.</p>
            <p>• <b>Tidak tersedia di API Everpro</b> (pakai impor laporan / dashboard): saldo, mutasi, top-up, penarikan, klaim, pilihan ukuran label, performa kurir.</p>
            <p>• Tidak ada sinkron terjadwal otomatis; data order ditarik saat tombol &quot;Tarik dari Everpro&quot; ditekan.</p>
            <p className="text-ink-mute">Kunci Everpro tersimpan di Secrets server, tidak pernah di aplikasi.</p>
          </Kotak>
        </>
      )}
      {tab === 'templat' && (
        <>
          {atur && <Button size="sm" onClick={() => setEd({ nama: '', isi: 'Dokumen terjemahan', berat_gram: 200, p: 33, l: 23, t: 1, nilai: 0 })}><Plus className="h-4 w-4" />Tambah templat</Button>}
          {!templat.length ? <Empty icon={ClipboardList} title="Belum ada templat paket" /> : <ul className="grid gap-2 sm:grid-cols-2">{templat.map((t) => <li key={t.id} className="rounded-2xl bg-white p-3 text-[13px] ring-1 ring-[#E7E8F0] dark:bg-white/5"><p className="font-semibold">{t.nama}</p><p className="text-ink-mute">{t.isi} · {t.berat_gram} g · {t.p}×{t.l}×{t.t} cm{t.nilai ? ` · nilai ${rupiah(t.nilai)}` : ''}</p>{t.catatan && <p className="text-[12px]">{t.catatan}</p>}{atur && <div className="mt-1 flex gap-1"><Button size="sm" variant="outline" onClick={() => setEd(t)}>Ubah</Button><Button size="sm" variant="ghost" aria-label="Hapus" onClick={async () => { if (await ask(`Hapus templat ${t.nama}?`)) await remove('kirim_templat', t.id) }}><Trash2 className="h-4 w-4" /></Button></div>}</li>)}</ul>}
          <Catatan>Templat hanya angka awal. Berat, dimensi, dan nilai tetap wajib dicek sesuai paket sebenarnya.</Catatan>
        </>
      )}
      {tab === 'ekspedisi' && (
        <Kotak className="space-y-2" data-ekspedisi-cabang>
          <p className="text-sm font-bold">Ekspedisi bawaan tiap cabang</p>
          <Catatan>Dipakai otomatis saat membuat pengiriman (masih bisa diganti per kiriman). Everpro = ongkir, resi & status otomatis. Pos/DHL/lainnya = input manual dari struk.</Catatan>
          <div className="grid gap-2 sm:grid-cols-3">{BRANCHES.map((b) => (
            <label key={b} className="text-[11px] font-semibold text-ink-mute">{b}
              <Select disabled={!atur} value={peny[b] || penyediaCabang(null, b)} onChange={(e) => setPeny({ ...peny, [b]: e.target.value })}>{Object.entries(PENYEDIA).map(([x, v]) => <option key={x} value={x}>{v.singkat}</option>)}</Select>
            </label>
          ))}</div>
          {atur && <Button size="sm" onClick={async () => { try { await save('app_settings', setel ? { id: setel.id, penyedia_cabang: peny } : { key: 'kirim_setel', penyedia_cabang: peny }); notify('Ekspedisi per cabang tersimpan') } catch (e) { notify(e.message, 'err') } }}>Simpan</Button>}
        </Kotak>
      )}
      {tab === 'kurir' && <Couriers />}
      {tab === 'everpro' && <EverproLangsung />}
      {ed && (
        <Sheet open onClose={() => setEd(null)} title={ed.id ? 'Ubah templat' : 'Templat paket baru'}>
          <div className="grid gap-2 text-sm">
            <label className="text-[11px] font-semibold text-ink-mute">Nama templat<Input value={ed.nama} onChange={(e) => setEd({ ...ed, nama: e.target.value })} /></label>
            <label className="text-[11px] font-semibold text-ink-mute">Isi paket<Input value={ed.isi} onChange={(e) => setEd({ ...ed, isi: e.target.value })} /></label>
            <div className="grid grid-cols-4 gap-2">{[['berat_gram', 'Berat (g)'], ['p', 'P (cm)'], ['l', 'L (cm)'], ['t', 'T (cm)']].map(([k, l]) => <label key={k} className="text-[11px] font-semibold text-ink-mute">{l}<Input type="number" min="0" value={ed[k]} onChange={(e) => setEd({ ...ed, [k]: Number(e.target.value) })} /></label>)}</div>
            <label className="text-[11px] font-semibold text-ink-mute">Nilai barang (Rp)<Input type="number" min="0" value={ed.nilai} onChange={(e) => setEd({ ...ed, nilai: Number(e.target.value) })} /></label>
            <label className="text-[11px] font-semibold text-ink-mute">Catatan<Input value={ed.catatan || ''} onChange={(e) => setEd({ ...ed, catatan: e.target.value })} /></label>
            <Button onClick={async () => { if (!ed.nama.trim() || !(ed.berat_gram > 0)) return notify('Isi nama dan berat', 'err'); await save('kirim_templat', ed); notify('Templat tersimpan'); setEd(null) }}>Simpan</Button>
          </div>
        </Sheet>
      )}
    </div>
  )
}
