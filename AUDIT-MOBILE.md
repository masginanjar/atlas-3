# Audit tampilan HP dan tablet — ATLAS Alfa

Tanggal pemeriksaan: 5 November 2026.
Situs yang dicek: https://masginanjar.github.io/atlas-3/
Kode yang dicek: repositori ini, dijalankan di komputer sebagai mode demo (tanpa mengubah aplikasi).

Ini laporan baca-saja. Tidak ada kode aplikasi yang diubah.

## Kesimpulan singkat

Keluhan bahwa di HP elemen saling menimpa dan ukuran tidak mengikuti layar **benar**.

Penyebab utamanya bukan tag viewport (itu sudah benar). Penyebabnya adalah batang atas yang isinya lebih lebar daripada layar, tabel yang dipaksa sangat lebar, tombol “+” yang mengambang di atas daftar project, kalender 7 kolom yang terlalu sempit, dan tab notifikasi yang tidak muat.

Halaman masuk (login) sendiri sudah rapi di HP dan tablet. Masalah muncul **setelah masuk**, dan paling parah untuk akun yang melihat pilihan cabang: Superadmin, Admin Pusat, Supervisor, Direktur, Akunting, dan CS yang pegang lebih dari satu cabang. Akun satu cabang (contoh CS Bali dan penerjemah) batang atasnya muat di layar 360px.

Di tablet tegak (lebar 768), situasinya lebih parah: menu kiri model komputer sudah muncul, tetapi ikon di batang atas masih terlalu banyak, sehingga foto profil terdorong ke luar layar dan halaman bisa digeser ke samping.

## Cara pemeriksaan

Layar yang dicoba:

| Nama | Ukuran |
| --- | --- |
| HP kecil | 360 × 800 |
| HP sedang (iPhone) | 390 × 844 |
| HP besar (Android) | 412 × 915 |
| Tablet tegak | 768 × 1024 |

Situs live dibuka di halaman masuk dan di tautan portal tanpa login. Halaman dalam (Dashboard, Project, dan seterusnya) membutuhkan kata sandi, jadi diperiksa lewat mode demo dengan kode yang sama, masuk sebagai Super Admin. Batang atas juga dicoba sebagai Nikita (CS satu cabang), Intan (CS beberapa cabang), dan Wita (penerjemah).

Tag viewport di `index.html` sudah benar: `width=device-width, initial-scale=1`. Itu bukan sumber masalah.

## Yang sudah baik

- Halaman masuk live rapi di keempat ukuran. Tombol “Masuk” mudah diketuk. Tidak ada geser kiri-kanan. Bukti: `mobile-login-live-360.png` (juga 390, 412, dan 768).
- Menu “lainnya” di HP (lembar Menu) rapi, dua kolom, tidak bertumpuk. Bukti: `mobile-menu-360.png`.
- Menu bawah (Dashboard, My Project, Pesan Masuk, My Reminders, Menu) cukup tinggi untuk jari (sekitar 61px) dan tulisannya tidak terpotong di 360px.
- Daftar Faktur sudah disusun sebagai kartu, bukan tabel. Ini pola yang sebaiknya ditiru halaman lain. Bukti: `mobile-faktur-360.png`.
- Catatan (Notes) dan lembar detail project dari samping sebagian besar sudah menyesuaikan lebar HP. Bukti: `mobile-notes-360.png`, `mobile-project-sheet-360.png`.
- Portal pelanggan tanpa tautan yang sah tidak melebar ke samping. Bukti: `mobile-portal-360.png` dan `mobile-portal-live-360.png`.

## Masalah prioritas Tinggi

### 1. Batang atas lebih lebar daripada layar — foto profil terdorong keluar

- **Halaman:** semua halaman setelah masuk (Dashboard, Project, Faktur, Keuangan, dan seterusnya).
- **Berkas:** `src/App.jsx`, komponen batang atas (sekitar baris 170–199) dan nama aplikasi `Brand` (sekitar baris 254).
- **Bukti:** `mobile-dashboard-360.png`, `mobile-dashboard-390.png`, `mobile-dashboard-412.png`, `mobile-dashboard-768.png`.

**Apa yang terlihat**

Di HP, dari kiri: logo ATLAS, tombol Buat, lonceng, lalu kotak “Semua Cabang”. Foto profil ada di kanan kotak itu, tetapi tidak muat.

Ukuran isi batang atas yang terukur (akun Super Admin):

| Lebar layar | Isi batang atas | Kelebihan |
| --- | --- | --- |
| 360px | 437px | 77px ke kanan |
| 390px | 437px | 47px |
| 412px | 437px | 25px |
| 768px (kolom isi hanya 544px karena menu kiri) | 708px | 164px |

Akibatnya seluruh halaman bisa digeser ke samping. Itu yang terasa seperti “tampilan berantakan”: kartu ikut bergeser, dan tombol profil hanya ketemu kalau digeser.

Akun yang **tidak** melihat filter cabang (Nikita, Wita) tidak melebar di 360px. Akun Intan (beberapa cabang) melebar 77px, sama seperti Super Admin.

**Penyebab**

Batang atas memakai satu baris yang tidak boleh turun (`flex` tanpa bungkus). Di HP, filter cabang dikunci lebarnya sampai 118px (`max-w-[118px]`) dan tidak boleh menyusut lebih dulu daripada foto profil. Nama “ATLAS Alfa” juga tidak boleh memendek (`whitespace-nowrap`). Jumlahnya melebihi 360px.

Di lebar 768px ke atas, aplikasi menganggap ini “layar komputer”: menu kiri selebar 224px muncul (`md:flex`), dan sekaligus memunculkan ikon cari, lima tombol buat, daftar tim, tema, dan lencana Demo. Kolom yang tersisa tidak cukup.

**Perbaikan yang disarankan**

1. Di layar di bawah 768px, jangan taruh filter cabang di batang atas. Pindahkan ke lembar Menu, atau jadi satu ikon kecil yang membuka pilihan cabang. Yang wajib tetap kelihatan: logo, Buat, lonceng, foto profil.
2. Foto profil diberi `shrink-0` supaya tidak pernah terdorong keluar. Yang boleh menyusut hanya teks, bukan tombol.
3. Batang atas jangan membuat halaman ikut melebar. Kalau masih sisa, bungkus ke baris kedua (`flex-wrap`) atau beri gulir hanya di dalam batang atas, bukan di seluruh halaman.
4. Menu kiri model komputer baru dipakai mulai lebar 1024px (`lg`), bukan 768px. Di tablet tegak, tetap pakai menu bawah seperti HP, atau menu kiri yang bisa ditutup. Dengan begitu ikon yang sekarang muncul bersamaan di 768px tidak perlu ditampilkan semua.

### 2. Tombol “+” mengambang menutup isi daftar project

- **Halaman:** My Project.
- **Berkas:** `src/pages/Projects.jsx`, tombol `aria-label="Project baru"` (sekitar baris 174–178).
- **Bukti:** `mobile-projects-360.png` (tampilan kartu, tanggal “5 Nov” tertutup) dan `mobile-projects-list-360.png` (tombol mata/folder di baris bawah tertutup tombol +).

**Penyebab**

Tombol bulat dipasang menempel di kanan bawah (`fixed bottom-20 right-4`), di atas menu bawah. Daftar project tidak diberi ruang di kanan, jadi tanggal, nama tahap, dan tombol aksi lewat di bawahnya.

**Perbaikan yang disarankan**

Tombol “Buat” di batang atas sudah ada. Tombol “+” yang mengambang bisa dihilangkan di HP, atau daftar diberi jarak kanan (`pr-16` pada kartu/baris) dan jarak bawah yang lebih besar (`pb-36` pada `main` di `src/App.jsx`, sekarang `pb-28` hanya cukup untuk menu bawah, belum untuk tombol +).

### 3. Tabel lebar di Dashboard dan Monitoring — kolom terpotong

- **Halaman:** Dashboard (bagian “Perlu Penerjemah” dan tabel sejenis), Monitoring, sebagian Keuangan.
- **Berkas:**
  - `src/pages/Dashboard.jsx` tabel `min-w-[880px]` (sekitar baris 950), `min-w-[980px]` (sekitar baris 607), `min-w-[760px]` (sekitar baris 1074).
  - `src/pages/Monitoring.jsx` tabel `min-w-[760px]` dan satu tabel sekitar 854px (fungsi `PeopleTable`, sekitar baris 51 dan 165).
- **Bukti:** `mobile-dashboard-tabel-360.png`, `mobile-monitoring-360.png`.

**Apa yang terlihat**

Di HP, kartu “Perlu Penerjemah” hanya menampilkan dua kolom (invoice dan dokumen). Kolom bahasa, deadline, dan penerjemah ada di kanan, harus digeser di dalam kartu. Lebar tabel terukur 951px di dalam kotak selebar 336px.

Di dalam sel dokumen, tulisan “Pengajuan vendor — vendor kosong” (`Dashboard.jsx` sekitar baris 975) tidak dibatasi lebarnya, sehingga bisa keluar dari kolom dan menimpa teks di sebelahnya.

Di Monitoring, judul kolom “Halaman…” terpotong jadi “HALA”.

**Penyebab**

Tabel dipaksa punya lebar minimum ratusan piksel. Pembungkusnya boleh digeser (`overflow-x-auto`), jadi halaman tidak selalu melebar, tetapi isinya tidak bisa dibaca tanpa geser samping. Di HP itu mudah terasa seperti tampilan rusak.

**Perbaikan yang disarankan**

Di layar di bawah 1024px, jangan pakai tabel. Susun satu kartu per baris, seperti daftar di `src/pages/Invoices.jsx` (sudah `grid` di HP dan kolom hanya di `lg`). Label ditulis di atas nilainya: Invoice, Dokumen, Bahasa, Deadline, Penerjemah. Chip “vendor kosong” diberi `max-w-full` dan boleh turun baris (`break-words`).

## Masalah prioritas Sedang

### 4. Kalender tidak bisa dibaca di HP

- **Halaman:** Calendar.
- **Berkas:** `src/pages/Calendar.jsx`, kotak `grid-cols-7` (sekitar baris 78–98). Tulisan acara `text-[10px]` dan `truncate`.
- **Bukti:** `mobile-calendar-360.png`, `mobile-calendar-768.png`.

Di 360px satu hari hanya sekitar 48px. Isi acara terlihat sebagai “07…”. Di tablet 768 isi sedikit lebih panjang (“07.21 IN…”) tetapi nomor invoice tetap terpotong.

**Perbaikan:** di bawah 768px tampilkan daftar per hari (tanggal, jam, nama project), bukan kotak 7 kolom. Kotak bulan boleh tetap sebagai pemilih tanggal, dengan titik warna saja, lalu daftar acaranya di bawah.

### 5. Tab notifikasi terpotong

- **Halaman:** panel lonceng, semua halaman.
- **Berkas:** `src/components/NotificationBell.jsx` (sekitar baris 66–83).
- **Bukti:** `mobile-notifikasi-360.png`.

Untuk pimpinan ada empat tab: Notifikasi, Perlu Penerjemah, Pembayaran, Ping, plus tombol suara. Semuanya satu baris yang tidak boleh turun dan panelnya memotong sisanya (`overflow-hidden`). Di 360px tab “Ping” terpotong dan tombol suara tidak kelihatan. Label “Perlu Penerjemah” sudah disembunyikan di bawah 480px, tetapi itu belum cukup.

**Perbaikan:** baris tab boleh digeser (`overflow-x-auto`), atau di HP cukup ikon. Tombol suara pindah ke baris judul, jangan berebut tempat dengan tab.

### 6. Bilah alat My Project tidak muat satu baris

- **Halaman:** My Project.
- **Berkas:** `src/pages/Projects.jsx` (sekitar baris 92–135): pencarian, status Aktif, urutan, tampilan kartu/list, tampilan tersimpan, dan ekspor CSV dalam satu `flex` yang tidak membungkus.
- **Bukti:** `mobile-projects-360.png` dan `mobile-projects-list-360.png`. Di tampilan list, lebar halaman terukur 461px (kelebihan 101px, lebih besar daripada batang atas saja).

Tombol simpan tampilan dan unduh CSV ada di kanan dan terpotong. Pengguna tidak tahu tombol itu ada kecuali menggeser seluruh halaman.

**Perbaikan:** pencarian satu baris penuh. Tombol sisanya dibungkus ke baris berikutnya (`flex-wrap`) atau disatukan dalam tombol “Filter”.

### 7. Kotak ketik pesan menempel ke menu bawah

- **Halaman:** Pesan Masuk, saat percakapan dibuka.
- **Berkas:** `src/pages/Pesan.jsx` kartu chat (sekitar baris 146): tinggi dihitung `100vh` dikurangi batang atas dan 172px, dengan `min-h-[420px]`.
- **Bukti:** `mobile-pesan-thread-360.png`.

Di 360×800, tepi bawah kotak ketik hanya sekitar 7px di atas menu bawah. Placeholder “ketik # untuk menautkan project” turun ke baris kedua dan terlihat terpotong.

**Perbaikan:** pakai `100dvh` (tinggi layar yang benar-benar terlihat) dan kurangi juga tinggi menu bawah (sekitar 62px plus jarak aman). Jangan pakai `min-h-[420px]` kalau sisa layar lebih pendek dari itu.

### 8. Tab Setting panjang dan scrollbar disembunyikan

- **Halaman:** Setting.
- **Berkas:** `src/components/ui.jsx` komponen `Tabs` (sekitar baris 160–173), dipakai `src/pages/Settings.jsx`.
- **Bukti:** `mobile-settings-360.png`.

Yang kelihatan: Profil, Petty Cash, Master Data, Vendor. Tab Kurir, Pengguna, File, dan Integrasi ada di kanan, tetapi garis gesernya disembunyikan (`scrollbar-width: none`). Orang yang tidak tahu bisa mengira hanya ada empat tab.

**Perbaikan:** di HP, tab turun jadi beberapa baris, atau beri panah/bayangan di tepi kanan supaya kelihatan masih ada lanjutan.

## Masalah prioritas Rendah

### 9. Banyak tombol lebih kecil daripada ujung jari

Tombol ikon di batang atas dan di baris project berukuran 28–32px (`h-7 w-7`, `h-8 w-8`). Saran yang nyaman untuk jari adalah sekitar 44px. Menu bawah sudah cukup besar. Yang paling terasa: tombol Buat (tinggi 28px), lonceng (32px), dan tiga ikon mata/folder/panah di baris project (`src/pages/Projects.jsx` sekitar baris 371–375).

**Perbaikan:** di HP, tombol yang sering diketuk minimal `h-11 w-11` (44px), atau perbesar area ketuk tanpa memperbesar ikonnya (`p-2` pada pembungkus).

### 10. Huruf 10–11px untuk informasi yang harus dibaca

Badan teks 14px sudah cukup. Yang kecil: label menu bawah `text-[10px]` di `src/App.jsx` (sekitar baris 216), badge, dan acara kalender. Menu bawah masih terbaca karena katanya pendek. Kalender tidak (sudah masuk prioritas Sedang).

**Perbaikan:** teks yang berisi arti (bukan sekadar hiasan) minimal 12px.

### 11. Angka “3” di lonceng menempel di tepi ikon

Lencana jumlah di `src/components/NotificationBell.jsx` (`absolute -right-1 -top-1`) sedikit keluar dari kotak tombol. Bukan pemblokir, tetapi ikut terasa sesak di batang atas yang sudah penuh.

## Lima perbaikan yang paling berguna, berurutan

1. **Rapikan batang atas** di `src/App.jsx`: di HP hanya logo, Buat, lonceng, dan foto profil. Filter cabang pindah ke menu. Foto profil tidak boleh terdorong keluar. Menu kiri komputer baru muncul di lebar 1024px.
2. **Ganti tabel lebar menjadi kartu** di Dashboard dan Monitoring (tiru halaman Faktur).
3. **Singkirkan atau geser tombol “+”** di My Project supaya tidak menutup tanggal dan tombol aksi.
4. **Kalender HP jadi daftar harian**, bukan kotak tujuh kolom.
5. **Tab notifikasi dan bilah alat Project boleh membungkus atau digeser di dalam panelnya sendiri**, supaya tidak memotong Ping, tombol suara, dan tombol unduh.

Setelah lima ini, geser kiri-kanan di halaman utama akan hilang, dan bagian yang sering dipakai (profil, daftar project, penerjemah, kalender) bisa dibaca tanpa menggeser samping.

## Keamanan — catatan singkat, tanpa membuka rahasia

Ini bukan audit keamanan penuh. Yang ketemu sambil memeriksa tampilan:

- **Tidak ada kunci `service_role` Supabase di kode yang dikirim ke browser.** Kata `sb_secret_` yang muncul di berkas JavaScript situs hanya pemeriksaan nama di dalam pustaka Supabase, bukan kunci yang tersimpan.
- Kunci yang benar-benar ditanam di situs dan di `.github/workflows/deploy-pages.yml` berjenis **publishable** (awalan `sb_publishable_`). Nilainya saya sembunyikan. Kunci jenis ini memang dibuat untuk berada di browser, **asalkan** aturan database (RLS) menolak orang yang belum login.
- Saya mencoba membaca tabel tanpa login, hanya untuk melihat apakah pintunya terbuka. Hasilnya: `projects`, `users`, `people`, `petty_cash`, `zoho_invoices`, dan `zoho_contacts` mengembalikan nol baris. `notes`, `messages`, dan `zoho_config` ditolak. Jadi **saat ini data dan rahasia Zoho tidak terbaca tanpa login**.
- Rahasia Zoho (client secret dan refresh token) tidak ada di kode tampilan. Penyimpanannya di fungsi server `supabase/functions/zoho-sync/index.ts` dan tabel `zoho_config`, yang menolak akses tanpa login.
- Yang tetap perlu dibereskan: jangan menulis kunci itu langsung di file workflow. Pindahkan ke rahasia GitHub Actions, lalu build membaca dari sana. Kalau suatu saat seseorang menggantinya dengan kunci service role di file yang sama, kunci itu akan ikut terbit ke situs yang bisa dibuka siapa saja.
- File `db/schema.sql` (skema lama) mengingatkan bahwa penerjemah seharusnya hanya menerima nama pelanggan, lewat view `projects_worker`. Aplikasi live membaca tabel `projects` utuh (`src/lib/supabase.js`). Pastikan aturan di Supabase yang sedang dipakai benar-benar menyembunyikan nomor HP dan alamat dari peran penerjemah, proofreader, dan otorisator. Ini tidak saya buktikan dengan akun sungguhan, karena tidak ada kata sandi.

## Halaman yang diperiksa

| Halaman | Live (tanpa login) | Demo, setelah masuk | Catatan |
| --- | --- | --- | --- |
| Masuk | 360, 390, 412, 768 | 360, 390, 412, 768 | Rapi |
| Portal `#/p/…` | 360 | 360 | Rapi untuk tautan yang tidak dikenal |
| Dashboard | — | 360, 390, 412, 768 | Batang atas + tabel |
| My Project | — | 360, 390, 412, 768, plus list dan lembar detail | Tombol + dan bilah alat |
| Faktur | — | 360 | Sudah baik (kartu) |
| My Apostille | — | 360 | Ikut masalah batang atas |
| Calendar | — | 360, 768 | Kotak hari terlalu sempit |
| Pesan Masuk | — | 360, 390, 768, plus percakapan | Kotak ketik menempel menu bawah |
| My Reminders | — | 360 | Ikut batang atas |
| Notes | — | 360 | Isi halaman baik |
| Pengajuan | — | 360 | Ikut batang atas |
| Keuangan | — | 360, 412 | Kartu dana baik; tabel lain ikut pola geser |
| Monitoring | — | 360, 768 | Tabel terpotong |
| Aktivitas | — | 360, 768 | Ikut batang atas |
| Setting | — | 360, 768, plus tab Pengguna | Tab panjang |
| Lembar Menu | — | 360 | Baik |
| Panel notifikasi | — | 360 | Tab terpotong |

Akun demo tambahan untuk batang atas saja: Nikita (muat), Wita (muat), Intan (tidak muat).
