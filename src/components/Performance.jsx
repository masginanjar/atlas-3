import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Clock, AlarmClock, Hourglass, Sparkles, Info, Users, ChevronUp, History, Printer } from 'lucide-react'
import Avatar from './Avatar.jsx'
import { useApp } from '../lib/store.jsx'
import { go } from '../lib/router.js'
import { ROLES, can, branchesOf, isFreelance, placeOf, invoiceLabel, BRANCHES } from '../config/access.js'
import { stageLabel } from '../config/workflows.js'
import { summarize, band, dayKey, clock, addDays, hasPersonalTasks, canSeeTeam, selesaiJam } from '../lib/performance.js'
import { PriorityBadge } from './Priority.jsx'
import { PrintBadge, InvoiceNo } from './badges.jsx'
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
        <span className="flex flex-wrap items-center gap-1.5 text-sm font-bold"><InvoiceNo project={t.project} /><PriorityBadge p={t.project.about?.priority} iconOnly /><PrintBadge project={t.project} />
          {late && <span className="rounded-full bg-rose-100 px-1.5 text-[10px] font-bold text-rose-700">Lewat jam deadline</span>}</span>
        <span className="block truncate text-xs text-ink-mute">{t.sub.title} · {stageLabel(t.flow, t.sub.stage)}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-slate-300" />
    </button>
  </li>
)

const tglPendek = (day) => `${day.slice(8)}/${day.slice(5, 7)}`
const hariTelat = (day, today) => Math.round((new Date(`${today}T12:00:00+08:00`) - new Date(`${day}T12:00:00+08:00`)) / 864e5)
const menitDari = (hhmm) => { const [h, m] = String(hhmm || '').split(':').map(Number); return (h || 0) * 60 + (m || 0) }
/** Posisi % pada garis jam 08.00–17.00. */
const posJam = (hhmm) => Math.max(2, Math.min(98, ((menitDari(hhmm) - 480) / 540) * 100))

/** Pesan singkat sesuai sisa tugas hari ini. */
function pesan(s) {
  if (s.pct === null) return s.overdue.length ? 'Tidak ada deadline hari ini — waktu yang pas untuk melunasi utang lama 💪' : 'Belum ada deadline hari ini. Saatnya bersiap untuk tugas berikutnya!'
  const sisa = s.active.length
  if (!sisa) return 'Hebat, semua target hari ini selesai! 🎉'
  if (s.pct >= 50) return `Bagus! Tinggal ${sisa} tugas lagi untuk hari ini 💪`
  return `Ayo, mulai dari tugas terdekat — ${sisa} tugas lagi hari ini 🌱`
}

/** Riwayat 7 hari (snapshot perf_daily atau hitung ulang) + hari beruntun ≥80%. */
function useRiwayat(user, today, now) {
  const { data } = useApp()
  return useMemo(() => {
    const hari = (d) => {
      const snap = (data.perf_daily || []).find((r) => r.user_id === user.id && r.day === d)
      if (snap && snap.v === 2) return { d, pct: snap.pct, done: snap.done, total: snap.total }
      const live = summarize(user, data.projects, d, now)
      return { d, pct: live.pct, done: live.done.length, total: live.total }
    }
    const tujuh = Array.from({ length: 7 }, (_, i) => hari(addDays(today, -(6 - i))))
    let streak = 0
    for (let i = 0; i < 30; i++) {
      const h = i < 7 ? tujuh[6 - i] : hari(addDays(today, -i))
      if (h.pct === null) { if (i === 0) continue; else continue } // hari tanpa deadline / libur tidak memutus
      if (h.pct >= 80) streak += 1
      else if (i === 0) continue // hari ini masih berjalan
      else break
    }
    const ada = tujuh.filter((h) => h.pct !== null)
    const rata = ada.length ? Math.round(ada.reduce((a, h) => a + h.pct, 0) / ada.length) : null
    return { tujuh, streak, rata }
  }, [data.perf_daily, data.projects, today, user, now])
}

/** Kartu Performa Hari Ini milik pengguna yang login. */
export function PerformanceCard() {
  const [shown, setShown] = useState(() => lsGet('atlas-fold-perf') !== '0')
  const toggleOpen = () => setShown((o) => { lsSet('atlas-fold-perf', o ? '0' : '1'); return !o })
  const [detailHp, setDetailHp] = useState(false)
  const [semuaUtang, setSemuaUtang] = useState(false)
  const [lewati, setLewati] = useState(0)
  const { user, data, save, notify } = useApp()
  const [today, now] = useToday()
  const [anim] = useAnim()
  const s = useMemo(() => summarize(user, data.projects, today, now), [user, data.projects, today, now])
  const b = band(s.pct)
  const [pop, setPop] = useState(null)
  const [confetti, setConfetti] = useState(false)
  const prev = useRef(null)
  const { tujuh, streak, rata } = useRiwayat(user, today, now)

  useEffect(() => {
    if (!data.projects.length) return
    const sk = `atlas-perf-prev-${user.id}`
    let p = prev.current
    if (!p) { try { p = JSON.parse(sessionStorage.getItem(sk)) } catch { p = null } }
    prev.current = { day: today, done: s.done.length, total: s.total }
    try { sessionStorage.setItem(sk, JSON.stringify(prev.current)) } catch { /* abaikan */ }
    if (s.pct === 100) {
      const ck = `atlas-confetti-${user.id}-${today}`
      if (!lsGet(ck)) {
        lsSet(ck, '1')
        if (anim) { setConfetti(true); setTimeout(() => setConfetti(false), 2600) }
        notify('Hebat, semua target hari ini selesai! 🎉')
        return
      }
    }
    if (p && p.day === today && p.total > 0 && p.total === s.total && s.done.length > p.done) { setPop(Date.now()); setTimeout(() => setPop(null), 2400) }
  }, [s.done.length, s.total, today]) // eslint-disable-line react-hooks/exhaustive-deps

  // simpan riwayat harian (1 baris per user per hari; v2 = rumus target hari ini)
  useEffect(() => {
    const row = (data.perf_daily || []).find((r) => r.user_id === user.id && r.day === today)
    const snap = { v: 2, done: s.done.length, total: s.total, waiting: s.waiting.length, overdue: s.overdue.length, pct: s.pct }
    if (row && Object.keys(snap).every((k) => row[k] === snap[k])) return
    save('perf_daily', { ...(row || {}), user_id: user.id, day: today, ...snap, updated_at_local: new Date().toISOString() }).catch(() => {})
  }, [s.done.length, s.total, s.waiting.length, s.overdue.length, s.pct, today]) // eslint-disable-line react-hooks/exhaustive-deps

  const open = (t) => go(`projects/${t.project.id}`)
  const antre = [...s.active, ...s.overdue, ...s.upcoming]
  const kerja = antre.length ? antre[lewati % antre.length] : null
  const warnaPct = s.pct === null ? 'text-indigo-600' : s.pct >= 80 ? 'text-emerald-600' : s.pct >= 50 ? 'text-amber-600' : 'text-orange-600'
  const stroke = s.pct === null ? '#a5b4fc' : s.pct >= 80 ? '#10b981' : s.pct >= 50 ? '#f59e0b' : '#fb923c'
  const jamNow = clock(now)
  const titik = [
    ...s.done.map((t) => ({ t, jam: selesaiJam(user, t, today) || t.dl.time, ok: true })),
    ...s.active.map((t) => ({ t, jam: t.dl.time, ok: false })),
  ]
  const utang = semuaUtang ? s.overdue : s.overdue.slice(0, 3)
  const maxBar = 100

  const Angka = ({ n, label, cls }) => (
    <div className={cx('rounded-xl py-2 text-center', cls)}><p className="text-lg font-extrabold leading-tight tabular-nums sm:text-xl">{n}</p><p className="text-[10px] font-semibold sm:text-[11px]">{label}</p></div>
  )

  return (
    <Card className="relative overflow-hidden" data-perf-v2>
      <style>{STYLE}</style>
      {confetti && <Confetti />}
      <div className="card-head flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
        <Sparkles className="h-4 w-4 text-amber-500" />
        <h2 className="font-bold">Performa Hari Ini</h2>
        <span className="text-xs text-ink-mute">{new Date(`${today}T12:00:00+08:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}</span>
        <div className="fold-wrap ml-auto flex items-center gap-1.5">
          {streak > 0 && <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-bold text-orange-600" title="Hari beruntun dengan target ≥80% (hari tanpa deadline tidak memutus)">🔥 {streak} hari beruntun</span>}
          {!shown && <span className={cx('rounded-full bg-white px-2 py-0.5 text-xs font-extrabold tabular-nums ring-1 ring-slate-200', warnaPct)}>{s.pct === null ? '—' : `${s.pct}%`}</span>}
          <button type="button" onClick={toggleOpen} aria-expanded={shown} aria-label={`${shown ? 'Tutup' : 'Buka'} Performa Hari Ini`} title={shown ? 'Minimize' : 'Buka'} className="grid h-8 w-8 place-items-center rounded-lg bg-white text-ink-soft ring-1 ring-slate-200 hover:text-brand">
            <ChevronUp className={cx('h-4 w-4 transition-transform', !shown && 'rotate-180')} />
          </button>
        </div>
      </div>
      {shown && <div className="space-y-4 p-4">
        {/* Ringkasan */}
        <div className="flex min-w-0 items-center gap-4">
          <div className="relative grid shrink-0 place-items-center">
            <span className="hidden sm:block"><Ring pct={s.pct} color={stroke} anim={anim} size={112} /></span>
            <span className="sm:hidden"><Ring pct={s.pct} color={stroke} anim={anim} size={80} /></span>
            <div className="absolute text-center">
              <p className={cx('text-xl font-extrabold leading-none tabular-nums sm:text-[26px]', warnaPct)} data-perf-pct>{s.pct === null ? '—' : `${s.pct}%`}</p>
              <p className="mt-0.5 hidden text-[10px] font-semibold text-ink-mute sm:block">target hari ini</p>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold leading-snug text-ink">{pesan(s)}</p>
            {s.total > 0 && <p className="mt-1 text-[13px] text-ink-soft"><b className="text-ink">{s.done.length} dari {s.total}</b> tugas deadline hari ini selesai{s.titipan > 0 && <> · <span className="inline-flex items-center gap-1 font-semibold text-fuchsia-700"><Printer className="h-3.5 w-3.5" />{s.titipan} titipan print</span></>}</p>}
            {s.waiting.length > 0 && <p className="mt-0.5 text-[11px] text-ink-mute"><Hourglass className="mr-1 inline h-3 w-3" />{s.waiting.length} menunggu role lain — tidak mengurangi angka</p>}
            <p className="mt-0.5 text-[11px] text-ink-mute">Diperbarui {jamNow} WITA</p>
          </div>
        </div>

        {/* 3 angka */}
        <div className="grid grid-cols-3 gap-2">
          <Angka n={s.done.length} label="Selesai" cls="bg-emerald-50 text-emerald-700" />
          <Angka n={s.active.length} label="Sisa hari ini" cls="bg-sky-50 text-sky-700" />
          <Angka n={s.overdue.length} label="Utang lama" cls={s.overdue.length ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-ink-mute'} />
        </div>

        {/* Kerjakan sekarang */}
        {kerja && (
          <div className="rounded-xl bg-ink p-4 text-white" data-perf-sekarang>
            <p className="text-[10px] font-bold uppercase tracking-wide text-white/60">
              {s.active.includes(kerja) ? `Kerjakan sekarang · deadline ${kerja.dl.time}` : s.overdue.includes(kerja) ? `Utang lama · deadline ${tglPendek(kerja.dl.day)} ${kerja.dl.time}` : `Berikutnya · ${tglPendek(kerja.dl.day)} ${kerja.dl.time}`}
            </p>
            <p className="mt-1 truncate text-[15px] font-bold">{invoiceLabel(kerja.project.invoice_no)} · {kerja.sub.title}</p>
            <p className="truncate text-xs text-white/70">{kerja.project.customer?.name || '—'} · tahap {stageLabel(kerja.flow, kerja.sub.stage)}</p>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => open(kerja)} className="flex h-11 flex-1 items-center justify-center gap-1 rounded-lg bg-white text-sm font-bold text-ink hover:bg-slate-100">Buka tugas<ArrowRight className="h-4 w-4" /></button>
              {antre.length > 1 && <button type="button" onClick={() => setLewati((n) => n + 1)} className="h-11 rounded-lg bg-white/10 px-4 text-sm font-semibold hover:bg-white/20">Lewati</button>}
            </div>
          </div>
        )}

        <button type="button" onClick={() => setDetailHp((v) => !v)} aria-expanded={detailHp} className="flex min-h-[40px] w-full items-center justify-center gap-1 text-xs font-semibold text-ink-soft sm:hidden">
          {detailHp ? 'Sembunyikan detail' : 'Lihat detail'}<ChevronUp className={cx('h-3.5 w-3.5 transition', !detailHp && 'rotate-180')} />
        </button>

        <div className={cx('space-y-4', !detailHp && 'hidden sm:block')}>
          {/* Jalannya hari ini */}
          {titik.length > 0 && (
            <div>
              <p className="mb-1.5 flex text-[11px] font-bold text-ink-soft">Jalannya hari ini<span className="ml-auto font-normal text-ink-mute">sekarang {jamNow}</span></p>
              <div className="relative h-9 rounded-lg bg-slate-50 ring-1 ring-slate-100" role="img" aria-label={`${s.done.length} tugas selesai, ${s.active.length} belum`}>
                <div className="absolute inset-y-0 left-0 rounded-l-lg bg-emerald-50" style={{ width: `${posJam(jamNow)}%` }} />
                <div className="absolute inset-y-1 w-0.5 rounded bg-ink" style={{ left: `${posJam(jamNow)}%` }} />
                {titik.map(({ t, jam, ok }) => (
                  <span key={t.sub.id} title={`${invoiceLabel(t.project.invoice_no)} · ${t.sub.title} — ${ok ? `selesai ${jam}` : `deadline ${jam}`}`}
                    className={cx('absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2', ok ? 'bg-emerald-500 ring-white' : 'bg-white ring-sky-500')} style={{ left: `${posJam(jam)}%` }} />
                ))}
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-ink-mute"><span>08.00</span><span>10.00</span><span>12.00</span><span>14.00</span><span>17.00</span></div>
            </div>
          )}

          {/* Utang lama */}
          {s.overdue.length > 0 && (
            <div className="overflow-hidden rounded-xl ring-1 ring-rose-200" data-perf-utang>
              <p className="flex items-center gap-1.5 bg-rose-50 px-3 py-2.5 text-[13px] font-bold text-rose-700"><AlarmClock className="h-4 w-4" />Utang tugas lama · {s.overdue.length}<span className="ml-auto text-[11px] font-normal text-rose-600">dihitung terpisah</span></p>
              <ul className="divide-y divide-slate-100 text-[12.5px]">
                {utang.map((t) => {
                  const n = hariTelat(t.dl.day, today)
                  return (
                    <li key={t.sub.id}>
                      <button type="button" onClick={() => open(t)} className="flex min-h-[40px] w-full items-center gap-2 px-3 py-2 text-left hover:bg-rose-50/50">
                        <span className={cx('w-12 shrink-0 rounded py-0.5 text-center text-[10px] font-bold', n >= 4 ? 'bg-rose-600 text-white' : 'bg-rose-100 text-rose-700')}>{n} hari</span>
                        <span className="min-w-0 flex-1 truncate"><b>{invoiceLabel(t.project.invoice_no)}</b> · {t.sub.title}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
              {s.overdue.length > 3 && <button type="button" onClick={() => setSemuaUtang((v) => !v)} className="min-h-[36px] w-full border-t border-slate-100 text-xs font-semibold text-ink-soft hover:bg-slate-50">{semuaUtang ? 'Ringkas' : `Lihat ${s.overdue.length - 3} lainnya`}</button>}
            </div>
          )}

          {/* 7 hari */}
          <div>
            <p className="mb-2 flex text-[11px] font-bold text-ink-soft">7 hari terakhir{rata !== null && <span className="ml-auto font-normal text-ink-mute">rata-rata {rata}%</span>}</p>
            <div className="flex h-20 items-end gap-1.5">
              {tujuh.map((h, i) => {
                const hariIni = i === 6
                const tinggi = h.pct === null ? 4 : Math.max(6, (h.pct / maxBar) * 56)
                const warna = h.pct === null ? 'bg-slate-200' : h.pct >= 80 ? 'bg-emerald-400' : h.pct >= 50 ? 'bg-amber-400' : 'bg-orange-300'
                return (
                  <div key={h.d} className="flex flex-1 flex-col items-center justify-end" title={h.total ? `${h.done} dari ${h.total} · ${h.pct}%` : 'Tidak ada deadline'}>
                    <div className={cx('w-full rounded-t', warna, hariIni && 'ring-2 ring-ink')} style={{ height: `${tinggi}px` }} />
                    <p className={cx('mt-1 text-[10px]', hariIni ? 'font-bold text-ink' : 'text-ink-mute')}>{hariIni ? 'Hari ini' : new Date(`${h.d}T12:00:00+08:00`).toLocaleDateString('id-ID', { weekday: 'short' })}</p>
                  </div>
                )
              })}
            </div>
          </div>
          <p className="flex items-start gap-1.5 border-t border-slate-100 pt-2.5 text-[11px] text-ink-mute">
            <Info className="mt-px h-3.5 w-3.5 shrink-0" />Angka = tugas deadline hari ini yang selesai. Utang lama tidak menurunkan angka, tapi tetap muncul sampai beres. Tugas yang menunggu role lain tidak dihitung.
          </p>
        </div>
      </div>}
      {pop && anim && <div className="pointer-events-none fixed inset-x-0 top-16 z-40 flex justify-center"><div className="atlas-pop rounded-full bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-lg" role="status">Satu lagi selesai! ✨</div></div>}
    </Card>
  )
}

/** Performa tim hari ini untuk pimpinan — per cabang / per orang + "perlu dibantu". */
export function TeamPerformance() {
  const { user, data, branchFilter, sendPing, notify } = useApp()
  const [today, now] = useToday()
  const [open, setOpen] = useState(() => lsGet('atlas-fold-team') !== '0')
  const [mode, setMode] = useState('cabang')
  const [role, setRole] = useState('semua')
  const [semuaCabang, setSemuaCabang] = useState(false)
  const people = useMemo(() => data.users.filter((u) => u.active !== false && hasPersonalTasks(u) && u.id !== user.id
    && (isFreelance(u) || (can.seeAllBranches(user) ? (branchFilter === 'Semua' || u.branch === branchFilter || branchesOf(u).includes(branchFilter)) : branchesOf(user).some((b) => branchesOf(u).includes(b))))), [data.users, user, branchFilter])
  const roles = [...new Set(people.map((u) => u.role))]
  const rows = useMemo(() => people.map((u) => ({ u, s: summarize(u, data.projects, today, now) })), [people, data.projects, today, now])
  const sum = (list) => {
    const done = list.reduce((a, r) => a + r.s.done.length, 0); const total = list.reduce((a, r) => a + r.s.total, 0)
    return { done, total, pct: total ? Math.round((done / total) * 100) : null, utang: list.reduce((a, r) => a + r.s.overdue.length, 0) }
  }
  const all = sum(rows)
  // Kehadiran dari Jadwal (masuk / libur) — bila jadwal hari ini sudah diisi.
  const jadwalHariIni = (data.jadwal || []).filter((j) => j.tanggal === today)
  const kehadiran = (cabang) => {
    const isi = jadwalHariIni.filter((j) => j.cabang === cabang)
    if (!isi.length) return null
    const libur = isi.filter((j) => j.shift === 'libur').length
    return { masuk: isi.length - libur, libur }
  }
  const cabang = useMemo(() => BRANCHES.map((c) => {
    const list = rows.filter((r) => !isFreelance(r.u) && (r.u.branch === c || branchesOf(r.u)[0] === c))
    return { c, list, ...sum(list) }
  }).filter((x) => x.list.length).sort((a, b) => (b.total ? 1 : 0) - (a.total ? 1 : 0) || (b.pct ?? -1) - (a.pct ?? -1)), [rows]) // eslint-disable-line react-hooks/exhaustive-deps
  const bantu = rows.filter((r) => r.s.overdue.length >= 3 || (r.s.pct !== null && r.s.pct < 50 && r.s.active.length > 0))
    .sort((a, b) => b.s.overdue.length - a.s.overdue.length || (a.s.pct ?? 100) - (b.s.pct ?? 100)).slice(0, 6)
  const orang = rows.filter((r) => role === 'semua' || r.u.role === role).sort((a, b) => a.u.name.localeCompare(b.u.name))
  const toggle = () => setOpen((o) => { lsSet('atlas-fold-team', o ? '0' : '1'); return !o })
  const warna = (p) => (p === null ? 'text-ink-mute' : p >= 75 ? 'text-emerald-700' : p >= 50 ? 'text-amber-600' : 'text-rose-600')
  const bar = (p) => (p === null ? '#e2e8f0' : p >= 75 ? '#10b981' : p >= 50 ? '#fbbf24' : '#fb7185')
  const ping = async (r) => {
    const t = r.s.overdue[0] || r.s.active[0]
    if (!t) return
    try { await sendPing({ to_user: r.u.id, project: t.project, sub: t.sub, message: 'Performa hari ini — perlu dibantu?' }); notify(`Ping terkirim ke ${r.u.name}`) }
    catch (e) { notify(e.message || 'Gagal mengirim ping', 'err') }
  }
  if (!canSeeTeam(user)) return null
  const tampilCabang = semuaCabang ? cabang : cabang.slice(0, 5)
  return (
    <Card className="overflow-hidden" data-tim-v2>
      <div className="card-head flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
        <Users className="h-4 w-4 text-violet-600" />
        <h2 className="font-bold">Performa Tim Hari Ini</h2>
        <span className="ml-1 flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold" role="group" aria-label="Tampilan">
          {[['cabang', 'Per cabang'], ['orang', 'Per orang']].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setMode(k)} aria-pressed={mode === k} className={cx('min-h-[32px] rounded-md px-2.5', mode === k ? 'bg-white shadow-sm' : 'text-ink-soft')}>{l}</button>
          ))}
        </span>
        <span className="ml-auto text-xs text-ink-mute">{clock(now)} WITA</span>
        <button type="button" onClick={toggle} aria-expanded={open} aria-label={`${open ? 'Tutup' : 'Buka'} Performa Tim`} className="grid h-8 w-8 place-items-center rounded-lg bg-white text-ink-soft ring-1 ring-slate-200 hover:text-brand">
          <ChevronUp className={cx('h-4 w-4 transition-transform', !open && 'rotate-180')} />
        </button>
      </div>
      {open && <>
        <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4 sm:gap-3">
          <div className="rounded-xl bg-emerald-50 p-3"><p className="text-[11px] font-semibold text-emerald-700">Rata-rata</p><p className={cx('text-2xl font-extrabold', warna(all.pct))}>{all.pct === null ? '—' : `${all.pct}%`}</p></div>
          <div className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] font-semibold text-ink-soft">Tugas hari ini</p><p className="text-2xl font-extrabold text-ink">{all.done}<span className="text-sm font-semibold text-ink-mute"> / {all.total}</span></p></div>
          <div className="rounded-xl bg-rose-50 p-3"><p className="text-[11px] font-semibold text-rose-600">Utang lama</p><p className="text-2xl font-extrabold text-rose-600">{all.utang}</p></div>
          <div className="rounded-xl bg-amber-50 p-3"><p className="text-[11px] font-semibold text-amber-700">Perlu dibantu</p><p className="text-2xl font-extrabold text-amber-700">{bantu.length} orang</p></div>
        </div>

        {mode === 'cabang' ? (
          <div className="px-4 pb-2 text-[13px]">
            <div className="hidden grid-cols-[100px_1fr_56px_76px_120px] items-center gap-3 border-b border-slate-100 pb-2 text-[11px] font-bold uppercase tracking-wide text-ink-mute sm:grid"><span>Cabang</span><span>Target hari ini</span><span className="text-right">Selesai</span><span className="text-right">Utang lama</span><span className="text-right">Orang</span></div>
            {tampilCabang.map((x) => {
              const h = kehadiran(x.c)
              return (
                <div key={x.c} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 border-b border-slate-50 py-2.5 sm:grid-cols-[100px_1fr_56px_90px_120px]" data-tim-cabang={x.c}>
                  <b>{x.c}</b>
                  <div className="col-span-2 h-2.5 rounded-full bg-slate-100 sm:col-span-1 sm:row-auto" style={{ gridRow: 'auto' }}><div className="h-full rounded-full" style={{ width: `${x.pct ?? 0}%`, background: bar(x.pct) }} /></div>
                  <span className={cx('text-right font-bold tabular-nums max-sm:col-start-2 max-sm:row-start-1', warna(x.pct))}>{x.pct === null ? '—' : `${x.pct}%`}</span>
                  <span className={cx('hidden text-right tabular-nums sm:block', x.utang >= 5 && 'font-bold text-rose-600')}>{x.utang}</span>
                  <span className="hidden text-right text-ink-soft sm:block">{h ? `${h.masuk} masuk${h.libur ? ` · ${h.libur} libur` : ''}` : `${x.list.length} orang`}</span>
                </div>
              )
            })}
            {cabang.length > 5 && <button type="button" onClick={() => setSemuaCabang((v) => !v)} className="min-h-[40px] w-full text-left text-xs text-ink-mute">{semuaCabang ? 'Ringkas ▴' : `+${cabang.length - 5} cabang lain ▾`}</button>}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 border-y border-slate-100 px-4 py-2">
              <Select value={role} onChange={(e) => setRole(e.target.value)} className="!w-44 !py-1 text-xs" aria-label="Filter role">
                <option value="semua">Semua role</option>{roles.map((r) => <option key={r} value={r}>{ROLES[r]?.label ?? r}</option>)}
              </Select>
              <span className="ml-auto hidden text-[11px] text-ink-mute sm:inline">Urut nama, bukan peringkat</span>
            </div>
            <ul className="max-h-[400px] divide-y divide-slate-100 overflow-y-auto overscroll-contain">
              {orang.map(({ u, s }) => (
                <li key={u.id} className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-2.5 sm:grid-cols-[200px_1fr_auto]">
                  <p className="flex min-w-0 items-center gap-2 truncate text-sm font-semibold"><Avatar user={u} size={26} ring={false} />{u.name} <span className="text-[11px] font-normal text-ink-mute">· {placeOf(u)}</span></p>
                  <div className="hidden h-2.5 rounded-full bg-slate-100 sm:block"><div className="h-2.5 rounded-full" style={{ width: `${s.pct ?? 0}%`, background: bar(s.pct) }} /></div>
                  <p className="text-right text-xs tabular-nums">
                    {s.pct === null ? <span className="text-ink-mute">Tanpa deadline</span> : <><b className={warna(s.pct)}>{s.pct}%</b> · {s.done.length}/{s.total}</>}
                    {s.overdue.length > 0 && <span className="text-rose-600"> · {s.overdue.length} utang</span>}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}

        {bantu.length > 0 && (
          <div className="m-4 rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200 sm:p-4" data-tim-bantu>
            <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">⚠ Perlu dibantu sekarang</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {bantu.map((r) => {
                const t = r.s.overdue[0] || r.s.active[0]
                return (
                  <div key={r.u.id} className="flex min-w-0 items-center gap-2 rounded-lg bg-white p-2.5 text-[12.5px] ring-1 ring-amber-100">
                    <Avatar user={r.u} size={34} ring={false} />
                    <div className="min-w-0 flex-1"><p className="truncate font-bold">{r.u.name}</p><p className="truncate text-ink-soft">{r.s.overdue.length ? `${r.s.overdue.length} utang lama` : `${r.s.pct}% · ${r.s.active.length} sisa`} · {placeOf(r.u)}</p></div>
                    <button type="button" onClick={() => ping(r)} className="min-h-[36px] rounded-md bg-amber-100 px-2.5 text-[11px] font-bold text-amber-800 hover:bg-amber-200">Ping</button>
                    {t && <button type="button" onClick={() => go(`projects/${t.project.id}`)} title="Buka tugasnya untuk dioper ke orang lain" className="min-h-[36px] rounded-md bg-white px-2.5 text-[11px] font-bold text-amber-800 ring-1 ring-amber-200 hover:bg-amber-50">Oper</button>}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </>}
    </Card>
  )
}
