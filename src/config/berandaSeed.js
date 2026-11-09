// ============================================================
//  ISI BERANDA — ayat harian, kata mutiara, fakta unik.
//  Berganti tiap hari (urut berdasarkan hari ke-N dalam tahun).
//  Terjemahan ayat mengikuti Terjemahan Kemenag.
// ============================================================

export const AYAT = [
  { surah: 'Al-Insyirah', no: 94, ayat: '5–6', arab: ['فَإِنَّ مَعَ ٱلْعُسْرِ يُسْرًا', 'إِنَّ مَعَ ٱلْعُسْرِ يُسْرًا'], arti: 'Maka sesungguhnya bersama kesulitan ada kemudahan. Sesungguhnya bersama kesulitan ada kemudahan.' },
  { surah: 'Al-Baqarah', no: 2, ayat: '286', arab: ['لَا يُكَلِّفُ ٱللَّهُ نَفْسًا إِلَّا وُسْعَهَا'], arti: 'Allah tidak membebani seseorang melainkan sesuai dengan kesanggupannya.' },
  { surah: 'Ar-Ra\'d', no: 13, ayat: '28', arab: ['أَلَا بِذِكْرِ ٱللَّهِ تَطْمَئِنُّ ٱلْقُلُوبُ'], arti: 'Ingatlah, hanya dengan mengingat Allah hati menjadi tenteram.' },
  { surah: 'At-Talaq', no: 65, ayat: '3', arab: ['وَمَن يَتَوَكَّلْ عَلَى ٱللَّهِ فَهُوَ حَسْبُهُۥ'], arti: 'Dan barangsiapa bertawakal kepada Allah, niscaya Allah akan mencukupkan (keperluan)nya.' },
  { surah: 'Al-Baqarah', no: 2, ayat: '153', arab: ['يَٰٓأَيُّهَا ٱلَّذِينَ ءَامَنُوا۟ ٱسْتَعِينُوا۟ بِٱلصَّبْرِ وَٱلصَّلَوٰةِ ۚ إِنَّ ٱللَّهَ مَعَ ٱلصَّٰبِرِينَ'], arti: 'Wahai orang-orang yang beriman! Mohonlah pertolongan (kepada Allah) dengan sabar dan salat. Sungguh, Allah beserta orang-orang yang sabar.' },
  { surah: 'Ibrahim', no: 14, ayat: '7', arab: ['لَئِن شَكَرْتُمْ لَأَزِيدَنَّكُمْ'], arti: 'Sesungguhnya jika kamu bersyukur, niscaya Aku akan menambah (nikmat) kepadamu.' },
  { surah: 'Al-Baqarah', no: 2, ayat: '152', arab: ['فَٱذْكُرُونِىٓ أَذْكُرْكُمْ وَٱشْكُرُوا۟ لِى وَلَا تَكْفُرُونِ'], arti: 'Maka ingatlah kepada-Ku, Aku pun akan ingat kepadamu. Bersyukurlah kepada-Ku, dan janganlah kamu ingkar kepada-Ku.' },
  { surah: 'Az-Zumar', no: 39, ayat: '53', arab: ['لَا تَقْنَطُوا۟ مِن رَّحْمَةِ ٱللَّهِ ۚ إِنَّ ٱللَّهَ يَغْفِرُ ٱلذُّنُوبَ جَمِيعًا'], arti: 'Janganlah kamu berputus asa dari rahmat Allah. Sesungguhnya Allah mengampuni dosa-dosa semuanya.' },
  { surah: 'Al-Hujurat', no: 49, ayat: '13', arab: ['إِنَّ أَكْرَمَكُمْ عِندَ ٱللَّهِ أَتْقَىٰكُمْ'], arti: 'Sesungguhnya yang paling mulia di antara kamu di sisi Allah ialah orang yang paling bertakwa.' },
  { surah: 'Al-Ankabut', no: 29, ayat: '69', arab: ['وَٱلَّذِينَ جَٰهَدُوا۟ فِينَا لَنَهْدِيَنَّهُمْ سُبُلَنَا'], arti: 'Dan orang-orang yang berjihad untuk (mencari keridaan) Kami, Kami akan tunjukkan kepada mereka jalan-jalan Kami.' },
  { surah: 'Al-Mujadalah', no: 58, ayat: '11', arab: ['يَرْفَعِ ٱللَّهُ ٱلَّذِينَ ءَامَنُوا۟ مِنكُمْ وَٱلَّذِينَ أُوتُوا۟ ٱلْعِلْمَ دَرَجَٰتٍ'], arti: 'Allah akan mengangkat (derajat) orang-orang yang beriman di antaramu dan orang-orang yang diberi ilmu beberapa derajat.' },
  { surah: 'Al-Isra\'', no: 17, ayat: '7', arab: ['إِنْ أَحْسَنتُمْ أَحْسَنتُمْ لِأَنفُسِكُمْ'], arti: 'Jika kamu berbuat baik (berarti) kamu berbuat baik untuk dirimu sendiri.' },
  { surah: 'An-Nahl', no: 16, ayat: '90', arab: ['إِنَّ ٱللَّهَ يَأْمُرُ بِٱلْعَدْلِ وَٱلْإِحْسَٰنِ'], arti: 'Sesungguhnya Allah menyuruh (kamu) berlaku adil dan berbuat kebajikan.' },
  { surah: 'Al-Asr', no: 103, ayat: '1–3', arab: ['وَٱلْعَصْرِ', 'إِنَّ ٱلْإِنسَٰنَ لَفِى خُسْرٍ', 'إِلَّا ٱلَّذِينَ ءَامَنُوا۟ وَعَمِلُوا۟ ٱلصَّٰلِحَٰتِ وَتَوَاصَوْا۟ بِٱلْحَقِّ وَتَوَاصَوْا۟ بِٱلصَّبْرِ'], arti: 'Demi masa. Sungguh, manusia berada dalam kerugian, kecuali orang-orang yang beriman dan mengerjakan kebajikan serta saling menasihati untuk kebenaran dan saling menasihati untuk kesabaran.' },
  { surah: 'Al-Baqarah', no: 2, ayat: '45', arab: ['وَٱسْتَعِينُوا۟ بِٱلصَّبْرِ وَٱلصَّلَوٰةِ ۚ وَإِنَّهَا لَكَبِيرَةٌ إِلَّا عَلَى ٱلْخَٰشِعِينَ'], arti: 'Dan mohonlah pertolongan (kepada Allah) dengan sabar dan salat. Dan (salat) itu sungguh berat, kecuali bagi orang-orang yang khusyuk.' },
  { surah: 'Al-Furqan', no: 25, ayat: '63', arab: ['وَعِبَادُ ٱلرَّحْمَٰنِ ٱلَّذِينَ يَمْشُونَ عَلَى ٱلْأَرْضِ هَوْنًا'], arti: 'Adapun hamba-hamba Tuhan Yang Maha Pengasih itu adalah orang-orang yang berjalan di bumi dengan rendah hati.' },
  { surah: 'Al-Ma\'idah', no: 5, ayat: '2', arab: ['وَتَعَاوَنُوا۟ عَلَى ٱلْبِرِّ وَٱلتَّقْوَىٰ ۖ وَلَا تَعَاوَنُوا۟ عَلَى ٱلْإِثْمِ وَٱلْعُدْوَٰنِ'], arti: 'Dan tolong-menolonglah kamu dalam (mengerjakan) kebajikan dan takwa, dan jangan tolong-menolong dalam berbuat dosa dan permusuhan.' },
  { surah: 'Al-Baqarah', no: 2, ayat: '186', arab: ['وَإِذَا سَأَلَكَ عِبَادِى عَنِّى فَإِنِّى قَرِيبٌ'], arti: 'Dan apabila hamba-hamba-Ku bertanya kepadamu (Muhammad) tentang Aku, maka sesungguhnya Aku dekat.' },
  { surah: 'Ali Imran', no: 3, ayat: '139', arab: ['وَلَا تَهِنُوا۟ وَلَا تَحْزَنُوا۟ وَأَنتُمُ ٱلْأَعْلَوْنَ إِن كُنتُم مُّؤْمِنِينَ'], arti: 'Dan janganlah kamu (merasa) lemah, dan jangan (pula) bersedih hati, sebab kamu paling tinggi (derajatnya), jika kamu orang beriman.' },
  { surah: 'Al-Hasyr', no: 59, ayat: '18', arab: ['يَٰٓأَيُّهَا ٱلَّذِينَ ءَامَنُوا۟ ٱتَّقُوا۟ ٱللَّهَ وَلْتَنظُرْ نَفْسٌ مَّا قَدَّمَتْ لِغَدٍ'], arti: 'Wahai orang-orang yang beriman! Bertakwalah kepada Allah dan hendaklah setiap orang memperhatikan apa yang telah diperbuatnya untuk hari esok (akhirat).' },
]

export const MUTIARA = [
  { teks: 'Sebaik-baik manusia adalah yang paling bermanfaat bagi orang lain.', oleh: 'HR. Ahmad' },
  { teks: 'Barangsiapa menempuh jalan untuk mencari ilmu, Allah mudahkan baginya jalan menuju surga.', oleh: 'HR. Muslim' },
  { teks: 'Senyummu di hadapan saudaramu adalah sedekah.', oleh: 'HR. Tirmidzi' },
  { teks: 'Sesungguhnya Allah mencintai seseorang yang apabila bekerja, ia menyelesaikannya dengan itqan (sungguh-sungguh dan rapi).', oleh: 'HR. Thabrani' },
  { teks: 'Kata-kata yang baik adalah sedekah.', oleh: 'HR. Bukhari & Muslim' },
  { teks: 'Orang kuat bukanlah yang menang bergulat, tetapi yang mampu menguasai dirinya ketika marah.', oleh: 'HR. Bukhari & Muslim' },
  { teks: 'Kejujuran membawa pada kebaikan, dan kebaikan membawa ke surga.', oleh: 'HR. Bukhari & Muslim' },
  { teks: 'Tangan di atas lebih baik daripada tangan di bawah.', oleh: 'HR. Bukhari & Muslim' },
  { teks: 'Barangsiapa tidak menyayangi, ia tidak akan disayangi.', oleh: 'HR. Bukhari & Muslim' },
  { teks: 'Ilmu tanpa amal bagaikan pohon tanpa buah.', oleh: 'Pepatah Arab' },
  { teks: 'Bersabarlah, sebab apa yang ditakdirkan untukmu tidak akan pernah melewatkanmu.', oleh: 'Umar bin Khattab' },
  { teks: 'Jangan menunggu bahagia untuk tersenyum; tersenyumlah agar bahagia.', oleh: 'Pepatah' },
  { teks: 'Sedikit tapi rutin lebih dicintai Allah daripada banyak tapi terputus.', oleh: 'Intisari HR. Bukhari & Muslim' },
  { teks: 'Waktu ibarat pedang; jika engkau tidak memotongnya, ia yang akan memotongmu.', oleh: 'Imam Syafi\'i' },
  { teks: 'Barangsiapa memudahkan urusan orang lain, Allah akan memudahkan urusannya di dunia dan akhirat.', oleh: 'HR. Muslim' },
  { teks: 'Hati yang bersyukur selalu menemukan alasan untuk tersenyum.', oleh: 'Pepatah' },
  { teks: 'Rezeki tidak akan tertukar; yang tertukar hanya ikhtiar yang kurang.', oleh: 'Pepatah' },
  { teks: 'Didiklah anakmu sesuai zamannya, karena mereka hidup bukan di zamanmu.', oleh: 'Ali bin Abi Thalib' },
  { teks: 'Pekerjaan kecil yang diselesaikan lebih berharga daripada rencana besar yang tak pernah dimulai.', oleh: 'Pepatah' },
  { teks: 'Bergaullah dengan orang yang kalau melihatnya, engkau teringat Allah.', oleh: 'Nasihat ulama' },
]

export const FAKTA = [
  { kat: 'Bahasa', teks: 'Bahasa Indonesia termasuk sedikit bahasa di dunia yang tidak mengenal kala (tenses) — waktu ditunjukkan lewat kata keterangan seperti "sudah" dan "akan", bukan perubahan kata kerja.' },
  { kat: 'Bahasa', teks: 'Kata "sekolah" berasal dari bahasa Yunani "scholē" yang justru berarti waktu luang.' },
  { kat: 'Dunia', teks: 'Indonesia punya lebih dari 700 bahasa daerah — terbanyak kedua di dunia setelah Papua Nugini.' },
  { kat: 'Dokumen', teks: 'Konvensi Apostille lahir di Den Haag tahun 1961; Indonesia baru bergabung dan memberlakukannya pada 2022.' },
  { kat: 'Dokumen', teks: 'Kata "apostille" berasal dari bahasa Prancis yang artinya "catatan tambahan di tepi dokumen".' },
  { kat: 'Sains', teks: 'Madu adalah satu-satunya makanan yang praktis tidak pernah basi — madu berusia ribuan tahun dari makam Mesir kuno masih bisa dimakan.' },
  { kat: 'Sains', teks: 'Otak manusia hanya sekitar 2% berat tubuh, tetapi memakai sekitar 20% energi.' },
  { kat: 'Alam', teks: 'Gurita punya tiga jantung dan darahnya berwarna biru.' },
  { kat: 'Alam', teks: 'Komodo hanya hidup liar di Indonesia dan bisa mencium bau bangkai dari jarak beberapa kilometer.' },
  { kat: 'Dunia', teks: 'Jam di seluruh Indonesia terbagi tiga zona: WIB, WITA, dan WIT — selisihnya masing-masing satu jam.' },
  { kat: 'Bahasa', teks: 'Bahasa Arab menulis angka dari kiri ke kanan, meski hurufnya ditulis dari kanan ke kiri.' },
  { kat: 'Bahasa', teks: 'Bahasa Jepang punya tiga sistem tulisan sekaligus yang dipakai bersamaan dalam satu kalimat: hiragana, katakana, dan kanji.' },
  { kat: 'Sejarah', teks: 'Kertas pertama kali dibuat di Tiongkok sekitar 2.000 tahun lalu dari serat kulit kayu dan kain bekas.' },
  { kat: 'Sains', teks: 'Petir bisa memanaskan udara di sekitarnya hingga sekitar 30.000 °C — lima kali lebih panas dari permukaan matahari.' },
  { kat: 'Dunia', teks: 'Bali punya kalender sendiri (Pawukon) yang satu tahunnya hanya 210 hari.' },
  { kat: 'Alam', teks: 'Bunga Rafflesia arnoldii dari Sumatra adalah bunga tunggal terbesar di dunia, diameternya bisa hampir satu meter.' },
  { kat: 'Bahasa', teks: 'Kata "amuk" (run amok) dalam bahasa Inggris dipinjam dari bahasa Melayu.' },
  { kat: 'Sains', teks: 'Cahaya matahari yang kita lihat butuh sekitar 8 menit untuk sampai ke Bumi.' },
  { kat: 'Sejarah', teks: 'Mesin tik pertama disusun supaya huruf yang sering berpasangan berjauhan agar tuasnya tidak nyangkut — itulah asal tata letak QWERTY.' },
  { kat: 'Dunia', teks: 'Garis khatulistiwa melintasi Indonesia; Kota Pontianak punya tugu tepat di titik nol derajatnya.' },
]

/** Indeks harian: hari ke-N dalam tahun, supaya semua orang melihat isi yang sama pada hari yang sama. */
export function indeksHari(tgl = new Date()) {
  const awal = new Date(tgl.getFullYear(), 0, 0)
  return Math.floor((tgl - awal) / 86400000)
}
