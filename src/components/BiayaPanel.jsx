import { useEffect, useState } from 'react'
import { Plus, Trash2, Calculator, Lock } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { can } from '../config/access.js'
import { totalBiaya } from '../config/workflows.js'
import { Button, Input, cx } from './ui.jsx'
import { rupiah } from '../lib/format.js'

/** Biaya Apostille/Legalisasi — hanya Direktur/Direktur yang bisa mengisi; staf tidak melihat panel ini. */
export default function BiayaPanel({ project, sub, ringkas }) {
  const { user, saveBiaya, notify } = useApp()
  const editable = can.editBiaya(user)
  const [proses, setProses] = useState(sub.data?.biaya_proses ?? '')
  const [lain, setLain] = useState(sub.data?.biaya_lain ?? [])
  const [busy, setBusy] = useState(false)
  useEffect(() => { setProses(sub.data?.biaya_proses ?? ''); setLain(sub.data?.biaya_lain ?? []) }, [sub.data?.biaya_proses, sub.data?.biaya_lain])
  if (!can.seeBiaya(user)) return null

  const total = totalBiaya({ biaya_proses: proses, biaya_lain: lain })
  const dirty = Number(proses || 0) !== Number(sub.data?.biaya_proses || 0) || JSON.stringify(lain) !== JSON.stringify(sub.data?.biaya_lain ?? [])
  const upd = (i, patch) => setLain((a) => a.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const submit = async () => {
    setBusy(true)
    try {
      const clean = lain.filter((x) => x.ket.trim() || Number(x.nominal)).map((x) => ({ ket: x.ket.trim(), nominal: Number(x.nominal) || 0 }))
      await saveBiaya(project, sub, Number(proses) || 0, clean, totalBiaya({ biaya_proses: proses, biaya_lain: clean }))
      notify('Biaya disimpan · petty cash diperbarui')
    } catch (e) { notify(e.message, 'err') } finally { setBusy(false) }
  }

  if (ringkas) return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[#E7E8F0] px-3 py-2" data-biaya-ringkas>
      <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold"><Calculator className="h-4 w-4 text-amber-700" />Biaya {sub.type === 'legalisasi' ? 'legalisasi' : 'apostille'}</span>
      <Input type="number" inputMode="numeric" min="0" disabled={!editable} value={proses} onChange={(e) => setProses(e.target.value)} placeholder="0" aria-label="Biaya proses" title="Dicatat ke Petty Cash Apostille" className="!h-9 !w-32 text-right" />
      {lain.map((x, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          <Input disabled={!editable} value={x.ket} onChange={(e) => upd(i, { ket: e.target.value })} placeholder="Biaya lain" aria-label={`Keterangan biaya lain ${i + 1}`} className="!h-9 !w-28" />
          <Input type="number" inputMode="numeric" min="0" disabled={!editable} value={x.nominal} onChange={(e) => upd(i, { nominal: e.target.value })} placeholder="0" aria-label={`Nominal biaya lain ${i + 1}`} className="!h-9 !w-24 text-right" />
          {editable && <button type="button" onClick={() => setLain((a) => a.filter((_, j) => j !== i))} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Hapus biaya lain"><Trash2 className="h-4 w-4" /></button>}
        </span>
      ))}
      {editable && <button type="button" onClick={() => setLain((a) => [...a, { ket: '', nominal: '' }])} title="Tambah biaya lain" aria-label="Tambah biaya lain" className="grid h-9 w-9 place-items-center rounded-lg text-amber-800 ring-1 ring-amber-200 hover:bg-amber-50"><Plus className="h-4 w-4" /></button>}
      <span className="ml-auto text-[13px] text-[#5E6380]">Total <b className={cx('tabular-nums text-[#141B34]', dirty && 'text-amber-700')}>{rupiah(total)}</b></span>
      {editable && dirty && <Button size="sm" loading={busy} onClick={submit}>Simpan biaya</Button>}
    </div>
  )
  return (
    <div className="mx-4 mb-3 rounded-xl bg-amber-50/70 p-3 ring-1 ring-amber-200">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-900">
        <Calculator className="h-3.5 w-3.5" />Biaya {sub.type === 'legalisasi' ? 'Legalisasi' : 'Apostille'}
        {!editable && <span className="ml-auto inline-flex items-center gap-1 normal-case tracking-normal text-ink-mute"><Lock className="h-3 w-3" />hanya Direktur/Direktur</span>}
      </p>
      <div className="space-y-2">
        <div className="grid grid-cols-[1fr_140px_32px] items-center gap-2">
          <span className="text-sm font-semibold text-ink">Biaya {sub.type === 'legalisasi' ? 'Legalisasi' : 'Apostille'}</span>
          <Input type="number" inputMode="numeric" min="0" disabled={!editable} value={proses} onChange={(e) => setProses(e.target.value)} placeholder="0" aria-label="Biaya proses" className="text-right" />
          <span />
        </div>
        {lain.map((x, i) => (
          <div key={i} className="grid grid-cols-[1fr_140px_32px] items-center gap-2">
            <Input disabled={!editable} value={x.ket} onChange={(e) => upd(i, { ket: e.target.value })} placeholder="Keterangan, mis. Meterai" aria-label={`Keterangan biaya lain ${i + 1}`} />
            <Input type="number" inputMode="numeric" min="0" disabled={!editable} value={x.nominal} onChange={(e) => upd(i, { nominal: e.target.value })} placeholder="0" aria-label={`Nominal biaya lain ${i + 1}`} className="text-right" />
            {editable ? <button type="button" onClick={() => setLain((a) => a.filter((_, j) => j !== i))} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Hapus biaya lain"><Trash2 className="h-4 w-4" /></button> : <span />}
          </div>
        ))}
        {editable && <button type="button" onClick={() => setLain((a) => [...a, { ket: '', nominal: '' }])} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"><Plus className="h-3.5 w-3.5" />Tambah Biaya Lain</button>}
        <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 ring-1 ring-amber-200">
          <span className="text-xs font-bold uppercase tracking-wide text-ink">Total Biaya</span>
          <span className={cx('text-base font-extrabold tabular-nums', dirty && 'text-amber-700')}>{rupiah(total)}</span>
        </div>
        {editable && dirty && <div className="flex justify-end"><Button size="sm" loading={busy} onClick={submit}>Simpan Biaya</Button></div>}
        <p className="text-[11px] text-ink-mute">Total biaya tercatat otomatis sebagai pengeluaran Petty Cash Apostille (Direktur) — terpisah dari petty cash cabang.</p>
      </div>
    </div>
  )
}
