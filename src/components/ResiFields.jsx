import { useEffect, useState } from 'react'
import { Copy, Hash, Camera, Loader2, X, ImageIcon } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { drive } from '../lib/integrations.js'
import { Field, Input, cx } from './ui.jsx'

/**
 * Nomor resi (+ Copy Resi) dan foto resi pengiriman.
 * onChange(patch) dipanggil dengan { resi_no } atau { resi_photo }.
 * Di form, onChange cukup mengubah state; di detail project langsung disimpan.
 */
export default function ResiFields({ about, onChange, branch, invoice, className }) {
  const { notify } = useApp()
  const [no, setNo] = useState(about.resi_no || '')
  const [busy, setBusy] = useState(false)
  useEffect(() => setNo(about.resi_no || ''), [about.resi_no])

  const copy = async () => {
    try { await navigator.clipboard.writeText(no); notify('Berhasil disalin') } catch { notify('Gagal menyalin — salin manual', 'err') }
  }
  const upload = async (file) => {
    if (!file) return
    setBusy(true)
    try { onChange({ resi_photo: await drive.upload(file, { branch, invoice: invoice || 'tanpa-invoice' }) }) }
    catch (e) { notify(e.message, 'err') } finally { setBusy(false) }
  }
  const photo = about.resi_photo

  return (
    <div className={cx('grid gap-4 sm:grid-cols-2', className)}>
      <Field label="Nomor Resi" icon={Hash}>
        <div className="flex gap-2">
          <Input value={no} placeholder="mis. JP1234567890" onChange={(e) => setNo(e.target.value)}
            onBlur={() => no !== (about.resi_no || '') && onChange({ resi_no: no.trim() })} />
          <button type="button" onClick={copy} disabled={!no} title="Copy Resi" aria-label="Copy Resi"
            className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-white px-3 text-xs font-semibold text-ink-soft ring-1 ring-slate-300 hover:bg-slate-50 hover:text-brand disabled:cursor-not-allowed disabled:opacity-40">
            <Copy className="h-3.5 w-3.5" />Copy Resi
          </button>
        </div>
      </Field>
      <Field label="Foto Resi" icon={Camera}>
        {photo ? (
          <div className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 ring-1 ring-slate-300">
            {photo.url?.startsWith('data:image') ? <img src={photo.url} alt="Foto resi" className="h-8 w-8 rounded object-cover" /> : <ImageIcon className="h-5 w-5 text-ink-mute" />}
            {photo.url && !photo.url.startsWith('data:') ? <a href={photo.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm font-medium text-brand">{photo.name}</a>
              : <span className="min-w-0 flex-1 truncate text-sm">{photo.name}</span>}
            <button type="button" onClick={() => onChange({ resi_photo: null })} className="rounded p-1 text-slate-400 hover:text-rose-600" aria-label="Hapus foto resi"><X className="h-4 w-4" /></button>
          </div>
        ) : (
          <label className="flex h-[38px] cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white text-sm font-medium text-ink-soft hover:border-brand hover:text-brand">
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" />Mengunggah…</> : <><Camera className="h-4 w-4" />Upload / foto resi</>}
            <input type="file" accept="image/*,application/pdf" capture="environment" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
          </label>
        )}
      </Field>
    </div>
  )
}
