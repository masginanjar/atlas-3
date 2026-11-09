// ============================================================
//  URGENSI & STEPPER — pembantu tampilan daftar/tabel Project.
//  Grup tenggat, warna garis urgensi, hitung mundur, umur project,
//  dan posisi tahap (untuk stepper). Tidak mengubah data apa pun.
// ============================================================
import { DONE, stagesOf, flowOf, isDone } from '../config/workflows.js'
import { daysLeft } from './format.js'

export const GRUP = [
  ['terlambat', 'Terlambat', 'text-rose-700 bg-rose-50 border-rose-200'],
  ['hariini', 'Hari ini', 'text-orange-700 bg-orange-50 border-orange-200'],
  ['besok', 'Besok', 'text-amber-800 bg-amber-50 border-amber-200'],
  ['minggu', 'Minggu ini', 'text-ink bg-slate-100 border-slate-200'],
  ['nanti', 'Nanti', 'text-ink-soft bg-slate-50 border-slate-200'],
  ['tanpa', 'Tanpa deadline', 'text-ink-mute bg-slate-50 border-slate-200'],
  ['selesai', 'Selesai', 'text-emerald-700 bg-emerald-50 border-emerald-200'],
]
export const labelGrup = (k) => GRUP.find(([x]) => x === k)?.[1] || k
export const kelasGrup = (k) => GRUP.find(([x]) => x === k)?.[2] || ''

/** Kelompok tenggat satu project. */
export function grupOf(p) {
  if (isDone(p)) return 'selesai'
  const d = daysLeft(p.about?.deadline)
  if (d === null) return 'tanpa'
  if (d < 0) return 'terlambat'
  if (d === 0) return 'hariini'
  if (d === 1) return 'besok'
  if (d <= 7) return 'minggu'
  return 'nanti'
}

/** Warna garis urgensi di tepi kiri (kelas Tailwind border-l). */
export function garisUrgensi(p) {
  const g = grupOf(p)
  return g === 'terlambat' ? 'border-l-rose-500' : g === 'hariini' ? 'border-l-orange-500' : g === 'besok' ? 'border-l-amber-400' : 'border-l-transparent'
}

/** Project baru (< 24 jam sejak dibuat). */
export const baru = (p) => p.created_at && Date.now() - new Date(p.created_at).getTime() < 864e5

/** Umur project: "6 hr", "3 jam". */
export function umur(p) {
  if (!p.created_at) return ''
  const h = Math.floor((Date.now() - new Date(p.created_at).getTime()) / 36e5)
  return h < 1 ? 'baru saja' : h < 24 ? `${h} jam` : `${Math.floor(h / 24)} hr`
}

/** Hitung mundur untuk yang jatuh tempo hari ini: "sisa 6 j 40 m" / "lewat 2 j". */
export function sisaWaktu(p) {
  if (!p.about?.deadline || isDone(p)) return ''
  const ms = new Date(p.about.deadline).getTime() - Date.now()
  if (Number.isNaN(ms) || Math.abs(ms) > 864e5) return ''
  const m = Math.round(Math.abs(ms) / 6e4); const j = Math.floor(m / 60); const mn = m % 60
  const t = j ? `${j} j${mn ? ` ${mn} m` : ''}` : `${mn} m`
  return ms >= 0 ? `sisa ${t}` : `lewat ${t}`
}
/** Porsi waktu SLA yang sudah terpakai (0–1) dari created_at → deadline. */
export function porsiSla(p) {
  if (!p.about?.deadline || !p.created_at) return null
  const a = new Date(p.created_at).getTime(), b = new Date(p.about.deadline).getTime()
  if (!(b > a)) return 1
  return Math.max(0, Math.min(1, (Date.now() - a) / (b - a)))
}

/** Posisi tahap sub project pertama yang masih berjalan: { total, idx, macet }. */
export function posisiTahap(p) {
  const subs = (p.sub_projects || []).filter((x) => x.stage !== DONE)
  if (!subs.length) return { total: 1, idx: 1, selesai: true }
  // ambil sub yang paling tertinggal (indeks terkecil) supaya stepper jujur
  let best = null
  for (const x of subs) {
    const st = stagesOf(flowOf(x, p)); const i = Math.max(0, st.findIndex((s) => s.key === x.stage))
    if (!best || i / Math.max(1, st.length) < best.idx / Math.max(1, best.total)) best = { total: st.length || 1, idx: i, at: x.stage_at }
  }
  const umurTahap = best.at ? (Date.now() - new Date(best.at).getTime()) / 864e5 : 0
  return { ...best, hariDiam: Math.floor(umurTahap), macet: grupOf(p) === 'terlambat' || umurTahap >= 3 }
}

/** Kelompokkan daftar menurut grup tenggat, urutan tetap seperti daftar asal. */
export function kelompokkan(list) {
  const m = new Map()
  for (const p of list) { const g = grupOf(p); if (!m.has(g)) m.set(g, []); m.get(g).push(p) }
  return GRUP.map(([k]) => k).filter((k) => m.has(k)).map((k) => ({ key: k, label: labelGrup(k), rows: m.get(k) }))
}
