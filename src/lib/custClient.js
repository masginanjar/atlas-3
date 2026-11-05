// ============================================================
//  KLIEN PORTAL PELANGGAN (satu link umum, tanpa login & tanpa OTP)
//   • SUPABASE : semua validasi di server → Edge Function "portal-cek"
//   • DEMO     : logika yang sama (portalCust) dijalankan di browser atas data demo
//  Sesi dibatasi pada invoice yang memang cocok dengan nomor HP — mengubah URL
//  atau ID proyek tidak membuka pesanan lain.
// ============================================================
import { MODE, db } from './db.js'
import { SUPABASE_URL, SUPABASE_KEY } from './supabase.js'
import { dataUrlToBlob } from './download.js'
import { zoho, payStateOf } from './integrations.js'
import {
  lookupInvoices, accessState, custOrderView, resolvePublished, confirmReceipt,
  normPhone, ACCESS_DAYS,
} from './portalCust.js'

const SKEY = 'atlas-cek-session'
const SESSION_HOURS = 2

function readSess() {
  try { const s = JSON.parse(sessionStorage.getItem(SKEY)); return s && new Date(s.until) > new Date() ? s : null } catch { return null }
}
function writeSess(s) { try { sessionStorage.setItem(SKEY, JSON.stringify(s)) } catch { /* abaikan */ } }
export function clearSess() { try { sessionStorage.removeItem(SKEY) } catch { /* abaikan */ } }
/** Invoice yang boleh dibuka pada sesi ini (dipakai UI untuk menolak ID asing lebih awal). */
export const allowed = () => readSess()?.ids || []

// ---------------- DEMO (logika di browser) ----------------
async function ctx() {
  const [projects, links, couriers, settings] = await Promise.all([db.list('projects'), db.list('share_links'), db.list('couriers'), db.list('app_settings')])
  return { projects, links, couriers, settings }
}
const linkOf = (links, pid) => links.find((l) => l.kind === 'customer' && l.project_id === pid) || null

const demo = {
  async lookup(phone) {
    const { projects, links } = await ctx()
    const rows = lookupInvoices(phone, projects, links)
    if (rows.length) writeSess({ phone: normPhone(phone), ids: rows.map((r) => r.project_id), until: new Date(Date.now() + SESSION_HOURS * 36e5).toISOString() })
    return { ok: rows.length > 0, invoices: rows }
  },
  async order(projectId) {
    const s = readSess()
    if (!s) return { error: 'session' }
    if (!s.ids.includes(projectId)) return { error: 'forbidden' }
    const { projects, links, couriers, settings } = await ctx()
    const project = projects.find((p) => p.id === projectId)
    const link = linkOf(links, projectId)
    const st = accessState(link)
    if (!project || st !== 'active') return { error: st === 'active' ? 'missing' : st }
    let pay = null
    try { pay = payStateOf(await zoho.invoiceStatus(project.invoice_no)) } catch { /* biarkan kosong */ }
    return custOrderView(link, project, couriers, pay, settings)
  },
  async file(projectId, ref) {
    const s = readSess()
    if (!s?.ids.includes(projectId)) throw new Error('Sesi berakhir — masukkan nomor HP lagi')
    const { projects, links } = await ctx()
    const project = projects.find((p) => p.id === projectId)
    const link = linkOf(links, projectId)
    if (!project || accessState(link) !== 'active') throw new Error('Akses pesanan ini sudah berakhir')
    const f = resolvePublished(project, link, ref)
    if (!f) throw new Error('Dokumen ini tidak tersedia')
    if (f.url?.startsWith('data:')) return { blob: dataUrlToBlob(f.url), name: f.name }
    if (f.url) return { url: f.url, name: f.name }
    throw new Error('File demo tidak tersimpan (lebih dari 1,5 MB)')
  },
  async email(projectId, refs = []) {
    const s = readSess()
    if (!s?.ids.includes(projectId)) return { error: 'session' }
    const { projects, links } = await ctx()
    const project = projects.find((p) => p.id === projectId)
    const link = linkOf(links, projectId)
    if (!project || accessState(link) !== 'active') return { error: 'expired' }
    // Layanan email belum terhubung — dicatat apa adanya, tidak mengklaim terkirim.
    await db.insert('share_log', {
      project_id: projectId, link_id: link.id, recipient_type: 'customer', recipient_name: project.customer?.name || '',
      to: project.customer?.email ? String(project.customer.email).replace(/^(.{2}).*(@.*)$/, '$1***$2') : '',
      channel: 'email', kind: 'portal_email', sender: 'Pelanggan (portal)', result: 'not_configured',
      note: `Permintaan kirim ${refs.length} dokumen — layanan email belum terhubung, tidak ada email yang dikirim`,
    })
    return { error: 'not_configured' }
  },
  async confirm(projectId, subId) {
    const s = readSess()
    if (!s?.ids.includes(projectId)) return { error: 'session' }
    const { projects, links, couriers } = await ctx()
    const project = projects.find((p) => p.id === projectId)
    const link = linkOf(links, projectId)
    if (!project || !link) return { error: 'missing' }
    const r = confirmReceipt(link, project, subId, couriers)
    if (r.error) return { error: r.error }
    if (r.already) return { ok: true, already: true }
    await db.update('share_links', link.id, { receipts: r.link.receipts, history: r.link.history })
    const subs = (project.sub_projects || []).map((x) => (x.id === subId ? { ...x, data: { ...x.data, ...r.sub_patch } } : x))
    await db.update('projects', project.id, { sub_projects: subs, updated_at: new Date().toISOString() })
    return { ok: true }
  },
}

// ---------------- SUPABASE (validasi di server) ----------------
const FN = `${SUPABASE_URL}/functions/v1/portal-cek`
async function call(action, body = {}) {
  const s = readSess()
  const r = await fetch(FN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    body: JSON.stringify({ action, session: s?.sid || null, ...body }),
  })
  const ct = r.headers.get('content-type') || ''
  if (!ct.includes('application/json')) {
    if (!r.ok) return { error: 'server' }
    return { blob: await r.blob() }
  }
  const j = await r.json()
  if (!r.ok && !j.error) j.error = 'server'
  return j
}
const server = {
  async lookup(phone) {
    const r = await call('lookup', { phone })
    if (r.ok && r.session) writeSess({ sid: r.session, ids: (r.invoices || []).map((x) => x.project_id), until: r.until })
    return r
  },
  order: (projectId) => (readSess() ? call('order', { project_id: projectId }) : Promise.resolve({ error: 'session' })),
  async file(projectId, ref) {
    const r = await call('file', { project_id: projectId, ref })
    if (r.url) return { url: r.url, name: r.name }
    if (r.blob) return { blob: r.blob, name: r.name }
    throw new Error(r.error === 'expired' ? 'Akses pesanan ini sudah berakhir' : 'Dokumen ini tidak tersedia')
  },
  email: (projectId, refs) => call('email', { project_id: projectId, refs }),
  confirm: (projectId, subId) => call('confirm', { project_id: projectId, sub_id: subId }),
}

export const cek = MODE === 'supabase' ? server : demo
export const CEK_DEMO = MODE !== 'supabase'
export { ACCESS_DAYS }

/** Alamat portal pelanggan yang dibagikan (satu link umum untuk semua pelanggan). */
export function cekUrl() {
  const base = import.meta.env.VITE_PUBLIC_URL || `${window.location.origin}${window.location.pathname}`
  return `${base.replace(/#.*$/, '')}#/cek`
}
