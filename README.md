# ATLAS Alfa — Manajemen Project

Web app manajemen project untuk penerjemahan & apostille. Bisa dipakai di HP (mobile first) dan terhubung ke **Zoho Books** (pelanggan & invoice), **InsForge** (login, role, database), dan **Google Drive** (penyimpanan file). Di-hosting di **Vercel**.

## Fitur

| Menu | Isi |
|---|---|
| **Dashboard** | Project aktif/selesai, deadline ≤ 2 hari, antrean bayar vendor, saldo petty cash, **Tugas saya** (sesuai role), posisi project per kategori |
| **My Project** | Tab kategori (TR Internal, TR Eksternal, AP Internal, AP Eksternal) + **Pembayaran Vendor** · cari · filter status · form project baru · detail + alur kerja per sub project |
| **Setting** | Profil · Petty Cash (mutasi & top up) · Penerjemah/Proofreader/Otorisator/Vendor · Pengguna & Role · Status Integrasi |

**Formulir input:** pelanggan dicari dari Zoho, nomor invoice dipilih dari invoice Zoho milik pelanggan tersebut (atau diketik manual) dan dipakai sebagai **nama project**. Lalu isi tentang project (kategori, cabang, deadline, prioritas) dan **sub project 1, 2, dst.** Satu sub project = satu dokumen, dan tiap sub project berjalan di alurnya sendiri.

### Alur kerja (edit di `src/config/workflows.js`)

- **Penerjemah Internal:** CS Input (+ dokumen sumber) → Supervisor pilih penerjemah → **To-Do Penerjemah**: upload hasil + pilih proofreader → **To-Do Proofreader**: Lanjut ke Otorisator → **To-Do Otorisator bersama** (Ambil & Proses, ada penanda sedang diproses) → **Siap Print** di cabang lokasi Print (Download / Print PDF) → Tandai Sudah Dicetak → Stempel basah & **Upload PDF Hasil Scan** → **Siap Kirim** (notifikasi ke CS penanggung jawab) → Selesai
- **Eksternal (Terjemahan / Apostille / Legalisasi via vendor):** Pengajuan (vendor + layanan dari Pengaturan Vendor + ongkir → total otomatis) → **Menunggu Persetujuan** (Direktur ACC) → **Disetujui — Menunggu Pembayaran** (Akunting pilih rekening vendor + upload bukti) → **Sudah Dibayar** (download bukti) → Akunting tekan Selesai
- **Apostille / Legalisasi Internal (Staf Apostille):** CS upload dokumen sumber → **Belum Diproses** (dashboard Staf Apostille, download dokumen sumber) → Mulai Proses → **Sedang Diproses** (upload bukti transfer tanpa nominal + upload hasil) → **Selesai** (notifikasi ke CS). **Biaya** (biaya proses + biaya lain, total otomatis) hanya diisi Supervisor/Direktur dan otomatis tercatat di petty cash cabang; staf tidak melihat panel biaya.

### Role

| | Superadmin | Supervisor | CS Cabang | Direktur | Akunting |
|---|---|---|---|---|---|
| Lihat cabang | Semua (filter) | Cabangnya | Cabangnya | Semua | Semua |
| Buat/edit project | ✓ | ✓ | ✓ | – | – |
| ACC pengajuan vendor | ✓ | – | – | ✓ | – |
| Bayar vendor & upload bukti | ✓ | – | – | – | ✓ |
| Pengaturan Vendor | ✓ | ✓ | – | – | ✓ |
| Pilih penerjemah, proofread, otorisasi | ✓ | ✓ | – | – | – |
| Kelola penerjemah & master data | ✓ | ✓ | – | – | – |
| Top up petty cash, kelola user, hapus project | ✓ | – | – | – | – |

**Penerjemah, Proofreader, Otorisator, dan Staf Apostille** adalah pengguna dengan login sendiri: mereka melihat **To-Do List** dan project yang ditugaskan (lintas cabang). Otorisator berbagi satu To-Do bersama dengan tombol *Ambil & Proses* (penanda sedang diproses 30 menit). Staf cabang lokasi **Print** melihat project yang dicetak di cabangnya. Notifikasi in-app (ikon lonceng) dikirim di setiap perpindahan tahap penting.

Cabang: Bali, Jakarta, Bandung. Untuk menambah cabang, ubah `BRANCHES` di `src/config/access.js`.

---

## Menjalankan

```bash
npm install
npm run dev          # buka http://localhost:5173
```

Kalau `VITE_INSFORGE_URL` kosong, app berjalan dalam **MODE DEMO**: data contoh tersimpan di browser, dan Anda bisa login sebagai role/cabang mana pun dengan satu klik.

## Menghubungkan ke layanan asli

Salin `.env.example` → `.env.local` (lokal) **dan** isi variabel yang sama di Vercel → Project → Settings → Environment Variables.

### 1. InsForge (login + database)
1. Buat project di insforge.dev, lalu salin **URL** dan **Anon Key** ke `VITE_INSFORGE_URL`, `VITE_INSFORGE_ANON_KEY`, dan `INSFORGE_URL`.
2. Buka Database → SQL Editor, lalu jalankan `db/schema.sql`. Ganti dulu email superadmin di bagian bawah file.
3. Buka Auth → Users, lalu buat akun login dengan **email yang sama** seperti di tabel `users`. Role dan cabang dibaca dari tabel `users`.
4. Pengguna berikutnya ditambahkan lewat menu Setting → Pengguna, dan akun login-nya dibuat di InsForge Auth.

> Periksa: fungsi `atlas_me()` di schema membaca `auth.users`. Sesuaikan nama skema/tabel auth kalau di InsForge Anda berbeda. Fungsi `db.token()` di `src/lib/db.js` mengambil token sesi untuk memanggil `/api`. Kalau versi SDK Anda memakai nama fungsi lain, sesuaikan di sana.

### 2. Zoho Books
1. Buka https://api-console.zoho.com (atau `.eu`/`.in` sesuai datacenter), pilih **Self Client**, lalu salin Client ID dan Secret.
2. Generate code dengan scope `ZohoBooks.contacts.READ,ZohoBooks.invoices.READ`, kemudian tukar code tersebut menjadi **refresh token**:
   ```bash
   curl -X POST "https://accounts.zoho.com/oauth/v2/token?code=KODE&client_id=ID&client_secret=SECRET&grant_type=authorization_code"
   ```
3. Organization ID ada di Zoho Books → Settings → Organization Profile.
4. Isi `ZOHO_DC` (mis. `com`), `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`, `ZOHO_ORG_ID`.

Endpoint: `/api/zoho/contacts?search=` dan `/api/zoho/invoices?customer_id=`.

### 3. Google Drive
1. Buka Google Cloud Console, aktifkan **Google Drive API**, lalu buat OAuth Client (Web).
2. Ambil refresh token dengan scope `https://www.googleapis.com/auth/drive` untuk akun Google pemilik folder. Cara mudahnya lewat OAuth Playground: centang "Use your own OAuth credentials".
3. Buat folder `ATLAS` di Drive dan salin ID dari URL-nya ke `GOOGLE_DRIVE_ROOT_FOLDER_ID`.

Struktur otomatis: `ATLAS / <Cabang> / <No Invoice> / file`. File diunggah **langsung dari browser ke Google** (sesi resumable dibuat di server), jadi tidak terkena batas ukuran Vercel.

### 4. Deploy ke Vercel
Push ke GitHub, Import di Vercel (framework: Vite), isi Environment Variables, lalu Deploy. Folder `api/` otomatis menjadi serverless functions.

---

## Struktur kode (supaya mudah dikembangkan)

```
src/config/workflows.js   ← tahapan alur kerja (ubah alur cukup di sini)
src/config/access.js      ← cabang, role, hak akses
src/lib/db.js             ← lapisan data: DEMO (localStorage) / LIVE (InsForge)
src/lib/integrations.js   ← panggilan Zoho & Google Drive
src/lib/store.jsx         ← state aplikasi + logika proses tahap & petty cash
src/pages/*               ← Dashboard, Projects, ProjectForm, ProjectDetail, Settings
api/                      ← Vercel Functions (kunci rahasia hanya di sini)
db/schema.sql             ← tabel + RLS InsForge
```

## Keamanan
- **Privasi pelanggan:** Penerjemah, Proofreader & Otorisator hanya melihat **nama** pelanggan (kontak, alamat pengiriman, kurir & resi disembunyikan). Di mode live, agar data benar-benar tidak terkirim ke perangkat mereka, ubah `db.list('projects')` untuk role tersebut agar membaca view `projects_worker` (lihat `db/schema.sql`) dan cabut akses langsung mereka ke tabel `projects`.
- Payload impor sistem lama yang ada di git hanya versi tersamar. Dump pelanggan, cadangan, dan `scripts/legacy/private/` tidak boleh di-commit. Build tidak lagi bisa memilih berkas tanpa samaran.
- Kunci Zoho & Google **hanya di server** (tanpa prefix `VITE_`).
- Setiap `/api` memeriksa token sesi InsForge.
- RLS membatasi project & petty cash per cabang. Superadmin bisa melihat semua cabang.

## Rencana berikutnya
- Sinkron otomatis invoice Zoho → project (webhook/cron)
- Notifikasi WhatsApp/email per tahap
- Laporan KPI per cabang/penerjemah
