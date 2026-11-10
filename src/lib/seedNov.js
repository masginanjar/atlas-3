// ============================================================
//  DATA DEMO DARI FAKTUR ZOHO SUNGGUHAN (1–10 November 2026).
//  Setiap project dibentuk persis seperti yang dibuat CS lewat "Buat Project":
//  item invoice dibaca parseInvoiceItems → sub project; prioritas dari item
//  (Sameday / Super Ekspres / Ekspres / Normal); tenggat = autoDeadline(tanggal invoice, prioritas).
//  Tahap pekerjaan disebar deterministik menurut umur invoice: yang lebih lama
//  umumnya sudah selesai, sisanya tersebar di tahap berjalan (termasuk yang terlambat).
// ============================================================
import { DEMO_ZOHO_NOV } from './demoZohoNov.js'
import { parseInvoiceItems } from './zohoParse.js'
import { branchOfInvoice } from '../config/access.js'
import { autoDeadline } from './waktu.js'
import { kodeArah, susunNomor, jumlahDok, namaDefault } from './registrasi.js'
import { docListOf } from '../config/workflows.js'

const TERAKHIR = DEMO_ZOHO_NOV.reduce((m, r) => (r.date > m ? r.date : m), '2026-11-01') // tanggal faktur terbaru di data
const HARI_INI = TERAKHIR
const HARI_NYATA = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date()) // tanggal kalender saat demo dibuka
let regSeq = 30573 // kode unik register demo (1 Nov 2026 mulai 030574, sesuai Sheet)
const hash = (s) => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 1000003, 7)
const iso = (date, jam = 9, menit = 0) => new Date(`${date}T${String(jam).padStart(2, '0')}:${String(menit).padStart(2, '0')}:00+08:00`).toISOString()
const umurHari = (date) => Math.round((new Date(`${HARI_INI}T00:00:00+08:00`) - new Date(`${date}T00:00:00+08:00`)) / 864e5)

const CS = {
  Bali: ['u-cs-bali', 'Nikita (CS Bali)'], Jakarta: ['u-cs-jkt', 'Rika (CS Jakarta)'], Bandung: ['u-cs-bdg', 'Debby (CS Bandung)'],
  Yogyakarta: ['u-cs-yog', 'Emma (CS Yogyakarta)'], Surabaya: ['u-cs-sby', 'Ninda (CS Surabaya)'], Makassar: ['u-cs-mks', 'Aina (CS Makassar)'],
  Medan: ['u-cs-mdn', 'Rhania (CS Medan)'], Batam: ['u-cs-btm', 'Gean (CS Batam)'], Semarang: ['u-cs-smg', 'Santi (CS Semarang)'],
}
const TR = { Bali: ['u-tr-andre', 'u-tr-maria'], Jakarta: ['u-tr-hendra'], Bandung: ['u-tr-lina'] }
const TR_SEMUA = ['u-tr-andre', 'u-tr-maria', 'u-tr-hendra', 'u-tr-lina']
const PR = { Bali: 'u-pr-kevin', Jakarta: 'u-pr-rina', Bandung: 'u-pr-rina' }
const PR_SEMUA = ['u-pr-kevin', 'u-pr-rina', 'u-pr-ela']
const OT = [['u-pr-ela', 'Ela'], ['u-ot-made', 'Muhammad Arifin'], ['u-pr-rina', 'Novita']]
// pembagian otorisasi demo: Ela terbanyak, lalu Muhammad Arifin, sedikit Novita (mengikuti catatan Otorisasi 2026)
const pilihOto = (h) => OT[[0, 0, 0, 0, 0, 0, 1, 1, 1, 2][h % 10]]
const AP = ['u-ap-putu', 'Khrisna']
const VENDOR_BAHASA = { Mandarin: [/tinah/i, 'bill'], Jepang: [/zenzia/i, 'bill'], Jerman: [/georgy/i, 'ext'], Arab: [/hamim/i, 'ext'], Korea: [/anisa/i, 'ext'] }
const NEGARA_APOSTILLE = ['Australia', 'Belanda', 'Jerman', 'Prancis', 'Amerika Serikat', 'Inggris', 'Italia', 'Kanada', 'Jepang', 'Korea Selatan']

const ORDER = ['cs_input', 'pilih_penerjemah', 'penerjemahan', 'proofread', 'otorisasi', 'registrasi', 'siap_print', 'upload_scan', 'siap_kirim', 'selesai']
const APS = ['cs_upload', 'antrian', 'diproses', 'selesai']
const VST = ['pengajuan', 'persetujuan', 'pembayaran', 'dibayar', 'selesai']
const DANA = ['ATS', 'PTI', 'PAL', 'ATI']

/** Tahap untuk sebuah sub: makin tua invoice makin besar peluang selesai; selebihnya tersebar. */
function pilihTahap(daftar, umur, h) {
  if (umur <= 0) return daftar[Math.min(daftar.length - 2, Math.floor(h / 100) % 3)] // dibuat hari ini: masih di tahap-tahap awal
  const pSelesai = umur >= 6 ? 0.95 : umur >= 5 ? 0.85 : umur >= 4 ? 0.7 : 0.25
  if ((h % 100) / 100 < pSelesai) return daftar[daftar.length - 1]
  const aktif = daftar.slice(0, -1)
  return aktif[Math.floor(h / 100) % aktif.length]
}

export function projectsFromZoho({ people = [], pdf, mkId }) {
  regSeq = 30573
  const vendor = (re) => people.find((p) => p.type === 'vendor' && re.test(p.name))
  const projects = []
  let n = 0
  const sid = () => mkId ? mkId('s') : `nov-s-${++n}`
  const pid = () => mkId ? mkId('pr') : `nov-p-${++n}`

  for (const inv of DEMO_ZOHO_NOV) {
    const h = hash(inv.invoice_no)
    const branch = branchOfInvoice(inv.invoice_no) || 'Bali'
    const umur = (inv.date === TERAKHIR && h % 5 === 1) ? 0 : umurHari(inv.date)
    // sebagian faktur sengaja dibiarkan belum jadi project (alur "Buat Project" di menu Faktur)
    const sisakan = inv.date === TERAKHIR ? 0.35 : 0.1
    if ((h % 97) / 97 < sisakan) continue
    if (inv.status === 'draft') continue
    const parsed = parseInvoiceItems(inv.line_items || [])
    if (!parsed.subs.length) continue
    const [csId, csName] = CS[branch] || CS.Bali
    // Supaya dasbor hidup: ±1 dari 5 invoice tanggal terbaru dianggap baru diinput HARI INI (tanggal nyata),
    // sepertiganya Sameday (tenggat hari ini), sisanya ikut prioritas aslinya.
    const hariIni = inv.date === TERAKHIR && h % 5 === 1
    const priority = hariIni && Math.floor(h / 7) % 3 === 0 ? 'Sameday' : (parsed.priority || 'Normal')
    const received = hariIni ? HARI_NYATA : inv.date
    const deadline = autoDeadline(received, priority)
    const dibuat = hariIni ? iso(HARI_NYATA, 7 + (h % 5), h % 60) : iso(received, 9 + (h % 8), h % 60)
    const waktuTahap = (langkah) => iso(received, 10 + Math.min(12, langkah * 2 + (h % 2)), (h * 7) % 60) // jam kerja berjalan sesudah dibuat

    const subs = parsed.subs.map((s, idx) => {
      const hs = hash(`${inv.invoice_no}#${idx}`)
      const title = (s.docs[0]?.desc || s.zoho_item || 'Dokumen').replace(/\s+/g, ' ').trim().slice(0, 60)
      const base = {
        id: sid(), type: s.type, title, description: s.description || `1. ${title}`, file_count: Math.max(1, s.docs.length), pages: s.pages || 1,
        pages_manual: (s.pages || 1) !== 1, lang_from: s.lang_from || '', lang_to: s.lang_to || '', country: s.country || '', institution: s.institution || '',
        notes: s.notes || '', zoho_item: s.zoho_item, zoho_qty: s.zoho_qty, zoho_rate: s.zoho_rate,
        docs: s.docs.length ? s.docs : [{ desc: title, pages: s.pages || 1, kind: 'reguler' }],
        translator: '', data: {}, history: [{ at: dibuat, by: csName, action: 'Dibuat dari faktur Zoho' }],
      }
      const f = (name) => pdf(`${inv.invoice_no.replace('INV-', '')}_${name}.pdf`, csName)

      // ---- apostille / legalisasi ----
      if (s.type === 'apostille' || s.type === 'legalisasi') {
        const keVendor = s.type === 'apostille' && hs % 4 === 0
        const negara = s.country || NEGARA_APOSTILLE[hs % NEGARA_APOSTILLE.length]
        if (keVendor) {
          const v = vendor(/apostille prima/i)
          const stage = pilihTahap(VST, umur, hs)
          const svc = v?.services?.[0] || { name: 'Apostille Kemenkumham (reguler 5 hari)', price: 750000 }
          const data = { dokumen_sumber: f('sumber') }
          const at = VST.indexOf(stage)
          if (at >= 1) Object.assign(data, { vendor: v?.id, vendor_service: svc.name, vendor_cost: svc.price, ongkir_cost: 0, total_pengajuan: svc.price, submitted_by: csId, submitted_name: csName, submitted_at: waktuTahap(1) })
          if (at >= 2) Object.assign(data, { sumber_dana: DANA[hs % 4], approved_by: 'u-dir', approved_name: 'Fina (Direktur)', approved_at: waktuTahap(2) })
          if (at >= 3) Object.assign(data, { rekening: v?.accounts?.[0], bukti_transfer: f('bukti-transfer'), paid_date: received, paid_by: 'u-acc', paid_name: 'Wiwin (Akunting)', paid_at: waktuTahap(3) })
          if (at >= 4) Object.assign(data, { hasil_akhir: f('apostille'), closed_by: 'u-acc', closed_name: 'Wiwin (Akunting)', closed_at: waktuTahap(4) })
          return { ...base, country: negara, stage, stage_at: waktuTahap(at), flow: 'ap_ext', executor_kind: 'vendor', executor_id: v?.id || '', data }
        }
        const stage = pilihTahap(APS, umur, hs)
        const at = APS.indexOf(stage)
        const data = { staff_apostille: AP[0] }
        if (at >= 1) data.dokumen_sumber = f('sumber')
        if (at >= 2) Object.assign(data, { started_by: AP[0], started_name: AP[1], started_at: waktuTahap(2), biaya_proses: s.type === 'apostille' ? 300000 + (hs % 3) * 50000 : 200000, biaya_lain: hs % 4 === 1 ? [{ ket: 'Meterai 10.000', nominal: 10000 }] : [] })
        if (at >= 3) Object.assign(data, { hasil_akhir: f(s.type), finished_by: AP[0], finished_name: AP[1], finished_at: waktuTahap(4) })
        return { ...base, country: s.type === 'apostille' ? negara : '', stage, stage_at: waktuTahap(at), flow: s.type === 'apostille' ? 'ap_int' : 'lg_int', executor_kind: 'staff', executor_id: AP[0], data }
      }

      // ---- terjemahan: vendor (bahasa tertentu) atau internal ----
      const bahasaAsing = [s.lang_from, s.lang_to].find((l) => l && l !== 'Indonesia' && VENDOR_BAHASA[l])
      if (bahasaAsing) {
        const [re, jenis] = VENDOR_BAHASA[bahasaAsing]
        const v = vendor(re)
        const svc = v?.services?.find((x) => new RegExp(`${s.lang_from}.${s.lang_to}`).test(x.name)) || v?.services?.[0] || { name: `Terjemahan ${bahasaAsing}`, price: 400000 }
        const koord = bahasaAsing === 'Jepang' ? 'u-cs-yog' : bahasaAsing === 'Jerman' ? 'u-cs-bdg' : ''
        if (jenis === 'bill') {
          const stage = (hs % 100) / 100 < (umur >= 5 ? 0.7 : 0.3) ? 'selesai' : 'proses_vendor'
          const data = { dokumen_sumber: f('sumber'), vendor: v?.id, vendor_service: svc.name, vendor_cost: svc.price * (s.pages || 1), total_pengajuan: svc.price * (s.pages || 1),
            ordered_by: koord || csId, ordered_name: koord ? 'Emma (CS Yogyakarta)' : csName, ordered_at: waktuTahap(1), ...(koord ? { coordinator: koord } : {}) }
          if (stage === 'selesai') Object.assign(data, { hasil_terjemahan: f('terjemahan'), finished_at: waktuTahap(4) })
          return { ...base, stage, stage_at: waktuTahap(stage === 'selesai' ? 4 : 1), flow: 'tr_bill', translator: v?.id || '', translator_kind: 'vendor', executor_kind: 'vendor', executor_id: v?.id || '', data,
            history: [...base.history, { at: waktuTahap(1), by: data.ordered_name, action: `Order ke vendor ${v?.name || ''} · bayar sesuai tagihan` }] }
        }
        const stage = pilihTahap(VST, umur, hs)
        const at = VST.indexOf(stage)
        const data = { dokumen_sumber: f('sumber'), ...(koord ? { coordinator: koord } : {}) }
        if (at >= 1) Object.assign(data, { vendor: v?.id, vendor_service: svc.name, vendor_cost: svc.price * (s.pages || 1), ongkir_cost: 0, total_pengajuan: svc.price * (s.pages || 1), submitted_by: csId, submitted_name: csName, submitted_at: waktuTahap(1) })
        if (at >= 2) Object.assign(data, { sumber_dana: DANA[hs % 4], approved_by: 'u-dir', approved_name: 'Fina (Direktur)', approved_at: waktuTahap(2) })
        if (at >= 3) Object.assign(data, { rekening: v?.accounts?.[0] || { bank: 'BCA', number: '', holder: v?.name || '' }, bukti_transfer: f('bukti-transfer'), paid_date: received, paid_by: 'u-acc', paid_name: 'Wiwin (Akunting)', paid_at: waktuTahap(3) })
        if (at >= 4) Object.assign(data, { hasil_terjemahan: f('terjemahan'), closed_by: 'u-acc', closed_name: 'Wiwin (Akunting)', closed_at: waktuTahap(4) })
        return { ...base, stage, stage_at: waktuTahap(at), flow: 'tr_ext', translator: v?.id || '', translator_kind: 'vendor', executor_kind: 'vendor', executor_id: v?.id || '', data }
      }

      // internal (tersumpah / non tersumpah)
      const stage = pilihTahap(ORDER, umur, hs)
      const at = ORDER.indexOf(stage)
      const trList = TR[branch] || TR_SEMUA
      const translator = trList[hs % trList.length]
      const proofreader = PR[branch] || PR_SEMUA[hs % PR_SEMUA.length]
      const [otId, otName] = pilihOto(hs)
      const data = {}
      if (at >= 1) data.dokumen_sumber = f('sumber')
      if (at >= 2) data.translator = translator
      if (at >= 3) Object.assign(data, { hasil_terjemahan: f('terjemahan'), proofreader })
      if (at >= 5) {
        const kode = kodeArah(base)
        const nomor = kode ? Array.from({ length: jumlahDok(base) }, () => susunNomor(kode, ++regSeq, waktuTahap(4))) : []
        Object.assign(data, { authorized_by: otId, authorized_name: otName, authorized_at: waktuTahap(4), file_final: f('final'),
          reg_numbers: nomor, reg_names: nomor.map((_, k) => namaDefault(docListOf(base)[k], { customer_name: inv.customer_name })), ...(nomor.length ? { reg_reserved_at: waktuTahap(4) } : {}) })
      }
      if (at >= 6) Object.assign(data, { registered_by: 'u-adm', registered_name: 'Nihaya (Admin Pusat)', registered_at: waktuTahap(5) })
      if (at >= 7) data.printed_at = waktuTahap(6)
      if (at >= 8) data.scan_pdf = f('scan')
      if (at >= 9) Object.assign(data, { delivery: { type: parsed.courier ? 'courier' : 'pickup', diserahkan_kurir: waktuTahap(8) }, shipped_at: waktuTahap(8), finished_at: waktuTahap(8) })
      if (stage === 'otorisasi' && hs % 3 === 0) data.claim = { by: otId, name: otName, at: waktuTahap(4) }
      return { ...base, stage, stage_at: waktuTahap(at), flow: s.type === 'terjemahan_nt' ? 'tr_nt' : 'tr_int', translator: at >= 2 ? translator : '', translator_kind: 'translator', data }
    })

    const about = {
      deadline, deadline_time: priority === 'Sameday' ? '17:00' : priority === 'Super Ekspres' ? '12:00' : '', priority, received_at: received,
      print_location: branch, cs_name: csName,
      ...(parsed.others.length || parsed.office ? { notes: `Dari invoice: ${[...parsed.others.map((o) => [o.name, o.description.replace(/\s+/g, ' ').trim()].filter(Boolean).join(': ')), ...(parsed.office ? [`Ambil/kirim via kantor ${parsed.office}`] : [])].join(' · ')}` } : {}),
    }
    const ship = parsed.ship && parsed.hasAddress ? parsed.ship : { attention: inv.contact?.name || inv.customer_name }
    projects.push({
      id: pid(), invoice_no: inv.invoice_no, zoho_invoice_id: inv.zoho_id, branch,
      customer: { zoho_id: inv.customer_id, name: inv.customer_name, email: inv.contact?.email || parsed.email || '', phone: inv.contact?.mobile || ship.phone || '', city: ship.city || '', ship },
      about, sub_projects: subs, created_by: csId, created_at: dibuat,
    })
  }
  return projects
}
