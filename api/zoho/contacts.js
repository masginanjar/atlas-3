// GET /api/zoho/contacts?search=budi  → daftar pelanggan Zoho Books
import { requireUser, fail } from '../_lib/auth.js'
import { zohoGet } from '../_lib/zoho.js'

export default async function handler(req, res) {
  if (!(await requireUser(req, res))) return
  try {
    const search = String(req.query.search || '').slice(0, 80)
    const j = await zohoGet('/contacts', { contact_type: 'customer', search_text: search, per_page: '15' })
    res.json({
      contacts: (j.contacts || []).map((c) => ({
        zoho_id: c.contact_id, name: c.contact_name, email: c.email || '', phone: c.mobile || c.phone || '',
      })),
    })
  } catch (e) { fail(res, e) }
}
