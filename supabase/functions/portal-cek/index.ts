// ============================================================
//  PORTAL PELANGGAN (#/cek) — validasi di server.
//  Situs ATLAS berjalan sebagai halaman statis (GitHub Pages), sehingga
//  pengunjung portal tidak punya sesi Supabase sama sekali. Semua pemeriksaan
//  (cocok nomor HP, masa akses 14 hari, dokumen yang boleh diunduh, aktivasi
//  register) dikerjakan di sini memakai service role — bukan disembunyikan di UI.
//
//  Berkas lib/*.js & config/workflows.js adalah SALINAN PERSIS dari src/ aplikasi
//  supaya aturannya sama di demo dan live. Jangan diedit di sini — edit di src/,
//  lalu deploy ulang fungsi ini.
// ============================================================
import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  lookupInvoices, accessState, custOrderView, resolvePublished, confirmReceipt, normPhone,
} from './lib/portalCust.js'
import { payStateOf } from './lib/pay.js'

const URL_ = Deno.env.get('SUPABASE_URL')!
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const BUCKET = 'files'
const SESSION_HOURS = 2
const LOOKUP_MAX = 8 // percobaan nomor HP per IP
const LOOKUP_WINDOW_MIN = 15
const FILE_TTL = 600 // tautan file sementara: 10 menit

const db = createClient(URL_, SERVICE, { auth: { persistSession: false } })
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

// ---------- sesi bertanda tangan (tanpa tabel tambahan) ----------
const enc = new TextEncoder()
const b64url = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
let keyP: Promise<CryptoKey> | null = null
const key = () => (keyP ||= crypto.subtle.importKey('raw', enc.encode(SERVICE), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']))
async function sign(payload: Record<string, unknown>) {
  const body = b64url(enc.encode(JSON.stringify(payload)))
  return `${body}.${b64url(await crypto.subtle.sign('HMAC', await key(), enc.encode(body)))}`
}
async function open(token: string | null): Promise<{ ids: string[]; exp: number } | null> {
  if (!token || !token.includes('.')) return null
  const [body, sig] = token.split('.')
  if (b64url(await crypto.subtle.sign('HMAC', await key(), enc.encode(body))) !== sig) return null
  try {
    const p = JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/')))
    return p.exp > Date.now() ? p : null
  } catch { return null }
}

// ---------- pembatasan percobaan per IP ----------
async function gate(ip: string) {
  const since = new Date(Date.now() - LOOKUP_WINDOW_MIN * 6e4).toISOString()
  const { count } = await db.from('portal_hits').select('*', { count: 'exact', head: true }).eq('ip', ip).gte('at', since)
  return (count ?? 0) < LOOKUP_MAX
}
const hit = (ip: string, ok: boolean) => db.from('portal_hits').insert({ ip, at: new Date().toISOString(), ok }).then(() => {}, () => {})

// ---------- pengambilan data ----------
const docs = async (table: string, ids?: string[]) => {
  let q = db.from(table).select('doc')
  if (ids) q = q.in('id', ids)
  const { data } = await q
  return (data || []).map((r: { doc: Record<string, unknown> }) => r.doc)
}
const linkRow = async (pid: string) => {
  const { data } = await db.from('share_links').select('id,doc').eq('doc->>kind', 'customer').eq('doc->>project_id', pid).limit(1)
  return data?.[0] || null
}

async function payOf(invoiceNo: string) {
  const { data } = await db.from('zoho_invoices').select('status').eq('invoice_no', String(invoiceNo || '').toUpperCase()).limit(1)
  return payStateOf(data?.[0]?.status ?? null)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  let body: Record<string, string | string[]>
  try { body = await req.json() } catch { return json({ error: 'bad_request' }, 400) }
  const action = String(body.action || '')
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown'

  try {
    // ---- 1. cari invoice dari nomor HP ----
    if (action === 'lookup') {
      if (!(await gate(ip))) return json({ ok: false, error: 'blocked' })
      const phone = normPhone(String(body.phone || ''))
      if (phone.length < 8) { hit(ip, false); return json({ ok: false, invoices: [] }) }
      // dipersempit di database dulu (9 digit terakhir), pencocokan pastinya di sini
      const [{ data: cand }, links] = await Promise.all([
        db.rpc('portal_find_projects', { tail: phone.slice(-9) }),
        docs('share_links'),
      ])
      const rows = lookupInvoices(phone, cand || [], links)
      hit(ip, rows.length > 0)
      if (!rows.length) return json({ ok: false, invoices: [] }) // jawaban netral, tanpa bocoran
      const until = new Date(Date.now() + SESSION_HOURS * 36e5).toISOString()
      const session = await sign({ ids: rows.map((r: { project_id: string }) => r.project_id), exp: Date.parse(until) })
      return json({ ok: true, invoices: rows, session, until })
    }

    // ---- sesi wajib untuk semua aksi berikutnya ----
    const sess = await open(typeof body.session === 'string' ? body.session : null)
    if (!sess) return json({ error: 'session' }, 401)
    const pid = String(body.project_id || '')
    if (!sess.ids.includes(pid)) return json({ error: 'forbidden' }, 403) // ganti ID tidak membuka pesanan lain

    const [[project], row, couriers] = await Promise.all([docs('projects', [pid]), linkRow(pid), docs('couriers')])
    const link = row?.doc ?? null
    if (!project || !link) return json({ error: 'missing' }, 404)
    const st = accessState(link)
    if (st !== 'active') return json({ error: st }, 403)

    // ---- 2. detail pesanan ----
    if (action === 'order') return json(custOrderView(link, project, couriers, await payOf(project.invoice_no)))

    // ---- 3. file: tautan sementara, hanya untuk dokumen yang dipublikasikan ----
    if (action === 'file') {
      const f = resolvePublished(project, link, String(body.ref || ''))
      if (!f) return json({ error: 'not_found' }, 404)
      if (!f.path) return f.url ? json({ url: f.url, name: f.name }) : json({ error: 'not_found' }, 404)
      const { data, error } = await db.storage.from(f.bucket || BUCKET).createSignedUrl(f.path, FILE_TTL, { download: f.name })
      if (error || !data?.signedUrl) return json({ error: 'not_found' }, 404)
      return json({ url: data.signedUrl, name: f.name })
    }

    // ---- 4. kirim ke email — hanya ke alamat yang tercatat ----
    if (action === 'email') {
      const to = String(project.customer?.email || '')
      if (!to) return json({ error: 'no_email' })
      const refs = Array.isArray(body.refs) ? body.refs : []
      // Layanan pengirim email belum terhubung. Dicatat apa adanya — tidak mengklaim terkirim.
      await db.from('share_log').insert({
        id: `sl-${crypto.randomUUID()}`, created_at: new Date().toISOString(),
        doc: { project_id: pid, link_id: row.id, recipient_type: 'customer', recipient_name: project.customer?.name || '',
          to: to.replace(/^(.{2}).*(@.*)$/, '$1***$2'), channel: 'email', kind: 'portal_email', sender: 'Pelanggan (portal)',
          result: 'not_configured', note: `Permintaan kirim ${refs.length} dokumen — layanan email belum terhubung`, created_at: new Date().toISOString() },
      })
      return json({ error: 'not_configured' })
    }

    // ---- 5. konfirmasi penerimaan + aktivasi register ----
    if (action === 'confirm') {
      const subId = String(body.sub_id || '')
      const r = confirmReceipt(link, project, subId, couriers)
      if (r.error) return json({ error: r.error })
      if (r.already) return json({ ok: true, already: true }) // klik berulang tidak menggandakan
      const subs = (project.sub_projects || []).map((s: { id: string; data?: Record<string, unknown> }) =>
        (s.id === subId ? { ...s, data: { ...s.data, ...r.sub_patch } } : s))
      const now = new Date().toISOString()
      // register dulu: bila penyimpanan konfirmasi gagal, status tidak ditampilkan keliru
      const up1 = await db.from('projects').update({ doc: { ...project, sub_projects: subs, updated_at: now }, updated_at: now }).eq('id', pid)
      if (up1.error) return json({ error: 'failed' }, 500)
      const up2 = await db.from('share_links').update({ doc: r.link, updated_at: now }).eq('id', row.id)
      if (up2.error) return json({ error: 'failed' }, 500)
      return json({ ok: true })
    }

    return json({ error: 'unknown_action' }, 400)
  } catch (e) {
    console.error('portal-cek', action, e)
    return json({ error: 'server' }, 500)
  }
})
