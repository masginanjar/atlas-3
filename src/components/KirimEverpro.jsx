import { useEffect, useMemo, useState } from 'react'
import { Truck, Loader2, Search, PackageCheck, MapPin, Copy, MessageCircle, RefreshCw, X, Clock, Printer } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { MODE, db } from '../lib/db.js'
import { SUPABASE_URL } from '../lib/supabase.js'
import { rupiah } from '../lib/format.js'
import { Button, Input, Sheet, cx } from './ui.jsx'

// ============================================================
//  KIRIM VIA EVERPRO — di tahap Siap Kirim (metode "Dikirim Kurir").
//  Cek ongkir dari cabang lokasi Print ke alamat pelanggan → pilih layanan →
//  jadwal jemput (atau antar sendiri ke agen) → Pesan Kurir → resi otomatis →
//  kirim resi ke pelanggan (WhatsApp) → status ikut berubah dari Everpro;
//  "Diterima pelanggan" membuat tahap kirim Selesai sendiri.
// ============================================================

export const STATUS_KIRIM = {
  MENUNGGU_RESI: ['Menunggu resi', 'bg-amber-50 text-amber-800 ring-amber-200'],
  WAITING: ['Menunggu dijemput', 'bg-sky-50 text-sky-700 ring-sky-200'],
  'FAILED PICKUP': ['Gagal dijemput', 'bg-rose-50 text-rose-700 ring-rose-200'],
  PICKEDUP: ['Sudah dijemput kurir', 'bg-indigo-50 text-indigo-700 ring-indigo-200'],
  DELIVERED: ['Diterima pelanggan', 'bg-emerald-50 text-emerald-700 ring-emerald-200'],
  'IN TROUBLE': ['Bermasalah', 'bg-rose-50 text-rose-700 ring-rose-200'],
  'IN PROCESS RETURN': ['Proses retur', 'bg-amber-50 text-amber-800 ring-amber-200'],
  RETURN: ['Diretur', 'bg-rose-50 text-rose-700 ring-rose-200'],
  REJECTED: ['Ditolak', 'bg-rose-50 text-rose-700 ring-rose-200'],
  CANCELED: ['Dibatalkan', 'bg-slate-100 text-slate-600 ring-slate-200'],
  'LOST/BROKEN': ['Hilang / rusak', 'bg-rose-50 text-rose-700 ring-rose-200'],
  'FORCE MAJEURE': ['Force majeure', 'bg-amber-50 text-amber-800 ring-amber-200'],
}
const BOLEH_BATAL = ['MENUNGGU_RESI', 'WAITING', 'FAILED PICKUP']

/** Demo: contoh daftar kiriman (data rekaan, bukan pelanggan nyata). */
const DAFTAR_DEMO = [
  { client_order_no: 'ATLAS-DEMO0001-A1B2', no_everpro: 'EVP-DEMO-1', awb: 'JO0000000001', status: 'WAITING FOR PICKUP', status_id: 300, jenis: 'PICKUP', kurir: 'J&T Express Regular', harga: 14000, dibuat: '2026-11-14 09:12', jemput: '2026-11-14', penerima: 'Contoh Penerima A', tujuan: 'Kuningan Timur,Setia Budi,Jakarta Selatan,DKI Jakarta', pengirim: '247 Translator Bali', isi: 'Dokumen terjemahan', berat: 0.2, project: null },
  { client_order_no: 'ATLAS-DEMO0002-C3D4', no_everpro: 'EVP-DEMO-2', awb: 'CGK0000000002', status: 'ON PROCESS', status_id: 400, jenis: 'DROP', kurir: 'JNE Reguler', harga: 22000, dibuat: '2026-11-13 15:40', jemput: '', penerima: 'Contoh Penerima B', tujuan: 'Pleburan,Semarang Selatan,Semarang, Kota,Jawa Tengah', pengirim: '247 Translator Bali', isi: 'Dokumen terjemahan', berat: 0.3, project: null },
  { client_order_no: 'ATLAS-DEMO0003-E5F6', no_everpro: 'EVP-DEMO-3', awb: 'SAP0000000003', status: 'DELIVERED', status_id: 600, jenis: 'PICKUP', kurir: 'SAP Express Regular', harga: 18000, dibuat: '2026-11-11 11:05', jemput: '2026-11-11', penerima: 'Contoh Penerima C', tujuan: 'Babura,Medan Petisah,Medan,Sumatera Utara', pengirim: '247 Translator Bali', isi: 'Dokumen terjemahan', berat: 0.2, project: null },
]

/** Buka PDF label resi. Jendela dibuka dulu (sebelum menunggu server) supaya tidak diblokir browser. */
export async function bukaLabel(body, notify) {
  const w = typeof window !== 'undefined' ? window.open('', '_blank') : null
  const x = await panggil('label', body)
  if (!x.ok || !x.url) { try { w?.close() } catch { /* abaikan */ } return notify(x.alasan || 'Label belum tersedia', 'err') }
  if (w) w.location.href = x.url; else window.location.href = x.url
  if (x.errors?.length) notify(`${x.errors.length} resi tidak bisa dicetak`, 'err')
}

/** Demo: tarif contoh dari tes nyata Seminyak → Kuningan 200 g (11 Nov 2026). */
const TARIF_DEMO = [
  { kurir: 'Lion Parcel', layanan: 'JAGOPACK', rate_code: 'JAGOPACK', harga: 14000, lama: '2-5 DAY' },
  { kurir: 'JNE', layanan: 'Reguler', rate_code: 'REG23', harga: 22000, lama: '2-3 DAY' },
  { kurir: 'JNE', layanan: 'YES', rate_code: 'YES23', harga: 50000, lama: '1-1 DAY' },
]

export async function panggil(aksi, body) {
  if (MODE === 'demo') {
    await new Promise((r) => setTimeout(r, 500))
    if (aksi === 'ongkir') return { ok: true, asal: 'Bali', tarif: TARIF_DEMO }
    if (aksi === 'jemput') { const t = Math.floor(Date.now() / 1000) + 3600; return { ok: true, slot: [{ mulai: t, label: 'Hari ini · 16.00 - 22.00 (contoh)' }, { mulai: t + 86400, label: 'Besok · 09.00 - 15.00 (contoh)' }] } }
    if (aksi === 'lacak' || aksi === 'lacak_awb') return { ok: true, lacak: { riwayat_contoh: [{ waktu: '14 Nov 2026 10.12', status: 'Paket dijemput kurir' }, { waktu: '14 Nov 2026 08.30', status: 'Pesanan dibuat' }] } }
    if (aksi === 'daftar') return { ok: true, data: DAFTAR_DEMO, pagination: { page: 1, total_page: 1, total_data: DAFTAR_DEMO.length } }
    if (aksi === 'asal') return { ok: true, alamat: [{ nama: '247 Translator (contoh)', alamat: 'Gedung Contoh Lt. 15', catatan: '', lokasi: 'Kuningan Timur,Setia Budi,Jakarta Selatan,DKI Jakarta', kodepos: '12950', telp: '6280000000000', jumlah: 3 }] }
    if (aksi === 'label') return { ok: false, alasan: 'Di demo, label resi hanya contoh — cetak label tersedia di ATLAS live.' }
    return { ok: false, alasan: 'Di demo, pesan kurir hanya simulasi — coba di ATLAS live.' }
  }
  const token = await db.token?.()
  const r = await fetch(`${SUPABASE_URL}/functions/v1/everpro`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ aksi, ...body }) })
  const x = await r.json().catch(() => ({ ok: false, alasan: `Server ${r.status}` }))
  return x
}

const waNomor = (s) => { let d = String(s || '').replace(/\D/g, ''); if (d.startsWith('0')) d = '62' + d.slice(1); else if (d.startsWith('8')) d = '62' + d; return d }

export default function KirimEverpro({ project }) {
  const { notify, refreshTables, save, ask } = useApp()
  const ev = project.about?.everpro || null
  const aktif = ev && ev.status !== 'CANCELED'
  const [buka, setBuka] = useState(false)
  const [lacak, setLacak] = useState(null)
  const [sibuk, setSibuk] = useState('')
  const segarkan = () => refreshTables?.(['projects'])

  const cekResi = async () => {
    setSibuk('resi'); const x = await panggil('resi', { project_id: project.id }); setSibuk('')
    if (!x.ok) return notify(x.alasan || 'Gagal cek resi', 'err')
    if (x.resi) { notify(`Resi terbit: ${x.resi}`); segarkan() } else notify('Resi belum terbit — biasanya beberapa menit. ATLAS juga mengisinya otomatis.')
  }
  const bukaLacak = async () => {
    setSibuk('lacak'); const x = await panggil('lacak', { project_id: project.id }); setSibuk('')
    if (!x.ok) return notify(x.alasan || 'Gagal melacak', 'err'); setLacak(x.lacak || {})
  }
  const batal = async () => {
    if (!(await ask('Batalkan pesanan kurir ini? Hanya bisa sebelum paket dijemput kurir.'))) return
    setSibuk('batal'); const x = await panggil('batal', { project_id: project.id, alasan: 'Dibatalkan dari ATLAS' }); setSibuk('')
    if (!x.ok) return notify(x.alasan || 'Gagal membatalkan', 'err'); notify('Pesanan kurir dibatalkan'); segarkan()
  }
  const ship = project.customer?.ship || {}
  const teksWa = ev?.awb ? `Halo ${ship.attention || project.customer?.name || ''}, dokumen Anda (invoice ${project.invoice_no}) sudah kami kirim via ${ev.kurir} ${ev.layanan}.\nNo. resi: ${ev.awb}\nTerima kasih — 247 Sworn Translator` : ''
  const waUrl = ev?.awb && waNomor(ship.phone || project.customer?.phone) ? `https://wa.me/${waNomor(ship.phone || project.customer?.phone)}?text=${encodeURIComponent(teksWa)}` : null
  const tandaiWa = async () => { try { await save('projects', { ...project, about: { ...project.about, everpro: { ...ev, wa_terkirim_at: new Date().toISOString() } } }) } catch { /* abaikan */ } }

  if (!aktif) return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-sky-50 p-2.5 ring-1 ring-sky-200" data-everpro>
      <Truck className="h-4 w-4 text-sky-700" aria-hidden="true" />
      <span className="mr-auto text-xs font-semibold text-sky-900">Kirim lewat Everpro: cek ongkir, pesan kurir, resi otomatis{ev?.status === 'CANCELED' ? ' · pesanan sebelumnya dibatalkan' : ''}</span>
      <Button size="sm" onClick={() => setBuka(true)} data-aksi="buka-everpro"><Truck className="h-4 w-4" />Pesan Kurir</Button>
      {buka && <PesanKurir project={project} onClose={() => setBuka(false)} onDone={() => { setBuka(false); segarkan() }} />}
    </div>
  )
  const [lbl, cls] = STATUS_KIRIM[ev.status] || [ev.status, 'bg-slate-100 text-slate-600 ring-slate-200']
  return (
    <div className="mt-2 space-y-2 rounded-xl bg-white p-2.5 ring-1 ring-slate-200" data-everpro data-status-kirim={ev.status}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Truck className="h-4 w-4 text-ink-soft" aria-hidden="true" />
        <b className="text-ink">{ev.kurir} {ev.layanan}</b>
        <span className="text-ink-mute">{rupiah(ev.harga || 0)} · {ev.jenis === 'DROP' ? 'antar ke agen' : 'dijemput'}</span>
        <span className={cx('rounded-full px-2 py-0.5 font-semibold ring-1', cls)}>{lbl}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {ev.awb ? (
          <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(ev.awb); notify('Resi disalin') } catch { notify('Gagal menyalin', 'err') } }}
            className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 font-mono text-[13px] font-bold ring-1 ring-slate-200 hover:ring-brand sm:h-8" title="Salin resi"><Copy className="h-3.5 w-3.5" />{ev.awb}</button>
        ) : <Button size="sm" variant="outline" loading={sibuk === 'resi'} onClick={cekResi}><RefreshCw className="h-4 w-4" />Cek resi</Button>}
        {waUrl && <a href={waUrl} target="_blank" rel="noreferrer" onClick={tandaiWa} className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 text-xs font-semibold text-white hover:bg-emerald-700 sm:h-8" data-aksi="wa-resi"><MessageCircle className="h-4 w-4" />{ev.wa_terkirim_at ? 'Kirim ulang resi (WA)' : 'Kirim resi ke pelanggan'}</a>}
        {ev.awb && <Button size="sm" variant="outline" loading={sibuk === 'label'} onClick={async () => { setSibuk('label'); await bukaLabel({ project_id: project.id }, notify); setSibuk('') }} data-aksi="cetak-label"><Printer className="h-4 w-4" />Cetak label</Button>}
        <Button size="sm" variant="outline" loading={sibuk === 'lacak'} onClick={bukaLacak}><MapPin className="h-4 w-4" />Lacak</Button>
        {BOLEH_BATAL.includes(ev.status) && <Button size="sm" variant="ghost" loading={sibuk === 'batal'} onClick={batal} className="text-rose-600"><X className="h-4 w-4" />Batalkan</Button>}
      </div>
      <p className="text-[11px] text-ink-mute">Status berubah sendiri dari Everpro. Saat paket diterima pelanggan, tahap ini otomatis Selesai.</p>
      {lacak && (
        <Sheet open onClose={() => setLacak(null)} title={`Lacak ${ev.awb || ev.client_order_no}`}>
          <Riwayat data={lacak} />
        </Sheet>
      )}
    </div>
  )
}

/** Tampilkan riwayat lacak apa adanya (bentuk data Everpro bisa berbeda per kurir). */
export function Riwayat({ data }) {
  const daftar = useMemo(() => {
    const cari = (v, d = 0) => (Array.isArray(v) ? v : v && typeof v === 'object' && d < 3 ? Object.values(v).map((x) => cari(x, d + 1)).find((a) => a.length) || [] : [])
    return cari(data)
  }, [data])
  if (!daftar.length) return <p className="text-sm text-ink-mute">Belum ada riwayat perjalanan paket.</p>
  const teks = (o) => Object.entries(o || {}).filter(([k, v]) => v && typeof v !== 'object' && !/phone|email|address|alamat|telp/i.test(k))
  return (
    <ol className="space-y-2" data-riwayat-lacak>
      {daftar.slice(0, 30).map((r, i) => {
        const e = teks(r); const waktu = e.find(([k]) => /date|time|waktu/i.test(k))?.[1]; const isi = e.filter(([k]) => !/date|time|waktu/i.test(k)).map(([, v]) => v).join(' · ')
        return <li key={i} className="flex gap-2 text-sm"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-ink-mute" aria-hidden="true" /><span className="min-w-0"><span className="block text-[11px] text-ink-mute">{String(waktu || '')}</span>{isi}</span></li>
      })}
    </ol>
  )
}

function PesanKurir({ project, onClose, onDone }) {
  const { notify, ask } = useApp()
  const [berat, setBerat] = useState(project.about?.everpro?.berat_gram || 200)
  const [tarif, setTarif] = useState(null)
  const [pilih, setPilih] = useState(null)
  const [jenis, setJenis] = useState('PICKUP')
  const [slot, setSlot] = useState(null)
  const [jam, setJam] = useState(0)
  const [sibuk, setSibuk] = useState('')
  const [info, setInfo] = useState('')
  const ship = project.customer?.ship || {}

  const cek = async () => {
    setSibuk('ongkir'); setTarif(null); setPilih(null); setInfo('')
    const x = await panggil('ongkir', { project_id: project.id, berat_gram: Number(berat) || 200 }); setSibuk('')
    if (!x.ok) { setInfo(x.alasan || 'Cek ongkir gagal'); return }
    setTarif(x.tarif || []); if (x.asal) setInfo(`Dari cabang ${x.asal}${x.asal_kodepos ? ` (${x.asal_kodepos})` : ''} ke ${x.tujuan_kodepos || ship.zip || ''}`)
  }
  useEffect(() => { cek() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!pilih || jenis !== 'PICKUP') return
    setSlot(null); setJam(0)
    panggil('jemput', { project_id: project.id, rate_code: pilih.rate_code }).then((x) => { setSlot(x.ok ? x.slot || [] : []); if (x.ok && x.slot?.[0]) setJam(x.slot[0].mulai) })
  }, [pilih, jenis]) // eslint-disable-line react-hooks/exhaustive-deps

  const pesan = async () => {
    if (!pilih) return
    if (!(await ask(`Pesan ${pilih.kurir} ${pilih.layanan} seharga ${rupiah(pilih.harga)}? Ini pesanan SUNGGUHAN ke Everpro${jenis === 'PICKUP' ? ' — kurir akan datang menjemput' : ''}.`))) return
    setSibuk('pesan')
    const x = await panggil('pesan', { project_id: project.id, rate_code: pilih.rate_code, harga: pilih.harga, kurir: pilih.kurir, layanan: pilih.layanan, jenis, pickup_time: jenis === 'PICKUP' ? jam : undefined, berat_gram: Number(berat) || 200 })
    setSibuk('')
    if (!x.ok) return notify(x.alasan || 'Pesan kurir gagal', 'err')
    notify(x.resi ? `Kurir dipesan · resi ${x.resi}` : 'Kurir dipesan · resi menyusul otomatis'); onDone()
  }

  return (
    <Sheet open onClose={onClose} title="Pesan Kurir · Everpro" subtitle={`${project.invoice_no} · ke ${ship.attention || project.customer?.name || ''}`}
      footer={<span className="flex w-full items-center gap-2"><span className="mr-auto text-xs text-ink-mute">{pilih ? <>Ongkir <b className="text-ink">{rupiah(pilih.harga)}</b></> : 'Pilih layanan'}</span><Button variant="outline" onClick={onClose}>Batal</Button><Button loading={sibuk === 'pesan'} disabled={!pilih || (jenis === 'PICKUP' && !jam)} onClick={pesan} data-aksi="pesan-kurir"><PackageCheck className="h-4 w-4" />Pesan Kurir</Button></span>}>
      <div className="space-y-3" data-pesan-kurir>
        <div className="rounded-xl bg-slate-50 p-2.5 text-xs text-ink-soft ring-1 ring-slate-200">
          <b className="block text-ink">{ship.attention || project.customer?.name || '— nama penerima —'} · {ship.phone || '— No. HP —'}</b>
          {[ship.street1, ship.city, ship.state, ship.zip].filter(Boolean).join(', ') || <span className="text-rose-600">Alamat pengiriman belum diisi</span>}
        </div>
        <div className="flex items-end gap-2">
          <label className="text-xs font-semibold text-ink-soft">Berat (gram)
            <Input type="number" min="100" step="50" value={berat} onChange={(e) => setBerat(e.target.value)} className="mt-1 !w-28" aria-label="Berat paket (gram)" /></label>
          <Button variant="outline" loading={sibuk === 'ongkir'} onClick={cek}><Search className="h-4 w-4" />Cek ongkir</Button>
        </div>
        {info && <p className={cx('text-xs', tarif ? 'text-ink-mute' : 'rounded-lg bg-rose-50 px-2.5 py-2 text-rose-700')}>{info}</p>}
        {MODE === 'demo' && <p className="rounded-lg bg-amber-50 px-2.5 py-2 text-xs text-amber-800">Demo: tarif contoh dari tes nyata Seminyak → Kuningan 200 g. Pesan kurir hanya berfungsi di ATLAS live.</p>}
        {sibuk === 'ongkir' && <p className="flex items-center gap-2 text-sm text-ink-mute"><Loader2 className="h-4 w-4 animate-spin" />Mengambil tarif…</p>}
        {tarif && (
          <ul className="max-h-[300px] space-y-1 overflow-y-auto" role="radiogroup" aria-label="Pilih layanan kurir" data-daftar-tarif>
            {tarif.map((t) => (
              <li key={t.rate_code}>
                <label className={cx('flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl px-3 py-2 ring-1', pilih?.rate_code === t.rate_code ? 'bg-brand-soft ring-brand' : 'ring-slate-200 hover:ring-brand')}>
                  <input type="radio" name="tarif" checked={pilih?.rate_code === t.rate_code} onChange={() => setPilih(t)} />
                  <span className="min-w-0 flex-1"><b className="block text-sm text-ink">{t.kurir} · {t.layanan}</b><span className="text-[11px] text-ink-mute">{String(t.lama || '').replace('DAY', 'hari').replace('HOUR', 'jam')}</span></span>
                  <b className="tabular-nums text-sm">{rupiah(t.harga)}</b>
                </label>
              </li>
            ))}
          </ul>
        )}
        {pilih && (
          <div className="space-y-2 rounded-xl p-2.5 ring-1 ring-slate-200">
            <div className="flex gap-2 text-xs font-semibold">
              {[['PICKUP', 'Dijemput kurir'], ['DROP', 'Antar sendiri ke agen']].map(([k, l]) => (
                <button key={k} type="button" onClick={() => setJenis(k)} className={cx('h-11 flex-1 rounded-lg ring-1 sm:h-9', jenis === k ? 'bg-ink text-white ring-ink' : 'ring-slate-200 hover:ring-brand')}>{l}</button>
              ))}
            </div>
            {jenis === 'PICKUP' && (slot === null ? <p className="flex items-center gap-2 text-xs text-ink-mute"><Loader2 className="h-3.5 w-3.5 animate-spin" />Mengambil jadwal jemput…</p>
              : slot.length ? (
                <label className="block text-xs font-semibold text-ink-soft">Jadwal jemput
                  <select value={jam} onChange={(e) => setJam(Number(e.target.value))} className="mt-1 h-11 w-full rounded-lg border-slate-300 text-sm sm:h-9" data-jadwal-jemput>
                    {slot.map((s) => <option key={s.mulai} value={s.mulai}>{s.label}</option>)}
                  </select></label>
              ) : <p className="text-xs text-rose-700">Tidak ada jadwal jemput untuk layanan ini — pilih "Antar sendiri ke agen" atau layanan lain.</p>)}
          </div>
        )}
      </div>
    </Sheet>
  )
}
