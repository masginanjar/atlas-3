import { useEffect, useRef, useState } from 'react'
import { TreeDeciduous, Droplet, Flame, Zap, ChevronDown, Check } from 'lucide-react'
import { PRIORITIES } from '../config/priority.js'
import { cx } from './ui.jsx'

// 1 ikon per prioritas — Normal: pohon · Ekspres: tetes air · Super Ekspres: api · Sameday: petir hitam
export const PRIORITY_META = {
  Normal: { icons: [TreeDeciduous], cls: 'bg-slate-100 text-ink-soft ring-slate-200', icon: 'text-ink-mute', on: 'bg-slate-50 ring-slate-300' },
  Ekspres: { icons: [Droplet], cls: 'bg-amber-50 text-amber-700 ring-amber-200', icon: 'text-amber-600', on: 'bg-amber-50 ring-amber-300' },
  'Super Ekspres': { icons: [Flame], cls: 'bg-orange-50 text-orange-700 ring-orange-200', icon: 'text-orange-600', on: 'bg-orange-50 ring-orange-300' },
  Sameday: { icons: [Zap], cls: 'bg-rose-50 text-rose-700 ring-rose-300', icon: 'text-rose-600', on: 'bg-rose-50 ring-rose-400' },
}
const meta = (p) => PRIORITY_META[({ Tinggi: 'Super Ekspres', Speed: 'Ekspres', 'Super Speed': 'Super Ekspres' })[p] || p] ?? PRIORITY_META.Normal

function Icons({ p, size = 'h-3.5 w-3.5' }) {
  return <span className="inline-flex -space-x-1">{meta(p).icons.map((I, i) => <I key={i} className={size} fill={I === Flame || I === Zap || I === Droplet ? 'currentColor' : 'none'} />)}</span>
}

/** Badge prioritas. Normal: tanpa ikon & tanpa badge (hanya teks kecil). Ekspres / Super Ekspres: ikon + teks.
 *  Sameday: ikon + teks dengan animasi kedip merah–hitam (urgent). iconOnly tetap menampilkan teks agar prioritas selalu terbaca. */
export function PriorityBadge({ p = 'Normal', iconOnly, className }) {
  const label = ({ Tinggi: 'Super Ekspres', Speed: 'Ekspres', 'Super Speed': 'Super Ekspres' })[p] || p || 'Normal'
  if (label === 'Normal') return <span title="Prioritas Normal" className={cx('inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-ink-mute', className)}>Normal</span>
  return (
    <span title={label} className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full font-bold ring-1', iconOnly ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]', meta(p).cls, className)}>
      <Icons p={p} size={iconOnly ? 'h-3 w-3' : 'h-3.5 w-3.5'} />{label}
    </span>
  )
}

/** Pilihan prioritas berbentuk tombol dengan ikon. */
export function PriorityPicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-4 gap-1" role="radiogroup" aria-label="Prioritas">
      {PRIORITIES.map((p) => {
        const active = value === p
        return (
          <button key={p} type="button" role="radio" aria-checked={active} onClick={() => onChange(p)}
            title={p} aria-label={p}
            className={cx('flex h-[38px] items-center justify-center gap-1 whitespace-nowrap rounded-lg px-1 text-[11px] ring-1 transition',
              active ? cx(meta(p).on, 'font-semibold text-ink') : 'font-medium text-ink-mute ring-slate-200 hover:text-ink')}>
            <span className={meta(p).icon}><Icons p={p} /></span><span className="hidden xl:inline">{p}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Dropdown prioritas: ikon + warna, setinggi input lain. */
export function PrioritySelect({ value = 'Normal', onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])
  const m = meta(value)
  return (
    <div ref={ref} className="relative" title="Prioritas">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} aria-label={`Prioritas: ${value}`}
        className={cx('flex h-[38px] w-full items-center gap-2 rounded-lg px-2.5 text-sm font-semibold ring-1 transition', m.cls)}>
        <Icons p={value} /><span className="flex-1 truncate text-left">{value}</span><ChevronDown className={cx('h-4 w-4 opacity-70 transition', open && 'rotate-180')} />
      </button>
      {open && (
        <ul role="listbox" className="absolute z-20 mt-1 w-full min-w-[160px] rounded-xl bg-white p-1 shadow-xl ring-1 ring-slate-200">
          {PRIORITIES.map((p) => (
            <li key={p}>
              <button type="button" role="option" aria-selected={p === value} onClick={() => { onChange(p); setOpen(false) }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-50">
                <span className={cx('grid h-7 w-9 place-items-center rounded-md ring-1', meta(p).cls)}><Icons p={p} /></span>
                <span className="flex-1 font-medium">{p}</span>{p === value && <Check className="h-4 w-4 text-brand" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
