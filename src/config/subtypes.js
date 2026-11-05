// ============================================================
//  JENIS SUB PROJECT — field tambahan per jenis.
//  Semua jenis punya: Deskripsi (bernomor), Jumlah File (otomatis),
//  Jumlah Halaman (otomatis, bisa diedit).
// ============================================================
export const SUB_TYPES = {
  terjemahan: { label: 'Terjemahan Tersumpah', short: 'Tersumpah', extra: ['translator', 'lang'] },
  terjemahan_nt: { label: 'Terjemahan Non Tersumpah', short: 'Non Tersumpah', extra: ['translator_nt', 'lang'] },
  apostille: { label: 'Apostille', extra: ['country', 'executor'] },
  legalisasi: { label: 'Legalisasi', extra: ['institution', 'executor'] },
  jasa_lain: { label: 'Jasa Lain', extra: [] },
}

export const COUNTRIES = [
  'Amerika Serikat', 'Arab Saudi', 'Australia', 'Austria', 'Belanda', 'Belgia', 'Brasil', 'Brunei Darussalam', 'Ceko',
  'Denmark', 'Filipina', 'Finlandia', 'Hong Kong', 'India', 'Inggris (Britania Raya)', 'Irlandia', 'Italia', 'Jepang',
  'Jerman', 'Kanada', 'Korea Selatan', 'Kuwait', 'Malaysia', 'Meksiko', 'Mesir', 'Norwegia', 'Polandia', 'Portugal',
  'Prancis', 'Qatar', 'Rusia', 'Selandia Baru', 'Singapura', 'Spanyol', 'Swedia', 'Swiss', 'Taiwan', 'Thailand',
  'Tiongkok', 'Turki', 'Uni Emirat Arab', 'Vietnam',
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
