// ============================================================
//  INTEGRASI — Zoho Books & Google Drive.
//  LIVE: memanggil Vercel Functions di /api (kunci rahasia hanya di server).
//  DEMO: memakai data contoh supaya alur bisa dicoba tanpa akun.
// ============================================================
import { MODE, db } from './db.js'
import { branchOfInvoice, BRANCH_CODES } from '../config/access.js'
import { supabaseDrive, sb } from './supabase.js'
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

// Contoh item invoice (format persis seperti yang diketik staf di Zoho) — untuk mencoba isi otomatis di demo
const DEMO_INVOICE_ITEMS = {
  'INV-000240': [
    { name: 'English ⇄ Indonesia ⇄ Inggris  | Regular | Sworn', description: 'IND-ENG\n1. Ijazah Rahma\n2. Transkrip Nilai Rahma 2 hal', unit: 'page', quantity: 3, rate: 75000, item_total: 225000 },
    { name: 'English ⇄ Indonesia ⇄ Inggris | NON Regular | Sworn', description: 'IND - ENG\n3. Surat Keterangan Kerja', unit: 'page', quantity: 1, rate: 90000, item_total: 90000 },
    { name: 'Delivery Fee', description: 'Jenis Ekspedisi : JNT\nNama: Rahma Putri\nAlamat: Jl. Tukad Badung No. 12, Renon\nKec/kab/kota: Denpasar Selatan, Denpasar, Bali\nKode pos: 80226\nNomor hp: 0812-3456-7890', unit: 'doc', quantity: 1, rate: 15000, item_total: 15000 },
  ],
  'INV-000241': [
    { name: 'Apostille', description: 'APOSTILLE NORMAL TUJUAN AUSTRALIA\n1. Akta Kelahiran Rahma\n2. Ijazah Rahma', unit: 'page', quantity: 2, rate: 650000, item_total: 1300000 },
    { name: 'Delivery Fee', description: 'Self Pickup Kantor Bali', unit: 'doc', quantity: 1, rate: 0, item_total: 0 },
  ],
  'INV-000242': [
    { name: 'Spanyol ⇄ Indonesia  ⇄ Spanyol | Sworn', description: 'Spanish - IND SAME-DAY\n1. Dokumen Spanyol 2 halaman\n\nSoftcopy Only : budi@example.com', unit: 'page', quantity: 2, rate: 300000, item_total: 600000 },
  ],
  'INV-000243': [
    { name: 'Legalisasi Kemenag', description: 'LEGALISASI KEMENAG\n1. Dokumen SKBM Dewi', unit: '', quantity: 1, rate: 600000, item_total: 600000 },
    { name: 'English ⇄ Indonesia ⇄ Inggris | NON Regular | Sworn', description: 'Terjemahan IND-ENG Speed 100%\n1. Dokumen SKBM Dewi (Hasil Legalisasi)', unit: 'page', quantity: 1, rate: 180000, item_total: 180000 },
    { name: 'Delivery Fee', description: 'Dewi Lestari\nJl. Raya Kuta No. 88, Kuta, Badung, Bali 80361\n081234567891', unit: 'doc', quantity: 1, rate: 20000, item_total: 20000 },
  ],
}

// Status pembayaran dipindah ke lib/pay.js supaya bisa dipakai Edge Function portal juga.
export { PAY_STATES, payStateOf } from './pay.js'

// DEMO: daftar faktur dibentuk dari project demo (yang sudah masuk project) + beberapa
// invoice contoh yang belum dibuatkan project, supaya alur "Buat Project" bisa dicoba.
const DEMO_EXTRA = [
  { customer: 'Siti Rahmawati', customer_id: 'z-10', days: 0, status: 'sent' },
  { customer: 'Hans Müller', customer_id: 'z-11', days: 0, status: 'draft' },
  { customer: 'PT Garuda Logistik Nusantara', customer_id: 'z-8', days: 1, status: 'paid' },
  { customer: 'Yuki Tanaka', customer_id: 'z-3', days: 2, status: 'partially_paid' },
  { customer: 'CV Sinar Textile', customer_id: 'z-5', days: 3, status: 'void' },
]
const DEMO_STATUSES = ['paid', 'sent', 'partially_paid', 'paid', 'overdue', 'sent', 'paid']
const hash = (s) => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 9973, 7)
async function demoInvoiceList() {
  const projects = await db.list('projects').catch(() => [])
  const iso = (d) => new Date(d).toISOString()
  const used = projects.map((p) => Number(String(p.invoice_no || '').replace(/\D/g, '')) || 0)
  const nextNo = Math.max(0, ...used, 243) + 1
  const fromProjects = projects.filter((p) => p.invoice_no).map((p) => ({
    zoho_invoice_id: `zi-${p.invoice_no}`,
    invoice_no: p.invoice_no,
    branch: p.branch,
    date: (p.about?.received_at || p.created_at || new Date().toISOString()).slice(0, 10),
    created_time: p.created_at || iso(Date.now()),
    customer_name: p.customer?.name || '—',
    customer_id: p.customer?.zoho_id || '',
    status: DEMO_STATUSES[hash(p.invoice_no) % DEMO_STATUSES.length],
  }))
  const extra = [
    ...Object.entries(DEMO_INVOICES).flatMap(([cid, list]) => list.map((i) => ({
      zoho_invoice_id: `zi-${i.invoice_no}`, invoice_no: i.invoice_no, date: i.date, created_time: `${i.date}T09:00:00.000Z`,
      customer_name: DEMO_CONTACTS.find((c) => c.zoho_id === cid)?.name || '—', customer_id: cid, status: i.status, branch: 'Bali',
    }))),
    ...DEMO_EXTRA.map((e, n) => {
      const d = new Date(Date.now() - e.days * 864e5)
      const no = `INV-${String(nextNo + n).padStart(6, '0')}` // selalu di atas nomor project yang sudah ada → benar-benar belum masuk project
      const branch = Object.values(BRANCH_CODES)[n % Object.keys(BRANCH_CODES).length]
      return { zoho_invoice_id: `zi-${no}`, invoice_no: no, date: iso(d).slice(0, 10), created_time: iso(d), customer_name: e.customer, customer_id: e.customer_id, status: e.status, branch }
    }),
  ]
  const seen = new Set()
  return [...extra, ...fromProjects].filter((i) => !seen.has(i.invoice_no) && seen.add(i.invoice_no))
}

const statusCache = new Map()
const rowToContact = (r) => r && ({ zoho_id: r.zoho_id, name: r.name, email: r.email || '', phone: r.phone || '', city: r.city || '', company: r.company || '', ship: r.ship || {}, synced_at: r.synced_at })
const must = ({ data, error }) => { if (error) throw new Error(error.message); return data }

export const zoho = {
  async searchContacts(q) {
    if (MODE === 'supabase') return (must(await sb().rpc('search_contacts', { q })) || []).map(rowToContact) // salinan Zoho di database (sinkron terjadwal)
    if (!ZOHO_LIVE) {
      const s = q.toLowerCase()
      return DEMO_CONTACTS.filter((c) => c.name.toLowerCase().includes(s) || c.email.toLowerCase().includes(s))
    }
    return (await api(`/api/zoho/contacts?search=${encodeURIComponent(q)}`)).contacts
  },
  /** Detail lengkap: nama, HP, email, penerima & alamat pengiriman. */
  async contact(zohoId) {
    if (MODE === 'supabase') return rowToContact((must(await sb().from('zoho_contacts').select('*').eq('zoho_id', zohoId).limit(1)) || [])[0])
    if (!ZOHO_LIVE) return DEMO_CONTACTS.find((c) => c.zoho_id === zohoId) ?? null
    return (await api(`/api/zoho/contact?id=${encodeURIComponent(zohoId)}`)).contact
  },
  async invoicesOf(zohoId) {
    if (MODE === 'supabase') return (must(await sb().from('zoho_invoices').select('*').eq('customer_id', zohoId).order('date', { ascending: false }).limit(30)) || [])
      .map((r) => ({ invoice_no: r.invoice_no, date: r.date, total: Number(r.total) || 0, status: r.status, balance: Number(r.balance) || 0 }))
    if (!ZOHO_LIVE) return DEMO_INVOICES[zohoId] ?? [{ invoice_no: `INV-0003${Math.floor(Math.random() * 90 + 10)}`, date: '2026-11-03', total: 500000, status: 'draft' }]
    return (await api(`/api/zoho/invoices?customer_id=${encodeURIComponent(zohoId)}`)).invoices
  },
  /** Item & kontak invoice (untuk isi otomatis sub project + pengiriman). null bila tidak ada. */
  async invoiceDetail(invoiceNo) {
    const no = String(invoiceNo || '').trim().toUpperCase()
    if (!no) return null
    if (MODE === 'supabase') {
      const r = (must(await sb().from('zoho_invoices').select('invoice_no,line_items,contact,customer_name').eq('invoice_no', no).limit(1)) || [])[0]
      return r?.line_items?.length ? { invoice_no: r.invoice_no, items: r.line_items, contact: r.contact || {}, customer_name: r.customer_name } : null
    }
    if (!ZOHO_LIVE) return DEMO_INVOICE_ITEMS[no] ? { invoice_no: no, items: DEMO_INVOICE_ITEMS[no], contact: {} } : null
    return (await api(`/api/zoho/invoice?no=${encodeURIComponent(no)}`)).invoice ?? null
  },
  /**
   * Daftar invoice terbaru lintas pelanggan — untuk menu Faktur.
   * Urut tanggal terbaru dulu; waktu pembuatan jadi pembeda bila tanggalnya sama.
   *
   * `from`/`to` (YYYY-MM-DD, boleh kosong) disaring langsung di database.
   * Ini penting: tanpa saringan tanggal, batas baris bisa habis dipakai bulan
   * terbaru saja sehingga bulan sebelumnya tidak pernah ikut terbawa.
   */
  async recentInvoices({ limit = 3000, from = '', to = '' } = {}) {
    if (MODE === 'supabase') {
      // salinan Zoho di Supabase: kolomnya zoho_id (bukan zoho_invoice_id) dan tanpa created_time.
      // Server memotong satu permintaan di 1.000 baris, jadi diambil bertahap
      // (halaman 1.000 baris) sampai periodenya habis — bukan hanya 1.000 teratas.
      const HAL = 1000
      const rows = []
      for (let awal = 0; awal < limit; awal += HAL) {
        let q = sb().from('zoho_invoices').select('zoho_id,invoice_no,date,customer_name,customer_id,status,total,balance')
        if (from) q = q.gte('date', from)
        if (to) q = q.lte('date', to)
        const batch = must(await q
          .order('date', { ascending: false }).order('invoice_no', { ascending: false })
          .range(awal, Math.min(awal + HAL, limit) - 1)) || []
        rows.push(...batch)
        if (batch.length < HAL) break
      }
      return rows.map((r) => ({
        zoho_invoice_id: r.zoho_id, invoice_no: r.invoice_no, date: r.date, created_time: '',
        customer_name: r.customer_name || '', customer_id: r.customer_id || '', status: r.status,
        branch: branchOfInvoice(r.invoice_no), // 3 angka di depan nomor invoice
        total: Number(r.total) || 0, balance: Number(r.balance) || 0,
      }))
    }
    if (!ZOHO_LIVE) return demoInvoiceList()
    return (await api(`/api/zoho/invoices?recent=1&limit=${limit}&from=${from}&to=${to}`)).invoices || []
  },
  /**
   * Status satu invoice (untuk badge Pembayaran). null = tidak ditemukan / belum tersedia.
   * Disimpan sebentar di memori agar tidak memanggil Zoho berulang kali.
   */
  async invoiceStatus(invoiceNo) {
    const no = String(invoiceNo || '').trim().toUpperCase()
    if (!no) return null
    const hit = statusCache.get(no)
    if (hit && Date.now() - hit.at < 120000) return hit.v
    const put = (v) => { statusCache.set(no, { v, at: Date.now() }); return v }
    if (MODE === 'supabase') {
      const r = (must(await sb().from('zoho_invoices').select('invoice_no,status').eq('invoice_no', no).limit(1)) || [])[0]
      return put(r?.status ?? null)
    }
    if (!ZOHO_LIVE) return put((await demoInvoiceList()).find((i) => i.invoice_no === no)?.status ?? null)
    return put((await api(`/api/zoho/invoices?no=${encodeURIComponent(no)}`)).invoices?.[0]?.status ?? null)
  },
  /** Kapan data Zoho terakhir disinkron (mode supabase). */
  async lastSync() {
    if (MODE !== 'supabase') return null
    const rows = must(await sb().from('sync_log').select('*').eq('source', 'zoho').order('started_at', { ascending: false }).limit(1)) || []
    return rows[0] || null
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
