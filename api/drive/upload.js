// POST /api/drive/upload  { name, mime, size, branch, invoice }
// → { uploadUrl } : sesi "resumable upload" Google Drive di folder ATLAS/<branch>/<invoice>.
// Browser lalu PUT file langsung ke uploadUrl (tidak melewati Vercel → bebas batas 4.5MB).
import { requireUser, fail } from '../_lib/auth.js'

let cache = { token: null, exp: 0 }
export async function gToken() {
  if (cache.token && Date.now() < cache.exp) return cache.token
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN, grant_type: 'refresh_token',
    }),
  })
  const j = await r.json()
  if (!j.access_token) throw new Error('Gagal mendapat token Google: ' + (j.error_description || j.error))
  cache = { token: j.access_token, exp: Date.now() + (j.expires_in - 120) * 1000 }
  return cache.token
}

const safe = (s) => String(s || '').replace(/['\\]/g, '').slice(0, 120)

async function ensureFolder(name, parent, token) {
  const q = `name='${safe(name)}' and '${parent}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
  const found = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json())
  if (found.files?.[0]) return found.files[0].id
  const made = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: safe(name), parents: [parent], mimeType: 'application/vnd.google-apps.folder' }),
  }).then((r) => r.json())
  if (!made.id) throw new Error('Gagal membuat folder Drive')
  return made.id
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST saja' })
  if (!(await requireUser(req, res))) return
  try {
    const { name, mime, size, branch, invoice } = req.body || {}
    if (!name || !branch || !invoice) return res.status(400).json({ error: 'name, branch, invoice wajib' })
    const token = await gToken()
    const branchFolder = await ensureFolder(branch, process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID, token)
    const invFolder = await ensureFolder(invoice, branchFolder, token)
    const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,name,webViewLink', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': mime || 'application/octet-stream', ...(size ? { 'X-Upload-Content-Length': String(size) } : {}),
        ...(req.headers.origin ? { Origin: req.headers.origin } : {}), // wajib agar browser boleh upload (CORS)
      },
      body: JSON.stringify({ name: safe(name), parents: [invFolder] }),
    })
    const uploadUrl = r.headers.get('location')
    if (!uploadUrl) throw new Error('Gagal membuat sesi upload Drive (' + r.status + ')')
    res.json({ uploadUrl })
  } catch (e) { fail(res, e) }
}
