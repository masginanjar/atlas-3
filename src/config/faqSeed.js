// ============================================================
//  FAQ & PANDUAN CS — isi awal sebagai CONTOH, bukan kebijakan resmi.
//  Percakapan fiktif: tanpa nomor HP, invoice, atau dokumen pelanggan asli.
//  Pengelola bisa mengubah, menambah, dan mengarsipkan lewat aplikasi.
// ============================================================
export const FAQ_KATEGORI = ['Progres & Status', 'Pembayaran', 'Dokumen & Revisi', 'Pengiriman', 'Portal Pelanggan', 'Lainnya']

export const FAQ_SEED = [
  {
    pertanyaan: 'Bagaimana menjawab pelanggan yang menanyakan progres?',
    kategori: 'Progres & Status',
    panduan: 'Periksa invoice dan tahap terakhir di proyek. Sebutkan tahap yang tercatat; jangan menjanjikan waktu selesai yang belum dikonfirmasi.',
    balasan: 'Baik, Bapak/Ibu. Pesanan [nomor invoice] saat ini berada pada tahap [tahap terakhir].',
    balasan_en: 'Dear Sir/Madam, your order [nomor invoice] is currently at the [tahap terakhir] stage.',
    kata_kunci: 'progres, status, sampai mana, sudah sampai mana, update',
    eskalasi: 'Bila pelanggan mendesak tanggal pasti, teruskan ke Direktur.',
    mulai_di_sini: true,
  },
  {
    pertanyaan: 'Pelanggan sudah transfer, tetapi invoice belum lunas. Apa yang dilakukan?',
    kategori: 'Pembayaran',
    panduan: 'Cocokkan invoice dan status pembayaran terakhir. Jika berbeda dari keterangan pelanggan, teruskan ke admin yang berwenang.',
    balasan: 'Terima kasih atas informasinya, Bapak/Ibu. Kami akan mencocokkan pembayaran dengan invoice [nomor invoice] dan mengabari setelah statusnya terkonfirmasi.',
    balasan_en: 'Thank you for letting us know. We will match your payment with invoice [nomor invoice] and update you once it is confirmed.',
    kata_kunci: 'transfer, bayar, lunas, pembayaran, bukti transfer',
    eskalasi: 'Selisih nominal atau bukti transfer meragukan — teruskan ke Akunting.',
    mulai_di_sini: true,
  },
  {
    pertanyaan: 'Pelanggan menemukan kesalahan pada draft. Apa yang perlu diminta?',
    kategori: 'Dokumen & Revisi',
    panduan: 'Catat versi draft, halaman, bagian yang perlu diperiksa, dan koreksi yang diminta. Teruskan ke penanggung jawab proyek.',
    balasan: 'Mohon sebutkan halaman dan bagian pada draft yang perlu diperiksa, Bapak/Ibu, agar tim kami dapat meninjau koreksinya.',
    kata_kunci: 'revisi, salah, koreksi, draft, perbaikan',
    eskalasi: 'Bila revisi menyangkut isi terjemahan, teruskan ke penerjemah dan proofreader.',
    mulai_di_sini: true,
  },
  {
    pertanyaan: 'Mengapa pelanggan belum bisa mengunduh PDF final?',
    kategori: 'Portal Pelanggan',
    panduan: 'Periksa apakah versi final sudah disetujui, dibagikan ke pelanggan, dan akses invoice masih aktif. Jangan mengirim file kerja sebagai pengganti.',
    balasan: 'Saya bantu cek ketersediaan PDF final untuk pesanan Bapak/Ibu. Setelah dibagikan, file akan muncul di portal pelanggan.',
    kata_kunci: 'pdf, final, unduh, download, tidak bisa buka',
    eskalasi: 'Bila final sudah disetujui tapi tetap tidak muncul, teruskan ke admin.',
    mulai_di_sini: false,
  },
  {
    pertanyaan: 'Bagaimana menjawab pertanyaan tentang resi?',
    kategori: 'Pengiriman',
    panduan: 'Periksa apakah dokumen telah diserahkan ke kurir dan resi sudah tercatat. Jika belum, jangan menyatakan dokumen sudah dikirim.',
    balasan: 'Saya cek status pengirimannya terlebih dahulu, Bapak/Ibu. Jika dokumen sudah diserahkan ke kurir, saya akan informasikan nomor resinya.',
    balasan_en: 'Let me check the delivery status first. Once the documents are handed to the courier, I will share the tracking number with you.',
    kata_kunci: 'resi, kirim, pengiriman, kurir, ekspedisi, tracking, lacak',
    eskalasi: 'Paket hilang atau resi tidak bergerak lebih dari 3 hari — teruskan ke Direktur.',
    mulai_di_sini: true,
  },
  {
    pertanyaan: 'Apa yang dilakukan jika akses portal sudah berakhir?',
    kategori: 'Portal Pelanggan',
    panduan: 'Periksa masa akses invoice. Teruskan permintaan perpanjangan ke admin berwenang tanpa menjanjikan akses sudah aktif kembali.',
    balasan: 'Masa akses pesanan ini telah berakhir. Saya bantu ajukan permintaan pembukaan kembali kepada admin, Bapak/Ibu.',
    kata_kunci: 'akses, portal, kedaluwarsa, berakhir, expired, link mati',
    eskalasi: 'Perpanjangan akses hanya oleh admin berwenang.',
    mulai_di_sini: false,
  },
]
