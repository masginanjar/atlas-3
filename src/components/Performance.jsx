import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Clock, AlarmClock, Hourglass, Sparkles, Info, Users, ChevronUp, History, Printer } from 'lucide-react'
import Avatar from './Avatar.jsx'
import { useApp } from '../lib/store.jsx'
import { go } from '../lib/router.js'
import { ROLES, can, branchesOf, isFreelance, placeOf, invoiceLabel} from '../config/access.js'
import { stageLabel } from '../config/workflows.js'
import { summarize, band, dayKey, clock, addDays, hasPersonalTasks, canSeeTeam } from '../lib/performance.js'
import { PriorityBadge } from './Priority.jsx'
import { PrintBadge } from './badges.jsx'
import { Card, Select, cx } from './ui.jsx'

// ---------- preferensi animasi ----------
const ANIM_KEY = 'atlas-anim-off'
const reduced = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false } }
function useAnim() {
  const [off, setOff] = useState(() => { try { return localStorage.getItem(ANIM_KEY) === '1' } catch { return false } })
  const toggle = () => setOff((o) => { try { localStorage.setItem(ANIM_KEY, o ? '0' : '1') } catch { /* abaikan */ } return !o })
  return [!off && !reduced(), off, toggle]
}
const lsGet = (k) => { try { return localStorage.getItem(k) } catch { return null } }
const lsSet = (k, v) => { try { localStorage.setItem(k, v) } catch { /* abaikan */ } }

/** Tanggal hari ini (zona operasional) — ikut berganti saat lewat tengah malam. */
function useToday() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(t) }, [])
  return [dayKey(now), now]
}

const STYLE = `
@keyframes atlas-pop { 0% { transform: translateY(6px); opacity: 0 } 15% { transform: none; opacity: 1 } 85% { opacity: 1 } 100% { opacity: 0 } }
@keyframes atlas-fall { 0% { transform: translate3d(0,-20px,0) rotate(0); opacity: 1 } 100% { transform: translate3d(var(--dx),260px,0) rotate(540deg); opacity: 0 } }
@keyframes atlas-cheer { 0%,100% { transform: translateY(0) } 30% { transform: translateY(-8px) rotate(-4deg) } 60% { transform: translateY(-3px) rotate(3deg) } }
.atlas-pop { animation: atlas-pop 2.4s ease-out forwards }
.atlas-confetti i { position: absolute; top: 0; width: 8px; height: 12px; border-radius: 2px; animation: atlas-fall 2.4s cubic-bezier(.2,.6,.4,1) forwards }
.atlas-cheer { animation: atlas-cheer 0.9s ease-in-out 2 }
@media (prefers-reduced-motion: reduce) { .atlas-pop, .atlas-confetti i, .atlas-cheer { animation: none !important } }
`

/** Maskot: tanaman kecil yang tumbuh seiring progres; berbunga & tersenyum saat 100%. */
function Plant({ pct, anim, cheer }) {
  const p = pct ?? 0
  const t = anim ? 'transition-all duration-700 ease-out' : ''
  const leaf = (on) => ({ opacity: on ? 1 : 0, transform: on ? 'scale(1)' : 'scale(0.3)' })
  return (
    <svg viewBox="0 0 64 80" className={cx('h-20 w-16 shrink-0', cheer && anim && 'atlas-cheer')} role="img" aria-label={`Maskot tanaman — progres ${pct ?? 0}%`}>
      <rect className={t} x="30" y="22" width="4" height="40" rx="2" fill="#34d399" style={{ transformBox: 'fill-box', transformOrigin: 'bottom', transform: `scaleY(${0.15 + (p / 100) * 0.85})` }} />
      <ellipse className={t} cx="23" cy="48" rx="8" ry="4" fill="#6ee7b7" style={{ ...leaf(p >= 25), transformBox: 'fill-box', transformOrigin: 'right' }} />
      <ellipse className={t} cx="41" cy="40" rx="8" ry="4" fill="#6ee7b7" style={{ ...leaf(p >= 50), transformBox: 'fill-box', transformOrigin: 'left' }} />
      <ellipse className={t} cx="24" cy="32" rx="7" ry="3.5" fill="#a7f3d0" style={{ ...leaf(p >= 75), transformBox: 'fill-box', transformOrigin: 'right' }} />
      <g className={t} style={{ opacity: p >= 100 ? 1 : 0, transformBox: 'fill-box', transformOrigin: 'center', transform: p >= 100 ? 'scale(1)' : 'scale(0.2)' }}>
        {[0, 72, 144, 216, 288].map((a) => <ellipse key={a} cx="32" cy="12" rx="5" ry="7" fill="#fda4af" transform={`rotate(${a} 32 19)`} />)}
        <circle cx="32" cy="19" r="6" fill="#fde68a" />
        <circle cx="30" cy="18" r="0.9" fill="#14213d" /><circle cx="34" cy="18" r="0.9" fill="#14213d" />
        <path d="M29.8 20.4 Q32 22.6 34.2 20.4" stroke="#14213d" strokeWidth="0.9" fill="none" strokeLinecap="round" />
      </g>
      {p < 100 && <circle className={t} cx="32" cy={62 - (0.15 + (p / 100) * 0.85) * 40} r="3.2" fill="#bbf7d0" />}
      <path d="M18 62 h28 l-3 14 a3 3 0 0 1 -3 2.5 h-16 a3 3 0 0 1 -3 -2.5 z" fill="#fdba74" />
      <rect x="16" y="59" width="32" height="5" rx="2.5" fill="#fb923c" />
      <circle cx="27" cy="69" r="0.9" fill="#7c2d12" /><circle cx="37" cy="69" r="0.9" fill="#7c2d12" />
      <path d="M29.5 71.5 Q32 73.5 34.5 71.5" stroke="#7c2d12" strokeWidth="0.9" fill="none" strokeLinecap="round" />
    </svg>
  )
}

function Ring({ pct, color, anim, size = 104 }) {
  const r = 42; const c = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className="shrink-0 -rotate-90" aria-hidden="true">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#eef2f7" strokeWidth="10" />
      <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - (pct ?? 0) / 100)} style={{ transition: anim ? 'stroke-dashoffset 900ms cubic-bezier(.3,.7,.3,1)' : 'none' }} />
    </svg>
  )
}

function Confetti() {
  const colors = ['#fda4af', '#fde68a', '#a7f3d0', '#bae6fd', '#c4b5fd', '#fdba74']
  const bits = useMemo(() => Array.from({ length: 36 }, (_, i) => ({ left: `${(i * 37) % 100}%`, dx: `${((i * 53) % 80) - 40}px`, delay: `${(i % 9) * 60}ms`, color: colors[i % colors.length] })), []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="atlas-confetti pointer-events-none absolute inset-x-0 top-0 h-72 overflow-hidden" aria-hidden="true">
      {bits.map((b, i) => <i key={i} style={{ left: b.left, background: b.color, animationDelay: b.delay, '--dx': b.dx }} />)}
    </div>
  )
}

const TaskRow = ({ t, late, onOpen }) => (
  <li>
    <button type="button" onClick={() => onOpen(t)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ring-1 ring-slate-200 transition hover:bg-slate-50 hover:ring-brand">
      <span className={cx('flex w-14 shrink-0 flex-col items-center rounded-lg py-1 text-xs font-bold tabular-nums', late ? 'bg-rose-50 text-rose-700' : 'bg-slate-50 text-ink')}>
        <Clock className="mb-0.5 h-3.5 w-3.5" />{t.dl.time}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5 text-sm font-bold">{invoiceLabel(t.project.invoice_no)}<PriorityBadge p={t.project.about?.priority} iconOnly /><PrintBadge project={t.project} />
          {late && <span className="rounded-full bg-rose-100 px-1.5 text-[10px] font-bold text-rose-700">Lewat jam deadline</span>}</span>
        <span className="block truncate text-xs text-ink-mute">{t.sub.title} · {stageLabel(t.flow, t.sub.stage)}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-slate-300" />
    </button>
  </li>
)

/** Kartu Performa Hari Ini milik pengguna yang login. */
export function PerformanceCard({ narrow }) {
  const [shown, setShown] = useState(() => { try { return localStorage.getItem('atlas-fold-perf') !== '0' } catch { return true } })
  const toggleOpen = () => setShown((o) => { try { localStorage.setItem('atlas-fold-perf', o ? '0' : '1') } catch { /* abaikan */ } return !o })
  const { user, data, save, notify } = useApp()
  const [today, now] = useToday()
  const [anim, animOff, toggleAnim] = useAnim()
  const s = useMemo(() => summarize(user, data.projects, today, now), [user, data.projects, today, now])
  const b = band(s.pct)
  const [updated, setUpdated] = useState(() => new Date())
  const [cheer, setCheer] = useState(false)
  const [pop, setPop] = useState(null)
  const [confetti, setConfetti] = useState(false)
  const [showHist, setShowHist] = useState(false)
  const prev = useRef(null)

  // perbarui waktu, animasi "satu lagi selesai", confetti pertama kali 100%
  useEffect(() => {
    setUpdated(new Date())
    if (!data.projects.length) return
    // nilai sebelumnya disimpan per sesi agar tetap terdeteksi setelah kembali dari halaman tugas
    const sk = `atlas-perf-prev-${user.id}`
    let p = prev.current
    if (!p) { try { p = JSON.parse(sessionStorage.getItem(sk)) } catch { p = null } }
    prev.current = { day: today, done: s.done.length, total: s.total }
    try { sessionStorage.setItem(sk, JSON.stringify(prev.current)) } catch { /* abaikan */ }
    if (s.pct === 100) {
      const ck = `atlas-confetti-${user.id}-${today}`
      if (!lsGet(ck)) {
        lsSet(ck, '1')
        if (anim) { setConfetti(true); setCheer(true); setTimeout(() => setConfetti(false), 2600); setTimeout(() => setCheer(false), 2000) }
        notify('Hebat, semua tugas hari ini selesai! 🎉')
        return
      }
    }
    if (p && p.day === today && p.total > 0 && p.total === s.total && s.done.length > p.done) { setPop(Date.now()); setTimeout(() => setPop(null), 2400) }
  }, [s.done.length, s.total, today]) // eslint-disable-line react-hooks/exhaustive-deps

  // simpan riwayat harian (1 baris per user per hari)
  useEffect(() => {
    const row = (data.perf_daily || []).find((r) => r.user_id === user.id && r.day === today)
    const snap = { done: s.done.length, total: s.total, waiting: s.waiting.length, overdue: s.overdue.length, pct: s.pct }
    if (row && ['done', 'total', 'waiting', 'overdue', 'pct'].every((k) => row[k] === snap[k])) return
    save('perf_daily', { ...(row || {}), user_id: user.id, day: today, ...snap, updated_at_local: new Date().toISOString() }).catch(() => {})
  }, [s.done.length, s.total, s.waiting.length, s.overdue.length, s.pct, today]) // eslint-disable-line react-hooks/exhaustive-deps

  const open = (t) => go(`projects/${t.project.id}`)
  const history = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = addDays(today, -(6 - i))
    const snap = (data.perf_daily || []).find((r) => r.user_id === user.id && r.day === d)
    const live = snap ? null : summarize(user, data.projects, d, now)
    return { d, pct: snap ? snap.pct : live.pct, done: snap ? snap.done : live.done.length, total: snap ? snap.total : live.total }
  }), [data.perf_daily, data.projects, today, user, now])

  return (
    <Card className={cx('relative overflow-hidden ring-1', b.ring)}>
      <style>{STYLE}</style>
      {confetti && <Confetti />}
      <div className={cx('card-head flex flex-wrap items-center gap-2 px-4 py-3 !pr-36 sm:!pr-4', b.bg)}>
        <Sparkles className={cx('h-4 w-4', b.text)} />
        <h2 className="font-bold">Performa Hari Ini</h2>
        <span className="text-xs text-ink-mute">{new Date(`${today}T12:00:00+08:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        <div className="fold-wrap ml-auto flex items-center gap-1.5">
          <button type="button" onClick={() => setShowHist((v) => !v)} aria-expanded={showHist} className="inline-flex items-center gap-1 rounded-lg bg-white/80 px-2 py-1 text-[11px] font-semibold text-ink-soft ring-1 ring-slate-200 hover:text-brand"><History className="h-3.5 w-3.5" />Riwayat</button>
          <button type="button" onClick={toggleAnim} aria-pressed={!animOff} className="rounded-lg bg-white/80 px-2 py-1 text-[11px] font-semibold text-ink-soft ring-1 ring-slate-200 hover:text-brand" title="Matikan / nyalakan animasi">Animasi: {animOff ? 'Off' : 'On'}</button>
          {!shown && <span className={cx('rounded-full bg-white px-2 py-0.5 text-xs font-extrabold tabular-nums ring-1 ring-slate-200', b.text)}>{s.pct === null ? '—' : `${s.pct}%`}</span>}
          <button type="button" onClick={toggleOpen} aria-expanded={shown} aria-label={`${shown ? 'Tutup' : 'Buka'} Performa Hari Ini`} title={shown ? 'Minimize' : 'Buka'} className="grid h-7 w-7 place-items-center rounded-lg bg-white/80 text-ink-soft ring-1 ring-slate-200 hover:text-brand">
            <ChevronUp className={cx('h-4 w-4 transition-transform', !shown && 'rotate-180')} />
          </button>
        </div>
      </div>
      {shown && <>

      <div className={cx('grid gap-4 p-4', !narrow && 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]')}>
        {/* Ringkasan */}
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="relative grid place-items-center">
            <Ring pct={s.pct} color={b.stroke} anim={anim} />
            <div className="absolute text-center">
              <p className={cx('text-2xl font-extrabold tabular-nums', b.text)}>{s.pct === null ? '—' : `${s.pct}%`}</p>
              <p className="text-[10px] font-semibold text-ink-mute">{b.label}</p>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">{b.msg}</p>
            {s.pct !== null && <p className="mt-1 text-sm text-ink-soft"><b className="text-ink">{s.done.length} dari {s.total}</b> tugas selesai · <b className="text-ink">{s.active.length + s.overdue.length}</b> tersisa{s.overdue.length > 0 && <> (<span className="font-semibold text-rose-600">{s.overdue.length} terlambat</span>)</>}{s.titipan > 0 && <> · <span className="inline-flex items-center gap-1 font-semibold text-fuchsia-700"><Printer className="h-3.5 w-3.5" />termasuk {s.titipan} titipan print</span></>}</p>}
            {s.pct === null && s.waiting.length > 0 && <p className="mt-1 text-xs text-ink-soft">Bagianmu sudah dikirim — {s.waiting.length} tugas sedang menunggu role lain.</p>}
            <p className="mt-1 text-[11px] text-ink-mute">Diperbarui {clock(updated)} WITA</p>
            {s.next && <button type="button" onClick={() => open(s.next)} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-brand-dark">Lanjutkan Tugas Berikutnya<ArrowRight className="h-4 w-4" /></button>}
          </div>
          <span className="hidden min-[400px]:block"><Plant pct={s.pct} anim={anim} cheer={cheer} /></span>
        </div>

      </div>

      {(s.overdue.length > 0 || s.waiting.length > 0) && (
        <div className={cx('grid gap-3 border-t border-slate-100 px-4 py-3', !narrow && 'md:grid-cols-2')}>
          {s.overdue.length > 0 && (
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-rose-700"><AlarmClock className="h-3.5 w-3.5" />Terlambat dari hari sebelumnya ({s.overdue.length})</p>
              <ul className="space-y-1">{s.overdue.slice(0, 4).map((t) => (
                <li key={t.sub.id}><button type="button" onClick={() => open(t)} className="w-full truncate rounded-lg px-2 py-1 text-left text-xs hover:bg-rose-50"><b>{invoiceLabel(t.project.invoice_no)}</b> · {t.sub.title} · <span className="text-rose-600">deadline {t.dl.day.slice(8)}/{t.dl.day.slice(5, 7)} {t.dl.time}</span></button></li>
              ))}</ul>
            </div>
          )}
          {s.waiting.length > 0 && (
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-ink-soft"><Hourglass className="h-3.5 w-3.5" />Menunggu persetujuan / role lain ({s.waiting.length}) <span className="font-normal text-ink-mute">— tidak mengurangi performamu</span></p>
              <ul className="space-y-1">{s.waiting.slice(0, 4).map((t) => (
                <li key={t.sub.id} className="truncate px-2 py-1 text-xs text-ink-soft"><b>{invoiceLabel(t.project.invoice_no)}</b> · {t.sub.title} · {stageLabel(t.flow, t.sub.stage)}</li>
              ))}</ul>
            </div>
          )}
        </div>
      )}

      {showHist && (
        <div className="border-t border-slate-100 px-4 py-3">
          <p className="mb-2 text-xs font-bold text-ink-soft">Riwayat 7 hari terakhir</p>
          <div className="grid grid-cols-7 gap-1.5">
            {history.map((h) => {
              const hb = band(h.pct)
              return (
                <div key={h.d} className={cx('rounded-xl px-1 py-2 text-center ring-1', hb.bg, hb.ring)} title={h.total ? `${h.done} dari ${h.total} tugas selesai` : 'Tidak ada deadline'}>
                  <p className="text-[10px] text-ink-mute">{new Date(`${h.d}T12:00:00+08:00`).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' })}</p>
                  <p className={cx('text-sm font-extrabold tabular-nums', hb.text)}>{h.pct === null ? '—' : `${h.pct}%`}</p>
                  <p className="text-[10px] text-ink-mute">{h.total ? `${h.done}/${h.total}` : 'tanpa deadline'}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <p className="flex items-start gap-1.5 border-t border-slate-100 px-4 py-2 text-[11px] text-ink-mute">
        <Info className="mt-px h-3.5 w-3.5 shrink-0" />Angka ini adalah progres penyelesaian tugas harian (tugas selesai hari ini ÷ tugas selesai + semua tugas yang masih di tangan Anda, termasuk yang terlambat), bukan penilaian menyeluruh atas kualitas atau produktivitas seseorang. Tugas yang menunggu role lain tidak mengurangi nilai.
      </p>
      </>}
      {pop && anim && <div className="pointer-events-none fixed inset-x-0 top-16 z-40 flex justify-center"><div className="atlas-pop rounded-full bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-lg" role="status">Satu lagi selesai! ✨</div></div>}
      {pop && !anim && <span className="sr-only" role="status">Satu lagi selesai!</span>}
    </Card>
  )
}

/** Ringkasan tim untuk pimpinan — tanpa peringkat (urut nama). */
export function TeamPerformance() {
  const { user, data, branchFilter } = useApp()
  const [today, now] = useToday()
  const [open, setOpen] = useState(() => lsGet('atlas-fold-team') !== '0')
  const [role, setRole] = useState('semua')
  const [who, setWho] = useState('semua')
  const people = useMemo(() => data.users.filter((u) => u.active !== false && hasPersonalTasks(u) && u.id !== user.id
    && (isFreelance(u) || (can.seeAllBranches(user) ? (branchFilter === 'Semua' || u.branch === branchFilter || branchesOf(u).includes(branchFilter)) : branchesOf(user).some((b) => branchesOf(u).includes(b))))), [data.users, user, branchFilter])
  const roles = [...new Set(people.map((u) => u.role))]
  const shown = people.filter((u) => (role === 'semua' || u.role === role) && (who === 'semua' || u.id === who)).sort((a, b) => a.name.localeCompare(b.name))
  const rows = useMemo(() => shown.map((u) => ({ u, s: summarize(u, data.projects, today, now) })), [shown, data.projects, today, now]) // eslint-disable-line react-hooks/exhaustive-deps
  const done = rows.reduce((a, r) => a + r.s.done.length, 0); const total = rows.reduce((a, r) => a + r.s.total, 0)
  const pct = total ? Math.round((done / total) * 100) : null
  const b = band(pct)
  const toggle = () => setOpen((o) => { lsSet('atlas-fold-team', o ? '0' : '1'); return !o })
  if (!canSeeTeam(user)) return null
  return (
    <Card className="overflow-hidden">
      <div className="card-head flex flex-wrap items-center gap-2 bg-gradient-to-r from-violet-50 to-fuchsia-50/40 px-4 py-3">
        <Users className="h-4 w-4 text-violet-600" />
        <h2 className="font-bold">Ringkasan Tim Hari Ini</h2>
        <span className={cx('rounded-full px-2 py-0.5 text-xs font-bold ring-1', b.bg, b.ring, b.text)}>{pct === null ? 'Belum ada deadline' : `${pct}% · ${done}/${total} selesai`}</span>
        <button type="button" onClick={toggle} aria-expanded={open} aria-label={`${open ? 'Tutup' : 'Buka'} Ringkasan Tim`} className="fold ml-auto grid h-8 w-8 place-items-center rounded-lg bg-white text-ink-soft ring-1 ring-slate-200 hover:text-brand hover:ring-brand">
          <ChevronUp className={cx('h-4 w-4 transition-transform', !open && 'rotate-180')} />
        </button>
      </div>
      {open && <>
        <div className="grid grid-cols-2 items-center gap-2 border-b border-slate-100 px-3 py-2 sm:flex sm:flex-wrap sm:px-4 [&_select]:min-w-0">
          <Select value={role} onChange={(e) => { setRole(e.target.value); setWho('semua') }} className="!w-full !py-1 text-xs sm:!w-44" aria-label="Filter role">
            <option value="semua">Semua role</option>{roles.map((r) => <option key={r} value={r}>{ROLES[r]?.label ?? r}</option>)}
          </Select>
          <Select value={who} onChange={(e) => setWho(e.target.value)} className="!w-full !py-1 text-xs sm:!w-52" aria-label="Filter pengguna">
            <option value="semua">Semua pengguna</option>{people.filter((u) => role === 'semua' || u.role === role).sort((a, b) => a.name.localeCompare(b.name)).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
          <span className="col-span-2 text-[11px] text-ink-mute sm:ml-auto">Hanya terlihat oleh pimpinan · urut nama, bukan peringkat</span>
        </div>
        <ul className="max-h-[400px] divide-y divide-slate-100 overflow-y-auto overscroll-contain">
          {rows.map(({ u, s }) => {
            const ub = band(s.pct)
            return (
              <li key={u.id} className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-2.5 sm:grid-cols-[200px_1fr_auto]">
                <p className="flex min-w-0 items-center gap-2 truncate text-sm font-semibold"><Avatar user={u} size={26} ring={false} />{u.name} <span className="text-[11px] font-normal text-ink-mute">· {ROLES[u.role]?.label}</span></p>
                <div className="hidden h-2.5 rounded-full bg-slate-100 sm:block" role="img" aria-label={`${u.name}: ${s.pct ?? 0}%`}>
                  <div className="h-2.5 rounded-full" style={{ width: `${s.pct ?? 0}%`, background: ub.stroke }} />
                </div>
                <p className="text-right text-xs tabular-nums">
                  {s.pct === null ? <span className="text-ink-mute">Belum ada deadline</span> : <><b className={ub.text}>{s.pct}%</b> · {s.done.length}/{s.total}</>}
                  {s.waiting.length > 0 && <span className="text-ink-mute"> · {s.waiting.length} menunggu</span>}
                  {s.overdue.length > 0 && <span className="text-rose-600"> · {s.overdue.length} terlambat</span>}
                </p>
              </li>
            )
          })}
          {rows.length === 0 && <li className="px-4 py-6 text-center text-sm text-ink-mute">Tidak ada pengguna sesuai filter.</li>}
        </ul>
      </>}
    </Card>
  )
}
