// Draft & Impor Massal.
//  • Impor jadi DRAFT: tiap baris jadi draft (tidak ada booking). Dipesan satu per satu setelah dicek.
//  • Impor DATA HISTORIS (laporan Everpro): hanya dicatat sebagai riwayat — tidak pernah memesan apa pun.
import { useMemo, useState } from 'react'
import { Upload, FileDown, Trash2, Pencil, FileText } from 'lucide-react'
import { useApp } from '../../lib/store.jsx'
import { Button, Select, Empty, Tabs, cx } from '../ui.jsx'
import { go } from '../../lib/router.js'
import { BRANCHES } from '../../config/access.js'
import { normalHp, kodeposOk, nomorKode, bolehOps, bolehPenting, fmtWaktu, resiOf } from '../../lib/kirim.js'
import { useKirim, Kotak, Catatan, BadgeTahap } from './bersama.jsx'
import { bacaFile, tebakPeta, angka, unduhCsv } from './impor.js'

const BIDANG_DRAFT = [
  ['penerima_nama', 'Nama penerima', ['namapenerima', 'penerima', 'receivername', 'nama']],
  ['penerima_telp', 'No. HP penerima', ['hppenerima', 'telppenerima', 'receiverphone', 'telepon', 'hp', 'phone']],
  ['penerima_alamat', 'Alamat penerima', ['alamatpenerima', 'receiveraddress', 'alamat']],
  ['penerima_kodepos', 'Kode pos penerima', ['kodepospenerima', 'receiverpostal', 'kodepos', 'postal']],
  ['berat_gram', 'Berat (gram)', ['berat', 'weight']],
  ['isi', 'Isi paket', ['isi', 'packagedesc', 'deskripsi']],
  ['nilai', 'Nilai barang', ['nilai', 'packageprice', 'harga']],
  ['invoice', 'No. invoice (opsional)', ['invoice', 'faktur']],
  ['catatan', 'Catatan (opsional)', ['catatan', 'note']],
]
const BIDANG_HISTORIS = [
  ['order', 'No. order (client order)', ['clientorder', 'orderno', 'noorder', 'order']],
  ['awb', 'No. resi / AWB', ['awb', 'resi', 'airwaybill']],
  ['tanggal', 'Tanggal', ['tanggal', 'orderdate', 'date', 'created']],
  ['status', 'Status', ['status']],
  ['kurir', 'Kurir', ['kurir', 'courier', 'logistic', 'ekspedisi']],
  ['penerima_nama', 'Nama penerima', ['namapenerima', 'penerima', 'receivername']],
  ['penerima_kota', 'Kota/lokasi tujuan', ['tujuan', 'destination', 'kota', 'city']],
  ['pengirim_nama', 'Nama pengirim', ['namapengirim', 'pengirim', 'shipper']],
  ['total', 'Total biaya', ['totalprice', 'total', 'ongkir', 'shipmentprice', 'biaya']],
  ['cashback', 'Cashback', ['cashback']],
]

export default function DraftImpor() {
  const { user, save, remove, notify, ask } = useApp()
  const { kirim } = useKirim()
  const [tab, setTab] = useState('draft')
  const draft = kirim.filter((r) => ['draft', 'siap', 'gagal_order'].includes(r.tahap)).sort((a, b) => String(b.updated_at || b.created_at).localeCompare(String(a.updated_at || a.created_at)))
  return (
    <div className="space-y-3" data-draft-impor>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'draft', label: 'Draft', count: draft.length }, bolehPenting(user) && { value: 'impor_draft', label: 'Impor jadi draft' }, bolehPenting(user) && { value: 'historis', label: 'Impor data historis' }].filter(Boolean)} />
      {tab === 'draft' && (!draft.length ? <Empty icon={FileText} title="Tidak ada draft" text="Draft muncul saat Anda menyimpan pengiriman yang belum dipesan." /> : (
        <ul className="space-y-2">
          {draft.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-white p-3 ring-1 ring-[#E7E8F0] dark:bg-white/5" data-draft={r.id}>
              <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{r.kode} · {r.penerima?.nama || 'penerima belum diisi'} <BadgeTahap tahap={r.tahap} /></p><p className="text-[11px] text-ink-mute">{r.cabang} · {r.kurir?.kurir ? `${r.kurir.kurir} ${r.kurir.layanan}` : 'kurir belum dipilih'} · diubah {fmtWaktu(r.updated_at || r.created_at)}{r.sumber === 'Impor laporan' ? '' : ''}</p></div>
              {bolehOps(user) && <Button size="sm" onClick={() => go(`pengiriman/buat/${r.id}`)}><Pencil className="h-4 w-4" />Lanjutkan</Button>}
              {bolehOps(user) && !r.everpro?.client_order_no && <Button size="sm" variant="ghost" aria-label="Hapus draft" onClick={async () => { if (await ask(`Hapus draft ${r.kode}?`)) { await remove('kirim', r.id); notify('Draft dihapus') } }}><Trash2 className="h-4 w-4" /></Button>}
            </li>
          ))}
        </ul>
      ))}
      {tab === 'impor_draft' && bolehPenting(user) && <Impor mode="draft" bidang={BIDANG_DRAFT} />}
      {tab === 'historis' && bolehPenting(user) && <Impor mode="historis" bidang={BIDANG_HISTORIS} />}
    </div>
  )
}

function Impor({ mode, bidang }) {
  const { user, data, save, notify } = useApp()
  const { kirim, alamatCabang } = useKirim()
  const [file, setFile] = useState(null)
  const [peta, setPeta] = useState({})
  const [cabang, setCabang] = useState(user.branch && BRANCHES.includes(user.branch) ? user.branch : 'Bali')
  const [pilih, setPilih] = useState(new Set())
  const [hasil, setHasil] = useState({})
  const [sibuk, setSibuk] = useState(false)
  const muat = async (f) => {
    try { const x = await bacaFile(f); setFile({ nama: f.name, ...x }); setPeta(tebakPeta(x.kolom, bidang)); setHasil({}); setPilih(new Set()) }
    catch (e) { notify('File tidak bisa dibaca: ' + e.message, 'err') }
  }
  const sudahOrder = new Set(kirim.map((r) => r.everpro?.client_order_no).filter(Boolean))
  const sudahAwb = new Set(kirim.map((r) => resiOf(r)).filter(Boolean))
  const baris = useMemo(() => (file?.baris || []).map((b, i) => {
    const v = Object.fromEntries(bidang.map(([k]) => [k, peta[k] ? b[peta[k]] : '']))
    const salah = []; let dobel = ''
    if (mode === 'draft') {
      if (String(v.penerima_nama).length < 3) salah.push('nama')
      if (!normalHp(v.penerima_telp).ok) salah.push('No. HP')
      if (String(v.penerima_alamat).length < 10) salah.push('alamat')
      if (!kodeposOk(v.penerima_kodepos)) salah.push('kode pos')
      if (!(angka(v.berat_gram) > 0)) salah.push('berat')
      const kunci = `${v.penerima_nama}|${v.penerima_kodepos}|${v.invoice}`.toLowerCase()
      if (kirim.some((r) => ['draft', 'siap'].includes(r.tahap) && `${r.penerima?.nama}|${r.penerima?.kodepos}|${r.invoice_no || ''}`.toLowerCase() === kunci)) dobel = 'Draft serupa sudah ada'
    } else {
      if (!v.order && !v.awb) salah.push('no. order/resi')
      if ((v.order && sudahOrder.has(v.order)) || (v.awb && sudahAwb.has(v.awb))) dobel = 'Sudah ada di ATLAS'
    }
    const dalamFile = (file?.baris || []).findIndex((x) => (mode === 'historis' ? (peta.order && x[peta.order] && x[peta.order] === b[peta.order]) || (peta.awb && x[peta.awb] && x[peta.awb] === b[peta.awb]) : JSON.stringify(x) === JSON.stringify(b)))
    if (dalamFile !== -1 && dalamFile < i) dobel = `Duplikat baris ${dalamFile + 2}`
    return { i, v, salah, dobel }
  }), [file, peta, mode]) // eslint-disable-line react-hooks/exhaustive-deps
  const valid = baris.filter((b) => !b.salah.length && !b.dobel)
  if (!bolehPenting(user)) return <Empty icon={Upload} title="Khusus Superadmin, Direktur & Admin Pusat" />

  const jalankan = async (hanyaGagal) => {
    const target = baris.filter((b) => pilih.has(b.i) && (!hanyaGagal || hasil[b.i]?.gagal))
    if (!target.length) return notify('Pilih baris yang valid', 'err')
    setSibuk(true)
    const ac = alamatCabang[cabang] || {}
    for (const b of target) {
      if (hasil[b.i]?.ok) continue
      try {
        const v = b.v, now = new Date().toISOString()
        if (mode === 'draft') {
          const p = v.invoice ? (data.projects || []).find((x) => x.invoice_no === v.invoice) : null
          await save('kirim', { kode: nomorKode(), sumber: 'Impor laporan', sumber_status: 'Impor laporan', tahap: 'draft', cabang, jenis_kirim: 'keluar', pic: user.name, project_id: p?.id || '', invoice_no: v.invoice || '', pelanggan: p?.customer?.name || v.penerima_nama, ongkir_ditanggung: 'kantor', checklist: {}, dokumen: {},
            pengirim: { nama: ac.nama || '', telp: ac.telp || '', alamat: ac.alamat || '', kodepos: ac.kodepos || '' },
            penerima: { nama: v.penerima_nama, telp: normalHp(v.penerima_telp).nomor, alamat: v.penerima_alamat, kodepos: v.penerima_kodepos, catatan: v.catatan },
            paket: { isi: v.isi || 'Dokumen terjemahan', jumlah: 1, berat_gram: angka(v.berat_gram), nilai: angka(v.nilai) }, kurir: {},
            riwayat: [{ at: now, by: user.name, aksi: `Draft dari impor ${file.nama} baris ${b.i + 2}` }] })
        } else {
          await save('kirim', { kode: v.order || v.awb, sumber: 'Impor laporan', sumber_status: 'Impor laporan', diperbarui_at: now, tahap: tahapTeks(v.status), status_everpro: v.status, cabang, jenis_kirim: 'lainnya',
            everpro: { client_order_no: v.order, awb: v.awb }, dibuat_at: tanggalIso(v.tanggal), pengirim: { nama: v.pengirim_nama }, penerima: { nama: v.penerima_nama, lokasi: v.penerima_kota },
            kurir: { kurir: v.kurir }, biaya_aktual: { total: angka(v.total), cashback: angka(v.cashback) }, riwayat: [{ at: now, by: user.name, aksi: `Diimpor dari laporan ${file.nama} baris ${b.i + 2} (data historis — tanpa booking)` }] })
        }
        setHasil((h) => ({ ...h, [b.i]: { ok: true } }))
      } catch (e) { setHasil((h) => ({ ...h, [b.i]: { gagal: String(e.message).slice(0, 120) } })) }
    }
    setSibuk(false); notify('Impor selesai — lihat hasil per baris')
  }
  const nOk = Object.values(hasil).filter((h) => h.ok).length, nGagal = Object.values(hasil).filter((h) => h.gagal).length

  return (
    <div className="space-y-3">
      <Kotak className="space-y-2">
        <p className="text-sm font-bold">{mode === 'draft' ? 'Impor jadi draft (tidak memesan kurir)' : 'Impor data historis dari laporan Everpro (tidak memesan kurir)'}</p>
        <Catatan>{mode === 'draft' ? 'Format: Excel/CSV dengan kolom seperti templat. Tiap baris jadi draft; pesan kurir dilakukan per draft setelah dicek.' : 'Unduh laporan order dari dashboard Everpro (Excel/CSV), lalu unggah di sini. Baris yang sudah ada (no. order/resi sama) dilewati.'}</Catatan>
        <div className="flex flex-wrap items-center gap-2">
          <label className={cx('inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-[#141B34] px-3 text-sm font-semibold text-white')}><Upload className="h-4 w-4" />Pilih file<input type="file" accept=".xlsx,.csv" className="sr-only" onChange={(e) => e.target.files?.[0] && muat(e.target.files[0])} /></label>
          {mode === 'draft' && <Button size="sm" variant="outline" onClick={() => unduhCsv('templat-draft-pengiriman.csv', BIDANG_DRAFT.map((b) => b[1]), [['Contoh Nama', '081200000000', 'Jl. Contoh No. 1, Kecamatan, Kota', '12950', '300', 'Dokumen terjemahan', '0', '', '']])}><FileDown className="h-4 w-4" />Unduh templat</Button>}
          <label className="text-[11px] font-semibold text-ink-mute">Cabang<Select value={cabang} onChange={(e) => setCabang(e.target.value)} className="ml-1 inline-block w-36">{BRANCHES.map((b) => <option key={b}>{b}</option>)}</Select></label>
          {file && <span className="text-[12px] text-ink-mute">{file.nama} · {file.baris.length} baris</span>}
        </div>
      </Kotak>
      {file && (
        <>
          <Kotak>
            <p className="mb-2 text-[12px] font-bold">Pemetaan kolom</p>
            <div className="grid gap-2 sm:grid-cols-3">{bidang.map(([k, l]) => <label key={k} className="text-[11px] font-semibold text-ink-mute">{l}<Select value={peta[k] || ''} onChange={(e) => setPeta((p) => ({ ...p, [k]: e.target.value }))}><option value="">— tidak ada —</option>{file.kolom.map((c) => <option key={c}>{c}</option>)}</Select></label>)}</div>
          </Kotak>
          <p className="text-[12px]">Valid {valid.length} · bermasalah {baris.filter((b) => b.salah.length).length} · duplikat {baris.filter((b) => b.dobel).length}{nOk + nGagal ? ` · hasil: ${nOk} berhasil, ${nGagal} gagal` : ''}</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setPilih(new Set(valid.map((b) => b.i)))}>Pilih semua yang valid</Button>
            <Button size="sm" loading={sibuk} disabled={!pilih.size} onClick={() => jalankan(false)} data-aksi="impor">{mode === 'draft' ? 'Buat draft' : 'Simpan data historis'} ({pilih.size})</Button>
            {nGagal > 0 && <Button size="sm" variant="outline" loading={sibuk} onClick={() => jalankan(true)}>Ulangi baris gagal ({nGagal})</Button>}
          </div>
          <div className="max-h-[420px] overflow-auto rounded-xl ring-1 ring-slate-200">
            <table className="w-full min-w-[700px] text-[12px]">
              <thead className="sticky top-0 bg-slate-50"><tr><th className="p-2" />{['Baris', ...bidang.slice(0, 5).map((b) => b[1]), 'Pemeriksaan', 'Hasil'].map((h) => <th key={h} className="p-2 text-left">{h}</th>)}</tr></thead>
              <tbody>{baris.map((b) => (
                <tr key={b.i} className={cx('border-t border-slate-100', (b.salah.length || b.dobel) && 'bg-rose-50/60')}>
                  <td className="p-2"><input type="checkbox" disabled={!!b.salah.length || !!b.dobel || hasil[b.i]?.ok} checked={pilih.has(b.i)} onChange={() => setPilih((s) => { const n = new Set(s); n.has(b.i) ? n.delete(b.i) : n.add(b.i); return n })} aria-label={`Pilih baris ${b.i + 2}`} /></td>
                  <td className="p-2">{b.i + 2}</td>
                  {bidang.slice(0, 5).map(([k]) => <td key={k} className="max-w-[180px] truncate p-2">{b.v[k]}</td>)}
                  <td className="p-2">{b.salah.length ? <span className="text-rose-700">Kurang/salah: {b.salah.join(', ')}</span> : b.dobel ? <span className="text-amber-800">{b.dobel}</span> : <span className="text-emerald-700">OK</span>}</td>
                  <td className="p-2">{hasil[b.i]?.ok ? <span className="text-emerald-700">Berhasil</span> : hasil[b.i]?.gagal ? <span className="text-rose-700">Gagal: {hasil[b.i].gagal}</span> : ''}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function tahapTeks(s) {
  const t = String(s || '').toUpperCase()
  if (!t) return 'perlu_dicek'
  if (/CANCEL|BATAL/.test(t)) return 'dibatalkan'
  if (/LOST|BROKEN|HILANG|RUSAK/.test(t)) return 'hilang_rusak'
  if (/IN PROCESS RETURN|PROSES RETUR/.test(t)) return 'retur_proses'
  if (/RETURN|RETUR/.test(t)) return 'dikembalikan'
  if (/FAILED PICK|GAGAL PICK|GAGAL JEMPUT/.test(t)) return 'gagal_pickup'
  if (/REJECT|FAILED|GAGAL/.test(t)) return 'gagal_kirim'
  if (/DELIVERED|COMPLETED|TERKIRIM|DITERIMA|SELESAI/.test(t)) return 'terkirim'
  if (/WAITING|MENUNGGU/.test(t)) return 'menunggu_jemput'
  if (/PROCESS|TRANSIT|PICKED|DIKIRIM|ONGOING|SORTING|ARRIVED/.test(t)) return 'dikirim'
  return 'perlu_dicek'
}
function tanggalIso(s) { const d = new Date(String(s).replace(/(\d{2})[/-](\d{2})[/-](\d{4})/, '$3-$2-$1')); return Number.isNaN(d.getTime()) ? null : d.toISOString() }
