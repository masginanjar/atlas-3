// Saldo & Mutasi (Everpro My Balance / Pivot) — API Everpro TIDAK menyediakan saldo/mutasi,
// jadi data berasal dari impor laporan resmi atau input manual, selalu ditandai sumber & waktunya.
import { useMemo, useState } from 'react'
import { Wallet, Upload, Download, Plus, Scale } from 'lucide-react'
import { useApp } from '../../lib/store.jsx'
import { Button, Input, Select, Sheet, Empty, Tabs, cx } from '../ui.jsx'
import { rupiah } from '../../lib/format.js'
import { bolehKeu, fmtWaktu, resiOf } from '../../lib/kirim.js'
import { bukuExcel } from '../UnduhData.jsx'
import { saveBlob } from '../../lib/download.js'
import { useKirim, Kotak, Catatan, BadgeSumber } from './bersama.jsx'
import { bacaFile, tebakPeta, angka } from './impor.js'
import { EVERPRO_DASHBOARD } from './Daftar.jsx'
import { drive } from '../../lib/integrations.js'

export const JENIS_MUTASI = { ongkir: 'Ongkir', cod_dikumpulkan: 'COD dikumpulkan', cod_biaya: 'Biaya COD', cod_ongkir: 'Ongkir COD', cod_nilai: 'Nilai barang COD', asuransi: 'Asuransi', cashback: 'Cashback ongkir', refund: 'Refund', topup: 'Tambah saldo (top-up)', penarikan: 'Penarikan', transfer: 'Transfer internal', lainnya: 'Lainnya' }
const STATUS = { berhasil: 'Berhasil', tertunda: 'Tertunda', dibatalkan: 'Dibatalkan', estimasi: 'Estimasi' }
const BIDANG = [
  ['tanggal', 'Tanggal', ['tanggal', 'date', 'created', 'waktu']], ['arah', 'Debit/Kredit', ['debitkredit', 'type', 'tipe', 'arah', 'dk']],
  ['jenis', 'Jenis transaksi', ['jenistransaksi', 'jenis', 'transactiontype', 'keterangan', 'description', 'deskripsi']],
  ['order', 'No. order', ['clientorder', 'orderno', 'noorder', 'order']], ['resi', 'Resi', ['awb', 'resi']], ['referensi', 'No. referensi', ['referensi', 'reference', 'ref', 'transactionid', 'idtransaksi']],
  ['jumlah', 'Jumlah', ['jumlah', 'amount', 'nominal', 'nilai']], ['debit', 'Debit (bila kolom terpisah)', ['debit']], ['kredit', 'Kredit (bila kolom terpisah)', ['kredit', 'credit']],
  ['saldo', 'Saldo setelah transaksi', ['saldoakhir', 'saldo', 'balance']], ['status', 'Status', ['status']],
]
const jenisDari = (s) => { const t = String(s || '').toLowerCase(); if (/cashback/.test(t)) return 'cashback'; if (/refund|pengembalian dana/.test(t)) return 'refund'; if (/top ?up|isi saldo|tambah saldo/.test(t)) return 'topup'; if (/tarik|withdraw|pencairan/.test(t)) return 'penarikan'; if (/cod.*fee|biaya cod/.test(t)) return 'cod_biaya'; if (/cod/.test(t)) return 'cod_dikumpulkan'; if (/asuransi|insurance/.test(t)) return 'asuransi'; if (/transfer/.test(t)) return 'transfer'; if (/ongkir|shipment|pengiriman|order/.test(t)) return 'ongkir'; return 'lainnya' }
const statusDari = (s) => { const t = String(s || '').toLowerCase(); if (/batal|cancel|gagal|fail/.test(t)) return 'dibatalkan'; if (/pending|tertunda|proses|process/.test(t)) return 'tertunda'; return 'berhasil' }

export default function Saldo() {
  const { user } = useApp()
  const { mutasi, kirim } = useKirim()
  const [tab, setTab] = useState('berhasil')
  const [f, setF] = useState({ dari: new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10), sampai: '', jenis: '', q: '' })
  const [impor, setImpor] = useState(false)
  const [snap, setSnap] = useState(null)
  const [topup, setTopup] = useState(false)
  if (!bolehKeu(user)) return <Empty icon={Wallet} title="Khusus pimpinan" text="Saldo, top-up & mutasi hanya untuk Superadmin, Direktur, dan Admin Pusat." />

  const trx = mutasi.filter((m) => m.jenis !== 'saldo_snapshot')
  const snapshot = mutasi.filter((m) => m.jenis === 'saldo_snapshot').sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal)))[0]
  const periode = trx.filter((m) => { const t = String(m.tanggal || '').slice(0, 10); return (!f.dari || t >= f.dari) && (!f.sampai || t <= f.sampai) })
  const sum = (j, st = 'berhasil') => periode.filter((m) => j.includes(m.jenis) && (!st || m.status === st)).reduce((a, m) => a + Number(m.jumlah || 0), 0)
  const ringkas = [['COD dikumpulkan', sum(['cod_dikumpulkan'])], ['COD bersih', sum(['cod_dikumpulkan']) - sum(['cod_biaya']) - sum(['cod_ongkir'])], ['COD berlangsung', sum(['cod_dikumpulkan'], 'tertunda')], ['Biaya COD', sum(['cod_biaya'])], ['Ongkir COD', sum(['cod_ongkir'])], ['Nilai barang COD', sum(['cod_nilai'])], ['Asuransi', sum(['asuransi'])], ['Cashback ongkir (cair)', sum(['cashback'])], ['Cashback tertunda', sum(['cashback'], 'tertunda')], ['Refund', sum(['refund'])], ['Ongkir', sum(['ongkir'])]]
  const tabFilter = { berhasil: (m) => m.status === 'berhasil' && !['topup', 'penarikan'].includes(m.jenis), tertunda: (m) => ['tertunda', 'estimasi'].includes(m.status), dibatalkan: (m) => m.status === 'dibatalkan', topup: (m) => m.jenis === 'topup', penarikan: (m) => m.jenis === 'penarikan', rekon: () => true }
  const list = periode.filter(tabFilter[tab] || (() => true)).filter((m) => (!f.jenis || m.jenis === f.jenis) && (!f.q || `${m.order} ${m.resi} ${m.referensi}`.toLowerCase().includes(f.q.toLowerCase()))).sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal)))
  const unduh = async () => {
    const head = ['Tanggal', 'Debit/Kredit', 'Jenis', 'Order', 'Resi', 'Referensi', 'Jumlah', 'Saldo setelah', 'Status', 'Sumber data']
    await saveBlob(`Mutasi Everpro ${f.dari} sd ${f.sampai || 'kini'}.xlsx`, await bukuExcel([{ judul: 'Mutasi', head, rows: list.map((m) => [String(m.tanggal || '').slice(0, 16), m.arah, JENIS_MUTASI[m.jenis] || m.jenis, m.order || '', m.resi || '', m.referensi || '', Math.round(m.jumlah || 0), m.saldo != null && m.saldo !== '' ? Math.round(m.saldo) : '', STATUS[m.status] || m.status, m.sumber]) }]))
  }

  return (
    <div className="space-y-3" data-saldo>
      <Kotak>
        <div className="mb-2 flex flex-wrap items-center gap-2"><p className="mr-auto text-sm font-extrabold">Saldo saat ini</p><Button size="sm" onClick={() => setTopup(true)} data-aksi="topup"><Plus className="h-4 w-4" />Top-up saldo</Button><Button size="sm" variant="outline" onClick={() => setSnap({ tersedia: '', tertunda: '', proses: '', ditarik: '' })}>Catat saldo</Button><a className="text-[12px] underline" href={EVERPRO_DASHBOARD} target="_blank" rel="noopener noreferrer">Lihat di Everpro</a></div>
        {snapshot ? (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[['Saldo tersedia', snapshot.tersedia], ['Saldo tertunda', snapshot.tertunda], ['Dalam proses pencairan', snapshot.proses], ['Sudah ditarik', snapshot.ditarik]].map(([l, v]) => <div key={l} className="rounded-xl bg-slate-50 p-2 dark:bg-white/5"><p className="text-[11px] text-ink-mute">{l}</p><p className="text-lg font-extrabold">{rupiah(v)}</p></div>)}</div>
            <p className="mt-1"><BadgeSumber sumber={snapshot.sumber || 'Input manual'} waktu={snapshot.tanggal} /></p>
          </>
        ) : <p className="text-[12px] text-ink-mute">Belum ada catatan saldo. API Everpro tidak menyediakan saldo — salin dari dashboard Everpro lewat &quot;Catat saldo&quot;.</p>}
      </Kotak>

      <Kotak className="flex flex-wrap items-end gap-2">
        <label className="text-[11px] font-semibold text-ink-mute">Dari<Input type="date" value={f.dari} onChange={(e) => setF({ ...f, dari: e.target.value })} /></label>
        <label className="text-[11px] font-semibold text-ink-mute">Sampai<Input type="date" value={f.sampai} onChange={(e) => setF({ ...f, sampai: e.target.value })} /></label>
        <label className="text-[11px] font-semibold text-ink-mute">Jenis<Select value={f.jenis} onChange={(e) => setF({ ...f, jenis: e.target.value })}><option value="">Semua</option>{Object.entries(JENIS_MUTASI).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></label>
        <label className="text-[11px] font-semibold text-ink-mute">Order/resi/referensi<Input value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} /></label>
        <Button size="sm" onClick={() => setImpor(true)}><Upload className="h-4 w-4" />Impor mutasi</Button>
        <Button size="sm" variant="outline" disabled={!list.length} onClick={unduh}><Download className="h-4 w-4" />Excel</Button>
      </Kotak>
      <div>
        <p className="mb-1 text-[12px] font-bold">Transaksi periode ini (bukan saldo)</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">{ringkas.map(([l, v]) => <div key={l} className="rounded-xl bg-white p-2 ring-1 ring-[#E7E8F0] dark:bg-white/5"><p className="text-[11px] text-ink-mute">{l}</p><p className="font-bold">{rupiah(v)}</p></div>)}</div>
        <Catatan>Saldo dan total periode dihitung terpisah; cashback tidak dijumlahkan dengan saldo sebagai keuntungan. Top-up & transfer internal bukan pendapatan.</Catatan>
      </div>

      <Tabs value={tab} onChange={setTab} tabs={[['berhasil', 'Mutasi berhasil'], ['tertunda', 'Tertunda'], ['dibatalkan', 'Dibatalkan'], ['topup', 'Riwayat tambah saldo'], ['penarikan', 'Riwayat penarikan'], ['rekon', 'Rekonsiliasi']].map(([value, label]) => ({ value, label }))} />
      {tab === 'rekon' ? <Rekon mutasi={periode} kirim={kirim} /> : !list.length ? <Empty icon={Wallet} title="Belum ada mutasi" text="Impor laporan mutasi dari dashboard Everpro (Excel/CSV)." /> : (
        <div className="overflow-x-auto rounded-2xl ring-1 ring-[#E7E8F0]">
          <table className="w-full min-w-[860px] bg-white text-[12px] dark:bg-white/5">
            <thead className="bg-slate-50 text-[11px] text-ink-mute"><tr>{['Tanggal', 'D/K', 'Jenis', 'Order', 'Resi', 'Referensi', 'Jumlah', 'Saldo setelah', 'Status', 'Sumber'].map((h) => <th key={h} className="p-2 text-left">{h}</th>)}</tr></thead>
            <tbody>{list.map((m) => <tr key={m.id} className="border-t border-slate-100"><td className="p-2">{fmtWaktu(m.tanggal)}</td><td className="p-2">{m.arah === 'kredit' ? 'Kredit' : 'Debit'}</td><td className="p-2">{JENIS_MUTASI[m.jenis] || m.jenis}</td><td className="p-2">{m.order}</td><td className="p-2 font-mono">{m.resi}</td><td className="p-2">{m.referensi}</td><td className={cx('p-2 text-right font-semibold', m.arah === 'kredit' ? 'text-emerald-700' : '')}>{m.arah === 'kredit' ? '+' : '−'}{rupiah(m.jumlah)}</td><td className="p-2 text-right">{m.saldo != null && m.saldo !== '' ? rupiah(m.saldo) : '-'}</td><td className="p-2">{STATUS[m.status] || m.status}</td><td className="p-2 text-ink-mute">{m.sumber}</td></tr>)}</tbody>
          </table>
        </div>
      )}
      {impor && <ImporMutasi onClose={() => setImpor(false)} />}
      {snap && <CatatSaldo awal={snap} onClose={() => setSnap(null)} />}
      {topup && <TopUp onClose={() => { setTopup(false); setTab('topup') }} />}
    </div>
  )
}

/** Top-up dilakukan di dashboard Everpro (API tidak menyediakan top-up); di sini dicatat + bukti. */
function TopUp({ onClose }) {
  const { user, save, notify, ask } = useApp()
  const { mutasi } = useKirim()
  const [f, setF] = useState({ jumlah: '', tanggal: new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 16), metode: 'Transfer bank', referensi: '', catatan: '', bukti: null })
  const [sibuk, setSibuk] = useState('')
  const kunci = f.referensi.trim() ? `ref|${f.referensi.trim()}|topup` : ''
  const dobel = kunci && mutasi.some((m) => m.kunci === kunci)
  const simpan = async () => {
    if (!(Number(f.jumlah) > 0)) return notify('Isi nominal top-up', 'err')
    if (!f.referensi.trim()) return notify('Isi nomor referensi (dari Everpro / bukti transfer)', 'err')
    if (dobel) return notify('Nomor referensi ini sudah tercatat', 'err')
    if (!(await ask(`Catat top-up ${rupiah(Number(f.jumlah))} (ref ${f.referensi.trim()})? Pastikan top-up sudah dilakukan di Everpro.`))) return
    setSibuk('simpan')
    try {
      await save('kirim_mutasi', { jenis: 'topup', arah: 'kredit', status: 'berhasil', jumlah: Number(f.jumlah), tanggal: new Date(f.tanggal).toISOString(), metode: f.metode, referensi: f.referensi.trim(), catatan: f.catatan, bukti: f.bukti, sumber: 'Input manual', oleh: user.name, dicatat_at: new Date().toISOString(), kunci })
      notify('Top-up tercatat'); onClose()
    } catch (e) { notify(e.message, 'err') } finally { setSibuk('') }
  }
  return (
    <Sheet open onClose={onClose} title="Top-up saldo Everpro" subtitle="Khusus Superadmin, Direktur & Admin Pusat">
      <div className="grid gap-2 text-sm" data-form-topup>
        <ol className="list-decimal space-y-0.5 pl-4 text-[12px] text-ink-soft">
          <li>Buka dashboard Everpro → top-up saldo, bayar sesuai petunjuk Everpro.</li>
          <li>Setelah berhasil, catat di sini dengan nomor referensinya + foto bukti.</li>
        </ol>
        <a href={EVERPRO_DASHBOARD} target="_blank" rel="noopener noreferrer" className="text-[12px] font-semibold underline">Buka dashboard Everpro</a>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[11px] font-semibold text-ink-mute">Nominal (Rp)<Input type="number" min="0" value={f.jumlah} onChange={(e) => setF({ ...f, jumlah: e.target.value })} data-f="topup-jumlah" /></label>
          <label className="text-[11px] font-semibold text-ink-mute">Tanggal & jam (WITA)<Input type="datetime-local" value={f.tanggal} onChange={(e) => setF({ ...f, tanggal: e.target.value })} /></label>
          <label className="text-[11px] font-semibold text-ink-mute">Metode<Select value={f.metode} onChange={(e) => setF({ ...f, metode: e.target.value })}>{['Transfer bank', 'Virtual account', 'QRIS', 'E-wallet', 'Lainnya'].map((m) => <option key={m}>{m}</option>)}</Select></label>
          <label className="text-[11px] font-semibold text-ink-mute">No. referensi<Input value={f.referensi} onChange={(e) => setF({ ...f, referensi: e.target.value })} data-f="topup-ref" />{dobel && <span className="text-rose-700">Sudah tercatat</span>}</label>
        </div>
        <label className="text-[11px] font-semibold text-ink-mute">Catatan<Input value={f.catatan} onChange={(e) => setF({ ...f, catatan: e.target.value })} /></label>
        <label className="inline-flex h-10 w-fit cursor-pointer items-center gap-2 rounded-xl px-3 text-[13px] ring-1 ring-slate-200 hover:ring-brand">{sibuk === 'unggah' ? 'Mengunggah…' : f.bukti ? `✓ ${f.bukti.name || 'bukti tersimpan'}` : 'Unggah bukti transfer'}
          <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={async (e) => { const x = e.target.files?.[0]; if (!x) return; setSibuk('unggah'); try { const b = await drive.upload(x, { branch: 'Pusat', invoice: 'TOPUP-EVERPRO' }); setF((y) => ({ ...y, bukti: b })) } catch (er) { notify('Gagal unggah: ' + er.message, 'err') } finally { setSibuk('') } }} />
        </label>
        <Button loading={sibuk === 'simpan'} disabled={!!sibuk} onClick={simpan} data-aksi="simpan-topup">Catat top-up</Button>
        <Catatan>Top-up bukan pendapatan atau biaya pengiriman. Saat laporan mutasi Everpro diimpor, baris dengan nomor referensi yang sama otomatis dianggap sudah ada (tidak dobel).</Catatan>
      </div>
    </Sheet>
  )
}

function CatatSaldo({ awal, onClose }) {
  const { user, save, notify } = useApp()
  const [s, setS] = useState(awal)
  return (
    <Sheet open onClose={onClose} title="Catat saldo dari dashboard Everpro" subtitle="Disimpan sebagai input manual dengan waktu pencatatan">
      <div className="grid gap-2 text-sm">
        {[['tersedia', 'Saldo tersedia'], ['tertunda', 'Saldo tertunda'], ['proses', 'Dalam proses pencairan'], ['ditarik', 'Sudah ditarik']].map(([k, l]) => <label key={k} className="text-[11px] font-semibold text-ink-mute">{l} (Rp)<Input type="number" min="0" value={s[k]} onChange={(e) => setS({ ...s, [k]: e.target.value })} /></label>)}
        <Button onClick={async () => { const now = new Date().toISOString(); await save('kirim_mutasi', { jenis: 'saldo_snapshot', tanggal: now, tersedia: Number(s.tersedia || 0), tertunda: Number(s.tertunda || 0), proses: Number(s.proses || 0), ditarik: Number(s.ditarik || 0), sumber: 'Input manual', oleh: user.name, kunci: `snap|${now}` }); notify('Saldo tercatat'); onClose() }}>Simpan</Button>
      </div>
    </Sheet>
  )
}

function ImporMutasi({ onClose }) {
  const { user, save, notify } = useApp()
  const { mutasi } = useKirim()
  const [file, setFile] = useState(null)
  const [peta, setPeta] = useState({})
  const [sibuk, setSibuk] = useState(false)
  const [hasil, setHasil] = useState(null)
  const ada = useMemo(() => new Set(mutasi.map((m) => m.kunci)), [mutasi])
  const baris = useMemo(() => (file?.baris || []).map((b, i) => {
    const g = (k) => (peta[k] ? b[peta[k]] : '')
    const debit = angka(g('debit')), kredit = angka(g('kredit')), j = angka(g('jumlah'))
    const arahTeks = String(g('arah')).toLowerCase()
    const arah = kredit > 0 ? 'kredit' : debit > 0 ? 'debit' : /kredit|credit|masuk|\+/.test(arahTeks) ? 'kredit' : j < 0 ? 'debit' : /debit|keluar|-/.test(arahTeks) ? 'debit' : 'debit'
    const jumlah = Math.abs(kredit || debit || j)
    const m = { tanggal: g('tanggal'), arah, jenis: jenisDari(g('jenis')), jenis_asli: g('jenis'), order: g('order'), resi: g('resi'), referensi: g('referensi'), jumlah, saldo: g('saldo') ? angka(g('saldo')) : '', status: statusDari(g('status')), status_asli: g('status') }
    m.kunci = m.referensi ? `ref|${m.referensi}|${m.jenis}` : `row|${m.tanggal}|${m.order}|${m.resi}|${m.jenis_asli}|${m.jumlah}|${m.arah}`
    const salah = []; if (!m.tanggal) salah.push('tanggal'); if (!(jumlah > 0)) salah.push('jumlah')
    return { i, m, salah, dobel: ada.has(m.kunci) }
  }), [file, peta, ada])
  const kunciFile = new Set(); const valid = baris.filter((b) => { if (b.salah.length || b.dobel || kunciFile.has(b.m.kunci)) return false; kunciFile.add(b.m.kunci); return true })
  const jalan = async () => {
    setSibuk(true); let ok = 0, gagal = 0
    for (const b of valid) { try { const d = new Date(String(b.m.tanggal).replace(/(\d{2})[/-](\d{2})[/-](\d{4})/, '$3-$2-$1')); await save('kirim_mutasi', { ...b.m, tanggal: Number.isNaN(d.getTime()) ? b.m.tanggal : d.toISOString(), sumber: 'Impor laporan', file: file.nama, diimpor_oleh: user.name, diimpor_at: new Date().toISOString() }); ok++ } catch { gagal++ } }
    setSibuk(false); setHasil({ ok, gagal }); notify(`Impor mutasi: ${ok} masuk${gagal ? `, ${gagal} gagal` : ''}`)
  }
  return (
    <Sheet open onClose={onClose} xwide title="Impor mutasi Everpro" subtitle="Unduh laporan mutasi/saldo dari dashboard Everpro, lalu unggah Excel/CSV-nya">
      <div className="space-y-3 text-sm">
        <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-[#141B34] px-3 font-semibold text-white"><Upload className="h-4 w-4" />Pilih file<input type="file" accept=".xlsx,.csv" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { const x = await bacaFile(f); setFile({ nama: f.name, ...x }); setPeta(tebakPeta(x.kolom, BIDANG)); setHasil(null) } catch (er) { notify(er.message, 'err') } }} /></label>
        {file && (
          <>
            <div className="grid gap-2 sm:grid-cols-3">{BIDANG.map(([k, l]) => <label key={k} className="text-[11px] font-semibold text-ink-mute">{l}<Select value={peta[k] || ''} onChange={(e) => setPeta({ ...peta, [k]: e.target.value })}><option value="">— tidak ada —</option>{file.kolom.map((c) => <option key={c}>{c}</option>)}</Select></label>)}</div>
            <p className="text-[12px]">{file.baris.length} baris · siap masuk {valid.length} · sudah pernah diimpor {baris.filter((b) => b.dobel).length} · bermasalah {baris.filter((b) => b.salah.length).length}</p>
            <div className="max-h-72 overflow-auto rounded-xl ring-1 ring-slate-200"><table className="w-full text-[12px]"><thead className="sticky top-0 bg-slate-50"><tr>{['Baris', 'Tanggal', 'D/K', 'Jenis', 'Order/resi', 'Jumlah', 'Status', 'Cek'].map((h) => <th key={h} className="p-1.5 text-left">{h}</th>)}</tr></thead><tbody>{baris.slice(0, 300).map((b) => <tr key={b.i} className={cx('border-t', (b.salah.length || b.dobel) && 'bg-amber-50')}><td className="p-1.5">{b.i + 2}</td><td className="p-1.5">{b.m.tanggal}</td><td className="p-1.5">{b.m.arah}</td><td className="p-1.5">{JENIS_MUTASI[b.m.jenis]}<span className="text-ink-mute"> ({b.m.jenis_asli})</span></td><td className="p-1.5">{b.m.order} {b.m.resi}</td><td className="p-1.5">{rupiah(b.m.jumlah)}</td><td className="p-1.5">{STATUS[b.m.status]}</td><td className="p-1.5">{b.salah.length ? `kurang: ${b.salah.join(', ')}` : b.dobel ? 'sudah ada' : 'OK'}</td></tr>)}</tbody></table></div>
            <Button loading={sibuk} disabled={!valid.length || !!hasil} onClick={jalan}>Impor {valid.length} mutasi</Button>
            {hasil && <p className="text-[12px]">Selesai: {hasil.ok} masuk, {hasil.gagal} gagal. Impor ulang file yang sama tidak menggandakan data.</p>}
            <Catatan>Jenis transaksi ditebak dari teks keterangan — periksa kolom Jenis sebelum impor. Data impor tidak pernah disebut real-time.</Catatan>
          </>
        )}
      </div>
    </Sheet>
  )
}

/** Rekonsiliasi: pasangkan mutasi ke pengiriman lewat order/resi. Yang tidak cocok masuk antrean, tidak dipaksa. */
function Rekon({ mutasi, kirim }) {
  const byOrder = new Map(), byAwb = new Map()
  for (const r of kirim) { if (r.everpro?.client_order_no) byOrder.set(r.everpro.client_order_no, r); if (resiOf(r)) byAwb.set(resiOf(r), r) }
  const relevan = mutasi.filter((m) => !['topup', 'penarikan', 'transfer', 'saldo_snapshot'].includes(m.jenis))
  const cocok = [], belum = []
  for (const m of relevan) { const r = byOrder.get(m.order) || byAwb.get(m.resi); (r ? cocok : belum).push({ m, r }) }
  const kunciDup = new Map(); for (const m of relevan) { const k = `${m.order || m.resi}|${m.jenis}|${m.jumlah}|${m.arah}`; kunciDup.set(k, (kunciDup.get(k) || 0) + 1) }
  const dup = relevan.filter((m) => kunciDup.get(`${m.order || m.resi}|${m.jenis}|${m.jumlah}|${m.arah}`) > 1)
  const perKirim = new Map(); for (const { m, r } of cocok) { if (m.jenis !== 'ongkir' || m.status === 'dibatalkan') continue; perKirim.set(r.id, (perKirim.get(r.id) || 0) + (m.arah === 'debit' ? 1 : -1) * Number(m.jumlah || 0)) }
  const selisih = [...perKirim.entries()].map(([id, akt]) => { const r = kirim.find((x) => x.id === id); return { r, est: Number(r.biaya?.total || 0), akt } }).filter((x) => x.est && Math.abs(x.est - x.akt) >= 1)
  const cb = (st) => relevan.filter((m) => m.jenis === 'cashback' && m.status === st).reduce((a, m) => a + Number(m.jumlah || 0), 0)
  const cbEst = kirim.filter((r) => r.biaya?.cashback_estimasi && !['dibatalkan', 'draft'].includes(r.tahap)).reduce((a, r) => a + Number(r.biaya.cashback_estimasi || 0), 0)
  const refundBatal = kirim.filter((r) => r.tahap === 'dibatalkan' && r.dipesan_at)
  const refundBelum = refundBatal.filter((r) => !relevan.some((m) => m.jenis === 'refund' && m.status === 'berhasil' && (m.order === r.everpro?.client_order_no || m.resi === resiOf(r))))
  return (
    <div className="space-y-3" data-rekon>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[['Mutasi cocok', cocok.length], ['Belum cocok (antrean)', belum.length], ['Kemungkinan duplikat', dup.length], ['Selisih ongkir', selisih.length]].map(([l, v]) => <div key={l} className="rounded-xl bg-white p-2 ring-1 ring-[#E7E8F0] dark:bg-white/5"><p className="text-[11px] text-ink-mute">{l}</p><p className="text-lg font-extrabold">{v}</p></div>)}</div>
      <Kotak><p className="mb-1 text-[12px] font-bold">Cashback (dipisah, tidak dijumlah)</p><p className="text-[12px]">Estimasi dari tarif {rupiah(cbEst)} · tertunda {rupiah(cb('tertunda'))} · cair {rupiah(cb('berhasil'))} · dibatalkan {rupiah(cb('dibatalkan'))}</p></Kotak>
      <Kotak><p className="mb-1 text-[12px] font-bold">Pembatalan vs refund</p><p className="text-[12px]">{refundBatal.length} pengiriman dibatalkan setelah dipesan · {refundBelum.length} belum ada mutasi refund berhasil.</p>{refundBelum.slice(0, 20).map((r) => <p key={r.id} className="text-[12px] text-ink-mute">• {r.kode} {r.everpro?.client_order_no}</p>)}</Kotak>
      {selisih.length > 0 && <Kotak><p className="mb-1 text-[12px] font-bold">Ongkir estimasi vs tagihan aktual</p>{selisih.map(({ r, est, akt }) => <p key={r.id} className="text-[12px]">{r.kode} · estimasi {rupiah(est)} · mutasi {rupiah(akt)} · selisih <b>{rupiah(akt - est)}</b></p>)}</Kotak>}
      <Kotak><p className="mb-1 text-[12px] font-bold">Antrean pemeriksaan — belum cocok ({belum.length})</p>{!belum.length ? <p className="text-[12px] text-ink-mute">Semua mutasi pengiriman sudah tercocokkan.</p> : belum.slice(0, 100).map(({ m }) => <p key={m.id} className="text-[12px]">• {fmtWaktu(m.tanggal)} · {JENIS_MUTASI[m.jenis]} · {m.order || '-'} / {m.resi || '-'} · {rupiah(m.jumlah)} · ref {m.referensi || '-'}</p>)}<Catatan>Biasanya karena order dibuat langsung di Everpro (belum ditarik ke ATLAS). Tarik dari Everpro di Daftar Pengiriman, lalu cek lagi. Tidak dipasangkan otomatis berdasarkan tebakan.</Catatan></Kotak>
      {dup.length > 0 && <Kotak><p className="mb-1 text-[12px] font-bold">Kemungkinan duplikat</p>{dup.map((m) => <p key={m.id} className="text-[12px]">• {fmtWaktu(m.tanggal)} · {JENIS_MUTASI[m.jenis]} · {m.order || m.resi} · {rupiah(m.jumlah)} · ref {m.referensi || '-'}</p>)}</Kotak>}
      <p className="flex items-center gap-1 text-[11px] text-ink-mute"><Scale className="h-3 w-3" />Top-up, penarikan, dan transfer internal tidak dihitung sebagai biaya/pendapatan pengiriman.</p>
    </div>
  )
}
