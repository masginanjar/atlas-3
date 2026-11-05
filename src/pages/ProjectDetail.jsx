import { useEffect, useMemo, useState } from 'react'
import { Share2, ArrowLeft, Pencil, Trash2, Upload, FileText, Download, Check, Lock, History, CalendarClock, Loader2, UserRound, Truck, Printer, Hand, Unlock, Eye, FolderOpen, FastForward, StickyNote } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { go } from '../lib/router.js'
import { drive } from '../lib/integrations.js'
import { can, PERSON_TYPES, ROLES, scopeByBranch, activeClaim, placeOf, branchesOf } from '../config/access.js'
import { saveBlob, dataUrlToBlob } from '../lib/download.js'
import ResiFields from '../components/ResiFields.jsx'
import FilePreview from '../components/FilePreview.jsx'
import BiayaPanel from '../components/BiayaPanel.jsx'
import OtorisatorView from '../components/OtorisatorView.jsx'
import WorkerView from '../components/WorkerView.jsx'
import CopyText from '../components/CopyText.jsx'
import { printBlob } from '../lib/printing.js'
import { CATEGORIES, DONE, stageIndex, stagesOf, progressOf, flowOf, sumberLabel, isVendorFlow, recommendFund, docListOf } from '../config/workflows.js'
import { SumberDanaPicker } from '../components/Pengajuan.jsx'
import { ProjectTypes, PrintBadge } from '../components/badges.jsx'
import { SUB_TYPES, points } from '../config/subtypes.js'
import { Button, Card, SectionCard, Empty, Field, Input, Pill, Progress, Select, Textarea, cx } from '../components/ui.jsx'
import { jam, kb, rupiah, tgl, daysLeft } from '../lib/format.js'
import ProjectForm from './ProjectForm.jsx'
import { useUploadNamer } from '../components/UploadNamer.jsx'
import ActivityList from '../components/ActivityList.jsx'
import { projectActivities } from '../lib/activity.js'
import FileManager, { collect as collectFiles, fileIdentity, fieldFiles, uploadProjectFiles } from '../components/FileManager.jsx'
import { PengajuanSummary, DownloadBukti, accountLabel, PengajuanTracker } from '../components/Pengajuan.jsx'
import CustomerInfo from '../components/CustomerInfo.jsx'
import ShareSheet from '../components/ShareSheet.jsx'
import DeliveryChecklist, { DeliveryRule, deliveryOk, deliveryType } from '../components/Delivery.jsx'
// Fitur Bagikan/Portal masih dalam pengerjaan — aktifkan setelah selesai diuji
const SHARE_PORTAL_READY = import.meta.env.VITE_SHARE_PORTAL === '1'
import { CourierSelect } from '../components/Courier.jsx'
import { PriorityBadge } from '../components/Priority.jsx'
import { PingButton } from '../components/Ping.jsx'

export default function ProjectDetail({ id }) {
  const { user, data, remove, save, notify, ask } = useApp()
  const project = data.projects.find((p) => p.id === id)
  const [editing, setEditing] = useState(false)
  const [sharing, setSharing] = useState(false)

  if (!project) return <Card><Empty title="Project tidak ditemukan" action={<Button variant="outline" onClick={() => go('projects')}>Kembali</Button>} /></Card>
  if (!scopeByBranch(user, [project]).length) return <Card><Empty icon={Lock} title="Project ini tidak termasuk akses Anda" /></Card>
  if (user.role === 'otorisator') return <OtorisatorView project={project} />
  if (user.role === 'penerjemah' || user.role === 'proofreader') return <WorkerView project={project} />

  const d = daysLeft(project.about?.deadline)
  const del = async () => {
    if (!(await ask(`Hapus project ${project.invoice_no}? Tindakan ini tidak bisa dibatalkan.`))) return
    await remove('projects', project.id); notify('Project dihapus'); go('projects')
  }

  return (
    <div className="space-y-4">
      <button onClick={() => go('projects')} className="inline-flex items-center gap-1 text-sm font-semibold text-ink-mute hover:text-ink"><ArrowLeft className="h-4 w-4" />My Project</button>

      <Card className="p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">{project.invoice_no}</h1>
            <ProjectTypes project={project} className="mt-1" />
          </div>
          <div className="flex flex-wrap gap-2">
            {SHARE_PORTAL_READY && (can.editProject(user) || user.role === 'akunting') && <Button size="sm" onClick={() => setSharing(true)}><Share2 className="h-3.5 w-3.5" />Bagikan / Kirim Notifikasi</Button>}
            {can.editProject(user) && <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" />Edit</Button>}
            {can.deleteProject(user) && <Button size="sm" variant="danger" onClick={del}><Trash2 className="h-3.5 w-3.5" /></Button>}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          <Pill>Cabang {project.branch}</Pill>
          {project.about?.print_location && <Pill>Print {project.about.print_location}</Pill>}
          <PrintBadge project={project} />
          {project.about?.cs_name && <Pill>CS {project.about.cs_name}</Pill>}
          <PriorityBadge p={project.about?.priority} />
          {project.about?.received_at && <Pill>Masuk {tgl(project.about.received_at)}</Pill>}
          {project.about?.deadline && <Pill className={cx(d !== null && d <= 1 && 'bg-rose-50 text-rose-600')}><CalendarClock className="h-3 w-3" />Deadline {tgl(project.about.deadline)} · {project.about.deadline_time || '17:00'}</Pill>}
        </div>
        {project.about?.notes && (
          <div className="mt-3 flex items-start gap-2.5 rounded-xl border-l-4 border-amber-400 bg-amber-50 px-3.5 py-2.5 ring-1 ring-amber-200" role="note">
            <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">Catatan project</p><p className="whitespace-pre-line text-sm font-medium text-amber-950">{project.about.notes}</p></div>
          </div>
        )}
        <div className="mt-4 border-t border-slate-100 pt-4">
          {!can.seeCustomerDetail(user) ? (
            <SectionCard tone="sky" icon={UserRound} title="Pelanggan" className="!p-4">
              <p className="text-base font-bold text-ink">{project.customer?.name || '—'}</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-mute"><Lock className="h-3.5 w-3.5" />Kontak & alamat pelanggan disembunyikan untuk role Anda.</p>
            </SectionCard>
          ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard tone="sky" icon={UserRound} title="Data Pelanggan" aside="Zoho Books" className="!p-4 self-start" foldKey="customer" defaultOpen={false}
              summary={[project.customer?.name, project.customer?.phone].filter(Boolean).join(' · ')}>
              <CustomerInfo c={project.customer || {}} part="customer" />
            </SectionCard>
            <SectionCard tone="peach" icon={Truck} title="Alamat Pengiriman & Kurir" className="!p-4 self-start" foldKey="shipping" defaultOpen={false}
              summary={[project.customer?.ship?.attention, project.customer?.ship?.city, data.couriers?.find((k) => k.id === project.about?.courier)?.name, project.about?.resi_no && `Resi ${project.about.resi_no}`].filter(Boolean).join(' · ') || 'Belum ada alamat / kurir'}>
              <div className="space-y-4">
                <CustomerInfo c={project.customer || {}} part="shipping" />
                <CourierSelect value={project.about?.courier} printLocation={project.about?.print_location}
                  onChange={async (id) => { await save('projects', { ...project, about: { ...project.about, courier: id } }); notify('Kurir diperbarui') }} />
                <DeliveryRule type={deliveryType(project, data.couriers)} />
                <ResiFields about={project.about || {}} branch={project.branch} invoice={project.invoice_no}
                  onChange={async (patch) => { await save('projects', { ...project, about: { ...project.about, ...patch } }); notify('Info resi disimpan') }} />
              </div>
            </SectionCard>
          </div>
          )}
          <p className="mb-1 mt-4 text-[11px] font-semibold uppercase tracking-wide text-ink-mute">Progres</p>
          <div className="flex items-center gap-2"><Progress value={progressOf(project)} /><span className="text-xs font-bold">{progressOf(project)}%</span></div>
        </div>
      </Card>

      <h2 className="pt-2 font-bold">Sub Project <span className="text-ink-mute">({project.sub_projects.length})</span></h2>
      <div className="space-y-3">
        {project.sub_projects.map((s, i) => <SubProject key={s.id} n={i + 1} project={project} sub={s} />)}
      </div>

      <FileManager project={project} />

      <ProjectActivity project={project} />

      {editing && <ProjectForm project={project} onClose={() => setEditing(false)} />}
      {sharing && <ShareSheet project={project} open={sharing} onClose={() => setSharing(false)} />}
    </div>
  )
}

function SubProject({ n, project, sub }) {
  const flow = flowOf(sub, project)
  const stages = stagesOf(flow)
  const idx = stageIndex(flow, sub.stage)
  const [showLog, setShowLog] = useState(false)
  const done = sub.stage === DONE

  return (
    <Card className="overflow-hidden">
      <div className="flex items-start justify-between gap-2 p-4 pb-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-ink-mute">SUB {n}</p>
          <p className="font-bold">{sub.title}</p>
          <SubMeta sub={sub} />
        </div>
        {done ? <Pill className="bg-emerald-50 text-emerald-700"><Check className="h-3 w-3" />Selesai</Pill> : <Pill className="bg-brand-soft text-brand">{stages[idx]?.label}</Pill>}
      </div>

      {/* Stepper */}
      <p className="px-4 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-mute">Alur: {CATEGORIES[flow]?.label}</p>
      <div className="overflow-x-auto px-4 pb-3">
        <ol className="flex w-max min-w-full items-center gap-1">
          {stages.map((st, i) => (
            <li key={st.key} className="flex items-center gap-1">
              <span className={cx('flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold',
                i < idx ? 'bg-emerald-50 text-emerald-700' : i === idx ? 'bg-ink text-white' : 'bg-slate-100 text-ink-mute')}>
                {i < idx ? <Check className="h-3 w-3" /> : <span>{i + 1}</span>}{st.short || st.label}
              </span>
              {i < stages.length - 1 && <span className={cx('h-px w-3', i < idx ? 'bg-emerald-300' : 'bg-slate-200')} />}
            </li>
          ))}
        </ol>
      </div>

      {isVendorFlow(flow) && sub.stage !== 'pengajuan' && (
        <div className="mx-4 mb-3 rounded-xl bg-violet-50/60 p-3 ring-1 ring-violet-100">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-violet-800">Progres Pengajuan Vendor</p>
          <PengajuanTracker sub={sub} compact />
        </div>
      )}
      {['ap_int', 'lg_int'].includes(flow) && <BiayaPanel project={project} sub={sub} />}
      <Collected project={project} sub={sub} />
      {!done && <StagePanel project={project} sub={sub} stage={stages[idx]} />}

      <div className="border-t border-slate-100 px-4 py-2">
        <button onClick={() => setShowLog((v) => !v)} className="inline-flex items-center gap-1 text-xs font-semibold text-ink-mute hover:text-ink"><History className="h-3 w-3" />Riwayat ({sub.history?.length || 0})</button>
        {showLog && (
          <ul className="mt-2 space-y-1.5 pb-2">
            {[...(sub.history || [])].reverse().map((h, i) => (
              <li key={i} className="text-xs"><span className="font-semibold">{h.action}</span> <span className="text-ink-mute">· {h.by} · {jam(h.at)}</span></li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}

function SubMeta({ sub }) {
  const { nameOf } = useApp()
  const name = nameOf
  const type = SUB_TYPES[sub.type] ?? SUB_TYPES.jasa_lain
  const pts = points(sub.description)
  const info = [
    ['terjemahan', 'terjemahan_nt'].includes(sub.type) && sub.lang_from && `${sub.lang_from} → ${sub.lang_to}`,
    `${sub.file_count ?? pts.length} file`, `${sub.pages ?? "—"} hlm`,
    sub.country && `Negara: ${sub.country}`,
    sub.applicant_id && `ID Pemohon / NIB / SK: ${sub.applicant_id}`,
    sub.institution && `Lembaga: ${name(sub.institution) ?? '—'}`,
    sub.executor_id && `Eksekutor: ${name(sub.executor_id) ?? '—'} (${sub.executor_kind === 'vendor' ? 'vendor' : 'staf'})`,
    sub.type === 'terjemahan' && (sub.translator_kind === 'vendor' ? `Vendor: ${name(sub.translator) ?? '—'}` : `Penerjemah: ${name(sub.data?.translator || sub.translator) ?? 'ditentukan Supervisor'}`),
    sub.type === 'terjemahan_nt' && `Penerjemah: ${name(sub.data?.translator || sub.translator) ?? '—'}`,
  ].filter(Boolean)
  return (
    <div className="mt-1">
      <p className="text-xs text-ink-mute"><span className="font-semibold text-ink-soft">{type.label}</span> · {info.join(' · ')}</p>
      {sub.type === 'terjemahan' && sub.docs?.length
        ? <ol className="mt-1.5 list-decimal space-y-0.5 pl-4 text-xs text-ink-soft">{sub.docs.filter((d) => d.desc.trim()).map((d, i) => <li key={i}>{d.desc} <span className="text-ink-mute">· {d.pages} hlm</span>{d.kind === 'non_reguler' && <span className="ml-1 rounded bg-violet-50 px-1 text-[10px] font-semibold text-violet-700">Non Reguler</span>}<RegNo n={sub.data?.reg_numbers?.[i]} /></li>)}</ol>
        : pts.length > 1 ? <ol className="mt-1.5 list-decimal space-y-0.5 pl-4 text-xs text-ink-soft">{pts.map((p, i) => <li key={i}>{p}<RegNo n={sub.data?.reg_numbers?.[i]} /></li>)}</ol>
        : <RegNo n={sub.data?.reg_numbers?.[0]} block />}
    </div>
  )
}

/** Ringkasan isian dari tahap-tahap yang sudah lewat. */
function Collected({ project, sub }) {
  const { data, user } = useApp()
  const flow = flowOf(sub, project)
  const stages = stagesOf(flow)
  const idx = stageIndex(flow, sub.stage)
  const items = stages.slice(0, idx).flatMap((st) => st.fields).filter((f) => sub.data?.[f.key])
  if (!items.length) return null
  return (
    <div className="mx-4 mb-3 grid gap-x-4 gap-y-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-2">
      {items.map((f) => <div key={f.key} className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wide text-ink-mute">{f.label}</p><Value f={f} v={sub.data[f.key]} d={sub.data} people={[...data.users, ...data.people]} canFund={can.seeFunding(user)} /></div>)}
    </div>
  )
}

function Value({ f, v, people, d = {}, canFund }) {
  if (f.type.startsWith('person:') || f.type.startsWith('user:')) return <p className="truncate text-sm font-semibold">{people.find((p) => p.id === v)?.name ?? '—'}</p>
  if (f.type === 'vendor_service') return <p className="text-sm font-semibold">{v} <span className="font-normal text-ink-mute">· {rupiah(d.vendor_cost)}</span></p>
  if (f.type === 'computed') return <p className="text-sm font-bold">{rupiah(v)}</p>
  if (f.type === 'sumber_dana') return canFund ? <p className="text-sm font-semibold">{sumberLabel(v)}</p> : <p className="text-sm text-ink-mute">Disetujui Direktur</p>
  if (f.type === 'vendor_account') return <p className="text-sm">{accountLabel(v)}</p>
  if (f.type === 'money') return <p className="text-sm font-semibold">{rupiah(v)}</p>
  if (f.type === 'date') return <p className="text-sm font-semibold">{tgl(v)}</p>
  if (f.type === 'file') return <div className="space-y-0.5">{fieldFiles(d, f.key).map((x, i) => <FileChip key={i} file={x} />)}</div>
  if (f.type === 'checklist') return <p className="text-sm">{(f.items || []).map((it) => <span key={it} className={cx('mr-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold ring-1', (Array.isArray(v) ? v : []).includes(it) ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-50 text-ink-mute ring-slate-200')}>{(Array.isArray(v) ? v : []).includes(it) ? '✔' : '○'} {it}</span>)}</p>
  if (f.type === 'reg_numbers') return <div className="space-y-0.5">{(Array.isArray(v) ? v : []).map((x, i) => <p key={i} className="text-sm"><span className="text-ink-mute">{i + 1}.</span> <span className="font-mono font-semibold">{x || '—'}</span></p>)}</div>
  return <p className="text-sm">{v}</p>
}

function FileChip({ file }) {
  if (!file) return null
  const Inner = <><FileText className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{file.name}</span><span className="shrink-0 text-ink-mute">{kb(file.size)}</span>{file.url && <Download className="h-3.5 w-3.5 shrink-0" />}</>
  return file.url
    ? <a href={file.url} download={file.name} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-brand">{Inner}</a>
    : <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold">{Inner}</span>
}

function StagePanel({ project, sub, stage }) {
  const { user, data, processStage, notify, pettyBalance, claimSub, nameOf, patchSubData } = useApp()
  const [vals, setVals] = useState({})
  const [busy, setBusy] = useState(null)
  const [uploading, setUploading] = useState(null)
  const [previewFile, setPreviewFile] = useState(null)
  useEffect(() => {
    const init = Object.fromEntries(stage.fields.map((f) => [f.key, sub.data?.[f.key] ?? (f.type === 'date' ? new Date().toISOString().slice(0, 10) : '')]))
    stage.fields.filter((f) => f.type === 'file').forEach((f) => { init[`${f.key}_list`] = fieldFiles(sub.data, f.key) })
    stage.fields.filter((f) => f.type === 'sumber_dana' && !init[f.key]).forEach((f) => { init[f.key] = recommendFund(project.branch) })
    if (stage.fields.some((f) => f.type === 'vendor_service')) init.vendor_cost = sub.data?.vendor_cost ?? ''
    if (stage.fields.some((f) => f.type === 'vendor_account')) init.rekening = sub.data?.rekening || data.people.find((p) => p.id === sub.data?.vendor)?.accounts?.[0] || ''
    setVals(init)
  }, [stage.key, sub.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const claim = activeClaim(sub)
  // Super Admin, Direktur & Admin Pusat boleh melanjutkan tahap tanpa menunggu role penanggung jawab (dengan alasan, tercatat di riwayat)
  const canOverride = ['superadmin', 'direktur', 'admin_pusat'].includes(user.role)
  const normal = can.processStage(user, stage, sub, project)
  const isOwnerRole = stage.roles.includes(user.role) && !(stage.assignee && sub.data?.[stage.assignee] && sub.data[stage.assignee] !== user.id) && !(stage.claimable && user.role !== 'otorisator') && !(stage.printBranch && !branchesOf(user).includes(project.about?.print_location || project.branch))
  const [overrideMode, setOverrideMode] = useState(false)
  const [reason, setReason] = useState('')
  const overriding = canOverride && !isOwnerRole && (overrideMode || normal)
  const allowed = normal || (canOverride && overrideMode)
  const needClaim = stage.claimable && user.role !== 'superadmin' && !overriding && (!claim || claim.by !== user.id)
  const peopleOf = useMemo(() => (type) => data.people.filter((p) => p.type === type && (p.branch === project.branch || p.branch === 'Semua')), [data.people, project.branch])

  if (!allowed) {
    const who = claim && stage.claimable ? `${claim.name} (sedang diproses)`
      : stage.assignee && sub.data?.[stage.assignee] ? nameOf(sub.data[stage.assignee])
      : stage.printBranch ? `staf cabang ${project.about?.print_location || project.branch}`
      : stage.roles.filter((r) => r !== 'superadmin').map((r) => ROLES[r].label).join(' / ')
    return (
      <div className="mx-4 mb-3 flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
        <Lock className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1">Menunggu <b>{who}</b> memproses tahap <b>{stage.label}</b>.</span>
        <PingButton project={project} sub={sub} stage={stage} />
        {canOverride && <Button size="sm" variant="outline" onClick={() => setOverrideMode(true)} title="Lewati menunggu role ini — wajib isi alasan & data tahap"><FastForward className="h-3.5 w-3.5" />Lanjutkan ke Tahap Berikutnya</Button>}
      </div>
    )
  }
  const doClaim = async (take) => {
    try { await claimSub(project, sub.id, take); notify(take ? 'Dokumen diambil — tandai sedang diproses' : 'Dokumen dilepas') } catch (e) { notify(e.message, 'err') }
  }
  if (needClaim) return (
    <div className="mx-4 mb-3 flex flex-wrap items-center gap-3 rounded-xl bg-violet-50 p-3 ring-1 ring-violet-200">
      <Hand className="h-5 w-5 shrink-0 text-violet-600" />
      <p className="min-w-0 flex-1 text-xs text-violet-900"><b>{stage.label}</b> — dokumen di To-Do bersama. Ambil dulu agar tidak dikerjakan bersamaan.</p>
      <Button size="sm" onClick={() => doClaim(true)}><Hand className="h-3.5 w-3.5" />Ambil & Proses</Button>
    </div>
  )
  // tahap akhir: syarat "selesai" mengikuti metode pengiriman
  const dType = deliveryType(project, data.couriers)
  const needDelivery = ['siap_kirim', 'cs_final'].includes(stage.key) || (stage.key === 'proses_vendor' && dType === 'vendor')
  const delivery = needDelivery ? deliveryOk(project, sub, data.couriers) : { ok: true }
  const printDoc = sub.data?.file_final || sub.data?.hasil_proofread || sub.data?.hasil_terjemahan
  const isPdf = printDoc && (/\.pdf$/i.test(printDoc.name) || printDoc.url?.startsWith('data:application/pdf'))
  const getBlob = async () => (printDoc.url?.startsWith('data:') ? dataUrlToBlob(printDoc.url) : drive.blob(printDoc))
  const doPrint = async () => { try { await printBlob(await getBlob(), 'pdf') } catch (e) { notify(e.message, 'err') } }

  const run = async (advance) => {
    setBusy(advance ? 'go' : 'save')
    try {
      const clean = Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, stage.fields.find((f) => f.key === k)?.type === 'money' ? Number(v) || '' : v]))
      if (advance && overriding) { if (!reason.trim()) throw new Error('Isi alasan melewati proses'); clean.__override = reason.trim() }
      await processStage(project, sub.id, clean, advance)
      if (advance && overriding) { setOverrideMode(false); setReason('') }
      notify(advance ? `${sub.title}: ${stage.label} selesai` : 'Tersimpan')
    } catch (e) { notify(e.message, 'err') } finally { setBusy(null) }
  }

  return (
    <div className="mx-4 mb-3 rounded-xl ring-2 ring-brand/20">
      <div className={cx('rounded-t-xl px-3 py-2', overriding ? 'bg-amber-100' : 'bg-brand-soft')}><p className={cx('text-xs font-bold', overriding ? 'text-amber-900' : 'text-brand')}>Tahap saat ini: {stage.label}{overriding && ' · Mode lanjutkan tanpa menunggu role'}</p>{stage.hint && <p className="text-[11px] text-ink-soft">{stage.hint}</p>}</div>
      <div className="space-y-3 p-3">
        {stage.claimable && claim && (
          <div className="flex items-center gap-2 rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-900 ring-1 ring-violet-200">
            <Hand className="h-4 w-4" /><span className="flex-1">Sedang diproses oleh <b>{claim.name}</b> sejak {jam(claim.at)}</span>
            <button type="button" onClick={() => doClaim(false)} className="inline-flex items-center gap-1 font-semibold text-violet-700 hover:underline"><Unlock className="h-3.5 w-3.5" />Lepas</button>
          </div>
        )}
        {stage.showSource && (
          sub.data?.dokumen_sumber ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <div className="min-w-0 basis-full"><p className="text-[11px] font-semibold text-ink-mute">Dokumen sumber dari CS</p><FileChip file={sub.data.dokumen_sumber} /></div>
              <Button size="sm" variant="outline" onClick={async () => { try { const f = sub.data.dokumen_sumber; await saveBlob(f.name, f.url?.startsWith('data:') ? dataUrlToBlob(f.url) : await drive.blob(f)) } catch (e) { notify(e.message, 'err') } }}><Download className="h-3.5 w-3.5" />Download Dokumen Sumber</Button>
              <Button size="sm" variant="outline" onClick={() => setPreviewFile(sub.data.dokumen_sumber)}><Eye className="h-3.5 w-3.5" />Preview</Button>
              {previewFile && !stage.print && <FilePreview file={previewFile} onClose={() => setPreviewFile(null)} />}
            </div>
          ) : <p className="text-xs text-ink-mute">Dokumen sumber belum diunggah CS.</p>
        )}
        {stage.print && (
          printDoc ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <div className="min-w-0 basis-full"><p className="text-[11px] font-semibold text-ink-mute">Dokumen untuk dicetak · lokasi Print: {project.about?.print_location || project.branch}</p><FileChip file={printDoc} /></div>
              <Button size="sm" variant="outline" onClick={async () => { try { await saveBlob(printDoc.name, await getBlob()) } catch (e) { notify(e.message, 'err') } }}><Download className="h-3.5 w-3.5" />Download Dokumen</Button>
              {isPdf && <Button size="sm" variant="outline" onClick={() => setPreviewFile(printDoc)}><Eye className="h-3.5 w-3.5" />Preview</Button>}
              {isPdf && <Button size="sm" variant="dark" onClick={doPrint}><Printer className="h-3.5 w-3.5" />Print</Button>}
              {previewFile && <FilePreview file={previewFile} onClose={() => setPreviewFile(null)} />}
            </div>
          ) : <p className="text-xs text-ink-mute">Belum ada file dokumen final.</p>
        )}
        {stage.fields.map((f) => {
          const v = vals[f.key] ?? ''
          const set = (x) => setVals((o) => ({ ...o, [f.key]: x }))
          if (f.type.startsWith('user:')) {
            const role = f.type.split(':')[1]
            const opts = data.users.filter((u) => u.role === role && u.active !== false)
              .sort((a, b) => (b.branch === project.branch) - (a.branch === project.branch) || a.name.localeCompare(b.name))
            return <Field key={f.key} label={f.label} required={f.required} hint={!opts.length ? `Belum ada pengguna ${ROLES[role].label} — tambahkan di Setting → Pengguna` : undefined}>
              <Select value={v} onChange={(e) => set(e.target.value)}>
                <option value="">— Pilih {ROLES[role].label} —</option>
                {opts.map((u) => <option key={u.id} value={u.id}>{u.name} · {placeOf(u)}</option>)}
              </Select>
            </Field>
          }
          if (f.type.startsWith('person:')) {
            const type = f.type.split(':')[1]; const opts = peopleOf(type)
            return <Field key={f.key} label={f.label} required={f.required} hint={!opts.length ? `Belum ada ${PERSON_TYPES[type]} — tambahkan di Setting` : undefined}>
              <Select value={v} onChange={(e) => (f.key === 'vendor' ? setVals((o) => ({ ...o, vendor: e.target.value, vendor_service: '', vendor_cost: '', rekening: '' })) : set(e.target.value))}><option value="">— Pilih {PERSON_TYPES[type]} —</option>{opts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
            </Field>
          }
          if (f.type === 'vendor_service') {
            const vendor = data.people.find((p) => p.id === (vals.vendor || sub.data?.vendor))
            const services = vendor?.services || []
            return <Field key={f.key} label={f.label} required={f.required}
              hint={!vendor ? 'Pilih vendor dulu' : !services.length ? 'Vendor ini belum punya daftar layanan — isi di Setting → Vendor' : undefined}>
              <Select value={v} disabled={!services.length} onChange={(e) => { const sv = services.find((x) => x.name === e.target.value); setVals((o) => ({ ...o, vendor_service: sv?.name ?? '', vendor_cost: sv ? Number(sv.price) : '' })) }}>
                <option value="">— Pilih layanan —</option>
                {services.map((x) => <option key={x.name} value={x.name}>{x.name} — {rupiah(x.price)}</option>)}
              </Select>
            </Field>
          }
          if (f.type === 'sumber_dana') return <Field key={f.key} label={f.label} required={f.required} hint={`Rekomendasi ${recommendFund(project.branch)} (cabang ${project.branch}) — sudah dipilih otomatis, tinggal ACC`}><SumberDanaPicker value={v} onChange={set} recommended={recommendFund(project.branch)} /></Field>
          if (f.type === 'choice') return <Field key={f.key} label={f.label} required={f.required}>
            <Select value={v} onChange={(e) => set(e.target.value)}><option value="">Tanpa ongkir</option>{f.options.map((o) => <option key={o}>{o}</option>)}</Select>
          </Field>
          if (f.type === 'computed') return (
            <div key={f.key} className="flex items-center justify-between rounded-xl bg-ink px-4 py-3 text-white">
              <span className="text-xs font-semibold uppercase tracking-wide text-white/70">{f.label}</span>
              <span className="text-lg font-extrabold tabular-nums">{rupiah((Number(vals.vendor_cost) || 0) + (Number(vals.ongkir_cost) || 0))}</span>
            </div>
          )
          if (f.type === 'vendor_account') {
            const acc = data.people.find((p) => p.id === sub.data?.vendor)?.accounts?.[0]
            return (
              <Field key={f.key} label="Rekening Penerima" required={f.required} hint={!acc ? 'Vendor belum punya rekening — isi di Setting → Vendor' : 'Dari Setting → Vendor (rekening utama)'}>
                {acc ? (
                  <dl className="grid grid-cols-[90px_1fr] gap-x-3 gap-y-1 rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-slate-300">
                    <dt className="text-ink-mute">Bank</dt><dd><CopyText text={acc.bank} label="Bank" strong /></dd>
                    <dt className="text-ink-mute">No. Rekening</dt><dd><CopyText text={acc.number} label="No. Rekening" strong mono /></dd>
                    <dt className="text-ink-mute">Penerima</dt><dd><CopyText text={acc.holder} label="Nama Penerima" /></dd>
                    <dt className="text-ink-mute">No. Invoice</dt><dd><CopyText text={project.invoice_no} label="No. Invoice" /></dd>
                    <dt className="text-ink-mute">Pelanggan</dt><dd><CopyText text={project.customer?.name} label="Nama Pelanggan" /></dd>
                  </dl>
                ) : <span />}
              </Field>
            )
          }
          if (f.type === 'money') return <Field key={f.key} label={f.label} required={f.required}
            hint={stage.effect === 'pettycash_out' ? `Saldo petty cash apostille: ${rupiah(pettyBalance('Apostille'))}` : (v ? rupiah(v) : undefined)}>
            <Input type="number" inputMode="numeric" min="0" value={v} onChange={(e) => set(e.target.value)} placeholder="0" />
          </Field>
          if (f.type === 'date') return <Field key={f.key} label={f.label} required={f.required}><Input type="date" value={v} onChange={(e) => set(e.target.value)} /></Field>
          if (f.type === 'checklist') {
            const cur = Array.isArray(v) ? v : []; const items = f.items || []; const doneN = items.filter((it) => cur.includes(it)).length
            const tick = async (it) => {
              const n = cur.includes(it) ? cur.filter((x) => x !== it) : [...cur, it]
              set(n)
              try { await patchSubData(project, sub.id, { [f.key]: n }, `${cur.includes(it) ? 'Batal centang' : 'Centang'} ${it} (${f.label})`) } catch (e) { notify(e.message, 'err') }
            }
            return (
              <Field key={f.key} label={`${f.label} · ${doneN}/${items.length}`} required={f.required} hint={doneN < items.length ? 'Centang setiap langkah yang sudah dikerjakan — tersimpan otomatis.' : 'Semua langkah selesai ✔'}>
                <ol className="grid gap-1.5 sm:grid-cols-3">{items.map((it, i) => {
                  const on = cur.includes(it)
                  return (
                    <li key={it}>
                      <label className={cx('flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 ring-1 transition', on ? 'bg-emerald-50 ring-emerald-300' : 'bg-white ring-slate-200 hover:ring-brand')}>
                        <input type="checkbox" checked={on} onChange={() => tick(it)} className="h-4 w-4 rounded border-slate-300 text-brand" aria-label={it} />
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-slate-100 text-[10px] font-bold text-ink-soft">{i + 1}</span>
                        <span className={cx('text-sm font-semibold', on ? 'text-emerald-800 line-through decoration-emerald-400' : 'text-ink')}>{it}</span>
                      </label>
                    </li>
                  )
                })}</ol>
              </Field>
            )
          }
          if (f.type === 'reg_numbers') {
            const list = docListOf(sub); const cur = Array.isArray(v) ? v : []
            return (
              <Field key={f.key} label={f.label} required={f.required} hint="Nomor ini tampil di daftar dokumen sub project sebagai acuan penulisan pada hasil cetak.">
                <ol className="space-y-1.5">{list.map((name, i) => (
                  <li key={i} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-soft text-[11px] font-bold text-brand">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-sm" title={name}>{name}</span>
                    <Input value={cur[i] || ''} onChange={(e) => { const n = [...cur]; n[i] = e.target.value; set(n) }} placeholder="No. registrasi" className="!w-40 !py-1.5 font-mono text-sm" aria-label={`Nomor registrasi dokumen ${i + 1}`} />
                  </li>
                ))}</ol>
              </Field>
            )
          }
          if (f.type === 'file') return (
            <Field key={f.key} label={f.label} required={f.required} hint="Bisa lebih dari satu file · otomatis masuk File Project (tanpa ganda)">
              <StageFiles project={project} sub={sub} list={fieldFiles(vals, f.key)} accept={f.accept}
                onChange={(list) => setVals((o) => ({ ...o, [f.key]: list[0] || '', [`${f.key}_list`]: list }))} onBusy={(b) => setUploading(b ? f.key : null)} />
            </Field>
          )
          return <Field key={f.key} label={f.label} required={f.required}><Textarea rows={2} value={v} onChange={(e) => set(e.target.value)} /></Field>
        })}
        {/* Rincian pengajuan untuk Direktur / Akunting */}
        {['persetujuan', 'pembayaran', 'dibayar'].includes(stage.key) && <PengajuanSummary sub={sub} />}
        {stage.key === 'dibayar' && sub.data?.bukti_transfer && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-emerald-50 p-3">
            <div className="min-w-0 flex-1"><p className="mb-1 text-[11px] font-semibold text-emerald-700">Bukti transfer · dibayar {tgl(sub.data.paid_date)}</p><FileChip file={sub.data.bukti_transfer} /></div>
            <DownloadBukti file={sub.data.bukti_transfer} />
          </div>
        )}
        {needDelivery && <DeliveryChecklist project={project} sub={sub} />}
        {needDelivery && !delivery.ok && <p className="text-[11px] font-semibold text-amber-800">{delivery.reason}</p>}
        {overriding && (
          <div className="mb-1 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-2.5 text-[11px] text-ink-soft ring-1 ring-slate-200"><span className="min-w-0 flex-1">Tahap ini milik role lain — Anda bisa mengingatkan PIC-nya tanpa mengubah status.</span><PingButton project={project} sub={sub} stage={stage} /></div>
        )}
        {overriding && (
          <div className="rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200">
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-amber-900"><FastForward className="h-3.5 w-3.5" />Melewati proses role {stage.roles.filter((r) => r !== 'superadmin').map((r) => ROLES[r].label).join(' / ')}</p>
            <p className="mb-2 text-[11px] text-amber-800">Kelengkapan data tahap ini tetap wajib. Tindakan dicatat di riwayat: pelaksana, waktu, tahap asal → tujuan, dan alasan.</p>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Alasan melewati proses (wajib)" aria-label="Alasan melewati proses" aria-invalid={!reason.trim()} />
          </div>
        )}
        <div className="flex gap-2 pt-1">
          {overrideMode && <Button variant="outline" onClick={() => { setOverrideMode(false); setReason('') }}>Batal</Button>}
          {stage.fields.length > 0 && !overriding && <Button variant="outline" className="flex-1" loading={busy === 'save'} disabled={!!uploading} onClick={() => run(false)}>Simpan</Button>}
          <Button className="flex-[2]" loading={busy === 'go'} disabled={!!uploading || (needDelivery && !delivery.ok) || (overriding && !reason.trim())} onClick={() => run(true)} variant={overriding ? 'dark' : 'primary'}>{overriding ? 'Lanjutkan ke Tahap Berikutnya' : stage.action} →</Button>
        </div>
      </div>
    </div>
  )
}

/** File di tahap alur kerja: banyak file, upload baru atau ambil dari File Project (tidak diunggah ulang). */
function StageFiles({ project, sub, list, onChange, onBusy, accept }) {
  const { user, notify } = useApp()
  const [busy, setBusy] = useState(null)
  const [pick, setPick] = useState(null) // Set id terpilih dari File Project
  const ids = new Set(list.map(fileIdentity))
  const allFiles = collectFiles(project)
  const pool = allFiles.filter((f) => !ids.has(fileIdentity(f)))
  const [reviewNames, namerDialog] = useUploadNamer({ existing: [...allFiles.map((f) => f.name), ...list.filter((x) => !allFiles.some((f) => fileIdentity(f) === fileIdentity(x))).map((x) => x.name)], invoice: project.invoice_no })
  const strip = ({ key, kind, subId, fieldKey, index, source, usedIn, ...f }) => f // eslint-disable-line no-unused-vars
  const add = async (files) => {
    const arr = await reviewNames(files); if (!arr) return
    onBusy(true)
    try {
      const up = await uploadProjectFiles(arr.map(({ file, name }) => ({ file, name, sub_id: sub.id })), { branch: project.branch, invoice: project.invoice_no, by: user.name }, (i, n) => setBusy(`Mengunggah ${i}/${n}…`))
      onChange([...list, ...up]); notify(`${up.length} file ditambahkan`)
    } catch (e) { notify(e.message, 'err') } finally { setBusy(null); onBusy(false) }
  }
  return (
    <div className="space-y-2">
      {list.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-xl bg-slate-50 ring-1 ring-slate-200">
          {list.map((x, i) => (
            <li key={fileIdentity(x) || i} className="flex items-center gap-2 px-3 py-2">
              <div className="min-w-0 flex-1"><FileChip file={x} /></div>
              <button type="button" className="text-xs font-semibold text-rose-500" onClick={() => onChange(list.filter((_, j) => j !== i))} aria-label={`Lepas ${x.name}`}>Lepas</button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 px-3 py-3 text-xs font-semibold text-ink-soft hover:border-brand hover:text-brand">
          {busy ? <><Loader2 className="h-4 w-4 animate-spin" />{busy}</> : <><Upload className="h-4 w-4" />{list.length ? 'Tambah file' : 'Pilih / foto file'} (bisa banyak)</>}
          <input type="file" multiple className="hidden" accept={accept || 'image/*,application/pdf,.doc,.docx'} onChange={(e) => { const fl = [...e.target.files]; e.target.value = ''; add(fl) }} aria-label="Upload file tahap" />
        </label>
        <button type="button" disabled={!pool.length} onClick={() => setPick(pick ? null : new Set())}
          className="flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs font-semibold text-ink-soft ring-1 ring-slate-200 hover:text-brand hover:ring-brand disabled:opacity-40" title={pool.length ? 'Pakai file yang sudah ada di File Project' : 'Belum ada file lain di File Project'}>
          <FolderOpen className="h-4 w-4" />Ambil dari File Project{pool.length ? ` (${pool.length})` : ''}
        </button>
      </div>
      {pick && (
        <div className="rounded-xl bg-white p-2 ring-1 ring-brand/30">
          <ul className="max-h-52 space-y-0.5 overflow-y-auto">
            {pool.map((f) => (
              <li key={f.key}><label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-slate-50">
                <input type="checkbox" checked={pick.has(f.key)} onChange={() => setPick((s) => { const n = new Set(s); n.has(f.key) ? n.delete(f.key) : n.add(f.key); return n })} />
                <span className="min-w-0 flex-1 truncate font-semibold">{f.name}</span><span className="shrink-0 text-ink-mute">{f.source} · {kb(f.size || 0)}</span>
              </label></li>
            ))}
          </ul>
          <div className="mt-2 flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setPick(null)}>Batal</Button>
            <Button size="sm" disabled={!pick.size} onClick={() => { onChange([...list, ...pool.filter((f) => pick.has(f.key)).map(strip)]); setPick(null) }}><Check className="h-3.5 w-3.5" />Pakai {pick.size || ''} file</Button>
          </div>
        </div>
      )}
      {namerDialog}
    </div>
  )
}

/** Riwayat aktivitas project: tahap, file, edit, tagihan & petty cash terkait. */
function ProjectActivity({ project }) {
  const { data, user } = useApp()
  // tagihan vendor & sumber dana hanya untuk Superadmin, Direktur, Akunting
  const items = useMemo(() => projectActivities(data, project).filter((a) => a.kind !== 'finance' || can.seeFunding(user)), [data, project, user])
  return (
    <SectionCard tone="sky" icon={History} title={`Riwayat Aktivitas (${items.length})`} className="!bg-white" foldKey="project-activity"
      summary={items[0] ? `Terakhir: ${items[0].by || 'Sistem'} — ${items[0].action}` : 'Belum ada aktivitas'}>
      <div className="-mx-4 -mb-4 max-h-[480px] overflow-y-auto border-t border-slate-100 sm:-mx-6 sm:-mb-6"><ActivityList items={items} pageSize={40} /></div>
    </SectionCard>
  )
}

/** Nomor registrasi dokumen (acuan penulisan pada hasil cetak). */
function RegNo({ n, block }) {
  if (!n) return null
  return <span className={cx('rounded-md bg-amber-50 px-1.5 py-px font-mono text-[11px] font-bold text-amber-800 ring-1 ring-amber-200', block ? 'mt-1.5 inline-block' : 'ml-1.5')} title="Nomor registrasi">No. Reg {n}</span>
}
