// Buat Pengiriman: Pengirim → Penerima → Paket → Kurir & Biaya → Tinjau → Buat.
// Draft tersimpan di tabel `kirim` (tahap "draft") sehingga aman bila halaman dimuat ulang.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Save, Search, Check, AlertTriangle, ArrowLeft, ArrowRight, Loader2, MapPin, Truck } from 'lucide-react'
import { useApp } from '../../lib/store.jsx'
import { Button, Input, Select, Textarea, Empty, cx } from '../ui.jsx'
import { rupiah } from '../../lib/format.js'
import { go } from '../../lib/router.js'
import { BRANCHES } from '../../config/access.js'
import { JENIS_KIRIM, PENANGGUNG, CHECKLIST, normalHp, kodeposOk, nomorKode, bolehOps, zonaCabang, singkatZona, fmtWaktu, labelTahap, IS_DEMO, PENYEDIA, penyediaCabang, isEverpro } from '../../lib/kirim.js'
import { drive } from '../../lib/integrations.js'
import { cekTarif, cariLokasi, jadwalJemput, pesanKirim } from '../../lib/kirimApi.js'
import { useKirim, Kotak, Catatan, BadgeTahap, LogoKurir, ingatLogo } from './bersama.jsx'

const kurirAwal = (pn) => (pn && pn !== 'everpro' ? { kurir: PENYEDIA[pn]?.kurir || '', jenis: 'DROP' } : {})
const LANGKAH = ['Pengirim', 'Penerima', 'Paket', 'Kurir & Biaya', 'Tinjau']
const DRAFT_TAHAP = ['draft', 'siap', 'gagal_order']

/** Kelurahan + kode pos dari sumber resmi (Everpro). Alamat ambigu harus dipilih manual. */
export function PilihLokasi({ nilai, onPilih }) {
  const [q, setQ] = useState('')
  const [hasil, setHasil] = useState(null)
  const [muat, setMuat] = useState(false)
  const cari = async () => { setMuat(true); const x = await cariLokasi(q.trim()); setMuat(false); const s0 = q.trim().toLowerCase(); setHasil(x.ok ? [...(x.data || [])].sort((a, b) => (String(b.sub_district_name).toLowerCase() === s0) - (String(a.sub_district_name).toLowerCase() === s0)) : []); if (!x.ok) setHasil({ galat: x.alasan }) }
  return (
    <div className="rounded-xl bg-slate-50 p-2 ring-1 ring-slate-200 dark:bg-white/5" data-pilih-lokasi>
      <p className="mb-1 text-[11px] font-semibold text-ink-mute">Kelurahan & kode pos {nilai?.terverifikasi ? <span className="text-emerald-700">✓ terverifikasi ({nilai.kelurahan} {nilai.kodepos})</span> : <span className="text-amber-700">belum diverifikasi</span>}</p>
      <div className="flex gap-1.5">
        <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), cari())} placeholder="Nama kelurahan atau 5 angka kode pos" aria-label="Cari kelurahan" />
        <Button type="button" size="sm" variant="outline" loading={muat} onClick={cari}><Search className="h-4 w-4" />Cari</Button>
      </div>
      {hasil?.galat && <p className="mt-1 text-[12px] text-rose-700">{hasil.galat}</p>}
      {Array.isArray(hasil) && (hasil.length === 0 ? <p className="mt-1 text-[12px] text-ink-mute">Tidak ditemukan. Coba ejaan lain.</p> : (
        <ul className="mt-1 max-h-48 space-y-1 overflow-auto">
          {hasil.length > 1 && <li className="text-[11px] text-amber-800">Ada {hasil.length} hasil (termasuk nama mirip). Everpro hanya memberi nama kelurahan & kode pos — cocokkan kode pos dengan alamat pelanggan sebelum memilih.</li>}
          {hasil.map((h, i) => <li key={i}><button type="button" className="w-full rounded-lg bg-white px-2 py-1.5 text-left text-[12px] ring-1 ring-slate-200 hover:ring-brand dark:bg-white/5" onClick={() => { onPilih({ kelurahan: h.sub_district_name, kodepos: String(h.postal_code || ''), terverifikasi: true, lokasi_id: h.sub_district_id || '' }); setHasil(null) }}><b>{h.sub_district_name}</b> · {h.postal_code}{h.district_name ? ` · ${h.district_name}` : ''}{h.city_name ? `, ${h.city_name}` : ''}</button></li>)}
        </ul>
      ))}
    </div>
  )
}

/** Cari & pilih project lewat no. invoice / nama pelanggan (tanpa daftar panjang). */
function CariProject({ projects, cabang, nilai, onPilih }) {
  const [q, setQ] = useState('')
  const [buka, setBuka] = useState(false)
  const kini = projects.find((p) => p.id === nilai)
  const s0 = q.trim().toLowerCase()
  const hasil = useMemo(() => {
    const cocok = projects.filter((p) => !s0 || `${p.invoice_no} ${p.customer?.name || ''} ${p.customer?.company || ''}`.toLowerCase().includes(s0))
    const diCabang = (p) => !cabang || p.branch === cabang || p.about?.print_location === cabang
    return [...cocok.filter(diCabang), ...cocok.filter((p) => !diCabang(p))].slice(0, 30)
  }, [projects, s0, cabang])
  return (
    <div className="relative mt-0.5" data-cari-project>
      {kini && !buka ? (
        <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-[13px] font-normal text-ink ring-1 ring-slate-200 dark:bg-white/5">
          <span className="min-w-0 flex-1 truncate"><b>{kini.invoice_no}</b> · {kini.customer?.name}</span>
          <button type="button" className="text-[12px] underline" onClick={() => { setBuka(true); setQ('') }}>Ganti</button>
          <button type="button" className="text-[12px] text-rose-700 underline" onClick={() => onPilih(null)}>Lepas</button>
        </div>
      ) : (
        <>
          <div className="relative"><Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" />
            <Input value={q} onChange={(e) => { setQ(e.target.value); setBuka(true) }} onFocus={() => setBuka(true)} onBlur={() => setTimeout(() => setBuka(false), 150)} placeholder="Ketik no. invoice atau nama pelanggan…" className="pl-8" aria-label="Cari project" role="combobox" aria-expanded={buka} />
          </div>
          {buka && (
            <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl bg-white p-1 font-normal shadow-lg ring-1 ring-slate-200 dark:bg-[#1b2030]" role="listbox">
              <li><button type="button" className="w-full rounded-lg px-2 py-1.5 text-left text-[12px] text-ink-mute hover:bg-slate-50" onMouseDown={(e) => e.preventDefault()} onClick={() => { onPilih(null); setBuka(false); setQ('') }}>— tanpa project —</button></li>
              {hasil.map((p) => (
                <li key={p.id}><button type="button" role="option" aria-selected={p.id === nilai} className="w-full rounded-lg px-2 py-1.5 text-left text-[13px] text-ink hover:bg-slate-50 dark:hover:bg-white/10" onMouseDown={(e) => e.preventDefault()} onClick={() => { onPilih(p); setBuka(false); setQ('') }}>
                  <b>{p.invoice_no}</b> · {p.customer?.name}<span className="text-[11px] text-ink-mute"> · {p.branch}{p.about?.print_location && p.about.print_location !== p.branch ? ` / cetak ${p.about.print_location}` : ''}</span>
                </button></li>
              ))}
              {!hasil.length && <li className="px-2 py-1.5 text-[12px] text-ink-mute">Tidak ada project cocok.</li>}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

function FormAlamat({ a, ubah, jenis }) {
  const hp = normalHp(a.telp)
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="text-[11px] font-semibold text-ink-mute">Nama {jenis}<Input value={a.nama || ''} onChange={(e) => ubah({ nama: e.target.value })} data-f={`${jenis}-nama`} /></label>
      <label className="text-[11px] font-semibold text-ink-mute">No. HP
        <Input value={a.telp || ''} onChange={(e) => ubah({ telp: e.target.value })} onBlur={() => hp.ok && ubah({ telp: hp.nomor })} inputMode="tel" data-f={`${jenis}-telp`} />
        {a.telp && !hp.ok && <span className="text-[11px] text-rose-700">{hp.alasan}</span>}
      </label>
      <label className="text-[11px] font-semibold text-ink-mute sm:col-span-2">Alamat lengkap (jalan, nomor, gedung, RT/RW, kecamatan, kota)<Textarea rows={2} value={a.alamat || ''} onChange={(e) => ubah({ alamat: e.target.value })} data-f={`${jenis}-alamat`} /></label>
      <div className="sm:col-span-2"><PilihLokasi nilai={a} onPilih={(l) => ubah(l)} /></div>
      <label className="text-[11px] font-semibold text-ink-mute">Kode pos<Input value={a.kodepos || ''} onChange={(e) => ubah({ kodepos: e.target.value.replace(/\D/g, '').slice(0, 5), terverifikasi: false })} inputMode="numeric" data-f={`${jenis}-kodepos`} />{a.kodepos && !kodeposOk(a.kodepos) && <span className="text-[11px] text-rose-700">Harus 5 angka</span>}</label>
      <label className="text-[11px] font-semibold text-ink-mute">Catatan untuk kurir (opsional)<Input value={a.catatan || ''} onChange={(e) => ubah({ catatan: e.target.value })} placeholder="patokan, lantai, jam" /></label>
    </div>
  )
}

export default function Buat({ id }) {
  const { user, data, save, notify, ask } = useApp()
  const { alamat, templat, alamatCabang, setel } = useKirim()
  const ada = id ? (data.kirim || []).find((x) => x.id === id) : null
  const [k, setK] = useState(null)
  const [langkah, setLangkah] = useState(0)
  const [sibuk, setSibuk] = useState('')
  const [tarif, setTarif] = useState(null)
  const [urut, setUrut] = useState('harga')
  const [slot, setSlot] = useState(null)
  const [simpanAlamat, setSimpanAlamat] = useState({ pengirim: false, penerima: false })
  const kirimRef = useRef(false)

  // muat draft / siapkan baru (dari project bila diminta)
  useEffect(() => {
    if (k && (!id || k.id === id)) return
    if (id) { if (ada) setK(ada); return }
    let dariProject = null
    try { dariProject = JSON.parse(sessionStorage.getItem('atlas-kirim-dari-project') || 'null'); sessionStorage.removeItem('atlas-kirim-dari-project') } catch { /* abaikan */ }
    const p = dariProject ? (data.projects || []).find((x) => x.id === dariProject) : null
    const cabang = p ? (p.about?.print_location && p.about.print_location !== 'vendor' ? p.about.print_location : p.branch) : (user.branch && BRANCHES.includes(user.branch) ? user.branch : 'Bali')
    const ac = alamatCabang[cabang] || {}
    const ship = p?.customer?.ship || {}
    setK({
      kode: nomorKode(), sumber: 'ATLAS', sumber_status: 'Input manual', tahap: 'draft', cabang, penyedia: penyediaCabang(setel, cabang), jenis_kirim: 'keluar', pic: user.name,
      project_id: p?.id || '', invoice_no: p?.invoice_no || '', pelanggan: p?.customer?.name || '',
      dokumen: { jenis: p?.about?.service || '', jumlah: (p?.sub_projects || []).length || 1, catatan: '' }, ongkir_ditanggung: 'kantor', checklist: {},
      pengirim: { nama: ac.nama || '', telp: ac.telp || '', alamat: ac.alamat || '', kodepos: ac.kodepos || '', cabang },
      penerima: p ? { nama: ship.attention || p.customer?.name || '', telp: ship.phone || p.customer?.phone || '', alamat: [ship.street1, ship.street2, ship.city, ship.state].filter(Boolean).join(', '), kodepos: String(ship.zip || '').match(/\d{5}/)?.[0] || '', catatan: ship.note || '' } : {},
      paket: { isi: 'Dokumen terjemahan', jumlah: 1, berat_gram: '', nilai: 0 }, kurir: kurirAwal(penyediaCabang(setel, cabang)), riwayat: [],
    })
  }, [id, ada]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!bolehOps(user)) return <Empty icon={Truck} title="Tidak bisa membuat pengiriman" text="Peran Anda hanya bisa melihat data pengiriman." />
  if (id && !ada) return <Empty icon={Truck} title="Draft tidak ditemukan" text="Mungkin sudah dihapus, atau bukan cabang Anda." />
  if (!k) return <p className="flex items-center gap-2 p-4 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Menyiapkan…</p>
  if (!DRAFT_TAHAP.includes(k.tahap)) return (
    <Kotak className="space-y-2"><p className="text-sm">Pengiriman <b>{k.kode}</b> sudah tidak berupa draft (<BadgeTahap tahap={k.tahap} />).</p><Button size="sm" onClick={() => go('pengiriman/daftar')}>Ke Daftar Pengiriman</Button></Kotak>
  )

  const ubah = (p) => setK((x) => ({ ...x, ...p }))
  const ubahIn = (bag, p) => setK((x) => ({ ...x, [bag]: { ...(x[bag] || {}), ...p } }))
  const zona = zonaCabang(k.cabang)

  const simpanDraft = async (diam) => {
    setSibuk('draft')
    try {
      const now = new Date().toISOString()
      const { created_at: _c, updated_at: _u, ...bersih } = k
      const row = { ...bersih, diperbarui_at: now, riwayat: [...(k.riwayat || []), ...(k.id ? [] : [{ at: now, by: user.name, aksi: 'Draft dibuat' }])] }
      const s = await save('kirim', row)
      setK(s)
      for (const j of ['pengirim', 'penerima']) if (simpanAlamat[j] && s[j]?.nama) await save('kirim_alamat', { jenis: j === 'pengirim' ? 'pengirim' : 'pelanggan', label: `${s[j].nama}${s[j].kelurahan ? ` — ${s[j].kelurahan}` : ''}`, cabang: j === 'pengirim' ? s.cabang : '', ...s[j] })
      setSimpanAlamat({ pengirim: false, penerima: false })
      if (!k.id) window.history.replaceState(null, '', `#/pengiriman/buat/${s.id}`)
      if (!diam) notify('Draft tersimpan')
      return s
    } catch (e) { notify(e.message, 'err'); return null } finally { setSibuk('') }
  }

  const cekLangkah = (i) => {
    const pg = k.pengirim || {}, pn = k.penerima || {}, pk = k.paket || {}
    if (i === 0) { const e = []; if (!pg.nama) e.push('nama'); if (!normalHp(pg.telp).ok) e.push('No. HP'); if (String(pg.alamat || '').length < 10) e.push('alamat'); if (!kodeposOk(pg.kodepos)) e.push('kode pos'); return e }
    if (i === 1) { const e = []; if (String(pn.nama || '').length < 3) e.push('nama'); if (!normalHp(pn.telp).ok) e.push('No. HP'); if (String(pn.alamat || '').length < 10) e.push('alamat'); if (!kodeposOk(pn.kodepos)) e.push('kode pos'); return e }
    if (i === 2) { const e = []; if (!(Number(pk.berat_gram) > 0)) e.push('berat'); if (!pk.isi) e.push('isi paket'); if (pk.cod && !(Number(pk.cod_nilai) > 0)) e.push('nilai COD'); if (pk.asuransi && !(Number(pk.nilai) > 0)) e.push('nilai barang (untuk asuransi)'); return e }
    if (i === 3 && !isEverpro(k)) { const e = []; if (!k.kurir?.kurir) e.push('nama ekspedisi'); if (String(k.resi || '').trim().length < 5) e.push('nomor resi'); if (!(Number(k.kurir?.ongkir) > 0)) e.push('ongkir dibayar'); return e }
    if (i === 3) { const e = []; if (!k.kurir?.rate_code) e.push('pilih layanan kurir'); if (k.kurir?.jenis !== 'DROP' && !k.kurir?.pickup_time) e.push('jadwal jemput'); return e }
    return []
  }
  const salahIni = cekLangkah(langkah)
  const maju = async () => {
    if (salahIni.length) return notify('Lengkapi: ' + salahIni.join(', '), 'err')
    if (langkah === 1 && !k.penerima?.terverifikasi && !(await ask('Kelurahan/kode pos penerima belum diverifikasi dari sumber Everpro. Lanjut tetap?'))) return
    await simpanDraft(true)
    setLangkah((l) => Math.min(4, l + 1))
  }

  const ambilTarif = async () => {
    setSibuk('tarif'); setTarif(null); setSlot(null)
    const pk = k.paket || {}
    const x = await cekTarif({ asal_kodepos: k.pengirim.kodepos, asal_kel: k.pengirim.kelurahan, tujuan_kodepos: k.penerima.kodepos, tujuan_kel: k.penerima.kelurahan, berat_gram: pk.berat_gram, length: pk.p, width: pk.l, height: pk.t, jenis: k.kurir?.jenis || 'PICKUP', nilai: pk.nilai, asuransi: !!pk.asuransi, cod: !!pk.cod, cod_nilai: pk.cod_nilai })
    setSibuk('')
    if (!x.ok) return setTarif({ galat: x.alasan || 'Gagal cek ongkir' })
    setTarif({ list: x.tarif || [], at: x.diambil_at, contoh: x.contoh })
  }
  const pilihTarif = async (t) => {
    ubah({ kurir: { ...(k.kurir || {}), jenis: k.kurir?.jenis || 'PICKUP', kurir: t.kurir, layanan: t.layanan, logo: t.logo || '', rate_code: t.rate_code, grup: t.grup, ongkir: t.ongkir, asuransi: t.asuransi, biaya_tambahan: t.biaya_tambahan, total: t.total, cashback: t.cashback, min_hari: t.min_hari, max_hari: t.max_hari, satuan_durasi: t.satuan_durasi, tarif_at: tarif?.at, pickup_time: null, pickup_label: '' } })
    if ((k.kurir?.jenis || 'PICKUP') === 'PICKUP') { setSlot('muat'); const s = await jadwalJemput(t.rate_code, k.cabang); setSlot(s.ok ? s.slot || [] : { galat: s.alasan }) }
  }
  const urutTarif = (tarif?.list || []).slice().sort(urut === 'harga' ? (a, b) => a.total - b.total : (a, b) => (a.max_hari ?? 99) - (b.max_hari ?? 99) || a.total - b.total)

  const simpanManual = async () => {
    if (kirimRef.current) return
    const salah = cekLangkah(3); if (salah.length) return notify('Lengkapi: ' + salah.join(', '), 'err')
    if (!(await ask(`Simpan pengiriman ${k.kurir.kurir} · resi ${k.resi} · ongkir ${rupiah(k.kurir.ongkir)}?`))) return
    kirimRef.current = true; setSibuk('buat')
    try {
      const now = new Date().toISOString(), serah = k.diserahkan_at ? new Date(k.diserahkan_at).toISOString() : now
      const dobel = (data.kirim || []).find((x) => x.id !== k.id && x.resi && x.resi === String(k.resi).trim())
      if (dobel && !(await ask(`Resi ${k.resi} sudah dipakai di ${dobel.kode}. Tetap simpan?`))) return
      const ongkir = Number(k.kurir.ongkir)
      const { created_at: _c, updated_at: _u, ...bersih } = k
      const s2 = await save('kirim', { ...bersih, resi: String(k.resi).trim(), tahap: 'dikirim', sumber_status: 'Input manual', diperbarui_at: now, dipesan_at: serah, dikirim_at: serah, dipesan_oleh: user.name,
        kurir: { ...k.kurir, jenis: 'DROP', total: ongkir }, biaya: { ongkir, total: ongkir }, biaya_aktual: { ongkir, total: ongkir },
        timeline: [{ waktu: serah, status: 'DISERAHKAN', keterangan: `Diserahkan ke ${k.kurir.kurir}`, sumber: 'Input manual', diterima_at: now }],
        riwayat: [...(k.riwayat || []), { at: now, by: user.name, aksi: `Dikirim manual via ${k.kurir.kurir}${k.kurir.layanan ? ` ${k.kurir.layanan}` : ''} · resi ${k.resi} · ongkir ${rupiah(ongkir)}` }] })
      if (k.project_id && k.jenis_kirim === 'keluar') {
        const p = (data.projects || []).find((x) => x.id === k.project_id)
        if (p) await save('projects', { id: p.id, about: { ...(p.about || {}), resi_no: s2.resi, courier_name: `${k.kurir.kurir} ${k.kurir.layanan || ''}`.trim() }, history: [...(p.history || []), { at: now, by: user.name, action: `Pengiriman ${k.kurir.kurir} · resi ${s2.resi}` }] }).catch(() => null)
      }
      notify(`Pengiriman tersimpan · resi ${s2.resi}`); go('pengiriman/daftar')
    } catch (e) { notify(e.message, 'err') } finally { kirimRef.current = false; setSibuk('') }
  }
  const buat = async () => {
    if (!isEverpro(k)) return simpanManual()
    if (kirimRef.current) return
    const s = await simpanDraft(true); if (!s) return
    const kr = s.kurir || {}
    if (!(await ask(`Buat pengiriman ${kr.kurir} ${kr.layanan} seharga ${rupiah(kr.total)}?${IS_DEMO ? ' (DEMO: simulasi, tidak ada booking)' : ' Ini membuat order SUNGGUHAN di Everpro dan saldo akan terpotong.'}`))) return
    kirimRef.current = true; setSibuk('buat')
    try {
      const x = await pesanKirim(s, kr.total, save)
      if (x.berubah) {
        notify('Tarif berubah — periksa harga baru lalu konfirmasi lagi', 'err')
        if (x.tarif) setK((y) => ({ ...y, kurir: { ...y.kurir, ongkir: x.tarif.ongkir, asuransi: x.tarif.asuransi, biaya_tambahan: x.tarif.biaya_tambahan, total: x.tarif.total, cashback: x.tarif.cashback, tarif_at: new Date().toISOString() } }))
        return
      }
      if (!x.ok) return notify(x.alasan || 'Pengiriman gagal dibuat. Draft tetap tersimpan.', 'err')
      notify(x.sudah_ada ? 'Order sudah ada di Everpro — tidak dipesan ulang' : x.everpro?.awb ? `Order dibuat · resi ${x.everpro.awb}` : 'Order dibuat · resi menyusul')
      go('pengiriman/daftar')
    } finally { kirimRef.current = false; setSibuk('') }
  }

  return (
    <div className="space-y-3" data-buat-kirim>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm"><b>{k.kode}</b> · <BadgeTahap tahap={k.tahap} />{k.invoice_no ? ` · Project ${k.invoice_no}` : ''}</p>
        <Button size="sm" variant="outline" className="ml-auto" loading={sibuk === 'draft'} onClick={() => simpanDraft(false)}><Save className="h-4 w-4" />Simpan draft</Button>
      </div>
      {k.tahap === 'gagal_order' && <p className="rounded-xl bg-rose-50 p-2 text-[12px] text-rose-800 ring-1 ring-rose-200">Percobaan sebelumnya gagal: {k.galat || 'tanpa keterangan'}. Saat dicoba lagi, ATLAS mengecek dulu ke Everpro agar tidak dobel.</p>}
      <ol className="flex flex-wrap gap-1.5 text-[12px]" aria-label="Tahapan">
        {LANGKAH.map((l, i) => <li key={l}><button type="button" onClick={() => i < langkah && setLangkah(i)} className={cx('rounded-full px-3 py-1 font-semibold ring-1', i === langkah ? 'bg-[#141B34] text-white ring-[#141B34]' : i < langkah ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-white text-ink-mute ring-slate-200')} aria-current={i === langkah ? 'step' : undefined}>{i + 1}. {l}{i < langkah ? ' ✓' : ''}</button></li>)}
      </ol>

      {langkah === 0 && (
        <Kotak className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-[11px] font-semibold text-ink-mute">Cabang pengirim
              <Select value={k.cabang} onChange={(e) => { const c = e.target.value; const ac = alamatCabang[c] || {}; ubah({ cabang: c, penyedia: penyediaCabang(setel, c), kurir: kurirAwal(penyediaCabang(setel, c)), pengirim: { nama: ac.nama || '', telp: ac.telp || '', alamat: ac.alamat || '', kodepos: ac.kodepos || '', cabang: c } }) }}>{BRANCHES.map((b) => <option key={b}>{b}</option>)}</Select>
            </label>
            <label className="text-[11px] font-semibold text-ink-mute sm:col-span-2">Ambil dari buku alamat
              <Select value="" onChange={(e) => { const a = alamat.find((x) => x.id === e.target.value); if (a) ubahIn('pengirim', { nama: a.nama, telp: a.telp, alamat: a.alamat, kodepos: a.kodepos, kelurahan: a.kelurahan, terverifikasi: a.terverifikasi, catatan: a.catatan }) }}><option value="">— pilih —</option>{alamat.filter((a) => a.jenis === 'pengirim' || a.jenis === 'cabang').map((a) => <option key={a.id} value={a.id}>{a.label || a.nama}</option>)}</Select>
            </label>
          </div>
          {!alamatCabang[k.cabang]?.kodepos && <p className="text-[12px] text-amber-800">Alamat pengirim cabang {k.cabang} belum lengkap di Buku Alamat & Cabang.</p>}
          <FormAlamat a={k.pengirim || {}} ubah={(p) => ubahIn('pengirim', p)} jenis="pengirim" />
          <Catatan>Nama pengirim boleh atas nama lain (mis. nama brand) — Everpro menerima nama pengirim bebas. Jadwal pickup mengikuti zona waktu cabang ({singkatZona(zona)}).</Catatan>
          <label className="flex items-center gap-2 text-[12px]"><input type="checkbox" checked={simpanAlamat.pengirim} onChange={(e) => setSimpanAlamat((s) => ({ ...s, pengirim: e.target.checked }))} />Simpan ke buku alamat</label>
        </Kotak>
      )}

      {langkah === 1 && (
        <Kotak className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-[11px] font-semibold text-ink-mute">Ambil dari buku alamat
              <Select value="" onChange={(e) => { const a = alamat.find((x) => x.id === e.target.value); if (a) ubahIn('penerima', { nama: a.nama, telp: a.telp, alamat: a.alamat, kodepos: a.kodepos, kelurahan: a.kelurahan, terverifikasi: a.terverifikasi, catatan: a.catatan }) }}><option value="">— pilih —</option>{alamat.filter((a) => a.jenis !== 'pengirim').map((a) => <option key={a.id} value={a.id}>{a.label || a.nama}</option>)}</Select>
            </label>
            <div className="text-[11px] font-semibold text-ink-mute">Hubungkan ke project (invoice)
              <CariProject projects={data.projects || []} cabang={k.cabang} nilai={k.project_id} onPilih={(p) => ubah({ project_id: p?.id || '', invoice_no: p?.invoice_no || '', pelanggan: p?.customer?.name || k.pelanggan })} />
            </div>
          </div>
          <FormAlamat a={k.penerima || {}} ubah={(p) => ubahIn('penerima', p)} jenis="penerima" />
          <label className="flex items-center gap-2 text-[12px]"><input type="checkbox" checked={simpanAlamat.penerima} onChange={(e) => setSimpanAlamat((s) => ({ ...s, penerima: e.target.checked }))} />Simpan ke buku alamat</label>
        </Kotak>
      )}

      {langkah === 2 && (
        <Kotak className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-[11px] font-semibold text-ink-mute">Templat paket
              <Select value="" onChange={(e) => { const t = templat.find((x) => x.id === e.target.value); if (t) ubahIn('paket', { isi: t.isi, berat_gram: t.berat_gram, p: t.p, l: t.l, t: t.t, nilai: t.nilai || 0 }) }}><option value="">— pilih templat —</option>{templat.map((t) => <option key={t.id} value={t.id}>{t.nama}</option>)}</Select>
            </label>
            <label className="text-[11px] font-semibold text-ink-mute">Jenis pengiriman<Select value={k.jenis_kirim} onChange={(e) => ubah({ jenis_kirim: e.target.value })}>{Object.entries(JENIS_KIRIM).filter(([x]) => x !== 'lainnya').map(([x, l]) => <option key={x} value={x}>{l}</option>)}</Select></label>
            <label className="text-[11px] font-semibold text-ink-mute">Ongkir ditanggung<Select value={k.ongkir_ditanggung} onChange={(e) => ubah({ ongkir_ditanggung: e.target.value })}>{Object.entries(PENANGGUNG).map(([x, l]) => <option key={x} value={x}>{l}</option>)}</Select></label>
          </div>
          <Catatan>Angka templat hanya awal — timbang & ukur paket sebenarnya sebelum memesan.</Catatan>
          <div className="grid gap-2 sm:grid-cols-4">
            <label className="text-[11px] font-semibold text-ink-mute sm:col-span-2">Isi paket<Input value={k.paket?.isi || ''} onChange={(e) => ubahIn('paket', { isi: e.target.value })} /></label>
            <label className="text-[11px] font-semibold text-ink-mute">Jumlah koli<Input type="number" min="1" value={k.paket?.jumlah || 1} onChange={(e) => ubahIn('paket', { jumlah: Math.max(1, Number(e.target.value)) })} /></label>
            <label className="text-[11px] font-semibold text-ink-mute">Berat (gram)<Input type="number" min="1" value={k.paket?.berat_gram || ''} onChange={(e) => ubahIn('paket', { berat_gram: Number(e.target.value) })} data-f="berat" /></label>
            <label className="text-[11px] font-semibold text-ink-mute">Panjang (cm)<Input type="number" min="0" value={k.paket?.p || ''} onChange={(e) => ubahIn('paket', { p: Number(e.target.value) })} /></label>
            <label className="text-[11px] font-semibold text-ink-mute">Lebar (cm)<Input type="number" min="0" value={k.paket?.l || ''} onChange={(e) => ubahIn('paket', { l: Number(e.target.value) })} /></label>
            <label className="text-[11px] font-semibold text-ink-mute">Tinggi (cm)<Input type="number" min="0" value={k.paket?.t || ''} onChange={(e) => ubahIn('paket', { t: Number(e.target.value) })} /></label>
            <label className="text-[11px] font-semibold text-ink-mute">Nilai barang (Rp)<Input type="number" min="0" value={k.paket?.nilai ?? 0} onChange={(e) => ubahIn('paket', { nilai: Number(e.target.value) })} /></label>
          </div>
          <div className="flex flex-wrap gap-4 text-[13px]">
            <label className="flex items-center gap-2"><input type="checkbox" checked={!!k.paket?.asuransi} onChange={(e) => ubahIn('paket', { asuransi: e.target.checked })} />Pakai asuransi (bila tersedia di layanan)</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={!!k.paket?.cod} onChange={(e) => ubahIn('paket', { cod: e.target.checked })} />COD</label>
            {k.paket?.cod && <Input type="number" min="0" className="w-40" placeholder="Nilai COD (Rp)" value={k.paket?.cod_nilai || ''} onChange={(e) => ubahIn('paket', { cod_nilai: Number(e.target.value) })} />}
          </div>
          {k.paket?.asuransi && <p className="rounded-lg bg-amber-50 p-2 text-[12px] text-amber-900 ring-1 ring-amber-200">Asuransi kurir umumnya mengganti maksimal senilai barang yang dideklarasikan dan mengikuti syarat masing-masing kurir. Dokumen asli (ijazah, akta, paspor) belum tentu bisa diasuransikan atau diganti — periksa syarat layanan di Everpro sebelum menjanjikan apa pun ke pelanggan.</p>}
          {k.paket?.cod && <p className="text-[12px] text-ink-mute">COD hanya bisa bila akun & layanan kurir mendukung; bila tidak, cek ongkir akan menolak.</p>}
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-[11px] font-semibold text-ink-mute">Jenis dokumen<Input value={k.dokumen?.jenis || ''} onChange={(e) => ubahIn('dokumen', { jenis: e.target.value })} placeholder="mis. terjemahan tersumpah, apostille" /></label>
            <label className="text-[11px] font-semibold text-ink-mute">Jumlah berkas<Input type="number" min="0" value={k.dokumen?.jumlah || ''} onChange={(e) => ubahIn('dokumen', { jumlah: Number(e.target.value) })} /></label>
            <label className="text-[11px] font-semibold text-ink-mute">Catatan penanganan<Input value={k.dokumen?.catatan || ''} onChange={(e) => ubahIn('dokumen', { catatan: e.target.value })} placeholder="jangan dilipat, dokumen asli, dll." /></label>
          </div>
          <fieldset><legend className="text-[11px] font-semibold text-ink-mute">Checklist sebelum kirim</legend>
            <div className="mt-1 flex flex-wrap gap-3">{CHECKLIST.map(([c, l]) => <label key={c} className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={!!k.checklist?.[c]} onChange={(e) => ubahIn('checklist', { [c]: e.target.checked })} />{l}</label>)}</div>
          </fieldset>
        </Kotak>
      )}

      {langkah === 3 && (
        <Kotak className="mb-3 space-y-2" data-pilih-penyedia>
          <label className="text-[11px] font-semibold text-ink-mute">Ekspedisi (bawaan cabang {k.cabang}: {PENYEDIA[penyediaCabang(setel, k.cabang)]?.singkat})
            <Select value={k.penyedia || 'everpro'} onChange={(e) => { const v = e.target.value; ubah({ penyedia: v, kurir: v === 'everpro' ? {} : { kurir: PENYEDIA[v]?.kurir || '', jenis: 'DROP' } }); setTarif(null); setSlot(null) }} data-f="penyedia">
              {Object.entries(PENYEDIA).map(([x, v]) => <option key={x} value={x}>{v.label}</option>)}
            </Select>
          </label>
          {!isEverpro(k) && <Catatan>Kirim dulu di loket/kurir {PENYEDIA[k.penyedia]?.singkat || ''}, lalu isi resi & ongkir dari struk. Status diperbarui staf (tercatat siapa & kapan) — bukan real-time.</Catatan>}
        </Kotak>
      )}
      {langkah === 3 && !isEverpro(k) && <FormManual k={k} ubah={ubah} ubahIn={ubahIn} />}
      {langkah === 3 && isEverpro(k) && (
        <Kotak className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-[11px] font-semibold text-ink-mute">Metode<Select value={k.kurir?.jenis || 'PICKUP'} onChange={(e) => { ubah({ kurir: { jenis: e.target.value } }); setTarif(null); setSlot(null) }}><option value="PICKUP">Dijemput kurir (pickup)</option><option value="DROP">Antar sendiri ke agen (drop-off)</option></Select></label>
            <Button size="sm" loading={sibuk === 'tarif'} onClick={ambilTarif} data-aksi="cek-tarif">Cek ongkir</Button>
            <label className="ml-auto text-[11px] font-semibold text-ink-mute">Urutkan<Select value={urut} onChange={(e) => setUrut(e.target.value)}><option value="harga">Termurah</option><option value="waktu">Tercepat</option></Select></label>
          </div>
          {tarif?.galat && <p className="rounded-lg bg-rose-50 p-2 text-[12px] text-rose-800">{tarif.galat}</p>}
          {tarif?.list && (tarif.list.length === 0 ? <p className="text-[12px] text-ink-mute">Tidak ada layanan untuk rute/berat/metode ini. Coba metode lain, atau periksa kode pos.</p> : (
            <>
              <p className="text-[11px] text-ink-mute">Tarif diambil {fmtWaktu(tarif.at, zona)}{tarif.contoh ? ' · CONTOH DEMO' : ' · dari Everpro'} — akan dicek ulang saat membuat pengiriman.</p>
              <TabelTarif list={urutTarif} pilih={k.kurir?.rate_code} onPilih={pilihTarif} />
            </>
          ))}
          {k.kurir?.rate_code && (k.kurir.jenis || 'PICKUP') === 'PICKUP' && (
            <label className="block text-[11px] font-semibold text-ink-mute">Jadwal jemput ({singkatZona(zona)}, mengikuti cabang {k.cabang})
              {slot === 'muat' ? <p className="text-sm"><Loader2 className="inline h-4 w-4 animate-spin" /> memuat jadwal…</p> : slot?.galat ? <p className="text-[12px] text-rose-700">{slot.galat}</p> : (
                <Select value={k.kurir?.pickup_time || ''} onChange={(e) => { const s = (slot || []).find((x) => String(x.mulai) === e.target.value); ubahIn('kurir', { pickup_time: s?.mulai || null, pickup_label: s?.label || '' }) }}>
                  <option value="">— pilih jadwal —</option>{(slot || []).map((s) => <option key={s.mulai} value={s.mulai}>{s.label}</option>)}
                </Select>
              )}
              {Array.isArray(slot) && !slot.length && <span className="text-[12px] text-amber-800">Tidak ada jadwal jemput tersedia — pilih drop-off atau kurir lain.</span>}
            </label>
          )}
        </Kotak>
      )}

      {langkah === 4 && <Tinjau k={k} zona={zona} />}

      <div className="flex flex-wrap items-center gap-2">
        {langkah > 0 && <Button variant="outline" onClick={() => setLangkah((l) => l - 1)}><ArrowLeft className="h-4 w-4" />Kembali</Button>}
        {langkah < 4 && <Button onClick={maju} data-aksi="lanjut">Lanjut<ArrowRight className="h-4 w-4" /></Button>}
        {langkah === 4 && <Button loading={sibuk === 'buat'} disabled={!!sibuk} onClick={buat} data-aksi="buat-pengiriman"><Check className="h-4 w-4" />{isEverpro(k) ? 'Buat Pengiriman' : 'Simpan Pengiriman'}</Button>}
        {salahIni.length > 0 && langkah < 4 && <span className="text-[12px] text-ink-mute">Belum lengkap: {salahIni.join(', ')}</span>}
      </div>
    </div>
  )
}

export function TabelTarif({ list, pilih, onPilih }) {
  ingatLogo(list)
  return (
    <div className="overflow-x-auto rounded-xl ring-1 ring-slate-200">
      <table className="w-full min-w-[720px] text-[12px]" data-tabel-tarif>
        <thead className="bg-slate-50 text-[11px] text-ink-mute"><tr>{['Kurir & layanan', 'Estimasi tiba', 'Ongkir', 'Asuransi', 'Biaya tambahan', 'Total dibayar', 'Cashback (terpisah)', ''].map((h) => <th key={h} className="p-2 text-left font-semibold">{h}</th>)}</tr></thead>
        <tbody>
          {list.map((t) => (
            <tr key={t.rate_code} className={cx('border-t border-slate-100', pilih === t.rate_code && 'bg-emerald-50')}>
              <td className="p-2"><div className="flex items-center gap-2"><LogoKurir nama={t.kurir} logo={t.logo} ukuran={36} /><div><b>{t.kurir}</b> {t.layanan}<div className="text-[10px] text-ink-mute">{t.grup}{t.berat_dihitung ? ` · berat dihitung ${t.berat_dihitung} kg` : ''}{t.berat_volume ? ` · volume ${t.berat_volume} kg` : ''}{t.kayu ? ' · packing kayu' : ''}</div></div></div></td>
              <td className="p-2">{t.min_hari != null ? `${t.min_hari}–${t.max_hari} ${String(t.satuan_durasi || 'hari').toLowerCase().replace('day', 'hari')}` : '-'}</td>
              <td className="p-2">{rupiah(t.ongkir)}</td>
              <td className="p-2">{t.asuransi ? rupiah(t.asuransi) : t.asuransi_tersedia ? '—' : 'tidak tersedia'}</td>
              <td className="p-2">{t.biaya_tambahan ? rupiah(t.biaya_tambahan) : '—'}</td>
              <td className="p-2 font-bold">{rupiah(t.total)}</td>
              <td className="p-2 text-ink-mute">{t.cashback ? `± ${rupiah(t.cashback)}` : '—'}</td>
              <td className="p-2">{onPilih && <Button size="sm" variant={pilih === t.rate_code ? 'primary' : 'outline'} onClick={() => onPilih(t)}>{pilih === t.rate_code ? 'Dipilih' : 'Pilih'}</Button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="p-2 text-[10px] text-ink-mute">Total = ongkir + asuransi + biaya tambahan dari Everpro. Cashback belum cair, tidak mengurangi pembayaran. Berat volume mengikuti aturan tiap kurir (dihitung Everpro). Diskon langsung & biaya COD tampil di biaya aktual setelah order dibuat.</p>
    </div>
  )
}

function FormManual({ k, ubah, ubahIn }) {
  const { notify } = useApp()
  const [unggah, setUnggah] = useState(false)
  const lain = k.penyedia === 'lainnya'
  return (
    <Kotak className="grid gap-2 sm:grid-cols-2" data-form-manual>
      <label className="text-[11px] font-semibold text-ink-mute">Nama ekspedisi<Input value={k.kurir?.kurir || ''} readOnly={!lain} onChange={(e) => ubahIn('kurir', { kurir: e.target.value })} placeholder="mis. JNE, TIKI, kurir lokal" data-f="manual-kurir" /></label>
      <label className="text-[11px] font-semibold text-ink-mute">Layanan (opsional)<Input value={k.kurir?.layanan || ''} onChange={(e) => ubahIn('kurir', { layanan: e.target.value })} placeholder={k.penyedia === 'dhl' ? 'mis. Express Domestic' : k.penyedia === 'pos' ? 'mis. Pos Kilat Khusus, Express' : ''} /></label>
      <label className="text-[11px] font-semibold text-ink-mute">Nomor resi<Input value={k.resi || ''} onChange={(e) => ubah({ resi: e.target.value.trim() })} placeholder="dari struk" className="font-mono" data-f="manual-resi" /></label>
      <label className="text-[11px] font-semibold text-ink-mute">Ongkir dibayar (Rp)<Input type="number" min="0" value={k.kurir?.ongkir || ''} onChange={(e) => ubahIn('kurir', { ongkir: Number(e.target.value) })} data-f="manual-ongkir" /></label>
      <label className="text-[11px] font-semibold text-ink-mute">Diserahkan ke kurir pada<Input type="datetime-local" value={k.diserahkan_at || ''} onChange={(e) => ubah({ diserahkan_at: e.target.value })} /><span className="font-normal">Kosongkan = sekarang</span></label>
      <div className="text-[11px] font-semibold text-ink-mute">Foto struk / bukti kirim (opsional)
        <div className="mt-1 flex items-center gap-2">
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl px-3 text-[13px] ring-1 ring-slate-200 hover:ring-brand">{unggah ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{k.struk ? 'Ganti foto' : 'Unggah foto'}
            <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; setUnggah(true); try { ubah({ struk: await drive.upload(f, { branch: k.cabang, invoice: k.invoice_no || 'PENGIRIMAN' }) }) } catch (er) { notify('Gagal unggah: ' + er.message, 'err') } finally { setUnggah(false) } }} />
          </label>
          {k.struk && <span className="truncate font-normal text-emerald-700">✓ {k.struk.name || 'tersimpan'}</span>}
        </div>
      </div>
    </Kotak>
  )
}

function Tinjau({ k, zona }) {
  const kr = k.kurir || {}, pk = k.paket || {}
  const belumCek = CHECKLIST.filter(([c]) => !k.checklist?.[c]).map(([, l]) => l)
  return (
    <Kotak className="space-y-3 text-sm" data-tinjau>
      <div className="grid gap-3 sm:grid-cols-2">
        {[['Pengirim', k.pengirim], ['Penerima', k.penerima]].map(([j, a]) => <div key={j}><p className="text-[11px] font-semibold text-ink-mute">{j}</p><p className="font-semibold">{a?.nama} · {a?.telp}</p><p className="text-[12px]">{a?.alamat}{a?.kelurahan ? `, ${a.kelurahan}` : ''} {a?.kodepos}</p></div>)}
      </div>
      <p className="text-[12px]">Paket: {pk.isi} · {pk.jumlah || 1} koli · {pk.berat_gram} g{pk.p ? ` · ${pk.p}×${pk.l}×${pk.t} cm` : ''} · nilai {rupiah(pk.nilai || 0)}{pk.asuransi ? ' · asuransi' : ''}{pk.cod ? ` · COD ${rupiah(pk.cod_nilai)}` : ''}</p>
      <p className="text-[12px]">{JENIS_KIRIM[k.jenis_kirim]} · {PENANGGUNG[k.ongkir_ditanggung]}{k.invoice_no ? ` · Project ${k.invoice_no}` : ''} · Cabang {k.cabang}</p>
      <div className="rounded-xl bg-slate-50 p-3 dark:bg-white/5">
        <p className="flex items-center gap-2 font-semibold"><LogoKurir nama={kr.kurir} logo={kr.logo} ukuran={32} />{kr.kurir} {kr.layanan} · {!isEverpro(k) ? `manual · resi ${k.resi || '-'}` : kr.jenis === 'DROP' ? 'antar sendiri ke agen' : `dijemput ${kr.pickup_label || fmtWaktu(kr.pickup_time, zona)}`}</p>
        <table className="mt-1 w-full text-[13px]"><tbody>
          <tr><td>Ongkir</td><td className="text-right">{rupiah(kr.ongkir)}</td></tr>
          {kr.asuransi > 0 && <tr><td>Asuransi</td><td className="text-right">{rupiah(kr.asuransi)}</td></tr>}
          {kr.biaya_tambahan > 0 && <tr><td>Biaya tambahan</td><td className="text-right">{rupiah(kr.biaya_tambahan)}</td></tr>}
          <tr className="font-bold"><td>Total dibayar</td><td className="text-right">{rupiah(kr.total)}</td></tr>
          {kr.cashback > 0 && <tr className="text-ink-mute"><td>Estimasi cashback (belum cair, tidak mengurangi)</td><td className="text-right">± {rupiah(kr.cashback)}</td></tr>}
        </tbody></table>
        <p className="mt-1 text-[11px] text-ink-mute">{isEverpro(k) ? `Tarif diambil ${fmtWaktu(kr.tarif_at, zona)}. Saat Buat Pengiriman, tarif dicek ulang; bila berubah Anda diminta konfirmasi lagi.` : 'Ongkir sesuai struk yang diisi staf (input manual).'}</p>
      </div>
      {belumCek.length > 0 && <p className="flex items-center gap-1 text-[12px] text-amber-800"><AlertTriangle className="h-4 w-4" />Checklist belum dicentang: {belumCek.join(', ')}</p>}
    </Kotak>
  )
}
