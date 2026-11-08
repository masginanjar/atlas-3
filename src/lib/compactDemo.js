// ============================================================
//  DEMO RINGKAS — 30 project yang mewakili semua role & tahap.
//  Dipilih dari data contoh penuh; bila sebuah role belum punya tugas,
//  satu project disesuaikan agar role itu kebagian.
// ============================================================
import { DEMO_PDF } from './seed.js'

export const COMPACT_LIMIT = 10000 // v9: tidak dipangkas (data faktur Zoho sungguhan)
const now = () => new Date().toISOString()
const subsOf = (p) => p.sub_projects || []

export function compactDemo(m) {
  const users = m.users.filter((u) => u.active !== false)
  const byRole = (r) => users.filter((u) => u.role === r || (u.extra_roles || []).includes(r))
  const used = new Set()
  const chosen = []
  const take = (pred, mutate) => {
    const p = m.projects.find((x) => !used.has(x.id) && !x.cancelled && subsOf(x).some((s) => pred(s, x)))
    if (!p) return null
    used.add(p.id); chosen.push(p)
    if (mutate) { const s = subsOf(p).find((x) => pred(x, p)); mutate(s, p) }
    return p
  }
  const has = (flow, stage) => (s) => (s.flow || '') === flow && s.stage === stage

  // 1) Penerjemah: tiap orang 1 order (ubah dari "pilih penerjemah" bila perlu)
  for (const u of byRole('penerjemah')) {
    take((s) => s.flow === 'tr_int' && s.stage === 'penerjemahan' && s.data?.translator === u.id)
      || take(has('tr_int', 'pilih_penerjemah'), (s) => { Object.assign(s, { stage: 'penerjemahan', stage_at: now(), translator: u.id, translator_kind: 'translator' }); s.data = { ...s.data, translator: u.id, dokumen_sumber: s.data?.dokumen_sumber || DEMO_PDF(`${s.title}-sumber.pdf`) }; s.history = [...(s.history || []), { at: now(), by: 'Laila (Direktur)', action: `Penerjemah ditetapkan: ${u.name} → Penerjemahan` }] })
  }
  // 2) Proofreader: tiap orang 1 dokumen
  for (const u of byRole('proofreader')) {
    take((s) => s.flow === 'tr_int' && s.stage === 'proofread' && s.data?.proofreader === u.id)
      || take(has('tr_int', 'proofread'), (s) => { s.data = { ...s.data, proofreader: u.id } })
      || take(has('tr_int', 'pilih_penerjemah'), (s) => { Object.assign(s, { stage: 'proofread', stage_at: now(), translator: 'u-tr-andre', translator_kind: 'translator' }); s.data = { ...s.data, translator: 'u-tr-andre', proofreader: u.id, dokumen_sumber: DEMO_PDF(`${s.title}-sumber.pdf`), hasil_terjemahan: DEMO_PDF(`${s.title}-terjemahan.pdf`), translated_at: now() } })
  }
  // 2b) Terjemahan Non Tersumpah: 1 order sedang diterjemahkan (alur sederhana)
  take(has('tr_int', 'pilih_penerjemah'), (s) => { Object.assign(s, { type: 'terjemahan_nt', flow: 'tr_nt', stage: 'penerjemahan', stage_at: now(), translator: 'u-tr-maria', translator_kind: 'translator', docs: undefined, title: 'Surat Pernyataan (non tersumpah)', description: '1. Surat Pernyataan (non tersumpah)' }); s.data = { translator: 'u-tr-maria', dokumen_sumber: DEMO_PDF('surat-pernyataan-sumber.pdf') }; s.history = [{ at: now(), by: 'Nikita (CS Bali)', action: 'CS Input → Penerjemahan' }] })
  // 3) Otorisator (pool bersama): 2 dokumen
  take(has('tr_int', 'otorisasi')); take(has('tr_int', 'otorisasi'))
  // 3b) Admin Pusat: 1 dokumen menunggu nomor registrasi (dari siap print yang belum beregistrasi)
  take(has('tr_int', 'siap_print'), (s) => { Object.assign(s, { stage: 'registrasi', stage_at: now() }); s.data = { ...s.data, reg_numbers: [] }; s.history = [...(s.history || []), { at: now(), by: s.data?.authorized_name || 'Muhammad Arifin', action: 'Otorisasi → Menunggu Nomor Registrasi' }] })
  // 4) CS: cetak (1 titipan print), scan, kirim, input baru, menunggu supervisor
  take((s, p) => s.flow === 'tr_int' && s.stage === 'siap_print' && p.about?.print_location && p.about.print_location !== p.branch)
    || take(has('tr_int', 'siap_print'), (s, p) => { p.about.print_location = p.branch === 'Jakarta' ? 'Bali' : 'Jakarta' })
  take(has('tr_int', 'siap_print')); take(has('tr_int', 'upload_scan')); take(has('tr_int', 'siap_kirim'))
  take(has('tr_int', 'cs_input')); take((s, p) => s.flow === 'tr_int' && s.stage === 'cs_input' && p.branch !== chosen[chosen.length - 1]?.branch)
  // 5) Direktur: perlu penerjemah
  take(has('tr_int', 'pilih_penerjemah')); take(has('tr_int', 'pilih_penerjemah'))
  // 6) Koordinator bahasa (Jepang, Jerman) & alur vendor: pengajuan → ACC Direktur → bayar Akunting → dibayar
  for (const lang of [...new Set(users.map((u) => u.coordinator_lang).filter(Boolean))]) {
    take((s) => s.flow === 'tr_ext' && s.stage === 'pengajuan' && [s.lang_from, s.lang_to].includes(lang))
      || take(has('tr_ext', 'pengajuan'), (s) => { s.lang_from = lang; s.lang_to = 'Indonesia' })
  }
  take((s) => ['tr_ext', 'ap_ext', 'lg_ext'].includes(s.flow) && s.stage === 'persetujuan')
  take((s) => ['tr_ext', 'ap_ext', 'lg_ext'].includes(s.flow) && s.stage === 'persetujuan')
  take((s) => ['tr_ext', 'ap_ext', 'lg_ext'].includes(s.flow) && s.stage === 'pembayaran')
  take((s) => ['tr_ext', 'ap_ext', 'lg_ext'].includes(s.flow) && s.stage === 'dibayar')
  // 7) Vendor bertermin tagihan (koordinator buat tagihan, Direktur ACC, Akunting bayar)
  take(has('tr_bill', 'proses_vendor')); take((s) => s.flow === 'tr_bill' && s.stage === 'selesai' && !s.data?.bill_id)
  // 8) Staf Apostille & Legalisasi: tiap orang 1 pekerjaan + 1 antrian belum ditugaskan + 1 upload CS
  for (const u of byRole('staf_apostille')) {
    take((s) => ['ap_int', 'lg_int'].includes(s.flow) && ['antrian', 'diproses'].includes(s.stage) && s.data?.staff_apostille === u.id)
      || take((s, p) => ['ap_int', 'lg_int'].includes(s.flow) && ['antrian', 'diproses'].includes(s.stage) && (!s.data?.staff_apostille) && p.branch === u.branch, (s) => { s.data = { ...s.data, staff_apostille: u.id } })
      || take((s) => ['ap_int', 'lg_int'].includes(s.flow) && ['antrian', 'diproses'].includes(s.stage), (s) => { s.data = { ...s.data, staff_apostille: u.id } })
  }
  take((s) => ['ap_int', 'lg_int'].includes(s.flow) && s.stage === 'antrian' && !s.data?.staff_apostille)
  take((s) => ['ap_int', 'lg_int'].includes(s.flow) && s.stage === 'cs_upload')
  // 9) Riwayat selesai untuk grafik (beberapa bulan)
  const months = new Set()
  for (const p of m.projects) {
    if (chosen.length >= COMPACT_LIMIT) break
    if (used.has(p.id) || !p.archive) continue
    const k = String(p.created_at).slice(0, 7); if (months.has(k)) continue
    months.add(k); used.add(p.id); chosen.push(p)
  }
  // 10) Lengkapi sampai 30 dengan project aktif lain, lalu potong
  for (const p of m.projects) { if (chosen.length >= COMPACT_LIMIT) break; if (!used.has(p.id) && !p.archive && !p.cancelled && !p.demo_perf) { used.add(p.id); chosen.push(p) } }
  // v9: data berasal dari faktur Zoho sungguhan — tidak dipangkas, tidak ada project gabungan karangan
  m.projects = m.projects.filter((p) => !p.demo_perf)
  if (m.projects[0]) m.projects[0].about.notes = 'Pelanggan minta hasil dikirim ke alamat kantor, bukan rumah.'
  if (m.projects[3]) m.projects[3].about.notes = 'Nama di ijazah berbeda satu huruf dengan KTP — konfirmasi sebelum cetak.'
  const keepIds = new Set(m.projects.map((p) => p.id))
  // data turunan ikut diringkas
  m.requests = (m.requests || []).filter((r) => !r.project_id || keepIds.has(r.project_id)).slice(0, 6)
  m.petty_cash = (m.petty_cash || []).filter((r) => !r.project_id || keepIds.has(r.project_id))
  m.vendor_bills = (m.vendor_bills || []).filter((b) => (b.items || []).some((it) => keepIds.has(it.project_id)))
  m.activity_log = []
  m.perf_daily = []
  m.pings = demoPings(m)
  const payHit = m.projects.flatMap((p) => (p.sub_projects || []).map((s) => ({ p, s }))).find(({ s }) => s.stage === 'dibayar' || s.data?.bukti_transfer)
  m.notifications = [
    { id: 'ntf-pay-1', created_at: new Date(Date.now() - 25 * 60000).toISOString(), to_user: 'u-cs-bali', kind: 'payment', project_id: payHit?.p.id || null, text: `${payHit?.p.invoice_no || 'INV-000268'} · ${payHit?.s.title || 'Kontrak Kerja'}: Pengajuan Anda sudah dibayar — bukti transfer tersedia`, by: 'Wiwin (Akunting)', read_by: [] },
    { id: 'ntf-pay-2', created_at: new Date(Date.now() - 3 * 3600000).toISOString(), to_user: 'u-sa', kind: 'payment', project_id: payHit?.p.id || null, text: `${payHit?.p.invoice_no || 'INV-000268'} · Tagihan vendor ${'Rp 900.000'} sudah dibayar`, by: 'Wiwin (Akunting)', read_by: [] },
  ]
  m.app_settings = [...(m.app_settings || []).filter((r) => r.key !== 'demo'), { id: 'set-demo', key: 'demo', perf: false, created_at: now() }]
  portalDemo(m)
  m.compact_v1 = true; m.compact_v2 = true; m.compact_v3 = true; m.compact_v4 = true; m.compact_v5 = true; m.compact_v6 = true; m.compact_v7 = true; m.compact_v8 = true; m.compact_v9 = true
  return m
}

/**
 * Contoh untuk portal pelanggan (#/cek): 2 pesanan dengan akses pelanggan sudah aktif —
 *  • satu sudah diserahkan ke kurir + nomor register siap → pelanggan bisa konfirmasi terima
 *  • satu masih tahap pemeriksaan + draft dibagikan → pelanggan bisa lihat draft
 * Nomor HP pelanggan diseragamkan agar mudah dicoba: 0812-3456-7890.
 */
function portalDemo(m) {
  const at = (n) => new Date(Date.now() + n * 864e5).toISOString()
  const PHONE = '+62 812-3456-7890'
  const courier = (m.couriers || []).find((c) => c.type === 'courier')
  m.share_links = (m.share_links || []).filter((l) => l.kind !== 'customer')
  const mk = (p, extra) => {
    p.customer = { ...p.customer, phone: PHONE, email: p.customer?.email || 'pelanggan.demo@gmail.com', ship: { ...(p.customer?.ship || {}), phone: PHONE } }
    m.share_links.push({ id: `sl-cek-${p.id}`, token: `demo-cek-${p.id}`, kind: 'customer', project_id: p.id,
      activated_at: at(-2), expires_at: at(12), revoked_at: null, shared: extra.shared, shared_regs: extra.regs || [],
      receipts: [], cust_note: extra.note ? { text: extra.note, at: at(-1), by: 'Nikita (CS Bali)' } : null,
      fails: [], opens: 0, created_by: 'u-cs-bali', created_at: at(-2),
      history: [{ at: at(-2), by: 'Nikita (CS Bali)', action: 'Akses pelanggan diaktifkan · 14 hari' }] })
  }
  // 1) sudah dikirim — siap dikonfirmasi penerimaannya
  const sent = m.projects.find((p) => (p.sub_projects || []).some((s) => s.flow === 'tr_int' && ['siap_kirim', 'selesai'].includes(s.stage) && s.data?.scan_pdf))
  if (sent) {
    const s = sent.sub_projects.find((x) => x.flow === 'tr_int' && ['siap_kirim', 'selesai'].includes(x.stage) && x.data?.scan_pdf)
    s.data = { ...s.data, reg_numbers: ['REG-2026-0412'], registered_name: 'Nihaya (Admin Pusat)', registered_at: at(-2),
      delivery: { type: 'courier', diserahkan_kurir: at(-1) }, shipped_at: at(-1) }
    sent.about = { ...sent.about, courier: courier?.id || sent.about?.courier, resi_no: 'JP1234567890', ship_status: 'Dalam pengantaran' }
    mk(sent, { shared: [`sub:${s.id}:scan_pdf`, `sub:${s.id}:file_final`], regs: [s.id], note: 'Dokumen sudah dikirim. Mohon konfirmasi bila dokumen sudah Bapak/Ibu terima agar nomor register kami aktifkan.' })
  }
  // 2) masih diperiksa — draft dibagikan untuk dicek pelanggan
  const draft = m.projects.find((p) => p.id !== sent?.id && (p.sub_projects || []).some((s) => s.flow === 'tr_int' && s.stage === 'proofread' && s.data?.hasil_terjemahan))
  if (draft) {
    const s = draft.sub_projects.find((x) => x.flow === 'tr_int' && x.stage === 'proofread' && x.data?.hasil_terjemahan)
    mk(draft, { shared: [`sub:${s.id}:hasil_terjemahan`], note: 'Mohon diperiksa draft terjemahannya. Bila nama/tanggal sudah sesuai, kami lanjutkan ke otorisasi.' })
  }
  return m
}

/** 3 project gabungan: terjemahan tersumpah + apostille dalam satu project (berbagai tahap). */
function comboProjects(m) {
  const d = (n) => new Date(Date.now() + n * 864e5).toISOString()
  const day = (n) => d(n).slice(0, 10)
  const vendor = m.people.find((p) => p.type === 'vendor' && /apostille/i.test(p.name))
  const cust = (name, city) => ({ zoho_id: null, name, email: '', phone: '', city, ship: { attention: name, city } })
  const tr = (id, title, stage, data, extra = {}) => ({ id, type: 'terjemahan', flow: 'tr_int', stage, stage_at: d(-1), title, description: `1. ${title}`, file_count: 1, pages: extra.pages || 2, lang_from: 'Indonesia', lang_to: extra.to || 'Inggris', translator: data.translator || '', translator_kind: 'translator', country: '', docs: [{ desc: title, pages: extra.pages || 2, kind: 'reguler' }], data: { dokumen_sumber: DEMO_PDF(`${id}-sumber.pdf`), ...data }, history: [{ at: d(-2), by: extra.by || 'Nikita (CS Bali)', action: 'Dibuat' }] })
  const ap = (id, title, stage, country, data, extra = {}) => ({ id, type: 'apostille', flow: extra.flow || 'ap_int', stage, stage_at: d(-1), title, description: `1. ${title}`, file_count: 1, pages: 1, country, translator: '', executor_kind: extra.flow === 'ap_ext' ? 'vendor' : '', executor_id: extra.flow === 'ap_ext' ? vendor?.id : '', data: { dokumen_sumber: DEMO_PDF(`${id}-sumber.pdf`), ...data }, history: [{ at: d(-2), by: extra.by || 'Nikita (CS Bali)', action: 'Dibuat' }] })
  return [
    { id: 'combo-1', invoice_no: 'INV-000301', branch: 'Bali', customer: cust('Rahmat Hidayat', 'Denpasar'), created_by: 'u-cs-bali', created_at: d(-2),
      about: { deadline: day(2), deadline_time: '15:00', priority: 'Ekspres', received_at: day(-2), print_location: 'Bali', cs_name: 'Nikita (CS Bali)', notes: 'Apostille dikerjakan setelah terjemahan selesai — tujuan Belanda.' },
      sub_projects: [tr('combo-1-tr', 'Akta Kelahiran', 'penerjemahan', { translator: 'u-tr-andre' }), ap('combo-1-ap', 'Akta Kelahiran (apostille)', 'cs_upload', 'Belanda', {})] },
    { id: 'combo-2', invoice_no: 'INV-000302', branch: 'Jakarta', customer: cust('PT Nusantara Teknik', 'Jakarta Selatan'), created_by: 'u-cs-jkt', created_at: d(-4),
      about: { deadline: day(1), deadline_time: '12:00', priority: 'Super Ekspres', received_at: day(-4), print_location: 'Jakarta', cs_name: 'Rika (CS Jakarta)' },
      sub_projects: [tr('combo-2-tr', 'Akta Pendirian Perusahaan', 'otorisasi', { translator: 'u-tr-hendra', hasil_terjemahan: DEMO_PDF('combo-2-terjemahan.pdf'), proofreader: 'u-pr-rina', translated_at: d(-2), proofread_at: d(-1) }, { pages: 6, by: 'Rika (CS Jakarta)' }),
        ap('combo-2-ap', 'Akta Pendirian (apostille)', 'antrian', 'Jerman', { staff_apostille: 'u-ap-fajar' }, { by: 'Rika (CS Jakarta)' })] },
    { id: 'combo-3', invoice_no: 'INV-000303', branch: 'Bandung', customer: cust('Siti Nurhaliza', 'Bandung'), created_by: 'u-cs-bdg', created_at: d(-6),
      about: { deadline: day(3), deadline_time: '17:00', priority: 'Normal', received_at: day(-6), print_location: 'Bandung', cs_name: 'Debby (CS Bandung)' },
      sub_projects: [tr('combo-3-tr', 'Ijazah & Transkrip S1', 'siap_print', { translator: 'u-tr-lina', hasil_terjemahan: DEMO_PDF('combo-3-terjemahan.pdf'), proofreader: 'u-pr-kevin', authorized_by: 'u-ot-made', authorized_name: 'Muhammad Arifin', authorized_at: d(-1), file_final: DEMO_PDF('combo-3-final.pdf'), reg_numbers: ['REG-2026-0311'], registered_name: 'Nihaya (Admin Pusat)', registered_at: d(-1) }, { pages: 4, to: 'Inggris', by: 'Debby (CS Bandung)' }),
        ap('combo-3-ap', 'Ijazah (apostille Kemenkumham)', 'persetujuan', 'Australia', { vendor: vendor?.id, vendor_service: vendor?.services?.[0]?.name || 'Apostille Kemenkumham (reguler 5 hari)', vendor_cost: Number(vendor?.services?.[0]?.price) || 750000, ongkir_to: 'Vendor → Kantor', ongkir_cost: 30000, total_pengajuan: (Number(vendor?.services?.[0]?.price) || 750000) + 30000, submitted_by: 'u-cs-bdg', submitted_name: 'Debby (CS Bandung)', submitted_at: d(-1) }, { flow: 'ap_ext', by: 'Debby (CS Bandung)' })] },
  ]
}

/** Contoh Ping (pengingat antar-role) agar tab Ping tidak kosong di demo. */
function demoPings(m) {
  const ago = (min) => new Date(Date.now() - min * 60000).toISOString()
  const find = (pred) => m.projects.flatMap((p) => (p.sub_projects || []).map((s) => ({ p, s }))).find(pred)
  const mk = (id, from, to, hit, stage_label, message, min, read = false) => hit && ({ id, created_at: ago(min), from_user: from.id, from_name: from.name, from_role: from.role, to_user: to,
    project_id: hit.p.id, sub_id: hit.s.id, invoice_no: hit.p.invoice_no, sub_title: hit.s.title, stage_key: hit.s.stage, stage_label, deadline: hit.p.about?.deadline || null, message, read_by: read ? [to] : [] })
  const u = (id) => m.users.find((x) => x.id === id)
  const cs = u('u-cs-bali'), dir = u('u-dir'), sv = m.users.find((x) => x.role === 'supervisor'), ak = m.users.find((x) => x.role === 'akunting')
  return [
    mk('ping-1', cs, 'u-ot-made', find(({ s }) => s.stage === 'otorisasi'), 'Otorisasi', 'Mohon bantu selesaikan otorisasi dokumen ini agar bisa dilanjutkan ke proses print.', 5),
    mk('ping-2', cs, 'u-sa', find(({ s }) => s.stage === 'persetujuan'), 'Menunggu Persetujuan', 'Mohon ACC pengajuan vendor ini ya, pelanggan sudah menanyakan progres.', 42),
    mk('ping-3', cs, dir?.id, find(({ s }) => s.stage === 'persetujuan'), 'Menunggu Persetujuan', 'Mohon ACC pengajuan vendor ini ya, pelanggan sudah menanyakan progres.', 42),
    mk('ping-4', dir, sv?.id, find(({ s }) => s.stage === 'pilih_penerjemah'), 'Pilih Penerjemah', 'Tolong segera ditunjuk penerjemahnya, deadline-nya dekat.', 130),
    mk('ping-5', cs, ak?.id, find(({ s }) => s.stage === 'pembayaran'), 'Menunggu Pembayaran', 'Mohon transfer ke vendor hari ini supaya dokumen bisa diproses.', 60 * 26, true),
    mk('ping-6', sv || cs, 'u-sa', find(({ s }) => s.stage === 'registrasi'), 'Menunggu Nomor Registrasi', 'Nomor registrasi belum diisi, mohon dibantu agar bisa dicetak.', 60 * 5),
  ].filter(Boolean)
}
