// Memastikan pemanggil /api adalah user ATLAS yang sedang login (token sesi InsForge).
import { createClient } from '@insforge/sdk'

export async function requireUser(req, res) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!process.env.INSFORGE_URL) return { email: 'dev@local' } // dev lokal tanpa InsForge
  if (!token) { res.status(401).json({ error: 'Belum login' }); return null }
  const ins = createClient({ baseUrl: process.env.INSFORGE_URL, isServerMode: true, edgeFunctionToken: token })
  const { data, error } = await ins.auth.getCurrentUser()
  if (error || !data?.user) { res.status(401).json({ error: 'Sesi tidak valid, silakan login ulang' }); return null }
  return data.user
}

export const fail = (res, e) => res.status(500).json({ error: e?.message || 'Terjadi kesalahan server' })
