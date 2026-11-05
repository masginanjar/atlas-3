import { useEffect, useState } from 'react'
import { Copy, Hash } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { Field, Input, cx } from './ui.jsx'

/**
 * Nomor resi pengiriman (+ Copy Resi). Cukup diketik — tanpa upload foto resi (biar ringan).
 * onChange(patch) dipanggil dengan { resi_no }.
 * Di form, onChange cukup mengubah state; di detail project langsung disimpan.
 */
export default function ResiFields({ about, onChange, className }) {
  const { notify } = useApp()
  const [no, setNo] = useState(about.resi_no || '')
  useEffect(() => setNo(about.resi_no || ''), [about.resi_no])

  const copy = async () => {
    try { await navigator.clipboard.writeText(no); notify('Berhasil disalin') } catch { notify('Gagal menyalin — salin manual', 'err') }
  }

  return (
    <div className={cx('grid gap-4 sm:grid-cols-2', className)}>
      <Field label="Nomor Resi" icon={Hash} hint="Ketik nomor resi dari kurir — tidak perlu foto.">
        <div className="flex gap-2">
          <Input value={no} placeholder="mis. JP1234567890" onChange={(e) => setNo(e.target.value)}
            onBlur={() => no !== (about.resi_no || '') && onChange({ resi_no: no.trim() })} />
          <button type="button" onClick={copy} disabled={!no} title="Copy Resi" aria-label="Copy Resi"
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white px-3 text-xs font-semibold text-ink-soft ring-1 ring-slate-300 hover:bg-slate-50 hover:text-brand disabled:cursor-not-allowed disabled:opacity-40">
            <Copy className="h-3.5 w-3.5" />Copy Resi
          </button>
        </div>
      </Field>
    </div>
  )
}
