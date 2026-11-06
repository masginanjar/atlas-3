// Saklar fitur ATLAS.
//
// CHAT_ENABLED — fitur chat internal (menu "Pesan Masuk", gelembung chat di
// bawah, ping antar rekan). Dimatikan sementara atas permintaan, bukan
// dihapus: ubah ke `true` dan semuanya hidup lagi seperti semula.
//
// Saat `false`, yang ikut berhenti:
//   • menu "Pesan Masuk" dan halamannya
//   • gelembung chat yang menempel di bawah layar
//   • penyegaran tabel `messages` tiap 10 detik
//   • langganan realtime ke tabel `messages` dan kanal siaran chat
//
// Data chat yang lama TIDAK dihapus — hanya tidak ditampilkan dan tidak
// diambil. Begitu dinyalakan lagi, riwayatnya muncul utuh.
//
// Catatan untuk menyalakan kembali: selain mengubah nilai di bawah, pastikan
// tabel `messages` ada di publikasi `supabase_realtime` di Supabase, supaya
// pesan baru tetap muncul seketika tanpa menunggu penyegaran berkala.
export const CHAT_ENABLED = false
