import { Copy } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { cx } from './ui.jsx'

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true } catch { /* fallback */ }
  try {
    const ta = Object.assign(document.createElement('textarea'), { value: text })
    ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select()
    const ok = document.execCommand('copy'); ta.remove(); return ok
  } catch { return false }
}

/** Teks + ikon copy kecil (untuk input cepat ke m-banking / ekspedisi). */
export default function CopyText({ text, label, className, strong, mono }) {
  const { notify } = useApp()
  if (!text) return <span className="text-ink-mute">—</span>
  return (
    <span className={cx('inline-flex max-w-full items-center gap-1', className)}>
      <span className={cx('truncate', strong && 'font-semibold text-ink', mono && 'tabular-nums tracking-wide')} title={text}>{text}</span>
      <button type="button" title={`Copy ${label || ''}`.trim()} aria-label={`Copy ${label || text}`}
        onClick={async (e) => { e.preventDefault(); e.stopPropagation(); const ok = await copyText(text); notify(ok ? 'Berhasil disalin' : 'Gagal menyalin — salin manual', ok ? 'ok' : 'err') }}
        className="shrink-0 rounded p-0.5 text-slate-400 transition hover:bg-brand-soft hover:text-brand active:scale-90">
        <Copy className="h-3.5 w-3.5" />
      </button>
    </span>
  )
}

/**
 * Nominal untuk dibayar — tanpa tulisan "Rp" supaya tidak ikut tersalin,
 * dengan ikon copy yang menyalin ANGKA SAJA (tanpa titik pemisah ribuan),
 * jadi langsung bisa ditempel di aplikasi m-banking.
 */
export function NominalCopy({ nilai, label = 'nominal', className, besar }) {
  const { notify } = useApp()
  const angka = Math.round(Number(nilai) || 0)
  const tampil = angka.toLocaleString('id-ID')
  return (
    <span className={cx('inline-flex max-w-full items-center gap-1', className)}>
      <b className={cx('tabular-nums text-ink', besar ? 'text-[15px] font-extrabold' : 'text-sm font-bold')}>{tampil}</b>
      <button type="button" title={`Salin ${label} — angka saja, siap ditempel di m-banking`}
        aria-label={`Salin ${label} ${tampil}`}
        onClick={async (e) => {
          e.preventDefault(); e.stopPropagation()
          const ok = await copyText(String(angka))
          notify(ok ? `${tampil} disalin — angka saja` : 'Gagal menyalin — salin manual', ok ? 'ok' : 'err')
        }}
        className="shrink-0 rounded p-0.5 text-slate-400 transition hover:bg-brand-soft hover:text-brand active:scale-90">
        <Copy className="h-3.5 w-3.5" />
      </button>
    </span>
  )
}
