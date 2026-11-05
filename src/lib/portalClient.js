// ============================================================
//  KLIEN PORTAL (tanpa login).
//   • LIVE  : semua validasi di server → /api/portal/{open,verify,view,file,email}
//   • DEMO  : logika yang sama (portalCore) dijalankan di browser terhadap data demo.
//             Ditandai jelas sebagai demo di UI.
// ============================================================
import { MODE, db } from './db.js'
import { dataUrlToBlob } from './download.js'
import { linkState, verifyPhone, customerView, vendorView, resolveFile, SESSION_HOURS, MAX_EMAILS_PER_DAY, isEmail, maskEmail } from './portalCore.js'

const SKEY = 'atlas-portal-session'
const getSess = (token) => { try { const s = JSON.parse(sessionStorage.getItem(SKEY)); return s?.token === token && new Date(s.until) > new Date() ? s : null } catch { return null } }

async function post(action, body) {
  const r = await fetch(`/api/portal/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const ct = r.headers.get('content-type') || ''
  if (ct.includes('application/json')) { const j = await r.json(); if (!r.ok && !j.error) j.error = 'server'; return j }
  if (!r.ok) return { error: 'server' }
  return r.blob()
}

// ---------- DEMO ----------
async function ctxFor(link) {
  const [projects, people, requests] = await Promise.all([db.list('projects'), db.list('people'), db.list('requests')])
  return { project: projects.find((p) => p.id === link.project_id), vendor: people.find((p) => p.id === link.vendor_id), projects, requests }
}
async function linkBy(token) { return (await db.list('share_links')).find((l) => l.token === token) ?? null }
async function active(token) {
  const link = await linkBy(token)
  const st = linkState(link)
  return st === 'active' || st === 'locked' ? { link, st } : { link: null, st }
}
const demo = {
  async open(token) {
    const link = await linkBy(token)
    const st = linkState(link)
    return { state: st, kind: link?.kind, expires_at: link?.expires_at, verified: !!getSess(token) && st === 'active' }
  },
  async verify(token, phone) {
    const link = await linkBy(token)
    if (!link) return { ok: false, error: 'missing' }
    const res = verifyPhone(link, phone, await ctxFor(link))
    await db.update('share_links', link.id, { fails: res.link.fails, locked_until: res.link.locked_until ?? null, last_open_at: res.link.last_open_at ?? link.last_open_at ?? null, opens: res.link.opens ?? link.opens ?? 0 })
    if (res.ok) sessionStorage.setItem(SKEY, JSON.stringify({ token, until: new Date(Date.now() + SESSION_HOURS * 36e5).toISOString() }))
    return { ok: res.ok, error: res.error, left: res.left }
  },
  async view(token) {
    if (!getSess(token)) return { error: 'session' }
    const { link, st } = await active(token)
    if (!link || st !== 'active') return { error: st }
    const c = await ctxFor(link)
    if (link.kind === 'customer') return c.project ? customerView(link, c.project, c.requests) : { error: 'missing' }
    return c.vendor ? vendorView(link, c.vendor, c.projects) : { error: 'missing' }
  },
  async file(token, ref) {
    if (!getSess(token)) throw new Error('Sesi berakhir — masukkan nomor HP lagi')
    const { link, st } = await active(token)
    if (!link || st !== 'active') throw new Error('Tautan ini sudah tidak aktif')
    const f = resolveFile(link, ref, await ctxFor(link))
    if (!f) throw new Error('File tidak tersedia untuk tautan ini')
    if (f.url?.startsWith('data:')) return { blob: dataUrlToBlob(f.url), name: f.name }
    throw new Error('File demo tidak tersimpan (lebih dari 1,5 MB)')
  },
  async email(token, { email } = {}) {
    if (!getSess(token)) return { error: 'session' }
    const { link, st } = await active(token)
    if (!link || st !== 'active') return { error: st }
    const recent = (link.email_sends || []).filter((t) => Date.now() - new Date(t) < 864e5)
    if (recent.length >= MAX_EMAILS_PER_DAY) return { error: 'limit' }
    const c = await ctxFor(link)
    const target = email || c.project?.customer?.email
    if (email && !isEmail(email)) return { error: 'invalid_email' }
    await db.insert('share_log', { project_id: link.project_id, link_id: link.id, recipient_type: 'customer', recipient_name: c.project?.customer?.name || '',
      to: maskEmail(target), channel: 'email', kind: 'portal_email', sender: 'Pelanggan (portal)', result: 'not_configured',
      note: 'Layanan email belum terhubung (mode demo) — tidak ada email yang dikirim' })
    return { error: 'not_configured' }
  },
}

// ---------- LIVE ----------
const live = {
  open: (token) => post('open', { token }).then((r) => ({ ...r, verified: !!getSess(token) && r.state === 'active' })),
  async verify(token, phone) {
    const r = await post('verify', { token, phone })
    if (r.ok) sessionStorage.setItem(SKEY, JSON.stringify({ token, sess: r.session, until: r.until }))
    return r
  },
  view: (token) => { const s = getSess(token); return s ? post('view', { token, session: s.sess }) : Promise.resolve({ error: 'session' }) },
  async file(token, ref) {
    const s = getSess(token); if (!s) throw new Error('Sesi berakhir — masukkan nomor HP lagi')
    const r = await post('file', { token, session: s.sess, ref })
    if (r instanceof Blob) return { blob: r, name: undefined }
    throw new Error(r.error === 'expired' || r.error === 'revoked' ? 'Tautan ini sudah tidak aktif' : 'File tidak tersedia')
  },
  email: (token, body = {}) => { const s = getSess(token); return s ? post('email', { token, session: s.sess, ...body }) : Promise.resolve({ error: 'session' }) },
}

export const portal = MODE === 'live' ? live : demo
export const PORTAL_DEMO = MODE !== 'live'
/** Tautan portal yang dibagikan ke pelanggan / vendor. */
export function portalUrl(token) {
  const base = import.meta.env.VITE_PUBLIC_URL || `${window.location.origin}${window.location.pathname}`
  return `${base.replace(/#.*$/, '')}#/p/${token}`
}
