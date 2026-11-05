import { useEffect, useState } from 'react'
import { Clock3 } from 'lucide-react'
import { relTime } from '../lib/format.js'
import { cx } from './ui.jsx'

// satu jam bersama untuk semua label waktu (diperbarui tiap 15 detik)
const subs = new Set(); let timer = null
export function useNow() {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    subs.add(setNow)
    if (!timer) timer = setInterval(() => { const n = Date.now(); subs.forEach((f) => f(n)) }, 15000)
    return () => { subs.delete(setNow); if (!subs.size) { clearInterval(timer); timer = null } }
  }, [])
  return now
}

/** Label waktu relatif, contoh "5 menit lalu" / "Sen 7 Nov 13.33". prefix (Diajukan/Masuk/…) hanya di tooltip. */
export default function TimeAgo({ at, prefix, className, icon = true }) {
  const now = useNow()
  if (!at) return null
  const full = new Date(at).toLocaleString('id-ID', { timeZone: 'Asia/Makassar', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  return (
    <span className={cx('mt-0.5 flex w-fit items-center gap-1 whitespace-nowrap text-[11px] leading-tight text-ink-mute', className)} title={`${prefix ? `${prefix} ` : ''}${full} WITA`}>
      {icon && <Clock3 className="h-3 w-3 shrink-0" />}{relTime(at, now)}
    </span>
  )
}
