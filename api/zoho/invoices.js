// GET /api/zoho/invoices?customer_id=xxx  → invoice terbaru pelanggan (untuk nama project)
import { requireUser, fail } from '../_lib/auth.js'
import { zohoGet } from '../_lib/zoho.js'

export default async function handler(req, res) {
  if (!(await requireUser(req, res))) return
  try {
    const customer_id = String(req.query.customer_id || '')
    if (!customer_id) return res.status(400).json({ error: 'customer_id wajib' })
    const j = await zohoGet('/invoices', { customer_id, sort_column: 'date', sort_order: 'D', per_page: '20' })
    res.json({
      invoices: (j.invoices || []).map((i) => ({
        invoice_no: i.invoice_number, zoho_invoice_id: i.invoice_id, date: i.date, total: i.total, status: i.status,
      })),
    })
  } catch (e) { fail(res, e) }
}
