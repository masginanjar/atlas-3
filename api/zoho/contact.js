// GET /api/zoho/contact?id=xxx → data pelanggan + alamat pengiriman (struktur sesuai field Zoho Books)
//   Nama Tampilan → contact_name     Email → email          Ponsel → mobile (+ kode negara)
//   Kota pelanggan → billing_address.city
//   Pengiriman: Perhatian → attention, Jalan 1/2 → address/street2, Kota, Provinsi (state), Kode Pos (zip),
//               Negara/Wilayah → country, Telepon → phone (+ kode negara)
import { requireUser, fail } from '../_lib/auth.js'
import { zohoGet } from '../_lib/zoho.js'

// Gabungkan kode negara bila Zoho menyimpannya terpisah (mis. mobile_country_code: "62")
// Catatan: nama field kode negara bisa berbeda per versi Zoho — cek respons asli saat uji pertama.
function withCode(num, code) {
  const n = String(num || '').trim()
  if (!n) return ''
  if (n.startsWith('+') || !code) return n
  return `+${String(code).replace(/^\+/, '')} ${n.replace(/^0/, '')}`
}

export default async function handler(req, res) {
  if (!(await requireUser(req, res))) return
  try {
    const id = String(req.query.id || '')
    if (!id) return res.status(400).json({ error: 'id wajib' })
    const { contact: c } = await zohoGet(`/contacts/${encodeURIComponent(id)}`)
    const b = c.billing_address || {}
    const s = c.shipping_address || {}
    res.json({
      contact: {
        zoho_id: c.contact_id,
        name: c.contact_name,
        email: c.email || '',
        phone: withCode(c.mobile, c.mobile_country_code),
        city: b.city || '',
        ship: {
          attention: s.attention || '',
          street1: s.address || '',
          street2: s.street2 || '',
          city: s.city || '',
          state: s.state || '',
          zip: s.zip || '',
          country: s.country || '',
          phone: withCode(s.phone, s.phone_country_code ?? s.country_code),
        },
      },
    })
  } catch (e) { fail(res, e) }
}
