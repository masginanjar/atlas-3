// ============================================================
//  COVER DASHBOARD
//  Sapaan + kutipan hari ini, dengan blok warna yang berganti
//  mengikuti hari. Semua teks di berkas ini boleh diubah bebas —
//  tidak ada logika yang bergantung pada isinya.
//
//  CATATAN PENTING soal hadis: teks di bawah adalah hadis yang
//  sangat dikenal luas, ditulis ulang ringkas dalam bahasa
//  Indonesia beserta perawinya. Mohon diperiksa dulu oleh yang
//  berkompeten sebelum dipakai di lingkungan kerja — menyandarkan
//  kalimat yang keliru kepada Nabi bukan perkara ringan. Kalau
//  ragu, kosongkan saja array HADIS dan hari Jumat akan memakai
//  kalimat penyemangat biasa.
// ============================================================

// ---- Warna teks otomatis -------------------------------------------------
// Teks tidak lagi ditentukan manual per tema. Warnanya dihitung dari
// warna blok: diuji terhadap KEDUA ujung gradien, lalu dipilih yang
// kontrasnya paling aman. Jadi tema baru pun otomatis tetap terbaca.

const keRgb = (hex) => {
  const h = hex.replace('#', '')
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16))
}
/** Luminansi relatif menurut WCAG. */
const luminansi = (hex) => {
  const [r, g, b] = keRgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
/** Rasio kontras dua warna (1–21). AA butuh minimal 4,5 untuk teks biasa. */
export function kontras(a, b) {
  const x = luminansi(a), y = luminansi(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
/** Versi sangat gelap dari sebuah warna — tetap senada, bukan hitam polos. */
const gelapkan = (hex, f = 0.22) => '#' + keRgb(hex).map((v) => Math.round(v * f).toString(16).padStart(2, '0')).join('')

/**
 * Warna teks yang paling terbaca di atas gradien warna[0] → warna[1].
 * Dipilih antara putih dan versi gelap senada; yang menang adalah yang
 * kontras terburuknya (terhadap kedua ujung gradien) paling tinggi.
 */
export function warnaTeks([a, b]) {
  const kandidat = ['#ffffff', gelapkan(a)]
  let terbaik = kandidat[0], nilai = -1
  for (const c of kandidat) {
    const min = Math.min(kontras(c, a), kontras(c, b))
    if (min > nilai) { nilai = min; terbaik = c }
  }
  return terbaik
}

/**
 * Pastikan blok warna + teksnya lolos kontras WCAG AA (4,5:1).
 * Warna temanya dipertahankan rona-nya, hanya digelapkan bertahap
 * sampai teks terbaik mencapai kontras aman. Dengan begitu tema baru
 * pun tidak bisa menghasilkan teks yang susah dibaca.
 */
export function temaAman(dasar) {
  for (let f = 1; f >= 0.3; f -= 0.06) {
    const warna = dasar.warna.map((c) => (f === 1 ? c : gelapkan(c, f)))
    const teks = warnaTeks(warna)
    const min = Math.min(kontras(teks, warna[0]), kontras(teks, warna[1]))
    if (min >= 4.5) return { ...dasar, warna, teks, kontras: min }
  }
  // Sangat jarang: pakai yang paling gelap dengan teks putih.
  const warna = dasar.warna.map((c) => gelapkan(c, 0.3))
  return { ...dasar, warna, teks: '#ffffff', kontras: Math.min(kontras('#ffffff', warna[0]), kontras('#ffffff', warna[1])) }
}

/**
 * Warna blok cover MENGIKUTI WARNA AKSEN TEMA aplikasi (Setting → Tema).
 * Bawaannya hitam. Tidak ada lagi tema harian — yang berganti tiap hari
 * hanya kutipannya, bukan warnanya.
 */
export const WARNA_BAWAAN = '#111827'

/** Gradien dua tingkat dari satu warna aksen. */
const gradasiDari = (hex) => {
  const [r, g, b] = keRgb(hex)
  const terang = '#' + [r, g, b].map((v) => Math.round(v + (255 - v) * 0.22).toString(16).padStart(2, '0')).join('')
  return [hex, terang]
}

/** Warna aksen yang sedang dipakai — dibaca dari pengaturan tema. */
export function warnaAksen() {
  try {
    const t = JSON.parse(localStorage.getItem('atlas-theme') || '{}')
    return /^#[\da-fA-F]{6}$/.test(t.accent || '') ? t.accent : WARNA_BAWAAN
  } catch { return WARNA_BAWAAN }
}

/** Hadis yang sangat dikenal — ringkas, dengan perawi. Periksa dulu sebelum dipakai. */
export const HADIS = [
  { teks: 'Setiap amal bergantung pada niatnya.', dari: 'HR Bukhari & Muslim' },
  { teks: 'Sebaik-baik manusia adalah yang paling bermanfaat bagi sesama.', dari: 'HR Ahmad & Thabrani' },
  { teks: 'Tidak beriman salah seorang di antara kalian sampai ia mencintai saudaranya seperti ia mencintai dirinya sendiri.', dari: 'HR Bukhari & Muslim' },
  { teks: 'Barang siapa beriman kepada Allah dan hari akhir, hendaklah ia berkata baik atau diam.', dari: 'HR Bukhari & Muslim' },
  { teks: 'Permudahlah, jangan mempersulit. Berilah kabar gembira, jangan membuat orang lari.', dari: 'HR Bukhari & Muslim' },
  { teks: 'Allah mencintai pekerjaan yang apabila dilakukan, dikerjakan dengan rapi dan sungguh-sungguh.', dari: 'HR Thabrani' },
]

/** Kalimat penyemangat untuk hari selain Jumat. */
export const KUTIPAN = {
  1: ['Awal pekan. Satu hal dulu yang paling penting, sisanya menyusul.',
      'Pagi ini modalnya bukan semangat besar, cukup mulai dari satu berkas.',
      'Pekan baru, catatan baru. Yang kemarin tertunda, taruh paling atas.'],
  2: ['Yang sedang berjalan lebih berharga daripada yang baru direncanakan.',
      'Selesaikan yang nanggung dulu, biar kepala lebih lega.',
      'Rapi itu bukan tambahan pekerjaan — itu yang bikin besok lebih ringan.'],
  3: ['Tengah pekan. Cek yang deadline-nya dekat sebelum menumpuk.',
      'Pelanggan ingat bagaimana kita mengabari, bukan hanya hasilnya.',
      'Satu telepon sekarang sering lebih murah daripada satu minggu menunggu.'],
  4: ['Sedikit lagi akhir pekan. Jangan ada yang menggantung sampai Jumat sore.',
      'Yang tidak dicatat gampang hilang. Catat dulu, kerjakan kemudian.',
      'Periksa ulang nomor invoice dan alamat kirim — dua hal yang paling sering keliru.'],
  6: ['Akhir pekan. Pelan boleh, berhenti jangan.',
      'Sabtu di Bali: kerjakan yang ringan dulu, nikmati sisanya.',
      'Tutup pekan dengan meja yang bersih.'],
  0: ['Istirahat juga bagian dari pekerjaan. Jangan lupa bergerak.',
      'Badan yang segar bikin Senin tidak terasa berat.',
      'Hari ini untuk pulih. Besok baru lari lagi.'],
}

/** Angka tetap untuk satu hari — supaya isinya tidak berganti tiap halaman dibuka. */
const benih = (d) => {
  const k = `${d.getFullYear()}${d.getMonth()}${d.getDate()}`
  let h = 0
  for (const c of k) h = (h * 31 + c.charCodeAt(0)) % 100000
  return h
}

/** Tema, kutipan, dan sumbernya untuk tanggal tertentu. */
export function coverHariIni(d = new Date(), aksen = warnaAksen()) {
  const hari = d.getDay()
  const n = benih(d)
  const tema = temaAman({ nama: 'Hari ini', warna: gradasiDari(aksen) })
  if (hari === 5 && HADIS.length) {
    const h = HADIS[n % HADIS.length]
    return { tema, kutipan: h.teks, sumber: h.dari, jenisHadis: true }
  }
  const list = KUTIPAN[hari] || KUTIPAN[2]
  return { tema, kutipan: list[n % list.length], sumber: '', jenisHadis: false }
}

/** "Selamat pagi" dst. */
export const sapaan = (d = new Date()) => {
  const j = d.getHours()
  return j < 11 ? 'Selamat pagi' : j < 15 ? 'Selamat siang' : j < 18 ? 'Selamat sore' : 'Selamat malam'
}
