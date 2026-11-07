// Data contoh untuk MODE DEMO saja.
export const DEMO_PDF = (name) => ({ name, size: 450, url: 'data:application/pdf;base64,JVBERi0xLjQKMSAwIG9iajw8L1R5cGUvQ2F0YWxvZy9QYWdlcyAyIDAgUj4+ZW5kb2JqCjIgMCBvYmo8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PmVuZG9iagozIDAgb2JqPDwvVHlwZS9QYWdlL1BhcmVudCAyIDAgUi9NZWRpYUJveFswIDAgNTk1IDg0Ml0vQ29udGVudHMgNCAwIFIvUmVzb3VyY2VzPDwvRm9udDw8L0YxIDUgMCBSPj4+Pj4+ZW5kb2JqCjQgMCBvYmo8PC9MZW5ndGggODg+PnN0cmVhbQpCVCAvRjEgMjIgVGYgNzIgNzYwIFRkIChBVExBUyBBbGZhIC0gRG9rdW1lbiBEZW1vKSBUaiAwIC0zMCBUZCAvRjEgMTIgVGYgKENvbnRvaCBoYXNpbCB0ZXJqZW1haGFuKSBUaiBFVAplbmRzdHJlYW0gZW5kb2JqCjUgMCBvYmo8PC9UeXBlL0ZvbnQvU3VidHlwZS9UeXBlMS9CYXNlRm9udC9IZWx2ZXRpY2E+PmVuZG9iagp0cmFpbGVyPDwvUm9vdCAxIDAgUj4+CiUlRU9G', drive_id: null, uploaded_at: new Date().toISOString() })
import { DEMO_CONTACTS } from './demoZoho.js'
import { BRANCHES } from '../config/access.js'
import { ONGKIR_TUJUAN as ONGKIR, totalBiaya } from '../config/workflows.js'
import { DEFAULT_COURIERS } from '../config/couriers.js'
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
    { id: 'u-spv', name: 'Laila (Supervisor)', email: 'laila@247.id', role: 'supervisor', branch: 'Jakarta' },
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

  const projects = [
    {
      id: id('pr'), invoice_no: 'INV-000231', category: 'tr_int', branch: 'Bali',
      customer: cust('z-1'),
      about: { deadline: d(2), priority: 'Super Ekspres', received_at: d(-3).slice(0, 10), print_location: 'Bali', cs_name: 'Nikita (CS Bali)' },
      sub_projects: [
        sub('Akta Pendirian', 'proofread', { pages: 12, data: { dokumen_sumber: DEMO_PDF('akta-pendirian-sumber.pdf'), translator: 'u-tr-andre', hasil_terjemahan: DEMO_PDF('akta-pendirian-terjemahan.pdf'), proofreader: 'u-pr-kevin' } }),
        sub('NIB', 'pilih_penerjemah', { pages: 2, data: { dokumen_sumber: DEMO_PDF('nib-sumber.pdf') } }),
      ],
      created_by: 'u-cs-bali', created_at: d(-3),
    },
    {
      id: id('pr'), invoice_no: 'INV-000232', category: 'tr_int', branch: 'Jakarta',
      customer: cust('z-2'),
      about: { deadline: d(5), priority: 'Normal', received_at: d(-3).slice(0, 10), print_location: 'Bali', cs_name: 'Nikita (CS Bali)' },
      sub_projects: [sub('Ijazah S1', 'siap_print', { pages: 1, data: { translator: 'u-tr-hendra', hasil_terjemahan: DEMO_PDF('ijazah-terjemahan.pdf'), proofreader: 'u-pr-rina', authorized_by: 'u-ot-lukas', authorized_name: 'Sadipan', file_final: DEMO_PDF('ijazah-final.pdf') } }),
        sub('Transkrip Nilai', 'otorisasi', { pages: 3, data: { translator: 'u-tr-hendra', hasil_terjemahan: DEMO_PDF('transkrip-terjemahan.pdf'), proofreader: 'u-pr-rina' } })],
      created_by: 'u-cs-jkt', created_at: d(-2),
    },
    {
      id: id('pr'), invoice_no: 'INV-000233', category: 'tr_ext', branch: 'Bali',
      customer: cust('z-3'),
      about: { deadline: d(7), priority: 'Normal', received_at: d(-3).slice(0, 10), print_location: 'Bali', cs_name: 'Nikita (CS Bali)' },
      sub_projects: [sub('Surat Keterangan Kerja', 'persetujuan', { lang_from: 'Jepang', lang_to: 'Indonesia', data: { vendor: pid('CV Lingua Nusantara'), vendor_service: 'Terjemahan Jepang–Indonesia /dok', vendor_cost: 450000, ongkir_to: 'Vendor → Pelanggan', ongkir_cost: 25000, total_pengajuan: 475000, submitted_by: 'u-cs-bali', submitted_name: 'Nikita (CS Bali)', submitted_at: d(-1) } })],
      created_by: 'u-cs-bali', created_at: d(-1),
    },
    {
      id: id('pr'), invoice_no: 'INV-000234', category: 'ap_int', branch: 'Bali',
      customer: cust('z-4'),
      about: { deadline: d(4), priority: 'Ekspres', received_at: d(-3).slice(0, 10), print_location: 'Bali', cs_name: 'Nikita (CS Bali)' },
      sub_projects: [sub('Akta Kelahiran', 'antrian', { type: 'apostille', country: 'Prancis', data: { dokumen_sumber: DEMO_PDF('akta-kelahiran-sumber.pdf'), biaya_proses: 350000, biaya_lain: [{ ket: 'Meterai 10.000', nominal: 10000 }, { ket: 'Legalisir notaris', nominal: 50000 }] } }), sub('Akta Nikah', 'cs_upload', { type: 'apostille', country: 'Prancis' })],
      created_by: 'u-cs-bali', created_at: d(-1),
    },
    {
      id: id('pr'), invoice_no: 'INV-000229', category: 'ap_ext', branch: 'Bandung',
      customer: cust('z-5'),
      about: { deadline: d(-1), priority: 'Normal', received_at: d(-3).slice(0, 10), print_location: 'Bali', cs_name: 'Nikita (CS Bali)' },
      sub_projects: [sub('Certificate of Origin', 'selesai', { type: 'apostille', country: 'Jepang', data: { vendor: pid('Jasa Apostille Prima'), vendor_service: 'Apostille Kemenkumham (reguler 5 hari)', vendor_cost: 750000, ongkir_to: 'Vendor → Kantor', ongkir_cost: 30000, total_pengajuan: 780000, sumber_dana: 'PAL', submitted_by: 'u-cs-bdg', submitted_name: 'Debby (CS Bandung)', submitted_at: d(-5), approved_name: 'Fina (Direktur)', approved_at: d(-4), paid_name: 'Wiwin (Akunting)', paid_at: d(-2), closed_name: 'Wiwin (Akunting)', closed_at: d(-2), rekening: { bank: 'BNI', number: '0987654321', holder: 'PT Jasa Apostille Prima' }, paid_date: d(-2).slice(0, 10) } })],
      created_by: 'u-cs-bdg', created_at: d(-6),
    },
  ]


  // ============ DATA DUMMY TAMBAHAN (10 per kelompok) ============
  const CS = { Bali: ['u-cs-bali', 'Nikita (CS Bali)'], Jakarta: ['u-cs-jkt', 'Rika (CS Jakarta)'], Bandung: ['u-cs-bdg', 'Debby (CS Bandung)'], Yogyakarta: ['u-cs-yog', 'Emma (CS Yogyakarta)'], Surabaya: ['u-cs-sby', 'Ninda (CS Surabaya)'], Makassar: ['u-cs-mks', 'Aina (CS Makassar)'], Medan: ['u-cs-mdn', 'Rhania (CS Medan)'], Batam: ['u-cs-btm', 'Gean (CS Batam)'] }
  const TR = { Bali: ['u-tr-andre', 'u-tr-maria'], Jakarta: ['u-tr-hendra'], Bandung: ['u-tr-lina'], Yogyakarta: ['u-tr-maria'] }
  const PR = { Bali: 'u-pr-kevin', Jakarta: 'u-pr-rina', Bandung: 'u-pr-rina', Yogyakarta: 'u-pr-kevin' }
  const OT = { Bali: ['u-ot-made', 'Muhammad Arifin'], Jakarta: ['u-ot-lukas', 'Sadipan'], Bandung: ['u-ot-lukas', 'Sadipan'], Yogyakarta: ['u-ot-made', 'Muhammad Arifin'] }
  const AP = { Bali: ['u-ap-putu', 'Khrisna'], Jakarta: ['u-ap-putu', 'Khrisna'], Bandung: ['u-ap-putu', 'Khrisna'], Yogyakarta: ['u-ap-putu', 'Khrisna'] }
  const BR = ['Bali', 'Jakarta', 'Surabaya', 'Bandung', 'Makassar', 'Yogyakarta', 'Medan', 'Batam']
  const pick = (m, b) => m[b] ?? m.Bali
  const PRIO = ['Normal', 'Ekspres', 'Normal', 'Super Ekspres', 'Normal', 'Sameday', 'Ekspres', 'Normal', 'Normal', 'Ekspres']
  const DOCS = ['Akta Kelahiran', 'Ijazah SMA', 'Kartu Keluarga', 'Surat Nikah', 'Paspor', 'SKCK', 'Transkrip Nilai', 'Rekening Koran', 'Surat Kuasa', 'NPWP Perusahaan', 'Akta Perubahan', 'Sertifikat Halal', 'Laporan Keuangan', 'Kontrak Kerja', 'Surat Keterangan Sehat']
  const LANGS = [['Indonesia', 'Inggris'], ['Inggris', 'Indonesia'], ['Indonesia', 'Jepang'], ['Indonesia', 'Mandarin'], ['Jerman', 'Indonesia'], ['Indonesia', 'Korea'], ['Indonesia', 'Prancis']]
  const NEG = ['Jepang', 'Belanda', 'Jerman', 'Australia', 'Korea Selatan', 'Prancis', 'Amerika Serikat', 'Inggris', 'Italia', 'Kanada']
  let inv = 250, k = 0
  const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const mk = (branch, subs, opt = {}) => {
    const i = k++; const [csId, csName] = CS[branch]
    const ago = opt.ago ?? (1 + (i % 6))
    subs.forEach((x) => { x.history = [{ at: d(-ago), by: csName, action: 'Dibuat' }] })
    projects.push({
      id: id('pr'), invoice_no: `INV-000${inv++}`, branch, customer: cust(`z-${(i % 17) + 1}`),
      about: { deadline: d(opt.deadline ?? [3, 0, 1, 0, 2, -1, 4, 0, 2, 0][i % 10]), deadline_time: ['09:00', '11:00', '13:00', '15:00', '17:00', '12:00'][i % 6], priority: PRIO[i % PRIO.length], received_at: d(-ago).slice(0, 10), print_location: opt.print ?? branch, cs_name: csName },
      sub_projects: subs, created_by: csId, created_at: d(-ago),
    })
  }
  const trSub = (j, stage, data = {}, extra = {}) => {
    const t = DOCS[j % DOCS.length]; const [lf, lt] = LANGS[j % LANGS.length]
    return { ...sub(t, stage, { pages: (j % 5) + 1, lang_from: lf, lang_to: lt, data: { ...data } }), flow: 'tr_int', translator_kind: 'translator', ...extra }
  }

  // 1) PROJECT BARU — CS Input & menunggu penetapan penerjemah
  for (let j = 0; j < 10; j++) {
    const b = BR[j % BR.length]
    const stage = j < 4 ? 'cs_input' : 'pilih_penerjemah'
    const t = DOCS[j % DOCS.length]
    mk(b, [trSub(j, stage, stage === 'cs_input' ? {} : { dokumen_sumber: DEMO_PDF(`${slug(t)}-sumber.pdf`) })], { ago: j % 2, deadline: 2 + (j % 5) })
  }

  // 2) PENGAJUAN VENDOR — berbagai status (2 terjemahan belum ada vendor)
  const VEN = [
    ['tr_ext', 'terjemahan', 'CV Lingua Nusantara', 'Terjemahan Jepang–Indonesia /dok', 450000],
    ['tr_ext', 'terjemahan', 'CV Lingua Nusantara', 'Terjemahan Mandarin–Indonesia /dok', 400000],
    ['ap_ext', 'apostille', 'Jasa Apostille Prima', 'Apostille Kemenkumham (reguler 5 hari)', 750000],
    ['ap_ext', 'apostille', 'Jasa Apostille Prima', 'Apostille Kemenkumham (express 2 hari)', 1250000],
    ['lg_ext', 'legalisasi', 'Jasa Apostille Prima', 'Legalisasi Kemenlu', 650000],
  ]
  const VST = ['pengajuan', 'pengajuan', 'persetujuan', 'persetujuan', 'persetujuan', 'pembayaran', 'pembayaran', 'pembayaran', 'dibayar', 'selesai']
  const DANA = ['ATS', 'PTI', 'PAL', 'ATI']
  for (let j = 0; j < 10; j++) {
    const b = BR[j % BR.length]; const [csId, csName] = CS[b]; const st = VST[j]
    const [flow, type, vName, svc, cost] = j < 2 ? VEN[j] : VEN[j % VEN.length]
    const t = DOCS[(j + 5) % DOCS.length]; const [lf, lt] = type === 'terjemahan' ? (j % 2 ? ['Mandarin', 'Indonesia'] : ['Jepang', 'Indonesia']) : ['Indonesia', 'Inggris']
    const v = people.find((x) => x.name === vName)
    const ongkir = [25000, 30000, 0, 45000][j % 4]
    let data = { dokumen_sumber: DEMO_PDF(`${slug(t)}-sumber.pdf`) }
    if (st !== 'pengajuan') {
      data = { ...data, vendor: v.id, vendor_service: svc, vendor_cost: cost, ongkir_to: ONGKIR[j % 2], ongkir_cost: ongkir, total_pengajuan: cost + ongkir,
        submitted_by: csId, submitted_name: csName, submitted_at: d(-2 - (j % 3)) }
      if (['pembayaran', 'dibayar', 'selesai'].includes(st)) Object.assign(data, { sumber_dana: DANA[j % 4], approved_by: 'u-dir', approved_name: 'Fina (Direktur)', approved_at: d(-1 - (j % 2)) })
      if (['dibayar', 'selesai'].includes(st)) Object.assign(data, { rekening: v.accounts[0], bukti_transfer: DEMO_PDF(`bukti-transfer-${slug(t)}.pdf`), paid_date: d(-1).slice(0, 10), paid_by: 'u-acc', paid_name: 'Wiwin (Akunting)', paid_at: d(-1) })
      if (st === 'selesai') Object.assign(data, { closed_by: 'u-acc', closed_name: 'Wiwin (Akunting)', closed_at: d(0) })
    }
    if (st === 'pengajuan' && lf === 'Jepang') data.coordinator = 'u-cs-yog' // order Jepang lewat Koordinator Emma
    const s0 = sub(t, st, { type, pages: (j % 3) + 1, lang_from: lf, lang_to: lt, country: type === 'terjemahan' ? '' : NEG[j], data })
    Object.assign(s0, { flow, executor_kind: 'vendor', executor_id: data.vendor ?? '' }, type === 'terjemahan' ? { translator_kind: 'vendor', translator: data.vendor ?? '' } : {})
    mk(b, [s0])
  }

  // 3) PEKERJAAN APOSTILLE / LEGALISASI INTERNAL — Staf Apostille
  const AST = ['cs_upload', 'cs_upload', 'antrian', 'antrian', 'antrian', 'diproses', 'diproses', 'diproses', 'selesai', 'selesai']
  const apCost = []
  for (let j = 0; j < 10; j++) {
    const b = BR[j % BR.length]; const st = AST[j]; const [apId, apName] = pick(AP, b)
    const type = j % 3 === 2 ? 'legalisasi' : 'apostille'
    const t = DOCS[(j + 2) % DOCS.length]
    const data = { staff_apostille: apId }
    if (st !== 'cs_upload') data.dokumen_sumber = DEMO_PDF(`${slug(t)}-sumber.pdf`)
    if (st === 'diproses' || st === 'selesai') Object.assign(data, { started_by: apId, started_name: apName, started_at: d(-1) })
    if (st === 'selesai') Object.assign(data, { hasil_akhir: DEMO_PDF(`${slug(t)}-${type}.pdf`), finished_by: apId, finished_name: apName, finished_at: d(0) })
    if (j % 2 === 1 || st === 'selesai') Object.assign(data, { biaya_proses: type === 'apostille' ? 300000 + (j % 3) * 50000 : 200000, biaya_lain: j % 4 === 1 ? [{ ket: 'Meterai 10.000', nominal: 10000 }] : [] })
    const s0 = sub(t, st, { type, country: NEG[(j + 3) % NEG.length], data })
    Object.assign(s0, { flow: type === 'apostille' ? 'ap_int' : 'lg_int', executor_kind: 'staff', executor_id: apId })
    mk(b, [s0])
    if (data.biaya_proses) apCost.push([projects[projects.length - 1], s0, b])
  }

  // 4) ORDER BERJALAN — terjemahan internal di berbagai tahap
  const OST = ['penerjemahan', 'penerjemahan', 'penerjemahan', 'proofread', 'proofread', 'otorisasi', 'otorisasi', 'siap_print', 'upload_scan', 'siap_kirim']
  const ORDER = ['cs_input', 'pilih_penerjemah', 'penerjemahan', 'proofread', 'otorisasi', 'siap_print', 'upload_scan', 'siap_kirim']
  for (let j = 0; j < 10; j++) {
    const b = BR[j % BR.length]; const st = OST[j]; const at = ORDER.indexOf(st)
    const t = DOCS[(j + 7) % DOCS.length]; const f = slug(t)
    const data = { dokumen_sumber: DEMO_PDF(`${f}-sumber.pdf`), translator: pick(TR, b)[j % pick(TR, b).length] }
    if (at > 2) Object.assign(data, { hasil_terjemahan: DEMO_PDF(`${f}-terjemahan.pdf`), proofreader: pick(PR, b) })
    if (at > 4) Object.assign(data, { authorized_by: pick(OT, b)[0], authorized_name: pick(OT, b)[1], file_final: DEMO_PDF(`${f}-final.pdf`) })
    if (at > 6) data.scan_pdf = DEMO_PDF(`${f}-scan.pdf`)
    if (st === 'otorisasi' && j === 6) data.claim = { by: pick(OT, b)[0], name: pick(OT, b)[1], at: d(0) }
    const subs = [trSub(j + 7, st, data)]
    if (j % 4 === 0) subs.push(trSub(j + 8, 'pilih_penerjemah', { dokumen_sumber: DEMO_PDF(`${slug(DOCS[(j + 8) % DOCS.length])}-sumber.pdf`) }))
    mk(b, subs, { print: j === 8 ? 'Bali' : b, ago: 2 + (j % 4) })
  }

  // demo Performa Hari Ini: beberapa deadline jatuh hari ini
  const todayAt = (t) => { const x = new Date(); x.setHours(12, 0, 0, 0); return { deadline: x.toISOString(), deadline_time: t } }
  Object.assign(projects.find((x) => x.invoice_no === 'INV-000231').about, todayAt('15:00'))
  Object.assign(projects.find((x) => x.invoice_no === 'INV-000234').about, todayAt('12:00'))
  const witaJob = projects.find((x) => x.sub_projects.some((y) => y.stage === 'penerjemahan' && y.data?.translator === 'u-tr-andre'))
  if (witaJob) Object.assign(witaJob.about, todayAt('10:00'))

  const csOf = { Bali: 'Nikita (CS Bali)', Jakarta: 'Rika (CS Jakarta)', Bandung: 'Debby (CS Bandung)', Yogyakarta: 'Emma (CS Yogyakarta)' }
  projects.forEach((p) => {
    if (!p.category) return // project dummy tambahan sudah punya flow per sub
    p.about.print_location = p.branch; p.about.cs_name = csOf[p.branch]
    p.sub_projects.forEach((s) => { s.flow = p.category; if (p.category === 'ap_int') { s.executor_kind = 'staff'; s.executor_id = 'u-ap-putu'; s.data.staff_apostille = 'u-ap-putu' }
    if (p.category.endsWith('ext')) { s.executor_kind = 'vendor'; s.executor_id = s.data.vendor; if (s.type === 'terjemahan') { s.translator_kind = 'vendor'; s.translator = s.data.vendor } } })
    delete p.category
  })
  projects[1].about.print_location = 'Bali' // contoh: project Jakarta dicetak di cabang Bali

  const petty_cash = [{ id: id('pc'), branch: 'Apostille', type: 'in', amount: 10000000, note: 'Saldo awal petty cash apostille (Supervisor)', project_id: null, by: 'Super Admin', created_at: d(-30) },
    ...BRANCHES.map((b) => ({
    id: id('pc'), branch: b, type: 'in', amount: 3000000, note: 'Saldo awal petty cash cabang', project_id: null, by: 'Super Admin', created_at: d(-30),
  }))]
  // biaya apostille yang sudah diisi Supervisor → tercatat di petty cash
  const pAp = projects.find((x) => x.invoice_no === 'INV-000234'); const sAp = pAp.sub_projects[0]
  apCost.forEach(([p, s0]) => petty_cash.push({ id: id('pc'), branch: 'Apostille', type: 'out', amount: totalBiaya(s0.data), note: `Biaya ${s0.type} ${p.invoice_no} — ${s0.title}`, project_id: p.id, sub_id: s0.id, by: 'Laila (Supervisor)', created_at: d(-1) }))
  petty_cash.push({ id: id('pc'), branch: 'Apostille', type: 'out', amount: 410000, note: `Biaya apostille ${pAp.invoice_no} — ${sAp.title}`, project_id: pAp.id, sub_id: sAp.id, by: 'Laila (Supervisor)', created_at: d(-1) })


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
    R('topup', ['u-spv', 'Laila (Supervisor)'], 'Jakarta', 5000000, 'Top up kas apostille bulan November', 'disetujui', { ...ok, fund: 'Apostille', sumber_dana: 'PAL' }),
    R('lain', ['u-cs-sby', 'Ninda (CS Surabaya)'], 'Surabaya', 1750000, 'Beli meja kerja CS', 'dibayar', { ...paid, ago: 4, recipient: { bank: 'BRI', number: '0021-01-998877-50-1', holder: 'Toko Mebel Jaya' } }),
    R('lain', ['u-cs-mks', 'Aina (CS Makassar)'], 'Makassar', 300000, 'Langganan internet tambahan', 'ditolak', { ago: 3, rejected_reason: 'Sudah tercakup paket kantor', rejected_name: 'Fina (Direktur)' }),
  ]

  const K = (name, type, icon, color, order) => ({ id: id('k'), name, type, icon, color, logo: '', order, created_at: d(-60) })
  // Daftar ekspedisi dipusatkan di config/couriers.js supaya seed dan
  // migrasi data lama memakai sumber yang sama (tidak ada yang ganda).
  const couriers = DEFAULT_COURIERS.map((c, i) => K(c.name, c.type, c.icon, c.color, i + 1))
  // dipilih berdasarkan nama, bukan posisi — daftar ekspedisi bisa bertambah
  const kurir = (n) => couriers.find((c) => c.name === n) || couriers[0]
  projects[0].about.courier = kurir('Diambil di Kantor').id
  projects[1].about.courier = kurir('JNE').id

  projects.push(...archiveProjects())
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
