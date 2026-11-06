import { useEffect, useState } from 'react'
import { jamDuaZona } from '../lib/waktu.js'
import { cx } from './ui.jsx'

/**
 * Jam WIB & WITA di header. Kantor pusat di Bali (WITA) sementara sebagian
 * besar cabang di WIB, jadi keduanya ditampilkan agar tidak perlu menghitung
 * selisih sendiri saat menelepon atau menjanjikan deadline.
 * Diperbarui tepat saat pergantian menit, bukan tiap detik.
 */
export default function JamZona({ className }) {
  const [kini, setKini] = useState(() => new Date())
  useEffect(() => {
    let iv
    const t = setTimeout(() => {
      setKini(new Date())
      iv = setInterval(() => setKini(new Date()), 60000)
    }, 60000 - (Date.now() % 60000))
    return () => { clearTimeout(t); clearInterval(iv) }
  }, [])
  return (
    <div className={cx('items-center gap-3', className)} aria-label="Jam WIB dan WITA">
      {jamDuaZona(kini).map(({ kode, jam }) => (
        <span key={kode} className="flex items-baseline gap-1 whitespace-nowrap">
          <span className="text-[10px] font-bold uppercase tracking-wide text-ink-mute">{kode}</span>
          <span className="text-sm font-bold tabular-nums text-ink">{jam}</span>
        </span>
      ))}
    </div>
  )
}
