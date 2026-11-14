import { useEffect, useRef, useState } from 'react'

// ============================================================
//  Gambar mini (thumbnail) berkas PDF / gambar untuk tampilan Ikon di Dokumen.
//  - Dibuat hanya saat kotaknya terlihat di layar (hemat kuota & data).
//  - Maks. 2 berkas diproses bersamaan; hasil disimpan selama sesi.
//  - Gagal / tidak tersedia → kembali ke ikon biasa (fallback).
// ============================================================

const cache = new Map() // kunci berkas → data URL | 'gagal'
const antre = []
let jalan = 0
const MAKS = 2
const kunciDari = (f) => f.path || f.drive_id || (f.url && !f.url.startsWith('data:') ? f.url : '') || (f.url ? `${f.name}:${f.size}:${f.url.length}` : '')

function proses() {
  while (jalan < MAKS && antre.length) {
    const tugas = antre.shift()
    jalan++
    tugas().finally(() => { jalan--; proses() })
  }
}

export default function MiniPratinjau({ f, jenis, ambilBlob, fallback, className, lebar = 120 }) {
  const k0 = kunciDari(f)
  const kunci = k0 && jenis === 'pdf' ? `${k0}@${lebar}` : k0
  const [src, setSrc] = useState(() => (kunci ? cache.get(kunci) : 'gagal') || null)
  const kotak = useRef(null)
  useEffect(() => {
    if (!kunci || src) return undefined
    let batal = false
    const el = kotak.current
    if (!el) return undefined
    const io = new IntersectionObserver((es) => {
      if (!es.some((e) => e.isIntersecting)) return
      io.disconnect()
      antre.push(async () => {
        if (batal) return
        if (cache.has(kunci)) { setSrc(cache.get(kunci)); return }
        try {
          const blob = await ambilBlob(f)
          let url
          if (jenis === 'pdf') { const { gambarMiniPdf } = await import('../lib/pdfRender.js'); url = await gambarMiniPdf(blob, lebar) }
          else url = await new Promise((r, j) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.onerror = j; fr.readAsDataURL(blob) })
          cache.set(kunci, url); if (!batal) setSrc(url)
        } catch { cache.set(kunci, 'gagal'); if (!batal) setSrc('gagal') }
      })
      proses()
    }, { rootMargin: '120px' })
    io.observe(el)
    return () => { batal = true; io.disconnect() }
  }, [kunci]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!src || src === 'gagal') return <span ref={kotak} className="inline-grid">{fallback}</span>
  return (
    <span ref={kotak} className={className || 'relative inline-block h-[76px] w-[60px] overflow-hidden rounded-[3px] bg-white shadow ring-1 ring-black/10'} data-mini={jenis}>
      <img src={src} alt="" className={jenis === 'pdf' ? 'h-full w-full object-cover object-top' : 'h-full w-full object-cover'} loading="lazy" data-mini-img />
      {jenis === 'pdf' && <span className="absolute bottom-0 right-0 rounded-tl-[3px] bg-rose-600 px-1 text-[8.5px] font-extrabold leading-[13px] text-white">PDF</span>}
    </span>
  )
}
