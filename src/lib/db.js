// ============================================================
//  LAPISAN DATA — satu antarmuka, dua mesin:
//   • DEMO  : localStorage di browser (tanpa server, untuk mencoba)
//   • LIVE  : InsForge (Postgres + Auth) bila VITE_INSFORGE_URL diisi
//  Halaman tidak pernah memanggil InsForge langsung — selalu lewat sini,
//  jadi ganti backend di masa depan cukup ubah file ini.
// ============================================================
import { createClient } from '@insforge/sdk'
import { SUPABASE_READY, supabaseDb } from './supabase.js'
import { seed, archiveProjects, billedDemo } from './seed.js'
import { applyLegacyImport } from './legacyImport.js'
// Payload impor sistem lama hanya versi tersamar, dan hanya untuk mode demo.
// Mode live (Supabase) tidak memuat berkas itu. Lihat vite.config.js.

const URL_ = import.meta.env.VITE_INSFORGE_URL
// 'supabase' (live, Supabase) · 'live' (InsForge, lama) · 'demo' (localStorage)
export const MODE = SUPABASE_READY ? 'supabase' : URL_ ? 'live' : 'demo'
export const IS_LIVE = MODE !== 'demo'
export const TABLES = ['users', 'people', 'projects', 'petty_cash', 'couriers', 'notifications', 'requests', 'perf_daily', 'share_links', 'share_log', 'vendor_bills', 'fund_balances', 'app_settings', 'activity_log', 'pings', 'notes', 'todos', 'reminders', 'messages']

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()))

// ---------------- DEMO (localStorage) ----------------
import { perfDemo } from './perfDemo.js'
import { compactDemo } from './compactDemo.js'
import { isFreelance } from '../config/access.js'
const KEY = 'atlas-alfa-v19' // naikkan versi bila struktur data demo berubah
let mem = null
function load() {
  if (mem) return mem
  try { mem = JSON.parse(localStorage.getItem(KEY)) } catch { mem = null }
  // Demo ringkas: 30 project yang mewakili semua role (data lama diganti sekali)
  cleanStorage()
  if (!mem || !mem.compact_v8) { mem = seed(); migrate(mem); compactDemo(mem); save() }
  if (migrate(mem)) save()
  if (perfDemo(mem)) save() // tugas contoh harian (mati secara bawaan di demo ringkas)
  return mem
}
/** Migrasi data demo yang sudah tersimpan (idempoten): peran otorisasi & arsip riwayat. */
function migrate(m) {
  let changed = false
  // penamaan prioritas: Speed → Ekspres, Super Speed → Super Ekspres
  const PRIO_RENAME = { Speed: 'Ekspres', 'Super Speed': 'Super Ekspres', Tinggi: 'Super Ekspres' }
  for (const p of m.projects || []) { const v = p.about?.priority; if (v && PRIO_RENAME[v]) { p.about.priority = PRIO_RENAME[v]; changed = true } }
  const u = (id) => m.users.find((x) => x.id === id)
  const set = (id, patch) => { const x = u(id); if (x && Object.entries(patch).some(([k, v]) => JSON.stringify(x[k]) !== JSON.stringify(v))) { Object.assign(x, patch); changed = true } }
  set('u-ot-made', { otorisator_level: 'master' })
  set('u-ot-lukas', { otorisator_level: 'staf' })
  set('u-pr-rina', { extra_roles: ['otorisator'], otorisator_level: 'staf' })
  if (!u('u-pr-ela')) { m.users.push({ id: 'u-pr-ela', name: 'Ela', email: 'ela@247.id', role: 'proofreader', branch: 'Bali', extra_roles: ['otorisator'], otorisator_level: 'staf', active: true, created_at: new Date().toISOString() }); changed = true }
  if (!m.projects.some((p) => String(p.id).startsWith('arch-'))) { m.projects.push(...archiveProjects()); changed = true }
  // arsip lama tanpa rincian dokumen → isi jenis Reguler / Non Reguler (data contoh)
  for (const p of m.projects.filter((x) => String(x.id).startsWith('arch-'))) for (const sb of p.sub_projects) {
    if (sb.docs) continue
    sb.docs = Array.from({ length: sb.file_count || 1 }, (_, d) => ({ desc: sb.title, pages: Math.max(1, Math.round((sb.pages || 2) / (sb.file_count || 1))), kind: (sb.id.length + d) % 3 === 0 ? 'non_reguler' : 'reguler' })); changed = true
  }
  // termin pembayaran vendor: Jepang (Pak Zenzia) & Pak Deddy bulanan via koordinator, Mandarin (Bu Tinah) sesuai tagihan
  for (const v of m.people.filter((p) => p.type === 'vendor' && !p.payment_term)) {
    const n = v.name.toLowerCase()
    const term = /zenzia|deddy/.test(n) ? 'monthly' : /tinah/.test(n) ? 'invoice' : null
    if (term) { v.payment_term = term; changed = true }
  }
  // penerjemah, proofreader & otorisator = freelance → tanpa cabang
  for (const x of m.users) if (isFreelance(x) && (x.branch || x.branches?.length)) { x.branch = ''; x.branches = []; changed = true }
  if (!m.couriers.some((c) => c.type === 'vendor')) { m.couriers.push({ id: 'k-vendor-ship', name: 'Dikirim dari Penerjemah', type: 'vendor', icon: 'send', color: '#7c3aed', logo: '', order: 7, created_at: new Date().toISOString() }); changed = true }
  if (!m.projects.some((p) => String(p.id).startsWith('bill-'))) { m.projects.push(...billedDemo(m)); changed = true }
  return changed
}

/** Impor data sistem lama (idempoten). Cadangan disimpan sebelum perubahan pertama; log tiap impor disimpan di mem.import_runs. */
export async function importLegacy() {
  // Data live ada di Supabase. Jangan unduh atau terapkan dump legacy di mode itu.
  if (IS_LIVE) return { changed: false, skipped: 'live' }
  // Hanya demo: berkas tersamar, diunduh saat fitur impor dipakai.
  const LEGACY_2026_11_04 = (await import('@legacy-payload')).default
  const before = JSON.stringify(mem)
  const log = applyLegacyImport(mem, LEGACY_2026_11_04)
  if (!log.changed) return log
  try { if (!localStorage.getItem(`${KEY}:backup:${LEGACY_2026_11_04.source}`)) localStorage.setItem(`${KEY}:backup:${LEGACY_2026_11_04.source}`, before) } catch { /* penyimpanan penuh — lanjut tanpa cadangan lokal */ }
  mem.import_runs = [...(mem.import_runs || []), { ...log, conflicts: log.conflicts.slice(0, 200) }]
  save()
  return log
}
export let storageError = null
const emit = (v) => { try { window.dispatchEvent(new CustomEvent('atlas-storage', { detail: v })) } catch { /* abaikan */ } }
const isQuota = (e) => e?.name === 'QuotaExceededError' || e?.code === 22 || e?.code === 1014 || /quota/i.test(e?.message || '')
/** Hapus sisa data lama di browser: cadangan impor, versi database sebelumnya, kunci uji. Mengembalikan jumlah byte yang dibebaskan. */
export function cleanStorage() {
  let freed = 0
  try {
    const drop = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k === KEY) continue
      if (k.startsWith(`${KEY}:backup`) || /^atlas-alfa-v\d+$/.test(k) || k.startsWith('atlas-alfa-v') && !k.startsWith(KEY) || k.startsWith('fill')) drop.push(k)
    }
    for (const k of drop) { freed += (localStorage.getItem(k) || '').length; localStorage.removeItem(k) }
  } catch { /* abaikan */ }
  return freed
}
/** Ringkas data yang boleh dibuang bila penyimpanan tetap penuh. */
function shrink(m) {
  m.activity_log = (m.activity_log || []).slice(-500)
  m.notifications = (m.notifications || []).slice(-100)
  m.perf_daily = (m.perf_daily || []).slice(-400)
  m.share_log = (m.share_log || []).slice(-100)
  m.import_runs = []
}
function save() {
  const write = () => localStorage.setItem(KEY, JSON.stringify(mem))
  try { write(); if (storageError) { storageError = null; emit(null) }; return }
  catch (e) {
    if (!isQuota(e)) { storageError = 'blocked'; emit('blocked'); return }
    // Penuh → bersihkan sisa lama, lalu ringkas, lalu coba lagi
    cleanStorage()
    try { write(); storageError = null; emit(null); return } catch { /* lanjut */ }
    shrink(mem)
    try { write(); storageError = null; emit(null); return } catch { /* lanjut */ }
    storageError = 'quota'; emit('quota')
  }
}
/** Ukuran pemakaian localStorage (byte) untuk info di Setting. */
export const storageUsage = () => { try { let t = 0; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); t += k.length + (localStorage.getItem(k) || '').length } return t } catch { return 0 } }

/**
 * DEMO SAJA — kehadiran rekan kerja.
 * Di demo hanya ada satu orang yang benar-benar membuka ATLAS (Anda), sehingga
 * semua orang lain akan selalu "Offline". Agar status Online / Idle / Offline
 * bisa dilihat, baris pengguna LAIN diberi contoh kehadiran yang bergulir.
 * Mekanismenya tetap yang asli (kolom online_until & last_active_at); baris
 * pengguna yang sedang login tidak pernah diubah — itu data nyata dari denyut.
 * Di mode Supabase/live fungsi ini tidak dipakai sama sekali.
 */
function demoPresence(rows) {
  let me = null
  try { me = sessionStorage.getItem(KEY + ':me') } catch { /* abaikan */ }
  const now = Date.now()
  const iso = (ms) => new Date(ms).toISOString()
  return rows.map((u, i) => {
    if (u.id === me || u.active === false) return u
    const n = i % 4
    if (n === 0) return { ...u, online_until: iso(now + 120000), last_active_at: iso(now - (1 + (i % 7)) * 60000) } // online
    if (n === 1) return { ...u, online_until: iso(now + 120000), last_active_at: iso(now - (18 + (i % 30)) * 60000) } // idle
    return { ...u, online_until: null, last_active_at: iso(now - (2 + (i % 20)) * 3600000) } // offline
  })
}

const demo = {
  async signIn(email) {
    const u = load().users.find((x) => x.email.toLowerCase() === email.toLowerCase() && x.active !== false)
    if (!u) throw new Error('User tidak ditemukan')
    try { sessionStorage.setItem(KEY + ':me', u.id) } catch { /* abaikan */ }
    return u
  },
  async currentUser() {
    let id = null
    try { id = sessionStorage.getItem(KEY + ':me') } catch { /* abaikan */ }
    return load().users.find((x) => x.id === id) ?? null
  },
  async signOut() { try { sessionStorage.removeItem(KEY + ':me') } catch { /* abaikan */ } },
  async list(t) { const rows = structuredClone(load()[t] ?? []); return t === 'users' ? demoPresence(rows) : rows },
  async insert(t, row) { const r = { id: uid(), created_at: new Date().toISOString(), ...row }; const arr = (load()[t] ||= []); arr.push(r); if (t === 'activity_log' && arr.length > 3000) arr.splice(0, arr.length - 3000); save(); if (t === 'app_settings') perfDemo(mem) && save(); return structuredClone(r) },
  async update(t, id, patch) {
    const arr = (load()[t] ||= []); const i = arr.findIndex((x) => x.id === id)
    if (i < 0) throw new Error('Data tidak ditemukan')
    arr[i] = { ...arr[i], ...patch, updated_at: new Date().toISOString() }; save(); if (t === 'app_settings') perfDemo(mem) && save(); return structuredClone(arr[i])
  },
  async remove(t, id) { load()[t] = load()[t].filter((x) => x.id !== id); save() },
  async reset() { cleanStorage(); mem = seed(); migrate(mem); compactDemo(mem); save() },
  /** Baca ulang dari localStorage — dipakai saat tab lain menulis (mis. chat). */
  async reload() { mem = null; load() },
  async cleanup() { const f = cleanStorage(); shrink(load()); save(); return f },
  token: async () => null,
}

// ---------------- LIVE (InsForge) ----------------
let client = null
function ins() {
  if (!client) client = createClient({ baseUrl: URL_, anonKey: import.meta.env.VITE_INSFORGE_ANON_KEY })
  return client
}
const unwrap = ({ data, error }) => { if (error) throw new Error(error.message || 'Gagal memproses data'); return data }

async function profileByEmail(email) {
  const rows = unwrap(await ins().database.from('users').select('*').eq('email', email))
  const u = rows?.[0]
  if (!u || u.active === false) throw new Error('Akun belum terdaftar di ATLAS. Hubungi Superadmin.')
  return u
}

const live = {
  async signIn(email, password) {
    unwrap(await ins().auth.signInWithPassword({ email, password }))
    return profileByEmail(email)
  },
  async currentUser() {
    const { data } = await ins().auth.getCurrentUser()
    const email = data?.user?.email
    return email ? profileByEmail(email).catch(() => null) : null
  },
  async signOut() { await ins().auth.signOut() },
  async list(t) { return unwrap(await ins().database.from(t).select('*').order('created_at', { ascending: false }).limit(2000)) ?? [] },
  async insert(t, row) { return unwrap(await ins().database.from(t).insert([row]).select())?.[0] },
  async update(t, id, patch) { return unwrap(await ins().database.from(t).update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select())?.[0] },
  async remove(t, id) { unwrap(await ins().database.from(t).delete().eq('id', id)) },
  async reset() {},
  // token sesi untuk memanggil /api (Zoho & Drive) — dicek ulang di server
  token: async () => { try { const s = await ins().auth.getCurrentSession?.(); return s?.data?.session?.accessToken ?? null } catch { return null } },
}

export const db = MODE === 'supabase' ? supabaseDb : MODE === 'live' ? live : demo
