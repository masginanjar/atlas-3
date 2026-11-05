import { useState } from 'react'
import { cx } from './ui.jsx'

// ============================================================
//  FOTO PROFIL — satu komponen dipakai di seluruh aplikasi.
//  Urutan: foto unggahan (user.avatar) → avatar ilustrasi placeholder
//  (berbeda per orang, deterministik dari id) → inisial nama bila gambar gagal dimuat.
// ============================================================

const hash = (s = '') => { let h = 7; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h }
const SKIN = ['#f9d5b8', '#f1c4a0', '#e0ac7e', '#c68a5a', '#a66a3f', '#7d4a2b']
const HAIR = ['#1f1a17', '#3b2a20', '#6b4a2b', '#a3673a', '#2b2d42', '#8d6e63', '#4a4e69']
const SHIRT = ['#4f46e5', '#06b6d4', '#d946ef', '#f59e0b', '#10b981', '#ef4444', '#0ea5e9', '#8b5cf6']
const BG = ['#eef2ff', '#ecfeff', '#fdf4ff', '#fffbeb', '#ecfdf5', '#fff1f2', '#f0f9ff', '#f5f3ff']

/** Ilustrasi orang sederhana (SVG) — variasi kulit, rambut, baju, kacamata, latar. */
export function PlaceholderAvatar({ seed, size = 36, className }) {
  const h = hash(seed)
  const skin = SKIN[h % SKIN.length], hair = HAIR[(h >> 3) % HAIR.length], shirt = SHIRT[(h >> 6) % SHIRT.length], bg = BG[(h >> 9) % BG.length]
  const style = (h >> 12) % 4 // 0 pendek, 1 panjang, 2 bob, 3 hijab
  const glasses = ((h >> 15) % 3) === 0
  const smile = ((h >> 17) % 2) === 0
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={cx('shrink-0 rounded-full', className)} aria-hidden>
      <circle cx="32" cy="32" r="32" fill={bg} />
      {/* badan */}
      <path d="M10 64c1-13 10-20 22-20s21 7 22 20z" fill={shirt} />
      <path d="M26 44h12v6a6 6 0 0 1-12 0z" fill={skin} />
      {/* rambut belakang */}
      {style === 1 && <path d="M16 30c0-14 7-20 16-20s16 6 16 20v16H16z" fill={hair} />}
      {style === 2 && <path d="M17 30c0-13 6-19 15-19s15 6 15 19v10H17z" fill={hair} />}
      {style === 3 && <path d="M14 34c0-16 8-24 18-24s18 8 18 24v16H14z" fill={hair} />}
      {/* kepala */}
      <ellipse cx="32" cy="30" rx="12.5" ry="14" fill={skin} />
      {/* rambut depan */}
      {style === 0 && <path d="M19.5 28c0-9 5-15 12.5-15s12.5 6 12.5 15c-3-4-7-6-12.5-6s-9.5 2-12.5 6z" fill={hair} />}
      {style === 1 && <path d="M19.5 29c0-10 5-16 12.5-16s12.5 6 12.5 16c-2-5-6-8-12.5-8s-10.5 3-12.5 8z" fill={hair} />}
      {style === 2 && <path d="M19.5 29c0-10 5-16 12.5-16s12.5 6 12.5 16c-4-3-7-5-12.5-5s-8.5 2-12.5 5z" fill={hair} />}
      {style === 3 && <path d="M19.5 31c0-11 5-17 12.5-17s12.5 6 12.5 17c-1-6-5-9-12.5-9s-11.5 3-12.5 9z" fill={hair} />}
      {/* mata & mulut */}
      <circle cx="27" cy="31" r="1.4" fill="#1f1a17" /><circle cx="37" cy="31" r="1.4" fill="#1f1a17" />
      {smile ? <path d="M28 37q4 3 8 0" stroke="#9a4b3a" strokeWidth="1.4" fill="none" strokeLinecap="round" /> : <path d="M29 37.5h6" stroke="#9a4b3a" strokeWidth="1.4" strokeLinecap="round" />}
      {glasses && <g stroke="#334155" strokeWidth="1.2" fill="none"><circle cx="27" cy="31" r="3.6" /><circle cx="37" cy="31" r="3.6" /><path d="M30.6 31h2.8" /></g>}
    </svg>
  )
}

const initialsOf = (name = '') => name.replace(/\(.*?\)/g, '').trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?'

/** Foto profil pengguna. `user` = baris users (name, id, avatar). */
export default function Avatar({ user, size = 36, className, ring = true }) {
  const [broken, setBroken] = useState(false)
  const name = user?.name || '?'
  const px = { width: size, height: size }
  const wrap = cx('relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-white', ring && 'ring-2 ring-white shadow-sm', className)
  if (user?.avatar && !broken) {
    return <span className={wrap} style={px} title={name}><img src={user.avatar} alt={name} className="h-full w-full object-cover" onError={() => setBroken(true)} /></span>
  }
  if (!broken && user?.id) return <span className={wrap} style={px} title={name}><PlaceholderAvatar seed={user.id} size={size} /></span>
  return (
    <span className={cx(wrap, 'bg-ink text-white')} style={{ ...px, fontSize: Math.max(10, size * 0.38) }} title={name}>
      <span className="font-black leading-none">{initialsOf(name)}</span>
    </span>
  )
}
