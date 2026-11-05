// ============================================================
//  INTEGRASI — Zoho Books & Google Drive.
//  LIVE: memanggil Vercel Functions di /api (kunci rahasia hanya di server).
//  DEMO: memakai data contoh supaya alur bisa dicoba tanpa akun.
// ============================================================
import { MODE, db } from './db.js'
import { supabaseDrive } from './supabase.js'
import { dataUrlToBlob } from './download.js'
import { DEMO_CONTACTS } from './demoZoho.js'

// Zoho asli aktif bila mode LIVE, atau VITE_ZOHO_LIVE=true (tes Zoho sebelum InsForge siap)
const ZOHO_LIVE = MODE === 'live' || import.meta.env.VITE_ZOHO_LIVE === 'true' // Supabase: Zoho menyusul lewat Edge Function

async function api(path, opts = {}) {
  const token = await db.token()
  const res = await fetch(path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts.headers || {}) },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || `Gagal (${res.status})`)
  return body
}

// ---------------- Zoho Books ----------------
const DEMO_INVOICES = {
  'z-6': [{ invoice_no: 'INV-000240', date: '2026-11-02', total: 1250000, status: 'sent' }, { invoice_no: 'INV-000241', date: '2026-11-03', total: 600000, status: 'draft' }],
  'z-7': [{ invoice_no: 'INV-000242', date: '2026-11-03', total: 850000, status: 'paid' }],
  'z-2': [{ invoice_no: 'INV-000243', date: '2026-11-03', total: 400000, status: 'sent' }],
}

export const zoho = {
  async searchContacts(q) {
    if (!ZOHO_LIVE) {
      const s = q.toLowerCase()
      return DEMO_CONTACTS.filter((c) => c.name.toLowerCase().includes(s) || c.email.toLowerCase().includes(s))
    }
    return (await api(`/api/zoho/contacts?search=${encodeURIComponent(q)}`)).contacts
  },
  /** Detail lengkap: nama, HP, email, penerima & alamat pengiriman. */
  async contact(zohoId) {
    if (!ZOHO_LIVE) return DEMO_CONTACTS.find((c) => c.zoho_id === zohoId) ?? null
    return (await api(`/api/zoho/contact?id=${encodeURIComponent(zohoId)}`)).contact
  },
  async invoicesOf(zohoId) {
    if (!ZOHO_LIVE) return DEMO_INVOICES[zohoId] ?? [{ invoice_no: `INV-0003${Math.floor(Math.random() * 90 + 10)}`, date: '2026-11-03', total: 500000, status: 'draft' }]
    return (await api(`/api/zoho/invoices?customer_id=${encodeURIComponent(zohoId)}`)).invoices
  },
}

// ---------------- Google Drive ----------------
// LIVE: server membuat "resumable upload session" di folder ATLAS/<Cabang>/<No Invoice>,
// lalu browser mengunggah file LANGSUNG ke Google (tidak kena batas 4.5MB Vercel).
const gdrive = {
  async upload(file, { branch, invoice }) {
    if (MODE === 'demo') {
      const url = file.size < 1.5e6 ? await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(file) }) : null
      return { name: file.name, size: file.size, url, drive_id: null, uploaded_at: new Date().toISOString() }
    }
    const { uploadUrl } = await api('/api/drive/upload', {
      method: 'POST', body: JSON.stringify({ name: file.name, mime: file.type || 'application/octet-stream', size: file.size, branch, invoice }),
    })
    const res = await fetch(uploadUrl, { method: 'PUT', body: file })
    if (!res.ok) throw new Error('Upload ke Google Drive gagal')
    const meta = await res.json()
    return { name: file.name, size: file.size, url: `https://drive.google.com/file/d/${meta.id}/view`, drive_id: meta.id, uploaded_at: new Date().toISOString() }
  },

  /** Ambil isi file sebagai Blob (untuk unduh satuan & ZIP). LIVE: lewat proxy server. */
  async blob(f) {
    if (!f.drive_id) {
      if (f.url?.startsWith('data:')) return dataUrlToBlob(f.url)
      throw new Error(`"${f.name}" tidak tersedia untuk diunduh (demo: file > 1,5 MB tidak disimpan)`)
    }
    const token = await db.token()
    const res = await fetch(`/api/drive/file?id=${encodeURIComponent(f.drive_id)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    if (!res.ok) throw new Error(`Gagal mengunduh "${f.name}"`)
    return res.blob()
  },

  async rename(f, name) {
    if (f.drive_id) await api('/api/drive/file', { method: 'PATCH', body: JSON.stringify({ id: f.drive_id, name }) })
    return { ...f, name }
  },

  async remove(f) {
    if (f.drive_id) await api(`/api/drive/file?id=${encodeURIComponent(f.drive_id)}`, { method: 'DELETE' })
  },
}

/** Penyimpanan file aktif: Supabase Storage (live) atau Google Drive via /api (InsForge lama) / data URL (demo). */
export const drive = MODE === 'supabase' ? { ...gdrive, ...supabaseDrive } : gdrive
