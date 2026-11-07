// ============================================================
//  ALUR KERJA (WORKFLOW) — satu-satunya tempat untuk mengubah tahapan.
//  Tambah/ubah tahap cukup di sini; UI otomatis mengikuti.
//
//  roles  : role yang boleh memproses tahap ini
//  fields : isian yang muncul di tahap ini
//           type: person:<jenis> | user:<role> | money | file | text | date | choice | computed
//                 vendor_service (layanan vendor) | vendor_account (rekening vendor)
//  effect : aksi tambahan saat tahap diselesaikan
//           'pettycash_out' → mengurangi saldo petty cash apostille cabang
// ============================================================

const ALL = ['superadmin', 'admin_pusat', 'supervisor', 'cs']
const SPV = ['superadmin', 'supervisor']
// Menetapkan/mengganti penerjemah tidak lagi harus menunggu Supervisor —
// CS, Admin Pusat, dan Helper cabang juga boleh.
const PILIH_PENERJEMAH = ['superadmin', 'supervisor', 'direktur', 'admin_pusat', 'cs', 'helper']
/** Peran yang boleh MENGGANTI penerjemah setelah tugas terkirim (wajib pakai alasan). */
export const GANTI_PENERJEMAH = ['superadmin', 'supervisor', 'direktur', 'admin_pusat']
const DIREKTUR = ['superadmin', 'direktur']
const AKUNTING = ['superadmin', 'akunting']

// Alur vendor (Penerjemah / Apostille / Legalisasi Eksternal)
export const ONGKIR_TUJUAN = ['Vendor → Pelanggan', 'Vendor → Kantor']
// Sumber dana (rekening perusahaan) yang dipilih Direktur saat ACC
export const SUMBER_DANA = [
  { code: 'ATS', name: 'PT Aksara Translingua Sentosa' },
  { code: 'PTI', name: 'PT Penerjemah Tersumpah Indonesia' },
  { code: 'PAL', name: 'PT Apostille Legalisasi' },
  { code: 'ATI', name: 'PT Aksara Terjemah Internasional' },
]
/** Rekomendasi rekening sumber dana per cabang: Bali → ATS, Batam → PTI, Jakarta → ATI, cabang lain → PAL. */
export const FUND_BY_BRANCH = { Bali: 'ATS', Batam: 'PTI', Jakarta: 'ATI' }
export const recommendFund = (branch) => FUND_BY_BRANCH[branch] || 'PAL'
export const sumberLabel = (code) => { const x = SUMBER_DANA.find((d) => d.code === code); return x ? `${x.code} — ${x.name}` : code }
const VENDOR_FLOW = [
  {
    key: 'pengajuan', label: 'Pengajuan Vendor', roles: ALL, action: 'Ajukan',
    hint: 'Pilih vendor & layanan. Total pengajuan = biaya layanan + ongkir.',
    fields: [
      { key: 'vendor', label: 'Vendor', type: 'person:vendor', required: true },
      { key: 'vendor_service', label: 'Layanan & Biaya Vendor', type: 'vendor_service', required: true },
      { key: 'ongkir_to', label: 'Tujuan Ongkir', type: 'choice', options: ONGKIR_TUJUAN },
      { key: 'ongkir_cost', label: 'Biaya Ongkir (Rp)', type: 'money' },
      { key: 'total_pengajuan', label: 'Total Pengajuan', type: 'computed' },
      { key: 'tagihan_vendor', label: 'Tagihan dari Vendor (opsional)', type: 'file' },
      { key: 'vendor_note', label: 'Catatan untuk vendor', type: 'text' },
    ],
    // dihitung otomatis saat disimpan / diajukan
    compute: (d) => ({ total_pengajuan: (Number(d.vendor_cost) || 0) + (Number(d.ongkir_cost) || 0) }),
    onAdvance: (s, u) => ({ submitted_by: u.id, submitted_name: u.name, submitted_at: new Date().toISOString() }),
    notify: (p, s, u) => [{ to_role: 'direktur', text: 'Pengajuan vendor baru menunggu persetujuan' },
      ...(u && p.created_by && p.created_by !== u.id ? [{ to_user: p.created_by, text: `${u.name} mengajukan vendor untuk order Anda` }] : [])],
  },
  {
    key: 'persetujuan', label: 'Menunggu Persetujuan', roles: DIREKTUR, action: 'ACC',
    hint: 'Direktur memeriksa rincian, memilih sumber dana, lalu menekan ACC.',
    fields: [{ key: 'sumber_dana', label: 'Sumber Dana', type: 'sumber_dana', required: true }],
    onAdvance: (s, u) => ({ approved_by: u.id, approved_name: u.name, approved_at: new Date().toISOString() }),
    notify: (p, s) => [{ to_role: 'akunting', text: `Pengajuan disetujui (dana ${s.data.sumber_dana}) — menunggu pembayaran` }, { to_user: s.data.submitted_by, text: 'Pengajuan Anda disetujui Direktur' }],
  },
  {
    key: 'pembayaran', label: 'Disetujui — Menunggu Pembayaran', roles: AKUNTING, action: 'Tandai Sudah Dibayar',
    hint: 'Transfer ke rekening penerima (dari Setting → Vendor), lalu unggah bukti.',
    fields: [
      { key: 'rekening', label: 'Rekening Penerima', type: 'vendor_account', required: true },
      { key: 'bukti_transfer', label: 'Bukti Transfer', type: 'file', required: true },
      { key: 'paid_date', label: 'Tanggal Bayar', type: 'date', required: true },
    ],
    onAdvance: (s, u) => ({ paid_by: u.id, paid_name: u.name, paid_at: new Date().toISOString() }),
    notify: (p, s) => [{ to_user: s.data.submitted_by, kind: 'payment', text: 'Pengajuan Anda sudah dibayar — bukti transfer tersedia' },
      ...(p.created_by && p.created_by !== s.data.submitted_by ? [{ to_user: p.created_by, text: 'Vendor untuk order Anda sudah dibayar' }] : [])],
  },
  // Setelah dibayar, order BELUM selesai — CS melanjutkan: hasil vendor → no. resi → dokumen dikirim → Selesai
  {
    key: 'dibayar', label: 'Sudah Dibayar — Menunggu Hasil Vendor', short: 'Sudah Dibayar', roles: ALL, action: 'Hasil Diterima',
    hint: 'Akunting: download bukti transfer untuk vendor. CS: setelah hasil dari vendor diterima, unggah dokumen hasilnya lalu tekan Hasil Diterima.',
    fields: [{ key: 'hasil_vendor', label: 'Upload Dokumen Hasil dari Vendor', type: 'file', required: true }],
    onAdvance: (s, u) => ({ received_by: u.id, received_name: u.name, received_at: new Date().toISOString() }),
    notify: (p, s, u) => (p.created_by && p.created_by !== u?.id ? [{ to_user: p.created_by, text: 'Hasil dari vendor sudah diunggah — siap dikirim ke pelanggan' }] : []),
  },
  {
    key: 'kirim', label: 'Siap Kirim — Tulis No. Resi', short: 'Siap Kirim', roles: ALL, action: 'Dokumen Sudah Dikirim',
    hint: 'Tulis nomor resi (cukup diketik, tanpa foto) sesuai metode pengiriman, lalu tekan Dokumen Sudah Dikirim.',
    fields: [],
    onAdvance: (s, u) => ({ shipped_by: u.id, shipped_name: u.name, shipped_at: new Date().toISOString() }),
  },
  {
    key: 'dikirim', label: 'Dokumen Sudah Dikirim', roles: ALL, action: 'Selesai',
    hint: 'Dokumen sudah dikirim ke pelanggan. Tambahkan catatan bila perlu, lalu tekan Selesai untuk menutup order.',
    fields: [{ key: 'serah_note', label: 'Catatan serah terima (opsional)', type: 'text' }],
    onAdvance: (s, u) => ({ closed_by: u.id, closed_name: u.name, closed_at: new Date().toISOString() }),
  },
]
/** Tahap alur vendor yang sudah dibayar (uang sudah keluar) tapi order masih berjalan. */
export const VENDOR_PAID_STAGES = ['dibayar', 'kirim', 'dikirim']
/** Termin pembayaran vendor (Setting → Vendor). */
export const PAYMENT_TERMS = {
  immediate: { label: 'Langsung bayar per order', short: 'Bayar per order' },
  invoice: { label: 'Bayar sesuai tagihan vendor', short: 'Sesuai tagihan' },
  monthly: { label: 'Tagihan bulanan (via koordinator)', short: 'Bulanan' },
}
export const termOf = (vendor) => (PAYMENT_TERMS[vendor?.payment_term] ? vendor.payment_term : 'immediate')
export const isBilled = (vendor) => termOf(vendor) !== 'immediate'

// Vendor dengan termin tagihan: order dicatat, TIDAK langsung dibayar — biaya masuk Tagihan Vendor.
const BILL_FLOW = [
  {
    key: 'order', label: 'Order ke Vendor', roles: ALL, action: 'Order ke Vendor',
    hint: 'Catat order ke vendor. Tidak langsung dibayar — biaya otomatis masuk daftar "Order belum ditagih" untuk Tagihan Vendor.',
    fields: [
      { key: 'vendor', label: 'Vendor', type: 'person:vendor', required: true },
      { key: 'vendor_service', label: 'Layanan & Biaya Vendor', type: 'vendor_service', required: true },
      { key: 'vendor_note', label: 'Catatan untuk vendor', type: 'text' },
    ],
    compute: (d) => ({ total_pengajuan: Number(d.vendor_cost) || 0 }),
    onAdvance: (s, u) => ({ ordered_by: u.id, ordered_name: u.name, ordered_at: new Date().toISOString() }),
    notify: (p, s, u) => (s.data.coordinator && s.data.coordinator !== u?.id ? [{ to_user: s.data.coordinator, text: 'Order vendor dicatat — masuk tagihan berikutnya' }] : []),
  },
  {
    key: 'proses_vendor', label: 'Dikerjakan Vendor', roles: ALL, action: 'Hasil Diterima',
    hint: 'Unggah hasil dari vendor setelah diterima. Pembayaran mengikuti Tagihan Vendor.',
    fields: [{ key: 'hasil_vendor', label: 'Hasil dari Vendor', type: 'file', required: true }],
    onAdvance: (s, u) => ({ received_by: u.id, received_name: u.name, received_at: new Date().toISOString() }),
    notify: (p, s) => [{ to_user: p.created_by, text: 'Hasil vendor sudah diterima' }],
  },
]

/** Tahap yang termasuk "pengajuan vendor" (untuk daftar & dashboard). */
/** Apakah sub project memakai alur vendor? */
export const isVendorFlow = (flow) => ['tr_ext', 'ap_ext', 'lg_ext'].includes(flow)
export const VENDOR_STAGES = { persetujuan: 'Menunggu Persetujuan', pembayaran: 'Menunggu Pembayaran', dibayar: 'Sudah Dibayar' }
/** Total pengajuan sebuah sub project vendor. */
export const totalPengajuan = (d = {}) => Number(d.total_pengajuan) || (Number(d.vendor_cost) || 0) + (Number(d.ongkir_cost) || 0)

// Alur Apostille / Legalisasi INTERNAL — dikerjakan Staf Apostille.
// Biaya diisi terpisah oleh Supervisor/Direktur (panel Biaya), bukan oleh staf.
const STAF = ['superadmin', 'supervisor', 'staf_apostille']
const STAF_FLOW = [
  { key: 'cs_upload', label: 'CS Upload Dokumen Sumber', roles: ALL, action: 'Kirim ke Staf Apostille',
    fields: [{ key: 'dokumen_sumber', label: 'Dokumen Sumber', type: 'file', required: true }],
    notify: (p, s) => [s.data.staff_apostille ? { to_user: s.data.staff_apostille, text: 'Pekerjaan apostille/legalisasi baru' } : { to_role: 'staf_apostille', to_branch: p.branch, text: 'Pekerjaan apostille/legalisasi baru' }] },
  { key: 'antrian', label: 'Belum Diproses', roles: STAF, assignee: 'staff_apostille', action: 'Mulai Proses',
    hint: 'Unduh dokumen sumber, lalu tekan Mulai Proses.', fields: [], showSource: true,
    onAdvance: (s, u) => ({ started_by: u.id, started_name: u.name, started_at: new Date().toISOString() }) },
  { key: 'diproses', label: 'Sedang Diproses', roles: STAF, assignee: 'staff_apostille', action: 'Selesai', showSource: true,
    hint: 'Lampirkan bukti transfer (tanpa nominal) bila ada, unggah hasil, lalu tekan Selesai.',
    fields: [
      { key: 'proses_checklist', label: 'To-do proses', type: 'checklist', required: true,
        items: ['Permohonan', 'Ditunda', 'Verifikasi', 'Bayar Pajak', 'Cetak', 'Scan'],
        // Langkah yang hanya boleh dicentang peran tertentu — yang lain tidak melihatnya sama sekali.
        itemRoles: { 'Bayar Pajak': ['superadmin', 'supervisor', 'direktur'] },
        // Langkah yang butuh data/berkas: saat dicentang, slide isian terbuka dulu.
        itemForm: {
          Permohonan: [{ key: 'no_permohonan', label: 'Nomor permohonan', type: 'text' }],
          Ditunda: [
            { key: 'tunda_alasan', label: 'Alasan ditunda', type: 'textarea', required: true },
            { key: 'tunda_sampai', label: 'Perkiraan dilanjutkan', type: 'date' },
          ],
          'Bayar Pajak': [
            { key: 'pajak_nominal', label: 'Nominal pajak', type: 'money' },
            { key: 'pajak_bukti', label: 'Bukti bayar pajak', type: 'file' },
          ],
          Scan: [{ key: 'scan_hasil', label: 'Upload hasil scan', type: 'file', required: true }],
        },
        // Tidak wajib dicentang untuk menyelesaikan tahap: "Ditunda" bukan langkah maju,
        // dan "Bayar Pajak" tidak muncul di semua dokumen.
        opsional: ['Ditunda', 'Bayar Pajak'] },
      { key: 'bukti_transfer', label: 'Upload Bukti Transfer (opsional)', type: 'file' },
      { key: 'hasil_akhir', label: 'Upload Hasil Apostille / Legalisasi', type: 'file', required: true },
    ],
    onAdvance: (s, u) => ({ finished_by: u.id, finished_name: u.name, finished_at: new Date().toISOString() }),
    notify: (p) => [{ to_user: p.created_by, text: 'Hasil apostille/legalisasi sudah tersedia — silakan download' }] },
]
/** Status sederhana untuk dashboard Staf Apostille. */
export const stafStatus = (stage) => (stage === DONE ? 'Selesai' : stage === 'diproses' ? 'Sedang Diproses' : 'Belum Diproses')
/** Total biaya apostille/legalisasi = biaya proses + biaya lain. */
export const totalBiaya = (d = {}) => (Number(d.biaya_proses) || 0) + (d.biaya_lain || []).reduce((a, x) => a + (Number(x.nominal) || 0), 0)

export const CATEGORIES = {
  tr_int: {
    label: 'Penerjemah Internal', short: 'TR Internal', tone: 'blue',
    stages: [
      { key: 'cs_input', label: 'CS Input', roles: ALL, action: 'Kirim ke Supervisor',
        hint: 'Pastikan detail dokumen, halaman, deadline & lokasi Print sudah benar, lalu unggah dokumen sumber.',
        fields: [{ key: 'dokumen_sumber', label: 'Dokumen Sumber', type: 'file', required: true }],
        notify: (p) => [{ to_role: 'supervisor', to_branch: p.branch, text: 'Project baru menunggu penetapan penerjemah' }] },
      { key: 'pilih_penerjemah', label: 'Pilih Penerjemah', roles: PILIH_PENERJEMAH, action: 'Tetapkan Penerjemah',
        hint: 'Pekerjaan akan masuk ke To-Do List penerjemah yang dipilih.',
        fields: [{ key: 'translator', label: 'Penerjemah', type: 'user:penerjemah', required: true }],
        notify: (p, s) => [{ to_user: s.data.translator, text: 'Tugas terjemahan baru untuk Anda' }] },
      { key: 'penerjemahan', label: 'Penerjemahan', roles: ['superadmin', 'supervisor', 'penerjemah'], assignee: 'translator', action: 'Kirim ke Proofreader',
        hint: 'Unggah hasil terjemahan lalu pilih proofreader.',
        fields: [
          { key: 'hasil_terjemahan', label: 'Hasil Terjemahan', type: 'file', required: true },
          { key: 'proofreader', label: 'Proofreader', type: 'user:proofreader', required: true },
        ],
        onAdvance: (s, u) => ({ translated_by: u.id, translated_at: new Date().toISOString() }),
        notify: (p, s) => [{ to_user: s.data.proofreader, text: 'Dokumen menunggu pemeriksaan Anda' }] },
      { key: 'proofread', label: 'Pemeriksaan Proofreader', roles: ['superadmin', 'supervisor', 'proofreader'], assignee: 'proofreader', action: 'Lanjut ke Otorisator',
        fields: [
          { key: 'hasil_proofread', label: 'File Setelah Diperiksa (opsional)', type: 'file' },
          { key: 'catatan_proofread', label: 'Catatan Pemeriksaan', type: 'text' },
        ],
        notify: () => [{ to_role: 'otorisator', text: 'Dokumen baru di To-Do List Otorisator' }] },
      { key: 'otorisasi', label: 'Otorisasi', roles: ['superadmin', 'supervisor', 'otorisator'], claimable: true, action: 'Otorisasi → Nomor Registrasi',
        hint: 'To-Do bersama semua otorisator. Tekan "Ambil" agar tidak dikerjakan bersamaan.',
        fields: [{ key: 'file_final', label: 'Dokumen Final (opsional)', type: 'file' }],
        onAdvance: (s, u) => ({ authorized_by: u.id, authorized_name: u.name, authorized_at: new Date().toISOString(), claim: null }),
        notify: () => [{ to_role: 'admin_pusat', text: 'Dokumen selesai diotorisasi — menunggu nomor registrasi' }] },
      { key: 'registrasi', label: 'Menunggu Nomor Registrasi', short: 'No. Registrasi', roles: ['superadmin', 'admin_pusat'], action: 'Simpan → Siap Print',
        hint: 'Admin Pusat mengisi nomor registrasi setiap dokumen. Nomor ini dituliskan pada hasil cetak.',
        fields: [{ key: 'reg_numbers', label: 'Nomor registrasi per dokumen', type: 'reg_numbers', required: true }],
        onAdvance: (s, u) => ({ registered_by: u.id, registered_name: u.name, registered_at: new Date().toISOString() }),
        notify: (p) => (p.about?.print_location === 'Vendor'
          ? [{ to_user: p.created_by, text: 'Dokumen siap print — dicetak oleh vendor (eksternal), koordinasikan dengan vendor' }]
          : [{ to_branch: p.about?.print_location || p.branch, to_role: 'cs', text: `Dokumen siap print di cabang ${p.about?.print_location || p.branch}` }]) },
      { key: 'siap_print', label: 'Siap Print', roles: ALL, printBranch: true, action: 'Tandai Sudah Dicetak', print: true,
        hint: 'Download / print dokumen di cabang lokasi Print, beri stempel basah. Bila lokasi Print = Vendor: kirim file ke vendor untuk dicetak, lalu tandai sudah dicetak.',
        fields: [],
        notify: (p) => (p.about?.print_location && p.about.print_location !== p.branch && p.about.print_location !== 'Vendor'
          ? [{ to_branch: p.about.print_location, text: 'Sudah dicetak — jangan lupa stempel basah, scan, lalu upload PDF' }] : []) },
      { key: 'upload_scan', label: 'Stempel & Upload Scan', roles: ALL, printBranch: true, action: 'Upload → Siap Kirim',
        hint: 'Setelah dicetak & distempel basah, scan menjadi PDF lalu unggah di sini.',
        fields: [{ key: 'scan_pdf', label: 'Upload PDF Hasil Scan', type: 'file', required: true, accept: 'application/pdf' }],
        notify: (p) => [{ to_user: p.created_by, text: 'Dokumen siap kirim' }] },
      { key: 'siap_kirim', label: 'Siap Kirim', roles: ALL, action: 'Selesai',
        hint: 'Lengkapi syarat selesai sesuai metode pengiriman (diambil di kantor / softcopy / kurir / dari penerjemah), lalu tekan Selesai.',
        fields: [{ key: 'serah_note', label: 'Catatan serah terima', type: 'text' }] },
    ],
  },
  tr_ext: { label: 'Penerjemah Eksternal', short: 'TR Eksternal', tone: 'violet', stages: VENDOR_FLOW },
  tr_bill: { label: 'Penerjemah Eksternal (Tagihan)', short: 'TR Tagihan', tone: 'violet', stages: BILL_FLOW },
  ap_int: { label: 'Apostille Internal', short: 'AP Internal', tone: 'emerald', stages: STAF_FLOW },
  ap_ext: { label: 'Apostille Eksternal', short: 'AP Eksternal', tone: 'amber', stages: VENDOR_FLOW },
  lg_int: { label: 'Legalisasi Internal', short: 'LG Internal', tone: 'emerald', stages: STAF_FLOW },
  lg_ext: { label: 'Legalisasi Eksternal', short: 'LG Eksternal', tone: 'amber', stages: VENDOR_FLOW },
  tr_nt: {
    label: 'Terjemahan Non Tersumpah', short: 'Non Tersumpah', tone: 'aqua',
    stages: [
      { key: 'cs_input', label: 'CS Input', roles: ALL, action: 'Kirim ke Penerjemah',
        hint: 'Unggah dokumen sumber dan pilih penerjemah. Tanpa proofreader, otorisasi, dan registrasi.',
        fields: [
          { key: 'dokumen_sumber', label: 'Dokumen Sumber', type: 'file', required: true },
          { key: 'translator', label: 'Penerjemah', type: 'user:penerjemah', required: true },
        ],
        notify: (p, s) => [{ to_user: s.data.translator, text: 'Tugas terjemahan non tersumpah baru untuk Anda' }] },
      { key: 'penerjemahan', label: 'Penerjemahan', roles: ['superadmin', 'supervisor', 'penerjemah'], assignee: 'translator', action: 'Selesai → Kembali ke CS',
        hint: 'Unggah hasil terjemahan. Dokumen langsung kembali ke CS.',
        fields: [{ key: 'hasil_terjemahan', label: 'Hasil Terjemahan', type: 'file', required: true }],
        onAdvance: (s, u) => ({ translated_by: u.id, translated_at: new Date().toISOString() }),
        notify: (p) => [{ to_user: p.created_by, text: 'Terjemahan non tersumpah selesai — siap diserahkan ke pelanggan' }] },
      { key: 'cs_final', label: 'Dokumen Selesai — CS', roles: ALL, action: 'Serahkan ke Pelanggan',
        hint: 'Hasil sudah diterima CS. Kirim ke pelanggan (email/WA) lalu tandai selesai.',
        fields: [{ key: 'serah_note', label: 'Catatan serah terima (opsional)', type: 'text' }] },
    ],
  },
  jl: {
    label: 'Jasa Lain', short: 'Jasa Lain', tone: 'blue',
    stages: [
      { key: 'proses', label: 'Proses', roles: ALL, action: 'Lanjut Serah Terima',
        fields: [{ key: 'hasil_jasa', label: 'File Hasil', type: 'file' }] },
      { key: 'cs_final', label: 'CS — Serah Terima', roles: ALL, action: 'Selesai',
        fields: [{ key: 'serah_note', label: 'Catatan serah terima', type: 'text' }] },
    ],
  },
}

/** Alur kerja ditentukan per sub project: jenis + pelaksana (internal / vendor). */
export function deriveFlow(sub, vendorRec) {
  const vendor = sub.executor_kind === 'vendor' || sub.translator_kind === 'vendor'
  switch (sub.type) {
    case 'terjemahan': return vendor ? (isBilled(vendorRec) ? 'tr_bill' : 'tr_ext') : 'tr_int'
    case 'terjemahan_nt': return 'tr_nt'
    case 'apostille': return vendor ? 'ap_ext' : 'ap_int'
    case 'legalisasi': return vendor ? 'lg_ext' : 'lg_int'
    default: return 'jl'
  }
}
/** Alur sub project (data lama memakai kategori project). */
export const flowOf = (sub, project) => sub?.flow || project?.category || deriveFlow(sub || {})

export const DONE = 'selesai'
/** Daftar dokumen sebuah sub project (untuk nomor registrasi): docs bila ada, kalau tidak dari deskripsi bernomor. */
export const docListOf = (sub) => {
  const d = (sub?.docs || []).filter((x) => (x.desc || '').trim())
  if (d.length) return d.map((x) => x.desc.trim())
  const pts = String(sub?.description || '').split('\n').map((l) => l.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean)
  return pts.length ? pts : [sub?.title || 'Dokumen']
}
/** Nomor registrasi lengkap untuk semua dokumen? */
export const regComplete = (sub) => { const n = docListOf(sub).length; const r = sub?.data?.reg_numbers || []; return n > 0 && r.length >= n && r.slice(0, n).every((x) => String(x || '').trim()) }

export const TONES = {
  blue: 'bg-blue-50 text-blue-700 ring-blue-200',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
}

export function stagesOf(cat) { return CATEGORIES[cat]?.stages ?? [] }
export function stageIndex(cat, key) {
  if (key === DONE) return stagesOf(cat).length
  return stagesOf(cat).findIndex((s) => s.key === key)
}
export function stageLabel(cat, key) {
  if (key === DONE) return 'Selesai'
  return stagesOf(cat).find((s) => s.key === key)?.label ?? key
}
export function stageShort(cat, key) {
  if (key === DONE) return 'Selesai'
  const st = stagesOf(cat).find((s) => s.key === key); return st?.short || st?.label || key
}
export function progressOf(project) {
  const subs = project.sub_projects ?? []
  if (!subs.length) return 0
  const total = subs.reduce((a, s) => { const f = flowOf(s, project); return a + stageIndex(f, s.stage) / stagesOf(f).length }, 0)
  return Math.round((total / subs.length) * 100)
}
export function isDone(project) {
  const subs = project.sub_projects ?? []
  return subs.length > 0 && subs.every((s) => s.stage === DONE)
}
