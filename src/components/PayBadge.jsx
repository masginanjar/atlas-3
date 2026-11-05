import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { zoho, payStateOf } from '../lib/integrations.js'
import { canSeePayment } from '../config/menuAccess.js'
import { cx } from './ui.jsx'

const TONE = {
  ok: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warn: 'bg-amber-50 text-amber-800 ring-amber-200',
  due: 'bg-rose-50 text-rose-700 ring-rose-200',
  mute: 'bg-slate-100 text-ink-soft ring-slate-200',
}

export function PayBadge({ status, className, prefix = true }) {
  const s = payStateOf(status)
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1', TONE[s.tone], className)}>
      {prefix && <span className="font-normal opacity-70">Pembayaran</span>}{s.label}
    </span>
  )
}

/** Badge Pembayaran di detail project — status diambil dari invoice Zoho. */
export function ProjectPayBadge({ project, className }) {
  const { user } = useApp()
  const [status, setStatus] = useState(undefined) // undefined = sedang dicek
  useEffect(() => {
    let dead = false
    if (!project?.invoice_no) { setStatus(null); return }
    zoho.invoiceStatus(project.invoice_no).then((v) => { if (!dead) setStatus(v) }).catch(() => { if (!dead) setStatus(null) })
    return () => { dead = true }
  }, [project?.invoice_no])
  if (!canSeePayment(user)) return null
  if (status === undefined) return <span className={cx('inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-ink-mute ring-1 ring-slate-200', className)}><Loader2 className="h-3 w-3 animate-spin" />Pembayaran</span>
  return <PayBadge status={status} className={className} />
}
