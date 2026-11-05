import { useMemo, useState } from 'react'
import { Plus, Search, FolderOpen, Banknote, CalendarClock, Layers, LayoutGrid, List, ChevronRight, ChevronDown, Sparkles, StickyNote, Download, Loader2, Printer, AlertTriangle } from 'lucide-react'
import JSZip from 'jszip'
import { drive } from '../lib/integrations.js'
import { saveBlob } from '../lib/download.js'
import { fieldFiles } from '../components/FileManager.jsx'
import { useApp } from '../lib/store.jsx'
import { scopeByBranch, can, branchesOf } from '../config/access.js'
import { DONE, isDone, progressOf, stageLabel, flowOf, totalPengajuan, stageIndex, stagesOf } from '../config/workflows.js'
import { PengajuanStatus, DownloadBukti } from '../components/Pengajuan.jsx'
import { SUB_TYPES } from '../config/subtypes.js'
import { ProjectTypes, TypeBadge, PrintBadge, DemoBadge, InvoiceNo, DeadlineCell, NoteIcon } from '../components/badges.jsx'
import { Button, Card, Empty, Input, Pill, Progress, Tabs, Sheet, cx } from '../components/ui.jsx'
import { dayKey, addDays } from '../lib/performance.js'
import { daysLeft, rupiah, tgl } from '../lib/format.js'
import ProjectForm from './ProjectForm.jsx'
import { PriorityBadge } from '../components/Priority.jsx'
import TimeAgo from '../components/TimeAgo.jsx'

export default function Projects() {
  const { user, data, branchFilter } = useApp()
  const [tab, setTab] = useState('all')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('aktif')
  const [formOpen, setFormOpen] = useState(false)
  const [view, setViewRaw] = useState(() => { try { return localStorage.getItem('atlas-view') || 'grid' } catch { return 'grid' } })
  const setView = (v) => { setViewRaw(v); try { localStorage.setItem('atlas-view', v) } catch { /* abaikan */ } }
  // urutan: 'deadline' (terdekat dulu) atau 'baru' (project terbaru dulu) — tombol saklar, tersimpan per perangkat
  const [sort, setSortRaw] = useState(() => { try { return localStorage.getItem('atlas-sort') || 'deadline' } catch { return 'deadline' } })
  const setSort = (v) => { setSortRaw(v); try { localStorage.setItem('atlas-sort', v) } catch { /* abaikan */ } }
  // filter deadline dari judul kolom: null | {kind:'today'|'tomorrow'|'range', from, to}
  const [dlFilter, setDlFilter] = useState(null)
  // filter Cabang / Lokasi Print dari judul kolom: { branch: ''|nama, print: ''|nama }
  const [bpFilter, setBpFilter] = useState({ branch: '', print: '' })

  const scoped = useMemo(() => scopeByBranch(user, data.projects, branchFilter), [user, data.projects, branchFilter])
  const finScoped = useMemo(() => (can.seeAllFinance(user) ? scoped : scoped.filter((p) => branchesOf(user).includes(p.branch))), [scoped, user])
  const vendorRows = useMemo(() => finScoped.flatMap((p) => (p.sub_projects || [])
    .filter((s) => ['persetujuan', 'pembayaran', 'dibayar'].includes(s.stage) || (s.data?.bukti_transfer))
    .map((s) => ({ ...s, project: p }))), [finScoped])

  const [shownN, setShownN] = useState(36)
  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return scoped
      .filter((p) => tab === 'all' || (p.sub_projects || []).some((x) => (x.type || 'jasa_lain') === tab))
      .filter((p) => status === 'semua' || (status === 'aktif' ? !isDone(p) : isDone(p)))
      .filter((p) => !s || [p.invoice_no, p.customer?.name, p.about?.description, ...(p.sub_projects || []).map((x) => x.title)].join(' ').toLowerCase().includes(s))
      .filter((p) => !dlFilter || (p.about?.deadline && String(p.about.deadline).slice(0, 10) >= dlFilter.from && String(p.about.deadline).slice(0, 10) <= dlFilter.to))
      .filter((p) => (!bpFilter.branch || p.branch === bpFilter.branch) && (!bpFilter.print || (p.about?.print_location || p.branch) === bpFilter.print))
      .sort((a, b) => sort === 'baru' ? new Date(b.created_at || 0) - new Date(a.created_at || 0) : new Date(a.about?.deadline || 0) - new Date(b.about?.deadline || 0))
  }, [scoped, tab, q, status, sort, dlFilter, bpFilter])
  // project lewat deadline & belum selesai — selalu dipajang di atas tabel (hilang otomatis saat selesai)
  const late = useMemo(() => list.filter((p) => !isDone(p) && daysLeft(p.about?.deadline) < 0), [list])
  const rest = useMemo(() => late.length ? list.filter((p) => !late.includes(p)) : list, [list, late])

  const tabs = [
    { value: 'all', label: 'Semua', count: scoped.length },
    ...Object.entries(SUB_TYPES).map(([k, t]) => ({ value: k, label: t.label, count: scoped.filter((p) => (p.sub_projects || []).some((x) => (x.type || 'jasa_lain') === k)).length })),
    { value: 'vendor', label: 'Pengajuan Vendor', count: vendorRows.filter((r) => ['persetujuan', 'pembayaran'].includes(r.stage)).length },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div><h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">My Project</h1><p className="text-sm text-ink-mute">Nama project = nomor invoice Zoho</p></div>
        <Button className="hidden md:inline-flex" onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" />Project Baru</Button>
      </div>

      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === 'vendor' ? <VendorPayments rows={vendorRows} /> : (
        <>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input className="pl-9" placeholder="Cari invoice, pelanggan, dokumen…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border-0 bg-white px-3 text-sm font-semibold ring-1 ring-slate-200">
              <option value="aktif">Aktif</option><option value="selesai">Selesai</option><option value="semua">Semua</option>
            </select>
            <div className="flex shrink-0 rounded-xl bg-white p-1 ring-1 ring-slate-200" role="group" aria-label="Urutkan">
              {[['deadline', CalendarClock, 'Deadline', 'Urutkan: deadline terdekat dulu'], ['baru', Sparkles, 'Terbaru', 'Urutkan: project terbaru dulu']].map(([k, Icon, l, t]) => (
                <button key={k} onClick={() => setSort(k)} aria-pressed={sort === k} title={t}
                  className={cx('flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold', sort === k ? 'bg-ink text-white' : 'text-ink-mute hover:bg-slate-50')}><Icon className="h-3.5 w-3.5" /><span className="hidden sm:inline">{l}</span></button>
              ))}
            </div>
            <div className="flex shrink-0 rounded-xl bg-white p-1 ring-1 ring-slate-200">
              {[['grid', LayoutGrid, 'Tampilan kartu'], ['list', List, 'Tampilan list']].map(([k, Icon, l]) => (
                <button key={k} onClick={() => setView(k)} aria-label={l} title={l}
                  className={cx('grid h-8 w-8 place-items-center rounded-lg', view === k ? 'bg-ink text-white' : 'text-ink-mute hover:bg-slate-50')}><Icon className="h-4 w-4" /></button>
              ))}
            </div>
          </div>

          {list.length > shownN && <p className="text-xs text-ink-mute">Menampilkan {shownN} dari {list.length} project</p>}
          {list.length === 0 && !(view === 'list' && (dlFilter || bpFilter.branch || bpFilter.print || q || tab !== 'all')) ? (
            <Card><Empty icon={FolderOpen} title="Belum ada project" text="Buat project baru dari invoice Zoho." action={<Button onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" />Project Baru</Button>} /></Card>
          ) : view === 'list' ? <ProjectList list={rest.slice(0, shownN)} late={late} dlFilter={dlFilter} setDlFilter={setDlFilter} bpFilter={bpFilter} setBpFilter={setBpFilter} options={{ branches: [...new Set(scoped.map((p) => p.branch))].sort(), prints: [...new Set(scoped.map((p) => p.about?.print_location || p.branch))].sort() }} /> : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {list.slice(0, shownN).map((p) => <ProjectCard key={p.id} p={p} />)}
            </div>
          )}
          {list.length > shownN && <Button variant="outline" className="w-full" onClick={() => setShownN((n) => n + 36)}>Tampilkan 36 lagi ({list.length - shownN} tersisa)</Button>}
        </>
      )}

      <button onClick={() => setFormOpen(true)} aria-label="Project baru"
        className="fixed bottom-20 right-4 z-30 grid h-14 w-14 place-items-center rounded-2xl bg-brand text-white shadow-lg shadow-brand/30 md:hidden">
        <Plus className="h-6 w-6" />
      </button>
      {formOpen && <ProjectForm onClose={() => setFormOpen(false)} />}
    </div>
  )
}

function ProjectCard({ p }) {
  const prog = progressOf(p)
  const d = daysLeft(p.about?.deadline)
  const done = isDone(p)
  return (
    <a href={`#/projects/${p.id}`} className="block">
      <Card className="h-full p-4 transition hover:-translate-y-0.5 hover:shadow-md">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-1.5"><InvoiceNo project={p} size="base" /><NoteIcon note={p.about?.notes} /><DemoBadge project={p} className="align-middle" /></p>
            <TimeAgo at={p.created_at} prefix="Diposting" />
            <p className="truncate text-sm text-ink-soft">{p.customer?.name}</p>
          </div>
        </div>
        <ProjectTypes project={p} className="mt-2" />
        <p className="mt-2 line-clamp-2 text-xs text-ink-mute">{(p.sub_projects || []).map((x) => x.title).join(' · ') || '—'}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Pill><Layers className="h-3 w-3" />{p.sub_projects?.length || 0} sub</Pill>
          <Pill>{p.branch}</Pill>
          {p.about?.print_location && p.about.print_location !== p.branch ? <PrintBadge project={p} /> : <Pill className="bg-fuchsia-50/60 text-fuchsia-700">Print {p.about?.print_location || p.branch}</Pill>}
          <PriorityBadge p={p.about?.priority} />
        </div>
        {!done && d !== null && <div className="mt-2 flex items-center gap-1.5 text-ink-mute"><CalendarClock className="h-3.5 w-3.5" /><DeadlineCell project={p} align="left" /></div>}
        <div className="mt-3 flex items-center gap-2"><Progress value={prog} /><span className="text-[11px] font-semibold text-ink-mute">{prog}%</span></div>
      </Card>
    </a>
  )
}

// Tahap paling awal di antara sub project = posisi project saat ini
function currentStage(p) {
  const open = (p.sub_projects || []).filter((s) => s.stage !== DONE)
  if (!open.length) return 'Selesai'
  const labels = [...new Set(open.map((s) => stageLabel(flowOf(s, p), s.stage)))]
  return labels.length > 1 ? `${labels[0]} +${labels.length - 1}` : labels[0]
}

const dlFilterLabel = (f) => !f ? '' : f.kind === 'today' ? 'Hari ini' : f.kind === 'tomorrow' ? 'Besok' : `${tgl(f.from)} – ${tgl(f.to)}`

function ProjectList({ list, late = [], dlFilter, setDlFilter, bpFilter = { branch: '', print: '' }, setBpFilter = () => {}, options = { branches: [], prints: [] } }) {
  const [open, setOpen] = useState(() => new Set())
  const toggle = (id) => setOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const bp = 'both'
  const [bpOpen, setBpOpen] = useState(false)
  const bpActive = !!(bpFilter.branch || bpFilter.print)
  const bpLabel = [bpFilter.branch && `Cabang ${bpFilter.branch}`, bpFilter.print && `Print ${bpFilter.print}`].filter(Boolean).join(' · ')
  const [dlOpen, setDlOpen] = useState(false)
  const today = dayKey()
  const [range, setRange] = useState({ from: today, to: addDays(today, 7) })
  const pick = (f) => { setDlFilter(f); setDlOpen(false) }
  const renderRow = (p) => {
    const prog = progressOf(p)
    return (
            <li key={p.id} className={cx(open.has(p.id) && 'bg-brand-soft/30')}>
              <div className="relative">
              <a href={`#/projects/${p.id}`} className="block px-4 py-3 pr-12 hover:bg-slate-50 lg:pr-4">
                {/* Desktop: baris tabel */}
                <div className="hidden grid-cols-[1.5fr_1.3fr_1fr_0.9fr_56px_1fr_1.6fr_16px] items-start gap-3 text-left lg:grid">
                  <span><span className="flex items-center gap-1.5"><InvoiceNo project={p} /><PriorityBadge p={p.about?.priority} iconOnly /><DemoBadge project={p} /></span><TimeAgo at={p.created_at} prefix="Diposting" /></span>
                  <span className="min-w-0"><span className="block truncate text-sm">{p.customer?.name}</span><span className="text-[11px] text-ink-mute">{p.sub_projects?.length || 0} sub project</span></span>
                  <DeadlineCell project={p} done={isDone(p)} align="left" />
                  <span><ProjectTypes project={p} /></span>
                  <span className="flex justify-start pt-0.5"><NoteIcon note={p.about?.notes} /></span>
                  <span className="min-w-0 pt-0.5">
                    {bp !== 'print' && <span className="block text-sm font-semibold text-ink">{p.branch}</span>}
                    {bp !== 'branch' && <span className={cx('flex items-center gap-1', bp === 'print' ? 'text-sm' : 'mt-0.5 text-xs', p.about?.print_location && p.about.print_location !== p.branch ? 'font-semibold text-fuchsia-700' : bp === 'print' ? 'text-ink' : 'text-ink-mute')}><Printer className="h-3.5 w-3.5 shrink-0" />{p.about?.print_location || p.branch}</span>}
                  </span>
                  <span className="min-w-0"><span className="block truncate text-xs font-semibold text-brand">{currentStage(p)}</span><span className="mt-1 flex items-center gap-2"><Progress value={prog} /><span className="w-8 text-[11px] font-semibold text-ink-mute">{prog}%</span></span></span>
                  <button type="button" onClick={(e) => { e.preventDefault(); toggle(p.id) }} aria-expanded={open.has(p.id)} aria-label={`${open.has(p.id) ? 'Tutup' : 'Buka'} rincian ${p.invoice_no}`} title="Rincian sub project, data terjemahan & catatan"
                    className="grid h-7 w-7 place-items-center rounded-lg text-ink-mute ring-1 ring-slate-200 hover:bg-white hover:text-brand"><ChevronDown className={cx('h-4 w-4 transition', open.has(p.id) && 'rotate-180')} /></button>
                </div>
                {/* Mobile: baris ringkas */}
                <div className="flex items-center gap-3 lg:hidden">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <InvoiceNo project={p} /><NoteIcon note={p.about?.notes} /><ProjectTypes project={p} />
                      <PriorityBadge p={p.about?.priority} iconOnly /><PrintBadge project={p} iconOnly />
                    </div>
                    <TimeAgo at={p.created_at} prefix="Diposting" />
                    <p className="truncate text-xs text-ink-mute">{p.customer?.name} · {p.branch}{p.about?.print_location && p.about.print_location !== p.branch ? ` · Print ${p.about.print_location}` : ''} · {p.sub_projects?.length || 0} sub</p>
                    <div className="mt-1.5 flex items-center gap-2"><Progress value={prog} /><span className="shrink-0 text-[11px] font-semibold text-brand">{currentStage(p)}</span></div>
                  </div>
                  <div className="w-[76px] shrink-0"><DeadlineCell project={p} done={isDone(p)} /></div>
                </div>
              </a>
              <button type="button" onClick={() => toggle(p.id)} aria-expanded={open.has(p.id)} aria-label={`${open.has(p.id) ? 'Tutup' : 'Buka'} rincian ${p.invoice_no} (HP)`}
                className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-lg text-ink-mute ring-1 ring-slate-200 lg:hidden"><ChevronDown className={cx('h-4 w-4 transition', open.has(p.id) && 'rotate-180')} /></button>
              </div>
              {open.has(p.id) && <ProjectExpand p={p} />}
            </li>
          )
  }
  return (
    <Card className="overflow-hidden">
      <div className="hidden grid-cols-[1.5fr_1.3fr_1fr_0.9fr_56px_1fr_1.6fr_16px] gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-ink-mute lg:grid">
        <span>Invoice</span><span>Pelanggan</span>
        <button type="button" onClick={() => setDlOpen(true)} className={cx('flex items-center gap-1 text-left uppercase hover:text-brand', dlFilter && 'text-brand')} title="Filter deadline">
          Deadline <ChevronDown className="h-3 w-3" />{dlFilter && <span className="rounded-full bg-brand px-1.5 py-px text-[10px] normal-case tracking-normal text-white">{dlFilterLabel(dlFilter)}</span>}
        </button>
        <span>Layanan</span><span>Catatan</span>
        <button type="button" onClick={() => setBpOpen(true)} className={cx('flex flex-wrap items-center gap-1 text-left uppercase hover:text-brand', bpActive && 'text-brand')} title="Filter cabang / lokasi print">
          Cabang / Print <ChevronDown className="h-3 w-3" />{bpActive && <span className="rounded-full bg-brand px-1.5 py-px text-[10px] normal-case tracking-normal text-white">{bpLabel}</span>}
        </button>
        <span>Tahap & Progres</span><span />
      </div>
      {dlFilter && <div className="flex items-center gap-2 border-b border-slate-100 bg-brand-soft/40 px-4 py-1.5 text-xs lg:hidden"><span className="font-semibold text-brand">Deadline: {dlFilterLabel(dlFilter)}</span><button type="button" onClick={() => setDlFilter(null)} className="ml-auto font-semibold text-ink-mute hover:text-rose-600">Hapus</button></div>}
      <Sheet open={dlOpen} onClose={() => setDlOpen(false)} title="Filter deadline"
        footer={<><Button variant="outline" className="flex-1" onClick={() => pick(null)}>Tampilkan semua</Button><Button className="flex-[2]" onClick={() => pick({ kind: 'range', from: range.from <= range.to ? range.from : range.to, to: range.from <= range.to ? range.to : range.from })}>Terapkan rentang</Button></>}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Button variant={dlFilter?.kind === 'today' ? 'primary' : 'outline'} onClick={() => pick({ kind: 'today', from: today, to: today })}>Hari ini</Button>
            <Button variant={dlFilter?.kind === 'tomorrow' ? 'primary' : 'outline'} onClick={() => pick({ kind: 'tomorrow', from: addDays(today, 1), to: addDays(today, 1) })}>Besok</Button>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold text-ink-soft">Rentang tanggal</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-ink-mute">Dari<Input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} /></label>
              <label className="text-xs text-ink-mute">Sampai<Input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} /></label>
            </div>
          </div>
          {dlFilter && <p className="text-xs text-ink-mute">Filter aktif: <b className="text-brand">{dlFilterLabel(dlFilter)}</b></p>}
        </div>
      </Sheet>
      {bpActive && <div className="flex items-center gap-2 border-b border-slate-100 bg-brand-soft/40 px-4 py-1.5 text-xs lg:hidden"><span className="font-semibold text-brand">{bpLabel}</span><button type="button" onClick={() => setBpFilter({ branch: '', print: '' })} className="ml-auto font-semibold text-ink-mute hover:text-rose-600">Hapus</button></div>}
      <Sheet open={bpOpen} onClose={() => setBpOpen(false)} title="Filter cabang & lokasi print"
        footer={<><Button variant="outline" className="flex-1" onClick={() => { setBpFilter({ branch: '', print: '' }); setBpOpen(false) }}>Tampilkan semua</Button><Button className="flex-[2]" onClick={() => setBpOpen(false)}>Selesai</Button></>}>
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-xs font-semibold text-ink-soft">Dari cabang mana</p>
            <div className="flex flex-wrap gap-1.5">
              {['', ...options.branches].map((b) => <button key={b || 'all'} type="button" onClick={() => setBpFilter({ ...bpFilter, branch: b })} className={cx('rounded-lg px-2.5 py-1 text-xs font-semibold ring-1', bpFilter.branch === b ? 'bg-brand text-white ring-brand' : 'bg-white text-ink-soft ring-slate-200 hover:ring-brand')}>{b || 'Semua cabang'}</button>)}
            </div>
          </div>
          <div>
            <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-ink-soft"><Printer className="h-3.5 w-3.5" />Print di mana</p>
            <div className="flex flex-wrap gap-1.5">
              {['', ...options.prints].map((b) => <button key={b || 'all'} type="button" onClick={() => setBpFilter({ ...bpFilter, print: b })} className={cx('rounded-lg px-2.5 py-1 text-xs font-semibold ring-1', bpFilter.print === b ? 'bg-fuchsia-600 text-white ring-fuchsia-600' : 'bg-white text-ink-soft ring-slate-200 hover:ring-fuchsia-400')}>{b || 'Semua lokasi'}</button>)}
            </div>
          </div>
          <p className="text-[11px] text-ink-mute">Contoh: klik <b>Bali</b> → hanya project cabang Bali yang tampil. Kedua filter bisa digabung.</p>
        </div>
      </Sheet>
      {late.length > 0 && (
        <div className="sticky top-0 z-10 border-b border-rose-200 bg-rose-50/95 backdrop-blur-sm">
          <p className="flex items-center gap-2 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide text-rose-700"><AlertTriangle className="h-3.5 w-3.5" />Lewat deadline & belum selesai <span className="rounded-full bg-rose-600 px-1.5 text-[10px] text-white">{late.length}</span><span className="hidden font-medium normal-case tracking-normal text-rose-500 sm:inline">hilang otomatis saat project selesai</span></p>
        </div>
      )}
      {late.length > 0 && <ul className="divide-y divide-rose-100 border-b-2 border-rose-200 bg-rose-50/60">{late.map(renderRow)}</ul>}
      <ul className="divide-y divide-slate-100">
        {list.map(renderRow)}
      </ul>
      {list.length === 0 && late.length === 0 && (
        <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
          <p className="text-sm font-semibold text-ink">Tidak ada project yang cocok dengan filter</p>
          <p className="text-xs text-ink-mute">Ubah filter lewat judul kolom di atas{(dlFilter || bpActive) ? ', atau hapus filter:' : '.'}</p>
          {(dlFilter || bpActive) && <div className="flex flex-wrap justify-center gap-1.5">
            {dlFilter && <button type="button" onClick={() => setDlFilter(null)} className="rounded-lg bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand ring-1 ring-brand/20">Hapus filter deadline ({dlFilterLabel(dlFilter)})</button>}
            {bpActive && <button type="button" onClick={() => setBpFilter({ branch: '', print: '' })} className="rounded-lg bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand ring-1 ring-brand/20">Hapus filter {bpLabel}</button>}
          </div>}
        </div>
      )}
    </Card>
  )
}

function VendorPayments({ rows }) {
  const { user } = useApp()
  const canFund = can.seeFunding(user)
  const [view, setView] = useState('persetujuan')
  const people = useApp().data.people
  const vendorName = (id) => people.find((x) => x.id === id)?.name ?? '—'
  const tabs = [['persetujuan', 'Menunggu Persetujuan'], ['pembayaran', 'Menunggu Pembayaran'], ['dibayar', 'Sudah Dibayar'], ['selesai', 'Selesai']]
  const inView = (r) => (view === 'selesai' ? r.stage === DONE && !!r.data?.bukti_transfer : r.stage === view)
  const list = rows.filter(inView)
  const total = list.reduce((a, r) => a + totalPengajuan(r.data), 0)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="-mx-1 flex overflow-x-auto rounded-xl bg-white p-1 ring-1 ring-slate-200">
          {tabs.map(([k, l]) => (
            <button key={k} onClick={() => setView(k)} className={cx('whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold', view === k ? 'bg-ink text-white' : 'text-ink-soft hover:bg-slate-50')}>
              {l} <span className={view === k ? 'text-white/60' : 'text-ink-mute'}>{rows.filter((r) => (k === 'selesai' ? r.stage === DONE && !!r.data?.bukti_transfer : r.stage === k)).length}</span>
            </button>
          ))}
        </div>
        <p className="text-right text-xs text-ink-mute">Total pengajuan<br /><span className="text-sm font-extrabold text-ink">{rupiah(total)}</span></p>
      </div>
      {list.length === 0 ? <Card><Empty icon={Banknote} title="Kosong" text="Tidak ada pengajuan pada status ini." /></Card> : (
        <Card className="divide-y divide-slate-100">
          {list.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 p-4">
              <a href={`#/projects/${r.project.id}`} className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-bold">{r.project.invoice_no}</span><TypeBadge type={r.type} /><PengajuanStatus stage={r.stage} /></div>
                <p className="truncate text-xs text-ink-mute">{r.title} · {vendorName(r.data?.vendor)} · {r.data?.vendor_service || '—'} · {r.project.branch}{r.data?.sumber_dana && canFund ? ` · Dana ${r.data.sumber_dana}` : ''}</p>
                {r.data?.paid_date && <p className="text-[11px] text-emerald-600">Dibayar {tgl(r.data.paid_date)}</p>}
              </a>
              <div className="flex flex-col items-end gap-1">
                <p className="text-sm font-extrabold tabular-nums">{rupiah(totalPengajuan(r.data))}</p>
                {r.data?.bukti_transfer ? <DownloadBukti file={r.data.bukti_transfer} /> : <a href={`#/projects/${r.project.id}`} className="text-xs font-semibold text-brand">Buka →</a>}
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}

/** Rincian di bawah baris: daftar sub project, data terjemahan, progres per sub, dan catatan. */
/** Kelompok file yang bisa diunduh langsung dari daftar, per sub project. */
function quickGroupsOf(s) {
  const d = s.data || {}
  const g = []
  const push = (label, files, note) => files.length && g.push({ label, files, note })
  if (s.type === 'terjemahan' || s.type === 'terjemahan_nt') {
    const draft = fieldFiles(d, 'file_final')
    const fallback = fieldFiles(d, 'hasil_proofread').length ? fieldFiles(d, 'hasil_proofread') : fieldFiles(d, 'hasil_terjemahan')
    push('Draft terjemahan', draft.length ? draft : fallback, draft.length ? 'Dokumen final dari otorisator' : 'Versi terakhir yang tersedia (otorisator belum unggah)')
    push('Hasil terjemahan (PDF scan)', fieldFiles(d, 'scan_pdf'), 'Hasil cetak bertanda tangan yang sudah discan')
    push('Hasil vendor', fieldFiles(d, 'hasil_vendor'), 'Hasil terjemahan dari vendor')
  } else if (s.type === 'apostille' || s.type === 'legalisasi') {
    push('Dokumen yang diproses', fieldFiles(d, 'dokumen_sumber'), 'Dokumen sumber dari CS')
    push('ID / dokumen pemohon', fieldFiles(d, 'dokumen_id'), 'Scan ID pemohon dari CS')
    push(`Hasil ${s.type === 'legalisasi' ? 'legalisasi' : 'apostille'} (scan)`, [...fieldFiles(d, 'hasil_akhir'), ...fieldFiles(d, 'hasil_vendor')], 'Hasil akhir yang sudah discan')
  } else {
    push('Dokumen', fieldFiles(d, 'dokumen_sumber'), '')
    push('File hasil', fieldFiles(d, 'hasil_jasa'), '')
  }
  return g
}

function QuickDownload({ sub, invoice }) {
  const { notify } = useApp()
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const [sel, setSel] = useState(() => new Set())
  const groups = quickGroupsOf(sub)
  const all = groups.flatMap((g) => g.files.map((f, i) => ({ ...f, _k: `${g.label}:${i}`, _g: g.label })))
  if (!all.length) return <span className="inline-flex items-center gap-1 text-[11px] text-ink-mute"><Download className="h-3 w-3" />Belum ada file</span>
  const saveMany = async (files) => {
    try {
      setBusy(true)
      if (files.length === 1) await saveBlob(files[0].name, await drive.blob(files[0]))
      else {
        const zip = new JSZip(); const used = new Set()
        for (const f of files) { let path = `${f._g || 'File'}/${f.name}`, k = 1; while (used.has(path)) path = path.replace(/(\.[^.]+)?$/, ` (${k++})$1`); used.add(path); zip.file(path, await drive.blob(f)) }
        await saveBlob(`${invoice}-${sub.title}.zip`.replace(/[\\/:*?"<>|]/g, '-'), await zip.generateAsync({ type: 'blob' }))
      }
      setOpen(false)
    } catch (err) { notify(err.message, 'err') } finally { setBusy(false) }
  }
  const start = (e) => { e.preventDefault(); e.stopPropagation(); if (all.length === 1) return saveMany(all); setSel(new Set(all.map((f) => f._k))); setOpen(true) }
  const toggle = (k) => setSel((x) => { const n = new Set(x); n.has(k) ? n.delete(k) : n.add(k); return n })
  const chosen = all.filter((f) => sel.has(f._k))
  const label = all.length === 1 ? `Download ${groups[0].label.split(' (')[0]}` : `Download (${all.length} file)`
  return (
    <>
      <button type="button" onClick={start} disabled={busy} title={groups.map((g) => `${g.label}: ${g.files.length}`).join(' · ')}
        className="inline-flex items-center gap-1 rounded-lg bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand ring-1 ring-brand/20 hover:bg-brand/15 disabled:opacity-60">
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}{label}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={`Pilih dokumen — ${invoice}`}
        footer={<><Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Batal</Button>
          <Button className="flex-[2]" disabled={!chosen.length || busy} onClick={() => saveMany(chosen)}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Download {chosen.length > 1 ? `${chosen.length} file (ZIP)` : chosen.length === 1 ? '1 file' : ''}</Button></>}>
        <div className="space-y-3">
          <p className="text-xs text-ink-mute">{sub.title} · centang dokumen yang ingin diunduh. Lebih dari satu file akan dikemas ZIP per kelompok.</p>
          {groups.map((g) => (
            <div key={g.label}>
              <p className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-ink-soft">{g.label}<span className="font-semibold normal-case tracking-normal text-ink-mute">({g.files.length})</span>
                <button type="button" onClick={() => { const ks = g.files.map((_, i) => `${g.label}:${i}`); const allOn = ks.every((k) => sel.has(k)); setSel((x) => { const n = new Set(x); ks.forEach((k) => (allOn ? n.delete(k) : n.add(k))); return n }) }} className="ml-auto text-[11px] font-semibold normal-case tracking-normal text-brand hover:underline">{g.files.every((_, i) => sel.has(`${g.label}:${i}`)) ? 'Hapus semua' : 'Pilih semua'}</button></p>
              {g.note && <p className="mb-1 text-[11px] text-ink-mute">{g.note}</p>}
              <ul className="divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200">
                {g.files.map((f, i) => { const k = `${g.label}:${i}`; return (
                  <li key={k}><label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 hover:bg-slate-50">
                    <input type="checkbox" checked={sel.has(k)} onChange={() => toggle(k)} className="h-4 w-4 rounded border-slate-300 text-brand" />
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink">{f.name}</span>{f.size ? <span className="text-[11px] text-ink-mute">{Math.max(1, Math.round(f.size / 1024))} KB</span> : null}</span>
                    <button type="button" onClick={(e) => { e.preventDefault(); saveMany([{ ...f, _g: g.label }]) }} className="rounded-lg p-1.5 text-ink-mute hover:bg-brand/10 hover:text-brand" aria-label={`Download ${f.name}`}><Download className="h-4 w-4" /></button>
                  </label></li>
                ) })}
              </ul>
            </div>
          ))}
        </div>
      </Sheet>
    </>
  )
}

function ProjectExpand({ p }) {
  const { nameOf } = useApp()
  const subs = p.sub_projects || []
  const th = 'px-2.5 py-1.5 text-left text-[10px] font-bold uppercase tracking-wide text-ink-mute whitespace-nowrap'
  const td = 'px-2.5 py-2 align-top text-xs text-ink'
  return (
    <div className="border-t border-slate-100 bg-white/70 px-4 pb-3 pt-2">
      <div className="space-y-2">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-ink-mute">Sub project ({subs.length})</p>
            <a href={`#/projects/${p.id}`} className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">Buka project<ChevronRight className="h-3.5 w-3.5" /></a>
          </div>
          {/* Tabel menyamping: satu baris per sub project — mudah dibaca & dibandingkan */}
          <div className="overflow-x-auto rounded-xl ring-1 ring-slate-200">
            <table className="w-full min-w-[640px] border-collapse">
              <thead className="bg-slate-50">
                <tr>
                  <th className={cx(th, 'w-8 text-center')}>#</th><th className={th}>Jenis</th><th className={th}>Dokumen</th><th className={th}>Bahasa / Negara</th>
                  <th className={cx(th, 'text-center')}>Hlm</th><th className={th}>Pelaksana</th><th className={th}>Tahap</th><th className={cx(th, 'w-28')}>Progres</th><th className={cx(th, 'text-right')}>File</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subs.map((s, i) => {
                  const flow = flowOf(s, p); const n = stagesOf(flow).length; const pct = s.stage === DONE ? 100 : Math.round((stageIndex(flow, s.stage) / n) * 100)
                  const who = s.translator_kind === 'vendor' ? nameOf(s.translator || s.data?.vendor) : nameOf(s.data?.translator || s.translator)
                  const label = (SUB_TYPES[s.type] || SUB_TYPES.jasa_lain).label
                  const docs = (s.docs || []).filter((d) => d?.desc?.trim())
                  const docList = docs.length ? docs.map((d) => ({ desc: d.desc.trim(), pages: d.pages, kind: d.kind })) : [{ desc: s.title }]
                  const regs = (s.data?.reg_numbers || []).filter(Boolean)
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/60">
                      <td className={cx(td, 'text-center font-semibold text-ink-mute')}>{i + 1}</td>
                      <td className={cx(td, 'whitespace-nowrap font-semibold')}>{label}{s.applicant_id && <span className="block text-[10px] font-normal text-ink-mute">ID/NIB {s.applicant_id}</span>}</td>
                      <td className={cx(td, 'min-w-[200px]')}>
                        <ol className="list-decimal space-y-0.5 pl-4">
                          {docList.map((d, j) => <li key={j}>{d.desc}{d.pages ? <span className="text-ink-mute"> · {d.pages} hlm</span> : null}{d.kind === 'non_reguler' && <span className="ml-1 rounded bg-violet-50 px-1 text-[10px] font-semibold text-violet-700">non reg</span>}</li>)}
                        </ol>
                        {regs.length > 0 && <span className="mt-0.5 block font-mono text-[11px] text-amber-800">No. Reg {regs.join(', ')}</span>}
                      </td>
                      <td className={cx(td, 'whitespace-nowrap text-ink-soft')}>{s.lang_from ? `${s.lang_from} → ${s.lang_to}` : s.country ? `Negara: ${s.country}` : s.institution || '—'}</td>
                      <td className={cx(td, 'text-center font-semibold')}>{s.pages || '—'}</td>
                      <td className={cx(td, 'whitespace-nowrap text-ink-soft')}>{who ? <>{who}<span className="block text-[10px] text-ink-mute">{s.translator_kind === 'vendor' ? 'Vendor' : 'Penerjemah'}</span></> : <span className="text-amber-700">Belum dibagi</span>}</td>
                      <td className={cx(td, 'whitespace-nowrap font-semibold text-brand')}>{s.stage === DONE ? 'Selesai' : stageLabel(flow, s.stage)}</td>
                      <td className={td}><span className="flex items-center gap-2"><Progress value={pct} /><span className="w-8 text-[11px] font-semibold text-ink-mute">{pct}%</span></span></td>
                      <td className={cx(td, 'text-right')}><span className="flex justify-end"><QuickDownload sub={s} invoice={p.invoice_no} /></span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
        {p.about?.notes && <p className="flex items-start gap-1.5 whitespace-pre-line rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200"><StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" /><span><b className="font-semibold">Catatan:</b> {p.about.notes}</span></p>}
      </div>
    </div>
  )
}
