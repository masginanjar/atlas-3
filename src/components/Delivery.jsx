import { CheckCircle2, Circle, PackageCheck } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import ResiFields from './ResiFields.jsx'
import { CourierSelect } from './Courier.jsx'
import KirimEverpro from './KirimEverpro.jsx'

// ============================================================
//  ARTI "SELESAI" PER METODE PENGIRIMAN
//   Diambil di kantor : dokumen sudah diambil pelanggan → Selesai
//   Softcopy saja     : dokumen sudah dikirim → Selesai
//   Dikirim kurir     : tulis no. resi → dokumen sudah di-pickup / dibawa ke kurir → Selesai
//   Dari penerjemah   : minta no resi → tulis no. resi dari penerjemah → Selesai
//   (tanpa upload foto resi & tanda terima — biar ringan)
// ============================================================
export const DELIVERY_STEPS = {
  pickup: [{ key: 'diambil', label: 'Dokumen sudah diambil pelanggan', type: 'check' }],
  softcopy: [{ key: 'softcopy_dikirim', label: 'Dokumen (softcopy) sudah dikirim ke pelanggan', type: 'check' }],
  courier: [{ key: 'resi', label: 'Tulis nomor resi', type: 'resi' }, { key: 'diserahkan_kurir', label: 'Dokumen sudah di-pickup / dibawa ke kurir', type: 'check' }],
  vendor: [{ key: 'minta_resi', label: 'Nomor resi sudah diminta ke penerjemah/vendor', type: 'check' }, { key: 'resi', label: 'Tulis nomor resi dari penerjemah', type: 'resi' }],
}
export const DELIVERY_LABEL = { pickup: 'Diambil di Kantor', softcopy: 'Softcopy Saja', courier: 'Dikirim Kurir', vendor: 'Dikirim dari Penerjemah' }

/** Metode pengiriman project (dari kurir yang dipilih). */
export const deliveryType = (project, couriers = []) => couriers.find((c) => c.id === project.about?.courier)?.type ?? null
const stepDone = (st, project, d = {}) => (st.type === 'resi' ? !!(project.about?.resi_no || project.about?.resi_photo) : !!d[st.key])
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
  const setD = async (patch, label) => {
    try { await patchSubData(project, sub.id, { delivery: { ...d, type: t, ...patch } }, label) } catch (e) { notify(e.message, 'err') }
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
                {st.type === 'resi' && <ResiFields className="mt-2" about={project.about || {}}
                  onChange={async (patch) => { await save('projects', { ...project, about: { ...project.about, ...patch } }); notify('Info resi disimpan') }} />}
              </span>
            </div>
          </li>
        )
      })}</ol>
      {t === 'courier' && <KirimEverpro project={project} />}
    </div>
  )
}
