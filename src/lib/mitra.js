import { rolesOf, branchesOf } from '../config/access.js'

// ============================================================
//  MITRA — daftar kemitraan (agen, notaris, travel, kampus, dll).
//  Bentuknya mirip Pelanggan, tapi datanya TIDAK dirangkum dari project:
//  diisi manual oleh CS masing-masing cabang.
//
//  Siapa yang boleh melihat: Superadmin & Direktur (semua cabang),
//  CS (hanya cabangnya sendiri). Pembatasan cabang ini WAJIB diulang
//  sebagai RLS di Supabase sebelum dipakai di LIVE — menyaring di layar
//  saja tidak cukup.
// ============================================================

export const canSeeMitra = (u) => ['superadmin', 'direktur', 'cs'].some((r) => rolesOf(u).includes(r))
/** Superadmin & Direktur melihat seluruh cabang; CS hanya cabangnya. */
export const mitraSemuaCabang = (u) => ['superadmin', 'direktur'].some((r) => rolesOf(u).includes(r))
/** Yang boleh menambah / mengubah data mitra. */
export const canEditMitra = (u) => ['superadmin', 'direktur', 'cs'].some((r) => rolesOf(u).includes(r))

export const JENIS_MITRA = ['Agen', 'Notaris', 'Travel / Visa', 'Kampus / Sekolah', 'Perusahaan', 'Kedutaan', 'Lainnya']
export const STATUS_MITRA = ['Aktif', 'Jeda', 'Berhenti']

/** Baris mitra kosong untuk form tambah. */
export const mitraBaru = (cabang) => ({
  nama: '', jenis: 'Agen', pic: '', telepon: '', email: '', alamat: '',
  cabang: cabang || '', status: 'Aktif', komisi: '', mulai: new Date().toISOString().slice(0, 10), catatan: '',
})

/** Saring mitra sesuai hak lihat pengguna + filter cabang yang sedang aktif. */
export function mitraTerlihat(rows, user, branchFilter) {
  const semua = mitraSemuaCabang(user)
  const milikSaya = branchesOf(user)
  let out = semua ? rows : rows.filter((r) => milikSaya.includes(r.cabang))
  if (semua && branchFilter && branchFilter !== 'Semua') out = out.filter((r) => r.cabang === branchFilter)
  return out
}

/** Validasi sebelum simpan. Mengembalikan pesan error atau null. */
export function cekMitra(m) {
  if (!String(m.nama || '').trim()) return 'Isi nama mitra'
  if (!m.cabang) return 'Pilih cabang'
  if (m.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.email)) return 'Format email tidak benar'
  return null
}
