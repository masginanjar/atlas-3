import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Loader2, AlertCircle, ChevronUp } from 'lucide-react'
import { CATEGORIES, TONES } from '../config/workflows.js'

export const cx = (...a) => a.filter(Boolean).join(' ')

export function Button({ variant = 'primary', size = 'md', loading, className, children, ...p }) {
  const v = {
    primary: 'bg-gradient-to-r from-brand to-[#6d5cf6] text-white shadow-glow hover:from-brand-dark hover:to-brand active:translate-y-px',
    dark: 'bg-ink text-white shadow-sm hover:bg-ink-soft active:translate-y-px',
    ghost: 'bg-transparent text-ink-soft hover:bg-slate-100',
    outline: 'bg-white text-ink ring-1 ring-slate-300 hover:bg-slate-50 hover:ring-slate-400 active:translate-y-px',
    danger: 'bg-white text-rose-600 ring-1 ring-rose-300 hover:bg-rose-50 active:translate-y-px',
  }[variant]
  const s = { sm: 'h-8 px-3 text-xs', md: 'h-10 px-4 text-[13px]', lg: 'h-11 px-5 text-sm' }[size]
  return (
    <button {...p} disabled={p.disabled || loading}
      className={cx('inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50', v, s, className)}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}{children}
    </button>
  )
}

export const Card = ({ className, ...p }) => <div {...p} className={cx('rounded-2xl bg-white/95 shadow-card ring-1 ring-slate-200/60 backdrop-blur-sm', className)} />

export function CatBadge({ cat, className }) {
  const c = CATEGORIES[cat]
  return <span className={cx('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1', TONES[c?.tone], className)}>{c?.short ?? cat}</span>
}

export const Pill = ({ className, children }) => <span className={cx('inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-ink-soft', className)}>{children}</span>

export function Field({ label, hint, required, children, className, icon: Icon, error }) {
  return (
    <label className={cx('block', className)}>
      <span data-field-label className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-ink-soft">
        {Icon && <Icon className="h-3.5 w-3.5 text-ink-mute" />}{label}{required && <span className="text-rose-500" aria-hidden>*</span>}
      </span>
      {children}
      {error ? <FieldError>{error}</FieldError> : hint && <span data-hint className="mt-1 block text-xs text-ink-mute">{hint}</span>}
    </label>
  )
}

/** Pesan error: ikon + teks (tidak hanya warna). */
export function FieldError({ children, className }) {
  return <span role="alert" className={cx('mt-1.5 flex items-center gap-1 text-xs font-medium text-rose-600', className)}><AlertCircle className="h-3.5 w-3.5 shrink-0" />{children}</span>
}

// Kartu seksi pastel: setiap seksi punya warna sendiri + aksen tegas
export const TONE_CARD = {
  lavender: { card: 'bg-gradient-to-br from-violet-50 to-white ring-violet-200/70', chip: 'bg-gradient-to-br from-violet-500 to-fuchsia-500', title: 'text-violet-900' },
  sky: { card: 'bg-gradient-to-br from-sky-50 to-white ring-sky-200/70', chip: 'bg-gradient-to-br from-sky-500 to-indigo-500', title: 'text-sky-900' },
  peach: { card: 'bg-gradient-to-br from-orange-50 to-white ring-orange-200/70', chip: 'bg-gradient-to-br from-orange-400 to-rose-500', title: 'text-orange-900' },
  mint: { card: 'bg-gradient-to-br from-emerald-50 to-white ring-emerald-200/70', chip: 'bg-gradient-to-br from-emerald-500 to-teal-500', title: 'text-emerald-900' },
  aqua: { card: 'bg-gradient-to-br from-cyan-50 to-white ring-cyan-200/70', chip: 'bg-gradient-to-br from-cyan-500 to-sky-500', title: 'text-cyan-900' },
}
/** foldKey = seksi bisa di-minimize (tersimpan per perangkat); summary = ringkasan saat tertutup. */
export function SectionCard({ tone = 'sky', icon: Icon, title, aside, children, className, foldKey, summary, defaultOpen = true }) {
  const t = TONE_CARD[tone]
  const k = foldKey && `atlas-fold-sec-${foldKey}`
  const [open, setOpen] = useState(() => { if (!k) return true; try { const v = localStorage.getItem(k); return v === null ? defaultOpen : v !== '0' } catch { return defaultOpen } })
  const toggle = () => setOpen((o) => { try { localStorage.setItem(k, o ? '0' : '1') } catch { /* abaikan */ } return !o })
  return (
    <section className={cx('min-w-0 rounded-2xl p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_6px_20px_-10px_rgba(15,23,42,0.12)] ring-1 sm:p-6', t.card, className)}>
      <div className={cx('flex items-center gap-2.5', open && 'mb-4 sm:mb-5')}>
        {Icon && <span className={cx('grid h-8 w-8 shrink-0 place-items-center rounded-xl text-white shadow-sm', t.chip)}><Icon className="h-4 w-4" /></span>}
        <div className="min-w-0 flex-1">
          <h4 className={cx('truncate text-[15px] font-bold', t.title)} title={typeof title === 'string' ? title : undefined}>{title}</h4>
          {!open && summary && <p className="truncate text-xs text-ink-soft">{summary}</p>}
        </div>
        {/* keterangan sumber (mis. "Zoho Books") disembunyikan di HP agar judul tidak terdesak */}
        {aside && <span className="ml-auto hidden shrink-0 text-xs font-medium text-ink-mute sm:inline">{aside}</span>}
        {k && <button type="button" onClick={toggle} aria-expanded={open} aria-label={`${open ? 'Tutup' : 'Buka'} ${title}`} title={open ? 'Minimize' : 'Buka'}
          className={cx('grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/80 text-ink-soft ring-1 ring-slate-200 hover:text-brand hover:ring-brand', !aside && 'ml-auto')}>
          <ChevronUp className={cx('h-4 w-4 transition-transform', !open && 'rotate-180')} />
        </button>}
      </div>
      {open && children}
    </section>
  )
}
const inputCls = 'w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-ink ring-1 ring-slate-300 placeholder:text-slate-400 transition hover:ring-slate-400 focus:outline-none focus:ring-2 focus:ring-brand disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-ink-mute aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-rose-500'
export const Input = (p) => <input {...p} className={cx(inputCls, p.className)} />
export const Textarea = (p) => <textarea rows={3} {...p} className={cx(inputCls, p.className)} />
export const Select = ({ children, ...p }) => <select {...p} className={cx(inputCls, 'pr-8', p.className)}>{children}</select>

/**
 * Panel. `side` = panel geser dari kanan (panel kerja, tabel tetap terlihat di belakang);
 * tanpa `side` = modal di tengah (untuk keputusan/form yang butuh fokus).
 */
export function Sheet({ open, onClose, title, subtitle, children, footer, wide, xwide, tinted, side }) {
  // Sisi panel mengikuti preferensi pengguna (Tema → Panel detail muncul dari)
  const fromLeft = side && typeof document !== 'undefined' && document.documentElement.dataset.panel === 'left'
  useEffect(() => {
    if (!open) return
    const k = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    if (!side) document.body.style.overflow = 'hidden' // panel samping: tabel di belakang tetap bisa digulir & dibaca
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = '' }
  }, [open, onClose, side])
  if (!open) return null
  // Dirender ke <body> (portal) agar tidak terkurung kartu/segmen ber-backdrop-blur atau overflow-hidden.
  return createPortal(
    <div className={cx('fixed inset-0 z-[80] flex',
      // panel samping: mulai di bawah bar atas & tidak menghalangi klik, jadi header dan tabel di belakang tetap bisa dipakai
      // panel samping dari kanan berhenti di sebelah KIRI toolbar tegak,
      // supaya toolbar tetap terlihat dan bisa dipakai mengganti panel
      side ? cx('pointer-events-none pt-[var(--appbar)]', fromLeft ? 'justify-start' : 'justify-end pr-[var(--railw)]') : 'items-end justify-center bg-ink/40 backdrop-blur-[2px] sm:items-center sm:p-4')}
      onClick={side ? undefined : onClose}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal={side ? undefined : 'true'} aria-label={title}
        className={cx('pointer-events-auto flex w-full flex-col bg-white shadow-2xl',
          side ? cx('h-full max-w-full', fromLeft ? 'animate-[atlas-slide-in-left_.18s_ease-out]' : 'animate-[atlas-slide-in_.18s_ease-out]', wide || xwide ? 'sm:max-w-[min(780px,94vw)]' : 'sm:max-w-[min(560px,92vw)]')
            : cx('max-h-[94vh] rounded-t-3xl sm:rounded-3xl', xwide ? 'sm:max-w-4xl' : wide ? 'sm:max-w-2xl' : 'sm:max-w-md'))}>
        <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-5 py-3.5">
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-bold text-ink">{title}</h3>
            {subtitle && <p className="truncate text-xs text-ink-mute">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="shrink-0 rounded-lg p-1.5 text-ink-mute hover:bg-slate-100" aria-label="Tutup"><X className="h-5 w-5" /></button>
        </div>
        <div className={cx('flex-1 overflow-y-auto', tinted ? 'bg-slate-50 px-4 py-6 sm:px-6' : 'px-5 py-4')}>{children}</div>
        {footer && <div className="flex gap-2 border-t border-slate-100 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}

export function Empty({ icon: Icon, title, text, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {Icon && <div className="mb-3 rounded-2xl bg-brand-soft p-3 text-brand"><Icon className="h-6 w-6" /></div>}
      <p className="font-semibold text-ink">{title}</p>
      {text && <p className="mt-1 max-w-xs text-sm text-ink-mute">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Progress({ value }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={cx('h-full rounded-full transition-[width]', value >= 100 ? 'bg-gradient-to-r from-emerald-400 to-teal-500' : 'bg-gradient-to-r from-brand via-[#7c6cf7] to-accent')} style={{ width: `${value}%` }} />
    </div>
  )
}

/** Satu toast saja dalam satu waktu, tidak menumpuk, bisa ditutup, tanpa suara. */
/** Baris tabel yang bisa diklik juga bisa dibuka lewat keyboard (Tab lalu Enter/Spasi). */
export const bisaDitekan = (fn) => ({
  tabIndex: 0,
  onKeyDown: (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); fn() } },
})

export function Toast({ toast, onClose }) {
  if (!toast) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 md:bottom-6" role="status" aria-live="polite">
      <div key={toast.k} className={cx('pointer-events-auto flex max-w-[92vw] items-center gap-2 rounded-xl py-2.5 pl-4 pr-2 text-sm font-semibold text-white shadow-lg ring-1 ring-white/10 animate-[toast-in_.18s_ease-out]', toast.tone === 'err' ? 'bg-rose-600' : 'bg-ink')}>
        <span className="min-w-0 truncate">{toast.msg}</span>
        <button type="button" onClick={onClose} aria-label="Tutup notifikasi" className="grid h-6 w-6 shrink-0 place-items-center rounded-lg text-white/70 transition hover:bg-white/15 hover:text-white"><X className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  )
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="-mx-3 overflow-x-auto px-3 sm:-mx-4 sm:px-4 md:mx-0 md:px-0 [scrollbar-width:none]">
      <div className="flex w-max gap-1.5">
        {tabs.map((t) => (
          <button key={t.value} onClick={() => onChange(t.value)}
            className={cx('whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition',
              value === t.value ? 'bg-[var(--surface-3)] text-ink ring-1 ring-[var(--line)]' : 'bg-white text-ink-mute ring-1 ring-slate-200 hover:text-ink')}>
            {t.label}{t.count !== undefined && <span className="ml-1.5 text-ink-mute">{t.count}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Field ringkas: ikon di kiri sebagai pengganti label (label muncul sebagai tooltip). */
export function IconField({ icon: Icon, title, required, className, children }) {
  return (
    <label title={title} className={cx('relative block', className)}>
      <span className="sr-only">{title}</span>
      <Icon className={cx('pointer-events-none absolute left-2.5 top-1/2 z-[1] h-4 w-4 -translate-y-1/2', required ? 'text-brand' : 'text-ink-mute')} />
      <div className="[&_input]:pl-8 [&_select]:pl-8">{children}</div>
    </label>
  )
}

/**
 * Popover kecil untuk pilihan sederhana (pengaturan kolom, tampilan tersimpan, tema).
 * Bukan untuk formulir panjang — gunakan Sheet untuk itu.
 */
export function Popover({ button, children, align = 'right', label, width = 'min-w-[240px]', panelClass = '' }) {
  const [open, setOpen] = useState(false)
  const box = useRef(null)
  useEffect(() => {
    if (!open) return
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false) }
    const esc = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', away); window.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', away); window.removeEventListener('keydown', esc) }
  }, [open])
  return (
    <div className="relative" ref={box}>
      {button({ open, toggle: () => setOpen((v) => !v) })}
      {open && (
        <div role="dialog" aria-label={label} className={cx('absolute top-[calc(100%+6px)] z-50 rounded-2xl bg-white p-3 shadow-card ring-1 ring-slate-200', width, align === 'right' ? 'right-0' : 'left-0', panelClass)}>
          {children({ close: () => setOpen(false) })}
        </div>
      )}
    </div>
  )
}
