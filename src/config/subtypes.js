// ============================================================
//  JENIS SUB PROJECT — field tambahan per jenis.
//  Semua jenis punya: Deskripsi (bernomor), Jumlah File (otomatis),
//  Jumlah Halaman (otomatis, bisa diedit).
// ============================================================
export const SUB_TYPES = {
  terjemahan: { label: 'Terjemahan Tersumpah', short: 'Tersumpah', extra: ['translator', 'lang'] },
  terjemahan_nt: { label: 'Terjemahan Non Tersumpah', short: 'Non Tersumpah', extra: ['translator_nt', 'lang'] },
  apostille: { label: 'Apostille', extra: ['country', 'objek', 'executor'] },
  legalisasi: { label: 'Legalisasi', extra: ['institution', 'executor'] },
  jasa_lain: { label: 'Jasa Lain', extra: [] },
}

/** Daftar negara tujuan apostille/legalisasi — lengkap, bisa dicari di formulir. */
export const COUNTRIES = [
  'Afganistan', 'Afrika Selatan', 'Albania', 'Aljazair', 'Amerika Serikat', 'Andorra', 'Angola',
  'Antigua dan Barbuda', 'Arab Saudi', 'Argentina', 'Armenia', 'Australia', 'Austria', 'Azerbaijan', 'Bahama',
  'Bahrain', 'Bangladesh', 'Barbados', 'Belanda', 'Belarus', 'Belgia', 'Belize', 'Benin', 'Bhutan', 'Bolivia',
  'Bosnia dan Herzegovina', 'Botswana', 'Brasil', 'Brunei Darussalam', 'Bulgaria', 'Burkina Faso', 'Burundi',
  'Ceko', 'Chad', 'Chili', 'Denmark', 'Djibouti', 'Dominika', 'Ekuador', 'El Salvador', 'Eritrea', 'Estonia',
  'Eswatini', 'Ethiopia', 'Fiji', 'Filipina', 'Finlandia', 'Gabon', 'Gambia', 'Georgia', 'Ghana', 'Grenada',
  'Guatemala', 'Guinea', 'Guinea Khatulistiwa', 'Guinea-Bissau', 'Guyana', 'Haiti', 'Honduras', 'Hong Kong',
  'Hongaria', 'India', 'Indonesia', 'Inggris (Britania Raya)', 'Irak', 'Iran', 'Irlandia', 'Islandia',
  'Israel', 'Italia', 'Jamaika', 'Jepang', 'Jerman', 'Kamboja', 'Kamerun', 'Kanada', 'Kazakhstan', 'Kenya',
  'Kepulauan Marshall', 'Kepulauan Solomon', 'Kirgizstan', 'Kiribati', 'Kolombia', 'Komoro', 'Kongo',
  'Kongo (Republik Demokratik)', 'Korea Selatan', 'Korea Utara', 'Kosta Rika', 'Kroasia', 'Kuba', 'Kuwait',
  'Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia', 'Libya', 'Liechtenstein', 'Lituania', 'Luksemburg',
  'Madagaskar', 'Makau', 'Makedonia Utara', 'Maladewa', 'Malawi', 'Malaysia', 'Mali', 'Malta', 'Maroko',
  'Mauritania', 'Mauritius', 'Meksiko', 'Mesir', 'Mikronesia', 'Moldova', 'Monako', 'Mongolia', 'Montenegro',
  'Mozambik', 'Myanmar', 'Namibia', 'Nauru', 'Nepal', 'Niger', 'Nigeria', 'Nikaragua', 'Norwegia', 'Oman',
  'Pakistan', 'Palau', 'Palestina', 'Panama', 'Pantai Gading', 'Papua Nugini', 'Paraguay', 'Perancis', 'Peru',
  'Polandia', 'Portugal', 'Qatar', 'Republik Afrika Tengah', 'Republik Dominika', 'Rumania', 'Rusia', 'Rwanda',
  'Saint Kitts dan Nevis', 'Saint Lucia', 'Saint Vincent dan Grenadines', 'Samoa', 'San Marino',
  'Sao Tome dan Principe', 'Selandia Baru', 'Senegal', 'Serbia', 'Seychelles', 'Sierra Leone', 'Singapura',
  'Siprus', 'Slovakia', 'Slovenia', 'Somalia', 'Spanyol', 'Sri Lanka', 'Sudan', 'Sudan Selatan', 'Suriah',
  'Suriname', 'Swedia', 'Swiss', 'Taiwan', 'Tajikistan', 'Tanjung Verde', 'Tanzania', 'Thailand',
  'Timor Leste', 'Tiongkok', 'Togo', 'Tonga', 'Trinidad dan Tobago', 'Tunisia', 'Turki', 'Turkmenistan',
  'Tuvalu', 'Uganda', 'Ukraina', 'Uni Emirat Arab', 'Uruguay', 'Uzbekistan', 'Vanuatu', 'Vatikan', 'Venezuela',
  'Vietnam', 'Yaman', 'Yordania', 'Yunani', 'Zambia', 'Zimbabwe'
]

/** Jenis dokumen terjemahan (untuk penerjemah internal). */
export const DOC_KINDS = { reguler: 'Reguler', non_reguler: 'Non Reguler' }
/** Halaman per jenis dokumen pada sub project terjemahan. Dokumen tanpa jenis dianggap Reguler. */
export function kindPages(sub) {
  const out = { reguler: 0, non_reguler: 0 }
  if (Array.isArray(sub.docs) && sub.docs.length) for (const d of sub.docs) out[d.kind === 'non_reguler' ? 'non_reguler' : 'reguler'] += Number(d.pages) || 0
  else out.reguler = Number(sub.pages) || 0
  return out
}

/** Pisah deskripsi bernomor menjadi daftar poin (tanpa nomor). */
export function points(text) {
  return String(text || '').split('\n').map((l) => l.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean)
}
/** Nomori ulang setiap baris: "1. ", "2. ", ... */
export function renumber(text) {
  return String(text || '').split('\n').map((l, i) => `${i + 1}. ${l.replace(/^\s*\d+[.)]\s*/, '')}`).join('\n')
}

/** Yang diapostille: dokumen asli, hasil terjemahan, atau keduanya. */
export const OBJEK_APOSTILLE = [
  ['asli', 'Dokumen asli'],
  ['terjemahan', 'Dokumen hasil terjemahan'],
  ['keduanya', 'Keduanya'],
]
