# Laporan Impor Data Sistem Lama — projects-2026-11-04.xlsx

Dijalankan: 4 November 2026 · Sumber: 179 baris · Kunci proyek: No. Invoice (dasar) · Kunci subproyek: No. Invoice asli per baris

## Hasil
| | Jumlah |
|---|---|
| Proyek baru | **162** |
| Subproyek baru | **179** (1 baris sumber = 1 subproyek, 179/179 baris tercakup) |
| Proyek gabungan (>1 subproyek) | 13 |
| Kolom kosong yang dilengkapi di data yang sudah ada | 0 (tidak ada invoice yang sama dengan data sistem baru) |
| Duplikasi persis yang dilewati | 0 |
| Master baru | 9: Vendor: Bapak Deddy (Jerman), Vendor: Bapak Stanislaus (Prancis), Kurir: TIKI, Lembaga: Kementerian Agama, Vendor: Bapak Carlos (Spanyol), Kurir: DHL, Kurir: POS Indonesia, Vendor: Indotrans, Kurir: Paxel |
| Impor ulang (uji) | proyek +0, subproyek +0, master +0 → **aman diulang** |
| Data lama sistem baru | tidak berubah (diverifikasi: True) |
| Nilai keuangan | Sumber tidak memuat biaya/total/pembayaran → tidak ada nilai yang diimpor atau dijumlahkan |

## Penggabungan invoice (kategori jadi subproyek)
Sistem lama memberi akhiran pada nomor invoice (A, L, LU, LM, M, K, T, ENG, FRENCH, …). Proyek memakai nomor dasar 13 digit; nomor asli per baris disimpan di subproyek (`legacy_key`).
- 1012611037023: legalisasi + legalisasi + terjemahan
- 2022611034271: apostille + terjemahan
- 1012611037019: terjemahan + terjemahan
- 3062611031463: legalisasi + legalisasi + legalisasi + legalisasi
- 1012611037015: terjemahan + terjemahan
- 3032610271693: apostille + terjemahan
- 1012611037011: legalisasi + terjemahan
- 3042611031603: apostille + terjemahan
- 2022611024259: apostille + legalisasi + terjemahan
- 2022611024253: apostille + legalisasi
- 3032611021726: apostille + terjemahan
- 1012611026979: apostille + terjemahan
- 1012611016957: apostille + legalisasi

## Kolom yang tetap kosong (perlu dilengkapi)
- CS pembuat tidak terdaftar: 9 proyek (Santi ×8, Gin ×1)
- Penerjemah internal tidak terdaftar sebagai pengguna: 43 subproyek (Fuadah 15, Kaysha 13, Dwi 8, Nita 4, Dyah 2 — Dyah terdaftar sebagai proofreader, NONACTIVE 1)
- Staf apostille/legalisasi belum ditetapkan: 20 subproyek ("Jakarta | 247" / kosong)
- Lokasi print kosong: 24 proyek ("Mitra | Penerjemah", "Depok")
- Kurir kosong: 14 proyek ("Lainnya" atau kosong di sumber)
- Alamat pengiriman kosong: 89 proyek (template kosong di sumber). Alamat yang ada disimpan utuh di kolom Alamat; kota/provinsi/kode pos tidak dipecah.
- Negara apostille kosong: 4 (kode angka 80/43/106/116 tanpa tabel padanan)
- Lembaga legalisasi kosong: 1 ("Legalisasi Malaysia")
- Halaman per dokumen tidak diketahui: 77 subproyek terjemahan multi-dokumen (total halaman tetap tersimpan)
- Jam deadline: tidak ada di sumber → aplikasi memakai default 17:00. "Deadline Softcopy" kosong di semua baris; deadline diambil dari "Deadline Penerjemah".
- 29 subproyek vendor: biaya, layanan, ongkir & status bayar tidak ada → tahap "Pengajuan Vendor" dengan nominal kosong

## Perlu keputusan
- Tipe proses "Speed 100%" / "Speed 50%" / "Express" (24) disimpan apa adanya — petakan ke Speed/Super Speed?
- Vendor Pak Georgy: sumber = Rusia, master = Jerman (master tidak diubah). Sumber juga menyebut "Jerman | Pak Deddy".
- 6 baris "Jakarta | 247" dengan Print-out "Mitra | Penerjemah" dicatat sebagai proses internal.
- 10 perbedaan antar-baris pada invoice yang sama (prioritas/kurir/alamat/print) — dipakai nilai baris pertama, lainnya di daftar tinjauan.
- Cabang **Semarang** ditambahkan ke daftar cabang (8 proyek); pengguna CS Santi belum ada.

## Pemetaan status lama → tahap
Delivered/Completed → Selesai · O: Final + softcopy terkirim + softcopy only → Siap Kirim · O: Final lainnya → Siap Print · P: Siap Diproofreader → Pemeriksaan Proofreader · P: Sedang Dikerjakan / A: Belum/Sudah Dipesan → Penerjemahan (bila penerjemah terdaftar) atau Pilih Penerjemah · Proses kosong → CS Input · Apostille/Legalisasi: Open → CS Upload, Ordered/Sudah Dipesan → Belum Diproses, Softcopy/Draft terkirim → Sedang Diproses · Vendor → Pengajuan Vendor.
Status & proses asli tersimpan per subproyek (`data.legacy`) dan di Riwayat.

## Cadangan & jejak
- Sebelum perubahan pertama, aplikasi menyimpan cadangan data di browser: `atlas-alfa-v19:backup:projects-2026-11-04.xlsx`. Log impor: `import_runs`.
- Pemetaan baris tanpa kolom kontak: `mapping-2026-11-04.csv`. Ringkasan angka: `verifikasi-2026-11-04.json`. `transform.py` dapat dijalankan ulang pada ekspor lokal.
- Dump tanpa samaran, cadangan JSON, catatan tinjauan, dan folder `scripts/legacy/private/` tidak boleh di-commit (lihat `.gitignore`). Catatan tinjauan bisa memuat perbedaan alamat, jadi berkas itu tetap lokal.

## Versi publik (artifact)
Build demo dan build biasa memakai payload tersamar `payload-2026-11-04.masked.json`. Mode live (Supabase) tidak memuat dump itu. Nama pelanggan pada payload tersamar berbentuk inisial. Alamat, no. HP, catatan, dan isi dokumen tidak ikut. Nomor invoice, kategori, status, bahasa, jumlah, penerjemah/vendor, dan deadline tetap utuh.
