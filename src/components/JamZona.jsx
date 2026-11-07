import { useEffect, useState } from 'react'
import { jamDuaZona } from '../lib/waktu.js'
import { cx } from './ui.jsx'

/**
 * Jam WIB & WITA. Kantor pusat di Bali (WITA) sementara sebagian besar cabang
 * di WIB, jadi keduanya ditampilkan agar tidak perlu menghitung selisih sendiri
 * saat menelepon atau menjanjikan deadline.
 * Diperbarui tepat saat pergantian menit, bukan tiap detik.
 *
 * tema 'head'  → menempel di header atas (ikut warna header)
 * tema 'kartu' → dipakai di Sheet Menu versi mobile
 */
export default function JamZona({ className, tema = 'head' }) {
  const [kini, setKini] = useState(() => new Date())
  useEffect(() => {
    let iv
    const t = setTimeout(() => {
      setKini(new Date())
      iv = setInterval(() => setKini(new Date()), 60000)
    }, 60000 - (Date.now() % 60000))
    return () => { clearTimeout(t); clearInterval(iv) }
  }, [])
  const head = tema === 'head'
  const nav = tema === 'nav'
  const warnaKode = head ? { color: 'var(--head-mute)' } : nav ? { color: 'var(--nav-mute)' } : undefined
  const warnaJam = head ? { color: 'var(--head-ink)' } : nav ? { color: 'var(--nav-ink)' } : undefined
  return (
    <div
      className={cx('items-center', head ? 'gap-2 2xl:gap-3' : 'gap-3', className)}
      aria-label="Jam WIB dan WITA" data-jam>
      {jamDuaZona(kini).map(({ kode, jam }) => (
        <span key={kode} className="flex items-baseline gap-1 whitespace-nowrap" data-jam-zona={kode}>
          <span className={cx('text-[10px] font-bold uppercase tracking-wide', !head && !nav && 'text-ink-mute')} style={warnaKode}>{kode}</span>
          <span className={cx('font-bold tabular-nums', head ? 'text-[13px] 2xl:text-sm' : nav ? 'text-[13px]' : 'text-sm text-ink')} style={warnaJam}>{jam}</span>
        </span>
      ))}
    </div>
  )
}
