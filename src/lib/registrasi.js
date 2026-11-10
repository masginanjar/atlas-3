// ============================================================
//  NOMOR REGISTRASI TERJEMAHAN TERSUMPAH
//
//  Pola nomor (14 angka), contoh 4 1 2611 031370 10:
//    4      = kode produksi 247
//    1      = arah bahasa (1 ID→EN, 2 EN→ID, 3 ID→NL, 4 NL→ID)
//    2611   = tahun-bulan (yymm)
//    031370 = kode unik 6 angka — SATU hitungan untuk semua arah,
//             terus berlanjut (tidak mulai dari awal tiap bulan)
//    10     = tanggal terbit
//
//  Hanya untuk terjemahan TERSUMPAH Indonesia ⇄ Inggris / Belanda.
//  Nomor TERBIT OTOMATIS saat Otorisator menekan ACC (1 dokumen = 1 nomor).
//  Nomor dibuat di SERVER (fungsi next_reg_no di Supabase) dan tabel
//  registrations memakai reg_no sebagai kunci utama, jadi nomor kembar
//  ditolak database. Mode demo menghitung sendiri dari data lokal.
// ============================================================
import { arahKey } from './affidavit.js'
import { docListOf } from '../config/workflows.js'
import { db, MODE } from './db.js'

export const KODE_ARAH = { 'id-en': '41', 'en-id': '42', 'id-nl': '43', 'nl-id': '44' }
export const PASANGAN = { 41: 'ID-EN', 42: 'EN-ID', 43: 'ID-NL', 44: 'NL-ID' }
/** Kode unik terakhir di Google Sheet "247 Registrasi Terjemahan 2026" saat ATLAS mengambil alih (10 Nov 2026). */
export const DASAR_SHEET = 31406

/** Kode arah 2 angka untuk sub project TERSUMPAH; null bila tidak memakai nomor registrasi. */
export const kodeArah = (sub) => (sub?.type && sub.type !== 'terjemahan' ? null : KODE_ARAH[arahKey(sub?.lang_from, sub?.lang_to)] || null)

/** Tanggal lokal (WITA) → { yymm, dd } */
const kini = (d = new Date()) => {
  const w = new Date(new Date(d).toLocaleString('en-US', { timeZone: 'Asia/Makassar' }))
  const yy = String(w.getFullYear()).slice(2), mm = String(w.getMonth() + 1).padStart(2, '0'), dd = String(w.getDate()).padStart(2, '0')
  return { yymm: yy + mm, dd }
}

export const susunNomor = (kode, seq, d = new Date()) => { const { yymm, dd } = kini(d); return `${kode}${yymm}${String(seq).padStart(6, '0')}${dd}` }
export const urutDari = (no) => (valid(no) ? Number(String(no).slice(6, 12)) : 0)
export const bulanDari = (no) => String(no || '').slice(2, 6)
export const valid = (no) => /^4[1-4]\d{12}$/.test(String(no || '').trim())
/** Tanggal terbit (YYYY-MM-DD) dari nomor. */
export const tanggalDari = (no) => `20${String(no).slice(2, 4)}-${String(no).slice(4, 6)}-${String(no).slice(12, 14)}`

/** Nama dalam dokumen bawaan: nama pelanggan tanpa sapaan (Tn./Ny./Nn.). */
export const namaBawaan = (project) => String(project?.customer?.name || project?.customer_name || '').replace(/^(tn|ny|nn|sdr|sdri|bpk|ibu|mr|mrs|ms)\.?\s+/i, '').trim()

/**
 * Nama dalam dokumen bawaan = NAMA BELAKANG dari nama dokumen
 * (mis. "Akta Kelahiran Darwin Sanjaya" → "Sanjaya", "KK Fajriyah" → "Fajriyah").
 * Kata berangka & singkatan huruf besar (KK, KTP, S1, III) dilewati; bila tidak ada,
 * pakai nama belakang pelanggan.
 */
/** Jenis dokumen bawaan (bahasa Inggris, seperti Sheet) dari kata DEPAN nama dokumen. Urut dari yang paling panjang. */
const JENIS_EN = [
  ['kutipan akta nikah', 'Excerpt of Marriage Certificate'], ['kutipan akta perkawinan', 'Excerpt of Marriage Certificate'], ['akta perkawinan', 'Excerpt of Marriage Certificate'], ['akta nikah', 'Excerpt of Marriage Certificate'], ['buku nikah', 'Marriage Book'],
  ['kutipan akta kelahiran', 'Birth Certificate'], ['akta kelahiran', 'Birth Certificate'], ['akta lahir', 'Birth Certificate'],
  ['akta kematian', 'Death Certificate'], ['akta perceraian', 'Divorce Certificate'], ['akta cerai', 'Divorce Certificate'], ['akta pendirian', 'Deed of Establishment'],
  ['kartu tanda penduduk', 'Personal Identity Card'], ['e-ktp', 'Personal Identity Card'], ['ktp', 'Personal Identity Card'],
  ['kartu keluarga', 'Family Card'], ['kk', 'Family Card'], ['kartu identitas anak', 'Child Identity Card'], ['kia', 'Child Identity Card'],
  ['transkrip nilai', 'Academic Transcript'], ['transkip nilai', 'Academic Transcript'], ['transkrip', 'Academic Transcript'], ['transkip', 'Academic Transcript'], ['surat keterangan penghasilan', 'Certificate of Income'],
  ['ijazah s1', 'Certificate of Bachelor Degree'], ['ijazah sarjana', 'Certificate of Bachelor Degree'], ['ijazah s2', 'Certificate of Master Degree'], ['ijazah magister', 'Certificate of Master Degree'],
  ['ijazah s3', 'Certificate of Doctoral Degree'], ['ijazah d3', 'Diploma III Certificate'], ['ijazah sma', 'Senior High School Certificate'], ['ijazah smk', 'Vocational High School Certificate'],
  ['ijazah smp', 'Junior High School Certificate'], ['ijazah sd', 'Elementary School Certificate'], ['ijazah', 'Diploma'],
  ['surat keterangan belum menikah', 'Certificate of Unmarried Status'], ['surat keterangan belum kawin', 'Certificate of Unmarried Status'], ['surat keterangan domisili', 'Certificate of Domicile'],
  ['surat keterangan kelakuan baik', 'Police Clearance Certificate'], ['skck', 'Police Clearance Certificate'], ['surat keterangan', 'Certificate'], ['surat pernyataan', 'Statement Letter'], ['surat kuasa', 'Power of Attorney'],
  ['paspor', 'Passport'], ['npwp', 'Taxpayer Identification Number'], ['nib', 'Business Identification Number'], ['sim', 'Driving License'],
  ['rapor', 'Student Report Card'], ['raport', 'Student Report Card'], ['piagam', 'Certificate of Appreciation'], ['sertifikat', 'Certificate'], ['surat izin praktik', 'Practice License'],
].sort((a, b) => b[0].length - a[0].length)
export const jenisDefault = (docDesc) => {
  const d = String(docDesc || '').replace(/^\s*(indonesian|english|dutch|inggris|indonesia|belanda)\s+(to|ke)\s+(indonesian|english|dutch|inggris|indonesia|belanda)\s*/i, '').replace(/^\s*\d+[.)]?\s+/, '').trim()
  const k = d.toLowerCase()
  const hit = JENIS_EN.find(([id]) => k === id || k.startsWith(`${id} `))
  return hit ? hit[1] : d
}

const KATA_DOK = new Set(('ijazah akta kartu keluarga kk ktp transkrip transcript nilai diploma sarjana magister surat keterangan sertifikat certificate card '
  + 'lahir kelahiran nikah perkawinan pernikahan kematian cerai perceraian buku paspor passport skck npwp nib sim domisili belum menikah izin '
  + 'academic identity personal family birth marriage death divorce excerpt degree bachelor master of the and & dan atau to translation terjemahan '
  + 'piagam penghargaan rapor raport legalisir salinan copy duplicate kutipan').split(/\s+/))
export const namaDefault = (docDesc, project) => {
  const kata = String(docDesc || '').replace(/[()[\],.;:/\\]+/g, ' ').split(/\s+/).filter(Boolean)
  for (let i = kata.length - 1; i >= 0; i--) {
    const w = kata[i]
    if (/\d/.test(w) || (/^[A-Z]+$/.test(w) && w.length <= 4) || KATA_DOK.has(w.toLowerCase())) continue
    return w.charAt(0).toUpperCase() + w.slice(1)
  }
  const c = namaBawaan(project).split(/\s+/).filter(Boolean)
  return c[c.length - 1] || ''
}

/** Kode unik tertinggi yang sudah dipakai di data lokal (mode demo). */
export const urutTertinggi = (projects = []) => {
  let max = DASAR_SHEET
  for (const p of projects) for (const s of p.sub_projects || []) for (const n of s.data?.reg_numbers || []) max = Math.max(max, urutDari(n))
  return max
}

/**
 * Ambil `jumlah` nomor berurutan untuk sub project ini (satu per dokumen).
 * Server memberi nomor pertama; sisanya nomor urut berikutnya.
 */
export async function ambilNomor(sub, jumlah, projects = []) {
  const kode = kodeArah(sub)
  if (!kode) throw new Error('Sub project ini tidak memakai nomor registrasi (hanya terjemahan tersumpah Indonesia ⇄ Inggris / Belanda).')
  const pertama = MODE === 'supabase' ? await db.regNext(kode) : susunNomor(kode, urutTertinggi(projects) + 1)
  const seq0 = urutDari(pertama)
  return Array.from({ length: Math.max(1, jumlah) }, (_, i) => susunNomor(kode, seq0 + i))
}

/** Jumlah dokumen sub project (minimal 1) — satu nomor per dokumen. */
export const jumlahDok = (sub) => Math.max(1, docListOf(sub).length)

/** Baris yang disimpan ke tabel registrations saat tahap registrasi disimpan. */
export const barisRegistrasi = (project, sub, user, names = []) => {
  const kode = kodeArah(sub)
  const docs = (sub.docs || []).filter((d) => (d.desc || '').trim())
  return (sub.data?.reg_numbers || []).map((no, i) => ({
    reg_no: String(no).trim(), invoice_no: project.invoice_no || null, lang_pair: PASANGAN[kode] || (sub.lang_from ? `${sub.lang_from}-${sub.lang_to}` : '-'),
    reg_date: sub.data?.reg_dates?.[i] || tanggalDari(no),
    doc_type: sub.data?.reg_types?.[i] || jenisDefault(docs[i]?.desc || docListOf(sub)[i] || sub.title || ''), doc_name: names[i] || sub.data?.reg_names?.[i] || namaDefault(docs[i]?.desc || docListOf(sub)[i], project) || '',
    pages: docs[i]?.pages ? Number(docs[i].pages) : null, project_id: project.id, sub_id: sub.id, source: 'atlas', created_by: user?.id || null,
  })).filter((r) => valid(r.reg_no))
}
