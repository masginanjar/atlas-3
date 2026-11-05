// GET /api/zoho/invoices?customer_id=xxx  → invoice terbaru pelanggan (untuk nama project)
// GET /api/zoho/invoices?recent=1&limit=200 → invoice terbaru lintas pelanggan (menu Faktur)
// GET /api/zoho/invoices?no=INV-000240       → satu invoice (status pembayaran)
import { requireUser, fail } from '../_lib/auth.js'
import { zohoGet } from '../_lib/zoho.js'

const map = (i) => ({
  invoice_no: i.invoice_number,
  zoho_invoice_id: i.invoice_id,
  date: i.date,
  created_time: i.created_time || i.last_modified_time || '',
  customer_name: i.customer_name || '',
  customer_id: i.customer_id || '',
  total: i.total,
  balance: i.balance,
  status: i.status,
})

export default async function handler(req, res) {
  if (!(await requireUser(req, res))) return
  try {
    const customer_id = String(req.query.customer_id || '')
    const no = String(req.query.no || '')
    if (no) {
      const j1 = await zohoGet('/invoices', { invoice_number: no, per_page: '1' })
      return res.json({ invoices: (j1.invoices || []).map(map) })
    }
    if (!customer_id && !req.query.recent) return res.status(400).json({ error: 'customer_id wajib' })
    // Zoho membalas maksimal 200 baris per permintaan
    const per_page = String(Math.min(Number(req.query.limit) || 200, 200))
    const q = customer_id
      ? { customer_id, sort_column: 'date', sort_order: 'D', per_page: '20' }
      : { sort_column: 'date', sort_order: 'D', per_page }
    const j = await zohoGet('/invoices', q)
    res.json({ invoices: (j.invoices || []).map(map) })
  } catch (e) { fail(res, e) }
}
