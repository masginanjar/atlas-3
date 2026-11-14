// ============================================================
//  MODUL PENGIRIMAN — aturan bersama (status, peran, rumus perhatian).
//  Status layanan terjemahan ≠ status pengiriman: yang di sini HANYA status kiriman.
// ============================================================
import { MODE } from './db.js'

/** Tahap internal pengiriman. [label, kelompok tab, kelas warna] — teks selalu ikut (tidak hanya warna). */
export const TAHAP = {
  draft: ['Draft', 'draft', 'bg-slate-100 text-slate-700 ring-slate-200'],
  siap: ['Draft siap dipesan', 'draft', 'bg-slate-100 text-slate-700 ring-slate-200'],
  diproses: ['Permintaan diproses', 'berlangsung', 'bg-amber-50 text-amber-800 ring-amber-200'],
  gagal_order: ['Gagal dibuat', 'draft', 'bg-rose-50 text-rose-700 ring-rose-200'],
  dibuat: ['Order dibuat · menunggu resi', 'berlangsung', 'bg-amber-50 text-amber-800 ring-amber-200'],
  gagal_resi: ['Gagal terbit resi', 'berlangsung', 'bg-rose-50 text-rose-700 ring-rose-200'],
  menunggu_jemput: ['Menunggu dijemput / diantar', 'berlangsung', 'bg-sky-50 text-sky-700 ring-sky-200'],
  gagal_pickup: ['Gagal pickup', 'berlangsung', 'bg-rose-50 text-rose-700 ring-rose-200'],
  dikirim: ['Sedang dikirim', 'berlangsung', 'bg-indigo-50 text-indigo-700 ring-indigo-200'],
  gagal_kirim: ['Gagal kirim', 'berlangsung', 'bg-rose-50 text-rose-700 ring-rose-200'],
  kendala: ['Ada kendala', 'berlangsung', 'bg-rose-50 text-rose-700 ring-rose-200'],
  kendala_selesai: ['Kendala selesai', 'berlangsung', 'bg-sky-50 text-sky-700 ring-sky-200'],
  retur_proses: ['Sedang dikembalikan', 'berlangsung', 'bg-amber-50 text-amber-800 ring-amber-200'],
  batal_diajukan: ['Pembatalan diajukan', 'berlangsung', 'bg-amber-50 text-amber-800 ring-amber-200'],
  terkirim: ['Terkirim', 'selesai', 'bg-emerald-50 text-emerald-700 ring-emerald-200'],
  dikembalikan: ['Dikembalikan', 'selesai', 'bg-slate-100 text-slate-700 ring-slate-200'],
  hilang_rusak: ['Hilang / rusak', 'selesai', 'bg-rose-50 text-rose-700 ring-rose-200'],
  force_majeure: ['Force majeure', 'berlangsung', 'bg-amber-50 text-amber-800 ring-amber-200'],
  dibatalkan: ['Dibatalkan', 'selesai', 'bg-slate-100 text-slate-600 ring-slate-200'],
  perlu_dicek: ['Status belum dikenal — perlu dicek', 'berlangsung', 'bg-amber-50 text-amber-800 ring-amber-200'],
}
export const labelTahap = (t) => TAHAP[t]?.[0] ?? String(t || '-')
export const kelompokTahap = (t) => TAHAP[t]?.[1] ?? 'berlangsung'
export const kelasTahap = (t) => TAHAP[t]?.[2] ?? 'bg-slate-100 text-slate-700 ring-slate-200'

/** Kartu ringkasan (urut sesuai permintaan). `tahap` = tahap internal yang dihitung. */
export const KARTU = [
  { key: 'total', label: 'Total pengiriman', tahap: null },
  { key: 'draft', label: 'Draft', tahap: ['draft', 'siap', 'gagal_order'] },
  { key: 'menunggu', label: 'Menunggu dijemput', tahap: ['diproses', 'dibuat', 'menunggu_jemput'] },
  { key: 'gagal_pickup', label: 'Gagal pickup', tahap: ['gagal_pickup'] },
  { key: 'dikirim', label: 'Sedang dikirim', tahap: ['dikirim'] },
  { key: 'terkirim', label: 'Terkirim', tahap: ['terkirim'] },
  { key: 'gagal_kirim', label: 'Gagal kirim', tahap: ['gagal_kirim', 'gagal_resi'] },
  { key: 'retur_proses', label: 'Sedang dikembalikan', tahap: ['retur_proses'] },
  { key: 'dikembalikan', label: 'Dikembalikan', tahap: ['dikembalikan'] },
  { key: 'hilang_rusak', label: 'Hilang/rusak', tahap: ['hilang_rusak'] },
  { key: 'dibatalkan', label: 'Dibatalkan', tahap: ['dibatalkan', 'batal_diajukan'] },
]

export const JENIS_KIRIM = {
  keluar: 'Hasil layanan keluar (ke pelanggan)',
  masuk: 'Dokumen masuk (dari pelanggan)',
  antar_cabang: 'Antar-cabang',
  ulang: 'Pengiriman ulang',
  lainnya: 'Lainnya / dari Everpro',
}
export const PENANGGUNG = { kantor: 'Ditanggung kantor', pelanggan: 'Dibayar pelanggan (sudah di invoice)', tagih: 'Ditagihkan ke pelanggan' }
export const CHECKLIST = [
  ['dokumen', 'Dokumen lengkap'],
  ['periksa', 'Hasil pemeriksaan siap'],
  ['alamat', 'Alamat terverifikasi'],
  ['kemasan', 'Kemasan siap'],
]

/** Peran (sama dengan aturan di server/RLS). */
export const PERAN_ADMIN = ['superadmin', 'direktur', 'admin_pusat']
export const PERAN_OPS = ['superadmin', 'direktur', 'admin_pusat', 'supervisor', 'cs', 'helper', 'staf_apostille']
/** Fitur penting (saldo, top-up, laporan, pengaturan, tarik/impor data, pembatalan): hanya 3 peran ini. */
export const PERAN_KEU = ['superadmin', 'direktur', 'admin_pusat']
export const bolehOps = (u) => PERAN_OPS.includes(u?.role)
export const bolehKeu = (u) => PERAN_KEU.includes(u?.role)
export const bolehAturKirim = (u) => PERAN_ADMIN.includes(u?.role)
export const bolehPenting = (u) => PERAN_ADMIN.includes(u?.role)

/** Zona waktu cabang (jadwal pickup mengikuti cabang pengirim). */
export const ZONA = { Bali: 'Asia/Makassar', Makassar: 'Asia/Makassar' }
export const zonaCabang = (c) => ZONA[c] || 'Asia/Jakarta'
export const singkatZona = (z) => ({ 'Asia/Makassar': 'WITA', 'Asia/Jakarta': 'WIB', 'Asia/Jayapura': 'WIT' }[z] || z)
export const fmtWaktu = (iso, zona = 'Asia/Makassar') => {
  if (!iso) return '-'
  const d = new Date(typeof iso === 'number' ? iso * (iso < 2e10 ? 1000 : 1) : iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return `${new Intl.DateTimeFormat('id-ID', { timeZone: zona, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d)} ${singkatZona(zona)}`
}

/** Normalisasi No. HP Indonesia: hanya mengubah awalan 0/8/+62; selain itu dibiarkan & ditandai. */
export function normalHp(s) {
  const asli = String(s || '').trim()
  let d = asli.replace(/[\s\-().]/g, '')
  if (d.startsWith('+')) d = d.slice(1)
  if (!/^\d+$/.test(d)) return { nomor: asli, ok: false, alasan: 'Hanya boleh angka' }
  if (d.startsWith('0')) d = '62' + d.slice(1)
  else if (d.startsWith('8')) d = '62' + d
  const ok = /^62\d{8,13}$/.test(d)
  return { nomor: d, ok, alasan: ok ? '' : 'Nomor HP Indonesia tidak valid (contoh 0812xxxx)' }
}
export const kodeposOk = (s) => /^\d{5}$/.test(String(s || '').trim())

/** Ambang perhatian bawaan (bisa diatur di Pengaturan). Satuan hari kalender. */
export const AMBANG_BAWAAN = { pickup_jam: 24, basi_1: 4, basi_2: 7, basi_3: 10, lewat_estimasi: 0, target_hari: 3 }

const hariSejak = (iso, now) => (iso ? (now - new Date(iso).getTime()) / 864e5 : null)
const AKTIF = ['diproses', 'dibuat', 'menunggu_jemput', 'gagal_pickup', 'dikirim', 'gagal_kirim', 'kendala', 'retur_proses', 'perlu_dicek', 'force_majeure', 'gagal_resi']

/**
 * Daftar "Perlu Perhatian". Dasar perhitungan (ditampilkan ke pengguna):
 *  - Pickup terlambat: tahap menunggu jemput & jadwal jemput sudah lewat > ambang jam.
 *  - Melewati estimasi kurir: dipesan + estimasi maks. (hari) kurir terlewati & belum terkirim.
 *  - Melewati target internal: dipesan + target operasional (hari) terlewati — beda dengan estimasi kurir.
 *  - Status tidak diperbarui: selisih waktu sekarang dengan pembaruan status terakhir.
 */
export function perluPerhatian(rows, kendala = [], mutasi = [], ambang = AMBANG_BAWAAN, now = Date.now()) {
  const a = { ...AMBANG_BAWAAN, ...(ambang || {}) }
  const out = { pickup_telat: [], lewat_estimasi: [], lewat_target: [], basi_1: [], basi_2: [], basi_3: [], gagal_kirim: [], retur: [], klaim: [], selisih: [], cashback: [] }
  for (const r of rows) {
    const t = r.tahap
    if (!AKTIF.includes(t)) continue
    if (t === 'menunggu_jemput' && r.kurir?.pickup_time && now - Number(r.kurir.pickup_time) * 1000 > a.pickup_jam * 3600e3) out.pickup_telat.push(r)
    const mulai = r.dipesan_at || r.dibuat_at || r.created_at
    const maks = Number(r.kurir?.max_hari)
    if (mulai && maks > 0 && hariSejak(mulai, now) > maks + Number(a.lewat_estimasi || 0)) out.lewat_estimasi.push(r)
    if (mulai && a.target_hari > 0 && hariSejak(mulai, now) > a.target_hari) out.lewat_target.push(r)
    const terakhir = r.diperbarui_at || r.updated_at || mulai
    const h = hariSejak(terakhir, now)
    if (h != null) { if (h >= a.basi_3) out.basi_3.push(r); else if (h >= a.basi_2) out.basi_2.push(r); else if (h >= a.basi_1) out.basi_1.push(r) }
    if (t === 'gagal_kirim') out.gagal_kirim.push(r)
    if (t === 'retur_proses') out.retur.push(r)
    const est = Number(r.biaya?.total || 0), akt = Number(r.biaya_aktual?.total || 0)
    if (est && akt && Math.abs(est - akt) >= 1) out.selisih.push(r)
  }
  for (const r of rows) { const est = Number(r.biaya?.total || 0), akt = Number(r.biaya_aktual?.total || 0); if (!AKTIF.includes(r.tahap) && est && akt && Math.abs(est - akt) >= 1) out.selisih.push(r) }
  out.klaim = kendala.filter((k) => ['klaim', 'retur'].includes(k.jenis) && !['selesai', 'ditolak'].includes(k.status))
  out.cashback = mutasi.filter((m) => ['cashback', 'refund'].includes(m.jenis) && ['tertunda', 'estimasi'].includes(m.status))
  return out
}
export const PERHATIAN_LABEL = {
  pickup_telat: ['Pickup terlambat', (a) => `Jadwal jemput sudah lewat lebih dari ${a.pickup_jam} jam dan status masih menunggu.`],
  lewat_estimasi: ['Melewati estimasi kurir', () => 'Sejak dipesan sudah lebih lama dari estimasi maksimum dari kurir (data Everpro saat cek ongkir).'],
  lewat_target: ['Melewati target internal', (a) => `Target operasional kita ${a.target_hari} hari sejak dipesan (bukan janji kurir).`],
  basi_1: ['Status tidak berubah 4–6 hari', (a) => `Tidak ada pembaruan status ${a.basi_1}–${a.basi_2 - 1} hari.`],
  basi_2: ['Status tidak berubah 7–9 hari', (a) => `Tidak ada pembaruan status ${a.basi_2}–${a.basi_3 - 1} hari.`],
  basi_3: ['Status tidak berubah ≥10 hari', (a) => `Tidak ada pembaruan status ${a.basi_3} hari atau lebih.`],
  gagal_kirim: ['Gagal kirim', () => 'Kurir melaporkan paket gagal diantar.'],
  retur: ['Retur belum selesai', () => 'Paket sedang dalam proses dikembalikan.'],
  klaim: ['Klaim/retur belum selesai', () => 'Catatan kendala jenis klaim/retur yang belum ditutup.'],
  selisih: ['Selisih tagihan', () => 'Biaya saat dipesan berbeda dengan biaya aktual dari Everpro.'],
  cashback: ['Cashback/refund belum selesai', () => 'Mutasi cashback/refund yang masih tertunda (dari impor laporan).'],
}

export const nomorKode = () => `KRM-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
export const IS_DEMO = MODE === 'demo'

// ---------- Ekspedisi: Everpro (otomatis) atau manual (Pos, DHL, dll.) ----------
/** `lacak` = halaman cek resi resmi (resi disalin otomatis, lalu tempel di sana). */
export const PENYEDIA = {
  everpro: { label: 'Everpro (otomatis: ongkir, resi, status)', singkat: 'Everpro' },
  pos: { label: 'Pos Indonesia (manual)', singkat: 'Pos Indonesia', kurir: 'Pos Indonesia', lacak: 'https://www.posindonesia.co.id' },
  dhl: { label: 'DHL Express (manual)', singkat: 'DHL Express', kurir: 'DHL Express', lacak: 'https://www.dhl.com/id-en/home/tracking.html' },
  lainnya: { label: 'Ekspedisi lain (manual)', singkat: 'Ekspedisi lain' },
}
/** Bawaan ekspedisi per cabang (bisa diubah di Pengiriman → Pengaturan). */
export const PENYEDIA_BAWAAN = { Yogyakarta: 'pos', Jakarta: 'dhl' }
export const penyediaCabang = (setel, cabang) => setel?.penyedia_cabang?.[cabang] || PENYEDIA_BAWAAN[cabang] || 'everpro'
export const isEverpro = (r) => (r?.penyedia || 'everpro') === 'everpro'
export const resiOf = (r) => r?.everpro?.awb || r?.resi || ''
/** Langkah status untuk kiriman manual (diubah staf, tercatat siapa & kapan). */
export const TAHAP_MANUAL = ['dikirim', 'terkirim', 'gagal_kirim', 'retur_proses', 'dikembalikan', 'hilang_rusak', 'dibatalkan']
