// Daftar Pengiriman + Detail. Sumber: tabel `kirim` (dibuat di ATLAS / ditarik dari Everpro / input manual).
import { useEffect, useMemo, useState } from 'react'
import { Search, Printer, RefreshCw, Copy, Columns3, ChevronLeft, ChevronRight, ArrowUpRight, Ban, Files, AlertTriangle, MessageCircle, ExternalLink, Download, Package } from 'lucide-react'
import { useApp } from '../../lib/store.jsx'
import { Button, Input, Select, Sheet, Empty, Textarea, Tabs, cx } from '../ui.jsx'
import { rupiah } from '../../lib/format.js'
import { go } from '../../lib/router.js'
import { kelompokTahap, labelTahap, TAHAP, JENIS_KIRIM, PENANGGUNG, fmtWaktu, zonaCabang, bolehOps, nomorKode, normalHp, IS_DEMO, resiOf, isEverpro, bolehPenting, PENYEDIA, TAHAP_MANUAL } from '../../lib/kirim.js'
import { sinkronKirim, bukaLabelKirim, batalKirim, sinkronSemua } from '../../lib/kirimApi.js'
import { bukuExcel } from '../UnduhData.jsx'
import { drive } from '../../lib/integrations.js'
import { saveBlob } from '../../lib/download.js'
import { BadgeTahap, BadgeSumber, useKirim, Kotak, Catatan, LogoKurir } from './bersama.jsx'

export const EVERPRO_DASHBOARD = 'https://app.everpro.id'
const KOLOM = [
  ['order', 'Order'], ['tanggal', 'Tanggal'], ['status', 'Status'], ['pihak', 'Pengirim / penerima'], ['paket', 'Paket'],
  ['kurir', 'Kurir'], ['resi', 'Resi'], ['biaya', 'Biaya'], ['cashback', 'Cashback'], ['pic', 'Penanggung jawab'],
]
const simpanKolom = (v) => { try { localStorage.setItem('atlas-kirim-kolom', JSON.stringify(v)) } catch { /* abaikan */ } }
const bacaKolom = () => { try { return JSON.parse(localStorage.getItem('atlas-kirim-kolom')) || KOLOM.map((k) => k[0]) } catch { return KOLOM.map((k) => k[0]) } }
const tgl10 = (iso) => (iso ? String(iso).slice(0, 10) : '')
const waktuBaris = (r) => r.dipesan_at || r.dibuat_at || r.created_at

/** Filter bersama Daftar & Laporan. `awal` = filter dari kartu ringkasan (mis. {tahap:[...]}) */
export function saring(rows, f) {
  const q = String(f.q || '').trim().toLowerCase()
  const qhp = q.replace(/\D/g, '')
  return rows.filter((r) => {
    if (f.tab && f.tab !== 'semua' && kelompokTahap(r.tahap) !== f.tab) return false
    if (f.tahap?.length && !f.tahap.includes(r.tahap)) return false
    const t = tgl10(waktuBaris(r))
    if (f.dari && t && t < f.dari) return false
    if (f.sampai && t && t > f.sampai) return false
    if (f.kurir && r.kurir?.kurir !== f.kurir) return false
    if (f.layanan && r.kurir?.layanan !== f.layanan) return false
    if (f.pic && (r.pic || r.dipesan_oleh) !== f.pic) return false
    if (f.label === 'sudah' && !r.label_log?.length) return false
    if (f.label === 'belum' && (r.label_log?.length || !resiOf(r))) return false
    if (f.bayar && (r.ongkir_ditanggung || '') !== f.bayar) return false
    if (f.jenis && r.jenis_kirim !== f.jenis) return false
    if (f.penyedia && (r.penyedia || 'everpro') !== f.penyedia) return false
    if (q) {
      const teks = [r.kode, r.everpro?.client_order_no, r.everpro?.no_everpro, resiOf(r), r.everpro?.awb_retur, r.pelanggan, r.penerima?.nama, r.invoice_no].join(' ').toLowerCase()
      const hpCocok = qhp.length >= 6 && [r.penerima?.telp, r.pengirim?.telp].some((x) => String(x || '').replace(/\D/g, '').includes(qhp.replace(/^0/, '')))
      if (!teks.includes(q) && !hpCocok) return false
    }
    return true
  })
}

export default function Daftar({ awal, onBuat }) {
  const { user, notify, save, ask } = useApp()
  const { kirim, sinkron } = useKirim()
  const [f, setF] = useState(() => ({ tab: 'semua', q: '', ...(awal || {}) }))
  useEffect(() => { if (awal) setF((x) => ({ ...x, ...awal })) }, [awal])
  const [urut, setUrut] = useState('baru')
  const [hal, setHal] = useState(1)
  const [pilih, setPilih] = useState(new Set())
  const [kolom, setKolom] = useState(bacaKolom)
  const [atur, setAtur] = useState(false)
  const [buka, setBuka] = useState(null)
  const [sibuk, setSibuk] = useState('')
  const PER = 25

  const hasil = useMemo(() => {
    const x = saring(kirim, f)
    const k = { baru: (a, b) => String(waktuBaris(b)).localeCompare(String(waktuBaris(a))), lama: (a, b) => String(waktuBaris(a)).localeCompare(String(waktuBaris(b))), mahal: (a, b) => Number(b.biaya?.total || 0) - Number(a.biaya?.total || 0), murah: (a, b) => Number(a.biaya?.total || 0) - Number(b.biaya?.total || 0) }[urut]
    return [...x].sort(k)
  }, [kirim, f, urut])
  const jumlahTab = useMemo(() => { const c = { semua: kirim.length }; for (const r of kirim) { const g = kelompokTahap(r.tahap); c[g] = (c[g] || 0) + 1 } return c }, [kirim])
  const halaman = hasil.slice((hal - 1) * PER, hal * PER)
  const totalHal = Math.max(1, Math.ceil(hasil.length / PER))
  useEffect(() => { setHal(1) }, [f, urut])
  const opsi = (fn) => [...new Set(kirim.map(fn).filter(Boolean))].sort()
  const tampil = (k) => kolom.includes(k)
  const salin = async (t) => { try { await navigator.clipboard.writeText(t); notify('Disalin') } catch { notify('Gagal menyalin', 'err') } }
  const ganti = (id) => setPilih((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const semua = halaman.length > 0 && halaman.every((r) => pilih.has(r.id))

  const sinkronAll = async () => {
    setSibuk('sinkron'); const x = await sinkronSemua(f.dari, f.sampai); setSibuk('')
    if (!x.ok) return notify(x.alasan || 'Gagal menarik data Everpro', 'err')
    notify(x.contoh ? 'Demo: tidak ada data Everpro sungguhan' : `Ditarik dari Everpro: ${x.baru} baru, ${x.ubah} diperbarui`)
  }
  const unduh = async () => {
    const head = ['Kode', 'Order Everpro', 'Resi', 'Tanggal', 'Status', 'Status asli Everpro', 'Cabang', 'Jenis', 'Pelanggan', 'Penerima', 'Kota tujuan', 'Kurir', 'Layanan', 'Biaya estimasi', 'Biaya aktual', 'Cashback estimasi', 'Penanggung jawab', 'Sumber data', 'Diperbarui']
    const rows = hasil.map((r) => [r.kode, r.everpro?.client_order_no || '', resiOf(r) || '', tgl10(waktuBaris(r)), labelTahap(r.tahap), r.status_everpro || '', r.cabang || '', JENIS_KIRIM[r.jenis_kirim] || '', r.pelanggan || '', r.penerima?.nama || '', r.penerima?.lokasi || r.penerima?.kelurahan || '', r.kurir?.kurir || '', r.kurir?.layanan || '', Math.round(r.biaya?.total || 0), Math.round(r.biaya_aktual?.total || 0), Math.round(r.biaya?.cashback_estimasi || 0), r.pic || r.dipesan_oleh || '', r.sumber_status || r.sumber || '', r.diperbarui_at || ''])
    await saveBlob(`Pengiriman ${f.dari || 'awal'} sd ${f.sampai || 'kini'}.xlsx`, await bukuExcel([{ judul: 'Pengiriman', head, rows }]))
  }

  return (
    <div className="space-y-3" data-daftar-pengiriman>
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={f.tab} onChange={(v) => setF((x) => ({ ...x, tab: v, tahap: undefined }))} tabs={[['semua', 'Semua'], ['berlangsung', 'Berlangsung'], ['selesai', 'Selesai'], ['draft', 'Draft']].map(([value, label]) => ({ value, label, count: jumlahTab[value] || 0 }))} />
        <div className="ml-auto flex flex-wrap gap-1.5">
          {bolehOps(user) && <Button size="sm" onClick={() => onBuat?.()}><Package className="h-4 w-4" />Buat pengiriman</Button>}
          {bolehPenting(user) && <Button size="sm" variant="outline" loading={sibuk === 'sinkron'} onClick={sinkronAll} title="Tarik order & status terbaru dari akun Everpro"><RefreshCw className="h-4 w-4" />Tarik dari Everpro</Button>}
          <Button size="sm" variant="outline" onClick={unduh} disabled={!hasil.length}><Download className="h-4 w-4" />Excel</Button>
          <Button size="sm" variant="ghost" onClick={() => setAtur(true)} aria-label="Pilih kolom"><Columns3 className="h-4 w-4" /></Button>
        </div>
      </div>
      {f.tahap?.length > 0 && <p className="text-xs text-ink-soft">Saringan dari ringkasan: <b>{f.tahap.map(labelTahap).join(', ')}</b> <button type="button" className="ml-1 underline" onClick={() => setF((x) => ({ ...x, tahap: undefined }))}>hapus</button></p>}

      <Kotak className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-[11px] font-semibold text-ink-mute sm:col-span-2">Cari order / resi / resi retur / pelanggan / No. HP
          <div className="relative mt-0.5"><Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" /><Input value={f.q} onChange={(e) => setF((x) => ({ ...x, q: e.target.value }))} className="pl-8" placeholder="KRM-… · ATLAS-… · JO… · nama · 0812…" data-cari /></div>
        </label>
        <label className="text-[11px] font-semibold text-ink-mute">Dari<Input type="date" value={f.dari || ''} onChange={(e) => setF((x) => ({ ...x, dari: e.target.value }))} className="mt-0.5" /></label>
        <label className="text-[11px] font-semibold text-ink-mute">Sampai<Input type="date" value={f.sampai || ''} onChange={(e) => setF((x) => ({ ...x, sampai: e.target.value }))} className="mt-0.5" /></label>
        <label className="text-[11px] font-semibold text-ink-mute">Kurir<Select value={f.kurir || ''} onChange={(e) => setF((x) => ({ ...x, kurir: e.target.value, layanan: '' }))} className="mt-0.5"><option value="">Semua</option>{opsi((r) => r.kurir?.kurir).map((k) => <option key={k}>{k}</option>)}</Select></label>
        <label className="text-[11px] font-semibold text-ink-mute">Layanan<Select value={f.layanan || ''} onChange={(e) => setF((x) => ({ ...x, layanan: e.target.value }))} className="mt-0.5"><option value="">Semua</option>{opsi((r) => (!f.kurir || r.kurir?.kurir === f.kurir) && r.kurir?.layanan).map((k) => <option key={k}>{k}</option>)}</Select></label>
        <label className="text-[11px] font-semibold text-ink-mute">Status<Select value={f.tahap?.length === 1 ? f.tahap[0] : ''} onChange={(e) => setF((x) => ({ ...x, tahap: e.target.value ? [e.target.value] : undefined }))} className="mt-0.5"><option value="">Semua</option>{Object.keys(TAHAP).map((k) => <option key={k} value={k}>{labelTahap(k)}</option>)}</Select></label>
        <label className="text-[11px] font-semibold text-ink-mute">Label<Select value={f.label || ''} onChange={(e) => setF((x) => ({ ...x, label: e.target.value }))} className="mt-0.5"><option value="">Semua</option><option value="belum">Punya resi, label belum dibuka</option><option value="sudah">Label sudah dibuka/diunduh</option></Select></label>
        <label className="text-[11px] font-semibold text-ink-mute">Ongkir ditanggung<Select value={f.bayar || ''} onChange={(e) => setF((x) => ({ ...x, bayar: e.target.value }))} className="mt-0.5"><option value="">Semua</option>{Object.entries(PENANGGUNG).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></label>
        <label className="text-[11px] font-semibold text-ink-mute">Pembuat / PIC<Select value={f.pic || ''} onChange={(e) => setF((x) => ({ ...x, pic: e.target.value }))} className="mt-0.5"><option value="">Semua</option>{opsi((r) => r.pic || r.dipesan_oleh).map((k) => <option key={k}>{k}</option>)}</Select></label>
        <label className="text-[11px] font-semibold text-ink-mute">Ekspedisi<Select value={f.penyedia || ''} onChange={(e) => setF((x) => ({ ...x, penyedia: e.target.value }))} className="mt-0.5"><option value="">Semua</option>{Object.entries(PENYEDIA).map(([k, v]) => <option key={k} value={k}>{v.singkat}</option>)}</Select></label>
        <label className="text-[11px] font-semibold text-ink-mute">Urutkan<Select value={urut} onChange={(e) => setUrut(e.target.value)} className="mt-0.5"><option value="baru">Terbaru</option><option value="lama">Terlama</option><option value="mahal">Biaya tertinggi</option><option value="murah">Biaya terendah</option></Select></label>
      </Kotak>

      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-mute">
        <span>{hasil.length} pengiriman · biaya estimasi {rupiah(hasil.filter((r) => r.tahap !== 'dibatalkan').reduce((a, r) => a + Number(r.biaya?.total || 0), 0))}</span>
        {sinkron?.at && <span>· tarik Everpro terakhir {fmtWaktu(sinkron.at)} oleh {sinkron.oleh}</span>}
        <Button size="sm" className="ml-auto" disabled={!pilih.size} loading={sibuk === 'label'} onClick={async () => { setSibuk('label'); await bukaLabelKirim([...pilih], notify); setSibuk('') }} data-aksi="label-massal"><Printer className="h-4 w-4" />Cetak label{pilih.size ? ` (${pilih.size})` : ''}</Button>
      </div>

      {!hasil.length ? <Empty icon={Package} title="Belum ada pengiriman" text={kirim.length ? 'Tidak ada yang cocok dengan saringan.' : 'Buat pengiriman baru, atau tarik data dari Everpro.'} /> : (
        <div className="overflow-x-auto rounded-2xl ring-1 ring-[#E7E8F0] dark:ring-white/10">
          <table className="w-full min-w-[900px] bg-white text-left text-[13px] dark:bg-white/5">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-ink-mute dark:bg-white/5">
              <tr>
                <th className="w-9 p-2"><input type="checkbox" aria-label="Pilih semua di halaman ini" checked={semua} onChange={() => setPilih((s) => { const n = new Set(s); halaman.forEach((r) => (semua ? n.delete(r.id) : n.add(r.id))); return n })} /></th>
                {KOLOM.filter(([k]) => tampil(k)).map(([k, l]) => <th key={k} className="p-2 font-semibold">{l}</th>)}
                <th className="p-2 font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {halaman.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 align-top hover:bg-slate-50/60 dark:border-white/5" data-baris-kirim={r.id}>
                  <td className="p-2"><input type="checkbox" aria-label={`Pilih ${r.kode}`} checked={pilih.has(r.id)} onChange={() => ganti(r.id)} /></td>
                  {tampil('order') && <td className="p-2"><button type="button" className="font-semibold text-brand hover:underline" onClick={() => setBuka(r.id)}>{r.kode || r.everpro?.client_order_no || '-'}</button><div className="text-[11px] text-ink-mute">{r.invoice_no ? `Inv ${r.invoice_no}` : JENIS_KIRIM[r.jenis_kirim]?.split(' (')[0] || ''}</div></td>}
                  {tampil('tanggal') && <td className="whitespace-nowrap p-2 text-[12px]">{fmtWaktu(waktuBaris(r), zonaCabang(r.cabang))}<div className="text-[11px] text-ink-mute">{r.cabang || 'Cabang ?'}</div></td>}
                  {tampil('status') && <td className="p-2"><BadgeTahap tahap={r.tahap} />{r.status_everpro && <div className="mt-0.5 text-[10px] text-ink-mute">Everpro: {r.status_everpro}</div>}</td>}
                  {tampil('pihak') && <td className="p-2"><div className="truncate">{r.pengirim?.nama || '-'}</div><div className="truncate text-ink-soft">→ {r.penerima?.nama || '-'}</div></td>}
                  {tampil('paket') && <td className="p-2 text-[12px]">{r.paket?.isi || '-'}<div className="text-[11px] text-ink-mute">{r.paket?.berat_gram ? `${r.paket.berat_gram} g` : ''}{r.paket?.jumlah > 1 ? ` · ${r.paket.jumlah} koli` : ''}</div></td>}
                  {tampil('kurir') && <td className="p-2 text-[12px]"><div className="flex items-center gap-2">{r.kurir?.kurir && <LogoKurir nama={r.kurir.kurir} logo={r.kurir.logo} />}<div>{r.kurir?.kurir || '-'}<div className="text-[11px] text-ink-mute">{r.kurir?.layanan}{r.kurir?.jenis ? ` · ${r.kurir.jenis === 'DROP' ? 'drop-off' : 'pickup'}` : ''}</div></div></div></td>}
                  {tampil('resi') && <td className="p-2">{resiOf(r) ? <button type="button" className="inline-flex items-center gap-1 font-mono text-[12px] font-bold hover:text-brand" onClick={() => salin(resiOf(r))} title="Salin resi"><Copy className="h-3 w-3" />{resiOf(r)}</button> : <span className="text-[11px] text-ink-mute">belum ada</span>}</td>}
                  {tampil('biaya') && <td className="whitespace-nowrap p-2 text-[12px]">{rupiah(r.biaya_aktual?.total || r.biaya?.total || 0)}<div className="text-[10px] text-ink-mute">{r.biaya_aktual?.total ? 'aktual' : r.biaya?.total ? 'estimasi' : ''}</div></td>}
                  {tampil('cashback') && <td className="whitespace-nowrap p-2 text-[12px]">{r.biaya_aktual?.cashback ? rupiah(r.biaya_aktual.cashback) : r.biaya?.cashback_estimasi ? <span className="text-ink-mute">± {rupiah(r.biaya.cashback_estimasi)} (estimasi)</span> : '-'}</td>}
                  {tampil('pic') && <td className="p-2 text-[12px]">{r.pic || r.dipesan_oleh || '-'}</td>}
                  <td className="p-2"><Button size="sm" variant="outline" onClick={() => setBuka(r.id)}>Detail</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {totalHal > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <Button size="sm" variant="outline" disabled={hal <= 1} onClick={() => setHal((h) => h - 1)} aria-label="Halaman sebelumnya"><ChevronLeft className="h-4 w-4" /></Button>
          <span>Halaman {hal} / {totalHal}</span>
          <Button size="sm" variant="outline" disabled={hal >= totalHal} onClick={() => setHal((h) => h + 1)} aria-label="Halaman berikutnya"><ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}

      {atur && (
        <Sheet open onClose={() => setAtur(false)} title="Pilih kolom">
          <div className="grid gap-2">{KOLOM.map(([k, l]) => <label key={k} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={kolom.includes(k)} onChange={() => { const n = kolom.includes(k) ? kolom.filter((x) => x !== k) : [...kolom, k]; setKolom(n); simpanKolom(n) }} />{l}</label>)}</div>
        </Sheet>
      )}
      {buka && <DetailKirim id={buka} onClose={() => setBuka(null)} />}
    </div>
  )
}

/** Templat pesan pelanggan — hanya pratinjau + tombol buka WhatsApp manual (tidak ada kirim otomatis). */
export const TEMPLAT_PESAN = {
  resi: (r) => `Halo ${r.penerima?.nama || 'Bapak/Ibu'}, dokumen Anda sudah dikirim via ${r.kurir?.kurir || 'kurir'} ${r.kurir?.layanan || ''}. No. resi: ${resiOf(r) || '-'}. Terima kasih — 247 Translator.`,
  telat: (r) => `Halo ${r.penerima?.nama || 'Bapak/Ibu'}, kami mohon maaf pengiriman dokumen (resi ${resiOf(r) || '-'}) mengalami keterlambatan. Kami sedang memantau dengan kurir dan akan mengabari perkembangannya.`,
  gagal: (r) => `Halo ${r.penerima?.nama || 'Bapak/Ibu'}, kurir melaporkan pengiriman dokumen (resi ${resiOf(r) || '-'}) belum berhasil diantar. Mohon konfirmasi alamat/jadwal penerimaan agar dapat kami atur ulang.`,
  terkirim: (r) => `Halo ${r.penerima?.nama || 'Bapak/Ibu'}, menurut data kurir dokumen Anda (resi ${resiOf(r) || '-'}) sudah diterima. Mohon dicek kembali, terima kasih.`,
}

export function DetailKirim({ id, onClose }) {
  const { user, data, notify, save, ask } = useApp()
  const r = (data.kirim || []).find((x) => x.id === id)
  const ev = useMemo(() => (data.kirim_event || []).filter((e) => e.kirim_id === id), [data.kirim_event, id])
  const kendala = (data.kirim_kendala || []).filter((k) => k.kirim_id === id)
  const [sibuk, setSibuk] = useState('')
  const [batal, setBatal] = useState(null)
  const [pesan, setPesan] = useState('resi')
  const [kdl, setKdl] = useState(null)
  const [status, setStatus] = useState(null)
  if (!r) return null
  const lacakManual = async () => {
    const url = PENYEDIA[r.penyedia]?.lacak
    try { await navigator.clipboard.writeText(resiOf(r)); notify('Resi disalin — tempel di halaman lacak') } catch { /* abaikan */ }
    if (url) window.open(url, '_blank', 'noopener'); else notify('Buka situs ekspedisinya lalu tempel resi')
  }
  const simpanStatus = async () => {
    const now = new Date().toISOString()
    try {
      await save('kirim', { id: r.id, tahap: status.tahap, diperbarui_at: now, sumber_status: 'Input manual', ...(status.tahap === 'terkirim' ? { diterima_at: r.diterima_at || now } : {}), ...(status.resi ? { resi: status.resi.trim() } : {}), ...(Number(status.ongkir) > 0 ? { biaya_aktual: { ...(r.biaya_aktual || {}), ongkir: Number(status.ongkir), total: Number(status.ongkir) } } : {}),
        timeline: [{ waktu: now, status: labelTahap(status.tahap).toUpperCase(), keterangan: status.catatan || labelTahap(status.tahap), sumber: `Input manual (${user.name})`, diterima_at: now }, ...(r.timeline || [])].slice(0, 80),
        riwayat: [...(r.riwayat || []), { at: now, by: user.name, aksi: `Status diubah: ${labelTahap(r.tahap)} → ${labelTahap(status.tahap)}${status.catatan ? ` · ${status.catatan}` : ''}` }] })
      if (status.tahap === 'terkirim' && r.project_id && r.jenis_kirim === 'keluar') {
        const p = (data.projects || []).find((x) => x.id === r.project_id)
        if (p) await save('projects', { id: p.id, history: [...(p.history || []), { at: now, by: user.name, action: `Paket diterima pelanggan (${r.kurir?.kurir || 'kurir'} · resi ${resiOf(r)})` }] }).catch(() => null)
      }
      notify('Status diperbarui'); setStatus(null)
    } catch (e) { notify(e.message, 'err') }
  }
  const zona = zonaCabang(r.cabang)
  const ops = bolehOps(user)
  const awb = resiOf(r)
  const timeline = [...(r.timeline || []), ...ev.filter((e) => !(r.timeline || []).some((t) => t.waktu === e.waktu && t.status === e.status))].sort((a, b) => String(b.waktu || '').localeCompare(String(a.waktu || '')))
  const bisaBatal = ['dibuat', 'menunggu_jemput', 'gagal_pickup'].includes(r.tahap)
  const sinkron = async () => { setSibuk('sinkron'); const x = await sinkronKirim(r, save); setSibuk(''); notify(x.ok ? (x.contoh ? 'Demo: status contoh' : 'Status diperbarui dari Everpro') : x.alasan || 'Gagal', x.ok ? undefined : 'err') }
  const duplikat = async () => {
    const baru = { kode: nomorKode(), sumber: 'ATLAS', sumber_status: 'Input manual', tahap: 'draft', cabang: r.cabang, jenis_kirim: r.jenis_kirim === 'lainnya' ? 'ulang' : r.jenis_kirim, project_id: r.project_id || '', invoice_no: r.invoice_no || '', pelanggan: r.pelanggan || '', pic: user.name,
      dokumen: r.dokumen || {}, ongkir_ditanggung: r.ongkir_ditanggung || 'kantor', checklist: {}, pengirim: r.pengirim || {}, penerima: r.penerima || {}, paket: r.paket || {}, kurir: {}, riwayat: [{ at: new Date().toISOString(), by: user.name, aksi: `Draft dari duplikasi ${r.kode || r.everpro?.client_order_no}` }] }
    const s = await save('kirim', baru); notify('Draft baru dibuat'); onClose(); go(`pengiriman/buat/${s.id}`)
  }
  const pesanTeks = TEMPLAT_PESAN[pesan](r)
  const wa = normalHp(r.penerima?.telp)

  return (
    <Sheet open onClose={onClose} side wide title={r.kode || r.everpro?.client_order_no || 'Pengiriman'} subtitle={<span className="inline-flex flex-wrap items-center gap-2"><BadgeTahap tahap={r.tahap} /><BadgeSumber sumber={r.sumber_status || r.sumber} waktu={r.diperbarui_at} /></span>}>
      <div className="space-y-4 text-sm" data-detail-kirim>
        <div className="flex flex-wrap gap-1.5">
          {r.tahap === 'draft' || r.tahap === 'siap' || r.tahap === 'gagal_order' ? ops && <Button size="sm" onClick={() => { onClose(); go(`pengiriman/buat/${r.id}`) }}>Lanjutkan draft</Button> : null}
          {!isEverpro(r) && ops && !['draft', 'siap'].includes(r.tahap) && <Button size="sm" onClick={() => setStatus({ tahap: r.tahap, catatan: '' })} data-aksi="ubah-status"><RefreshCw className="h-4 w-4" />Perbarui status</Button>}
          {!isEverpro(r) && resiOf(r) && <Button size="sm" variant="outline" onClick={lacakManual}><ExternalLink className="h-4 w-4" />Lacak di {PENYEDIA[r.penyedia]?.singkat || 'situs kurir'}</Button>}
          {r.everpro?.client_order_no && <Button size="sm" variant="outline" loading={sibuk === 'sinkron'} onClick={sinkron}><RefreshCw className="h-4 w-4" />Lacak / perbarui</Button>}
          {awb && ops && isEverpro(r) && <Button size="sm" variant="outline" loading={sibuk === 'label'} onClick={async () => { setSibuk('label'); await bukaLabelKirim([r.id], notify); setSibuk('') }}><Printer className="h-4 w-4" />Label</Button>}
          {ops && <Button size="sm" variant="outline" onClick={duplikat}><Files className="h-4 w-4" />Duplikasi jadi draft</Button>}
          {ops && <Button size="sm" variant="outline" onClick={() => setKdl({ kirim_id: r.id, cabang: r.cabang, jenis: 'kendala', status: 'terbuka', judul: '', pic: user.name, catatan: '' })}><AlertTriangle className="h-4 w-4" />Catat kendala</Button>}
          {bisaBatal && bolehPenting(user) && isEverpro(r) && <Button size="sm" variant="outline" onClick={() => setBatal('')}><Ban className="h-4 w-4" />Ajukan pembatalan</Button>}
          {isEverpro(r) && <a href={EVERPRO_DASHBOARD} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-[13px] font-semibold text-ink-soft ring-1 ring-slate-200 hover:ring-brand"><ExternalLink className="h-4 w-4" />Buka Everpro</a>}
          {r.project_id && <Button size="sm" variant="ghost" onClick={() => { onClose(); go(`projects/${r.project_id}`) }}><ArrowUpRight className="h-4 w-4" />Project {r.invoice_no}</Button>}
        </div>
        {r.tahap === 'batal_diajukan' && <p className="rounded-xl bg-amber-50 p-2 text-[12px] text-amber-900 ring-1 ring-amber-200">Pembatalan sudah diajukan ({r.batal?.alasan}). Belum dianggap batal sampai Everpro mengonfirmasi.</p>}
        {r.tahap === 'perlu_dicek' && <p className="rounded-xl bg-amber-50 p-2 text-[12px] text-amber-900 ring-1 ring-amber-200">Status asli Everpro &quot;{r.status_everpro}&quot; belum dikenali ATLAS — periksa di dashboard Everpro.</p>}

        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
          {[['Kode internal', r.kode], ['Ekspedisi', PENYEDIA[r.penyedia || 'everpro']?.singkat], ['Order Everpro', r.everpro?.client_order_no], ['No. Everpro', r.everpro?.no_everpro], ['Resi', awb], ['Resi retur', r.everpro?.awb_retur], ['Cabang', r.cabang], ['Jenis', JENIS_KIRIM[r.jenis_kirim]], ['Pelanggan', r.pelanggan], ['Invoice', r.invoice_no], ['Penanggung jawab', r.pic || r.dipesan_oleh], ['Ongkir', PENANGGUNG[r.ongkir_ditanggung]], ['Dipesan', r.dipesan_at ? fmtWaktu(r.dipesan_at, zona) : ''], ['Jadwal jemput', r.kurir?.pickup_time ? fmtWaktu(r.kurir.pickup_time, zona) : r.kurir?.jenis === 'DROP' ? 'Antar sendiri ke agen' : ''], ['Dokumen', [r.dokumen?.jenis, r.dokumen?.jumlah ? `${r.dokumen.jumlah} berkas` : ''].filter(Boolean).join(' · ')]].filter(([, v]) => v).map(([k, v]) => <div key={k}><dt className="text-[11px] text-ink-mute">{k}</dt><dd className="break-words font-semibold">{v}</dd></div>)}
        </dl>

        <div className="grid gap-3 sm:grid-cols-2">
          {[['Pengirim', r.pengirim], ['Penerima', r.penerima]].map(([j, a]) => (
            <Kotak key={j}><p className="text-[11px] font-semibold text-ink-mute">{j}</p><p className="font-semibold">{a?.nama || '-'}</p><p className="text-[12px] text-ink-soft">{a?.telp}</p><p className="text-[12px]">{a?.alamat}{a?.kelurahan ? `, ${a.kelurahan}` : ''}{a?.kodepos ? ` ${a.kodepos}` : ''}</p>{a?.catatan && <p className="text-[11px] text-ink-mute">Catatan: {a.catatan}</p>}</Kotak>
          ))}
        </div>

        <Kotak>
          <p className="mb-1 text-[11px] font-semibold text-ink-mute">Paket & biaya</p>
          {r.kurir?.kurir && <p className="mb-1 flex items-center gap-2 text-[13px] font-semibold"><LogoKurir nama={r.kurir.kurir} logo={r.kurir.logo} ukuran={32} />{r.kurir.kurir} {r.kurir.layanan}{r.kurir.jenis ? <span className="font-normal text-ink-mute">· {r.kurir.jenis === 'DROP' ? 'drop-off' : 'pickup'}</span> : null}</p>}
          <p className="text-[12px]">{r.paket?.isi || '-'} · {r.paket?.jumlah || 1} koli · {r.paket?.berat_gram || '-'} g{r.paket?.p ? ` · ${r.paket.p}×${r.paket.l}×${r.paket.t} cm` : ''}{r.paket?.nilai ? ` · nilai ${rupiah(r.paket.nilai)}` : ''}{r.paket?.asuransi ? ' · asuransi' : ''}{r.paket?.cod ? ` · COD ${rupiah(r.paket.cod_nilai)}` : ''}</p>
          <table className="mt-2 w-full text-[12px]"><tbody>
            {[['Ongkir', r.biaya?.ongkir, r.biaya_aktual?.ongkir], ['Asuransi', r.biaya?.asuransi, r.biaya_aktual?.asuransi], ['Biaya tambahan', r.biaya?.biaya_tambahan, null], ['Diskon', null, r.biaya_aktual?.diskon], ['Biaya COD', null, r.biaya_aktual?.biaya_cod], ['Total dibayar', r.biaya?.total, r.biaya_aktual?.total]].map(([k, a, b]) => (a || b) ? <tr key={k}><td className="py-0.5 text-ink-soft">{k}</td><td className="text-right">{a != null ? rupiah(a) : '-'}</td><td className="text-right font-semibold">{b != null ? rupiah(b) : '-'}</td></tr> : null)}
            <tr><td /><td className="text-right text-[10px] text-ink-mute">saat dipesan{r.biaya?.tarif_at ? ` (${fmtWaktu(r.biaya.tarif_at, zona)})` : ''}</td><td className="text-right text-[10px] text-ink-mute">aktual Everpro</td></tr>
          </tbody></table>
          <p className="mt-1 text-[11px] text-ink-mute">Cashback dicatat terpisah (tidak mengurangi biaya): estimasi {rupiah(r.biaya?.cashback_estimasi || 0)}{r.biaya_aktual?.cashback ? ` · tercatat Everpro ${rupiah(r.biaya_aktual.cashback)}` : ''}.</p>
        </Kotak>

        <div>
          <p className="mb-1 text-[11px] font-semibold text-ink-mute">Timeline lacak {r.lacak_url && <a className="ml-1 underline" href={r.lacak_url} target="_blank" rel="noopener noreferrer">halaman lacak kurir</a>}</p>
          {!timeline.length ? <p className="text-[12px] text-ink-mute">Belum ada peristiwa lacak.</p> : (
            <ol className="space-y-2 border-l-2 border-slate-200 pl-3" data-timeline>
              {timeline.map((e, i) => <li key={i} className="text-[12px]"><b>{e.status}</b> — {e.keterangan}<div className="text-[11px] text-ink-mute">{e.waktu ? `Kejadian: ${fmtWaktu(e.waktu, zona)}` : ''}{e.diterima_at ? ` · diterima ATLAS ${fmtWaktu(e.diterima_at, zona)}` : ''} · {e.sumber}</div>{e.foto?.length > 0 && <div className="mt-1 flex gap-1">{e.foto.map((u) => <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="text-[11px] underline">foto</a>)}</div>}</li>)}
            </ol>
          )}
          <Catatan>Bukti antar/penerima aktual hanya tampil bila Everpro mengirimkannya (foto pada riwayat lacak).</Catatan>
        </div>

        {r.struk && <Button size="sm" variant="outline" onClick={async () => { try { const u = drive.url ? await drive.url(r.struk) : r.struk.url; if (u) window.open(u, '_blank', 'noopener') } catch (e) { notify(e.message, 'err') } }}>Lihat foto struk</Button>}
        {kendala.length > 0 && <Kotak><p className="mb-1 text-[11px] font-semibold text-ink-mute">Kendala / retur / klaim</p>{kendala.map((k) => <p key={k.id} className="text-[12px]"><b>{k.judul || k.jenis}</b> · {k.status} · PIC {k.pic || '-'}</p>)}</Kotak>}

        {r.penerima?.telp && (
          <Kotak>
            <p className="mb-1 text-[11px] font-semibold text-ink-mute">Pesan ke pelanggan (pratinjau — dikirim manual oleh staf)</p>
            <Select value={pesan} onChange={(e) => setPesan(e.target.value)} className="mb-2"><option value="resi">Info resi</option><option value="telat">Keterlambatan</option><option value="gagal">Gagal kirim</option><option value="terkirim">Terkirim</option></Select>
            <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-[12px]">{pesanTeks}</p>
            {wa.ok ? <a className="mt-2 inline-flex h-9 items-center gap-1 rounded-lg bg-emerald-600 px-3 text-[13px] font-semibold text-white" href={`https://wa.me/${wa.nomor}?text=${encodeURIComponent(pesanTeks)}`} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-4 w-4" />Buka WhatsApp</a> : <p className="mt-1 text-[11px] text-rose-700">No. HP penerima tidak valid untuk WhatsApp.</p>}
          </Kotak>
        )}

        <div>
          <p className="mb-1 text-[11px] font-semibold text-ink-mute">Riwayat aktivitas</p>
          <ul className="space-y-1">{[...(r.riwayat || [])].reverse().map((h, i) => <li key={i} className="text-[12px]"><span className="text-ink-mute">{fmtWaktu(h.at, zona)} · {h.by}</span> — {h.aksi}</li>)}</ul>
          {r.label_log?.length > 0 && <p className="mt-1 text-[11px] text-ink-mute">Label dibuka/diunduh {r.label_log.length}× (terakhir {fmtWaktu(r.label_log.at(-1).at, zona)} oleh {r.label_log.at(-1).by}). Diunduh belum tentu tercetak.</p>}
        </div>
      </div>

      {batal !== null && (
        <Sheet open onClose={() => setBatal(null)} title="Ajukan pembatalan" subtitle="Pembatalan baru dianggap berhasil setelah dikonfirmasi Everpro">
          <Textarea value={batal} onChange={(e) => setBatal(e.target.value)} placeholder="Alasan pembatalan (wajib)" />
          <Button className="mt-2" disabled={batal.trim().length < 5} loading={sibuk === 'batal'} onClick={async () => { if (!(await ask('Ajukan pembatalan ke Everpro?'))) return; setSibuk('batal'); const x = await batalKirim(r, batal.trim(), save); setSibuk(''); if (!x.ok) return notify(x.alasan || 'Gagal', 'err'); notify('Pembatalan diajukan'); setBatal(null) }}>Ajukan</Button>
        </Sheet>
      )}
      {kdl && <FormKendala awal={kdl} onClose={() => setKdl(null)} />}
      {status && (
        <Sheet open onClose={() => setStatus(null)} title="Perbarui status pengiriman" subtitle={`${r.kurir?.kurir || ''} · resi ${resiOf(r)} · tercatat atas nama ${user.name}`}>
          <div className="grid gap-2 text-sm" data-form-status>
            <label className="text-[11px] font-semibold text-ink-mute">Status baru<Select value={status.tahap} onChange={(e) => setStatus({ ...status, tahap: e.target.value })}>{TAHAP_MANUAL.map((t) => <option key={t} value={t}>{labelTahap(t)}</option>)}</Select></label>
            <label className="text-[11px] font-semibold text-ink-mute">Keterangan (opsional)<Input value={status.catatan} onChange={(e) => setStatus({ ...status, catatan: e.target.value })} placeholder="mis. diterima oleh resepsionis" /></label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] font-semibold text-ink-mute">Koreksi resi<Input value={status.resi ?? ''} onChange={(e) => setStatus({ ...status, resi: e.target.value })} placeholder={resiOf(r)} /></label>
              <label className="text-[11px] font-semibold text-ink-mute">Koreksi ongkir (Rp)<Input type="number" min="0" value={status.ongkir ?? ''} onChange={(e) => setStatus({ ...status, ongkir: e.target.value })} placeholder={String(r.biaya_aktual?.total || '')} /></label>
            </div>
            <Button onClick={simpanStatus} data-aksi="simpan-status">Simpan status</Button>
          </div>
        </Sheet>
      )}
    </Sheet>
  )
}

export function FormKendala({ awal, onClose }) {
  const { user, save, notify } = useApp()
  const [k, setK] = useState(awal)
  const [sibuk, setSibuk] = useState(false)
  const ubah = (p) => setK((x) => ({ ...x, ...p }))
  const simpan = async () => {
    if (!k.judul?.trim()) return notify('Isi judul kendala', 'err')
    setSibuk(true)
    try {
      const now = new Date().toISOString()
      await save('kirim_kendala', { ...k, riwayat: [...(k.riwayat || []), { at: now, by: user.name, aksi: k.id ? `Diubah · status ${k.status}` : 'Dicatat' }] })
      notify('Kendala tersimpan'); onClose()
    } catch (e) { notify(e.message, 'err') } finally { setSibuk(false) }
  }
  return (
    <Sheet open onClose={onClose} title={k.id ? 'Ubah kendala' : 'Catat kendala / retur / klaim'}>
      <div className="grid gap-2 text-sm">
        <label className="text-[11px] font-semibold text-ink-mute">Jenis<Select value={k.jenis} onChange={(e) => ubah({ jenis: e.target.value })}><option value="kendala">Kendala umum</option><option value="gagal_kirim">Gagal kirim</option><option value="retur">Retur</option><option value="klaim">Klaim (hilang/rusak)</option><option value="selisih">Selisih tagihan</option></Select></label>
        <label className="text-[11px] font-semibold text-ink-mute">Judul<Input value={k.judul || ''} onChange={(e) => ubah({ judul: e.target.value })} /></label>
        <label className="text-[11px] font-semibold text-ink-mute">Status<Select value={k.status} onChange={(e) => ubah({ status: e.target.value })}><option value="terbuka">Terbuka</option><option value="proses">Sedang ditangani</option><option value="menunggu_kurir">Menunggu kurir/Everpro</option><option value="selesai">Selesai</option><option value="ditolak">Ditolak</option></Select></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[11px] font-semibold text-ink-mute">PIC tindak lanjut<Input value={k.pic || ''} onChange={(e) => ubah({ pic: e.target.value })} /></label>
          <label className="text-[11px] font-semibold text-ink-mute">Tenggat<Input type="date" value={String(k.tenggat || '').slice(0, 10)} onChange={(e) => ubah({ tenggat: e.target.value })} /></label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[11px] font-semibold text-ink-mute">No. tiket Everpro/kurir<Input value={k.tiket || ''} onChange={(e) => ubah({ tiket: e.target.value })} /></label>
          <label className="text-[11px] font-semibold text-ink-mute">Resi retur<Input value={k.awb_retur || ''} onChange={(e) => ubah({ awb_retur: e.target.value })} /></label>
        </div>
        {k.jenis === 'klaim' && <label className="text-[11px] font-semibold text-ink-mute">Nilai klaim diajukan (Rp)<Input type="number" min="0" value={k.nilai_klaim || ''} onChange={(e) => ubah({ nilai_klaim: Number(e.target.value) })} /></label>}
        {['selesai', 'ditolak'].includes(k.status) && <label className="text-[11px] font-semibold text-ink-mute">Hasil penyelesaian<Input value={k.hasil || ''} onChange={(e) => ubah({ hasil: e.target.value })} placeholder="mis. diganti Rp…, dikirim ulang, ditolak karena…" /></label>}
        <label className="text-[11px] font-semibold text-ink-mute">Catatan<Textarea value={k.catatan || ''} onChange={(e) => ubah({ catatan: e.target.value })} /></label>
        <Catatan>Pengajuan klaim resmi tetap lewat dashboard Everpro — di sini catatan internal & referensi tiketnya. Lampiran bukti simpan di folder project terkait.</Catatan>
        <Button loading={sibuk} onClick={simpan}>Simpan</Button>
      </div>
    </Sheet>
  )
}
