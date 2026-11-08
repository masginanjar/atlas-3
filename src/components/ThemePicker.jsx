import { useEffect, useState } from 'react'
import { Palette, Sun, Moon, Check, RotateCcw } from 'lucide-react'
import { Popover, cx } from './ui.jsx'

// Tema disimpan per browser: { mode: 'light' | 'dark', accent: '#rrggbb' }
const KEY = 'atlas-theme'
const DEFAULT = { mode: 'light', accent: '#111827', panel: 'right' } // bawaan: monokrom (hitam–putih), panel detail dari kanan
export const ACCENTS = [
  ['#111827', 'Monokrom (bawaan)'], ['#475569', 'Abu'], ['#1e3a8a', 'Navy'], ['#2563eb', 'Biru'], ['#0284c7', 'Biru Langit'],
  ['#0d9488', 'Teal'], ['#059669', 'Hijau'], ['#16a34a', 'Hijau Daun'], ['#65a30d', 'Lime'], ['#ca8a04', 'Kuning'],
  ['#d97706', 'Oranye'], ['#ea580c', 'Oranye Tua'], ['#dc2626', 'Merah'], ['#be123c', 'Marun'], ['#db2777', 'Pink'],
  ['#9333ea', 'Ungu'], ['#4f46e5', 'Indigo'], ['#7c2d12', 'Cokelat'], ['#0f766e', 'Hijau Laut'], ['#334155', 'Arang'],
]

export const readTheme = () => { try { return { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch { return DEFAULT } }
/** Terang-gelapnya sebuah warna (0 = hitam, 1 = putih) — untuk menjaga keterbacaan. */
const luminance = (hex) => {
  const m = /^#?([\da-f]{6})$/i.exec(hex || ''); if (!m) return 0.3
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
/** Terapkan tema ke <html> — dipanggil saat aplikasi dibuka & setiap kali diubah. */
export function applyTheme(t) {
  const el = document.documentElement
  const dark = t.mode === 'dark'
  el.dataset.theme = dark ? 'dark' : 'light'
  // Di mode gelap aksen gelap (mis. monokrom hitam) dicerahkan agar teks & ikon tetap terbaca
  const lum = luminance(t.accent)
  // Permukaan beraksen (tombol) harus tetap kontras dengan teks putih; teks/ikon beraksen dicerahkan.
  const brand = dark && lum < 0.25 ? `color-mix(in srgb, ${t.accent} 35%, #94a3b8)` : t.accent
  el.style.setProperty('--brand', brand)
  el.style.setProperty('--brand-text', dark ? `color-mix(in srgb, ${t.accent} ${lum < 0.25 ? 20 : 55}%, white)` : t.accent)
  el.style.setProperty('--brand-soft', dark
    ? `color-mix(in srgb, ${t.accent} 30%, #1c2234)`
    : `color-mix(in srgb, ${t.accent} 8%, white)`)
  // Header (bar atas) ikut warna aksen; warna teks/ikonnya dipilih otomatis (putih di aksen gelap, gelap di aksen terang)
  const head = dark ? `color-mix(in srgb, ${t.accent} 55%, #0b1020)` : t.accent
  const headTerang = !dark && lum > 0.45
  const ink = headTerang ? '#0e1540' : '#ffffff'
  el.style.setProperty('--head', head)
  el.style.setProperty('--head-ink', ink)
  el.style.setProperty('--head-mute', `color-mix(in srgb, ${ink} 68%, ${head})`)
  el.style.setProperty('--head-line', `color-mix(in srgb, ${ink} 18%, ${head})`)
  el.style.setProperty('--head-hover', `color-mix(in srgb, ${ink} 12%, ${head})`)
  el.dataset.panel = t.panel === 'left' ? 'left' : 'right' // sisi panel detail
}
/** Sisi panel detail yang dipilih pengguna (dipakai komponen Sheet). */
export function panelSide() {
  try { return document.documentElement.dataset.panel === 'left' ? 'left' : 'right' } catch { return 'right' }
}

export default function ThemePicker() {
  const [theme, setTheme] = useState(readTheme)
  useEffect(() => { applyTheme(theme); try { localStorage.setItem(KEY, JSON.stringify(theme)) } catch { /* abaikan */ } }, [theme])
  const set = (patch) => setTheme((t) => ({ ...t, ...patch }))
  const custom = !ACCENTS.some(([c]) => c === theme.accent)

  return (
    <Popover label="Tema tampilan" width="min-w-[250px]" button={({ open, toggle }) => (
      <button onClick={toggle} aria-expanded={open} aria-label="Tema tampilan" title="Tema: Light / Dark / warna aksen"
        className={cx('grid h-11 w-11 place-items-center rounded-xl ring-1 ring-slate-200 hover:text-brand', open ? 'text-brand ring-brand' : 'text-ink-mute')}>
        <Palette className="h-4 w-4" />
      </button>
    )}>
      {() => (
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 px-0.5 text-[11px] font-bold uppercase tracking-wide text-ink-mute">Mode</p>
            <div className="grid grid-cols-2 gap-1.5">
              {[['light', 'Light', Sun], ['dark', 'Dark', Moon]].map(([m, label, Icon]) => (
                <button key={m} type="button" onClick={() => set({ mode: m })} aria-pressed={theme.mode === m}
                  className={cx('flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold ring-1 transition',
                    theme.mode === m ? 'bg-brand text-white ring-brand' : 'bg-white text-ink-soft ring-slate-200 hover:ring-brand')}>
                  <Icon className="h-3.5 w-3.5" />{label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 px-0.5 text-[11px] font-bold uppercase tracking-wide text-ink-mute">Warna aksen</p>
            <div className="flex flex-wrap items-center gap-1.5">
              {ACCENTS.map(([c, name]) => (
                <button key={c} type="button" onClick={() => set({ accent: c })} title={name} aria-label={`Aksen ${name}`} aria-pressed={theme.accent === c}
                  className="grid h-7 w-7 place-items-center rounded-full ring-2 ring-offset-2 ring-offset-[var(--surface)] transition hover:scale-110"
                  style={{ backgroundColor: c, '--tw-ring-color': theme.accent === c ? c : 'transparent' }}>
                  {theme.accent === c && <Check className="h-3.5 w-3.5 text-white" />}
                </button>
              ))}
              <label className={cx('grid h-7 w-7 cursor-pointer place-items-center rounded-full text-[10px] font-bold ring-2 ring-offset-2 ring-offset-[var(--surface)]', custom ? 'text-white' : 'text-ink-mute ring-transparent')}
                title="Warna sendiri" style={{ background: custom ? theme.accent : 'conic-gradient(from 180deg, #f87171, #fbbf24, #34d399, #60a5fa, #a78bfa, #f87171)', '--tw-ring-color': custom ? theme.accent : 'transparent' }}>
                {custom && <Check className="h-3.5 w-3.5" />}
                <input type="color" value={theme.accent} onChange={(e) => set({ accent: e.target.value })} className="sr-only" aria-label="Pilih warna aksen sendiri" />
              </label>
            </div>
          </div>
          {/* Pratinjau singkat */}
          <div className="rounded-xl bg-slate-50 p-2 ring-1 ring-slate-200">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-ink-mute">Pratinjau</p>
            <div className="flex items-center gap-1.5">
              <span className="rounded-lg bg-gradient-to-r from-brand to-[#6d5cf6] px-2 py-1 text-[11px] font-semibold text-white">Tombol</span>
              <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand">Badge</span>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">Sukses</span>
              <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-200">Error</span>
            </div>
          </div>
          <div>
            <p className="mb-1.5 px-0.5 text-[11px] font-bold uppercase tracking-wide text-ink-mute">Panel detail muncul dari</p>
            <div className="grid grid-cols-2 gap-1.5">
              {[['right', 'Kanan'], ['left', 'Kiri']].map(([v, label]) => (
                <button key={v} type="button" onClick={() => set({ panel: v })} aria-pressed={(theme.panel || 'right') === v}
                  className={cx('rounded-xl px-2 py-2 text-xs font-semibold ring-1 transition',
                    (theme.panel || 'right') === v ? 'bg-brand text-white ring-brand' : 'bg-white text-ink-soft ring-slate-200 hover:ring-brand')}>{label}</button>
              ))}
            </div>
          </div>
          <button type="button" onClick={() => setTheme(DEFAULT)} className="inline-flex items-center gap-1 px-0.5 text-[11px] font-semibold text-ink-mute hover:text-brand">
            <RotateCcw className="h-3 w-3" />Kembalikan ke bawaan
          </button>
        </div>
      )}
    </Popover>
  )
}
