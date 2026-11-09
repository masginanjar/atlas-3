import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Pause, Play, ImagePlus } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { branchesOf } from '../config/access.js'
import { cx } from './ui.jsx'
import { pengaturanBeranda, slideAktif, RASIO } from '../config/berandaSlide.js'

/**
 * Slide foto di Beranda. Jumlah foto, jeda, rasio diatur Superadmin.
 * Berganti otomatis; berhenti saat kursor di atasnya; bisa digeser manual.
 */
export default function SlideBeranda({ className, override }) {
  const { user, data } = useApp()
  const p = useMemo(() => override || pengaturanBeranda(data), [data, override])
  const urutan = useMemo(() => {
    // Foto khusus cabang hanya tampil untuk pengguna cabang itu (Superadmin melihat semua).
    const s = slideAktif(p, override || user?.role === 'superadmin' ? null : branchesOf(user))
    if (!p.acak) return s
    const a = [...s]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a
  }, [p, user, override])
  const [i, setI] = useState(0)
  const [jeda, setJeda] = useState(false)
  const n = urutan.length
  useEffect(() => { setI(0) }, [n])
  useEffect(() => {
    if (n < 2 || jeda) return
    const t = setInterval(() => setI((x) => (x + 1) % n), Math.max(2, p.jeda || 5) * 1000)
    return () => clearInterval(t)
  }, [n, jeda, p.jeda])

  if (!n) {
    if (user?.role !== 'superadmin') return null
    return (
      <a href="#/settings/beranda" className={cx('flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 p-5 text-xs font-bold text-ink-mute hover:border-brand hover:text-brand', RASIO[p.rasio] || RASIO['16:9'], className)}>
        <ImagePlus className="h-4 w-4" />Belum ada foto — klik untuk mengatur slide Beranda
      </a>
    )
  }
  const s = urutan[i] || urutan[0]
  return (
    <div className={cx('group relative overflow-hidden rounded-2xl bg-slate-900 shadow-card ring-1 ring-slate-200/60', RASIO[p.rasio] || RASIO['16:9'], className)}
      onMouseEnter={() => setJeda(true)} onMouseLeave={() => setJeda(false)} data-slide-beranda>
      {urutan.map((g, k) => (
        <img key={g.id} src={g.src} alt={g.judul || g.name || ''} draggable={false}
          className={cx('absolute inset-0 h-full w-full object-cover transition-opacity duration-700', k === i ? 'opacity-100' : 'opacity-0')} />
      ))}
      {(s.judul || s.ket) && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-8 pt-10 text-white">
          {s.judul && <b className="block text-sm font-extrabold lg:text-base">{s.judul}</b>}
          {s.ket && <span className="block text-[11px] text-white/85 lg:text-xs">{s.ket}</span>}
        </div>
      )}
      {n > 1 && (
        <>
          <button type="button" aria-label="Foto sebelumnya" onClick={() => setI((x) => (x - 1 + n) % n)}
            className="absolute left-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/35 text-white opacity-0 transition hover:bg-black/55 group-hover:opacity-100 focus:opacity-100 lg:h-9 lg:w-9"><ChevronLeft className="h-5 w-5" /></button>
          <button type="button" aria-label="Foto berikutnya" onClick={() => setI((x) => (x + 1) % n)}
            className="absolute right-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/35 text-white opacity-0 transition hover:bg-black/55 group-hover:opacity-100 focus:opacity-100 lg:h-9 lg:w-9"><ChevronRight className="h-5 w-5" /></button>
          <div className="absolute bottom-2.5 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
            {urutan.map((g, k) => (
              <button key={g.id} type="button" aria-label={`Foto ${k + 1}`} onClick={() => setI(k)}
                className={cx('h-1.5 rounded-full transition-all', k === i ? 'w-5 bg-white' : 'w-1.5 bg-white/55 hover:bg-white/80')} />
            ))}
          </div>
          <button type="button" aria-label={jeda ? 'Lanjutkan' : 'Jeda'} onClick={() => setJeda((v) => !v)}
            className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/35 text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100">
            {jeda ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          </button>
          <span className="absolute left-2.5 top-2 rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-bold text-white">{i + 1}/{n}</span>
        </>
      )}
    </div>
  )
}
