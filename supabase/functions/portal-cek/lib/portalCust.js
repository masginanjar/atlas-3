// ============================================================
//  PORTAL PELANGGAN — SATU LINK UMUM (#/cek)
//  Pelanggan: buka link → isi nomor HP → pilih invoice → lihat progres & dokumen.
//  Berkas ini HANYA logika murni (tanpa UI / jaringan) supaya dipakai bersama oleh:
//   • mode DEMO     : dijalankan di browser terhadap data demo
//   • mode SUPABASE : dijalankan di Edge Function (service role) → validasi di server
//
//  Catatan penting: nomor HP dipakai untuk MENCOCOKKAN pesanan, bukan verifikasi
//  identitas. Karena itu semua yang ditampilkan harus ringkas & tidak sensitif.
// ============================================================
import { stageIndex, DONE, flowOf, docListOf } from '../config/workflows.js'
import { normPhone, maskEmail, isEmail, MAX_FAILS, LOCK_MINUTES } from './portalCore.js'

export const ACCESS_DAYS = 14 // masa akses setiap invoice sejak admin mengaktifkan
export const LOOKUP_MAX = 8 // percobaan nomor HP per jendela
export const LOOKUP_WINDOW_MIN = 15
export const REVIEW_URL = 'https://g.page/r/Ccm_ctd83WbgEBM/review'

export const PACK_NOTE = 'Kami mengupayakan pengemasan dokumen sebaik mungkin sebelum diserahkan kepada kurir. Setelah penyerahan, proses pengantaran berada dalam penanganan pihak kurir. Jika terdapat kendala pengiriman, silakan hubungi kami untuk bantuan penelusuran.'
export const DRAFT_NOTE = 'Untuk pemeriksaan, belum merupakan hasil final.'

export const addDays = (iso, n) => new Date(new Date(iso).getTime() + n * 864e5).toISOString()

// ============================================================
//  1. TAHAP PROGRES PELANGGAN
//  Kunci baku (urut). Sub project yang alurnya tidak punya tahap tertentu
//  tidak akan pernah melaporkan tahap itu — tahapnya tidak dikarang.
// ============================================================
export const STEP_ORDER = ['invoice', 'work', 'review', 'ready', 'sent', 'arrived']
const STEP_LABEL = {
  invoice: 'Invoice Dibuat', work: 'Proyek Dikerjakan', review: 'Pengecekan Supervisi',
  ready: 'Dokumen Selesai', sent: 'Dokumen Dikirim', arrived: 'Dokumen Tiba',
}
const STEP_LABEL_DIGITAL = { ...STEP_LABEL, sent: 'Dokumen Digital Dikirim', arrived: 'Dokumen Digital Diterima' }

// Tahap internal → tahap pelanggan, per alur kerja. Alur tanpa proofread/otorisasi
// tidak memiliki 'review' sehingga tahap itu tidak ditampilkan.
const STEP_MAP = {
  tr_int: { cs_input: 'invoice', pilih_penerjemah: 'work', penerjemahan: 'work', proofread: 'review', otorisasi: 'review', registrasi: 'ready', siap_print: 'ready', upload_scan: 'ready', siap_kirim: 'ready' },
  tr_nt: { cs_input: 'invoice', penerjemahan: 'work', cs_final: 'ready' },
  jl: { proses: 'work', cs_final: 'ready' },
  ap_int: { cs_upload: 'invoice', antrian: 'work', diproses: 'work', cs_final: 'ready' },
  lg_int: { cs_upload: 'invoice', antrian: 'work', diproses: 'work', cs_final: 'ready' },
}
// Alur vendor: pengajuan/persetujuan/pembayaran adalah urusan internal — bagi pelanggan
// semuanya "dikerjakan", dan baru "selesai" setelah hasil dari vendor ada.
const VENDOR_FLOWS = ['tr_ext', 'tr_bill', 'ap_ext', 'lg_ext']

/** Semua kunci tahap yang berlaku untuk satu sub project (dipakai menyusun stepper). */
export function stepKeysOf(sub, project) {
  const flow = flowOf(sub, project)
  const map = STEP_MAP[flow]
  const base = map ? [...new Set(Object.values(map))] : ['invoice', 'work', 'ready']
  return STEP_ORDER.filter((k) => base.includes(k) || k === 'sent' || k === 'arrived')
}

/** Metode pengiriman proyek: pickup | softcopy | courier | vendor | null. */
export const shipTypeOf = (project, couriers = []) => couriers.find((c) => c.id === project?.about?.courier)?.type ?? null
/** Hanya digital (softcopy) → tidak ada kurir & tidak ada klaim penerimaan fisik. */
export const isDigital = (project, couriers) => shipTypeOf(project, couriers) === 'softcopy'

const HANDOVER_KEYS = { pickup: 'diambil', softcopy: 'softcopy_dikirim', courier: 'diserahkan_kurir', vendor: 'resi' }
/** Waktu dokumen diserahkan (ke kurir / pelanggan / dikirim softcopy). null bila belum. */
export function handoverAt(sub, project, couriers) {
  const t = shipTypeOf(project, couriers)
  const d = sub.data?.delivery || {}
  if (t === 'vendor') return d.resi || (project.about?.resi_no ? sub.data?.shipped_at || null : null)
  const k = HANDOVER_KEYS[t]
  const v = k ? d[k] : null
  return typeof v === 'string' ? v : v ? sub.data?.shipped_at || null : null
}

/** Waktu setiap tahap pelanggan untuk satu sub project (hanya dari data nyata). */
function stampsOf(sub, project, couriers, link) {
  const h = sub.history || []
  const at = (...acts) => h.find((x) => acts.some((a) => String(x.action || '').toLowerCase().includes(a)))?.at ?? null
  const out = { invoice: project.created_at || null }
  const flow = flowOf(sub, project)
  if (flow === 'tr_int') {
    out.work = sub.data?.assigned_at || at('tetapkan penerjemah', 'pilih penerjemah') || null
    out.review = sub.data?.translated_at || at('proofreader') || null
    out.ready = sub.data?.registered_at || sub.data?.authorized_at || null
  } else {
    out.work = at('diproses', 'dikerjakan', 'penerjemah') || null
    out.ready = sub.data?.hasil_vendor || sub.data?.hasil_akhir || sub.data?.hasil_jasa || sub.data?.hasil_terjemahan ? at('selesai', 'hasil') || null : null
  }
  out.sent = handoverAt(sub, project, couriers)
  const rec = (link?.receipts || []).find((r) => r.sub_id === sub.id)
  out.arrived = rec?.at || sub.data?.arrived_at || null
  return out
}

/** Tahap pelanggan yang sedang berjalan untuk satu sub project. */
export function custStepOf(sub, project, couriers = [], link = null) {
  const flow = flowOf(sub, project)
  const keys = stepKeysOf(sub, project)
  const stamps = stampsOf(sub, project, couriers, link)
  const rec = (link?.receipts || []).find((r) => r.sub_id === sub.id)
  let key
  if (rec || sub.data?.arrived_at) key = 'arrived'
  else if (stamps.sent) key = 'sent'
  else if (sub.stage === DONE) key = 'sent' // selesai internal = sudah diserahkan
  else if (VENDOR_FLOWS.includes(flow)) key = sub.data?.hasil_vendor ? 'ready' : 'work'
  else key = STEP_MAP[flow]?.[sub.stage] || 'work'
  // tahap yang tidak berlaku untuk alur ini digeser ke tahap sah terdekat sebelumnya
  if (!keys.includes(key)) key = keys[Math.max(0, STEP_ORDER.indexOf(key) - 1)] || keys[0]
  return { key, index: keys.indexOf(key), keys, stamps, done: key === 'arrived' }
}

/** Stepper tingkat pesanan: tahap paling belakang di antara semua layanan. */
export function orderStep(project, couriers = [], link = null) {
  const subs = project.sub_projects || []
  const keys = STEP_ORDER.filter((k) => subs.some((s) => stepKeysOf(s, project).includes(k)))
  const labels = isDigital(project, couriers) ? STEP_LABEL_DIGITAL : STEP_LABEL
  const steps = keys.map((k) => ({ key: k, label: labels[k] }))
  if (!subs.length) return { steps, index: 0, key: 'invoice', stamps: {} }
  let min = Infinity; let key = 'invoice'
  const stamps = {}
  for (const s of subs) {
    const st = custStepOf(s, project, couriers, link)
    const i = keys.indexOf(st.key)
    if (i >= 0 && i < min) { min = i; key = st.key }
    for (const [k, v] of Object.entries(st.stamps)) if (v && (!stamps[k] || v > stamps[k])) stamps[k] = v
  }
  return { steps, index: Math.max(0, min), key, stamps }
}

/** Kalimat sapaan sesuai tahap (tidak mengarang estimasi). */
export function stepMessage(key, digital) {
  if (key === 'ready') return 'Dokumen Anda sudah selesai.'
  if (key === 'sent') return digital ? 'Dokumen digital Anda sudah dikirim.' : 'Dokumen Anda telah diserahkan kepada kurir.'
  if (key === 'arrived') return digital ? 'Dokumen digital Anda telah diterima.' : 'Dokumen Anda telah tiba di tujuan.'
  const label = (digital ? STEP_LABEL_DIGITAL : STEP_LABEL)[key] || 'diproses'
  return `Dokumen Anda saat ini sedang dalam tahap ${label}.`
}

// ============================================================
//  2. DOKUMEN YANG BOLEH DIPUBLIKASIKAN
//  Hanya PDF draft & hasil final. File sumber / file kerja internal tidak pernah masuk.
// ============================================================
const PUB_FIELDS = {
  tr_int: [
    { key: 'hasil_terjemahan', kind: 'draft', label: 'Draft terjemahan', after: 'penerjemahan' },
    { key: 'hasil_proofread', kind: 'draft', label: 'Draft setelah pemeriksaan', after: 'proofread' },
    { key: 'file_final', kind: 'final', label: 'Hasil terjemahan final', after: 'otorisasi' },
    { key: 'scan_pdf', kind: 'final', label: 'Hasil terjemahan bercap (scan)', after: 'upload_scan' },
  ],
  tr_nt: [{ key: 'hasil_terjemahan', kind: 'final', label: 'Hasil terjemahan', after: 'penerjemahan' }],
  ap_int: [{ key: 'hasil_akhir', kind: 'final', label: 'Hasil apostille', done: true }],
  lg_int: [{ key: 'hasil_akhir', kind: 'final', label: 'Hasil legalisasi', done: true }],
  tr_ext: [{ key: 'hasil_vendor', kind: 'final', label: 'Hasil terjemahan', after: 'pembayaran' }],
  tr_bill: [{ key: 'hasil_vendor', kind: 'final', label: 'Hasil terjemahan', done: true }],
  ap_ext: [{ key: 'hasil_vendor', kind: 'final', label: 'Hasil apostille', after: 'pembayaran' }],
  lg_ext: [{ key: 'hasil_vendor', kind: 'final', label: 'Hasil legalisasi', after: 'pembayaran' }],
  jl: [{ key: 'hasil_jasa', kind: 'final', label: 'Hasil layanan', after: 'proses' }],
}

/** Semua dokumen yang BOLEH dipilih admin untuk dibagikan (belum tentu sudah dibagikan). */
export function publishableOf(project) {
  const out = []
  for (const s of project.sub_projects || []) {
    const flow = flowOf(s, project)
    const idx = stageIndex(flow, s.stage)
    for (const f of PUB_FIELDS[flow] || []) {
      const file = s.data?.[f.key]
      if (!file) continue
      if (f.done && s.stage !== DONE) continue
      if (f.after && idx <= stageIndex(flow, f.after)) continue
      out.push({ ref: `sub:${s.id}:${f.key}`, sub_id: s.id, kind: f.kind, label: f.label, title: s.title, name: file.name, file, at: file.uploaded_at || s.stage_at || null })
    }
    if (flow === 'tr_int' && idx > stageIndex(flow, 'otorisasi')) {
      (s.data?.file_final_list || []).slice(1).forEach((file, i) => file && out.push({
        ref: `sub:${s.id}:file_final_list:${i + 1}`, sub_id: s.id, kind: 'final', label: `Hasil terjemahan final (dokumen ${i + 2})`,
        title: s.title, name: file.name, file, at: file.uploaded_at || s.stage_at || null }))
    }
  }
  return out
}

/** Dokumen yang benar-benar sudah dipublikasikan ke pelanggan + nomor versi per sub. */
export function publishedOf(project, link) {
  const shared = new Set(link?.shared || [])
  const all = publishableOf(project).filter((d) => shared.has(d.ref))
  const seq = {}
  return all.map((d) => { const n = (seq[`${d.sub_id}:${d.kind}`] = (seq[`${d.sub_id}:${d.kind}`] || 0) + 1); return { ...d, version: n } })
}

/** Cari file dari ref — sekaligus memastikan ref memang sudah dipublikasikan. */
export function resolvePublished(project, link, ref) {
  return publishedOf(project, link).find((d) => d.ref === ref)?.file ?? null
}

// ============================================================
//  3. MASA AKSES
// ============================================================
/** aktif | off | expired | revoked | missing */
export function accessState(link, now = new Date()) {
  if (!link) return 'missing'
  if (link.revoked_at) return 'revoked'
  if (!link.activated_at) return 'off'
  if (link.expires_at && new Date(link.expires_at) <= now) return 'expired'
  return 'active'
}
export const accessMessage = (link) => `Akses pesanan ini berlaku selama ${ACCESS_DAYS} hari, hingga ${fmtDateTime(link?.expires_at)}. Silakan unduh atau kirim dokumen ke email Anda sebelum akses berakhir.`
function fmtDateTime(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) + ' WIB'
  } catch { return String(iso).slice(0, 16).replace('T', ' ') }
}

// ============================================================
//  4. PENCARIAN INVOICE DARI NOMOR HP
// ============================================================
/** Nomor HP yang tercatat pada satu proyek (kontak & penerima kiriman). */
export const phonesOf = (project) => [...new Set([project?.customer?.phone, project?.customer?.ship?.phone].map(normPhone).filter((x) => x.length >= 8))]

const SERVICE_LABEL = { terjemahan: 'Terjemahan Tersumpah', terjemahan_nt: 'Terjemahan Non Tersumpah', apostille: 'Apostille', legalisasi: 'Legalisasi', jasa_lain: 'Jasa Lain' }
export const serviceSummary = (project) => [...new Set((project.sub_projects || []).map((s) => SERVICE_LABEL[s.type] || s.type))].join(' · ')

/**
 * Daftar invoice untuk satu nomor HP — hanya yang aksesnya masih berlaku.
 * Ringkas saja: nomor invoice, tanggal, jenis layanan. Tanpa data pribadi lengkap.
 */
export function lookupInvoices(phone, projects, links, now = new Date()) {
  const p = normPhone(phone)
  if (p.length < 8) return []
  const byProject = new Map((links || []).filter((l) => l.kind === 'customer' && l.project_id).map((l) => [l.project_id, l]))
  return (projects || [])
    .filter((pr) => phonesOf(pr).includes(p) && accessState(byProject.get(pr.id), now) === 'active')
    .map((pr) => ({
      project_id: pr.id, invoice: pr.invoice_no, date: pr.about?.received_at || (pr.created_at || '').slice(0, 10),
      service: serviceSummary(pr), expires_at: byProject.get(pr.id)?.expires_at || null,
      step: orderStep(pr, [], byProject.get(pr.id)).key,
    }))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
}

/** Pembatasan percobaan pencarian per nomor (disimpan di app_settings / memori server). */
export function lookupGate(tries = [], now = new Date()) {
  const recent = (tries || []).filter((t) => now - new Date(t) < LOOKUP_WINDOW_MIN * 6e4)
  return { blocked: recent.length >= LOOKUP_MAX, tries: recent, left: Math.max(0, LOOKUP_MAX - recent.length) }
}

// ============================================================
//  5. TAMPILAN PELANGGAN
// ============================================================
/** Info kurir — hanya data yang benar-benar ada. */
export function courierInfo(project, couriers = []) {
  const k = couriers.find((c) => c.id === project.about?.courier)
  const t = shipTypeOf(project, couriers)
  if (!k || t === 'softcopy') return null
  const resi = project.about?.resi_no || ''
  const sent = (project.sub_projects || []).map((s) => handoverAt(s, project, couriers)).filter(Boolean).sort()[0] || null
  return { name: k.name, type: t, resi, track: resi && k.track_url ? String(k.track_url).replace('{resi}', encodeURIComponent(resi)) : '', sent_at: sent, status: project.about?.ship_status || '' }
}

/** Kelompok dokumen yang bisa dikonfirmasi penerimaannya (per sub project / per kiriman). */
export function receiptGroups(project, link, couriers = []) {
  const docs = publishedOf(project, link)
  const out = []
  for (const s of project.sub_projects || []) {
    const finals = docs.filter((d) => d.sub_id === s.id && d.kind === 'final')
    if (!finals.length) continue
    const st = custStepOf(s, project, couriers, link)
    const rec = (link?.receipts || []).find((r) => r.sub_id === s.id)
    const regs = (s.data?.reg_numbers || []).filter((x) => String(x || '').trim())
    const single = String(s.data?.registration_no || '').trim()
    const regList = regs.length ? regs : single ? [single] : []
    out.push({
      sub_id: s.id, title: s.title, docs: finals.map((d) => ({ ref: d.ref, name: d.name, label: d.label })),
      can: !rec && (st.key === 'sent' || st.key === 'arrived'),
      confirmed_at: rec?.at || null,
      reg_ready: regList.length > 0, reg_count: regList.length,
      reg_active: !!s.data?.reg_activated_at, reg_active_at: s.data?.reg_activated_at || null,
      reg_numbers: (link?.shared_regs || []).includes(s.id) ? regList : [],
      doc_count: docListOf(s).length,
    })
  }
  return out
}

/** Nomor WhatsApp admin dari pengaturan (kosong = tombol Hubungi Admin tidak ditampilkan). */
export const contactWa = (settings = []) => String((settings || []).find((s) => s.key === 'portal')?.wa || '').replace(/\D/g, '')

/** Payload lengkap yang boleh dilihat pelanggan untuk SATU invoice. */
export function custOrderView(link, project, couriers = [], payStatus = null, settings = []) {
  const digital = isDigital(project, couriers)
  const step = orderStep(project, couriers, link)
  const docs = publishedOf(project, link).map((d) => ({ ref: d.ref, name: d.name, label: d.label, kind: d.kind, version: d.version, at: d.at, title: d.title }))
  return {
    invoice: project.invoice_no, service: serviceSummary(project), digital,
    expires_at: link.expires_at, access_message: accessMessage(link),
    greeting: 'Halo Bapak/Ibu, terima kasih atas kepercayaan dan pesanan Anda.',
    step_key: step.key, step_index: step.index, steps: step.steps, stamps: step.stamps,
    step_message: stepMessage(step.key, digital),
    deadline: project.about?.deadline || null,
    docs, has_docs: docs.length > 0,
    email_masked: maskEmail(project.customer?.email), has_email: isEmail(project.customer?.email),
    note: link.cust_note?.text ? { text: link.cust_note.text, at: link.cust_note.at } : null,
    pay: payStatus ? { label: payStatus.label, key: payStatus.key } : null,
    courier: digital ? null : courierInfo(project, couriers),
    pack_note: digital ? '' : PACK_NOTE,
    receipts: receiptGroups(project, link, couriers),
    review_url: REVIEW_URL,
    contact_wa: contactWa(settings),
  }
}

// ============================================================
//  6. KONFIRMASI PENERIMAAN & AKTIVASI REGISTER
//  Tidak membuat nomor register baru — hanya mengaktifkan yang sudah disiapkan.
// ============================================================
/**
 * Hasilkan perubahan untuk satu konfirmasi penerimaan.
 * → { error } bila tidak boleh, atau { link, sub_patch, group } bila boleh.
 * Klik berulang aman: bila sudah ada konfirmasi untuk sub ini, dikembalikan { already: true }.
 */
export function confirmReceipt(link, project, subId, couriers = [], now = new Date()) {
  if (accessState(link, now) !== 'active') return { error: accessState(link, now) }
  const groups = receiptGroups(project, link, couriers)
  const g = groups.find((x) => x.sub_id === subId)
  if (!g) return { error: 'not_found' }
  if (g.confirmed_at) return { already: true, link, group: g }
  if (!g.can) return { error: 'not_ready' }
  if (!g.reg_ready) return { error: 'no_register' }
  const at = now.toISOString()
  const rec = { sub_id: subId, at, refs: g.docs.map((d) => d.ref), via: 'portal' }
  return {
    link: { ...link, receipts: [...(link.receipts || []), rec],
      history: [...(link.history || []), { at, by: 'Pelanggan (portal)', action: `Konfirmasi penerimaan dokumen · ${g.title} · register diaktifkan` }] },
    sub_patch: { reg_activated_at: at, reg_activated_via: 'portal', arrived_at: at },
    group: g,
  }
}

export { MAX_FAILS, LOOKUP_MAX as LOOKUP_LIMIT, LOCK_MINUTES, normPhone, maskEmail }
