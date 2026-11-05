// ============================================================
//  CHAT INTERNAL RINGAN — teks, emoji, dan mention project.
//  Percakapan hanya bisa dibaca pesertanya. Identitas tim yang
//  berlaku dipakai apa adanya: pesan ke Proofreader masuk ke
//  SATU inbox tim, bukan ke akun per orang yang namanya sama.
// ============================================================
import { PROOFREADER_TEAM, seeProofreaderIdentity, displayNameFor } from '../config/access.js'

export const TEAM_PROOFREADER = PROOFREADER_TEAM.id
export const PING_MAX_24H = 3
export const PING_GAP_MS = 60 * 1000
const DAY = 864e5

/** Id percakapan: pasangan user (urut) atau inbox tim. */
export const threadOf = (a, b) => (String(b).startsWith('tim-') ? `team:${b}` : `dm:${[a, b].sort().join('|')}`)
/** Lawan bicara pada sebuah thread, dari sudut pandang user. */
export const peerOf = (thread, userId) => {
  if (thread.startsWith('team:')) return thread.slice(5)
  const [a, b] = thread.slice(3).split('|')
  return a === userId ? b : a
}
/** Apakah user boleh membaca thread ini? */
export function canRead(user, thread, isTeamMember) {
  if (thread.startsWith('team:')) return thread.slice(5) === TEAM_PROOFREADER ? isTeamMember : false
  return thread.slice(3).split('|').includes(user.id)
}

/** Daftar lawan bicara yang tersedia untuk user — memakai identitas tampilan yang berlaku. */
export function contactsFor(user, users) {
  const out = []
  const show = seeProofreaderIdentity(user)
  let team = 0
  for (const u of users) {
    if (u.active === false || u.id === user.id) continue
    const role = u.base_role || u.role
    if (role === 'proofreader' && !show) { team += 1; continue }
    out.push({ id: u.id, name: displayNameFor(user, u), user: u })
  }
  if (team) out.push({ id: TEAM_PROOFREADER, name: `${PROOFREADER_TEAM.lead} · ${PROOFREADER_TEAM.label}`, team })
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

/** Pesan yang boleh dilihat user (termasuk inbox tim bila ia anggotanya). */
export function myMessages(data, user) {
  const isPr = (user.base_role || user.role) === 'proofreader'
  return (data.messages || []).filter((m) => (m.thread.startsWith('team:') ? isPr || m.from_user === user.id : m.thread.slice(3).split('|').includes(user.id)))
}

/** Jumlah pesan & ping belum dibaca per thread. */
export function unreadByThread(msgs, user) {
  const out = {}
  for (const m of msgs) {
    if (m.from_user === user.id || (m.read_by || []).includes(user.id)) continue
    const o = (out[m.thread] ||= { msg: 0, ping: 0 })
    if (m.kind === 'ping') o.ping += 1; else o.msg += 1
  }
  return out
}

/** Sisa kuota ping ke satu lawan bicara dalam 24 jam berjalan + kapan boleh ping lagi. */
export function pingQuota(msgs, user, thread, now = Date.now()) {
  const mine = msgs.filter((m) => m.kind === 'ping' && m.thread === thread && m.from_user === user.id)
  const recent = mine.filter((m) => now - new Date(m.created_at).getTime() < DAY)
  const last = mine.map((m) => new Date(m.created_at).getTime()).sort((a, b) => b - a)[0] || 0
  const used = recent.length
  const gapLeft = Math.max(0, PING_GAP_MS - (now - last))
  // kapan kuota pulih: 24 jam setelah ping terlama yang masih dihitung
  const oldest = recent.map((m) => new Date(m.created_at).getTime()).sort((a, b) => a - b)[0]
  return { used, max: PING_MAX_24H, left: Math.max(0, PING_MAX_24H - used), gapLeft, resetAt: used >= PING_MAX_24H && oldest ? new Date(oldest + DAY) : null }
}

/** Potong teks jadi cuplikan pendek untuk notifikasi. */
export const snippet = (t, n = 60) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n - 1)}…` : s }

/** Pecah teks jadi bagian biasa & mention project (#INV-xxxx). */
export function parseText(text) {
  const out = []; const re = /#([A-Za-z0-9-]{3,})/g
  let last = 0; let m
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ t: text.slice(last, m.index) })
    out.push({ inv: m[1] })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ t: text.slice(last) })
  return out
}
