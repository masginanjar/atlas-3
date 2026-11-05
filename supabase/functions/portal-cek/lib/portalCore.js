// ============================================================
//  INTI PORTAL PELANGGAN & VENDOR — logika murni, dipakai bersama oleh:
//   • mode DEMO (di browser), dan
//   • mode LIVE (Vercel Functions /api/portal/*) → validasi di server.
//  Tidak ada akses UI / jaringan di sini.
// ============================================================
import { stagesOf, stageIndex, DONE, flowOf, totalPengajuan } from '../config/workflows.js'

export const MAX_FAILS = 5 // salah nomor HP maksimal 5x …
export const LOCK_MINUTES = 15 // … lalu dikunci 15 menit
export const MAX_EMAILS_PER_DAY = 3
export const SESSION_HOURS = 2

/** Token acak 32 byte (base64url) — sulit ditebak. */
export function randomToken(bytes = 32) {
  const a = new Uint8Array(bytes); globalThis.crypto.getRandomValues(a)
  let s = ''; for (const b of a) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Samakan format nomor HP Indonesia: +62 812-…, 62812…, 0812…, 812… → 0812… (digit saja). */
export function normPhone(v) {
  let d = String(v || '').replace(/[^\d+]/g, '')
  if (d.startsWith('+')) d = d.slice(1)
  if (d.startsWith('62')) d = '0' + d.slice(2)
  else if (d.startsWith('8')) d = '0' + d
  return d.replace(/\D/g, '')
}
export const maskPhone = (v) => { const d = normPhone(v); return d.length > 6 ? `${d.slice(0, 4)}••••${d.slice(-3)}` : '••••' }
export const maskEmail = (e) => { const [u, dmn] = String(e || '').split('@'); if (!dmn) return ''; return `${u.slice(0, 2)}${'•'.repeat(Math.max(2, u.length - 2))}@${dmn}` }
export const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e || '').trim())

/** Tambah 1 bulan kalender (31 Jan → 28/29 Feb). */
export function addMonth(iso) {
  const d = new Date(iso); const day = d.getUTCDate()
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()))
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate()
  t.setUTCDate(Math.min(day, last))
  return t.toISOString()
}

/** Status tautan: active | expired | revoked | locked. */
export function linkState(link, now = new Date()) {
  if (!link) return 'missing'
  if (link.revoked_at) return 'revoked'
  if (link.expires_at && new Date(link.expires_at) <= now) return 'expired'
  if (link.locked_until && new Date(link.locked_until) > now) return 'locked'
  return 'active'
}

/** Nomor HP terdaftar untuk tautan (pelanggan: kontak & penerima di proyek; vendor: kontak vendor). */
export function registeredPhones(link, { project, vendor }) {
  const list = link.kind === 'customer' ? [project?.customer?.phone, project?.customer?.ship?.phone] : [vendor?.phone]
  return [...new Set(list.map(normPhone).filter((x) => x.length >= 8))]
}

/** Cek nomor HP + pembatasan percobaan. Mengembalikan { ok, link (diperbarui), error }. */
export function verifyPhone(link, phone, ctx, now = new Date()) {
  const st = linkState(link, now)
  if (st !== 'active') return { ok: false, link, error: st }
  const reg = registeredPhones(link, ctx)
  const p = normPhone(phone)
  const recent = (link.fails || []).filter((t) => now - new Date(t) < LOCK_MINUTES * 6e4)
  if (reg.length && p && reg.includes(p)) {
    return { ok: true, link: { ...link, fails: [], last_open_at: now.toISOString(), opens: (link.opens || 0) + 1 } }
  }
  const fails = [...recent, now.toISOString()]
  const locked = fails.length >= MAX_FAILS
  return { ok: false, error: reg.length ? (locked ? 'locked' : 'wrong') : 'no_phone',
    left: Math.max(0, MAX_FAILS - fails.length),
    link: { ...link, fails, ...(locked ? { locked_until: new Date(now.getTime() + LOCK_MINUTES * 6e4).toISOString(), fails: [] } : {}) } }
}

// ---------- file final yang BOLEH dibagikan ----------
const FINAL_FIELDS = {
  tr_int: [{ key: 'scan_pdf', label: 'Hasil terjemahan (scan bercap)' }, { key: 'file_final', label: 'Hasil terjemahan final', after: 'otorisasi' }],
  ap_int: [{ key: 'hasil_akhir', label: 'Hasil apostille', done: true }],
  lg_int: [{ key: 'hasil_akhir', label: 'Hasil legalisasi', done: true }],
  tr_ext: [{ key: 'hasil_vendor', label: 'Hasil terjemahan', after: 'pembayaran' }],
  tr_bill: [{ key: 'hasil_vendor', label: 'Hasil terjemahan', done: true }],
  ap_ext: [{ key: 'hasil_vendor', label: 'Hasil apostille', after: 'pembayaran' }],
  lg_ext: [{ key: 'hasil_vendor', label: 'Hasil legalisasi', after: 'pembayaran' }],
  jl: [{ key: 'hasil_jasa', label: 'Hasil layanan', after: 'proses' }],
}
/** File final yang sudah disetujui per proyek (draf & file internal tidak pernah masuk). */
export function finalFilesOf(project, requests = []) {
  const out = []
  for (const s of project.sub_projects || []) {
    const flow = flowOf(s, project)
    for (const f of FINAL_FIELDS[flow] || []) {
      const file = s.data?.[f.key]
      if (!file) continue
      const idx = stageIndex(flow, s.stage)
      if (f.done && s.stage !== DONE) continue
      if (f.after && idx <= stageIndex(flow, f.after)) continue
      out.push({ ref: `sub:${s.id}:${f.key}`, sub_id: s.id, type: s.type, label: f.label, title: s.title, file })
    }
    if (flow === 'tr_int' && stageIndex(flow, s.stage) > stageIndex(flow, 'otorisasi'))
      (s.data?.file_final_list || []).slice(1).forEach((file, i) => file && out.push({ ref: `sub:${s.id}:file_final_list:${i + 1}`, sub_id: s.id, type: s.type, label: 'Hasil terjemahan final (lanjutan)', title: s.title, file }))
  }
  for (const r of requests) {
    if (r.kind === 'refund' && r.project_id === project.id && r.status === 'dibayar' && r.bukti_transfer) {
      out.push({ ref: `req:${r.id}`, request_id: r.id, type: 'refund', label: 'Bukti refund', title: `Refund ${r.purpose || ''}`.trim(), file: r.bukti_transfer, amount: r.amount, date: r.paid_date })
    }
  }
  return out
}

// ---------- progres sederhana untuk pelanggan ----------
const STEP_SETS = {
  tr_int: ['Diterima', 'Diproses', 'Selesai', 'Diserahkan'],
  jl: ['Diterima', 'Diproses', 'Selesai', 'Diserahkan'],
  default: ['Diterima', 'Diproses', 'Selesai'],
}
export function customerStep(sub, project) {
  const flow = flowOf(sub, project)
  const steps = STEP_SETS[flow] || STEP_SETS.default
  const st = sub.stage
  let i = 1
  if (flow === 'tr_int') i = st === DONE ? 3 : ['siap_print', 'upload_scan', 'siap_kirim'].includes(st) ? 2 : st === 'cs_input' ? 0 : 1
  else if (flow === 'jl') i = st === DONE ? 3 : st === 'cs_final' ? 2 : 1
  else if (['ap_int', 'lg_int'].includes(flow)) i = st === DONE ? 2 : st === 'cs_upload' ? 0 : 1
  else i = st === DONE || sub.data?.hasil_vendor ? 2 : 1 // alur vendor: tahapnya pembayaran, dokumen = diproses sampai hasil ada
  return { steps, index: i, label: steps[i] }
}
const TYPE_LABEL = { terjemahan: 'Terjemahan', apostille: 'Apostille', legalisasi: 'Legalisasi', jasa_lain: 'Jasa Lain', refund: 'Refund' }

/** Data yang boleh dilihat pelanggan — hanya proyek tautan ini. */
export function customerView(link, project, requests = []) {
  const shared = new Set(link.shared || [])
  const files = finalFilesOf(project, requests).filter((f) => shared.has(f.ref))
  const lastUpdate = [project.updated_at, project.created_at, ...(project.sub_projects || []).flatMap((s) => (s.history || []).map((h) => h.at))].filter(Boolean).sort().pop()
  return {
    kind: 'customer', name: project.customer?.name || '', invoice: project.invoice_no, expires_at: link.expires_at,
    deadline: project.about?.deadline || null, deadline_time: project.about?.deadline_time || null, updated_at: lastUpdate,
    email_masked: maskEmail(project.customer?.email), has_email: isEmail(project.customer?.email),
    services: (project.sub_projects || []).map((s) => {
      const st = customerStep(s, project)
      const reg = (link.shared_regs || []).includes(s.id) ? s.data?.registration_no || '' : ''
      return { id: s.id, type: TYPE_LABEL[s.type] || s.type, title: s.title, steps: st.steps, index: st.index, status: st.label, registration_no: reg,
        files: files.filter((f) => f.sub_id === s.id).map((f) => ({ ref: f.ref, name: f.file.name, label: f.label })) }
    }),
    refunds: files.filter((f) => f.request_id).map((f) => ({ ref: f.ref, name: f.file.name, label: f.label, amount: f.amount, date: f.date })),
  }
}

// ---------- vendor ----------
export function paymentOf(sub) {
  const total = totalPengajuan(sub.data)
  const pays = Array.isArray(sub.data?.payments) && sub.data.payments.length ? sub.data.payments
    : sub.data?.paid_at ? [{ amount: total, date: sub.data.paid_date || sub.data.paid_at.slice(0, 10), bukti: sub.data.bukti_transfer }] : []
  const paid = pays.reduce((a, p) => a + (Number(p.amount) || 0), 0)
  const status = !pays.length ? 'Belum Dibayar' : paid < total ? 'Sebagian' : 'Lunas'
  return { total, paid, status, payments: pays }
}
const fileKey = (f) => (f ? f.drive_id || `${f.name}|${f.size}` : '')
/** Data yang boleh dilihat vendor — hanya pekerjaan & pembayaran miliknya. Tanpa data pelanggan / harga jual. */
export function vendorView(link, vendor, projects) {
  const jobs = []
  for (const p of projects) for (const s of p.sub_projects || []) {
    if (s.data?.vendor !== vendor.id) continue
    const pay = paymentOf(s)
    const flow = flowOf(s, p)
    jobs.push({ id: s.id, ref: p.invoice_no, work: s.title, service: s.data?.vendor_service || '', lang: s.type === 'terjemahan' ? `${s.lang_from} → ${s.lang_to}` : '',
      deadline: p.about?.deadline || null, doc_status: s.stage === DONE || s.data?.hasil_vendor ? 'Selesai' : 'Berjalan',
      done: s.stage === DONE, flow, fee: pay.total, paid: pay.paid, pay_status: pay.status,
      payments: pay.payments.map((x, i) => ({ amount: x.amount, date: x.date, ref: x.bukti ? `pay:${s.id}:${i}` : null, name: x.bukti?.name || '', key: fileKey(x.bukti) })) })
  }
  // satu transfer untuk beberapa proyek → peta alokasi
  const byKey = {}
  for (const j of jobs) for (const x of j.payments) if (x.key) (byKey[x.key] ||= []).push({ ref: j.ref, work: j.work, amount: x.amount, date: x.date })
  for (const j of jobs) for (const x of j.payments) { x.allocation = x.key && byKey[x.key].length > 1 ? byKey[x.key] : null; delete x.key }
  return { kind: 'vendor', name: vendor.name, expires_at: link.expires_at, jobs: jobs.sort((a, b) => String(a.deadline || '').localeCompare(String(b.deadline || ''))) }
}

/** Cari file berdasar ref + pastikan ref memang diizinkan untuk tautan ini (dipakai juga untuk unduhan langsung). */
export function resolveFile(link, ref, { project, vendor, projects, requests = [] }) {
  if (link.kind === 'customer') {
    if (!(link.shared || []).includes(ref)) return null
    return finalFilesOf(project, requests).find((f) => f.ref === ref)?.file ?? null
  }
  const [, subId, i] = String(ref).split(':')
  for (const p of projects) for (const s of p.sub_projects || []) {
    if (s.id !== subId || s.data?.vendor !== vendor.id) continue
    return paymentOf(s).payments[Number(i)]?.bukti ?? null
  }
  return null
}

/** Buat tautan baru (aktif sekarang, berlaku 1 bulan kalender). */
export function newLink({ kind, project_id = null, vendor_id = null, by, now = new Date() }) {
  const at = now.toISOString()
  return { token: randomToken(), kind, project_id, vendor_id, activated_at: at, expires_at: addMonth(at), revoked_at: null,
    shared: [], shared_regs: [], fails: [], opens: 0, email_sends: [], created_by: by?.id ?? null, created_at: at,
    history: [{ at, by: by?.name || 'Sistem', action: `Tautan diaktifkan · berlaku s/d ${at && addMonth(at)}` }] }
}
export { stagesOf }
