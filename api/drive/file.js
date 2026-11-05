// /api/drive/file
//   GET    ?id=…            → unduh isi file (proxy, akses tetap privat)
//   PATCH  {id, name}       → ganti nama file
//   DELETE ?id=…            → pindahkan file ke Trash Drive (bisa dipulihkan 30 hari)
import { requireUser, fail } from '../_lib/auth.js'
import { gToken } from './upload.js'

const G = 'https://www.googleapis.com/drive/v3/files/'

export default async function handler(req, res) {
  if (!(await requireUser(req, res))) return
  try {
    const token = await gToken()
    const auth = { Authorization: `Bearer ${token}` }
    const id = String(req.query.id || req.body?.id || '')
    if (!/^[\w-]{10,}$/.test(id)) return res.status(400).json({ error: 'id tidak valid' })

    if (req.method === 'GET') {
      const meta = await fetch(`${G}${id}?fields=name,mimeType,size&supportsAllDrives=true`, { headers: auth }).then((r) => r.json())
      const r = await fetch(`${G}${id}?alt=media&supportsAllDrives=true`, { headers: auth })
      if (!r.ok) return res.status(r.status).json({ error: 'File tidak ditemukan di Drive' })
      res.setHeader('Content-Type', meta.mimeType || 'application/octet-stream')
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(meta.name || 'file')}`)
      const reader = r.body.getReader()
      for (;;) { const { done, value } = await reader.read(); if (done) break; res.write(Buffer.from(value)) }
      return res.end()
    }
    if (req.method === 'PATCH') {
      const name = String(req.body?.name || '').trim().slice(0, 200)
      if (!name) return res.status(400).json({ error: 'Nama wajib' })
      const r = await fetch(`${G}${id}?supportsAllDrives=true`, { method: 'PATCH', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
      if (!r.ok) throw new Error('Gagal mengganti nama di Drive')
      return res.json({ ok: true })
    }
    if (req.method === 'DELETE') {
      const r = await fetch(`${G}${id}?supportsAllDrives=true`, { method: 'PATCH', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) })
      if (!r.ok) throw new Error('Gagal menghapus di Drive')
      return res.json({ ok: true })
    }
    res.status(405).json({ error: 'Metode tidak didukung' })
  } catch (e) { fail(res, e) }
}
