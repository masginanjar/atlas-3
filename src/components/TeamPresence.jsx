import { useEffect, useMemo, useState } from 'react'
import { Users, Search, MessageCircle } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { ROLES, PROOFREADER_TEAM, roleLabel, placeOf, seeProofreaderIdentity } from '../config/access.js'
import { STATUS, statusOf, sinceLabel, IDLE_AFTER } from '../lib/presence.js'
import Avatar from './Avatar.jsx'
import { Popover, cx } from './ui.jsx'
import { go } from '../lib/router.js'

const ORDER = { online: 0, idle: 1, offline: 2 }
/** Akun yang tidak ditampilkan di daftar Tim Aktif (tetap terlihat oleh dirinya sendiri). */
const HIDE_ROLES = ['superadmin', 'akunting']
/** Peran yang digabung jadi satu identitas tim bagi pengguna biasa. */
const TEAM_ROLES = ['proofreader', 'otorisator']
/** "Ninda (CS Surabaya)" → "Ninda" — jabatan & cabang sudah ada di baris kecil di bawahnya. */
export const shortName = (n = '') => n.replace(/\s*\([^)]*\)/g, '').trim() || n

/**
 * Daftar tim untuk ditampilkan ke `viewer`.
 * Proofreader & staf otorisasi digabung jadi SATU baris identitas tim bagi pengguna
 * biasa — nama masing-masing tidak ikut dikirim ke tampilan, bukan sekadar disembunyikan.
 * Direktur selalu di urutan pertama dan ditandai tersedia (bisa dihubungi 24 jam).
 */
export function teamFor(viewer, users, now = Date.now()) {
  const active = users.filter((u) => u.active !== false)
  const show = seeProofreaderIdentity(viewer)
  const rows = []
  const tim = []
  for (const u of active) {
    const role = u.base_role || u.role
    const self = u.id === viewer?.id
    if (HIDE_ROLES.includes(role) && !self) continue
    if (TEAM_ROLES.includes(role) && !show && !self) { tim.push(u); continue }
    // Direktur: tersedia 24 jam (bisa dimatikan sendiri di Setting → Preferensi)
    const dir = role === 'direktur' && u.available_24h !== false
    rows.push({ id: u.id, name: shortName(u.name), user: u, self: u.id === viewer?.id, role: u.role, roleText: roleLabel(u), place: placeOf(u), dir, status: dir ? 'online' : statusOf(u, now), since: u.last_active_at, h24: dir })
  }
  if (tim.length) {
    // satu identitas: hanya jumlah yang online yang dibagikan, tanpa nama perorangan
    const st = tim.map((u) => statusOf(u, now))
    const best = st.includes('online') ? 'online' : st.includes('idle') ? 'idle' : 'offline'
    const since = tim.map((u) => u.last_active_at).filter(Boolean).sort().pop()
    rows.push({ id: PROOFREADER_TEAM.id, name: PROOFREADER_TEAM.lead, role: 'proofreader', roleText: 'Tim Proofreader & Otorisasi', place: 'Freelance', status: best, since, team: tim.length, online: st.filter((x) => x === 'online').length })
  }
  return rows.sort((a, b) => (b.dir ? 1 : 0) - (a.dir ? 1 : 0) || ORDER[a.status] - ORDER[b.status] || a.name.localeCompare(b.name))
}

function Row({ r, now, onChat }) {
  const s = STATUS[r.status]
  return (
    <li className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-slate-50">
      <span className="relative shrink-0">
        {r.user ? <Avatar user={r.user} size={30} ring={false} className="ring-1 ring-slate-200" />
          : <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-slate-100 text-[11px] font-bold text-ink-soft ring-1 ring-slate-200">{r.team}</span>}
        <span className={cx('absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white', s.dot)} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="min-w-0 truncate text-[13px] font-semibold text-ink">{r.name}</span>
          {r.h24 && <span title="Bisa dihubungi kapan saja" className="shrink-0 rounded-full bg-amber-50 px-1.5 py-px text-[10px] font-bold text-amber-700 ring-1 ring-amber-200">24 jam</span>}
        </span>
        <span className="block truncate text-[11px] text-ink-mute">{r.roleText} · {r.place}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className={cx('block text-[11px] font-bold', s.text)}>{s.label}{r.team ? ` ${r.online}/${r.team}` : ''}</span>
        <span className="block text-[10px] text-ink-mute">{sinceLabel(r.since, now)}</span>
      </span>
      {onChat && !r.self && (
        <button type="button" onClick={() => onChat(r.id)} title={`Chat ${r.name}`} aria-label={`Chat ${r.name}`}
          className="shrink-0 rounded-lg p-1.5 text-ink-mute transition hover:bg-brand-soft hover:text-brand"><MessageCircle className="h-4 w-4" /></button>
      )}
    </li>
  )
}

/** Tim Aktif — popover kecil di header, tidak menutupi halaman dan tidak merebut fokus. */
export default function TeamPresence() {
  const { user, data } = useApp()
  const [now, setNow] = useState(() => Date.now())
  const [q, setQ] = useState('')
  const [role, setRole] = useState('')
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t) }, [])

  const rows = useMemo(() => teamFor(user, data.users, now), [user, data.users, now])
  const online = rows.filter((r) => r.status === 'online').length
  const roles = useMemo(() => [...new Set(rows.map((r) => r.role))], [rows])
  const shown = rows.filter((r) => (!role || r.role === role) && (!q.trim() || r.name.toLowerCase().includes(q.trim().toLowerCase())))

  return (
    <Popover label="Tim Aktif" width="w-[min(360px,92vw)]" panelClass="max-sm:fixed max-sm:inset-x-2 max-sm:top-[calc(var(--appbar)+4px)] max-sm:w-auto"
      button={({ open, toggle }) => (
        <button type="button" onClick={toggle} aria-expanded={open} aria-label={`Tim Aktif — ${online} online`} title="Tim Aktif"
          className={cx('flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold ring-1 transition', open ? 'bg-ink text-white ring-ink' : 'bg-white text-ink-soft ring-slate-200 hover:text-brand')}>
          <Users className="h-4 w-4" />
          <span className="tabular-nums">{online}</span>
          <span className={cx('h-1.5 w-1.5 rounded-full', online ? 'bg-emerald-500' : 'bg-slate-300')} />
        </button>
      )}>
      {({ close }) => (
        <div>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <p className="text-sm font-bold">Tim Aktif</p>
            <p className="text-[11px] text-ink-mute">{online} dari {rows.length} online</p>
          </div>
          <div className="flex gap-1.5">
            <label className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-mute" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama…" aria-label="Cari anggota tim"
                className="w-full rounded-lg border-0 bg-slate-50 py-1.5 pl-7 pr-2 text-xs ring-1 ring-slate-200 focus:ring-2 focus:ring-brand" />
            </label>
            <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Filter peran"
              className="max-w-[128px] rounded-lg border-0 bg-slate-50 py-1.5 pl-2 pr-6 text-xs font-semibold ring-1 ring-slate-200 focus:ring-2 focus:ring-brand">
              <option value="">Semua peran</option>
              {roles.map((r) => <option key={r} value={r}>{ROLES[r]?.label || r}</option>)}
            </select>
          </div>
          <ul className="mt-2 max-h-[46vh] space-y-0.5 overflow-auto pr-0.5">
            {shown.length === 0 ? <li className="px-2 py-6 text-center text-xs text-ink-mute">Tidak ada yang cocok.</li>
              : shown.map((r) => <Row key={r.id} r={r} now={now} onChat={(id) => { close(); go(`pesan/${id}`) }} />)}
          </ul>
          <p className="mt-2 border-t border-slate-100 pt-2 text-[10px] leading-relaxed text-ink-mute">
            Online = tab ATLAS terbuka dan ada aktivitas. Idle = terbuka tapi diam lebih dari {IDLE_AFTER / 60000} menit. Offline = tab ditutup atau sudah keluar.
          </p>
        </div>
      )}
    </Popover>
  )
}
