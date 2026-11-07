// ============================================================
//  DOKUMEN — aturan folder, hak akses, dan pengemasan ZIP.
//
//  Folder di sini BUKAN folder baru: strukturnya mengikuti data
//  yang sudah ada — Cabang → Project (No. Invoice) → berkas.
//  Jadi apa pun yang diunggah, diganti nama, atau dihapus di sini
//  langsung terlihat di File Project pada My Project, dan sebaliknya.
// ============================================================

import { can, invoiceLabel } from '../config/access.js'

/** Nama yang aman dipakai sebagai nama folder/berkas di dalam ZIP. */
export const amanNama = (n = '') => String(n).replace(/[\\/:*?"<>|]+/g, '-').trim().slice(0, 80) || 'tanpa-nama'

/** Ukuran berkas dalam bentuk yang mudah dibaca. */
export const kb = (n) => (!n ? '—' : n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB`
  : `${(n / 1048576).toFixed(1)} MB`)

/** Ekstensi berkas, dipakai supaya rename tidak menghilangkan jenis filenya. */
export const ekstensi = (n = '') => (String(n).match(/\.[^.]+$/)?.[0] || '')

/** Nama tanpa ekstensi — yang boleh diubah pengguna. */
export const tanpaEkstensi = (n = '') => String(n).replace(/\.[^.]+$/, '')

/**
 * Boleh mengubah isi folder ini (unggah, ganti nama, hapus)?
 * Aturannya sama dengan hak mengubah project, jadi tidak ada jalan pintas
 * lewat menu Dokumen untuk sesuatu yang tidak boleh dilakukan di project.
 */
export const bolehUbah = (user, project) => !!project && can.editProject(user)

/** Boleh mengosongkan Trash secara permanen? Hanya yang memegang data perusahaan. */
export const bolehKosongkanTrash = (user) => ['superadmin', 'direktur', 'admin_pusat'].includes(user?.role)

/** Label folder project yang dipakai di layar maupun di dalam ZIP. */
export const labelProject = (p) => `${invoiceLabel(p?.invoice_no || '')}${p?.customer?.name ? ` - ${p.customer.name}` : ''}`

/**
 * Kemas berkas jadi ZIP dengan struktur folder tetap terjaga:
 *   Cabang/No. Invoice - Pelanggan/nama berkas
 * `ambilBlob` dipisah supaya mudah diuji. `onMaju` dipanggil tiap berkas.
 * Mengembalikan { blob, masuk, gagal } — berkas yang gagal TIDAK membatalkan
 * seluruh proses, tapi tetap dilaporkan.
 */
export async function kemasZip(berkas, { ambilBlob, onMaju, JSZip }) {
  const zip = new JSZip()
  const dipakai = new Set()
  const gagal = []
  let masuk = 0
  for (let i = 0; i < berkas.length; i++) {
    const f = berkas[i]
    onMaju?.(i + 1, berkas.length, f)
    let blob
    try { blob = await ambilBlob(f) } catch { gagal.push(f.name); continue }
    if (!blob) { gagal.push(f.name); continue }
    const folder = `${amanNama(f.cabang)}/${amanNama(f.folder)}`
    let path = `${folder}/${amanNama(f.name)}`
    let k = 1
    while (dipakai.has(path)) path = `${folder}/${amanNama(tanpaEkstensi(f.name))} (${k++})${ekstensi(f.name)}`
    dipakai.add(path)
    zip.file(path, blob)
    masuk += 1
  }
  if (!masuk) return { blob: null, masuk: 0, gagal }
  return { blob: await zip.generateAsync({ type: 'blob' }), masuk, gagal }
}

/** Cocokkan kata kunci dengan nama berkas, folder, invoice, pelanggan, pengunggah. */
export const cocokCari = (f, q) => {
  const s = String(q).trim().toLowerCase()
  if (!s) return true
  return [f.name, f.folder, f.cabang, f.invoice, f.pelanggan, f.by, f.source]
    .filter(Boolean).some((v) => String(v).toLowerCase().includes(s))
}
