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
// Batas baris per tabel: riwayat panjang tidak perlu ditarik semua tiap kali aplikasi dibuka.
const LIMIT = { activity_log: 400, perf_daily: 400, share_log: 150, notifications: 300, pings: 200, messages: 800, requests: 500, petty_cash: 1000, kirim: 3000, kirim_event: 1500, kirim_mutasi: 5000 }
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
  /**
   * Superadmin menetapkan kata sandi pengguna lain.
   * Dikerjakan Edge Function "set-password" di server — service_role key TIDAK
   * pernah ada di kode front-end. Server membaca ulang peran pemanggil dari
   * database, jadi peran tidak bisa dipalsukan dari browser.
   */
  async setUserPassword(email, password) {
    const { data } = await sb().auth.getSession()
    const token = data?.session?.access_token
    if (!token) throw new Error('Sesi habis. Masuk ulang.')
    const r = await fetch(`${SUPABASE_URL}/functions/v1/set-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email, password }),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok || j.error) throw new Error(j.error || 'Gagal menetapkan kata sandi')
    return j
  },
  async currentUser() {
    const { data } = await sb().auth.getSession()
    return data?.session?.user ? profileByAuth(data.session.user).catch(() => null) : null
  },
  async signOut() { await sb().auth.signOut() },
  async list(t) { return (unwrap(await sb().from(t).select('*').order('created_at', { ascending: false }).limit(LIMIT[t] ?? 5000)) ?? []).map(flat) },
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
  /**
   * Pakai lembar affidavit — atomik di server:
   * cek saldo, kurangi stok, dan catat pemakaian dalam satu transaksi.
   * Idempoten lewat `kunci`: percobaan ulang tidak mengurangi dua kali.
   */
  async affidavitPakai(ref) { return unwrap(await sb().rpc('affidavit_pakai', { p_ref: ref })) },
  /** Jabatan tersembunyi: nyalakan persona (id) atau matikan (null). Server memeriksa act_as. */
  async personaSet(id) { return unwrap(await sb().rpc('persona_set', { p_id: id || null })) },
  /** Nomor registrasi berikutnya (dihitung di server, hitungan global per bulan). */
  async regNext(kode) { return unwrap(await sb().rpc('next_reg_no', { p_lang_code: String(kode) })) },
  /** Simpan baris registrasi (tabel kolom biasa, bukan doc). Nomor kembar ditolak database. */
  async regInsert(rows) { if (!rows?.length) return []; return unwrap(await sb().from('registrations').insert(rows).select('reg_no')) || [] },
  /** Perbarui baris registrasi yang sudah dipesan (jenis/nama dokumen) saat Admin Pusat menerbitkan. */
  /** Hapus semua data dummy (fungsi server, khusus Superadmin). */
  async hapusDummy() { return unwrap(await sb().rpc('hapus_dummy')) },
  /** Ubah jenis / nama / tanggal satu nomor register. */
  async regUpdate(reg_no, patch) { return unwrap(await sb().from('registrations').update(patch).eq('reg_no', reg_no).select('reg_no')) },
  async regUpsert(rows) { if (!rows?.length) return []; return unwrap(await sb().from('registrations').upsert(rows, { onConflict: 'reg_no' }).select('reg_no')) || [] },
  /** Daftar registrasi untuk satu project / invoice. */
  async regList({ project_id, invoice_no } = {}) {
    let q = sb().from('registrations').select('*').order('reg_no')
    if (project_id && invoice_no) q = q.or(`project_id.eq.${project_id},invoice_no.eq.${invoice_no}`)
    else if (project_id) q = q.eq('project_id', project_id)
    else if (invoice_no) q = q.eq('invoice_no', invoice_no)
    return unwrap(await q) || []
  },
  /** Konfirmasi lembar diterima cabang — tambah stok & tutup pengiriman dalam satu transaksi. */
  async affidavitTerima({ kirim_id, lembar, oleh }) {
    return unwrap(await sb().rpc('affidavit_terima', { p_kirim: kirim_id, p_lembar: lembar, p_oleh: oleh }))
  },
  token: async () => { const { data } = await sb().auth.getSession(); return data?.session?.access_token ?? null },
  /** Realtime: panggil cb(tabel) setiap ada perubahan dari pengguna lain. Mengembalikan fungsi berhenti. */
  /** Langganan perubahan tabel (Realtime). onStatus menerima 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED'. */
  /**
   * Saluran siaran chat, DIPISAH PER PENERIMA (atlas-chat:<id>).
   * Isinya sengaja tidak memuat teks pesan — hanya penanda "ada pesan baru"
   * dan status "sedang mengetik". Teks pesan tetap diambil dari database
   * supaya aturan akses (RLS) yang menentukan siapa boleh membacanya.
   */
  chatChannel(myId, onEvent) {
    const inbox = sb().channel(`atlas-chat:${myId}`, { config: { broadcast: { self: false } } })
    inbox.on('broadcast', { event: 'chat' }, ({ payload }) => onEvent(payload))
    inbox.subscribe()
    const out = new Map()
    const to = (id) => {
      let ch = out.get(id)
      if (!ch) { ch = sb().channel(`atlas-chat:${id}`, { config: { broadcast: { self: false } } }); ch.subscribe(); out.set(id, ch) }
      return ch
    }
    return {
      send: (toId, payload) => { try { to(toId).send({ type: 'broadcast', event: 'chat', payload }) } catch { /* abaikan */ } },
      stop: () => { try { sb().removeChannel(inbox); out.forEach((c) => sb().removeChannel(c)); out.clear() } catch { /* abaikan */ } },
    }
  },
  subscribe(tables, cb, onStatus) {
    const ch = sb().channel('atlas-live')
    for (const t of tables) ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, (payload) => cb(t, payload))
    ch.subscribe((status, err) => { onStatus?.(status, err); if (status !== 'SUBSCRIBED') console.warn('[ATLAS realtime]', status, err?.message || '') })
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
    if (f?.path) return unwrap(await sb().storage.from(f.bucket || BUCKET).download(f.path))
    if (f?.url?.startsWith('data:')) { const r = await fetch(f.url); return r.blob() }
    if (f?.url) { const r = await fetch(f.url); if (!r.ok) throw new Error(`Gagal mengunduh "${f.name}"`); return r.blob() }
    throw new Error(`"${f?.name || 'file'}" tidak tersedia untuk diunduh`)
  },
  /** tautan sementara (1 jam) untuk pratinjau */
  async url(f) { if (!f?.path) return f?.url || null; return unwrap(await sb().storage.from(BUCKET).createSignedUrl(f.path, 3600))?.signedUrl || null },
  async rename(f, name) { return { ...f, name: safe(name) } },
  async remove(f) { if (f?.path) await sb().storage.from(BUCKET).remove([f.path]) },
}
