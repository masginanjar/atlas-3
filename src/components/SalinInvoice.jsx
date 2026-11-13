import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

/** Salin nomor invoice ke clipboard — tidak membuka apa pun. */
export default function SalinInvoice({ no }) {
  const [ok, setOk] = useState(false)
  const salin = async (e) => {
    e.stopPropagation()
    try { await navigator.clipboard.writeText(no) } catch {
      const t = document.createElement('textarea'); t.value = no; document.body.appendChild(t); t.select(); try { document.execCommand('copy') } catch { /* abaikan */ } t.remove()
    }
    setOk(true); setTimeout(() => setOk(false), 1500)
  }
  return (
    <button type="button" onClick={salin} data-aksi="salin-invoice" aria-label={ok ? `Nomor ${no} tersalin` : `Salin nomor invoice ${no}`} title={ok ? 'Tersalin' : 'Salin nomor invoice'}
      className="relative grid h-7 w-7 shrink-0 place-items-center rounded-md text-[#5E6380] transition hover:bg-[#F3F4F9] hover:text-[#141B34] before:absolute before:-inset-2 before:content-['']">
      {ok ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
      <span className="sr-only" aria-live="polite">{ok ? 'Tersalin' : ''}</span>
    </button>
  )
}

