# ATLAS Alfa — Ringkasan Proyek (cadangan 5 Nov 2026)

**Pemilik:** 247 Sworn Translator (masginanjar) · **Demo publik:** https://claude.ai/artifact/Gv1NvjTutHPmqBZgiBXXrR
**Repositori lama:** github.com/masginanjar/atlas-3 (ATLAS 3.0, arsip). **Rencana:** repo baru `atlas-alfa`.

## Teknologi
Vite + React 19 + Tailwind 3 + lucide-react + jszip. Build satu file: `npm run build:demo` → `dist-demo/index.html`;
build publik (PII dimasker): `npm run build:demo:public`. Data demo di localStorage `atlas-alfa-v19` (reseed bila `compact_v6` belum ada).
Lapisan data: `src/lib/db.js` (tabel) & `src/lib/integrations.js` (drive/file) — dua adapter ini yang diganti saat live (Supabase / PocketBase + R2).

## Role
superadmin, direktur, akunting, supervisor, cs (per cabang), admin_pusat, penerjemah, proofreader, otorisator (freelance tanpa cabang),
staf_apostille, koordinator vendor, vendor. 9 cabang: Bali, Jakarta, Semarang, Surabaya, Bandung, Yogyakarta, Medan, Makassar, Batam.
Sumber dana: ATS (Bali), PTI (Batam), PAL (apostille/legalisasi), ATI (Jakarta & lainnya).

## Alur kerja
- Terjemahan tersumpah internal: CS Input → Pilih Penerjemah (Supervisor) → Penerjemahan → Proofread → Otorisasi (klaim) → No. Registrasi (Admin Pusat) → Siap Print → Upload Scan → Siap Kirim.
- Terjemahan non tersumpah: CS Input → Penerjemahan → CS Final.
- Vendor terjemahan (tr_ext / tr_bill termin tagihan), apostille/legalisasi internal (antrian → diproses [checklist Permohonan/Verifikasi/Cetak] → selesai) & eksternal via vendor (pengajuan → ACC Direktur [pilih sumber dana] → pembayaran Akunting → order → proses vendor).
- Prioritas: Normal, Ekspres, Super Ekspres, Sameday (deadline otomatis +3/+2/+1/0 hari).
- Override "Lanjutkan ke Tahap Berikutnya" (Superadmin/Direktur/Admin Pusat) dengan alasan, tercatat di riwayat.

## Fitur utama yang sudah ada
Dashboard per role (Kerja Saya: To-Do kiri + Performa kanan; Perlu Perhatian 3 kelompok; Tim; Keuangan & Pengajuan 5 tab seragam; Operasional),
My Project (list/grid, filter deadline & cabang/print di judul kolom, grup merah muda lewat deadline, rincian sub project + download draft/scan/hasil),
Detail project (catatan menonjol, seksi pelanggan & pengiriman minimize, Kirim Ping, file manager, riwayat aktivitas),
Keuangan (sumber dana, pengajuan vendor/umum, tagihan vendor termin, petty cash + top up), Monitoring (superadmin, rekap rentang tanggal),
Aktivitas global, Notifikasi 3 tab (Notifikasi / Pembayaran + suara kasir / Ping + suara, maks 2×/hari), foto profil (Pengaturan → Profil),
form project dengan upload per dokumen (nama file = deskripsi), field ID Pemohon/NIB/SK untuk apostille-legalisasi.

## Belum bisa di mode demo (butuh backend live)
Aturan akses di server (RLS), klaim otorisasi atomik, refresh real-time antar pengguna, backup.

## Rencana go-live (disepakati 5 Nov 2026)
Pilihan tanpa server: Supabase (DB+Auth+Storage, region Singapura) + Cloudflare Pages (+R2). Alternatif hemat: VPS Hetzner SG + PocketBase + R2.
Langkah: (1) GitHub ✔ tersambung — perlu install Claude GitHub App agar bisa push; (2) Supabase project `atlas-alfa`; (3) Cloudflare.
Lalu: repo `atlas-alfa` → adapter db/drive → staging → uji 1 project nyata → migrasi data → produksi. Revisi via branch → link pratinjau → merge.

## Uji otomatis
Skrip Playwright di /home/claude (t70 semua role/halaman tanpa error, t79 mobile tanpa geser horizontal, t81 tugas per role, t85 alur non tersumpah end-to-end, dll.).
