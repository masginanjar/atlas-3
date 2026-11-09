// ============================================================
//  NOMOR REGISTRASI TERJEMAHAN TERSUMPAH
//
//  Pola nomor (14 angka), contoh 41 2611 03 1277 09:
//    41   = kode arah bahasa (41 ID→EN, 42 EN→ID, 43 ID→NL, 44 NL→ID)
//    2611 = tahun-bulan (yymm)
//    03   = kode tetap
//    1277 = nomor urut, SATU hitungan untuk semua arah, lanjut sepanjang bulan
//    09   = tanggal
//
//  Nomor dibuat di SERVER (fungsi next_reg_no di Supabase) supaya dua
//  otorisator yang menyimpan bersamaan tidak mendapat nomor yang sama;
//  tabel registrations memakai reg_no sebagai kunci utama, jadi nomor
//  kembar ditolak database. Mode demo menghitung sendiri dari data lokal.
// ============================================================
import { arahKey } from './affidavit.js'
import { db, MODE } from './db.js'

export const KODE_ARAH = { 'id-en': '41', 'en-id': '42', 'id-nl': '43', 'nl-id': '44' }
export const PASANGAN = { 41: 'ID-EN', 42: 'EN-ID', 43: 'ID-NL', 44: 'NL-ID' }
const TETAP = '03'

/** Kode arah 2 angka untuk sub project; null bila arahnya tidak termasuk 4 arah tersumpah. */
export const kodeArah = (sub) => KODE_ARAH[arahKey(sub?.lang_from, sub?.lang_to)] || null

/** Tanggal lokal (WITA) → { yymm, dd } */
const kini = (d = new Date()) => {
  const w = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Makassar' }))
  const yy = String(w.getFullYear()).slice(2), mm = String(w.getMonth() + 1).padStart(2, '0'), dd = String(w.getDate()).padStart(2, '0')
  return { yymm: yy + mm, dd }
}

export const susunNomor = (kode, seq, d = new Date()) => { const { yymm, dd } = kini(d); return `${kode}${yymm}${TETAP}${String(seq).padStart(4, '0')}${dd}` }
export const urutDari = (no) => Number(String(no || '').slice(8, 12)) || 0
export const bulanDari = (no) => String(no || '').slice(2, 6)
export const valid = (no) => /^4[1-4]\d{12}$/.test(String(no || '').trim())

/**
 * Ambil `jumlah` nomor berurutan untuk sub project ini (satu per dokumen).
 * Server memberi nomor pertama; sisanya nomor urut berikutnya pada hari yang sama.
 */
export async function ambilNomor(sub, jumlah, projects = []) {
  const kode = kodeArah(sub)
  if (!kode) throw new Error('Arah bahasa sub project ini tidak memakai nomor registrasi (hanya ID↔EN dan ID↔NL).')
  let pertama
  if (MODE === 'supabase') pertama = await db.regNext(kode)
  else {
    // demo: nomor urut terakhir bulan ini dari seluruh project lokal (+ dasar 1277 = posisi 8 Nov 2026)
    const { yymm } = kini()
    let max = yymm === '2611' ? 1277 : 0
    for (const p of projects) for (const s of p.sub_projects || []) for (const n of s.data?.reg_numbers || []) if (bulanDari(n) === yymm) max = Math.max(max, urutDari(n))
    pertama = susunNomor(kode, max + 1)
  }
  const seq0 = urutDari(pertama)
  return Array.from({ length: Math.max(1, jumlah) }, (_, i) => susunNomor(kode, seq0 + i))
}

/** Baris yang disimpan ke tabel registrations saat tahap registrasi disimpan. */
export const barisRegistrasi = (project, sub, user, names = []) => {
  const kode = kodeArah(sub)
  const docs = (sub.docs || []).filter((d) => (d.desc || '').trim())
  return (sub.data?.reg_numbers || []).map((no, i) => ({
    reg_no: String(no).trim(), invoice_no: project.invoice_no || null, lang_pair: PASANGAN[kode] || (sub.lang_from ? `${sub.lang_from}-${sub.lang_to}` : '-'),
    reg_date: `20${String(no).slice(2, 4)}-${String(no).slice(4, 6)}-${String(no).slice(12, 14)}`,
    doc_type: docs[i]?.desc || sub.title || '', doc_name: names[i] || sub.data?.reg_names?.[i] || project.customer?.name || '',
    pages: docs[i]?.pages ? Number(docs[i].pages) : null, project_id: project.id, sub_id: sub.id, source: 'atlas', created_by: user?.id || null,
  })).filter((r) => valid(r.reg_no))
}
