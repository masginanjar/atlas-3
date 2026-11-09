// ============================================================
//  PREFERENSI TAMPILAN HALAMAN PROJECT
//  Semua pengaturan di menu "Tampilan ▾" — diingat per perangkat (localStorage)
//  dan bisa disimpan sebagai tampilan bernama bersama saringan aktif.
// ============================================================
export const PREF_BAWAAN = {
  zebra: true,        // selang-seling warna baris/kartu
  garis: true,        // garis antar baris
  lipat: false,       // teks panjang: false = potong…, true = lipat baris
  stickyKiri: true,   // kolom invoice menempel kiri (tabel)
  stickyAtas: true,   // judul kolom menempel atas
  lebar: 'pas',       // 'pas' | 'rata'
  strip: true,        // strip "Perlu Anda"
  panel: true,        // panel saringan (map)
  toolbar: true,      // false = toolbar disembunyikan (satu baris tipis)
  grup: true,         // kelompokkan menurut tenggat (Terlambat · Hari ini · …)
  urgensi: true,      // garis warna urgensi di tepi kiri
  stepper: true,      // stepper tahap (bukan bar polos)
  pelaksana: true,    // baris pelaksana di bawah tahap
  tabelCols: null,    // kolom tabel yang tampil (null = semua)
  ukuranTabel: 'normal', // kecil | normal | besar — ukuran huruf & jarak sel tabel
}
const KEY = 'atlas-proj-prefs'
export function muatPref() {
  try { return { ...PREF_BAWAAN, ...(JSON.parse(localStorage.getItem(KEY) || '{}') || {}) } } catch { return { ...PREF_BAWAAN } }
}
export function simpanPref(p) { try { localStorage.setItem(KEY, JSON.stringify(p)) } catch { /* abaikan */ } }
/** Kelas CSS pada pembungkus daftar — aturannya ada di index.css. */
export const kelasPref = (p) => [
  !p.zebra && 'tanpa-zebra',
  !p.garis && 'tanpa-garis',
  p.lipat && 'lipat-teks',
  !p.stickyKiri && 'tanpa-sticky-kiri',
  !p.stickyAtas && 'tanpa-sticky-atas',
  p.lebar === 'rata' && 'tabel-rata',
].filter(Boolean).join(' ')
