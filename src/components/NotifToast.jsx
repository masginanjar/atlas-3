import { useEffect, useRef, useState } from 'react'
import { Bell, Banknote, BellRing, X } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { cx } from './ui.jsx'
import { go } from '../lib/router.js'

const TAHAN = 6000 // berapa lama satu popup bertahan

/**
 * Popup geser dari kanan saat ada notifikasi atau ping baru.
 * Hanya memberi tahu; isinya tetap ada di lonceng, jadi tidak ada
 * yang hilang kalau popup-nya terlewat.
 * Yang pernah tampil diingat agar tidak muncul berulang.
 */
export default function NotifToast() {
  const { user, myNotifications, myPings, markRead, markPingRead } = useApp()
  const [antre, setAntre] = useState([])
  const pernah = useRef(new Set())
  const [siap, setSiap] = useState(false)

  // Data masuk bertahap setelah login. Selama masa tenang ini semua yang
  // ada dicatat sebagai "sudah dilihat", jadi notifikasi lama tidak
  // meledak jadi popup. Setelah itu barulah yang benar-benar baru tampil.
  useEffect(() => {
    if (!user) return undefined
    setSiap(false)
    const t = setTimeout(() => setSiap(true), 3000)
    return () => clearTimeout(t)
  }, [user?.id])

  useEffect(() => {
    if (!user) return
    const belum = [
      ...myNotifications.filter((n) => !(n.read_by || []).includes(user.id))
        .map((n) => ({ id: `n:${n.id}`, jenis: n.kind === 'payment' ? 'bayar' : 'notif', teks: n.text, oleh: n.by, project: n.project_id, row: n, ping: false })),
      ...myPings.filter((p) => !(p.read_by || []).includes(user.id))
        .map((p) => ({ id: `p:${p.id}`, jenis: 'ping', teks: p.message || 'Mohon dicek', oleh: p.by, project: p.project_id, row: p, ping: true })),
    ]
    if (!siap) { belum.forEach((x) => pernah.current.add(x.id)); return }
    const baru = belum.filter((x) => !pernah.current.has(x.id))
    if (!baru.length) return
    baru.forEach((x) => pernah.current.add(x.id))
    setAntre((v) => [...baru.slice(0, 3), ...v].slice(0, 3))
  }, [myNotifications, myPings, user, siap])

  useEffect(() => {
    if (!antre.length) return
    const t = setTimeout(() => setAntre((v) => v.slice(0, -1)), TAHAN)
    return () => clearTimeout(t)
  }, [antre])

  if (!antre.length) return null
  const tutup = (id) => setAntre((v) => v.filter((x) => x.id !== id))

  return (
    <div aria-live="polite" className="pointer-events-none fixed right-2 top-[4.5rem] z-[90] flex w-[min(92vw,22rem)] flex-col gap-2 sm:right-4">
      {antre.map((x) => {
        const Ikon = x.jenis === 'bayar' ? Banknote : x.jenis === 'ping' ? BellRing : Bell
        return (
          <div key={x.id}
            className={cx('pointer-events-auto flex min-w-0 animate-[geserMasuk_.25s_ease-out] items-start gap-2.5 rounded-2xl p-3 shadow-[0_18px_40px_-16px_rgba(14,21,64,0.45)] ring-1',
              x.jenis === 'bayar' ? 'bg-emerald-50 ring-emerald-300'
                : x.jenis === 'ping' ? 'bg-rose-50 ring-rose-300' : 'bg-white ring-slate-200')}>
            <span className={cx('grid h-9 w-9 shrink-0 place-items-center rounded-full',
              x.jenis === 'bayar' ? 'bg-emerald-100 text-emerald-700'
                : x.jenis === 'ping' ? 'bg-rose-100 text-rose-700' : 'bg-brand-soft text-brand')}>
              <Ikon className="h-4 w-4" />
            </span>
            <button type="button"
              onClick={() => { x.ping ? markPingRead([x.row]) : markRead([x.row]); if (x.project) go(`projects/${x.project}`); tutup(x.id) }}
              className="min-w-0 flex-1 text-left">
              <span className="line-clamp-2 block text-sm font-semibold text-ink">{x.teks}</span>
              {x.oleh && <span className="mt-0.5 block truncate text-[11px] text-ink-mute">{x.oleh}</span>}
            </button>
            <button type="button" onClick={() => tutup(x.id)} aria-label="Tutup pemberitahuan"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-ink-mute hover:bg-black/5 md:h-8 md:w-8">
              <X className="h-4 w-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
