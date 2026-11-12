// ============================================================
//  STATUS SERVER SUPABASE — khusus Superadmin.
//  Sumber data:
//   • Cek layanan : permintaan ringan dari browser ini (tidak mengubah
//     data), hasilnya disimpan di riwayat pemantauan (lib/monitor.js).
//   • Aktivitas   : activity_log + riwayat tahap/keuangan (allActivities).
//   • Error       : kegagalan simpan/hapus & error browser yang tercatat.
//   • Online      : denyut kehadiran (users.online_until).
//  Tidak ada angka karangan. Metrik tanpa sumber = "Belum dikonfigurasi".
// ============================================================
import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, Server, ShieldAlert, AlertTriangle, Search, ChevronLeft, ChevronRight, Activity as IkonAktivitas, Database, KeyRound, HardDrive, Radio, Zap, Info } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { MODE } from '../lib/db.js'
import { SUPABASE_URL, SUPABASE_KEY, sb } from '../lib/supabase.js'
import { bacaMonitor, catatMonitor, dengarMonitor, jenisError, LABEL_ERROR } from '../lib/monitor.js'
import { allActivities } from '../lib/activity.js'
import { statusOf as statusOnline } from '../lib/presence.js'
import { invoiceLabel, ROLES } from '../config/access.js'
import { go } from '../lib/router.js'
import { Card, cx } from '../components/ui.jsx'

const TZ = 'Asia/Makassar'
const AMBANG_KUNING = 800
const AMBANG_MERAH = 3000
const INTERVAL = 60_000
const jam = (v) => (v ? new Date(v).toLocaleTimeString('id-ID', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }) : '—')
const jamDetik = (v) => (v ? new Date(v).toLocaleTimeString('id-ID', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—')
const tglJam = (v) => (v ? new Date(v).toLocaleString('id-ID', { timeZone: TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(',', '') : '—')
const hari = (v) => new Date(v).toLocaleDateString('sv-SE', { timeZone: TZ })
const jamKe = (v) => Number(new Date(v).toLocaleString('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).slice(0, 2)) % 24

// ---------- status & warna ----------
const WARNA = {
  normal: { dot: 'bg-emerald-500', teks: 'text-emerald-700', ring: 'ring-emerald-200', label: 'Normal' },
  terganggu: { dot: 'bg-amber-400', teks: 'text-amber-600', ring: 'ring-amber-200', label: 'Terganggu' },
  gagal: { dot: 'bg-rose-500', teks: 'text-rose-600', ring: 'ring-rose-200', label: 'Gagal' },
  abu: { dot: 'bg-slate-300', teks: 'text-ink-mute', ring: 'ring-slate-200', label: 'Belum diketahui' },
}
const Dot = ({ s, className }) => <span className={cx('inline-block h-2.5 w-2.5 shrink-0 rounded-full', WARNA[s]?.dot || WARNA.abu.dot, className)} />

// ---------- daftar layanan yang dipakai Atlas ----------
const FUNGSI = [
  { slug: 'zoho-sync', label: 'zoho-sync', ket: 'Sinkron faktur Zoho' },
  { slug: 'portal-cek', label: 'portal-cek', ket: 'Portal pelanggan' },
  { slug: 'drive-files', label: 'drive-files', ket: 'File Google Drive' },
  { slug: 'set-password', label: 'set-password', ket: 'Fungsi sensitif — tidak dipanggil dari dashboard', tanpaCek: true },
]
const LAYANAN = [
  { key: 'db', label: 'Database / Data API', ikon: Database },
  { key: 'auth', label: 'Authentication', ikon: KeyRound },
  { key: 'storage', label: 'Storage', ikon: HardDrive },
  { key: 'realtime', label: 'Realtime', ikon: Radio },
  ...FUNGSI.map((f) => ({ key: `fn:${f.slug}`, label: `Edge Function · ${f.label}`, ikon: Zap, fn: f })),
]

async function ukur(fn) {
  const t0 = performance.now()
  try { const r = await fn(); return { ok: true, ms: Math.round(performance.now() - t0), ...(r || {}) } }
  catch (e) { return { ok: false, ms: Math.round(performance.now() - t0), kelas: jenisError(e), pesan: String(e?.message || e).slice(0, 160) } }
}
const timeout = (p, ms = 8000) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('Waktu habis (timeout)'), { status: 504 })), ms))])
const cekHttp = async (url, init) => { const r = await timeout(fetch(url, init)); if (!r.ok && r.status >= 400) throw Object.assign(new Error(`HTTP ${r.status}`), { status: r.status }); return { http: r.status } }

/** Jalankan satu putaran cek (live). Ringan & tidak mengubah data bisnis. */
async function putaranCek(liveStatus) {
  const h = { apikey: SUPABASE_KEY }
  const hasil = {}
  hasil.db = await ukur(async () => { const { error, status } = await timeout(sb().from('app_settings').select('key').limit(1)); if (error) throw Object.assign(new Error(error.message), { status, code: error.code }) })
  hasil.auth = await ukur(() => cekHttp(`${SUPABASE_URL}/auth/v1/health`, { headers: h }))
  hasil.storage = await ukur(async () => { const { error } = await timeout(sb().storage.from('files').list('', { limit: 1 })); if (error) throw Object.assign(new Error(error.message), { status: error.statusCode ? Number(error.statusCode) : 0 }) })
  const rt = String(liveStatus || '')
  hasil.realtime = rt === 'SUBSCRIBED' ? { ok: true, ms: null, ket: 'Langganan aktif' }
    : rt === 'POLLING' ? { ok: false, kelas: 'layanan', ms: null, pesan: 'Realtime tidak tersambung — Atlas memakai muat ulang berkala' }
    : rt ? { ok: false, kelas: 'layanan', ms: null, pesan: `Status realtime: ${rt}` } : { ok: null, ms: null, pesan: 'Belum ada status langganan' }
  for (const f of FUNGSI) {
    if (f.tanpaCek) { hasil[`fn:${f.slug}`] = { ok: null, ms: null, pesan: f.ket }; continue }
    // OPTIONS (preflight) — fungsi menjawab tanpa menjalankan logikanya
    hasil[`fn:${f.slug}`] = await ukur(() => cekHttp(`${SUPABASE_URL}/functions/v1/${f.slug}`, { method: 'OPTIONS', headers: h }))
  }
  return hasil
}

/** Status satu layanan dari hasil cek terakhir + riwayat. */
function nilaiStatus(r, riwayat) {
  if (!r || r.ok === null || r.ok === undefined) return 'abu'
  if (!r.ok) {
    const gagalBeruntun = riwayat.slice(-3).every((x) => x && x.ok === false)
    return r.kelas === 'izin' ? 'terganggu' : gagalBeruntun ? 'gagal' : 'terganggu'
  }
  if (r.ms != null && r.ms > AMBANG_MERAH) return 'gagal'
  if (r.ms != null && r.ms > AMBANG_KUNING) return 'terganggu'
  return 'normal'
}
const ringkasMasalah = (r, st) => {
  if (!r || r.ok === null || r.ok === undefined) return r?.pesan || 'Belum ada pemeriksaan'
  if (r.ok) return st === 'normal' ? (r.ket || 'Menjawab normal') : `Lambat (${r.ms} ms)`
  return `${LABEL_ERROR[r.kelas] || 'Gagal'}: ${r.pesan}`
}

// ---------- modul & tindakan untuk aktivitas ----------
const MODUL_TABEL = { projects: 'Project', users: 'Pengguna & peran', app_settings: 'Pengaturan', people: 'Kontak & vendor', faq: 'F&Q', jadwal: 'Jadwal', cuti: 'Jadwal', perusahaan_dok: 'Perusahaan', mitra: 'Mitra', daftar_harga: 'Katalog', couriers: 'Kurir', share_links: 'Portal', auth: 'Login', affidavit_stok: 'Affidavit', affidavit_pakai: 'Affidavit', affidavit_kirim: 'Affidavit', kapasitas: 'Penugasan', pings: 'Notifikasi', notifications: 'Notifikasi', requests: 'Keuangan', petty_cash: 'Keuangan', vendor_bills: 'Keuangan', notes: 'Catatan', todos: 'Agenda', reminders: 'Agenda' }
const modulDari = (a) => (a.kind === 'stage' ? 'Project' : a.kind === 'finance' || a.kind === 'petty' ? 'Keuangan' : a.kind === 'login' ? 'Login' : a.kind === 'akses' ? 'Pengguna & peran' : MODUL_TABEL[a.table] || (a.kind === 'project' ? 'Project' : 'Pengaturan'))
const AKSI_KODE = { hantu_on: 'Mode hantu dinyalakan', hantu_off: 'Mode hantu dimatikan', persona_on: 'Bertindak sebagai persona', persona_off: 'Persona dimatikan' }
function tindakanDari(a) {
  const t = String(a.action || '')
  if (a.kind === 'login') return 'Login'
  if (a.kind === 'akses') return 'Ubah hak akses'
  if (/penerjemah|ditugaskan|tugaskan|pilih penerjemah/i.test(t)) return 'Penugasan'
  if (/upload|unggah/i.test(t)) return 'Unggah'
  if (/hapus|menghapus/i.test(t)) return 'Hapus'
  if (a.kind === 'stage' || /→/.test(t)) return 'Ubah status'
  if (/^(membuat|menambah)/i.test(t)) return 'Tambah'
  return 'Ubah'
}

// ============================================================
export default function StatusServer() {
  const { user, data, liveStatus } = useApp()
  const live = MODE === 'supabase'
  const [demoSim, setDemoSim] = useState('asli') // hanya mode demo: pratinjau tampilan
  const [monitor, setMonitor] = useState(bacaMonitor)
  const [sedang, setSedang] = useState(false)
  const [gagalAmbil, setGagalAmbil] = useState(false)
  const [terakhirOk, setTerakhirOk] = useState(() => [...bacaMonitor()].reverse().find((x) => x.jenis === 'cek')?.at || null)
  useEffect(() => dengarMonitor(() => setMonitor(bacaMonitor())), [])

  const jalankan = useCallback(async () => {
    if (!live) return
    setSedang(true)
    try {
      const hasil = await putaranCek(liveStatus)
      const semuaGagal = Object.values(hasil).filter((r) => r.ok !== null && r.ok !== undefined).every((r) => !r.ok)
      catatMonitor({ jenis: 'cek', hasil })
      setGagalAmbil(semuaGagal); if (!semuaGagal) setTerakhirOk(new Date().toISOString())
    } finally { setSedang(false) }
  }, [live, liveStatus])

  // cek berkala — berhenti saat tab tidak aktif, dibersihkan saat keluar
  useEffect(() => {
    if (!live) return
    let t = null
    const mulai = () => { if (t) return; jalankan(); t = setInterval(jalankan, INTERVAL) }
    const henti = () => { clearInterval(t); t = null }
    const vis = () => (document.hidden ? henti() : mulai())
    vis(); document.addEventListener('visibilitychange', vis)
    return () => { henti(); document.removeEventListener('visibilitychange', vis) }
  }, [live]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- simulasi (demo saja, ditandai jelas) ----------
  const cekList = useMemo(() => {
    const asli = monitor.filter((x) => x.jenis === 'cek')
    if (live || demoSim === 'asli') return asli
    const now = Date.now()
    return Array.from({ length: 24 }, (_, i) => {
      const at = new Date(now - (23 - i) * 3600e3).toISOString()
      const akhir = i >= 21
      const h = {}
      for (const l of LAYANAN) {
        if (l.fn?.tanpaCek) { h[l.key] = { ok: null, pesan: l.fn.ket }; continue }
        const ms = 90 + ((i * 37 + l.key.length * 11) % 160)
        if (demoSim === 'gagal' && akhir) h[l.key] = { ok: false, ms, kelas: 'koneksi', pesan: 'Failed to fetch' }
        else if (demoSim === 'gangguan' && l.key === 'realtime' && akhir) h[l.key] = { ok: false, kelas: 'layanan', pesan: 'Status realtime: CHANNEL_ERROR' }
        else if (demoSim === 'gangguan' && l.key === 'db' && i === 23) h[l.key] = { ok: true, ms: 1240 }
        else h[l.key] = { ok: true, ms: l.key === 'realtime' ? null : ms, ket: l.key === 'realtime' ? 'Langganan aktif' : undefined }
      }
      return { at, jenis: 'cek', hasil: h, sim: true }
    })
  }, [monitor, live, demoSim])
  const errorList = useMemo(() => {
    const asli = monitor.filter((x) => x.jenis === 'error' || x.jenis === 'login_gagal')
    if (live || demoSim === 'asli' || demoSim === 'normal') return asli
    const now = Date.now()
    return [...asli, ...[3, 2, 1].map((n) => ({ at: new Date(now - n * 1800e3).toISOString(), jenis: 'error', sumber: 'simpan', tabel: 'pings', op: 'tambah', kelas: 'izin', pesan: 'new row violates row-level security policy (SIMULASI)', by: 'Emma (CS Yogyakarta)', sim: true }))]
  }, [monitor, live, demoSim])
  const sim = !live && demoSim !== 'asli'
  const gagalTampil = sim ? demoSim === 'gagal' : gagalAmbil

  const terakhir = cekList[cekList.length - 1]
  const statusLayanan = LAYANAN.map((l) => {
    const r = terakhir?.hasil?.[l.key]
    const riw = cekList.map((c) => c.hasil?.[l.key]).filter(Boolean)
    const st = nilaiStatus(r, riw)
    const ok = riw.filter((x) => x.ok === true).length; const n = riw.filter((x) => x.ok === true || x.ok === false).length
    return { ...l, r, st, uptime: n >= 5 ? Math.round((ok / n) * 1000) / 10 : null, nCek: n, at: terakhir?.at }
  })
  const pertama = cekList[0]?.at
  const nTerganggu = statusLayanan.filter((s) => s.st === 'terganggu' || s.st === 'gagal').length
  const koneksi = !terakhir ? 'abu' : gagalTampil ? 'gagal' : statusLayanan[0].st

  // ---------- aktivitas ----------
  const aktivitas = useMemo(() => {
    const base = allActivities(data).map((a) => ({ ...a, modul: modulDari(a), tindakan: tindakanDari(a), aksiTeks: AKSI_KODE[a.action] || a.action, hasil: a.hasil || 'berhasil' }))
    const gagal = errorList.filter((e) => e.jenis === 'login_gagal' || e.sumber === 'simpan').map((e, i) => ({
      id: `m:${i}:${e.at}`, at: e.at, by: e.by || (e.jenis === 'login_gagal' ? e.akun : '—'), modul: e.jenis === 'login_gagal' ? 'Login' : MODUL_TABEL[e.tabel] || e.tabel,
      tindakan: e.jenis === 'login_gagal' ? 'Login' : e.op === 'hapus' ? 'Hapus' : e.op === 'tambah' ? 'Tambah' : 'Ubah', aksiTeks: e.jenis === 'login_gagal' ? 'Login gagal' : `Gagal menyimpan — ${LABEL_ERROR[e.kelas]}`, ref: e.tabel || '', hasil: 'gagal', sim: e.sim,
    }))
    return [...base, ...gagal].sort((a, b) => String(b.at).localeCompare(String(a.at)))
  }, [data, errorList])

  const now = Date.now()
  const hariIni = hari(now)
  const aktHariIni = aktivitas.filter((a) => hari(a.at) === hariIni)
  const aktifHariIni = new Set(aktHariIni.filter((a) => a.hasil !== 'gagal').map((a) => a.by).filter(Boolean)).size
  const online = (data.users || []).filter((u) => statusOnline(u, now) !== 'offline').length
  const err24 = errorList.filter((e) => now - new Date(e.at) < 864e5)
  const dataTerakhir = aktivitas.find((a) => a.hasil !== 'gagal')?.at

  // ---------- peringatan (digabung) ----------
  const peringatan = useMemo(() => {
    const out = []
    for (const s of statusLayanan) {
      const riw = cekList.map((c) => c.hasil?.[s.key]).filter((x) => x && x.ok !== null && x.ok !== undefined)
      const gagal = riw.filter((x) => !x.ok)
      let beruntun = 0; for (let i = riw.length - 1; i >= 0 && riw[i].ok === false; i--) beruntun++
      if (beruntun >= 3) out.push({ lv: 'penting', judul: `${s.label}: gagal ${beruntun}× berturut`, kondisi: s.r?.pesan, saran: s.r?.kelas === 'koneksi' ? 'Periksa internet perangkat/kantor ini dulu.' : s.r?.kelas === 'izin' ? 'Periksa aturan RLS / peran pengguna.' : 'Cek status.supabase.com; bila semua layanan gagal, kemungkinan gangguan Supabase.', n: beruntun, at: cekList[cekList.length - 1]?.at })
      else if (gagal.length >= 2) out.push({ lv: 'perhatian', judul: `${s.label}: ${gagal.length}× gagal dalam riwayat`, kondisi: s.st === 'normal' ? 'Sekarang sudah normal' : s.r?.pesan, saran: 'Abaikan bila tidak berulang.', n: gagal.length, at: cekList.findLast?.((c) => c.hasil?.[s.key]?.ok === false)?.at })
      const lambat = riw.filter((x) => x.ok && x.ms > AMBANG_KUNING)
      if (lambat.length) out.push({ lv: 'perhatian', judul: `${s.label}: respons lambat`, kondisi: `${lambat.length}× di atas ${AMBANG_KUNING} ms (tertinggi ${Math.max(...lambat.map((x) => x.ms))} ms)`, saran: 'Bila terus berulang, periksa query berat atau jaringan.', n: lambat.length })
    }
    const errMinggu = errorList.filter((e) => now - new Date(e.at) < 7 * 864e5 && now - new Date(e.at) >= 864e5).length / 6
    if (err24.length >= 3 && err24.length >= 2 * Math.max(1, errMinggu)) {
      const per = {}; err24.forEach((e) => { const k = `${e.kelas}|${e.tabel || e.sumber}`; per[k] = (per[k] || 0) + 1 })
      const [k, n] = Object.entries(per).sort((a, b) => b[1] - a[1])[0]
      const [kelas, tbl] = k.split('|')
      out.push({ lv: 'perhatian', judul: `Error naik: ${err24.length} dalam 24 jam`, kondisi: `Terbanyak: ${LABEL_ERROR[kelas]} · ${tbl} (${n}×)`, saran: kelas === 'izin' ? `Periksa aturan RLS tabel ${tbl}.` : 'Lihat daftar aktivitas dengan filter Hasil = Gagal.', n: err24.length, at: err24[err24.length - 1]?.at })
    }
    const sensitif = aktivitas.filter((a) => a.kind === 'akses' && a.tindakan === 'Ubah hak akses' && now - new Date(a.at) < 7 * 864e5)
    const grup = {}
    sensitif.forEach((a) => { const k = `${a.aksiTeks}`.replace(/:.*/, ''); (grup[k] ||= []).push(a) })
    Object.values(grup).forEach((list) => {
      const a = list[0]; const superadmin = /superadmin/i.test(a.aksiTeks) || /hantu/i.test(a.action)
      out.push({ lv: superadmin ? 'penting' : 'perhatian', judul: AKSI_KODE[a.action] || a.aksiTeks, kondisi: `oleh ${a.by}${list.length > 1 ? ` · ${list.length}× dalam 7 hari` : ''}`, saran: 'Pastikan perubahan hak akses ini memang disengaja.', n: list.length, at: a.at })
    })
    return out.sort((a, b) => (a.lv === 'penting' ? -1 : 1) - (b.lv === 'penting' ? -1 : 1) || String(b.at || '').localeCompare(String(a.at || '')))
  }, [cekList, errorList, aktivitas]) // eslint-disable-line react-hooks/exhaustive-deps

  if (user?.role !== 'superadmin') return <Card className="p-8 text-center text-sm text-ink-mute">Halaman ini khusus Superadmin.</Card>

  const ringkasan = !terakhir ? { s: 'abu', t: live ? 'Menunggu pemeriksaan pertama' : 'Mode demo — tidak tersambung ke Supabase' }
    : gagalTampil ? { s: 'gagal', t: 'Atlas tidak bisa menghubungi Supabase' } : nTerganggu ? { s: 'terganggu', t: `${nTerganggu} layanan perlu perhatian` } : { s: 'normal', t: 'Semua layanan yang dicek normal' }
  const Kartu = ({ judul, isi, sub, s = 'abu', redup, tag }) => (
    <div className={cx('rounded-2xl bg-white p-3.5 ring-1', s === 'abu' && !isi ? 'bg-slate-50 ring-dashed ring-slate-300' : WARNA[s]?.ring || 'ring-slate-200', redup && 'opacity-70')} data-indikator={tag}>
      <p className="text-[11px] font-semibold text-ink-soft">{judul}</p>
      <div className="mt-1 text-lg font-extrabold leading-tight text-ink">{isi ?? <span className="text-sm font-bold text-ink-mute">—</span>}</div>
      {sub && <p className="mt-0.5 text-[10px] text-ink-mute">{sub}</p>}
      {redup && <p className="text-[10px] font-semibold text-amber-600">Data belum diperbarui</p>}
    </div>
  )
  return (
    <div className="min-w-0 space-y-4" data-status-server>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <p className="text-xs text-ink-mute">Superadmin › <b className="text-ink-soft">Status Server Supabase</b></p>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">Status Server Supabase</h1>
        </div>
        <span className={cx('flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ring-1', ringkasan.s === 'normal' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : ringkasan.s === 'terganggu' ? 'bg-amber-50 text-amber-700 ring-amber-200' : ringkasan.s === 'gagal' ? 'bg-rose-50 text-rose-700 ring-rose-200' : 'bg-slate-100 text-ink-soft ring-slate-200')} data-ringkasan={ringkasan.s}><Dot s={ringkasan.s} />{ringkasan.t}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2 text-xs text-ink-soft">
          {live ? <span className="flex items-center gap-1.5"><Dot s="normal" className="animate-pulse" />Pembaruan otomatis · tiap 60 dtk (berhenti saat tab tidak aktif)</span>
            : (
              <label className="flex items-center gap-1.5">Pratinjau:
                <select value={demoSim} onChange={(e) => setDemoSim(e.target.value)} aria-label="Pratinjau kondisi (demo)" className="h-9 rounded-lg border-0 pl-2 pr-7 text-xs ring-1 ring-slate-200" data-demo-sim>
                  <option value="asli">Asli (demo, tidak tersambung)</option><option value="normal">SIMULASI normal</option><option value="gangguan">SIMULASI gangguan</option><option value="gagal">SIMULASI koneksi gagal</option>
                </select></label>
            )}
          <span>· terakhir berhasil {terakhirOk && !sim ? `${jamDetik(terakhirOk)} WITA` : sim ? `${jamDetik(terakhir?.at)} WITA` : '—'}</span>
          <button type="button" onClick={jalankan} disabled={!live || sedang} className="flex min-h-[40px] items-center gap-1 rounded-lg bg-white px-3 font-semibold text-ink ring-1 ring-slate-200 disabled:opacity-50" data-aksi="refresh-server"><RefreshCw className={cx('h-3.5 w-3.5', sedang && 'animate-spin')} />Refresh</button>
        </div>
      </div>
      {sim && <p className="rounded-xl bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-800 ring-1 ring-violet-200" data-banner-sim>SIMULASI — hanya untuk melihat tampilan di demo, bukan data asli. Cek layanan sungguhan berjalan di versi Live.</p>}
      {!live && !sim && <p className="rounded-xl bg-slate-100 px-3 py-2 text-xs text-ink-soft" data-banner-demo><Info className="mr-1 inline h-3.5 w-3.5" />Demo menyimpan data di browser, jadi tidak ada server Supabase yang bisa dicek. Aktivitas, pengguna aktif & error di bawah tetap data asli demo. Pilih “SIMULASI” untuk melihat tampilan cek layanan.</p>}
      {gagalTampil && <div className="rounded-xl bg-rose-50 p-3 text-[13px] ring-1 ring-rose-200" data-banner-gagal><b className="text-rose-700"><AlertTriangle className="mr-1 inline h-4 w-4" />Atlas tidak bisa menghubungi Supabase</b><p className="mt-0.5 text-ink-soft">Semua cek terakhir gagal. Kemungkinan besar internet perangkat ini — belum tentu server Supabase mati. Angka di bawah = data terakhir yang berhasil.</p></div>}

      {/* ---------- indikator ---------- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        <Kartu tag="koneksi" judul="Koneksi Atlas" s={koneksi} isi={terakhir ? <span className={cx('flex items-center gap-1.5', WARNA[koneksi].teks)}><Dot s={koneksi} />{koneksi === 'normal' ? 'Terhubung' : koneksi === 'gagal' ? 'Gagal' : koneksi === 'terganggu' ? 'Terganggu' : 'Belum diketahui'}</span> : null} sub={terakhir ? `cek ${jam(terakhir.at)} WITA` : live ? 'menunggu cek pertama' : 'demo: tidak ada server'} />
        <Kartu tag="respons" judul="Waktu respons" s={statusLayanan[0].st} isi={statusLayanan[0].r?.ms != null && statusLayanan[0].r?.ok ? <>{statusLayanan[0].r.ms} <span className="text-xs font-semibold text-ink-mute">ms</span></> : null} sub={statusLayanan[0].r?.ok ? (statusLayanan[0].r.ms > AMBANG_KUNING ? `lambat (> ${AMBANG_KUNING} ms)` : `normal (< ${AMBANG_KUNING} ms)`) : 'belum ada data'} />
        <Kartu tag="aktif" judul="Pengguna aktif hari ini" s="normal" isi={aktifHariIni} sub={`${online} sedang online`} redup={gagalTampil} />
        <Kartu tag="aktivitas" judul="Aktivitas hari ini" s="normal" isi={aktHariIni.filter((a) => a.hasil !== 'gagal').length} sub="sejak 00.00 WITA" redup={gagalTampil} />
        <Kartu tag="error" judul="Error 24 jam" s={err24.length ? 'terganggu' : 'normal'} isi={<span className={err24.length ? 'text-amber-600' : ''}>{err24.length}</span>} sub={err24.length ? Object.entries(err24.reduce((m, e) => ({ ...m, [e.kelas]: (m[e.kelas] || 0) + 1 }), {})).map(([k, n]) => `${n} ${LABEL_ERROR[k]?.toLowerCase()}`).join(' · ') : 'nol = memang tidak ada error'} />
        <Kartu tag="db" judul="Database terpakai" isi={null} sub="Belum dikonfigurasi · butuh Management API lewat Edge Function" />
        <Kartu tag="storage" judul="Storage terpakai" isi={null} sub="Belum dikonfigurasi · butuh Management API lewat Edge Function" />
        <Kartu tag="terakhir" judul="Data terakhir masuk" s="normal" isi={dataTerakhir ? jam(dataTerakhir) : null} sub={dataTerakhir ? `WITA · ${new Date(dataTerakhir).toLocaleDateString('id-ID', { timeZone: TZ, day: 'numeric', month: 'short' })}` : 'belum ada aktivitas'} />
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-soft"><span><Dot s="normal" /> Normal</span><span><Dot s="terganggu" /> Terganggu / perlu perhatian</span><span><Dot s="gagal" /> Pemeriksaan gagal / tidak terjangkau</span><span><Dot s="abu" /> Belum diketahui / belum ada data</span></p>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* ---------- layanan ---------- */}
        <Card className="min-w-0 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2"><h2 className="font-bold">Kesehatan layanan</h2>
            <span className="ml-auto text-[11px] text-ink-mute">{pertama ? `Uptime dari ${cekList.length} cek tersimpan sejak ${tglJam(pertama)} WITA (perangkat ini)` : 'Uptime muncul setelah minimal 5 cek tersimpan'}</span></div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-[13px]" data-tabel-layanan>
              <thead className="text-left text-[10.5px] uppercase tracking-wide text-ink-mute"><tr><th className="pb-2">Layanan</th><th>Status</th><th>Cek terakhir</th><th className="text-right">Respons</th><th className="text-right">Uptime</th><th className="pl-4">Ringkasan</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {statusLayanan.map((s) => (
                  <tr key={s.key} className={cx(s.st === 'terganggu' && 'bg-amber-50/50', s.st === 'gagal' && 'bg-rose-50/50')} data-layanan={s.key} data-st={s.st}>
                    <td className="whitespace-nowrap py-2.5 font-semibold"><s.ikon className="mr-1.5 inline h-4 w-4 text-ink-mute" />{s.label}</td>
                    <td className="whitespace-nowrap"><span className={cx('flex items-center gap-1.5 font-semibold', WARNA[s.st].teks)}><Dot s={s.st} />{s.r?.ok === null && s.fn?.tanpaCek ? 'Tidak dicek' : WARNA[s.st].label}</span></td>
                    <td className="text-ink-soft">{s.r ? jam(s.at) : '—'}</td>
                    <td className="text-right tabular-nums">{s.r?.ms != null ? `${s.r.ms} ms` : '—'}</td>
                    <td className="text-right tabular-nums">{s.uptime != null ? `${String(s.uptime).replace('.', ',')}%` : '—'}</td>
                    <td className={cx('max-w-[300px] truncate pl-4', s.st === 'normal' ? 'text-ink-soft' : WARNA[s.st].teks)} title={ringkasMasalah(s.r, s.st)}>{ringkasMasalah(s.r, s.st)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-ink-soft">Jenis gangguan dibedakan: <b className="text-rose-600">Koneksi Atlas</b> (internet/perangkat) · <b className="text-amber-600">Izin ditolak</b> (RLS/peran) · <b className="text-rose-600">Layanan Supabase</b> (5xx/timeout berulang). Satu cek gagal tidak langsung dianggap server mati — merah hanya bila gagal 3× berturut. Ambang: &gt; {AMBANG_KUNING} ms kuning, &gt; {AMBANG_MERAH / 1000} dtk merah.</p>
        </Card>

        {/* ---------- peringatan ---------- */}
        <Card className="p-4 sm:p-5" data-peringatan>
          <div className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-ink-mute" /><h2 className="font-bold">Peringatan penting</h2>{peringatan.length > 0 && <span className="rounded-full bg-amber-100 px-2 text-[11px] font-bold text-amber-700">{peringatan.length}</span>}</div>
          <div className="mt-3 space-y-2.5 text-[12.5px]">
            {peringatan.length === 0 && <p className="rounded-xl bg-emerald-50 p-3 text-emerald-800 ring-1 ring-emerald-200">Tidak ada peringatan saat ini.</p>}
            {peringatan.slice(0, 6).map((p, i) => (
              <div key={i} className={cx('rounded-xl p-3 ring-1', p.lv === 'penting' ? 'bg-rose-50 ring-rose-200' : 'bg-amber-50 ring-amber-200')} data-peringatan-lv={p.lv}>
                <div className="flex items-center gap-2"><span className={cx('rounded px-1.5 text-[10px] font-bold text-white', p.lv === 'penting' ? 'bg-rose-600' : 'bg-amber-500')}>{p.lv === 'penting' ? 'PENTING' : 'PERHATIAN'}</span><b className="min-w-0 flex-1 truncate">{p.judul}</b>{p.n > 1 && <span className="rounded-full bg-white px-1.5 text-[10px] font-bold">×{p.n}</span>}<span className="text-[11px] text-ink-mute">{jam(p.at)}</span></div>
                {p.kondisi && <p className="mt-1 text-ink-soft">{p.kondisi}</p>}
                <p className={cx('mt-1 text-[11px]', p.lv === 'penting' ? 'text-rose-700' : 'text-amber-700')}>Saran: {p.saran}</p>
              </div>
            ))}
            <p className="pt-1 text-[11px] text-ink-mute">Kejadian berulang digabung. Tidak ada notifikasi ke luar (email/WA) kecuali diatur khusus.</p>
          </div>
        </Card>
      </div>

      <Grafik aktivitas={aktivitas} errorList={errorList} cekList={cekList} />
      <DaftarAktivitas aktivitas={aktivitas} users={data.users || []} />
    </div>
  )
}

// ============================================================
//  GRAFIK
// ============================================================
function Grafik({ aktivitas, errorList, cekList }) {
  const [periode, setPeriode] = useState('24j')
  const [dari, setDari] = useState('')
  const [sampai, setSampai] = useState('')
  const now = Date.now()
  const rentang = periode === '24j' ? [now - 864e5, now] : periode === '7h' ? [now - 7 * 864e5, now] : periode === '30h' ? [now - 30 * 864e5, now]
    : [dari ? new Date(`${dari}T00:00:00+08:00`).getTime() : now - 7 * 864e5, sampai ? new Date(`${sampai}T23:59:59+08:00`).getTime() : now]
  const perJam = periode === '24j'
  const dalam = (v) => { const t = new Date(v).getTime(); return t >= rentang[0] && t <= rentang[1] }
  const akt = aktivitas.filter((a) => a.hasil !== 'gagal' && dalam(a.at))
  const err = errorList.filter((e) => dalam(e.at))
  // ember: per jam (24) atau per hari
  const ember = useMemo(() => {
    if (perJam) return Array.from({ length: 24 }, (_, i) => { const t = new Date(now - (23 - i) * 3600e3); return { k: `${hari(t)}|${jamKe(t)}`, l: String(jamKe(t)).padStart(2, '0') } })
    const n = Math.min(62, Math.max(1, Math.round((rentang[1] - rentang[0]) / 864e5)))
    return Array.from({ length: n }, (_, i) => { const t = new Date(rentang[1] - (n - 1 - i) * 864e5); return { k: hari(t), l: new Date(t).toLocaleDateString('id-ID', { timeZone: TZ, day: 'numeric', month: 'numeric' }) } })
  }, [periode, dari, sampai]) // eslint-disable-line react-hooks/exhaustive-deps
  const kunci = (v) => (perJam ? `${hari(v)}|${jamKe(v)}` : hari(v))
  const hitung = (list) => { const m = {}; list.forEach((x) => { const k = kunci(x.at); m[k] = (m[k] || 0) + 1 }); return m }
  const nAkt = hitung(akt); const nErr = hitung(err)
  const maxA = Math.max(1, ...ember.map((e) => (nAkt[e.k] || 0) + (nErr[e.k] || 0)))
  const aktifHari = useMemo(() => { const m = {}; akt.forEach((a) => { const k = hari(a.at); (m[k] ||= new Set()).add(a.by) }); return m }, [akt]) // eslint-disable-line react-hooks/exhaustive-deps
  const hariList = perJam ? [hari(now - 864e5), hari(now)].filter((v, i, a) => a.indexOf(v) === i) : ember.map((e) => e.k)
  const maxU = Math.max(1, ...hariList.map((k) => aktifHari[k]?.size || 0))
  const modul = Object.entries(akt.reduce((m, a) => ({ ...m, [a.modul]: (m[a.modul] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1]).slice(0, 7)
  const maxM = Math.max(1, ...modul.map((x) => x[1]))
  const resp = cekList.filter((c) => dalam(c.at) && c.hasil?.db?.ok && c.hasil.db.ms != null).map((c) => ({ at: c.at, ms: c.hasil.db.ms }))
  const maxR = Math.max(AMBANG_KUNING * 1.2, ...resp.map((r) => r.ms))
  const W = 520; const H = 130; const bw = W / ember.length
  return (
    <Card className="p-4 sm:p-5" data-grafik>
      <div className="flex flex-wrap items-center gap-2"><h2 className="font-bold">Grafik pergerakan</h2>
        <span className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold" role="group" aria-label="Periode">
          {[['24j', '24 jam'], ['7h', '7 hari'], ['30h', '30 hari'], ['khusus', 'Rentang khusus']].map(([k, l]) => <button key={k} type="button" onClick={() => setPeriode(k)} aria-pressed={periode === k} className={cx('min-h-[32px] rounded-md px-3', periode === k ? 'bg-white shadow-sm' : 'text-ink-soft')}>{l}</button>)}
        </span>
        {periode === 'khusus' && <span className="flex items-center gap-1 text-xs"><input type="date" value={dari} onChange={(e) => setDari(e.target.value)} aria-label="Dari" className="h-9 rounded-lg border-0 text-xs ring-1 ring-slate-200" />–<input type="date" value={sampai} onChange={(e) => setSampai(e.target.value)} aria-label="Sampai" className="h-9 rounded-lg border-0 text-xs ring-1 ring-slate-200" /></span>}
        <span className="ml-auto text-[11px] text-ink-mute">Zona waktu: WITA (UTC+8)</span></div>
      <div className="mt-4 grid gap-5 lg:grid-cols-4">
        <div className="min-w-0 lg:col-span-2">
          <p className="text-xs font-bold text-ink-soft">Aktivitas per {perJam ? 'jam' : 'hari'} <span className="font-normal text-ink-mute">· {akt.length} aktivitas · merah = error ({err.length})</span></p>
          <svg viewBox={`0 0 ${W} ${H + 16}`} className="mt-2 w-full" role="img" aria-label="Grafik aktivitas">
            {ember.map((e, i) => { const a = nAkt[e.k] || 0; const r = nErr[e.k] || 0; const ha = (a / maxA) * H; const hr = (r / maxA) * H; return (
              <g key={e.k}><title>{`${e.l}: ${a} aktivitas${r ? `, ${r} error` : ''}`}</title>
                <rect x={i * bw + 1} y={H - ha} width={Math.max(1, bw - 2)} height={ha} fill="#6366f1" rx="1.5" />
                {r > 0 && <rect x={i * bw + 1} y={H - ha - hr} width={Math.max(1, bw - 2)} height={hr} fill="#f43f5e" rx="1.5" />}
                {(i % Math.ceil(ember.length / 8) === 0 || i === ember.length - 1) && <text x={i * bw + bw / 2} y={H + 13} fontSize="9" fill="#94a3b8" textAnchor="middle">{e.l}</text>}
              </g>) })}
          </svg>
          {akt.length === 0 && <p className="text-center text-xs text-ink-mute">Belum ada aktivitas tercatat pada periode ini.</p>}
        </div>
        <div>
          <p className="text-xs font-bold text-ink-soft">Aktivitas per modul</p>
          <div className="mt-3 space-y-2 text-[12px]">
            {modul.length ? modul.map(([m, n]) => <div key={m}><div className="flex"><span>{m}</span><span className="ml-auto font-semibold">{n}</span></div><div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-indigo-500" style={{ width: `${(n / maxM) * 100}%` }} /></div></div>)
              : <p className="text-ink-mute">—</p>}
          </div>
        </div>
        <div>
          <p className="text-xs font-bold text-ink-soft">Waktu respons database (ms)</p>
          {resp.length >= 2 ? (
            <svg viewBox="0 0 240 110" className="mt-2 w-full" role="img" aria-label="Tren waktu respons">
              <line x1="0" y1={100 - (AMBANG_KUNING / maxR) * 95} x2="240" y2={100 - (AMBANG_KUNING / maxR) * 95} stroke="#fbbf24" strokeDasharray="4 3" />
              <text x="2" y={96 - (AMBANG_KUNING / maxR) * 95} fontSize="9" fill="#d97706">ambang {AMBANG_KUNING}</text>
              <polyline fill="none" stroke="#10b981" strokeWidth="2" points={resp.map((r, i) => `${(i / (resp.length - 1)) * 240},${100 - (r.ms / maxR) * 95}`).join(' ')} />
            </svg>
          ) : <p className="mt-2 rounded-lg bg-slate-50 p-3 text-xs text-ink-mute">Belum ada cukup hasil cek tersimpan pada periode ini.</p>}
          <p className="mt-2 text-xs font-bold text-ink-soft">Pengguna aktif / hari</p>
          <div className="mt-1 flex h-12 items-end gap-1">
            {hariList.slice(-14).map((k) => <div key={k} title={`${k}: ${aktifHari[k]?.size || 0} pengguna`} className="flex-1 rounded-t bg-indigo-300" style={{ height: `${Math.max(4, ((aktifHari[k]?.size || 0) / maxU) * 100)}%` }} />)}
          </div>
          <p className="mt-1 text-[10px] text-ink-mute">Pengguna aktif = pengguna unik yang melakukan aktivitas pada hari itu.</p>
        </div>
      </div>
    </Card>
  )
}

// ============================================================
//  DAFTAR AKTIVITAS
// ============================================================
const PER_HALAMAN = 25
function DaftarAktivitas({ aktivitas, users }) {
  const [q, setQ] = useState('')
  const [f, setF] = useState({ dari: hari(Date.now()), sampai: '' })
  const [hal, setHal] = useState(1)
  const set = (k) => (e) => { setF((x) => ({ ...x, [k]: e.target.value })); setHal(1) }
  const opsi = (fn) => [...new Set(aktivitas.map(fn).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'id'))
  const s = q.trim().toLowerCase()
  const rows = aktivitas.filter((a) => (!f.dari || hari(a.at) >= f.dari) && (!f.sampai || hari(a.at) <= f.sampai) && (!f.by || a.by === f.by) && (!f.modul || a.modul === f.modul) && (!f.tindakan || a.tindakan === f.tindakan) && (!f.hasil || a.hasil === f.hasil))
    .filter((a) => !s || [a.aksiTeks, a.ref, a.by, a.modul, a.sub].some((x) => String(x || '').toLowerCase().includes(s)))
  const nHal = Math.max(1, Math.ceil(rows.length / PER_HALAMAN))
  const tampil = rows.slice((hal - 1) * PER_HALAMAN, hal * PER_HALAMAN)
  const sel = 'h-9 rounded-lg border-0 pl-2.5 pr-7 text-[12.5px] ring-1 ring-slate-200'
  const peranDari = (nama) => users.find((u) => u.name === nama)
  return (
    <Card className="overflow-hidden" data-aktivitas>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-4 text-[12.5px]">
        <IkonAktivitas className="h-4 w-4 text-ink-mute" /><h2 className="mr-2 text-sm font-bold">Aktivitas terbaru</h2>
        <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"><Dot s="normal" className="!h-2 !w-2" />Diperbarui otomatis</span>
        <label className="relative ml-auto block w-full sm:w-[240px]"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setHal(1) }} placeholder="Cari ringkasan / referensi…" aria-label="Cari aktivitas" className="h-9 w-full rounded-lg border-0 pl-9 pr-3 text-[12.5px] ring-1 ring-slate-200 focus:ring-2 focus:ring-brand" /></label>
        <span className="flex items-center gap-1"><input type="date" value={f.dari} onChange={set('dari')} aria-label="Dari tanggal" className="h-9 rounded-lg border-0 text-[12px] ring-1 ring-slate-200" />–<input type="date" value={f.sampai} onChange={set('sampai')} aria-label="Sampai tanggal" className="h-9 rounded-lg border-0 text-[12px] ring-1 ring-slate-200" /></span>
        <select value={f.by || ''} onChange={set('by')} aria-label="Pengguna" className={sel}><option value="">Pengguna</option>{opsi((a) => a.by).map((x) => <option key={x}>{x}</option>)}</select>
        <select value={f.modul || ''} onChange={set('modul')} aria-label="Modul" className={sel}><option value="">Modul</option>{opsi((a) => a.modul).map((x) => <option key={x}>{x}</option>)}</select>
        <select value={f.tindakan || ''} onChange={set('tindakan')} aria-label="Tindakan" className={sel}><option value="">Tindakan</option>{opsi((a) => a.tindakan).map((x) => <option key={x}>{x}</option>)}</select>
        <select value={f.hasil || ''} onChange={set('hasil')} aria-label="Hasil" className={sel} data-filter-hasil><option value="">Hasil</option><option value="berhasil">Berhasil</option><option value="gagal">Gagal</option></select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead className="bg-slate-50 text-left text-[10.5px] uppercase tracking-wide text-ink-mute"><tr><th className="px-4 py-2">Waktu (WITA)</th><th className="px-3">Pengguna</th><th className="px-3">Modul</th><th className="px-3">Tindakan</th><th className="px-3">Ringkasan</th><th className="px-3">Referensi</th><th className="px-4">Hasil</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {tampil.map((a) => (
              <tr key={a.id} className={cx(a.hasil === 'gagal' && 'bg-amber-50/50', a.kind === 'akses' && 'bg-rose-50/40')} data-baris-aktivitas={a.hasil}>
                <td className="whitespace-nowrap px-4 py-2 text-ink-soft">{tglJam(a.at)}</td>
                <td className="whitespace-nowrap px-3">{a.by || '—'}{peranDari(a.by) && <span className="block text-[10px] text-ink-mute">{ROLES[peranDari(a.by).role]?.label || peranDari(a.by).role}</span>}</td>
                <td className="whitespace-nowrap px-3">{a.modul}</td>
                <td className="whitespace-nowrap px-3"><span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px]">{a.tindakan}</span></td>
                <td className="max-w-[360px] truncate px-3" title={a.aksiTeks}>{a.sub ? <span className="text-ink-mute">{a.sub} · </span> : null}{a.aksiTeks}{a.sim && <span className="ml-1 rounded bg-violet-100 px-1 text-[10px] font-bold text-violet-700">SIMULASI</span>}</td>
                <td className="whitespace-nowrap px-3">{a.project_id ? <button type="button" onClick={() => go(`projects/${a.project_id}`)} className="font-semibold text-brand underline">{invoiceLabel(a.ref) || 'buka'}</button> : <span className="text-ink-mute">{a.ref || '—'}</span>}</td>
                <td className="whitespace-nowrap px-4">{a.hasil === 'gagal' ? <span className="font-semibold text-amber-600">✕ Gagal</span> : <span className="text-emerald-600">✓ Berhasil</span>}</td>
              </tr>
            ))}
            {!tampil.length && <tr><td colSpan={7} className="px-4 py-10 text-center text-ink-mute">{aktivitas.length ? 'Tidak ada aktivitas sesuai filter.' : 'Belum ada aktivitas tercatat. Pencatatan dimulai sejak fitur ini dipasang — riwayat lama tidak dikarang.'}</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-2.5 text-xs text-ink-mute">
        <span>Menampilkan {rows.length ? (hal - 1) * PER_HALAMAN + 1 : 0}–{Math.min(hal * PER_HALAMAN, rows.length)} dari {rows.length} · tanpa password, token, atau isi dokumen pelanggan</span>
        <span className="ml-auto flex items-center gap-1">
          <button type="button" disabled={hal <= 1} onClick={() => setHal((h) => h - 1)} aria-label="Halaman sebelumnya" className="grid h-9 w-9 place-items-center rounded-lg ring-1 ring-slate-200 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
          <span className="px-2">Hal {hal} / {nHal}</span>
          <button type="button" disabled={hal >= nHal} onClick={() => setHal((h) => h + 1)} aria-label="Halaman berikutnya" className="grid h-9 w-9 place-items-center rounded-lg ring-1 ring-slate-200 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
        </span>
      </div>
    </Card>
  )
}
