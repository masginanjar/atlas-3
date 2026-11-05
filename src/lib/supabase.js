// ============================================================
//  MESIN LIVE — Supabase (Postgres + Auth + Storage + Realtime)
//  Aktif bila VITE_SUPABASE_URL & VITE_SUPABASE_KEY diisi.
//  Skema "dokumen": tiap tabel = id, created_at, updated_at, doc jsonb.
//  Baris di aplikasi = { id, created_at, updated_at, ...doc } — sama seperti mode demo.
// ============================================================
import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY
export const SUPABASE_READY = !!(SUPABASE_URL && SUPABASE_KEY)

let client = null
export function sb() {
  if (!client) client = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  return client
}

const unwrap = ({ data, error }) => { if (error) throw new Error(pesan(error)); return data }
const pesan = (e) => {
  const m = e?.message || ''
  if (/Invalid login credentials/i.test(m)) return 'Email atau kata sandi salah'
  if (/Email not confirmed/i.test(m)) return 'Email belum dikonfirmasi — cek kotak masuk Anda'
  if (/row-level security|permission denied/i.test(m)) return 'Anda tidak punya hak untuk tindakan ini'
  if (/JWT|session/i.test(m)) return 'Sesi login habis — silakan masuk lagi'
  return m || 'Gagal memproses data'
}
const flat = (r) => (r ? { id: r.id, created_at: r.created_at, updated_at: r.updated_at, ...(r.doc || {}) } : null)
const split = (row) => { const { id, created_at, updated_at, ...doc } = row || {}; return { id, doc } }

async function profileByAuth(authUser) {
  if (!authUser) return null
  let rows = unwrap(await sb().from('users').select('*').eq('auth_id', authUser.id).limit(1))
  if (!rows?.length && authUser.email) {
    // tautan belum terbentuk (akun dibuat sebelum trigger) → coba tautkan lewat email
    rows = unwrap(await sb().from('users').select('*').eq('email', authUser.email.toLowerCase()).limit(1))
    if (rows?.length) await sb().from('users').update({ auth_id: authUser.id }).eq('id', rows[0].id)
  }
  const u = flat(rows?.[0])
  if (!u || u.active === false) throw new Error('Akun belum terdaftar di ATLAS. Hubungi Superadmin.')
  return u
}

export const supabaseDb = {
  async signIn(email, password) {
    const { user } = unwrap(await sb().auth.signInWithPassword({ email: String(email).trim().toLowerCase(), password }))
    return profileByAuth(user)
  },
  /** Daftar akun login untuk email yang SUDAH terdaftar sebagai pengguna ATLAS (sekali, saat pertama kali). */
  async signUp(email, password) {
    const em = String(email).trim().toLowerCase()
    const { data, error } = await sb().auth.signUp({ email: em, password })
    if (error) throw new Error(pesan(error))
    if (!data.session) return { pending: true } // perlu konfirmasi email
    return profileByAuth(data.user)
  },
  async resetPassword(email) { unwrap(await sb().auth.resetPasswordForEmail(String(email).trim().toLowerCase(), { redirectTo: window.location.origin + window.location.pathname })) },
  async updatePassword(password) { unwrap(await sb().auth.updateUser({ password })) },
  async currentUser() {
    const { data } = await sb().auth.getSession()
    return data?.session?.user ? profileByAuth(data.session.user).catch(() => null) : null
  },
  async signOut() { await sb().auth.signOut() },
  async list(t) { return (unwrap(await sb().from(t).select('*').order('created_at', { ascending: false }).limit(t === 'activity_log' ? 1500 : 5000)) ?? []).map(flat) },
  async insert(t, row) { const { id, doc } = split(row); const payload = id ? { id, doc } : { doc }; return flat(unwrap(await sb().from(t).insert([payload]).select())?.[0]) },
  async update(t, id, patch) {
    const { doc } = split({ ...patch, id: undefined })
    return unwrap(await sb().rpc('app_patch', { tbl: t, row_id: id, patch: doc }))
  },
  async remove(t, id) { unwrap(await sb().from(t).delete().eq('id', id)) },
  async reset() {},
  async cleanup() { return 0 },
  /** klaim otorisasi atomik di server */
  async claim(projectId, subId) { return unwrap(await sb().rpc('claim_sub', { p_project: projectId, p_sub: subId })) },
  token: async () => { const { data } = await sb().auth.getSession(); return data?.session?.access_token ?? null },
  /** Realtime: panggil cb(tabel) setiap ada perubahan dari pengguna lain. Mengembalikan fungsi berhenti. */
  subscribe(tables, cb) {
    const ch = sb().channel('atlas-live')
    for (const t of tables) ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, (payload) => cb(t, payload))
    ch.subscribe()
    return () => { sb().removeChannel(ch) }
  },
}

// ---------------- penyimpanan file (bucket "files") ----------------
const BUCKET = 'files'
const safe = (s = '') => String(s).replace(/[^\w.\-()\[\] ]+/g, '_').trim()
export const supabaseDrive = {
  async upload(file, { branch, invoice } = {}, name) {
    const fname = safe(name || file.name)
    const path = `${safe(branch || 'umum')}/${safe(invoice || 'tanpa-invoice')}/${Date.now().toString(36)}-${fname}`
    unwrap(await sb().storage.from(BUCKET).upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false }))
    return { name: fname, size: file.size, url: null, path, bucket: BUCKET, uploaded_at: new Date().toISOString() }
  },
  async blob(f) {
    if (f?.path) return unwrap(await sb().storage.from(BUCKET).download(f.path))
    if (f?.url?.startsWith('data:')) { const r = await fetch(f.url); return r.blob() }
    if (f?.url) { const r = await fetch(f.url); if (!r.ok) throw new Error(`Gagal mengunduh "${f.name}"`); return r.blob() }
    throw new Error(`"${f?.name || 'file'}" tidak tersedia untuk diunduh`)
  },
  /** tautan sementara (1 jam) untuk pratinjau */
  async url(f) { if (!f?.path) return f?.url || null; return unwrap(await sb().storage.from(BUCKET).createSignedUrl(f.path, 3600))?.signedUrl || null },
  async rename(f, name) { return { ...f, name: safe(name) } },
  async remove(f) { if (f?.path) await sb().storage.from(BUCKET).remove([f.path]) },
}
