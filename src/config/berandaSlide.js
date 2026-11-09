// ============================================================
//  SLIDE FOTO BERANDA — diatur Superadmin (Pengaturan → Slide Beranda),
//  disimpan di app_settings (key: 'beranda') supaya tampil untuk semua.
// ============================================================
export const MAKS_SLIDE = 8
export const JEDA_PILIHAN = [3, 5, 8, 10, 15, 20]
export const RASIO = { '16:9': 'aspect-video', '4:3': 'aspect-[4/3]', '21:9': 'aspect-[21/9]', '3:2': 'aspect-[3/2]' }
export const DEFAULT_BERANDA = {
  slides: [],       // [{ id, name, src, aktif, judul, ket }]
  jeda: 5,          // detik per foto
  tampil: 6,        // maksimal foto yang ikut diputar
  rasio: '16:9',
  acak: false,
  hp: true,         // ikut tampil di HP
}
export const pengaturanBeranda = (data) => ({
  ...DEFAULT_BERANDA,
  ...((data?.app_settings || []).find((r) => r.key === 'beranda') || {}),
})
export const slideAktif = (p) => (p.slides || []).filter((s) => s.aktif !== false && s.src).slice(0, Math.max(1, p.tampil || DEFAULT_BERANDA.tampil))
