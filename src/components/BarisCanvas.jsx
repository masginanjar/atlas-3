// ============================================================
//  SEL DAFTAR PROJECT — desain CANVAS ATLAS ("Project").
//  Aturan warna: dibuat < 1 hari hijau muda · deadline hari ini merah,
//  besok oranye, terlambat merah muda · prioritas Sameday hitam,
//  Super Ekspres merah muda, Ekspres kuning muda, Normal abu.
// ============================================================
import { Zap, Flame, Droplet, Clock3, Printer } from 'lucide-react'
import { useNow } from './TimeAgo.jsx'
import { relTime } from '../lib/format.js'
import { dayKey } from '../lib/performance.js'
import { isDone } from '../config/workflows.js'
import { SUB_TYPES } from '../config/subtypes.js'
import { cx } from './ui.jsx'

export const PRIO_WARNA = {
  Sameday: { bg: '#141B34', fg: '#FFFFFF', Ikon: Zap },
  'Super Ekspres': { bg: '#FFD9E2', fg: '#A3123E', Ikon: Flame },
  Ekspres: { bg: '#FFF3C4', fg: '#6B4E00', Ikon: Droplet },
  Normal: { bg: '#EEF0F5', fg: '#4A4F6A' },
}
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const keyWita = (d) => new Date(new Date(d).getTime() + 8 * 3600e3).toISOString().slice(0, 10)

/** Selisih hari kalender (WITA) antara hari ini dan tenggat. */
export function selisihHari(deadline) {
  if (!deadline) return null
  const a = new Date(dayKey()), b = new Date(String(deadline).length <= 10 ? deadline : keyWita(deadline))
  return Math.round((b - a) / 864e5)
}
export function infoDeadline(p) {
  const dl = p.about?.deadline
  if (!dl) return null
  const s = selisihHari(dl)
  const d = new Date(dl)
  const jam = String(dl).length > 10 ? new Date(d.getTime() + 8 * 3600e3).toISOString().slice(11, 16).replace(':', '.') : ''
  const k = String(dl).length > 10 ? keyWita(dl) : String(dl).slice(0, 10)
  const tgl = `${Number(k.slice(8, 10))} ${BLN[Number(k.slice(5, 7)) - 1]}${jam && jam !== '00.00' ? ` ${jam}` : ''}`
  if (isDone(p)) return { tgl, bg: '#EEF0F5', fg: '#4A4F6A', teks: '#5E6380', sisa: 'Selesai' }
  if (s < 0) return { tgl, bg: '#FFD9E2', fg: '#A3123E', teks: '#A3123E', sisa: `Terlambat ${-s} hari` }
  if (s === 0) return { tgl, bg: '#C62828', fg: '#FFFFFF', teks: '#B71C1C', sisa: 'Hari ini' }
  if (s === 1) return { tgl, bg: '#FB923C', fg: '#141B34', teks: '#9A3A06', sisa: 'Besok' }
  return { tgl, bg: '#EEF0F5', fg: '#4A4F6A', teks: '#5E6380', sisa: `${s} hari lagi` }
}
export const dibuatBaru = (p) => !!p.created_at && Date.now() - new Date(p.created_at).getTime() < 864e5

/** Waktu dibuat: "… menit lalu" (hijau tebal) bila < 1 hari, selain itu "Sen 9 Nov 17.44". */
export function WaktuDibuat({ p, className }) {
  const now = useNow()
  if (!p.created_at) return null
  const b = dibuatBaru(p)
  const d = new Date(new Date(p.created_at).getTime() + 8 * 3600e3)
  const teks = b ? relTime(p.created_at, now) : `${HARI[d.getUTCDay()]} ${d.getUTCDate()} ${BLN[d.getUTCMonth()]} ${String(d.getUTCHours()).padStart(2, '0')}.${String(d.getUTCMinutes()).padStart(2, '0')}`
  return (
    <span className={cx('flex items-center gap-1 whitespace-nowrap text-xs', b ? 'font-bold text-[#17693A]' : 'text-[#5E6380]', className)} data-dibuat={b ? 'baru' : 'lama'}>
      <Clock3 className="h-[13px] w-[13px] shrink-0" aria-hidden="true" />{teks}
    </span>
  )
}

export function PrioPill({ p }) {
  const k = PRIO_WARNA[p] ? p : 'Normal'
  const w = PRIO_WARNA[k]
  return (
    <span className="inline-flex min-h-[26px] max-w-full items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-full px-2.5 text-xs font-bold" style={{ background: w.bg, color: w.fg }} data-prio={k}>
      {w.Ikon && <w.Ikon className="h-[13px] w-[13px] shrink-0" fill="currentColor" aria-hidden="true" />}{k}
    </span>
  )
}

export function DeadlinePill({ p, kecil }) {
  const i = infoDeadline(p)
  if (!i) return <span className="text-xs text-[#5E6380]">—</span>
  return (
    <span className="flex flex-col items-start gap-[3px]" data-deadline>
      <span className={cx('inline-flex items-center whitespace-nowrap rounded-full font-bold', kecil ? 'min-h-[22px] px-2 text-xs' : 'min-h-[26px] px-3 text-[13px]')} style={{ background: i.bg, color: i.fg }}>{i.tgl}</span>
      {!kecil && <span className="whitespace-nowrap text-xs font-semibold" style={{ color: i.teks }}>{i.sisa}</span>}
    </span>
  )
}

/** Arah bahasa / layanan utama project + siapa yang mengerjakan (penerjemah / vendor). */
export function eksekutorOf(p, ctx = {}) {
  const subs = p.sub_projects || []
  const tr = subs.find((x) => (x.type || '') === 'terjemahan' && x.lang_from && x.lang_to)
  const lay = tr ? `${tr.lang_from} → ${tr.lang_to}` : (SUB_TYPES[subs[0]?.type]?.label || '—')
  const nama = (id) => (ctx.users || []).find((u) => u.id === id)?.name?.replace(/\s*\(.*\)\s*$/, '')
  const vendor = (id) => (ctx.people || []).find((v) => v.id === id)?.name
  const orang = [...new Set(subs.map((x) => nama(x.data?.translator) || vendor(x.data?.vendor) || (x.translator_kind === 'vendor' ? 'Vendor' : '')).filter(Boolean))]
  return { lay: subs.length > 1 && !tr ? `${lay} +${subs.length - 1}` : lay, eks: orang.length ? orang.join(', ') : '—' }
}

export function CabangPrint({ p }) {
  const print = p.about?.print_location || p.branch
  const beda = print !== p.branch
  return (
    <span className="flex min-w-0 flex-col gap-[3px]">
      <span className="truncate text-sm leading-[26px]">{p.branch}</span>
      <span className="flex items-center gap-1 text-xs text-[#5E6380]" title={beda ? `Dicetak di ${print} (beda cabang)` : `Dicetak di ${print}`} data-print={beda ? 'beda' : 'sama'}>
        <Printer className="h-[13px] w-[13px] shrink-0" aria-hidden="true" /><span className={cx('truncate', beda && 'font-bold text-[#B43D0E]')}>{print}</span>
      </span>
    </span>
  )
}

/** Warna kategori sub (CANVAS ATLAS): TIM-TR abu · VEN-TR biru muda · Non Tersumpah kuning · TIM-AL hijau · VEN-AL pink. */
export function warnaKategori(sb) {
  const t = sb?.type || 'jasa_lain'
  const vendor = sb?.translator_kind === 'vendor' || sb?.executor_kind === 'vendor' || !!sb?.data?.vendor
  if (t === 'terjemahan') return vendor ? { bg: '#DFF1FB', fg: '#0B5C8A' } : { bg: '#EEF0F5', fg: '#4A4F6A' }
  if (t === 'terjemahan_nt') return { bg: '#FFF4D6', fg: '#7A5600' }
  if (t === 'apostille' || t === 'legalisasi') return vendor ? { bg: '#FFE4EE', fg: '#A3124F' } : { bg: '#E2F5E8', fg: '#17693A' }
  return { bg: '#EEF0F5', fg: '#4A4F6A' }
}

