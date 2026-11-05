import { useState } from 'react'
import { CheckCircle2, Circle, Upload, Loader2, FileCheck2, PackageCheck } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { drive } from '../lib/integrations.js'
import ResiFields from './ResiFields.jsx'
import { cx } from './ui.jsx'
import { CourierSelect } from './Courier.jsx'

// ============================================================
//  ARTI "SELESAI" PER METODE PENGIRIMAN
//   Diambil di kantor : dokumen sudah diambil → kirim tanda terima → Selesai
//   Softcopy saja     : dokumen sudah dikirim → Selesai
//   Dikirim kurir     : upload no/foto resi → dokumen sudah di-pickup / dibawa ke kurir → Selesai
//   Dari penerjemah   : minta no resi → tulis/upload resi → Selesai
// ============================================================
export const DELIVERY_STEPS = {
  pickup: [{ key: 'diambil', label: 'Dokumen sudah diambil pelanggan', type: 'check' }, { key: 'tanda_terima', label: 'Kirim tanda terima — upload foto/scan tanda terima', type: 'file' }, { key: 'tanda_terima_dikirim', label: 'Tanda terima sudah dikirim ke pelanggan', type: 'check' }],
  softcopy: [{ key: 'softcopy_dikirim', label: 'Dokumen (softcopy) sudah dikirim ke pelanggan', type: 'check' }],
  courier: [{ key: 'resi', label: 'Upload nomor / foto resi', type: 'resi' }, { key: 'diserahkan_kurir', label: 'Dokumen sudah di-pickup / dibawa ke kurir', type: 'check' }],
  vendor: [{ key: 'minta_resi', label: 'Nomor resi sudah diminta ke penerjemah/vendor', type: 'check' }, { key: 'resi', label: 'Tulis / upload resi dari penerjemah', type: 'resi' }],
}
export const DELIVERY_LABEL = { pickup: 'Diambil di Kantor', softcopy: 'Softcopy Saja', courier: 'Dikirim Kurir', vendor: 'Dikirim dari Penerjemah' }

/** Metode pengiriman project (dari kurir yang dipilih). */
export const deliveryType = (project, couriers = []) => couriers.find((c) => c.id === project.about?.courier)?.type ?? null
const stepDone = (st, project, d = {}) => (st.type === 'resi' ? !!(project.about?.resi_no || project.about?.resi_photo) : st.type === 'file' ? !!d[st.key] : !!d[st.key])
/** Sudah memenuhi syarat "selesai"? */
export function deliveryOk(project, sub, couriers) {
  const t = deliveryType(project, couriers)
  if (!t) return { ok: false, reason: 'Pilih metode pengiriman (kurir) di seksi Alamat & Kurir dulu.' }
  const left = DELIVERY_STEPS[t].filter((st) => !stepDone(st, project, sub.data?.delivery))
  return left.length ? { ok: false, reason: `Lengkapi: ${left.map((x) => x.label).join(' · ')}` } : { ok: true }
}

/** Ringkasan arti selesai — tampil di seksi Alamat & Kurir. */
export function DeliveryRule({ type }) {
  if (!type) return null
  return (
    <p className="flex flex-wrap items-center gap-1 text-[11px] text-ink-soft"><PackageCheck className="h-3.5 w-3.5 text-emerald-600" /><b>Selesai berarti:</b>
      {DELIVERY_STEPS[type].map((s, i) => <span key={s.key}>{i > 0 && '→ '}{s.label.replace(/ — .*/, '')}</span>)}<span>→ Selesai</span></p>
  )
}

/** Checklist di tahap akhir (Siap Kirim / Serah Terima / hasil vendor). */
export default function DeliveryChecklist({ project, sub }) {
  const { data, save, notify, patchSubData } = useApp()
  const t = deliveryType(project, data.couriers)
  const d = sub.data?.delivery || {}
  const [busy, setBusy] = useState(null)
  const setD = async (patch, label) => {
    try { await patchSubData(project, sub.id, { delivery: { ...d, type: t, ...patch } }, label) } catch (e) { notify(e.message, 'err') }
  }
  const upload = async (key, file) => {
    if (!file) return; setBusy(key)
    try { await setD({ [key]: await drive.upload(file, { branch: project.branch, invoice: project.invoice_no }) }, 'Tanda terima diunggah') } catch (e) { notify(e.message, 'err') } finally { setBusy(null) }
  }
  if (!t) return (
    <div className="rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200">
      <p className="mb-2 text-xs font-semibold text-amber-900">Pilih metode pengiriman (kurir) dulu — syarat "Selesai" mengikuti metode yang dipilih.</p>
      <CourierSelect value={project.about?.courier} printLocation={project.about?.print_location}
        onChange={async (id) => { try { await save('projects', { ...project, about: { ...project.about, courier: id } }); notify('Kurir diperbarui') } catch (e) { notify(e.message, 'err') } }} />
    </div>
  )
  return (
    <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
      <p className="mb-2 text-xs font-bold text-ink">Syarat selesai · {DELIVERY_LABEL[t]}</p>
      <ol className="space-y-2">{DELIVERY_STEPS[t].map((st, i) => {
        const ok = stepDone(st, project, d)
        return (
          <li key={st.key} className="text-sm">
            <div className="flex items-start gap-2">
              {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" />}
              <span className="min-w-0 flex-1">
                {st.type === 'check' ? (
                  <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={!!d[st.key]} onChange={(e) => setD({ [st.key]: e.target.checked ? new Date().toISOString() : null }, `${st.label}${e.target.checked ? '' : ' (dibatalkan)'}`)} />{i + 1}. {st.label}</label>
                ) : <span>{i + 1}. {st.label}</span>}
                {st.type === 'file' && (d[st.key] ? <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-emerald-700"><FileCheck2 className="h-3.5 w-3.5" />{d[st.key].name}</span> : (
                  <label className={cx('mt-1 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold ring-1 ring-slate-300 hover:ring-brand', busy && 'pointer-events-none opacity-60')}>
                    {busy === st.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}Upload tanda terima
                    <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => upload(st.key, e.target.files?.[0])} aria-label="Upload tanda terima" />
                  </label>))}
                {st.type === 'resi' && <ResiFields className="mt-2" about={project.about || {}} branch={project.branch} invoice={project.invoice_no}
                  onChange={async (patch) => { await save('projects', { ...project, about: { ...project.about, ...patch } }); notify('Info resi disimpan') }} />}
              </span>
            </div>
          </li>
        )
      })}</ol>
    </div>
  )
}
