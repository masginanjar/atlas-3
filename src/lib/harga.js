// ============================================================
//  DAFTAR HARGA (HARGA JUAL) — panduan CS saat menawarkan.
//
//  Ini BUKAN harga vendor. Yang ini harga ke pelanggan, jadi justru
//  harus bisa dilihat semua staf supaya cepat menjawab pertanyaan.
//  Yang boleh mengubah hanya Superadmin & Direktur — ditegakkan di
//  database (RLS tabel daftar_harga), bukan hanya disembunyikan.
// ============================================================

/** Boleh mengubah daftar harga. */
export const canEditHarga = (u) => ['superadmin', 'direktur'].includes(u?.base_role || u?.role)

export const KATEGORI = ['Terjemahan Tersumpah', 'Terjemahan Non Tersumpah', 'Apostille', 'Legalisasi', 'Lainnya']
export const SATUAN = ['per halaman', 'per dokumen', 'per pesanan']

export const rupiah = (n) =>
  typeof n === 'number' && Number.isFinite(n) ? 'Rp ' + n.toLocaleString('id-ID') : null

/** Kelompokkan per kategori, urut sesuai KATEGORI lalu kolom urutan. */
export function perKategori(rows) {
  const out = new Map(KATEGORI.map((k) => [k, []]))
  for (const r of rows) {
    const k = KATEGORI.includes(r.kategori) ? r.kategori : 'Lainnya'
    out.get(k).push(r)
  }
  for (const [, v] of out) v.sort((a, b) => (a.urutan ?? 0) - (b.urutan ?? 0))
  return [...out.entries()].filter(([, v]) => v.length)
}

/** Berapa baris yang harganya belum diisi — dipakai untuk peringatan. */
export const belumDiisi = (rows) => rows.filter((r) => rupiah(r.harga_normal) === null).length
