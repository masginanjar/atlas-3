import { useMemo, useState } from 'react'
import { Stamp, Play, FolderOpen, Eye, Loader2, Search, CheckCircle2, Clock3, Upload } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { can, scopeByBranch, branchesOf } from '../config/access.js'
import { flowOf, stagesOf, stageLabel, DONE, stafStatus, totalBiaya } from '../config/workflows.js'
import { SUB_TYPES } from '../config/subtypes.js'
import { DeadlineCell } from '../components/badges.jsx'
import { PriorityBadge } from '../components/Priority.jsx'
import CopyText from '../components/CopyText.jsx'
import FileManager from '../components/FileManager.jsx'
import ProjectDetail, { StagePanel } from './ProjectDetail.jsx'
import { Button, Card, Empty, Input, Sheet, cx } from '../components/ui.jsx'
import { rupiah } from '../lib/format.js'

// ============================================================
//  MY APOSTILLE — pekerjaan apostille & legalisasi internal.
//  Staf Apostille melihat tugasnya; Supervisor/Direktur/Superadmin & Admin Pusat
//  melihat seluruh pekerjaan + siapa pelaksananya. Data sama dengan My Project.
// ============================================================
import { canSeeApostille } from '../config/menuAccess.js'
export { canSeeApostille }
const IS_AP = (flow) => ['ap_int', 'lg_int'].includes(flow)
const TABS = [
  ['antrian', 'Belum diproses', Clock3],
  ['diproses', 'Sedang diproses', Loader2],
  ['cs_upload', 'Menunggu dokumen CS', Upload],
  ['selesai', 'Selesai', CheckCircle2],
]

export default function Apostille() {
  const { user, data, nameOf, branchFilter } = useApp()
  const [tab, setTab] = useState('antrian')
  const [q, setQ] = useState('')
  const [detailFor, setDetailFor] = useState(null)
  const [filesFor, setFilesFor] = useState(null)
  const [workFor, setWorkFor] = useState(null) // { project, sub }
  const mine = user.role === 'staf_apostille'

  const rows = useMemo(() => {
    const scoped = scopeByBranch(user, data.projects, branchFilter)
    return scoped.flatMap((p) => (p.sub_projects || [])
      .filter((s) => IS_AP(flowOf(s, p)))
      .map((s) => ({ project: p, sub: s, flow: flowOf(s, p) })))
      .sort((a, b) => new Date(a.project.about?.deadline || 0) - new Date(b.project.about?.deadline || 0))
  }, [user, data.projects, branchFilter])

  const inTab = (r, k) => (k === 'selesai' ? r.sub.stage === DONE : r.sub.stage === k)
  const match = (r) => { const s = q.trim().toLowerCase(); return !s || [r.project.invoice_no, r.project.customer?.name, r.sub.title, r.sub.country, r.project.branch].join(' ').toLowerCase().includes(s) }
  const list = rows.filter((r) => inTab(r, tab) && match(r))
  const count = (k) => rows.filter((r) => inTab(r, k) && match(r)).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-tight sm:text-2xl"><Stamp className="h-5 w-5 text-ink-soft" />My Apostille</h1>
          <p className="text-sm text-ink-mute">{mine ? 'Pekerjaan apostille & legalisasi yang ditugaskan kepada Anda' : 'Seluruh pekerjaan apostille & legalisasi internal — data sama dengan My Project'}</p>
        </div>
        <a href="#/projects" className="text-xs font-semibold text-brand hover:underline">Buka My Project →</a>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" onClick={() => setTab(k)} aria-pressed={tab === k}
            className={cx('rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition',
              tab === k ? 'bg-[var(--surface-3)] text-ink ring-[var(--line)]' : 'bg-white text-ink-mute ring-slate-200 hover:text-ink')}>
            {label} <span className="ml-1 text-ink-mute">{count(k)}</span>
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input className="pl-9" placeholder="Cari invoice, pelanggan, dokumen, negara…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {list.length === 0 ? (
        <Card><Empty icon={Stamp} title="Tidak ada pekerjaan di tahap ini" text={mine ? 'Tugas apostille/legalisasi baru akan muncul di sini.' : 'Coba tab lain atau ubah pencarian.'} /></Card>
      ) : (
        <Card className="overflow-visible">
          <div className="pointer-events-none sticky top-[var(--appbar)] z-10 hidden grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)_minmax(0,1fr)_104px_minmax(0,1fr)_170px] gap-3 rounded-t-2xl border-b border-slate-200 bg-slate-50/95 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-mute backdrop-blur lg:grid">
            <span>Invoice & Pelanggan</span><span>Dokumen</span><span>Negara / Lembaga</span><span>Deadline</span><span>Pelaksana & Biaya</span><span className="text-right">Tahap & Aksi</span>
          </div>
          <ul className="divide-y divide-slate-200/70">
            {list.map(({ project, sub, flow }, i) => (
              <Row key={sub.id} project={project} sub={sub} flow={flow} alt={i % 2 === 1} nameOf={nameOf} canCost={can.seeFunding?.(user) ?? false}
                active={detailFor?.id === project.id || workFor?.sub?.id === sub.id}
                onDetail={() => { setDetailFor(project); setFilesFor(null); setWorkFor(null) }}
                onFiles={() => { setFilesFor(project); setDetailFor(null); setWorkFor(null) }}
                onWork={() => { setWorkFor({ project, sub }); setDetailFor(null); setFilesFor(null) }} />
            ))}
          </ul>
        </Card>
      )}

      {workFor && (
        <Sheet open side wide onClose={() => setWorkFor(null)} title={workFor.sub.title}
          subtitle={`${workFor.project.invoice_no} · ${workFor.project.customer?.name || ''} · ${stageLabel(flowOf(workFor.sub, workFor.project), workFor.sub.stage)}`}
          footer={<><Button variant="outline" className="flex-1 sm:flex-none sm:px-6" onClick={() => setWorkFor(null)}>Tutup</Button><span className="flex-1" />
            <Button variant="outline" size="sm" onClick={() => { setDetailFor(workFor.project); setWorkFor(null) }}><Eye className="h-3.5 w-3.5" />Detail project</Button></>}>
          <WorkBody project={projectNow(data, workFor.project)} sub={subNow(data, workFor.project, workFor.sub)} />
        </Sheet>
      )}
      {filesFor && (
        <Sheet open side onClose={() => setFilesFor(null)} title="File Project" subtitle={`${filesFor.invoice_no} · ${filesFor.customer?.name || ''}`}
          footer={<Button variant="outline" className="flex-1" onClick={() => setFilesFor(null)}>Tutup</Button>}>
          <FileManager project={projectNow(data, filesFor)} />
        </Sheet>
      )}
      {detailFor && (
        <Sheet open side wide onClose={() => setDetailFor(null)} title={detailFor.invoice_no} subtitle={`${detailFor.customer?.name || ''} · ${detailFor.branch}`}
          footer={<><Button variant="outline" className="flex-1 sm:flex-none sm:px-6" onClick={() => setDetailFor(null)}>Tutup</Button><span className="flex-1" />
            <a href={`#/projects/${detailFor.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">Halaman penuh →</a></>}>
          <ProjectDetail id={detailFor.id} embedded />
        </Sheet>
      )}
    </div>
  )
}

const projectNow = (data, p) => data.projects.find((x) => x.id === p.id) || p
const subNow = (data, p, s) => (projectNow(data, p).sub_projects || []).find((x) => x.id === s.id) || s

/** Isi panel kerja: panel tahap resmi (checklist, biaya, upload hasil) + file project. */
function WorkBody({ project, sub }) {
  const flow = flowOf(sub, project)
  const stage = stagesOf(flow).find((x) => x.key === sub.stage)
  if (!stage) return <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200">Pekerjaan ini sudah selesai.</p>
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white ring-1 ring-slate-200"><StagePanel project={project} sub={sub} stage={stage} /></div>
      <FileManager project={project} readOnly />
    </div>
  )
}

function Row({ project, sub, flow, alt, active, nameOf, canCost, onDetail, onFiles, onWork }) {
  const { processStage, notify } = useApp()
  const [busy, setBusy] = useState(false)
  const staf = sub.data?.staff_apostille ? nameOf(sub.data.staff_apostille) : null
  const docs = (sub.docs || []).filter((d) => d?.desc?.trim())
  const biaya = totalBiaya(sub.data)
  const done = sub.stage === DONE
  // "Mulai Proses" tidak butuh isian apa pun → bisa langsung dari baris
  const quickStart = sub.stage === 'antrian'
  const start = async () => {
    setBusy(true)
    try { await processStage(project, sub.id, {}, true); notify(`${project.invoice_no}: mulai diproses`) } catch (e) { notify(e.message, 'err'); onWork() } finally { setBusy(false) }
  }
  return (
    <li className={cx('transition', active ? 'bg-brand-soft/60 shadow-[inset_3px_0_0_0_var(--brand)]' : alt ? 'bg-slate-50/80' : '')}>
      <div className="u-row grid gap-2 px-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)_minmax(0,1fr)_104px_minmax(0,1fr)_170px] lg:items-start lg:gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold"><CopyText text={project.invoice_no} label="No. Invoice" strong /></p>
          <p className="truncate text-xs font-semibold text-ink-soft">{project.customer?.name}</p>
          <p className="truncate text-[11px] text-ink-mute">{(SUB_TYPES[sub.type] || SUB_TYPES.jasa_lain).label} · {project.branch}</p>
        </div>
        <div className="min-w-0 text-xs">
          <p className="font-semibold text-ink">{sub.title}</p>
          {docs.length > 0 && <ol className="mt-0.5 list-decimal space-y-0.5 pl-4 text-[11px] text-ink-mute">{docs.slice(0, 3).map((d, i) => <li key={i}>{d.desc}</li>)}{docs.length > 3 && <li className="list-none">+{docs.length - 3} lainnya</li>}</ol>}
        </div>
        <p className="min-w-0 truncate text-xs text-ink-soft">{sub.country || sub.institution ? [sub.country, nameOf(sub.institution)].filter(Boolean).join(' · ') : '—'}</p>
        <div><DeadlineCell project={project} done={done} align="left" /><PriorityBadge p={project.about?.priority} className="mt-0.5" /></div>
        <div className="min-w-0 text-xs">
          <p className={cx('truncate font-semibold', staf ? 'text-ink' : 'text-amber-700')}>{staf || 'Belum ditugaskan'}</p>
          {canCost && biaya > 0 && <p className="text-[11px] text-ink-mute">{rupiah(biaya)}</p>}
        </div>
        <div className="flex flex-col gap-1.5 lg:items-end">
          <span className={cx('w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1', done ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-ink-soft ring-slate-200')}>{done ? 'Selesai' : stafStatus(sub.stage)}</span>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={onFiles} aria-label={`File project ${project.invoice_no}`} title="File project" className="grid h-8 w-8 place-items-center rounded-xl bg-white text-ink-soft ring-1 ring-slate-300 hover:bg-ink hover:text-white"><FolderOpen className="h-4 w-4" /></button>
            <button type="button" onClick={onDetail} aria-label={`Detail ${project.invoice_no}`} title="Detail project" className="grid h-8 w-8 place-items-center rounded-xl bg-white text-brand ring-1 ring-brand/30 hover:bg-brand hover:text-white"><Eye className="h-4 w-4" /></button>
            {!done && (quickStart
              ? <Button size="sm" loading={busy} onClick={start}><Play className="h-3.5 w-3.5" />Mulai Proses</Button>
              : <Button size="sm" variant="dark" onClick={onWork}>{sub.stage === 'cs_upload' ? 'Lihat' : 'Kerjakan'}</Button>)}
          </div>
        </div>
      </div>
    </li>
  )
}
