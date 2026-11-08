// Data contoh untuk MODE DEMO saja.
export const DEMO_PDF = (name, by = 'Nikita (CS Bali)') => ({ name, size: 450, by, url: 'data:application/pdf;base64,JVBERi0xLjQKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqCjIgMCBvYmo8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PmVuZG9iagozIDAgb2JqPDwvVHlwZS9QYWdlL1BhcmVudCAyIDAgUi9NZWRpYUJveFswIDAgNTk1IDg0Ml0vQ29udGVudHMgNCAwIFIvUmVzb3VyY2VzPDwvRm9udDw8L0YxIDUgMCBSPj4+Pj4+ZW5kb2JqCjQgMCBvYmo8PC9MZW5ndGggODg+PnN0cmVhbQpCVCAvRjEgMjIgVGYgNzIgNzYwIFRkIChBVExBUyBBbGZhIC0gRG9rdW1lbiBEZW1vKSBUaiAwIC0zMCBUZCAvRjEgMTIgVGYgKENvbnRvaCBoYXNpbCB0ZXJqZW1haGFuKSBUaiBFVAplbmRzdHJlYW0gZW5kb2JqCjUgMCBvYmo8PC9UeXBlL0ZvbnQvU3VidHlwZS9UeXBlMS9CYXNlRm9udC9IZWx2ZXRpY2E+PmVuZG9iagp0cmFpbGVyPDwvUm9vdCAxIDAgUj4+CiUlRU9G', drive_id: null, uploaded_at: new Date().toISOString() })
import { DEMO_CONTACTS } from './demoZoho.js'
import { BRANCHES } from '../config/access.js'
import { ONGKIR_TUJUAN as ONGKIR, totalBiaya } from '../config/workflows.js'
import { DEFAULT_COURIERS } from '../config/couriers.js'
import { projectsFromZoho } from './seedNov.js'
const cust = (id) => structuredClone(DEMO_CONTACTS.find((c) => c.zoho_id === id))
const d = (days) => new Date(Date.now() + days * 864e5).toISOString()
let n = 0
const id = (p) => `${p}-${++n}`

export function seed() {
  n = 0
  const users = [
    { id: 'u-sa', name: 'Super Admin', email: 'admin@247.id', role: 'superadmin', branch: 'Bali' },
    { id: 'u-adm', name: 'Nihaya (Admin Pusat)', email: 'nihaya@247.id', role: 'admin_pusat', branch: 'Bali' },
    { id: 'u-adm2', name: 'Sabrina (Admin Pusat)', email: 'sabrina@247.id', role: 'admin_pusat', branch: 'Bali' },
    { id: 'u-spv', name: 'Laila (Direktur)', email: 'laila@247.id', role: 'supervisor', branch: 'Jakarta' },
    { id: 'u-cs-bali', name: 'Nikita (CS Bali)', email: 'nikita@247.id', role: 'cs', branch: 'Bali' },
    { id: 'u-cs-bali2', name: 'Indah (CS Bali)', email: 'indah@247.id', role: 'cs', branch: 'Bali' },
    { id: 'u-cs-bali3', name: 'Destri (CS Bali)', email: 'destri@247.id', role: 'cs', branch: 'Bali' },
    { id: 'u-cs-bali4', name: 'Rosyada (CS Bali)', email: 'rosyada@247.id', role: 'cs', branch: 'Bali' },
    { id: 'u-cs-jkt', name: 'Rika (CS Jakarta)', email: 'rika@247.id', role: 'cs', branch: 'Jakarta' },
    { id: 'u-cs-jkt2', name: 'Wahyu', email: 'wahyu.cs@247.id', role: 'helper', branch: 'Jakarta' },
    { id: 'u-cs-jkt3', name: 'Solicin (CS Jakarta)', email: 'solicin@247.id', role: 'cs', branch: 'Jakarta' },
    { id: 'u-cs-sby', name: 'Ninda (CS Surabaya)', email: 'ninda@247.id', role: 'cs', branch: 'Surabaya' },
    { id: 'u-cs-smg', name: 'Santi (CS Semarang)', email: 'santi@247.id', role: 'cs', branch: 'Semarang' },
    { id: 'u-cs-smg2', name: 'Nabila (CS Semarang)', email: 'nabila@247.id', role: 'cs', branch: 'Semarang' },
    { id: 'u-cs-mks', name: 'Aina (CS Makassar)', email: 'aina@247.id', role: 'cs', branch: 'Makassar' },
    { id: 'u-cs-mdn', name: 'Rhania (CS Medan)', email: 'rhania@247.id', role: 'cs', branch: 'Medan' },
    { id: 'u-cs-btm', name: 'Gean (CS Batam)', email: 'gean@247.id', role: 'cs', branch: 'Batam' },
    { id: 'u-cs-multi', name: 'Intan (CS Multi Cabang)', email: 'intan@247.id', role: 'cs', branch: 'Bali', branches: ['Surabaya', 'Makassar'] },
    { id: 'u-cs-bdg', name: 'Debby (CS Bandung)', email: 'debby@247.id', role: 'cs', branch: 'Bandung', coordinator_lang: 'Jerman' },
    { id: 'u-cs-yog', name: 'Emma (CS Yogyakarta)', email: 'emma@247.id', role: 'cs', branch: 'Yogyakarta', coordinator_lang: 'Jepang' },
    { id: 'u-dir', name: 'Fina (Direktur)', email: 'fina@247.id', role: 'direktur', branch: 'Bali' },
    { id: 'u-acc', name: 'Wiwin (Akunting)', email: 'wiwin@247.id', role: 'akunting', branch: 'Bali' },
    { id: 'u-tr-andre', name: 'Wita', email: 'wita@247.id', role: 'penerjemah', branch: 'Bali' },
    { id: 'u-tr-maria', name: 'Zahra', email: 'zahra@247.id', role: 'penerjemah', branch: 'Bali' },
    { id: 'u-tr-hendra', name: 'Devana', email: 'devana@247.id', role: 'penerjemah', branch: 'Jakarta' },
    { id: 'u-tr-lina', name: 'Elyonai', email: 'elyonai@247.id', role: 'penerjemah', branch: 'Bandung' },
    { id: 'u-pr-kevin', name: 'Dyah', email: 'dyah@247.id', role: 'proofreader', branch: 'Bali' },
    { id: 'u-pr-rina', name: 'Novita', email: 'novita@247.id', role: 'proofreader', branch: 'Jakarta', extra_roles: ['otorisator'], otorisator_level: 'staf' },
    { id: 'u-pr-ela', name: 'Ela', email: 'ela@247.id', role: 'proofreader', branch: 'Bali', extra_roles: ['otorisator'], otorisator_level: 'staf' },
    { id: 'u-ot-made', name: 'Muhammad Arifin', email: 'arifin@247.id', role: 'otorisator', branch: 'Bali', otorisator_level: 'master' },
    { id: 'u-ot-lukas', name: 'Sadipan', email: 'sadipan@247.id', role: 'otorisator', branch: 'Jakarta', otorisator_level: 'staf' },
    { id: 'u-ap-putu', name: 'Khrisna', email: 'khrisna@247.id', role: 'staf_apostille', branch: 'Jakarta', extra_roles: ['helper'] },
    // Akun Wahyu ganda — dinonaktifkan, bukan dihapus, supaya riwayat project lama tetap utuh.
    { id: 'u-ap-fajar', name: 'Wahyu (akun lama)', email: 'wahyu@247.id', role: 'staf_apostille', branch: 'Jakarta', active: false },
    { id: 'u-hlp-naomi', name: 'Naomi', email: 'naomi@247.id', role: 'helper', branch: 'Jakarta' },
  ].map((u) => ({ active: true, ...u, created_at: d(-60) }))

  const P = (name, type, branch, phone = '') => ({ id: id('p'), name, type, branch, phone, created_at: d(-50) })
  const people = [
    { ...P('CV Lingua Nusantara', 'vendor', 'Semua', '0812-0000-1111'), address: 'Jl. Diponegoro No. 21, Denpasar', contact: 'Bu Ratna',
      services: [{ name: 'Terjemahan Jepang–Indonesia /dok', price: 450000 }, { name: 'Terjemahan Mandarin–Indonesia /dok', price: 400000 }, { name: 'Terjemahan Korea–Indonesia /dok', price: 425000 }],
      accounts: [{ bank: 'BCA', number: '6110223344', holder: 'CV Lingua Nusantara' }, { bank: 'Mandiri', number: '1450011223344', holder: 'Ratna Dewi' }],
      notes: 'Pembayaran H+1 setelah hasil terjemahan dikirim. Revisi gratis 1x.' },
    { ...P('Jasa Apostille Prima', 'vendor', 'Semua', '0813-2222-3333'), address: 'Jl. Kuningan Raya 5, Jakarta Selatan', contact: 'Pak Yusuf',
      services: [{ name: 'Apostille Kemenkumham (reguler 5 hari)', price: 750000 }, { name: 'Apostille Kemenkumham (express 2 hari)', price: 1250000 }, { name: 'Legalisasi Kemenlu', price: 650000 }],
      accounts: [{ bank: 'BNI', number: '0987654321', holder: 'PT Jasa Apostille Prima' }],
      notes: 'Dokumen asli dikirim ke kantor Jakarta.' },
    { ...P('Ibu Tinah', 'vendor', 'Semua'), address: '', contact: '', languages: ['Mandarin'],
      services: [{ name: 'Terjemahan Mandarin–Indonesia /dok', price: 400000 }, { name: 'Terjemahan Indonesia–Mandarin /dok', price: 400000 }],
      accounts: [], notes: 'Penerjemah lepas Bahasa Mandarin. Lengkapi no. HP, alamat, tarif & rekening di Setting → Vendor.' },
    { ...P('Ibu Anisa', 'vendor', 'Semua'), address: '', contact: '', languages: ['Korea'],
      services: [{ name: 'Terjemahan Korea–Indonesia /dok', price: 425000 }, { name: 'Terjemahan Indonesia–Korea /dok', price: 425000 }],
      accounts: [], notes: 'Penerjemah lepas Bahasa Korea. Lengkapi no. HP, alamat, tarif & rekening di Setting → Vendor.' },
    { ...P('Ibu Primastuti', 'vendor', 'Semua'), address: '', contact: '', languages: ['Korea'],
      services: [{ name: 'Terjemahan Korea–Indonesia /dok', price: 425000 }, { name: 'Terjemahan Indonesia–Korea /dok', price: 425000 }],
      accounts: [], notes: 'Penerjemah lepas Bahasa Korea. Lengkapi no. HP, alamat, tarif & rekening di Setting → Vendor.' },
    { ...P('Bapak Georgy', 'vendor', 'Semua'), address: '', contact: '', languages: ['Jerman'],
      services: [{ name: 'Terjemahan Jerman–Indonesia /dok', price: 400000 }, { name: 'Terjemahan Indonesia–Jerman /dok', price: 400000 }],
      accounts: [], notes: 'Penerjemah lepas Bahasa Jerman. Lengkapi no. HP, alamat, tarif & rekening di Setting → Vendor.' },
    { ...P('Bapak Hamim', 'vendor', 'Semua'), address: '', contact: '', languages: ['Arab'],
      services: [{ name: 'Terjemahan Arab–Indonesia /dok', price: 400000 }, { name: 'Terjemahan Indonesia–Arab /dok', price: 400000 }],
      accounts: [], notes: 'Penerjemah lepas Bahasa Arab. Lengkapi no. HP, alamat, tarif & rekening di Setting → Vendor.' },
    { ...P('Bapak Zenzia', 'vendor', 'Semua'), address: '', contact: '', languages: ['Jepang'],
      services: [{ name: 'Terjemahan Jepang–Indonesia /dok', price: 450000 }, { name: 'Terjemahan Indonesia–Jepang /dok', price: 450000 }],
      accounts: [], notes: 'Penerjemah lepas Bahasa Jepang. Lengkapi no. HP, alamat, tarif & rekening di Setting → Vendor.' },
    P('Kementerian Hukum (AHU)', 'lembaga', 'Semua'), P('Kementerian Luar Negeri', 'lembaga', 'Semua'),
    P('Kedutaan Besar', 'lembaga', 'Semua'), P('Kementerian Pendidikan', 'lembaga', 'Semua'), P('Notaris', 'lembaga', 'Semua'),
  ]
  const pid = (name) => people.find((p) => p.name === name)?.id

  const sub = (title, stage, extra = {}) => ({
    id: id('s'), type: extra.type ?? 'terjemahan', title, description: `1. ${title}`, file_count: 1, pages: extra.pages ?? 1,
    pages_manual: (extra.pages ?? 1) !== 1, lang_from: extra.lang_from ?? 'Indonesia', lang_to: extra.lang_to ?? 'Inggris',
    translator: extra.data?.translator ?? '', country: extra.country ?? '', stage, data: extra.data ?? {},
    ...((extra.type ?? 'terjemahan') === 'terjemahan' ? { docs: [{ desc: title, pages: extra.pages ?? 1 }] } : {}),
    history: [{ at: d(-3), by: 'Nikita (CS Bali)', action: 'Dibuat' }],
  })

  // ============ PROJECT DARI FAKTUR ZOHO SUNGGUHAN (1–5 Nov 2026) ============
  // Dibentuk persis seperti CS membuat project dari menu Faktur; tahap disebar menurut umur invoice.
  const projects = projectsFromZoho({ people, pdf: DEMO_PDF, mkId: id })
  // biaya apostille/legalisasi yang sudah diisi staf → tercatat di petty cash
  const apCost = []
  for (const p of projects) for (const s0 of p.sub_projects) if (['ap_int', 'lg_int'].includes(s0.flow) && s0.data?.biaya_proses) apCost.push([p, s0])
  // contoh titip print: 2 project Jakarta dicetak di Bali, 1 project Bali dicetak di Jakarta
  const titip = (dari, ke, n) => projects.filter((p) => p.branch === dari && p.sub_projects.some((s) => ['siap_print', 'upload_scan'].includes(s.stage))).slice(0, n).forEach((p) => { p.about.print_location = ke })
  titip('Jakarta', 'Bali', 2); titip('Bali', 'Jakarta', 1)

  const petty_cash = [{ id: id('pc'), branch: 'Apostille', type: 'in', amount: 10000000, note: 'Saldo awal petty cash apostille (Direktur)', project_id: null, by: 'Super Admin', created_at: d(-30) },
    ...BRANCHES.map((b) => ({
    id: id('pc'), branch: b, type: 'in', amount: 3000000, note: 'Saldo awal petty cash cabang', project_id: null, by: 'Super Admin', created_at: d(-30),
  }))]
  // biaya apostille yang sudah diisi Direktur → tercatat di petty cash
  apCost.forEach(([p, s0]) => petty_cash.push({ id: id('pc'), branch: 'Apostille', type: 'out', amount: totalBiaya(s0.data), note: `Biaya ${s0.type} ${p.invoice_no} — ${s0.title}`, project_id: p.id, sub_id: s0.id, by: 'Laila (Direktur)', created_at: d(-1) }))


  // Pengajuan umum (tanpa invoice) — contoh
  const R = (kind, who, branch, amount, purpose, status, extra = {}) => ({ id: id('rq'), kind, branch, amount, purpose, status, requested_by: who[0], requested_name: who[1],
    recipient: { bank: '', number: '', holder: '' }, attachment: null, project_id: null, fund: null, created_at: d(-(extra.ago ?? 1)),
    history: [{ at: d(-(extra.ago ?? 1)), by: who[1], action: 'Diajukan' }], ...extra })
  const ok = { sumber_dana: 'ATS', approved_by: 'u-dir', approved_name: 'Fina (Direktur)', approved_at: d(-1) }
  const paid = { ...ok, bukti_transfer: DEMO_PDF('bukti-transfer-pengajuan.pdf'), paid_date: d(0).slice(0, 10), paid_by: 'u-acc', paid_name: 'Wiwin (Akunting)', paid_at: d(0) }
  const refundP = projects.find((x) => x.branch === 'Jakarta')
  const requests = [
    R('topup', ['u-cs-bali', 'Nikita (CS Bali)'], 'Bali', 2000000, 'Saldo petty cash Bali menipis', 'menunggu', { fund: 'Bali' }),
    R('lain', ['u-cs-jkt', 'Rika (CS Jakarta)'], 'Jakarta', 500000, 'Token listrik kantor Jakarta', 'menunggu', { recipient: { bank: 'BCA', number: '1234567890', holder: 'PLN Prabayar (via Tokopedia)' } }),
    R('refund', ['u-cs-jkt', 'Rika (CS Jakarta)'], 'Jakarta', 350000, 'Pembatalan 1 dokumen — pelanggan tidak jadi', 'disetujui', { ...ok, project_id: refundP?.id, recipient: { bank: 'Mandiri', number: '1370012345678', holder: refundP?.customer?.name || 'Pelanggan' } }),
    R('topup', ['u-spv', 'Laila (Direktur)'], 'Jakarta', 5000000, 'Top up kas apostille bulan November', 'disetujui', { ...ok, fund: 'Apostille', sumber_dana: 'PAL' }),
    R('lain', ['u-cs-sby', 'Ninda (CS Surabaya)'], 'Surabaya', 1750000, 'Beli meja kerja CS', 'dibayar', { ...paid, ago: 4, recipient: { bank: 'BRI', number: '0021-01-998877-50-1', holder: 'Toko Mebel Jaya' } }),
    R('lain', ['u-cs-mks', 'Aina (CS Makassar)'], 'Makassar', 300000, 'Langganan internet tambahan', 'ditolak', { ago: 3, rejected_reason: 'Sudah tercakup paket kantor', rejected_name: 'Fina (Direktur)' }),
  ]

  const K = (name, type, icon, color, order) => ({ id: id('k'), name, type, icon, color, logo: '', order, created_at: d(-60) })
  // Daftar ekspedisi dipusatkan di config/couriers.js supaya seed dan
  // migrasi data lama memakai sumber yang sama (tidak ada yang ganda).
  const couriers = DEFAULT_COURIERS.map((c, i) => K(c.name, c.type, c.icon, c.color, i + 1))
  // dipilih berdasarkan nama, bukan posisi — daftar ekspedisi bisa bertambah
  const kurir = (n) => couriers.find((c) => c.name === n) || couriers[0]
  projects.forEach((p, i) => { if (p.sub_projects.some((s) => ['siap_kirim', 'selesai'].includes(s.stage))) p.about.courier = kurir(i % 3 === 0 ? 'Diambil di Kantor' : i % 3 === 1 ? 'JNE' : 'J&T').id })

  return { users, people, projects, petty_cash, couriers, notifications: [], requests, perf_daily: [] }
}


/** Arsip proyek selesai 6 bulan terakhir — riwayat otorisasi untuk grafik bulanan (demo). */
export function archiveProjects(now = Date.now()) {
  const OT = [['u-ot-made', 'Muhammad Arifin'], ['u-ot-lukas', 'Sadipan'], ['u-pr-rina', 'Novita'], ['u-pr-ela', 'Ela']]
  const PRF = ['u-pr-kevin', 'u-pr-rina', 'u-pr-ela']
  const TR = ['u-tr-andre', 'u-tr-maria', 'u-tr-hendra', 'u-tr-lina']
  const DOC = ['Ijazah', 'Transkrip Nilai', 'Akta Kelahiran', 'Kartu Keluarga', 'Paspor', 'Surat Nikah', 'SKCK', 'Rekening Koran']
  const out = []
  let k = 0
  for (let m = 5; m >= 0; m--) {
    const perMonth = 3 + ((m * 7) % 4)
    for (let j = 0; j < perMonth; j++) {
      const i = k++
      const day = new Date(now - (m * 30 + (j * 5) % 26 + 2) * 864e5)
      const at = day.toISOString()
      const subs = Array.from({ length: 1 + (i % 3) }, (_, n) => {
        const ot = OT[(i + n) % (m === 0 ? 4 : 3 + (i % 2))]; const pr = PRF[(i + n) % 3]
        const files = 1 + ((i + n) % 4)
        return { id: `arch-s-${i}-${n}`, type: 'terjemahan', flow: 'tr_int', stage: 'selesai', title: DOC[(i + n) % DOC.length], description: `1. ${DOC[(i + n) % DOC.length]}`,
          file_count: files, pages: files * 2, docs: Array.from({ length: files }, (_, d) => ({ desc: `${DOC[(i + n + d) % DOC.length]}`, pages: 2, kind: (i + n + d) % 3 === 0 ? 'non_reguler' : 'reguler' })), lang_from: (i + n) % 5 === 0 ? 'Inggris' : 'Indonesia', lang_to: (i + n) % 5 === 0 ? 'Indonesia' : 'Inggris', translator: TR[(i + n) % 4], translator_kind: 'translator',
          data: { translator: TR[(i + n) % 4], translated_at: new Date(new Date(at).getTime() - 864e5).toISOString(), proofreader: pr, authorized_by: ot[0], authorized_name: ot[1], authorized_at: at },
          history: [{ at, by: ot[1], action: 'Otorisasi → Siap Print' }] }
      })
      out.push({ id: `arch-${i}`, invoice_no: `INV-000${String(100 + i).padStart(3, '0')}`, branch: ['Bali', 'Jakarta', 'Bandung'][i % 3],
        customer: { zoho_id: null, name: `Pelanggan Arsip ${i + 1}`, email: '', phone: '', city: '' },
        about: { deadline: at, received_at: at.slice(0, 10), priority: 'Normal', print_location: ['Bali', 'Jakarta', 'Bandung'][i % 3], cs_name: 'Nikita (CS Bali)' },
        sub_projects: subs, created_by: 'u-cs-bali', created_at: at, archive: true })
    }
  }
  return out
}


/** Demo order vendor bertermin tagihan (belum ditagih): Jepang via Emma, Mandarin via CS. */
export function billedDemo(m) {
  const v = (re) => m.people.find((p) => p.type === 'vendor' && re.test(p.name))
  const zen = v(/zenzia/i); const tin = v(/tinah/i)
  if (!zen || !tin) return []
  const day = (n) => new Date(Date.now() + n * 864e5).toISOString()
  const mk = (i, vend, svc, lf, lt, title, branch, cs, stage, coord, ago) => ({
    id: `bill-${i}`, invoice_no: `INV-000${300 + i}`, branch, customer: { zoho_id: null, name: `Pelanggan Tagihan ${i}`, email: '', phone: '', city: '' },
    about: { deadline: day(3 + i), received_at: day(-ago).slice(0, 10), priority: 'Normal', print_location: branch, cs_name: cs[1] },
    created_by: cs[0], created_at: day(-ago),
    sub_projects: [{ id: `bill-s-${i}`, type: 'terjemahan', flow: 'tr_bill', stage, title, description: `1. ${title}`, file_count: 1, pages: 2 + i, lang_from: lf, lang_to: lt,
      translator: vend.id, translator_kind: 'vendor', executor_kind: 'vendor', executor_id: vend.id,
      data: { vendor: vend.id, vendor_service: svc.name, vendor_cost: svc.price, total_pengajuan: svc.price, ordered_by: coord ? 'u-cs-yog' : cs[0], ordered_name: coord ? 'Emma (CS Yogyakarta)' : cs[1], ordered_at: day(-ago), ...(coord ? { coordinator: 'u-cs-yog' } : {}) },
      history: [{ at: day(-ago), by: coord ? 'Emma (CS Yogyakarta)' : cs[1], action: `Order ke vendor ${vend.name} · bayar sesuai tagihan` }] }],
  })
  const zs = zen.services?.[0] || { name: 'Terjemahan Jepang–Indonesia /dok', price: 450000 }
  const ts = tin.services?.[0] || { name: 'Terjemahan Mandarin–Indonesia /dok', price: 400000 }
  return [
    mk(1, zen, zs, 'Jepang', 'Indonesia', 'Koseki Tohon', 'Bali', ['u-cs-bali', 'Nikita (CS Bali)'], 'proses_vendor', true, 20),
    mk(2, zen, zs, 'Jepang', 'Indonesia', 'Sertifikat Kerja', 'Jakarta', ['u-cs-jkt', 'Rika (CS Jakarta)'], 'selesai', true, 15),
    mk(3, zen, zs, 'Indonesia', 'Jepang', 'Ijazah SMK', 'Bandung', ['u-cs-bdg', 'Debby (CS Bandung)'], 'selesai', true, 9),
    mk(4, tin, ts, 'Mandarin', 'Indonesia', 'Surat Keterangan Usaha', 'Bali', ['u-cs-bali', 'Nikita (CS Bali)'], 'proses_vendor', false, 6),
    mk(5, tin, ts, 'Mandarin', 'Indonesia', 'Akta Notaris', 'Jakarta', ['u-cs-jkt', 'Rika (CS Jakarta)'], 'selesai', false, 4),
  ]
}
