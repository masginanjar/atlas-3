// ============================================================
//  "YANG BARU DI ATLAS" — catatan versi untuk tim.
//  Tambah entri BARU DI ATAS setiap kali ada update yang terasa oleh tim.
//  id harus unik & naik (dipakai untuk "sudah dibaca" per pengguna).
//  peran (opsional) = hanya tampil untuk peran tsb.
//  Jangan tulis fitur rahasia/tersembunyi di sini.
// ============================================================

export const CHANGELOG = [
  {
    id: 10, tanggal: '2026-11-15', judul: 'Pengiriman: Pos Indonesia, DHL & ekspedisi lain',
    poin: [
      { teks: 'Buat Pengiriman bisa pakai Pos Indonesia, DHL, atau ekspedisi lain: isi resi, ongkir & foto struk. Ekspedisi bawaan mengikuti cabang.' },
      { teks: 'Kiriman manual: tombol Perbarui status (tercatat siapa & kapan) dan Lacak di situs ekspedisi.' },
      { teks: 'Top-up saldo Everpro dicatat lengkap dengan bukti. Saldo, laporan, pengaturan, tarik/impor data & pembatalan khusus Superadmin, Direktur & Admin Pusat.', peran: ['superadmin', 'direktur', 'admin_pusat'] },
    ],
  },
  {
    id: 9, tanggal: '2026-11-15', judul: 'Modul Pengiriman lengkap (Everpro)',
    poin: [
      { teks: 'Menu Pengiriman: Ringkasan, Daftar, Buat Pengiriman (5 langkah, draft tersimpan), Cek Ongkir, Draft & Impor, Buku Alamat, Label & Serah Terima, Kendala/Retur/Klaim, Laporan.' },
      { teks: 'Dari detail project: tombol Buat Pengiriman. Satu project bisa punya beberapa pengiriman (dokumen masuk, hasil keluar, antar-cabang, kirim ulang).' },
      { teks: 'Tarif dicek ulang sebelum memesan dan klik ganda tidak membuat order dobel.' },
      { teks: 'Saldo & Mutasi: impor laporan Everpro, rekonsiliasi cashback/refund/selisih ongkir.', peran: ['superadmin', 'direktur', 'admin_pusat'] },
    ],
  },
  {
    id: 8, tanggal: '2026-11-14', judul: 'Kirim dokumen lewat Everpro langsung dari ATLAS',
    poin: [
      { teks: 'Project → Alamat Pengiriman → Pesan Kurir: cek ongkir semua kurir, pilih jadwal jemput atau antar ke agen, resi terbit otomatis.' },
      { teks: 'Setelah resi terbit: salin resi, kirim resi ke pelanggan lewat WhatsApp, Cetak label, dan Lacak paket. Status ikut berubah sendiri; paket diterima → tahap kirim Selesai.' },
      { teks: 'Pilih kurir kini lewat popup yang lebih lega.' },
      { teks: 'Menu baru Pengiriman: Daftar Kiriman (semua kiriman Everpro — saring status, cari resi/penerima, cetak banyak label sekaligus, lacak, unduh Excel), Alamat Pengirim per cabang, dan Kurir.', peran: ['superadmin', 'direktur', 'admin_pusat', 'akunting', 'supervisor'] },
    ],
  },
  {
    id: 7, tanggal: '2026-11-14', judul: 'Unduh Excel, pasang ATLAS di HP, & catatan versi',
    poin: [
      { teks: 'ATLAS bisa dipasang seperti aplikasi di HP & laptop — menu profil → Pasang aplikasi.' },
      { teks: 'Halaman "Yang baru di ATLAS" ini: muncul sekali setiap ada update, bisa dibuka lagi dari menu profil.' },
      { teks: 'Unduh data sekarang berupa file Excel rapi (judul kolom tebal, filter, angka rupiah). Tersedia Project, Dokumen, Pelanggan, Kas Kecil, Pengajuan & Tagihan Vendor.', peran: ['superadmin', 'direktur', 'akunting'] },
    ],
  },
  {
    id: 6, tanggal: '2026-11-14', judul: 'Alamat baru & Upload Bukti Transfer Massal',
    poin: [
      { teks: 'ATLAS pindah ke alamat app.247translator.id. Alamat lama otomatis dialihkan.' },
      { teks: 'Keuangan → + → Upload Bukti Transfer Massal: satu screenshot internet banking dipotong per transaksi dan dicocokkan otomatis ke pengajuan "Perlu transfer".', peran: ['superadmin', 'akunting'] },
      { teks: 'Ikon Project & Pengajuan di kanan atas untuk pindah halaman lebih cepat.' },
      { teks: 'Project: Koordinator & Apostille jadi tombol sendiri di samping "Project saya".' },
      { teks: 'Menu kiri lebih ramping; baris tim penerjemah menampilkan Cabang & nama CS.' },
    ],
  },
  {
    id: 5, tanggal: '2026-11-14', judul: 'Menu HP baru, Data Pribadi & File Project',
    poin: [
      { teks: 'Menu di HP dikelompokkan, dengan bagian "Sering dipakai".' },
      { teks: 'Setting → Profil: isi Data Pribadi (KTP, KK, alamat, kontak darurat). Hanya Anda & pimpinan yang bisa melihat.' },
      { teks: 'File Project & Dokumen tampil seperti folder Windows (Detail / List / Ikon) dengan pratinjau PDF kecil.' },
      { teks: 'Pencarian, tim online & notifikasi pindah ke ikon kecil di kanan atas.' },
    ],
  },
  {
    id: 4, tanggal: '2026-11-13', judul: 'Toolbar ringkas & kerja dari baris project',
    poin: [
      { teks: 'Toolbar setiap halaman lebih kecil dan seragam; baris pintasan bisa diciutkan.' },
      { teks: 'Hanya ikon mata yang membuka detail project — semua pekerjaan lain langsung dari baris.' },
      { teks: 'Ekspor Excel Nomor Register dalam format upload sistem.', peran: ['superadmin', 'direktur', 'admin_pusat'] },
    ],
  },
  {
    id: 3, tanggal: '2026-11-12', judul: 'Tampilan baru ATLAS',
    poin: [
      { teks: 'Desain baru di semua halaman; tombol aksi per tahap langsung di baris project.' },
      { teks: 'Tugaskan penerjemah dengan melihat kapasitas di tanggal deadline.', peran: ['superadmin', 'direktur', 'supervisor'] },
    ],
  },
  {
    id: 2, tanggal: '2026-11-10', judul: 'Nomor Register otomatis & Laporan Otorisasi',
    poin: [
      { teks: 'Nomor Register terbit otomatis setelah otorisasi (dicek Admin Pusat).' },
      { teks: 'Laporan Otorisasi per bulan, bisa diunduh PDF/Excel.' },
    ],
  },
]

export const VERSI_TERBARU = CHANGELOG[0]?.id || 0

/** Entri yang relevan untuk pengguna ini (poin dengan `peran` disaring). */
export function changelogUntuk(user) {
  const peran = [user?.role, user?.base_role, ...(user?.extra_roles || [])].filter(Boolean)
  return CHANGELOG.map((e) => ({ ...e, poin: e.poin.filter((p) => !p.peran || p.peran.some((r) => peran.includes(r))) })).filter((e) => e.poin.length)
}
