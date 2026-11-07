// ============================================================
//  TRACKING AFFIDAVIT — stok lembar affidavit per cabang × arah
//
//  Lembar affidavit adalah kertas bernomor yang dicetak di pusat dan
//  dikirim ke cabang. Hanya 4 arah bahasa yang memakainya. Setiap
//  cetakan mengurangi stok cabang tempat mencetak, jadi angkanya harus
//  dikurangi di SERVER (atomic) supaya dua CS yang mencetak bersamaan
//  tidak membuat stok minus.
// ============================================================
import { rolesOf, branchesOf, PRINT_VENDOR } from '../config/access.js'

/** 4 arah yang memakai lembar affidavit. Urutan ini dipakai di seluruh UI. */
export const ARAH_AFFIDAVIT = [
  { key: 'id-en', from: 'Indonesia', to: 'Inggris', label: 'Indonesia → Inggris' },
  { key: 'en-id', from: 'Inggris', to: 'Indonesia', label: 'Inggris → Indonesia' },
  { key: 'id-nl', from: 'Indonesia', to: 'Belanda', label: 'Indonesia → Belanda' },
  { key: 'nl-id', from: 'Belanda', to: 'Indonesia', label: 'Belanda → Indonesia' },
]

const BY_KEY = Object.fromEntries(ARAH_AFFIDAVIT.map((a) => [a.key, a]))
export const arahLabel = (key) => BY_KEY[key]?.label ?? key

/** Kunci arah dari pasangan bahasa; null bila arah ini tidak pakai affidavit. */
export const arahKey = (from, to) =>
  ARAH_AFFIDAVIT.find((a) => a.from === from && a.to === to)?.key ?? null

/**
 * Apakah cetakan sub project ini memakai lembar affidavit?
 * Syarat: terjemahan TERSUMPAH (bukan non tersumpah) dan arahnya salah satu dari 4.
 * Preview / unduh PDF / cetak biasa TIDAK memakai lembar — itu diatur di UI.
 */
export const isAffidavit = (sub) =>
  sub?.type === 'terjemahan' && !!arahKey(sub?.lang_from, sub?.lang_to)

/** Cabang yang stoknya terpakai = lokasi print, bukan cabang pemilik project. */
export const cabangCetak = (project) => project?.about?.print_location || project?.branch || ''

/**
 * Perlu mencatat lembar? Hanya bila arahnya memakai affidavit DAN dicetak di
 * cabang sendiri. Lokasi print "Vendor" memakai lembar vendor, bukan stok cabang.
 */
export const perluAffidavit = (project, sub) =>
  isAffidavit(sub) && cabangCetak(project) !== PRINT_VENDOR

// ---------------- status stok ----------------
export const AMBANG_RENDAH = 50 // < 50 lembar → peringatan ke Admin Pusat

/**
 * "belum diisi" (null/undefined) sengaja DIBEDAKAN dari 0.
 * Belum diisi = pusat belum pernah menetapkan stok awal; 0 = benar-benar habis.
 */
export function statusStok(sisa) {
  if (sisa == null || sisa === '') return { key: 'belum_diisi', label: 'Belum diisi', tone: 'slate', rank: 1 }
  const n = Number(sisa)
  if (n <= 0) return { key: 'habis', label: 'Habis', tone: 'rose', rank: 0 }
  if (n < AMBANG_RENDAH) return { key: 'rendah', label: 'Stok Rendah', tone: 'amber', rank: 2 }
  return { key: 'cukup', label: 'Cukup', tone: 'emerald', rank: 3 }
}

export const perluDiisi = (sisa) => statusStok(sisa).key !== 'cukup'

// ---------------- siapa boleh apa ----------------
/** Admin Pusat & atasannya: tetapkan stok awal, pantau semua cabang, catat pengiriman. */
export const canKelolaAffidavit = (u) =>
  rolesOf(u).some((r) => ['superadmin', 'admin_pusat', 'direktur'].includes(r))

/** Supervisor ikut memantau (tanpa hak ubah stok). */
export const canPantauSemua = (u) =>
  canKelolaAffidavit(u) || rolesOf(u).some((r) => ['supervisor', 'akunting'].includes(r))

/** Cabang yang boleh dilihat: pemantau = semua, sisanya = cabangnya sendiri. */
export const cabangTerlihat = (u, semuaCabang) =>
  canPantauSemua(u) ? semuaCabang : branchesOf(u).filter((b) => semuaCabang.includes(b))

// ---------------- pencarian baris stok ----------------
export const cariStok = (stok, cabang, arah) =>
  (stok || []).find((s) => s.cabang === cabang && s.arah === arah) || null

export const sisaStok = (stok, cabang, arah) => {
  const row = cariStok(stok, cabang, arah)
  return row ? (row.sisa == null ? null : Number(row.sisa)) : null
}

/** Lembar yang sedang dikirim pusat → cabang dan belum dikonfirmasi terima. */
export const sisaDikirim = (kirim, cabang, arah) =>
  (kirim || [])
    .filter((k) => k.cabang === cabang && k.arah === arah && k.status === 'dalam_pengiriman')
    .reduce((n, k) => n + (Number(k.lembar) || 0), 0)

/**
 * Satu baris tabel = satu kombinasi cabang × arah, termasuk yang belum diisi.
 * Urutan bawaan: yang paling perlu diisi di atas (habis → belum diisi → rendah → cukup),
 * lalu dari sisa terkecil, lalu nama cabang.
 */
export function barisStok(cabangList, stok, kirim) {
  const rows = []
  for (const cabang of cabangList) {
    for (const a of ARAH_AFFIDAVIT) {
      const sisa = sisaStok(stok, cabang, a.key)
      rows.push({
        id: `${cabang}|${a.key}`,
        cabang,
        arah: a.key,
        arahLabel: a.label,
        sisa,
        dikirim: sisaDikirim(kirim, cabang, a.key),
        status: statusStok(sisa),
      })
    }
  }
  return rows.sort(
    (x, y) =>
      x.status.rank - y.status.rank ||
      (x.sisa ?? 0) - (y.sisa ?? 0) ||
      x.cabang.localeCompare(y.cabang) ||
      x.arahLabel.localeCompare(y.arahLabel),
  )
}

// ---------------- hitung kebutuhan lembar ----------------
/**
 * Default 1 salinan = 1 lembar. Kalau satu dokumen butuh lebih dari 1 lembar,
 * kebutuhannya dikali jumlah salinan.
 */
export const hitungLembar = (salinan, lembarPerSalinan = 1) =>
  Math.max(0, Math.round(Number(salinan) || 0)) * Math.max(1, Math.round(Number(lembarPerSalinan) || 1))

/** Pratinjau sebelum mencetak: "Menggunakan 2 lembar · Sisa setelah cetak: 47". */
export function pratinjauCetak(sisa, lembar) {
  if (sisa == null) return { teks: `Menggunakan ${lembar} lembar · stok cabang belum diisi pusat`, bisa: false }
  const sesudah = sisa - lembar
  if (lembar <= 0) return { teks: 'Isi jumlah salinan dulu', bisa: false }
  if (sesudah < 0) return { teks: `Menggunakan ${lembar} lembar · stok hanya ${sisa} — tidak cukup`, bisa: false }
  return { teks: `Menggunakan ${lembar} lembar · Sisa setelah cetak: ${sesudah}`, bisa: true, sesudah }
}

// ---------------- kunci idempoten ----------------
/**
 * Satu transaksi cetak hanya boleh mengurangi stok SEKALI, walau tombol
 * diklik dua kali atau koneksi terputus lalu dicoba lagi. Kuncinya dibuat
 * sekali saat dialog cetak dibuka, lalu dipakai ulang saat mencoba lagi.
 * Cetak ULANG (dialog dibuka lagi) = kunci baru = pemakaian baru, sesuai aturan:
 * lembar yang sudah tercetak tidak bisa dipakai lagi.
 */
export const buatKunciCetak = () =>
  `ctk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

export const sudahTercatat = (pakai, kunci) =>
  !!kunci && (pakai || []).some((x) => x.kunci === kunci)

// ---------------- peringatan stok ----------------
/**
 * Satu peringatan AKTIF per cabang+arah: angkanya diperbarui, tidak menumpuk.
 * Peringatan ditutup begitu stok tersedia kembali >= AMBANG_RENDAH.
 */
export const kunciPeringatan = (cabang, arah) => `aff:${cabang}:${arah}`

export const teksPeringatan = (cabang, arah, sisa) =>
  `Cabang ${cabang} — ${arahLabel(arah)} tersisa ${sisa} lembar`

export const cariPeringatan = (notifs, cabang, arah) =>
  (notifs || []).find((n) => n.aff_key === kunciPeringatan(cabang, arah) && !n.closed)

// ---------------- riwayat ----------------
export const riwayatPakai = (pakai, { cabang, arah } = {}) =>
  (pakai || [])
    .filter((x) => (!cabang || x.cabang === cabang) && (!arah || x.arah === arah))
    .sort((a, b) => String(b.at || b.created_at || '').localeCompare(String(a.at || a.created_at || '')))

export const riwayatKirim = (kirim, { cabang, arah } = {}) =>
  (kirim || [])
    .filter((x) => (!cabang || x.cabang === cabang) && (!arah || x.arah === arah))
    .sort((a, b) => String(b.at || b.created_at || '').localeCompare(String(a.at || a.created_at || '')))
