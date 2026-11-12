// ============================================================
//  PERUSAHAAN — pusat informasi & dokumen perusahaan.
//  Tidak ada data karangan: yang belum diisi tampil "Belum diisi"
//  dengan petunjuk. Data profil di app_settings ('perusahaan',
//  'kantor_cabang'); dokumen di tabel perusahaan_dok.
//  Hak akses: lihat / unduh / kelola dibedakan per peran & per
//  dokumen (umum / terbatas). LIVE: wajib dikunci juga di RLS
//  tabel perusahaan_dok + kebijakan Storage (lihat catatan rilis).
// ============================================================
import { useMemo, useRef, useState } from 'react'
import { Building2, Network, MapPin, Scale, FileImage, BadgeCheck, BookMarked, Download, Eye, Pencil, Plus, Search, Lock, Globe2, X, Upload, Archive, MessageCircle, Phone, Mail, Clock, ExternalLink, Trash2 } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { Button, Card, Field, Input, Textarea, Select, Sheet, cx } from '../components/ui.jsx'
import Avatar from '../components/Avatar.jsx'
import { BRANCHES, ROLES, branchesOf } from '../config/access.js'
import { SUMBER_DANA } from '../config/workflows.js'
import { drive } from '../lib/integrations.js'
import { saveBlob } from '../lib/download.js'
import { tanggalJam } from '../lib/waktu.js'
import logo247 from '../assets/login/logo247.webp'

// ---------- hak akses ----------
const peran = (u) => u?.base_role || u?.role
export const bolehKelolaPerusahaan = (u) => ['superadmin', 'direktur'].includes(peran(u))
const bolehLihatTerbatas = (u) => ['superadmin', 'direktur', 'admin_pusat', 'supervisor', 'akunting'].includes(peran(u))
const bolehUnduhTerbatas = (u) => ['superadmin', 'direktur', 'admin_pusat'].includes(peran(u))
/** Dokumen boleh dilihat? Kredensial pribadi: pemiliknya juga boleh. */
const bisaLihat = (u, d) => d.akses !== 'terbatas' || bolehLihatTerbatas(u) || (d.user_id && d.user_id === u.id)
const bisaUnduh = (u, d) => d.akses !== 'terbatas' || bolehUnduhTerbatas(u) || (d.user_id && d.user_id === u.id)

// ---------- data dasar yang memang sudah diketahui ----------
const NAMA_RESMI = 'PT Aksara Translingua Sentosa'
const MEREK = ['247 Sworn Translator', 'Penerjemahbahasa.id', 'Apostille Indonesia', 'Global Translate']
const LAYANAN = ['Terjemahan tersumpah', 'Apostille', 'Legalisasi dokumen']
const PROFIL_AWAL = { alamat_pusat: 'Jl. Sunset Road 88, Seminyak, Bali', wa: '0817-244-247', jam: 'Setiap hari' }
const PUSAT = 'Bali'

const KAT_LEGAL = ['Akta Pendirian', 'Akta Perubahan', 'SK Pengesahan Badan Hukum', 'NIB', 'NPWP Perusahaan', 'Izin Usaha', 'Sertifikasi', 'Lainnya']
const KAT_MEDIA = ['Company Profile', 'Brosur Layanan', 'Logo Resmi', 'Panduan Merek']
const KAT_KREDENSIAL = ['SK Penerjemah Tersumpah', 'Sertifikasi', 'Keanggotaan Profesi']
const KAT_KEBIJAKAN = ['Peraturan Perusahaan', 'Kode Etik', 'Kebijakan Kerahasiaan', 'Pedoman Internal']

const TABS = [
  ['ringkasan', 'Ringkasan', Building2],
  ['struktur', 'Struktur Organisasi', Network],
  ['kantor', 'Kantor & Cabang', MapPin],
  ['legal', 'Legalitas & Perizinan', Scale],
  ['media', 'Company Profile & Media', FileImage],
  ['kredensial', 'Kredensial & Keanggotaan', BadgeCheck],
  ['kebijakan', 'Kebijakan & Pedoman', BookMarked],
]

const hariIni = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Makassar' })
/** Status masa berlaku. Tanpa tanggal kedaluwarsa → tidak pernah "kedaluwarsa". */
export function statusBerlaku(d, hari = hariIni()) {
  if (!d.kedaluwarsa) return { k: 'tanpa', label: 'Tanpa masa berlaku', cls: 'bg-slate-100 text-ink-soft' }
  const sisa = Math.round((new Date(`${d.kedaluwarsa}T12:00:00+08:00`) - new Date(`${hari}T12:00:00+08:00`)) / 864e5)
  if (sisa < 0) return { k: 'kedaluwarsa', label: 'Kedaluwarsa', cls: 'bg-rose-100 text-rose-700' }
  if (sisa <= 60) return { k: 'segera', label: `Segera berakhir · ${sisa} hr`, cls: 'bg-amber-100 text-amber-800' }
  return { k: 'berlaku', label: 'Berlaku', cls: 'bg-emerald-100 text-emerald-700' }
}
const tgl = (v) => (v ? new Date(`${v}T12:00:00+08:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const ukuran = (n) => (!n ? '—' : n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)
const namaPendek = (n) => String(n || '').replace(/\s*\(.*\)\s*$/, '')

function Kosong({ judul, petunjuk, aksi, onAksi, kecil }) {
  return (
    <div className={cx('rounded-xl border-[1.5px] border-dashed border-slate-300 bg-slate-50/60', kecil ? 'p-3' : 'p-4')} data-kosong>
      {judul && <p className="text-[11px] font-bold uppercase tracking-wide text-ink-mute">{judul}</p>}
      <p className="mt-1 text-sm text-ink-mute">Belum diisi.{petunjuk ? ` ${petunjuk}` : ''}</p>
      {aksi && onAksi && <button type="button" onClick={onAksi} className="mt-2 min-h-[32px] text-xs font-semibold text-brand hover:underline">＋ {aksi}</button>}
    </div>
  )
}

/** Satu dokumen: pratinjau & unduh sesuai hak. */
function useBerkas() {
  const { user, notify } = useApp()
  const pratinjau = async (d) => {
    if (!bisaLihat(user, d)) return notify('Anda tidak punya akses ke dokumen ini', 'err')
    try { const url = await drive.url?.(d.file) ?? d.file?.url; if (!url) throw new Error('File tidak tersedia'); window.open(url, '_blank', 'noopener') }
    catch (e) { notify(e.message || 'Gagal membuka pratinjau', 'err') }
  }
  const unduh = async (d) => {
    if (!bisaUnduh(user, d)) return notify('Anda tidak punya izin mengunduh dokumen ini', 'err')
    try { const b = await drive.blob(d.file); await saveBlob(d.file.name, b) }
    catch (e) { notify(e.message || 'Gagal mengunduh', 'err') }
  }
  return { pratinjau, unduh }
}

// ============================================================
//  FORM DOKUMEN (dipakai legal / media / kredensial / kebijakan)
// ============================================================
const FORM = {
  legal: { judul: 'dokumen legalitas', kat: KAT_LEGAL, pt: true, nomor: true, penerbit: true, terbit: true, kedaluwarsa: true, aksesAwal: 'terbatas' },
  media: { judul: 'file media', kat: KAT_MEDIA, bahasa: true, versi: true, aksesAwal: 'umum' },
  kredensial: { judul: 'kredensial', kat: KAT_KREDENSIAL, orang: true, pasangan: true, nomor: true, penerbit: true, terbit: true, kedaluwarsa: true, aksesAwal: 'terbatas' },
  kebijakan: { judul: 'kebijakan / pedoman', kat: KAT_KEBIJAKAN, versi: true, berlaku: true, pj: true, aksesAwal: 'umum' },
}

function FormDok({ jenis, awal, onClose }) {
  const { user, data, save, remove, notify } = useApp()
  const c = FORM[jenis]
  const [v, setV] = useState(() => awal || { jenis, kategori: c.kat[0], pt: 'ATS', akses: c.aksesAwal, bahasa: 'Indonesia', versi: '1.0' })
  const [file, setFile] = useState(null)
  const [simpan, setSimpan] = useState(false)
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e?.target ? e.target.value : e }))
  const orangList = (data.users || []).filter((u) => u.active !== false && ['penerjemah', 'proofreader', 'otorisator'].some((r) => u.role === r || (u.extra_roles || []).includes(r)))
  const go = async () => {
    if (!v.nama?.trim()) return notify('Nama dokumen wajib diisi', 'err')
    if (c.orang && !v.user_id) return notify('Pilih penerjemah', 'err')
    if (!file && !v.file && jenis !== 'kredensial') return notify('Unggah file dulu', 'err')
    setSimpan(true)
    try {
      const f = file ? await drive.upload(file, { branch: v.akses === 'terbatas' ? 'perusahaan-terbatas' : 'perusahaan', invoice: jenis }) : v.file
      await save('perusahaan_dok', { ...v, nama: v.nama.trim(), file: f || null, updated_by: user.name, updated_by_id: user.id, updated_at_local: new Date().toISOString() })
      notify('Tersimpan'); onClose()
    } catch (e) { notify(e.message || 'Gagal menyimpan', 'err') } finally { setSimpan(false) }
  }
  return (
    <Sheet open side onClose={onClose} title={`${awal?.id ? 'Ubah' : 'Tambah'} ${c.judul}`}
      footer={<>
        {awal?.id && <Button variant="outline" onClick={async () => { await remove('perusahaan_dok', awal.id); notify('Dihapus'); onClose() }}><Trash2 className="h-4 w-4" />Hapus</Button>}
        {awal?.id && !v.arsip && <Button variant="outline" onClick={async () => { await save('perusahaan_dok', { ...awal, arsip: true, updated_by: user.name, updated_at_local: new Date().toISOString() }); notify('Diarsipkan'); onClose() }}><Archive className="h-4 w-4" />Arsipkan</Button>}
        <span className="flex-1" /><Button onClick={go} loading={simpan} data-aksi="simpan-dok">Simpan</Button></>}>
      <div className="space-y-3" data-form-dok={jenis}>
        <Field label="Nama dokumen" required><Input value={v.nama || ''} onChange={set('nama')} placeholder={jenis === 'legal' ? 'mis. Akta Pendirian PT' : jenis === 'media' ? 'mis. Company Profile 2026' : ''} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Kategori" required><Select value={v.kategori} onChange={set('kategori')}>{c.kat.map((k) => <option key={k}>{k}</option>)}</Select></Field>
          {c.pt && <Field label="PT" required><Select value={v.pt} onChange={set('pt')}>{SUMBER_DANA.map((p) => <option key={p.code} value={p.code}>{p.code} — {p.name.replace('PT ', '')}</option>)}</Select></Field>}
          {c.bahasa && <Field label="Bahasa"><Select value={v.bahasa} onChange={set('bahasa')}>{['Indonesia', 'Inggris', 'Lainnya'].map((k) => <option key={k}>{k}</option>)}</Select></Field>}
          {c.orang && <Field label="Penerjemah" required><Select value={v.user_id || ''} onChange={set('user_id')}><option value="">— pilih —</option>{orangList.map((u) => <option key={u.id} value={u.id}>{namaPendek(u.name)}</option>)}</Select></Field>}
        </div>
        {c.pasangan && <Field label="Pasangan bahasa" hint="mis. Indonesia ⇄ Inggris"><Input value={v.pasangan || ''} onChange={set('pasangan')} /></Field>}
        {c.nomor && <Field label="Nomor"><Input value={v.nomor || ''} onChange={set('nomor')} /></Field>}
        {c.penerbit && <Field label="Instansi penerbit"><Input value={v.penerbit || ''} onChange={set('penerbit')} placeholder="mis. Kemenkumham" /></Field>}
        {(c.terbit || c.kedaluwarsa) && <div className="grid grid-cols-2 gap-2">
          <Field label="Tanggal terbit"><Input type="date" value={v.terbit || ''} onChange={set('terbit')} /></Field>
          <Field label="Kedaluwarsa" hint="Kosongkan bila tidak ada"><Input type="date" value={v.kedaluwarsa || ''} onChange={set('kedaluwarsa')} /></Field>
        </div>}
        {c.versi && <div className="grid grid-cols-2 gap-2">
          <Field label="Versi"><Input value={v.versi || ''} onChange={set('versi')} /></Field>
          {c.berlaku && <Field label="Tanggal berlaku"><Input type="date" value={v.berlaku || ''} onChange={set('berlaku')} /></Field>}
        </div>}
        {c.pj && <Field label="Penanggung jawab"><Select value={v.pj_id || ''} onChange={(e) => setV((x) => ({ ...x, pj_id: e.target.value, pj: namaPendek((data.users || []).find((u) => u.id === e.target.value)?.name) }))}><option value="">— pilih —</option>{(data.users || []).filter((u) => u.active !== false && ['superadmin', 'direktur', 'admin_pusat', 'supervisor', 'akunting'].includes(u.role)).map((u) => <option key={u.id} value={u.id}>{namaPendek(u.name)}</option>)}</Select></Field>}
        <Field label={jenis === 'kredensial' ? 'Dokumen pendukung (opsional)' : 'File'} required={jenis !== 'kredensial'}>
          <label className="flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-ink-soft hover:bg-slate-50">
            <Upload className="h-4 w-4" />{file ? `${file.name} · ${ukuran(file.size)}` : v.file ? `${v.file.name} (ganti)` : 'Pilih file (PDF / gambar)'}
            <input type="file" className="sr-only" accept=".pdf,image/*,.zip,.ai,.svg,.docx" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
        </Field>
        <Field label="Akses">
          <Select value={v.akses} onChange={set('akses')}>
            <option value="umum">🌐 Umum — semua staf boleh lihat &amp; unduh</option>
            <option value="terbatas">🔒 Terbatas — lihat: pimpinan & admin · unduh: Superadmin, Direktur, Admin Pusat</option>
          </Select>
        </Field>
        <Field label="Catatan"><Textarea value={v.catatan || ''} onChange={set('catatan')} /></Field>
        {awal?.updated_by && <p className="text-[11px] text-ink-mute">Terakhir diperbarui {awal.updated_by} · {tanggalJam(awal.updated_at_local || awal.updated_at)}</p>}
      </div>
    </Sheet>
  )
}

// ============================================================
//  DAFTAR DOKUMEN (cari + filter kategori)
// ============================================================
function DaftarDok({ jenis, judul, keterangan, ikon: Ikon, kosong }) {
  const { user, data } = useApp()
  const kelola = bolehKelolaPerusahaan(user)
  const { pratinjau, unduh } = useBerkas()
  const [q, setQ] = useState('')
  const [kat, setKat] = useState('')
  const [pt, setPt] = useState('')
  const [st, setSt] = useState('')
  const [arsip, setArsip] = useState(false)
  const [form, setForm] = useState(null)
  const c = FORM[jenis]
  const semua = (data.perusahaan_dok || []).filter((d) => d.jenis === jenis && bisaLihat(user, d))
  const nama = (id) => namaPendek((data.users || []).find((u) => u.id === id)?.name)
  // Versi terbaru per kategori + bahasa (media/kebijakan); sisanya arsip.
  const terbaru = useMemo(() => {
    if (!c.versi) return new Set()
    const m = new Map()
    for (const d of semua.filter((x) => !x.arsip)) { const k = `${d.kategori}|${d.bahasa || ''}|${d.nama?.split(' ')[0]}`; const cur = m.get(k); if (!cur || String(d.updated_at_local || d.updated_at) > String(cur.updated_at_local || cur.updated_at)) m.set(k, d) }
    return new Set([...m.values()].map((d) => d.id))
  }, [semua]) // eslint-disable-line react-hooks/exhaustive-deps
  const s = q.trim().toLowerCase()
  const rows = semua.filter((d) => (arsip ? d.arsip : !d.arsip))
    .filter((d) => (!kat || d.kategori === kat) && (!pt || d.pt === pt) && (!st || statusBerlaku(d).k === st))
    .filter((d) => !s || [d.nama, d.nomor, d.penerbit, d.kategori, d.catatan, nama(d.user_id), d.pasangan].some((x) => String(x || '').toLowerCase().includes(s)))
    .sort((a, b) => String(b.updated_at_local || b.updated_at || '').localeCompare(String(a.updated_at_local || a.updated_at || '')))
  const nArsip = semua.filter((d) => d.arsip).length
  return (
    <Card className="overflow-hidden" data-daftar-dok={jenis}>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-4">
        <Ikon className="h-5 w-5 text-ink-mute" /><h2 className="font-bold">{judul}</h2>
        {kelola && <Button size="sm" className="ml-auto" onClick={() => setForm({})} data-aksi="tambah-dok"><Plus className="h-3.5 w-3.5" />Tambah</Button>}
        {keterangan && <p className="basis-full text-xs text-ink-mute">{keterangan}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 text-[13px]">
        <label className="relative block min-w-[180px] flex-1 sm:max-w-[260px]"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama / nomor…" aria-label="Cari dokumen" className="h-10 w-full rounded-lg border-0 pl-9 pr-3 text-[13px] ring-1 ring-slate-200 focus:ring-2 focus:ring-brand" /></label>
        <select value={kat} onChange={(e) => setKat(e.target.value)} aria-label="Kategori" className="h-10 rounded-lg border-0 pl-3 pr-8 text-[13px] ring-1 ring-slate-200"><option value="">Semua kategori</option>{c.kat.map((k) => <option key={k}>{k}</option>)}</select>
        {c.pt && <select value={pt} onChange={(e) => setPt(e.target.value)} aria-label="PT" className="h-10 rounded-lg border-0 pl-3 pr-8 text-[13px] ring-1 ring-slate-200"><option value="">Semua PT</option>{SUMBER_DANA.map((p) => <option key={p.code} value={p.code}>{p.code}</option>)}</select>}
        {c.kedaluwarsa && <select value={st} onChange={(e) => setSt(e.target.value)} aria-label="Masa berlaku" className="h-10 rounded-lg border-0 pl-3 pr-8 text-[13px] ring-1 ring-slate-200"><option value="">Semua status</option><option value="berlaku">Berlaku</option><option value="segera">Segera berakhir</option><option value="kedaluwarsa">Kedaluwarsa</option><option value="tanpa">Tanpa masa berlaku</option></select>}
        {nArsip > 0 && <button type="button" onClick={() => setArsip((x) => !x)} aria-pressed={arsip} className={cx('h-10 rounded-lg px-3 text-[13px] font-semibold ring-1', arsip ? 'bg-ink text-white ring-ink' : 'ring-slate-200')}><Archive className="mr-1 inline h-3.5 w-3.5" />Arsip ({nArsip})</button>}
      </div>
      {semua.length === 0 ? (
        <div className="px-4 pb-5"><div className="grid place-items-center rounded-xl border-[1.5px] border-dashed border-slate-300 bg-slate-50/60 px-4 py-10 text-center" data-kosong>
          <Ikon className="h-8 w-8 text-slate-300" /><p className="mt-2 font-bold text-ink">Belum ada {c.judul}</p><p className="mt-1 max-w-sm text-xs text-ink-mute">{kosong}</p>
          {kelola ? <Button size="sm" className="mt-3" onClick={() => setForm({})}><Plus className="h-3.5 w-3.5" />Tambah {c.judul} pertama</Button> : <p className="mt-3 text-xs text-ink-mute">Hubungi Direktur / Superadmin untuk mengisi.</p>}
        </div></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-slate-50 text-left text-[10.5px] uppercase tracking-wide text-ink-mute"><tr>
              <th className="px-4 py-2">Nama</th><th className="px-3">Kategori</th>
              {c.pt && <th className="px-3">PT</th>}{c.orang && <th className="px-3">Penerjemah</th>}{c.pasangan && <th className="px-3">Pasangan bahasa</th>}
              {c.nomor && <th className="px-3">Nomor</th>}{c.penerbit && <th className="px-3">Penerbit</th>}
              {c.bahasa && <th className="px-3">Bahasa</th>}{c.versi && <th className="px-3">Versi</th>}{c.berlaku && <th className="px-3">Berlaku</th>}{c.pj && <th className="px-3">Penanggung jawab</th>}
              {c.terbit && <th className="px-3">Terbit</th>}{c.kedaluwarsa && <th className="px-3">Masa berlaku</th>}
              <th className="px-3">Ukuran</th><th className="px-3">Diperbarui</th><th className="px-4 text-right">Aksi</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((d) => { const b = statusBerlaku(d); return (
                <tr key={d.id} className="align-middle" data-dok-baris>
                  <td className="px-4 py-2.5"><span className="flex items-center gap-1.5 font-semibold">{d.akses === 'terbatas' ? <Lock className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-label="Terbatas" /> : <Globe2 className="h-3.5 w-3.5 shrink-0 text-ink-mute" aria-label="Umum" />}{d.nama}
                    {terbaru.has(d.id) && <span className="rounded bg-emerald-100 px-1 text-[10px] font-bold text-emerald-700">TERBARU</span>}{d.arsip && <span className="rounded bg-slate-200 px-1 text-[10px] font-bold text-ink-soft">ARSIP</span>}</span>
                    {d.catatan && <span className="block max-w-[260px] truncate text-[11px] text-ink-mute">{d.catatan}</span>}</td>
                  <td className="whitespace-nowrap px-3">{d.kategori}</td>
                  {c.pt && <td className="px-3">{d.pt}</td>}{c.orang && <td className="whitespace-nowrap px-3">{nama(d.user_id)}</td>}{c.pasangan && <td className="px-3">{d.pasangan || '—'}</td>}
                  {c.nomor && <td className="px-3">{d.nomor || '—'}</td>}{c.penerbit && <td className="px-3">{d.penerbit || '—'}</td>}
                  {c.bahasa && <td className="px-3">{d.bahasa || '—'}</td>}{c.versi && <td className="px-3">{d.versi || '—'}</td>}{c.berlaku && <td className="whitespace-nowrap px-3">{tgl(d.berlaku)}</td>}{c.pj && <td className="px-3">{d.pj || '—'}</td>}
                  {c.terbit && <td className="whitespace-nowrap px-3">{tgl(d.terbit)}</td>}
                  {c.kedaluwarsa && <td className="whitespace-nowrap px-3"><span className={cx('rounded px-1.5 py-0.5 text-[11px] font-semibold', b.cls)} data-status-berlaku={b.k}>{b.label}</span>{d.kedaluwarsa && <span className="block text-[10px] text-ink-mute">s.d. {tgl(d.kedaluwarsa)}</span>}</td>}
                  <td className="whitespace-nowrap px-3 text-ink-soft">{ukuran(d.file?.size)}</td>
                  <td className="whitespace-nowrap px-3 text-[11px] text-ink-mute">{d.updated_by || '—'}<br />{tanggalJam(d.updated_at_local || d.updated_at)}</td>
                  <td className="whitespace-nowrap px-4 text-right">
                    {d.file && <><button type="button" onClick={() => pratinjau(d)} title="Pratinjau" aria-label={`Pratinjau ${d.nama}`} className="inline-grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100"><Eye className="h-4 w-4" /></button>
                      {bisaUnduh(user, d) ? <button type="button" onClick={() => unduh(d)} title="Unduh" aria-label={`Unduh ${d.nama}`} data-aksi="unduh-dok" className="inline-grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100"><Download className="h-4 w-4" /></button>
                        : <span title="Hanya bisa dilihat — unduh dibatasi" className="inline-grid h-9 w-9 place-items-center text-slate-300"><Lock className="h-4 w-4" /></span>}</>}
                    {kelola && <button type="button" onClick={() => setForm(d)} title="Ubah" aria-label={`Ubah ${d.nama}`} className="inline-grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100"><Pencil className="h-4 w-4" /></button>}
                  </td>
                </tr>) })}
              {!rows.length && <tr><td colSpan={20} className="px-4 py-8 text-center text-ink-mute">Tidak ada dokumen sesuai pencarian.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {form && <FormDok jenis={jenis} awal={form.id ? form : null} onClose={() => setForm(null)} />}
    </Card>
  )
}

// ============================================================
//  RINGKASAN
// ============================================================
function EditProfil({ row, onClose }) {
  const { user, save, notify } = useApp()
  const [v, setV] = useState({ ...PROFIL_AWAL, ...(row || {}) })
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }))
  const simpan = async () => {
    await save('app_settings', { ...(row || {}), ...v, key: 'perusahaan', updated_by: user.name, updated_at_local: new Date().toISOString() })
    notify('Profil perusahaan disimpan'); onClose()
  }
  return (
    <Sheet open side onClose={onClose} title="Ubah profil perusahaan" footer={<><span className="flex-1" /><Button onClick={simpan} data-aksi="simpan-profil">Simpan</Button></>}>
      <div className="space-y-3">
        <Field label="Deskripsi singkat"><Textarea value={v.deskripsi || ''} onChange={set('deskripsi')} placeholder="2–3 kalimat tentang perusahaan" /></Field>
        <Field label="Visi"><Textarea value={v.visi || ''} onChange={set('visi')} /></Field>
        <Field label="Misi" hint="Satu poin per baris"><Textarea rows={4} value={v.misi || ''} onChange={set('misi')} /></Field>
        <Field label="Sejarah singkat"><Textarea value={v.sejarah || ''} onChange={set('sejarah')} placeholder="Tahun berdiri & tonggak penting" /></Field>
        <Field label="Alamat kantor pusat"><Input value={v.alamat_pusat || ''} onChange={set('alamat_pusat')} /></Field>
        <Field label="Tautan Google Maps"><Input value={v.maps || ''} onChange={set('maps')} placeholder="https://maps.google.com/…" /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="WhatsApp CS"><Input value={v.wa || ''} onChange={set('wa')} /></Field>
          <Field label="Telepon kantor"><Input value={v.telp || ''} onChange={set('telp')} /></Field>
          <Field label="Email"><Input value={v.email || ''} onChange={set('email')} /></Field>
          <Field label="Jam buka"><Input value={v.jam || ''} onChange={set('jam')} /></Field>
        </div>
      </div>
    </Sheet>
  )
}

function Ringkasan({ ke }) {
  const { user, data } = useApp()
  const kelola = bolehKelolaPerusahaan(user)
  const { unduh } = useBerkas()
  const [edit, setEdit] = useState(false)
  const row = (data.app_settings || []).find((r) => r.key === 'perusahaan')
  const p = { ...PROFIL_AWAL, ...(row || {}) }
  const dok = data.perusahaan_dok || []
  const cp = dok.filter((d) => d.jenis === 'media' && d.kategori === 'Company Profile' && !d.arsip && bisaUnduh(user, d))
    .sort((a, b) => (a.bahasa === 'Indonesia' ? -1 : 1) - (b.bahasa === 'Indonesia' ? -1 : 1) || String(b.updated_at_local || '').localeCompare(String(a.updated_at_local || '')))[0]
  const nOrang = (data.users || []).filter((u) => u.active !== false).length
  const nLegal = dok.filter((d) => d.jenis === 'legal' && !d.arsip).length
  const nUnduh = dok.filter((d) => d.jenis === 'media' && !d.arsip).length
  const wa = String(p.wa || '').replace(/\D/g, '').replace(/^0/, '62')
  const Teks = ({ judul, isi, petunjuk }) => (isi
    ? <div className="rounded-xl bg-slate-50 p-4"><p className="text-[11px] font-bold uppercase tracking-wide text-ink-mute">{judul}</p><p className="mt-1 whitespace-pre-line text-sm text-ink">{isi}</p></div>
    : <Kosong judul={judul} petunjuk={petunjuk} aksi={kelola ? 'Isi sekarang' : null} onAksi={() => setEdit(true)} />)
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-4">
        <Card className="p-4 sm:p-6">
          <div className="flex flex-wrap items-start gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white ring-1 ring-slate-200 sm:h-20 sm:w-20"><img src={logo247} alt="Logo 247" className="h-12 w-12 object-contain sm:h-14 sm:w-14" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-wide text-ink-mute">Nama resmi</p>
              <h2 className="text-xl font-extrabold text-ink sm:text-2xl">{NAMA_RESMI}</h2>
              <p className="mt-0.5 text-sm text-ink-soft">Merek: {MEREK.map((m, i) => <span key={m}>{i ? ' · ' : ''}{i === 0 ? <b className="text-ink">{m}</b> : m}</span>)}</p>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold">{LAYANAN.map((l, i) => <span key={l} className={cx('rounded-full px-2.5 py-1', ['bg-sky-50 text-sky-700', 'bg-amber-50 text-amber-700', 'bg-violet-50 text-violet-700'][i])}>{l}</span>)}</div>
            </div>
            <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
              <button type="button" disabled={!cp} onClick={() => cp && unduh(cp)} data-aksi="unduh-cp"
                className={cx('flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold', cp ? 'bg-ink text-white hover:bg-ink/90' : 'cursor-not-allowed bg-slate-100 text-slate-400')}>
                <Download className="h-4 w-4" />Download Company Profile
              </button>
              {!cp && <button type="button" onClick={() => ke('media')} className="text-[11px] text-ink-mute">Belum diunggah · <u className="text-brand">Company Profile &amp; Media</u></button>}
              {kelola && <Button size="sm" variant="outline" onClick={() => setEdit(true)} data-aksi="ubah-profil"><Pencil className="h-3.5 w-3.5" />Ubah</Button>}
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Teks judul="Deskripsi singkat" isi={p.deskripsi} petunjuk="Tulis 2–3 kalimat tentang perusahaan." />
            <Teks judul="Sejarah singkat" isi={p.sejarah} petunjuk="Tahun berdiri & tonggak penting." />
            <Teks judul="Visi" isi={p.visi} />
            <Teks judul="Misi" isi={p.misi} petunjuk="Boleh berupa poin." />
          </div>
          <p className="mt-4 text-[11px] text-ink-mute">Terakhir diperbarui: {row?.updated_by ? `${row.updated_by} · ${tanggalJam(row.updated_at_local || row.updated_at)}` : '—'} · Hanya Superadmin / Direktur yang bisa mengubah</p>
        </Card>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[['struktur', '🧭', 'Struktur Organisasi', `${nOrang} orang · dari data karyawan`], ['kantor', '📍', 'Kantor & Cabang', `1 pusat · ${BRANCHES.length - 1} cabang`],
            ['legal', '⚖️', 'Legalitas', nLegal ? `${nLegal} dokumen` : '0 dokumen · perlu diisi'], ['media', '⤓', 'Pusat Unduhan', nUnduh ? `${nUnduh} file` : 'Company profile, brosur, logo']].map(([k, ic, j, s]) => (
            <button key={k} type="button" onClick={() => ke(k)} className="rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200 hover:ring-brand">
              <p className="text-2xl">{ic}</p><p className="mt-2 font-bold text-ink">{j}</p><p className={cx('text-xs', /perlu/.test(s) ? 'text-amber-600' : 'text-ink-mute')}>{s}</p>
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <Card className="p-5 text-[13px]">
          <p className="text-[11px] font-bold uppercase tracking-wide text-ink-mute">Kantor pusat</p>
          <p className="mt-1 font-bold text-ink">Kantor Pusat {PUSAT}</p>
          <p className="text-ink-soft">{p.alamat_pusat || <i className="text-ink-mute">alamat belum diisi</i>}</p>
          <a href={p.maps || `https://www.google.com/maps/search/${encodeURIComponent(p.alamat_pusat || '')}`} target="_blank" rel="noreferrer" className="mt-1 inline-flex min-h-[32px] items-center gap-1 text-xs font-semibold text-brand"><MapPin className="h-3.5 w-3.5" />Buka di Google Maps</a>
          <div className="mt-2 space-y-1.5 border-t border-slate-100 pt-3">
            <p className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-ink-mute" />WhatsApp CS {p.wa ? <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="ml-auto font-bold text-ink">{p.wa}</a> : <i className="ml-auto text-ink-mute">belum diisi</i>}</p>
            <p className="flex items-center gap-2"><Clock className="h-4 w-4 text-ink-mute" />Jam buka {p.jam ? <b className="ml-auto">{p.jam}</b> : <i className="ml-auto text-ink-mute">belum diisi</i>}</p>
            <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-ink-mute" />Email {p.email ? <b className="ml-auto">{p.email}</b> : <i className="ml-auto text-ink-mute">belum diisi</i>}</p>
            <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-ink-mute" />Telepon kantor {p.telp ? <b className="ml-auto">{p.telp}</b> : <i className="ml-auto text-ink-mute">belum diisi</i>}</p>
          </div>
        </Card>
        <Card className="p-5 text-[13px]">
          <p className="text-[11px] font-bold uppercase tracking-wide text-ink-mute">Entitas dalam grup</p>
          <ul className="mt-2 space-y-1.5">{SUMBER_DANA.map((x) => <li key={x.code}>{x.name}{x.name === NAMA_RESMI && <span className="ml-1 rounded bg-ink px-1.5 text-[10px] font-bold text-white">UTAMA</span>}</li>)}</ul>
          <p className="mt-2 text-[11px] text-ink-mute">Legalitas tiap PT dipisah di tab Legalitas.</p>
        </Card>
      </div>
      {edit && <EditProfil row={row} onClose={() => setEdit(false)} />}
    </div>
  )
}

// ============================================================
//  STRUKTUR ORGANISASI — dari data pengguna
// ============================================================
const atasanOtomatis = (u, users) => {
  if (u.atasan_id) return users.find((x) => x.id === u.atasan_id)
  const dir = users.find((x) => x.role === 'direktur')
  if (['admin_pusat', 'supervisor', 'akunting'].includes(u.role)) return dir
  if (['cs', 'helper', 'staf_apostille'].includes(u.role)) return users.find((x) => x.role === 'supervisor' && branchesOf(x).includes(u.branch)) || dir
  if (['penerjemah', 'proofreader', 'otorisator'].includes(u.role)) return users.find((x) => x.role === 'supervisor') || dir
  return null
}

function Struktur() {
  const { user, data, save, notify } = useApp()
  const kelola = bolehKelolaPerusahaan(user)
  const [mode, setMode] = useState('bagan')
  const [cabang, setCabang] = useState('')
  const [pilih, setPilih] = useState(null)
  const users = (data.users || []).filter((u) => u.active !== false && u.role !== 'superadmin')
  const diCabang = (u) => !cabang || branchesOf(u).includes(cabang)
  const peranGrup = (r) => users.filter((u) => u.role === r && diCabang(u))
  const dir = peranGrup('direktur')
  const lapis2 = [['admin_pusat', 'Admin Pusat'], ['supervisor', 'Supervisor'], ['akunting', 'Akunting']].map(([r, l]) => ({ l, list: peranGrup(r) })).filter((g) => g.list.length)
  const produksi = users.filter((u) => ['penerjemah', 'proofreader', 'otorisator'].includes(u.role) && diCabang(u))
  const csCabang = BRANCHES.map((c) => ({ c, list: users.filter((u) => ['cs', 'helper', 'staf_apostille'].includes(u.role) && u.branch === c) })).filter((g) => g.list.length && (!cabang || g.c === cabang))
  const p = pilih && (data.users || []).find((u) => u.id === pilih)
  const Nama = ({ u }) => <button type="button" onClick={() => setPilih(u.id)} className="rounded px-0.5 text-left hover:bg-brand-soft hover:text-brand">{namaPendek(u.name)}</button>
  return (
    <Card className="p-4 sm:p-6" data-struktur>
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <span className="flex rounded-lg bg-slate-100 p-0.5 font-semibold" role="group" aria-label="Tampilan">
          {[['bagan', 'Bagan'], ['daftar', 'Daftar']].map(([k, l]) => <button key={k} type="button" onClick={() => setMode(k)} aria-pressed={mode === k} className={cx('min-h-[36px] rounded-md px-3', mode === k ? 'bg-white shadow-sm' : 'text-ink-soft')}>{l}</button>)}
        </span>
        <select value={cabang} onChange={(e) => setCabang(e.target.value)} aria-label="Cabang" className="h-10 rounded-lg border-0 pl-3 pr-8 text-[13px] ring-1 ring-slate-200"><option value="">Cabang: semua</option>{BRANCHES.map((b) => <option key={b}>{b}</option>)}</select>
        <span className="ml-auto text-xs text-ink-mute">Klik nama → kontak kerja</span>
      </div>
      {mode === 'bagan' ? (
        <div className="mt-5 space-y-4 text-[12.5px]">
          <div className="flex flex-wrap justify-center gap-2">{dir.length ? dir.map((u) => (
            <button key={u.id} type="button" onClick={() => setPilih(u.id)} className="flex items-center gap-2 rounded-xl bg-ink p-3 text-left text-white"><Avatar user={u} size={40} ring={false} /><span><b>{namaPendek(u.name)}</b><span className="block text-[11px] text-white/70">Direktur · {u.branch}</span></span></button>
          )) : <Kosong kecil judul="Direktur" petunjuk="Tambahkan pengguna berperan Direktur di Pengaturan → Pengguna." />}</div>
          <div className="mx-auto h-4 w-0.5 bg-slate-300" />
          <div className="grid gap-2 border-t-2 border-slate-200 pt-4 sm:grid-cols-2 xl:grid-cols-4">
            {lapis2.map((g) => <div key={g.l} className={cx('rounded-xl bg-white p-3 ring-1', g.l === 'Supervisor' ? 'ring-violet-200' : 'ring-slate-200')}><p className="text-[10px] font-bold uppercase text-ink-mute">{g.l}</p>{g.list.map((u) => <p key={u.id} className="font-bold"><Nama u={u} />{g.l === 'Supervisor' && <span className="ml-1 text-[10px] font-normal text-ink-mute">{branchesOf(u).join(' · ')}</span>}</p>)}</div>)}
            {produksi.length > 0 && <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200"><p className="text-[10px] font-bold uppercase text-ink-mute">Produksi terjemahan</p><p className="flex flex-wrap gap-x-1">{produksi.map((u, i) => <span key={u.id}>{i ? '·' : ''}<Nama u={u} /></span>)}</p></div>}
          </div>
          <div className="grid gap-2 border-t-2 border-slate-200 pt-4 sm:grid-cols-3 xl:grid-cols-5">
            {csCabang.map((g) => (
              <div key={g.c} className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200"><p className="text-[10px] font-bold uppercase text-ink-mute">Tim {g.c}</p>
                <p className="flex flex-wrap gap-x-1">{g.list.map((u, i) => <span key={u.id}>{i ? '·' : ''}<Nama u={u} /></span>)}</p>
                {g.list.filter((u) => u.coordinator_lang).map((u) => <p key={u.id} className="mt-1 text-[10px] text-violet-600">{namaPendek(u.name)}: koordinator {u.coordinator_lang}</p>)}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto"><table className="w-full text-[13px]"><thead className="bg-slate-50 text-left text-[10.5px] uppercase tracking-wide text-ink-mute"><tr><th className="px-3 py-2">Nama</th><th className="px-3">Jabatan</th><th className="px-3">Cabang</th><th className="px-3">Atasan</th><th className="px-3">Email kerja</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{users.filter(diCabang).sort((a, b) => a.name.localeCompare(b.name)).map((u) => (
            <tr key={u.id}><td className="px-3 py-2"><span className="flex items-center gap-2"><Avatar user={u} size={26} ring={false} /><Nama u={u} /></span></td><td className="px-3">{ROLES[u.role]?.label || u.role}</td><td className="px-3">{branchesOf(u).join(', ')}</td><td className="px-3">{namaPendek(atasanOtomatis(u, users)?.name) || '—'}</td><td className="px-3 text-ink-soft">{u.email || '—'}</td></tr>
          ))}</tbody></table></div>
      )}
      <p className="mt-4 text-[11px] text-ink-mute">Nama, jabatan, cabang &amp; foto diambil dari data pengguna (tidak perlu input ulang). Atasan otomatis mengikuti peran: CS → Supervisor cabang → Direktur{kelola ? '; bisa diubah per orang lewat kartu kontak.' : '.'}</p>
      {p && (
        <Sheet open onClose={() => setPilih(null)} title={namaPendek(p.name)} subtitle={`${ROLES[p.role]?.label || p.role} · ${branchesOf(p).join(', ')}`}>
          <div className="space-y-2 text-sm" data-kontak>
            <div className="flex items-center gap-3"><Avatar user={p} size={56} ring={false} /><div><p className="font-bold">{p.name}</p><p className="text-xs text-ink-mute">Atasan: {namaPendek(atasanOtomatis(p, users)?.name) || '—'}</p></div></div>
            <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-ink-mute" />{p.email ? <a href={`mailto:${p.email}`} className="text-brand">{p.email}</a> : <i className="text-ink-mute">email belum diisi</i>}</p>
            <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-ink-mute" />{p.phone || p.doc?.phone ? (p.phone || p.doc.phone) : <i className="text-ink-mute">telepon kerja belum diisi</i>}</p>
            {kelola && (
              <Field label="Atasan langsung">
                <Select value={p.atasan_id || ''} onChange={async (e) => { await save('users', { ...p, atasan_id: e.target.value || null }); notify('Atasan diperbarui') }}>
                  <option value="">Otomatis (ikut peran)</option>{users.filter((u) => u.id !== p.id).map((u) => <option key={u.id} value={u.id}>{namaPendek(u.name)} · {ROLES[u.role]?.label}</option>)}
                </Select>
              </Field>
            )}
          </div>
        </Sheet>
      )}
    </Card>
  )
}

// ============================================================
//  KANTOR & CABANG
// ============================================================
function Kantor() {
  const { user, data, save, notify } = useApp()
  const kelola = bolehKelolaPerusahaan(user)
  const row = (data.app_settings || []).find((r) => r.key === 'kantor_cabang')
  const profil = { ...PROFIL_AWAL, ...((data.app_settings || []).find((r) => r.key === 'perusahaan') || {}) }
  const [edit, setEdit] = useState(null)
  const info = (c) => ({ aktif: true, ...(c === PUSAT ? { alamat: profil.alamat_pusat, wa: profil.wa, jam: profil.jam, maps: profil.maps, telp: profil.telp, email: profil.email } : {}), ...(row?.cabang?.[c] || {}) })
  const users = (data.users || []).filter((u) => u.active !== false)
  const tim = (c) => users.filter((u) => u.branch === c && !['penerjemah', 'proofreader', 'otorisator', 'superadmin'].includes(u.role))
  const simpan = async () => {
    const { c, ...v } = edit
    await save('app_settings', { ...(row || {}), key: 'kantor_cabang', cabang: { ...(row?.cabang || {}), [c]: { ...v, updated_by: user.name, updated_at_local: new Date().toISOString() } } })
    notify(`Data ${c} disimpan`); setEdit(null)
  }
  const nAktif = BRANCHES.filter((c) => info(c).aktif !== false).length
  return (
    <div className="space-y-3" data-kantor>
      <p className="text-sm text-ink-soft">1 kantor pusat · {nAktif - 1} cabang aktif{BRANCHES.length - nAktif ? ` · ${BRANCHES.length - nAktif} nonaktif` : ''}</p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {BRANCHES.map((c) => { const k = info(c); const pic = users.find((u) => u.id === k.pic_id); const wa = String(k.wa || '').replace(/\D/g, '').replace(/^0/, '62'); return (
          <Card key={c} className={cx('p-4 text-[13px]', c === PUSAT && 'ring-2 ring-ink')} data-cabang={c}>
            <div className="flex items-center gap-2"><p className="text-base font-bold">{c}</p>{c === PUSAT && <span className="rounded bg-ink px-1.5 text-[10px] font-bold text-white">KANTOR PUSAT</span>}
              <span className={cx('ml-auto rounded-full px-2 text-[10px] font-bold', k.aktif === false ? 'bg-slate-200 text-ink-soft' : 'bg-emerald-100 text-emerald-700')}>{k.aktif === false ? 'Nonaktif' : 'Aktif'}</span>
              {kelola && <button type="button" onClick={() => setEdit({ c, ...k })} aria-label={`Ubah ${c}`} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100"><Pencil className="h-4 w-4" /></button>}</div>
            {k.nama_kantor && <p className="text-xs text-ink-mute">{k.nama_kantor}</p>}
            <p className="mt-1 text-ink-soft">{k.alamat || <i className="text-ink-mute">Alamat belum diisi</i>}</p>
            <div className="mt-2 space-y-0.5 text-[12px] text-ink-soft">
              <p><Clock className="mr-1 inline h-3.5 w-3.5" />{k.jam || <i className="text-ink-mute">jam buka belum diisi</i>}</p>
              <p><Phone className="mr-1 inline h-3.5 w-3.5" />{k.telp || <i className="text-ink-mute">telepon belum diisi</i>}{k.email ? ` · ${k.email}` : ''}</p>
              <p>PIC: {pic ? namaPendek(pic.name) : <i className="text-ink-mute">belum diisi</i>}</p>
              {tim(c).length > 0 && <p className="text-ink-mute">Tim: {tim(c).map((u) => namaPendek(u.name)).join(', ')}</p>}
            </div>
            {(k.alamat || k.wa) && <div className="mt-3 flex gap-2">
              {k.alamat && <a href={k.maps || `https://www.google.com/maps/search/${encodeURIComponent(k.alamat)}`} target="_blank" rel="noreferrer" className="flex h-10 flex-1 items-center justify-center gap-1 rounded-lg bg-slate-100 text-xs font-semibold"><MapPin className="h-3.5 w-3.5" />Maps</a>}
              {k.wa && <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" className="flex h-10 flex-1 items-center justify-center gap-1 rounded-lg bg-slate-100 text-xs font-semibold"><MessageCircle className="h-3.5 w-3.5" />WhatsApp</a>}
            </div>}
            {!k.alamat && kelola && <button type="button" onClick={() => setEdit({ c, ...k })} className="mt-2 min-h-[32px] text-xs font-semibold text-brand">＋ Lengkapi alamat, jam &amp; PIC</button>}
            {k.updated_by && <p className="mt-2 text-[10px] text-ink-mute">Diperbarui {k.updated_by} · {tanggalJam(k.updated_at_local)}</p>}
          </Card>
        ) })}
      </div>
      {edit && (
        <Sheet open side onClose={() => setEdit(null)} title={`Ubah ${edit.c}`} footer={<><span className="flex-1" /><Button onClick={simpan} data-aksi="simpan-kantor">Simpan</Button></>}>
          <div className="space-y-3">
            <Field label="Nama kantor"><Input value={edit.nama_kantor || ''} onChange={(e) => setEdit({ ...edit, nama_kantor: e.target.value })} placeholder={`Kantor ${edit.c}`} /></Field>
            <Field label="Alamat lengkap"><Textarea value={edit.alamat || ''} onChange={(e) => setEdit({ ...edit, alamat: e.target.value })} /></Field>
            <Field label="Tautan Google Maps"><Input value={edit.maps || ''} onChange={(e) => setEdit({ ...edit, maps: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Telepon"><Input value={edit.telp || ''} onChange={(e) => setEdit({ ...edit, telp: e.target.value })} /></Field>
              <Field label="WhatsApp"><Input value={edit.wa || ''} onChange={(e) => setEdit({ ...edit, wa: e.target.value })} /></Field>
              <Field label="Email"><Input value={edit.email || ''} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
              <Field label="Jam operasional"><Input value={edit.jam || ''} onChange={(e) => setEdit({ ...edit, jam: e.target.value })} placeholder="mis. Senin–Sabtu 08.00–16.00" /></Field>
            </div>
            <Field label="PIC"><Select value={edit.pic_id || ''} onChange={(e) => setEdit({ ...edit, pic_id: e.target.value })}><option value="">— pilih —</option>{users.filter((u) => branchesOf(u).includes(edit.c)).map((u) => <option key={u.id} value={u.id}>{namaPendek(u.name)}</option>)}</Select></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.aktif !== false} onChange={(e) => setEdit({ ...edit, aktif: e.target.checked })} className="h-4 w-4 rounded" />Cabang aktif</label>
          </div>
        </Sheet>
      )}
    </div>
  )
}

// ============================================================
//  HALAMAN
// ============================================================
export default function Perusahaan({ tab: tabAwal }) {
  const [tab, setTab] = useState(TABS.some(([k]) => k === tabAwal) ? tabAwal : 'ringkasan')
  const ref = useRef(null)
  const ke = (k) => { setTab(k); ref.current?.scrollIntoView({ block: 'start' }) }
  return (
    <div className="min-w-0 space-y-4" data-perusahaan ref={ref}>
      <div>
        <p className="text-xs text-ink-mute">Lainnya › <b className="text-ink-soft">Perusahaan</b></p>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">Perusahaan</h1>
      </div>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 text-[13px] font-bold [scrollbar-width:none]" role="tablist">
        {TABS.map(([k, l, I]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={cx('flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] border px-3.5', tab === k ? 'border-[#141B34] bg-[#141B34] text-white' : 'border-[#D9DBE7] bg-white text-[#141B34] hover:border-[#B9BDD0]')}>
            <I className="h-4 w-4" />{l}
          </button>
        ))}
      </div>
      {tab === 'ringkasan' && <Ringkasan ke={ke} />}
      {tab === 'struktur' && <Struktur />}
      {tab === 'kantor' && <Kantor />}
      {tab === 'legal' && <DaftarDok jenis="legal" judul="Legalitas & Perizinan" ikon={Scale} keterangan="Akta, SK pengesahan, NIB, NPWP, izin usaha & sertifikasi setiap PT. Status masa berlaku dihitung otomatis; dokumen tanpa tanggal kedaluwarsa tidak pernah dianggap kedaluwarsa." kosong="Mulai dari Akta Pendirian, SK Kemenkumham, NIB, dan NPWP tiap PT. Unggah PDF hasil scan." />}
      {tab === 'media' && <DaftarDok jenis="media" judul="Company Profile & Media" ikon={FileImage} keterangan="Company profile (Indonesia / Inggris), brosur, logo resmi & panduan merek. Versi terbaru diberi tanda TERBARU; versi lama bisa diarsipkan." kosong="Unggah company profile PDF versi Indonesia dan Inggris, lalu brosur & logo resmi." />}
      {tab === 'kredensial' && <DaftarDok jenis="kredensial" judul="Kredensial & Keanggotaan" ikon={BadgeCheck} keterangan="Kredensial individu penerjemah — dipisah dari legalitas badan usaha. Dokumen pendukung bawaannya Terbatas; penerjemah bersangkutan tetap bisa melihat miliknya." kosong="Catat SK penerjemah tersumpah, pasangan bahasa, sertifikasi, dan keanggotaan profesi tiap penerjemah." />}
      {tab === 'kebijakan' && <DaftarDok jenis="kebijakan" judul="Kebijakan & Pedoman" ikon={BookMarked} keterangan="Peraturan perusahaan, kode etik, kebijakan kerahasiaan & pedoman internal. (Belum ada modul SOP di ATLAS; panduan menjawab pelanggan ada di menu F&Q.)" kosong="Unggah peraturan perusahaan, kode etik, dan kebijakan kerahasiaan beserta versinya." />}
    </div>
  )
}
