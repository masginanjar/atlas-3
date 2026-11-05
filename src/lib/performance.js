// ============================================================
//  PERFORMA HARI INI — progres penyelesaian tugas harian per pengguna.
//  Tugas = sub project yang memuat tahap milik pengguna (sesuai role & alur).
//  Bukan penilaian kualitas / produktivitas — hanya progres harian.
// ============================================================
import { stagesOf, stageIndex, flowOf, DONE } from '../config/workflows.js'
import { activeClaim, branchesOf } from '../config/access.js'

/** Zona waktu operasional aplikasi (kantor pusat Bali). */
export const APP_TZ = 'Asia/Makassar'
const TZ_OFFSET = '+08:00'
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: APP_TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
const timeFmt = new Intl.DateTimeFormat('id-ID', { timeZone: APP_TZ, hour: '2-digit', minute: '2-digit' })
/** Tanggal (YYYY-MM-DD) di zona waktu operasional. */
export const dayKey = (date = new Date()) => dayFmt.format(date)
export const clock = (date = new Date()) => timeFmt.format(date).replace('.', ':')
export const addDays = (key, n) => dayKey(new Date(new Date(`${key}T12:00:00${TZ_OFFSET}`).getTime() + n * 864e5))
export const DEFAULT_DEADLINE_TIME = '17:00'

/** Hari & jam deadline project. Jam = about.deadline_time (default 17:00 jam kerja). */
export function deadlineOf(project) {
  const raw = project?.about?.deadline
  if (!raw) return null
  const day = String(raw).length <= 10 ? String(raw) : dayKey(new Date(raw))
  const time = project.about?.deadline_time || DEFAULT_DEADLINE_TIME
  return { day, time, at: new Date(`${day}T${time}:00${TZ_OFFSET}`) }
}

// Tahap yang dimiliki role pimpinan tertentu
const LEAD = { pilih_penerjemah: 'supervisor', persetujuan: 'direktur', pembayaran: 'akunting', dibayar: 'akunting', registrasi: 'admin_pusat' }

/** Apakah tahap ini tanggung jawab user? past = tahap sudah dilewati. */
export function ownsStage(u, st, sub, project, past) {
  // Admin Kantor Pusat (staf): tahap CS yang benar-benar ia proses ikut dihitung sebagai tugasnya
  if (u.role === 'admin_pusat' && past && !LEAD[st.key] && !st.assignee && !st.claimable
    && (sub.history || []).some((h) => h.by === u.name && String(h.action || '').startsWith(st.label))) return true
  return ownsStageBase(u, st, sub, project, past)
}
function ownsStageBase(u, st, sub, project, past) {
  if (LEAD[st.key]) return u.role === LEAD[st.key]
  if (st.assignee) return !!sub.data?.[st.assignee] && sub.data[st.assignee] === u.id
  if (st.claimable) {
    if (past) return sub.data?.authorized_by === u.id
    const c = activeClaim(sub)
    return u.role === 'otorisator' && (!c || c.by === u.id)
  }
  if (['pengajuan', 'order', 'proses_vendor'].includes(st.key)) {
    if (sub.data?.coordinator) return sub.data.coordinator === u.id
    if (past && sub.data?.submitted_by) return sub.data.submitted_by === u.id
    return u.id === project.created_by || sameBranchCS(u, project, past)
  }
  if (st.printBranch) {
    const loc = project.about?.print_location || project.branch
    if (loc === project.branch) return u.id === project.created_by
    // Titipan print dari cabang lain → masuk performa staf cabang lokasi print.
    // Setelah dikerjakan, dihitung untuk staf yang benar-benar mengerjakannya.
    const by = sub.data?.[`${st.key}_by`]
    if (past && by) return by === u.id
    return ['cs', 'supervisor'].includes(u.role) && branchesOf(u).includes(loc)
  }
  // Tahap CS lainnya: sudah lewat → CS yang benar-benar memprosesnya (atau pembuat project);
  // sedang berjalan → CS pembuat project ATAU CS cabang yang sama (selaras dengan To-Do List).
  if (past) { const by = sub.data?.[`${st.key}_by`]; if (by) return by === u.id }
  return u.id === project.created_by || sameBranchCS(u, project, past)
}
/** CS cabang yang sama ikut memiliki tahap CS yang sedang berjalan (tugas tim cabang). */
const sameBranchCS = (u, project, past) => !past && u.role === 'cs' && branchesOf(u).includes(project.branch)

/**
 * Status sebuah sub project bagi user:
 *  done     — semua kewajiban user di sub ini selesai (walau sub masih jalan di role lain)
 *  active   — tahap saat ini adalah tahap user (perlu dikerjakan)
 *  waiting  — giliran role lain (mis. menunggu persetujuan); tidak mengurangi performa
 *  null     — bukan tugas user / dibatalkan
 */
export function taskStatus(u, sub, project) {
  if (sub.cancelled || project.cancelled) return null
  if (sub.data?.demo_owner && sub.data.demo_owner !== u.id) return null // tugas contoh: hanya pemiliknya
  const flow = flowOf(sub, project)
  const stages = stagesOf(flow)
  const cur = stageIndex(flow, sub.stage)
  const mine = stages.map((st, i) => ({ st, i })).filter(({ st, i }) => ownsStage(u, st, sub, project, i < cur || sub.stage === DONE))
  if (!mine.length) return null
  const remaining = mine.filter((m) => m.i >= cur)
  if (!remaining.length) return { status: 'done', stage: null }
  const now = remaining.find((m) => m.i === cur)
  if (now) return { status: 'active', stage: now.st }
  return { status: 'waiting', stage: stages[cur] ?? null }
}

/** Semua tugas user (dengan deadline) dari data project. */
export function tasksOf(u, projects) {
  const out = []
  for (const p of projects) {
    const dl = deadlineOf(p)
    if (!dl) continue
    for (const s of p.sub_projects || []) {
      const t = taskStatus(u, s, p)
      if (t) out.push({ ...t, sub: s, project: p, flow: flowOf(s, p), dl })
    }
  }
  return out
}

/** Sub project ini titipan print dari cabang lain untuk user? */
export const isIncomingPrint = (u, project) => {
  const loc = project.about?.print_location
  return !!loc && loc !== project.branch && branchesOf(u).includes(loc) && !branchesOf(u).includes(project.branch)
}

/** Ringkasan performa user untuk satu hari. */
export function summarize(u, projects, day = dayKey(), now = new Date()) {
  const all = tasksOf(u, projects)
  const today = all.filter((t) => t.dl.day === day)
  const isToday = day === dayKey(now)
  const done = today.filter((t) => t.status === 'done')
  // Hari ini: semua tugas aktif yang masih di tangan user ikut dihitung (deadline hari ini, terlambat, maupun mendatang),
  // sehingga performa tidak 100% selama masih ada pekerjaan yang belum diselesaikan.
  const active = (isToday ? all : today).filter((t) => t.status === 'active' && (isToday ? t.dl.day >= day : true))
  const waiting = today.filter((t) => t.status === 'waiting')
  const overdue = isToday ? all.filter((t) => t.dl.day < day && t.status === 'active') : []
  const total = done.length + active.length + overdue.length
  const pct = total ? Math.round((done.length / total) * 100) : null
  const sortT = (a, b) => a.dl.at - b.dl.at || prio(b.project) - prio(a.project)
  active.sort(sortT); overdue.sort(sortT)
  const late = (t) => t.dl.at < now
  const titipan = [...done, ...active].filter((t) => isIncomingPrint(u, t.project)).length
  return { day, done, active, waiting, overdue, total, pct, late, titipan,
    next: [...overdue, ...active][0] ?? null,
    top: [...active].sort((a, b) => Number(late(b)) - Number(late(a)) || sortT(a, b)).slice(0, 3) }
}
const PR = { Normal: 0, Ekspres: 1, 'Super Ekspres': 2, Sameday: 3 }
const prio = (p) => PR[p.about?.priority] ?? 0

/** Pita warna & pesan motivasi. */
export function band(pct) {
  if (pct === null) return { key: 'none', label: 'Belum ada deadline', msg: 'Belum ada deadline hari ini. Saatnya bersiap untuk tugas berikutnya!', stroke: '#a5b4fc', bg: 'bg-indigo-50', ring: 'ring-indigo-200', text: 'text-indigo-700' }
  if (pct >= 100) return { key: 'mint', label: 'Tuntas', msg: 'Hebat, semua tugas hari ini selesai! Pertahankan kerja baikmu 🎉', stroke: '#34d399', bg: 'bg-emerald-50', ring: 'ring-emerald-200', text: 'text-emerald-700' }
  if (pct >= 80) return { key: 'blue', label: 'Hampir tercapai', msg: 'Sedikit lagi! Target hari ini hampir tercapai 🚀', stroke: '#38bdf8', bg: 'bg-sky-50', ring: 'ring-sky-200', text: 'text-sky-700' }
  if (pct >= 50) return { key: 'yellow', label: 'Lebih dari separuh', msg: 'Sudah lebih dari separuh! Yuk, lanjutkan langkah baikmu ✨', stroke: '#fbbf24', bg: 'bg-amber-50', ring: 'ring-amber-200', text: 'text-amber-800' }
  return { key: 'peach', label: 'Ayo mulai', msg: 'Ayo, semangat! Mulai dari satu tugas terdekat. Kamu pasti bisa 🌱', stroke: '#fdba74', bg: 'bg-orange-50', ring: 'ring-orange-200', text: 'text-orange-700' }
}

/** Role yang punya tugas harian pribadi (pimpinan murni tidak). */
export const hasPersonalTasks = (u) => u?.role !== 'superadmin'
/** Pimpinan yang boleh melihat ringkasan tim. */
export const canSeeTeam = (u) => ['superadmin', 'direktur', 'supervisor', 'akunting'].includes(u?.role)
