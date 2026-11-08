/**
 * Pengaturan tampilan Halaman Login.
 * Disimpan di app_settings (key: 'login') agar berlaku untuk seluruh pengguna,
 * dan disalin ke localStorage supaya halaman login (yang terbuka sebelum
 * pengguna masuk) tetap bisa memakainya tanpa perlu autentikasi.
 */

import { GAMBAR_LOGIN_BAWAAN } from './loginImage.js'

export const DEFAULT_LOGIN = {
  key: 'login',
  judul: 'Selamat datang kembali',
  sub: 'Masuk untuk melanjutkan pekerjaan Anda.',
  panelJudul: 'اَللّٰهُمَّ إِنِّى أَسْأَلُكَ عِلْمًا نَافِعًا وَرِزْقًا طَيِّبًا وَعَمَلاً مُتَقَبَّلاً',
  panelPesan: 'Allāhumma innī as\'aluka \'ilman nāfi\'an, wa rizqan thayyiban, wa \'amalan mutaqabbalan.\n"Ya Allah, sesungguhnya aku memohon kepada-Mu ilmu yang bermanfaat, rezeki yang baik (halal), dan amal yang diterima."',
  bg: '#eef2ff',          // latar halaman — biru sangat muda
  panelBg: '#f1f3ff',     // latar panel kanan
  overlay: 45,            // 0–60 (%) lapisan gelap di atas gambar agar teks terbaca
  fit: 'cover',           // 'cover' | 'fit'
  images: [{ id: 'bawaan-kelingking', name: 'Kelingking, Nusa Penida', src: GAMBAR_LOGIN_BAWAAN, aktif: true, posX: 35, posY: 60, zoom: 1 }],
}

export const MAKS_GAMBAR = 6
export const SARAN_UKURAN = 'JPG/PNG/WebP · disarankan 1200×1600 px (potret) · otomatis dioptimalkan ke maks. 1400 px & ±300 KB'

const CACHE = 'atlas-login-tema'

/** Ambil pengaturan dari data aplikasi (sudah masuk) — selalu digabung dengan bawaan. */
export const temaLogin = (data) => ({
  ...DEFAULT_LOGIN,
  ...((data?.app_settings || []).find((r) => r.key === 'login') || {}),
})

/** Simpan salinan ke localStorage supaya halaman login bisa membacanya tanpa login. */
export const simpanCache = (t) => {
  try { localStorage.setItem(CACHE, JSON.stringify(t)) } catch { /* kuota penuh — abaikan, pakai bawaan */ }
}

/** Dipakai halaman login: salinan terakhir, kalau belum ada pakai bawaan. */
export const bacaCache = () => {
  try {
    const raw = localStorage.getItem(CACHE)
    return raw ? { ...DEFAULT_LOGIN, ...JSON.parse(raw) } : { ...DEFAULT_LOGIN }
  } catch { return { ...DEFAULT_LOGIN } }
}

export const hapusCache = () => { try { localStorage.removeItem(CACHE) } catch { /* abaikan */ } }

/** Gambar yang aktif saja. */
export const gambarAktif = (t) => (t.images || []).filter((g) => g.aktif !== false && g.src)

/** Pilih satu gambar acak — dipanggil sekali saat halaman dibuka, lalu dipertahankan. */
export const pilihGambar = (t) => {
  const list = gambarAktif(t)
  if (!list.length) return null
  return list[Math.floor(Math.random() * list.length)]
}

/**
 * Perkecil & kompres gambar di browser sebelum disimpan.
 * Mengembalikan data URL (JPEG) agar bisa disimpan di satu baris pengaturan.
 */
export function optimalkanGambar(file, { maks = 1400, mutu = 0.78 } = {}) {
  return new Promise((resolve, reject) => {
    if (!/^image\//.test(file.type)) return reject(new Error('File harus berupa gambar'))
    const fr = new FileReader()
    fr.onerror = () => reject(new Error('Gagal membaca file'))
    fr.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Gambar tidak bisa dibuka'))
      img.onload = () => {
        const skala = Math.min(1, maks / Math.max(img.width, img.height))
        const w = Math.round(img.width * skala); const h = Math.round(img.height * skala)
        const c = document.createElement('canvas'); c.width = w; c.height = h
        const ctx = c.getContext('2d')
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h)
        ctx.drawImage(img, 0, 0, w, h)
        resolve({ src: c.toDataURL('image/jpeg', mutu), w, h })
      }
      img.src = fr.result
    }
    fr.readAsDataURL(file)
  })
}

/** Perkiraan ukuran data URL dalam KB. */
export const kbDari = (src = '') => Math.round((src.length * 3) / 4 / 1024)
