// ============================================================
//  JADWAL — shift harian per cabang, plus pengajuan cuti.
//
//  Satu baris `jadwal` = satu orang, satu tanggal, satu shift.
//  Tanggal disimpan sebagai 'YYYY-MM-DD' (bukan timestamp) supaya
//  tidak bergeser karena zona waktu WIB/WITA.
// ============================================================
import { rolesOf, branchesOf, BRANCHES } from '../config/access.js'
import { LIBUR, BARIS_SHIFT, jamShift } from '../config/shifts.js'

export const TZ_JADWAL = 'Asia/Makassar'

// ---------------- tanggal ----------------
export const hariKunci = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ_JADWAL }).format(new Date(d))
export const bulanKunci = (d) => hariKunci(d).slice(0, 7)

const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
export const labelBulan = (ym) => {
  const [y, m] = String(ym).split('-').map(Number)
  return `${NAMA_BULAN[m - 1]} ${y}`
}
export const geserBulan = (ym, n) => {
  const [y, m] = String(ym).split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export const HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']
export const HARI_PENDEK = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

/**
 * Minggu-minggu sebuah bulan, Senin sampai Minggu, seperti lembar aslinya:
 * baris pertama bisa memuat beberapa hari bulan sebelumnya.
 */
export function mingguBulan(ym) {
  const [y, m] = String(ym).split('-').map(Number)
  const awal = new Date(Date.UTC(y, m - 1, 1))
  const mundur = (awal.getUTCDay() + 6) % 7 // Senin = 0
  const mulai = new Date(Date.UTC(y, m - 1, 1 - mundur))
  const akhirBulan = new Date(Date.UTC(y, m, 0)).getUTCDate()

  const minggu = []
  const kursor = new Date(mulai)
  while (true) {
    const baris = []
    for (let i = 0; i < 7; i++) {
      const iso = kursor.toISOString().slice(0, 10)
      baris.push({
        iso,
        tanggal: kursor.getUTCDate(),
        bulanIni: kursor.getUTCMonth() === m - 1,
        akhirPekan: i >= 5,
      })
      kursor.setUTCDate(kursor.getUTCDate() + 1)
    }
    minggu.push(baris)
    const lewat = kursor.getUTCMonth() > m - 1 || kursor.getUTCFullYear() > y
    if (lewat && minggu.length >= 4) break
    if (minggu.length >= 6) break
    if (baris[6].bulanIni && baris[6].tanggal === akhirBulan) break
  }
  return minggu
}

// ---------------- hak akses ----------------
/** Boleh membuat & mengubah jadwal. Supervisor hanya cabangnya sendiri. */
export const canUbahJadwal = (u) =>
  rolesOf(u).some((r) => ['superadmin', 'direktur', 'supervisor'].includes(r))

/** Boleh melihat semua cabang (tampilan "Satu Perusahaan"). */
export const canLihatSemua = (u) =>
  rolesOf(u).some((r) => ['superadmin', 'direktur', 'supervisor', 'admin_pusat', 'akunting'].includes(r))

/** Cabang yang boleh DIUBAH orang ini. */
export function cabangBolehUbah(u) {
  if (!canUbahJadwal(u)) return []
  if (rolesOf(u).some((r) => ['superadmin', 'direktur'].includes(r))) return [...BRANCHES]
  return branchesOf(u) // supervisor
}

/** Cabang yang boleh DILIHAT orang ini. */
export const cabangBolehLihat = (u) =>
  canLihatSemua(u) ? [...BRANCHES] : branchesOf(u)

// ---------------- pencarian isi jadwal ----------------
/** Kunci cepat: "2026-11-03|Bali" → daftar baris jadwal hari itu di cabang itu. */
export function indeksJadwal(rows) {
  const peta = new Map()
  for (const r of rows || []) {
    const k = `${r.tanggal}|${r.cabang}`
    if (!peta.has(k)) peta.set(k, [])
    peta.get(k).push(r)
  }
  return peta
}

export const isiHari = (peta, iso, cabang) => peta.get(`${iso}|${cabang}`) || []

/** Siapa saja yang libur di cabang itu pada tanggal itu. */
export const yangLibur = (peta, iso, cabang) =>
  isiHari(peta, iso, cabang).filter((r) => r.shift === LIBUR)

/** Isi satu sel pada tampilan cabang: siapa yang memegang shift itu. */
export const isiShift = (peta, iso, cabang, shiftKey) =>
  isiHari(peta, iso, cabang).filter((r) => r.shift === shiftKey)

/**
 * Nama untuk ditampilkan di sel. Bila ada jam khusus, ditulis seperti
 * lembar aslinya: "Oca (09.00)".
 */
export const labelOrang = (r, nama) => (r.jam_mulai ? `${namaPendek(nama)} (${r.jam_mulai})` : namaPendek(nama))

/**
 * Nama panggilan untuk sel jadwal: buang keterangan peran di belakang nama.
 * "Nikita (CS Bali)" -> "Nikita". Sel jadwal sempit, dan di lembar aslinya
 * memang hanya nama panggilan yang ditulis.
 */
export const namaPendek = (nama) => String(nama ?? '').replace(/\s*\(.*\)\s*$/, '').trim()

/** Jadwal satu orang pada rentang tanggal, urut tanggal. */
export const jadwalSaya = (rows, userId, ym) =>
  (rows || [])
    .filter((r) => r.user_id === userId && (!ym || String(r.tanggal).startsWith(ym)))
    .sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal)))

/** Jam kerja baris jadwal — ikut skenario bila ada yang libur hari itu. */
export function jamBaris(peta, r) {
  const adaYangLibur = yangLibur(peta, r.tanggal, r.cabang).length > 0
  return jamShift(r.shift, { adaYangLibur, skenario: r.skenario || null })
}

// ---------------- ringkasan untuk tampilan perusahaan ----------------
/**
 * Tampilan "Satu Perusahaan" meniru lembar aslinya: baris = cabang,
 * isinya nama yang LIBUR hari itu.
 */
export function barisPerusahaan(peta, minggu, cabangList, namaUser) {
  return cabangList.map((cabang) => ({
    cabang,
    hari: minggu.map((h) => ({
      ...h,
      libur: yangLibur(peta, h.iso, cabang).map((r) => namaUser(r.user_id)).filter(Boolean),
    })),
  }))
}

// ---------------- cuti ----------------
export const STATUS_CUTI = {
  diajukan: { label: 'Menunggu persetujuan', tone: 'amber' },
  disetujui: { label: 'Disetujui', tone: 'emerald' },
  ditolak: { label: 'Ditolak', tone: 'rose' },
}

/**
 * Pengajuan cuti HANYA muncul di cabang orang itu — tim cabang lain
 * tidak perlu dan tidak boleh melihatnya.
 */
export function cutiTerlihat(cutiRows, user) {
  const semua = canLihatSemua(user)
  const cabangSaya = branchesOf(user)
  return (cutiRows || []).filter((c) =>
    c.user_id === user?.id || semua || cabangSaya.includes(c.cabang))
}

/** Cuti yang sudah disetujui pada tanggal & cabang tertentu. */
export const cutiHari = (cutiRows, iso, cabang) =>
  (cutiRows || []).filter((c) =>
    c.status === 'disetujui' && c.cabang === cabang && tanggalCuti(c).includes(iso))

/** Semua tanggal yang dicakup satu pengajuan cuti. */
export function tanggalCuti(c) {
  // Satu pengajuan boleh memuat beberapa periode libur sekaligus (periode[]).
  // Pengajuan lama yang hanya punya mulai/selesai tetap terbaca seperti biasa.
  const periode = (c?.periode || []).length ? c.periode : [{ mulai: c?.mulai, selesai: c?.selesai || c?.mulai }]
  const set = new Set()
  for (const p of periode) {
    if (!p?.mulai) continue
    const d = new Date(`${p.mulai}T00:00:00Z`)
    const akhir = new Date(`${p.selesai || p.mulai}T00:00:00Z`)
    let n = 0
    while (d <= akhir && n < 90) { set.add(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); n++ }
  }
  return [...set].sort()
}

/** Ringkasan tanggal untuk ditampilkan: "3 Nov s/d 5 Nov · 10 Nov · 20–22 Nov". */
export function ringkasCuti(c) {
  const periode = (c?.periode || []).length ? c.periode : [{ mulai: c?.mulai, selesai: c?.selesai || c?.mulai }]
  return periode.filter((p) => p?.mulai)
    .map((p) => (p.selesai && p.selesai !== p.mulai ? `${p.mulai} s/d ${p.selesai}` : p.mulai))
    .join(' · ')
}

export const lamaCuti = (c) => tanggalCuti(c).length

// ---------------- siapa yang bisa dijadwalkan ----------------
/** Staf cabang yang masuk jadwal shift: CS, Helper, Admin Pusat, Staf Apostille. */
export const ROLE_TERJADWAL = ['cs', 'helper', 'admin_pusat', 'staf_apostille', 'supervisor']

export const stafCabang = (users, cabang) =>
  (users || [])
    .filter((u) => u.active !== false
      && branchesOf(u).includes(cabang)
      && rolesOf(u).some((r) => ROLE_TERJADWAL.includes(r)))
    .sort((a, b) => a.name.localeCompare(b.name))

/** Baris shift yang relevan untuk cabang: admin hanya bila cabang punya Admin Pusat. */
export function barisUntukCabang(users, cabang) {
  const punyaAdmin = stafCabang(users, cabang).some((u) => rolesOf(u).includes('admin_pusat'))
  return BARIS_SHIFT.filter((s) => s.grup !== 'admin' || punyaAdmin)
}
