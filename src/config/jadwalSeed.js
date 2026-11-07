// ============================================================
//  CONTOH JADWAL NOVEMBER 2026 — disalin dari lembar jadwal asli
//  ("TIM BALI November 2026" dan "Jadwal Libur & CS Pagi-Malam").
//  HANYA untuk mode demo. Mode live mulai dari jadwal kosong.
//
//  Nama panggilan di lembar -> nama pengguna di aplikasi:
//    Niha = Nihaya · Oca = Rosyada · Ema = Emma · Krisna = Khrisna
// ============================================================

/** Nama panggilan di lembar jadwal -> potongan nama pengguna di aplikasi. */
export const PANGGILAN = {
  Niha: 'Nihaya', Sabrina: 'Sabrina', Nikita: 'Nikita', Oca: 'Rosyada',
  Destri: 'Destri', Indah: 'Indah',
  Ninda: 'Ninda', Debby: 'Debby', Ema: 'Emma',
  Wahyu: 'Wahyu', Krisna: 'Khrisna', Rika: 'Rika', Naomi: 'Naomi',
  Rhania: 'Rhania', Aina: 'Aina', Gean: 'Gean',
}

/**
 * Jadwal TIM BALI, enam minggu, Senin..Minggu.
 * Minggu 1 mulai 26 Oktober 2026. "" = tidak dijadwalkan.
 * "Nama@09.00" = jam mulai khusus, seperti "Oca (09.00)" di lembar.
 */
export const BALI_NOV_2026 = {
  mulai: '2026-10-26',
  minggu: [
    { // 26 Okt – 1 Nov
      admin_pagi: ['Sabrina', '', 'Sabrina', 'Sabrina', 'Sabrina', '', ''],
      admin_siang: ['Niha', 'Niha', 'Niha', 'Niha', 'Niha', 'Sabrina', 'Niha'],
      pagi: ['Nikita', 'Nikita', 'Nikita', 'Nikita', 'Nikita', '', ''],
      tengah: ['Oca', 'Oca', 'Oca', 'Oca', 'Oca', 'Oca@09.00', 'Nikita@09.00'],
      siang: ['Destri', 'Destri', 'Destri', 'Destri', 'Destri', '', ''],
      malam: ['Indah', 'Indah', 'Indah', 'Indah', 'Indah', 'Destri@16.00', 'Indah@16.00'],
      libur: ['', '', '', '', '', 'Niha,Destri,Oca', 'Sabrina,Nikita,Indah'],
    },
    { // 2 – 8 Nov
      admin_pagi: ['Niha', 'Niha', 'Niha', 'Niha', 'Niha', '', ''],
      admin_siang: ['Sabrina', 'Sabrina', 'Sabrina', 'Sabrina', 'Sabrina', 'Niha', 'Sabrina'],
      pagi: ['Destri', 'Destri', 'Destri', 'Destri', '', 'Oca', 'Indah'],
      tengah: ['Oca', 'Oca', 'Oca', 'Oca', 'Destri@09.00', '', ''],
      siang: ['Indah', 'Indah', 'Indah', 'Indah', 'Oca', '', ''],
      malam: ['Nikita', 'Nikita', 'Nikita', 'Nikita', 'Nikita', 'Indah@16.00', 'Nikita@16.00'],
      libur: ['', '', '', '', 'Indah', 'Sabrina,Nikita,Destri', 'Niha,Oca,Destri'],
    },
    { // 9 – 15 Nov
      admin_pagi: ['Sabrina', 'Sabrina', 'Sabrina', 'Sabrina', 'Sabrina', '', ''],
      admin_siang: ['Niha', 'Niha', 'Niha', 'Niha', 'Niha', 'Sabrina', 'Niha'],
      pagi: ['Oca', 'Oca', 'Oca', 'Oca', '', '', ''],
      tengah: ['Destri', 'Destri', 'Destri', 'Destri', 'Destri@09.00', 'Oca@09.00', 'Oca@09.00'],
      siang: ['Nikita', 'Nikita', 'Nikita', 'Nikita', 'Nikita', '', ''],
      malam: ['Indah', 'Indah', 'Indah', 'Indah', 'Indah', 'Indah@16.00', 'Nikita@16.00'],
      libur: ['', '', '', '', 'Oca', 'Niha,Nikita,Destri', 'Sabrina,Destri,Indah'],
    },
    { // 16 – 22 Nov
      admin_pagi: ['', 'Niha', 'Niha', 'Niha', 'Niha', '', ''],
      admin_siang: ['Niha', 'Sabrina', 'Sabrina', 'Sabrina', 'Sabrina', 'Niha', 'Sabrina'],
      pagi: ['Indah', 'Indah', 'Indah', 'Indah', '', '', ''],
      tengah: ['Nikita', 'Nikita', 'Nikita', 'Nikita', 'Indah@09.00', 'Oca@09.00', 'Nikita@09.00'],
      siang: ['Destri', 'Destri', 'Destri', 'Destri', 'Destri', '', ''],
      malam: ['Oca', 'Oca', 'Oca', 'Oca', 'Nikita', 'Indah@16.00', 'Oca@16.00'],
      libur: ['Sabrina', '', '', '', 'Oca', 'Nikita,Destri', 'Niha,Indah,Destri'],
    },
    { // 23 – 29 Nov
      admin_pagi: ['Sabrina', 'Sabrina', 'Sabrina', 'Sabrina', 'Sabrina', '', ''],
      admin_siang: ['Niha', 'Niha', 'Niha', 'Niha', 'Niha', 'Niha', 'Sabrina'],
      pagi: ['Nikita', 'Nikita', 'Nikita', 'Nikita', '', '', ''],
      tengah: ['Oca', 'Oca', 'Oca', 'Oca', 'Destri@09.00', 'Nikita@09.00', 'Oca@09.00'],
      siang: ['Destri', 'Destri', 'Destri', 'Destri', 'Oca', '', ''],
      malam: ['Indah', 'Indah', 'Indah', 'Indah', 'Indah', 'Indah@16.00', 'Destri@16.00'],
      libur: ['', '', '', '', 'Nikita', 'Sabrina,Destri,Oca', 'Niha,Indah'],
    },
    { // 30 Nov – 6 Des
      admin_pagi: ['', 'Sabrina', 'Sabrina', 'Sabrina', 'Sabrina', '', ''],
      admin_siang: ['Sabrina', 'Niha', 'Niha', 'Niha', 'Niha', 'Sabrina', 'Niha'],
      pagi: ['Nikita', 'Nikita', 'Nikita', 'Nikita', 'Nikita', '', ''],
      tengah: ['Oca', 'Oca', 'Oca', 'Oca', 'Oca', 'Nikita@09.00', 'Oca@09.00'],
      siang: ['Destri', 'Destri', 'Destri', 'Destri', 'Destri', '', ''],
      malam: ['Indah', 'Indah', 'Indah', 'Indah', 'Indah', 'Indah@16.00', 'Destri@16.00'],
      libur: ['Niha', '', '', '', '', 'Niha,Destri,Oca', 'Sabrina,Nikita,Indah'],
    },
  ],
}

/**
 * Hari libur cabang lain, dari lembar "Jadwal Libur & CS Pagi-Malam".
 * Indeks 0..6 = Senin..Minggu pada minggu yang sama dengan di atas.
 * Hanya baris LIBUR — lembar itu memang hanya mencatat libur.
 */
export const LIBUR_CABANG_NOV_2026 = {
  Surabaya: [
    ['', '', '', '', '', 'Ninda', ''],
    ['', '', '', '', '', '', 'Ninda'],
    ['', '', '', 'Ninda', 'Ninda', 'Ninda', 'Ninda'],
    ['Ninda', 'Ninda', 'Ninda', '', '', '', 'Ninda'],
    ['', '', '', '', '', 'Ninda', ''],
    ['', '', '', '', '', 'Ninda', ''],
  ],
  Bandung: [
    ['', '', '', '', '', '', 'Debby'],
    ['', '', '', '', '', 'Debby', ''],
    ['', '', '', '', '', '', 'Debby'],
    ['', '', '', '', '', 'Debby', ''],
    ['', '', '', '', '', '', 'Debby'],
    ['', '', '', '', '', '', 'Debby'],
  ],
  Yogyakarta: [
    ['', '', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['', '', '', '', 'Ema', '', ''],
    ['', '', '', '', '', '', 'Ema'],
    ['', '', '', '', 'Ema', '', ''],
    ['', '', '', '', 'Ema', '', ''],
  ],
  Jakarta: [
    ['', '', '', '', '', 'Wahyu,Krisna', 'Rika,Naomi'],
    ['', '', '', '', '', 'Wahyu,Krisna', 'Rika,Naomi'],
    ['', '', '', '', '', 'Wahyu,Krisna', 'Rika,Naomi'],
    ['', '', '', '', '', 'Wahyu,Krisna', 'Rika,Naomi'],
    ['', '', '', '', '', 'Wahyu,Krisna', 'Rika,Naomi'],
    ['', '', '', '', '', 'Wahyu,Krisna', 'Rika,Naomi'],
  ],
  Medan: [
    ['', '', '', '', '', '', 'Rhania'],
    ['', '', '', '', '', '', 'Rhania'],
    ['', '', '', '', '', '', 'Rhania'],
    ['', '', '', '', '', '', 'Rhania'],
    ['', '', '', '', '', '', 'Rhania'],
    ['', '', '', '', '', '', 'Rhania'],
  ],
  Makassar: [
    ['', '', '', '', '', '', 'Aina'],
    ['', '', '', '', '', '', 'Aina'],
    ['', '', '', '', '', '', 'Aina'],
    ['', '', '', '', '', '', 'Aina'],
    ['', '', '', '', '', '', 'Aina'],
    ['', '', '', '', '', '', 'Aina'],
  ],
  Batam: [
    ['', '', '', '', '', '', 'Gean'],
    ['', '', '', '', '', '', 'Gean'],
    ['', '', '', '', '', '', 'Gean'],
    ['', '', '', '', '', '', 'Gean'],
    ['', '', '', '', '', '', 'Gean'],
    ['', '', '', '', '', '', 'Gean'],
  ],
}

/** Geser tanggal 'YYYY-MM-DD' sebanyak n hari. */
export const geserHari = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
