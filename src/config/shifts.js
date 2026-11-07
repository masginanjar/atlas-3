// ============================================================
//  SHIFT — disalin dari tabel jam kerja di jadwal cabang.
//  Jam kerja berubah tergantung berapa orang yang masuk hari itu,
//  jadi ada 4 skenario. Baris jadwal memakai KUNCI shift
//  (admin_pagi, pagi, tengah, ...); jamnya dibaca dari skenario
//  yang dipilih untuk hari itu.
// ============================================================

/** Baris pada jadwal cabang, berurutan dari atas seperti di lembar aslinya. */
export const BARIS_SHIFT = [
  { key: 'admin_pagi', label: 'Admin Pagi', grup: 'admin' },
  { key: 'admin_siang', label: 'Admin Siang', grup: 'admin' },
  { key: 'pagi', label: 'Pagi', grup: 'cs' },
  { key: 'tengah', label: 'Tengah', grup: 'cs' },
  { key: 'siang', label: 'Siang', grup: 'cs' },
  { key: 'malam', label: 'Malam', grup: 'cs' },
]
export const LIBUR = 'libur'
/** Semua kunci yang boleh dipakai sebagai isi sel jadwal. */
export const SEMUA_SHIFT = [...BARIS_SHIFT.map((s) => s.key), LIBUR]

export const shiftLabel = (key) =>
  key === LIBUR ? 'Libur' : BARIS_SHIFT.find((s) => s.key === key)?.label ?? key

/**
 * Empat skenario jam kerja. `jam` memetakan kunci shift ke jam kerja,
 * istirahat, dan lokasi. Shift yang tidak ada di sebuah skenario berarti
 * memang tidak dipakai pada kondisi itu.
 */
export const SKENARIO = [
  {
    key: 'cs_lengkap',
    label: 'Semua CS masuk',
    jam: {
      pagi: { mulai: '06.00', selesai: '14.00', istirahat: '10.00 - 11.00', lokasi: 'WFH' },
      tengah: { mulai: '09.00', selesai: '17.00', istirahat: '13.00 - 14.00', lokasi: 'OFFICE' },
      siang: { mulai: '11.00', selesai: '19.00', istirahat: '15.00 - 16.00', lokasi: 'OFFICE' },
      malam: { mulai: '18.00', selesai: '02.00', istirahat: 'Disesuaikan', lokasi: 'WFH' },
    },
  },
  {
    key: 'cs_kurang',
    label: 'Salah satu CS libur',
    jam: {
      pagi: { mulai: '06.00', selesai: '14.00', istirahat: '10.00 - 11.00', lokasi: 'WFH' },
      siang: { mulai: '10.00', selesai: '18.00', istirahat: '14.00 - 15.00', lokasi: 'OFFICE' },
      malam: { mulai: '18.00', selesai: '02.00', istirahat: 'Disesuaikan', lokasi: 'WFH' },
    },
  },
  {
    key: 'admin_lengkap',
    label: 'Admin masuk semua',
    jam: {
      admin_pagi: { mulai: '08.00', selesai: '16.00', istirahat: '12.00 - 13.00', lokasi: 'OFFICE' },
      admin_siang: { mulai: '11.00', selesai: '19.00', istirahat: '15.00 - 16.00', lokasi: 'OFFICE' },
    },
  },
  {
    key: 'admin_kurang',
    label: 'Salah satu admin libur',
    jam: {
      admin_siang: { mulai: '10.00', selesai: '18.00', istirahat: '14.00 - 15.00', lokasi: 'OFFICE' },
    },
  },
]

const SK = Object.fromEntries(SKENARIO.map((s) => [s.key, s]))

/**
 * Jam kerja sebuah shift. Skenario dipilih otomatis dari grup shift dan
 * ada-tidaknya orang yang libur hari itu, kecuali ditentukan sendiri.
 */
export function jamShift(shiftKey, { adaYangLibur = false, skenario = null } = {}) {
  if (shiftKey === LIBUR) return null
  const grup = BARIS_SHIFT.find((s) => s.key === shiftKey)?.grup
  const pilih = skenario
    || (grup === 'admin'
      ? (adaYangLibur ? 'admin_kurang' : 'admin_lengkap')
      : (adaYangLibur ? 'cs_kurang' : 'cs_lengkap'))
  return SK[pilih]?.jam[shiftKey] || SK[grup === 'admin' ? 'admin_lengkap' : 'cs_lengkap']?.jam[shiftKey] || null
}

/** "06.00 - 14.00 · WFH" untuk ditampilkan ringkas. */
export const ringkasJam = (j) => (j ? `${j.mulai} - ${j.selesai} · ${j.lokasi}` : '')
