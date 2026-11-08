import { useEffect, useMemo, useState } from 'react'
import { Plus, Minus, Search, FolderOpen, Banknote, CalendarClock, Layers, LayoutGrid, List, ChevronRight, ChevronDown, Sparkles, StickyNote, Printer, AlertTriangle, Eye, X, Save, Rows2, Rows3, Rows4, Maximize2, Minimize2, Table2, MoreHorizontal} from 'lucide-react'
import FileManager, { fieldFiles, collect as collectFiles } from '../components/FileManager.jsx'
import ProjectDetail from './ProjectDetail.jsx'
import WorkerBoard, { WorkerActions, isWorkRole } from '../components/WorkerActions.jsx'
import { useApp } from '../lib/store.jsx'
import { scopeByBranch, can, branchesOf, invoiceLabel} from '../config/access.js'
import ProjectSpreadsheet from '../components/ProjectSpreadsheet.jsx'
import UnduhData from '../components/UnduhData.jsx'
import { KapasitasSaya } from '../components/Kapasitas.jsx'
import { DONE, isDone, progressOf, stageLabel, flowOf, totalPengajuan, stageIndex, stagesOf, VENDOR_PAID_STAGES } from '../config/workflows.js'
import { PengajuanStatus, DownloadBukti } from '../components/Pengajuan.jsx'
import { SUB_TYPES } from '../config/subtypes.js'
import { ProjectTypes, TypeBadge, PrintBadge, DemoBadge, InvoiceNo, DeadlineCell, NoteIcon } from '../components/badges.jsx'
import { Button, Card, Empty, Input, Pill, Progress, Tabs, Sheet, Popover, cx } from '../components/ui.jsx'
import { DENSITIES, useDensity } from '../lib/density.js'
import { dayKey, addDays } from '../lib/performance.js'
import { daysLeft, rupiah, tgl } from '../lib/format.js'
import { PriorityBadge } from '../components/Priority.jsx'
import TimeAgo from '../components/TimeAgo.jsx'

export default function Projects() {
  const { user, data, branchFilter } = useApp()
  const projectOf = (id) => data.projects.find((x) => x.id === id) // versi terbaru dari store
  const [tab, setTab] = useState('all')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('aktif')
  // Pencarian/filter/urutan tabel disimpan di sini, bukan di dalam tabelnya,
  // supaya tidak hilang saat panel detail dibuka-tutup atau setelah cetak.
  const [tableState, setTableState] = useState({ q: '', sortKey: 'timestamp', sortDir: 'desc', filters: {}, shownN: 36 })
  const VIEWS = ['list', 'tabel']
  // Tampilan kartu dihapus; preferensi lama yang masih 'grid' jatuh ke list.
  const [view, setViewRaw] = useState(() => { try { const v = localStorage.getItem('atlas-view'); return VIEWS.includes(v) ? v : 'list' } catch { return 'list' } })
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
    .filter((s) => ['persetujuan', 'pembayaran', ...VENDOR_PAID_STAGES].includes(s.stage) || (s.data?.bukti_transfer))
    .map((s) => ({ ...s, project: p }))), [finScoped])

  const [prFilter, setPrFilter] = useState('') // filter prioritas (judul kolom)
  const [detailFor, setDetailFor] = useState(null) // panel kanan: detail project
  const [filesFor, setFilesFor] = useState(null) // panel kanan: file project
  const [cols, setCols] = useState(() => { try { const v = JSON.parse(localStorage.getItem('atlas-cols') || 'null'); return Array.isArray(v) && v.length ? v.filter((k) => ALL_COLS.includes(k)) : ALL_COLS } catch { return ALL_COLS } })
  const saveCols = (next) => { setCols(next); try { localStorage.setItem('atlas-cols', JSON.stringify(next)) } catch { /* abaikan */ } }
  const worker = isWorkRole(user) // penerjemah / proofreader / otorisator → tampilan fokus tugas
  // Pelaksana freelance tidak terikat cabang, jadi kolom cabang/print/CS disembunyikan.
  // Selain itu tampilan List & Tabel-nya sama persis dengan My Project milik CS.
  const SEMBUNYI_TABEL = ['cabang', 'print', 'cs']
  const SEMBUNYI_LIST = ['cabang']
  const colsAktif = worker ? cols.filter((k) => !SEMBUNYI_LIST.includes(k)) : cols
  const [fullView, setFullView] = useState(false)
  const [shownN, setShownN] = useState(36)
  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return scoped
      .filter((p) => tab === 'all' || (p.sub_projects || []).some((x) => (x.type || 'jasa_lain') === tab))
      .filter((p) => status === 'semua' || (status === 'aktif' ? !isDone(p) : isDone(p)))
      .filter((p) => !s || [p.invoice_no, p.customer?.name, p.about?.description, ...(p.sub_projects || []).map((x) => x.title)].join(' ').toLowerCase().includes(s))
      .filter((p) => !dlFilter || (p.about?.deadline && String(p.about.deadline).slice(0, 10) >= dlFilter.from && String(p.about.deadline).slice(0, 10) <= dlFilter.to))
      .filter((p) => (!bpFilter.branch || p.branch === bpFilter.branch) && (!bpFilter.print || (p.about?.print_location || p.branch) === bpFilter.print))
      .filter((p) => !prFilter || (p.about?.priority || 'Normal') === prFilter)
      .sort((a, b) => sort === 'baru' ? new Date(b.created_at || 0) - new Date(a.created_at || 0) : new Date(a.about?.deadline || 0) - new Date(b.about?.deadline || 0))
  }, [scoped, tab, q, status, sort, dlFilter, bpFilter, prFilter])
  // project lewat deadline & belum selesai — selalu dipajang di atas tabel (hilang otomatis saat selesai)
  const late = useMemo(() => list.filter((p) => !isDone(p) && daysLeft(p.about?.deadline) < 0), [list])
  const rest = useMemo(() => late.length ? list.filter((p) => !late.includes(p)) : list, [list, late])

  // pengatur tampilan daftar: kepadatan baris, ukuran huruf, dan mode layar penuh
  const [density, setDensity] = useDensity()
  const [zoom, setZoom] = useState(() => { const v = Number(localStorage.getItem('atlas-proj-zoom')); return v >= 70 && v <= 150 ? v : 100 })
  useEffect(() => { try { localStorage.setItem('atlas-proj-zoom', String(zoom)) } catch { /* abaikan */ } }, [zoom])
  const [full, setFull] = useState(false)
  useEffect(() => { // Esc untuk keluar dari layar penuh
    if (!full) return
    const f = (e) => e.key === 'Escape' && setFull(false)
    window.addEventListener('keydown', f)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', f); document.body.style.overflow = '' }
  }, [full])

  const tabs = [
    { value: 'all', label: 'Semua', count: scoped.length },
    ...Object.entries(SUB_TYPES).map(([k, t]) => ({ value: k, label: t.label, count: scoped.filter((p) => (p.sub_projects || []).some((x) => (x.type || 'jasa_lain') === k)).length })),
    { value: 'vendor', label: 'Pengajuan Vendor', count: vendorRows.filter((r) => ['persetujuan', 'pembayaran'].includes(r.stage)).length },
  ]

  return (
    // ruang bawah ±150px di HP supaya kartu terakhir tidak tertutup tombol + dan menu bawah
    <div className={cx('space-y-4', !worker && 'pb-[150px] md:pb-0')}>
      <div className="flex items-end justify-between gap-3">
        <div><h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">My Project</h1><p className="text-sm text-ink-mute">{worker ? 'Dokumen yang ditugaskan kepada Anda' : 'Nama project = nomor invoice Zoho'}</p></div>
      </div>
      {worker && <KapasitasSaya />}

      {!worker && <Tabs tabs={tabs} value={tab} onChange={setTab} />}

      {worker && (
        <>
          <WorkerBoard projects={scoped} />
          <button type="button" onClick={() => setFullView((v) => !v)} className="text-xs font-semibold text-brand hover:underline">
            {fullView ? 'Sembunyikan tampilan lengkap' : 'Lihat semua project saya (tampilan lengkap)'}
          </button>
        </>
      )}

      {worker && !fullView ? null : tab === 'vendor' ? <VendorPayments rows={vendorRows} /> : (
        <>
          {/* di HP: kolom cari satu baris penuh, tombol-tombol turun ke baris berikutnya */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 basis-full sm:basis-auto">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input className="pl-9" placeholder="Cari invoice, pelanggan, dokumen…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="min-w-0 rounded-xl border-0 bg-white px-3 text-sm font-semibold ring-1 ring-slate-200">
              <option value="aktif">Aktif</option><option value="selesai">Selesai</option><option value="semua">Semua</option>
            </select>
            <div className="flex shrink-0 rounded-xl bg-white p-1 ring-1 ring-slate-200" role="group" aria-label="Urutkan">
              {[['deadline', CalendarClock, 'Deadline', 'Urutkan: deadline terdekat dulu'], ['baru', Sparkles, 'Terbaru', 'Urutkan: project terbaru dulu']].map(([k, Icon, l, t]) => (
                <button key={k} onClick={() => setSort(k)} aria-pressed={sort === k} title={t}
                  className={cx('flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold', sort === k ? 'bg-ink text-white' : 'text-ink-mute hover:bg-slate-50')}><Icon className="h-3.5 w-3.5" /><span className="hidden sm:inline">{l}</span></button>
              ))}
            </div>
            <div className="flex shrink-0 rounded-xl bg-white p-1 ring-1 ring-slate-200">
              {[['list', List, 'List kompak'], ['tabel', Table2, 'Tabel — 1 baris 1 data']].map(([k, Icon, l]) => (
                <button key={k} onClick={() => setView(k)} aria-label={l} title={l}
                  className={cx('grid h-8 w-8 place-items-center rounded-lg', view === k ? 'bg-ink text-white' : 'text-ink-mute hover:bg-slate-50')}><Icon className="h-4 w-4" /></button>
              ))}
            </div>
            <MenuLainnya
              view={view} worker={worker} colsAktif={colsAktif} saveCols={saveCols}
              density={density} setDensity={setDensity} zoom={zoom} setZoom={setZoom} full={full} setFull={setFull}
              current={{ tab, q, status, sort, dlFilter, prFilter, bpFilter, cols: colsAktif, view }}
              apply={(v) => { setTab(v.tab ?? 'all'); setQ(v.q ?? ''); setStatus(v.status ?? 'aktif'); setSort(v.sort ?? 'deadline'); setDlFilter(v.dlFilter ?? null); setPrFilter(v.prFilter ?? ''); setBpFilter(v.bpFilter ?? { branch: '', print: '' }); if (v.cols) saveCols(v.cols); if (v.view) setView(v.view) }} />
          </div>

          <FilterChips chips={[
            tab !== 'all' && { label: `Jenis: ${tabs.find((t) => t.value === tab)?.label || tab}`, clear: () => setTab('all') },
            q.trim() && { label: `Cari: "${q.trim()}"`, clear: () => setQ('') },
            status !== 'aktif' && { label: `Status: ${status === 'selesai' ? 'Selesai' : 'Semua'}`, clear: () => setStatus('aktif') },
            dlFilter && { label: `Deadline: ${dlFilterLabel(dlFilter)}`, clear: () => setDlFilter(null) },
            prFilter && { label: `Prioritas: ${prFilter}`, clear: () => setPrFilter('') },
            bpFilter.branch && { label: `Cabang: ${bpFilter.branch}`, clear: () => setBpFilter((f) => ({ ...f, branch: '' })) },
            bpFilter.print && { label: `Print: ${bpFilter.print}`, clear: () => setBpFilter((f) => ({ ...f, print: '' })) },
          ].filter(Boolean)} reset={() => { setTab('all'); setQ(''); setStatus('aktif'); setDlFilter(null); setPrFilter(''); setBpFilter({ branch: '', print: '' }) }} />

          {list.length > shownN && <p className="text-xs text-ink-mute">Menampilkan {shownN} dari {list.length} project</p>}
          <ZoomArea zoom={zoom} full={full} onClose={() => setFull(false)} count={list.length}
            tools={<ViewTools density={density} setDensity={setDensity} zoom={zoom} setZoom={setZoom} full={full} setFull={setFull} />}>
          {list.length === 0 && !(view === 'list' && (dlFilter || bpFilter.branch || bpFilter.print || q || tab !== 'all')) ? (
            <Card><Empty icon={FolderOpen} title={worker ? 'Belum ada project untuk Anda' : 'Belum ada project'} text={worker ? 'Project akan muncul di sini begitu ada yang ditugaskan kepada Anda.' : 'Buat project baru dari invoice Zoho.'} action={worker ? null : <Button onClick={() => go('projects/new')}><Plus className="h-4 w-4" />Project Baru</Button>} /></Card>
          ) : view === 'list' ? <ProjectList list={rest.slice(0, shownN)} late={late} dlFilter={dlFilter} setDlFilter={setDlFilter} prFilter={prFilter} setPrFilter={setPrFilter} cols={colsAktif} detailFor={detailFor} setDetailFor={setDetailFor} filesFor={filesFor} setFilesFor={setFilesFor} bpFilter={bpFilter} setBpFilter={setBpFilter} options={{ branches: [...new Set(scoped.map((p) => p.branch))].sort(), prints: [...new Set(scoped.map((p) => p.about?.print_location || p.branch))].sort() }} /> : (
            <ProjectSpreadsheet list={list} detailFor={detailFor} state={tableState} setState={setTableState} hideCols={worker ? SEMBUNYI_TABEL : []}
              onDetail={(p) => { setDetailFor(p); setFilesFor(null) }}
              onFiles={(p) => setFilesFor(p)}
              onPrint={(p) => { setFilesFor(p) }} />
          )}
          {view !== 'tabel' && list.length > shownN && <Button variant="outline" className="w-full" onClick={() => setShownN((n) => n + 36)}>Tampilkan 36 lagi ({list.length - shownN} tersisa)</Button>}
          </ZoomArea>
        </>
      )}

      {filesFor && (
        <Sheet open side onClose={() => setFilesFor(null)} title="File Project" subtitle={`${invoiceLabel(filesFor.invoice_no)} · ${filesFor.customer?.name || ''}`}
          footer={<><Button variant="outline" className="flex-1 sm:flex-none sm:px-6" onClick={() => setFilesFor(null)}>Tutup</Button><span className="flex-1" />
            <Button variant="outline" size="sm" onClick={() => { setDetailFor(filesFor); setFilesFor(null) }}><Eye className="h-3.5 w-3.5" />Detail project</Button></>}>
          <FileManager project={projectOf(filesFor.id) || filesFor} />
        </Sheet>
      )}
      {detailFor && (
        <Sheet open side wide onClose={() => setDetailFor(null)} title={invoiceLabel(detailFor.invoice_no)} subtitle={`${detailFor.customer?.name || ''} · ${detailFor.branch}`}
          footer={<><Button variant="outline" className="flex-1 sm:flex-none sm:px-6" onClick={() => setDetailFor(null)}>Tutup</Button><span className="flex-1" />
            <a href={`#/projects/${detailFor.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline" title="Buka sebagai halaman penuh">Halaman penuh →</a></>}>
          <ProjectDetail id={detailFor.id} embedded />
        </Sheet>
      )}
      {!worker && (
        // di atas menu bawah (±64px) + safe area iPhone, supaya tidak menempel di tepi layar
        <button onClick={() => go('projects/new')} aria-label="Project baru"
          style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
          className="fixed right-4 z-30 grid h-14 w-14 place-items-center rounded-2xl bg-brand text-white shadow-lg shadow-brand/30 md:hidden">
          <Plus className="h-6 w-6" />
        </button>
      )}
    </div>
  )
}

// ============================================================
//  PENGATUR TAMPILAN DAFTAR PROJECT (khusus My Project)
//  Kepadatan baris (rapat/normal/lega) · ukuran huruf · layar penuh.
//  Hanya mengubah tampilan — data, filter, dan kolomnya tidak tersentuh.
// ============================================================
const ZOOM_STEPS = [70, 80, 90, 100, 110, 125, 150]
function ViewTools({ density, setDensity, zoom, setZoom, full, setFull }) {
  const i = DENSITIES.findIndex(([k]) => k === density)
  const next = DENSITIES[(i + 1) % DENSITIES.length]
  const zi = ZOOM_STEPS.indexOf(zoom) === -1 ? ZOOM_STEPS.indexOf(100) : ZOOM_STEPS.indexOf(zoom)
  const step = (d) => setZoom(ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, zi + d))])
  return (
    <>
      <div className="flex shrink-0 items-center rounded-xl bg-white p-1 ring-1 ring-slate-200" role="group" aria-label="Ukuran huruf daftar">
        <button type="button" onClick={() => step(-1)} disabled={zi === 0} aria-label="Perkecil huruf" title="Perkecil huruf"
          className="grid h-8 w-8 place-items-center rounded-lg text-ink-mute hover:bg-slate-50 hover:text-brand disabled:opacity-30"><Minus className="h-4 w-4" /></button>
        <button type="button" onClick={() => setZoom(100)} title="Kembalikan ke ukuran normal" aria-label={`Ukuran huruf ${zoom} persen, klik untuk normal`}
          className="min-w-[42px] px-1 text-center text-[11px] font-bold tabular-nums text-ink-soft hover:text-brand">{zoom}%</button>
        <button type="button" onClick={() => step(1)} disabled={zi === ZOOM_STEPS.length - 1} aria-label="Perbesar huruf" title="Perbesar huruf"
          className="grid h-8 w-8 place-items-center rounded-lg text-ink-mute hover:bg-slate-50 hover:text-brand disabled:opacity-30"><Plus className="h-4 w-4" /></button>
      </div>
      <button type="button" onClick={() => setDensity(next[0])} aria-label={`Kepadatan baris: ${DENSITIES[i]?.[1] || 'Normal'} — klik untuk ${next[1]}`}
        title={`Jarak atas-bawah baris: ${DENSITIES[i]?.[1] || 'Normal'} — klik untuk ${next[1]}`}
        className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-white px-2.5 text-[11px] font-semibold text-ink-mute ring-1 ring-slate-200 hover:text-brand">
        {density === 'compact' ? <Rows3 className="h-4 w-4" /> : density === 'lega' ? <Rows2 className="h-4 w-4" /> : <Rows4 className="h-4 w-4" />}
        <span className="hidden sm:inline">{DENSITIES[i]?.[1] || 'Normal'}</span>
      </button>
      <button type="button" onClick={() => setFull(!full)} aria-pressed={full} aria-label={full ? 'Keluar dari layar penuh' : 'Lihat tabel layar penuh'}
        title={full ? 'Keluar dari layar penuh (Esc)' : 'Layar penuh — lihat seluruh tabel'}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-ink-mute ring-1 ring-slate-200 hover:text-brand">
        {full ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </button>
    </>
  )
}

/** Pembungkus daftar: menerapkan ukuran huruf & mode layar penuh. */
function ZoomArea({ zoom, full, onClose, tools, count, children }) {
  const body = <div style={zoom === 100 ? undefined : { zoom: zoom / 100 }}>{children}</div>
  if (!full) return <div className="space-y-3">{body}</div>
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[var(--page)]">
      <div className="border-b border-slate-200 bg-white px-3 py-2 sm:flex sm:items-center sm:gap-2">
        <div className="flex items-center gap-2">
          <b className="min-w-0 flex-1 truncate text-sm">Tabel Project <span className="font-normal text-ink-mute">({count})</span></b>
          <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-ink-mute ring-1 ring-slate-200 hover:text-brand sm:order-last" aria-label="Tutup layar penuh"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 sm:ml-auto sm:mt-0">{tools}</div>
      </div>
      {/* di layar penuh kepala tabel menempel di atas wadah ini, bukan di bawah header aplikasi */}
      <div className="min-h-0 flex-1 space-y-3 overflow-auto p-3" style={{ '--list-top': '0px' }}>{body}</div>
    </div>
  )
}

function ProjectCard({ p, onOpen, active }) {
  const prog = progressOf(p)
  const d = daysLeft(p.about?.deadline)
  const done = isDone(p)
  return (
    <div className="relative">
    <button type="button" onClick={onOpen} aria-label={`Detail ${invoiceLabel(p.invoice_no)}`} className="block w-full text-left">
      <Card className={cx('h-full p-4 pb-0 transition hover:-translate-y-0.5 hover:shadow-md', active && 'ring-2 ring-brand')}>
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
        <div className="mt-3 flex items-center gap-2 pb-4"><Progress value={prog} /><span className="text-[11px] font-semibold text-ink-mute">{prog}%</span></div>
        <div onClick={(e) => { e.preventDefault(); e.stopPropagation() }} className="-mx-4 overflow-hidden rounded-b-2xl"><WorkerActions project={p} /></div>
      </Card>
    </button>
    </div>
  )
}

// Tahap paling awal di antara sub project = posisi project saat ini
function currentStage(p) {
  const open = (p.sub_projects || []).filter((s) => s.stage !== DONE)
  if (!open.length) return 'Selesai'
  const labels = [...new Set(open.map((s) => stageLabel(flowOf(s, p), s.stage)))]
  return labels.length > 1 ? `${labels[0]} +${labels.length - 1}` : labels[0]
}



/** Chip filter aktif — satu baris ringkas dengan tombol hapus & reset. */
function FilterChips({ chips, reset }) {
  if (!chips.length) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((c, i) => (
        <span key={i} className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-semibold text-brand ring-1 ring-brand/20">
          {c.label}
          <button type="button" onClick={c.clear} aria-label={`Hapus filter ${c.label}`} className="rounded-full p-0.5 hover:bg-brand/15"><X className="h-3 w-3" /></button>
        </span>
      ))}
      <button type="button" onClick={reset} className="text-[11px] font-semibold text-ink-mute hover:text-rose-600 hover:underline">Reset semua</button>
    </div>
  )
}

/** Tampilan tersimpan: kombinasi filter, urutan, dan kolom yang sering dipakai. */
// ============================================================
//  MENU "LAINNYA" (⋯)
//  Toolbar hanya menyisakan yang dipakai tiap hari: cari, status, urutan,
//  dan pengalih tampilan. Sisanya — kolom, kerapatan, ukuran huruf, layar
//  penuh, tampilan tersimpan, unduh data — masuk ke satu tombol ini,
//  supaya mata tidak perlu memilih dari belasan tombol sekaligus.
// ============================================================
function MenuLainnya({ view, worker, colsAktif, saveCols, density, setDensity, zoom, setZoom, full, setFull, current, apply }) {
  const zi = ZOOM_STEPS.indexOf(zoom) === -1 ? ZOOM_STEPS.indexOf(100) : ZOOM_STEPS.indexOf(zoom)
  const step = (d) => setZoom(ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, zi + d))])
  const berubah = density !== 'normal' || zoom !== 100 || full
  return (
    <Popover label="Pengaturan tampilan lainnya" width="min-w-[270px]" button={({ open, toggle }) => (
      <button onClick={toggle} aria-expanded={open} aria-label="Pengaturan tampilan lainnya" title="Kolom, kerapatan, ukuran huruf, layar penuh, unduh data"
        data-menu-lainnya
        className={cx('relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white ring-1 ring-slate-200 hover:text-brand',
          open ? 'text-brand ring-brand' : 'text-ink-mute')}>
        <MoreHorizontal className="h-4 w-4" />
        {berubah && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-brand" />}
      </button>
    )}>
      {({ close }) => (
        <div className="space-y-2.5">
          <UnduhData barisMenu />

          <div className="border-t border-slate-100 pt-2">
            <p className="mb-1 px-1 text-[11px] font-bold uppercase tracking-wide text-ink-mute">Ukuran huruf</p>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => step(-1)} disabled={zi === 0} aria-label="Perkecil huruf"
                className="grid h-9 w-9 place-items-center rounded-lg ring-1 ring-slate-200 text-ink-mute hover:text-brand disabled:opacity-30"><Minus className="h-4 w-4" /></button>
              <button type="button" onClick={() => setZoom(100)} aria-label={`Ukuran huruf ${zoom} persen, klik untuk normal`}
                className="min-w-[52px] rounded-lg px-1 py-1.5 text-center text-xs font-bold tabular-nums text-ink-soft hover:text-brand">{zoom}%</button>
              <button type="button" onClick={() => step(1)} disabled={zi === ZOOM_STEPS.length - 1} aria-label="Perbesar huruf"
                className="grid h-9 w-9 place-items-center rounded-lg ring-1 ring-slate-200 text-ink-mute hover:text-brand disabled:opacity-30"><Plus className="h-4 w-4" /></button>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-2">
            <p className="mb-1 px-1 text-[11px] font-bold uppercase tracking-wide text-ink-mute">Kerapatan baris</p>
            <div className="flex gap-1">
              {DENSITIES.map(([k, l]) => (
                <button key={k} type="button" onClick={() => setDensity(k)} aria-pressed={density === k}
                  className={cx('flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold', density === k ? 'bg-ink text-white' : 'text-ink-mute ring-1 ring-slate-200 hover:text-brand')}>{l}</button>
              ))}
            </div>
          </div>

          <button type="button" onClick={() => { setFull(!full); close() }} aria-pressed={full}
            className="flex w-full items-center gap-2 rounded-lg border-t border-slate-100 px-2 pb-1 pt-2.5 text-left text-sm font-semibold text-ink hover:text-brand">
            {full ? <Minimize2 className="h-4 w-4 shrink-0" /> : <Maximize2 className="h-4 w-4 shrink-0" />}
            {full ? 'Keluar dari layar penuh' : 'Layar penuh'}
          </button>

          {view === 'list' && (
            <div className="border-t border-slate-100 pt-2">
              <p className="mb-1 px-1 text-[11px] font-bold uppercase tracking-wide text-ink-mute">Kolom tabel</p>
              <div className="max-h-[180px] space-y-0.5 overflow-y-auto">
                {COLUMNS.filter((c) => !(worker && SEMBUNYI_LIST.includes(c.key))).map((c) => (
                  <label key={c.key} className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1 text-sm hover:bg-slate-50">
                    <input type="checkbox" checked={colsAktif.includes(c.key)} disabled={c.key === 'invoice'}
                      onChange={(e) => saveCols(e.target.checked ? ALL_COLS.filter((k) => k === c.key || colsAktif.includes(k)) : colsAktif.filter((k) => k !== c.key))}
                      className="h-4 w-4 rounded border-slate-300 text-brand disabled:opacity-40" />
                    {c.label}{c.key === 'invoice' && <span className="text-[11px] text-ink-mute">(wajib)</span>}
                  </label>
                ))}
              </div>
              <button type="button" onClick={() => saveCols(ALL_COLS.filter((k) => !(worker && SEMBUNYI_LIST.includes(k))))}
                className="mt-1 w-full rounded-lg px-1 py-1 text-left text-xs font-semibold text-brand hover:underline">Tampilkan semua kolom</button>
            </div>
          )}

          <div className="border-t border-slate-100 pt-2"><SavedViewsPanel current={current} apply={apply} close={close} /></div>
        </div>
      )}
    </Popover>
  )
}

function SavedViewsPanel({ current, apply, close }) {
  const { notify } = useApp()
  const [views, setViews] = useState(() => { try { return JSON.parse(localStorage.getItem('atlas-views') || '[]') } catch { return [] } })
  const [name, setName] = useState('')
  const persist = (next) => { setViews(next); try { localStorage.setItem('atlas-views', JSON.stringify(next)) } catch { /* abaikan */ } }
  const save = () => {
    const n = name.trim(); if (!n) return notify('Beri nama tampilan dulu', 'err')
    persist([...views.filter((v) => v.name !== n), { name: n, ...current }]); setName(''); notify(`Tampilan "${n}" disimpan`)
  }
  return (
        <div className="space-y-2">
          <p className="px-1 text-[11px] font-bold uppercase tracking-wide text-ink-mute">Tampilan tersimpan</p>
          {views.length === 0 && <p className="px-1 text-xs text-ink-mute">Belum ada. Atur filter & kolom, lalu simpan di bawah.</p>}
          {views.map((v) => (
            <div key={v.name} className="flex items-center gap-1">
              <button type="button" onClick={() => { apply(v); close() }} className="min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-left text-sm font-semibold hover:bg-brand-soft hover:text-brand">{v.name}</button>
              <button type="button" onClick={() => persist(views.filter((x) => x.name !== v.name))} aria-label={`Hapus tampilan ${v.name}`} className="rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><X className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          <div className="flex gap-1.5 pt-1">
            <Input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} placeholder="Nama tampilan baru" className="!h-9 !text-xs" aria-label="Nama tampilan" />
            <Button size="sm" onClick={save} title="Simpan filter & kolom saat ini"><Save className="h-3.5 w-3.5" />Simpan</Button>
          </div>
        </div>
  )
}

/** Kolom tabel My Project (tampilan daftar) — bisa dipilih lewat "Kolom" di toolbar. */
/**
 * Tampilan TABEL — satu baris satu project, untuk tim yang terbiasa
 * dengan spreadsheet. Tidak bisa dibuka-tutup seperti List kompak;
 * rinciannya lewat ikon mata (panel kanan).
 * Di bawah md, .card-table mengubah tiap baris jadi kartu (standar UI).
 */
function ProjectTable({ list, cols, detailFor, onDetail, onFiles }) {
  const show = (k) => !cols || cols.includes(k)
  const kolom = COLUMNS.filter((c) => show(c.key))
  if (list.length === 0) return null
  return (
    <div className="min-w-0 max-w-full overflow-x-auto rounded-2xl bg-white ring-1 ring-slate-200">
      <table className="card-table w-full max-w-full table-fixed border-collapse text-left align-top">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80">
            {kolom.map((c) => (
              <th key={c.key} scope="col" className="whitespace-nowrap px-3 py-2.5 text-xs font-bold text-ink-soft">{c.label}</th>
            ))}
            <th scope="col" className="w-[92px] px-3 py-2.5 text-xs font-bold text-ink-soft">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {list.map((p, i) => (
            <tr key={p.id}
              className={cx('border-b border-slate-100 align-top last:border-0 md:hover:bg-brand-soft/40',
                detailFor?.id === p.id ? 'bg-brand-soft/60' : i % 2 === 1 && 'md:bg-slate-50/60')}>
              {kolom.map((c) => (
                <td key={c.key} data-label={c.label} className="min-w-0 max-w-full px-3 py-2.5 text-sm">
                  {c.cell(p, { prog: progressOf(p) })}
                </td>
              ))}
              <td data-label="Aksi" className="px-3 py-2.5">
                <span className="flex items-center gap-1.5">
                  <button type="button" onClick={() => onDetail(p)} title="Detail project (panel kanan)"
                    aria-label={`Detail ${invoiceLabel(p.invoice_no)}`}
                    className={cx('grid h-11 w-11 place-items-center rounded-lg ring-1 transition md:h-7 md:w-7',
                      detailFor?.id === p.id ? 'bg-brand text-white ring-brand' : 'bg-white text-brand ring-brand/30 hover:bg-brand hover:text-white')}>
                    <Eye className="h-4 w-4" />
                  </button>
                  <NoteIcon note={p.about?.notes} className="shrink-0" />
                  <button type="button" onClick={() => onFiles(p)} title="Folder file project"
                    aria-label={`File project ${invoiceLabel(p.invoice_no)}`}
                    className="grid h-11 w-11 place-items-center rounded-lg bg-white text-ink-soft ring-1 ring-slate-300 hover:bg-ink hover:text-white md:h-7 md:w-7">
                    <FolderOpen className="h-4 w-4" />
                  </button>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export const COLUMNS = [
  { key: 'invoice', label: 'Invoice', w: 'minmax(0,1.4fr)',
    cell: (p) => <><span className="flex items-center gap-1.5"><InvoiceNo project={p} /><DemoBadge project={p} /></span><TimeAgo at={p.created_at} prefix="Diposting" /></> },
  { key: 'pelanggan', label: 'Pelanggan', w: 'minmax(0,1.2fr)', cls: 'min-w-0',
    cell: (p) => <><span className="block truncate text-sm font-semibold text-ink">{p.customer?.name}</span><CsName p={p} /></> },
  { key: 'prioritas', label: 'Prioritas', w: '118px', cls: 'min-w-0 overflow-hidden pt-0.5',
    cell: (p) => <><PrioritasTeks p={p} /><SubText p={p} /></> },
  { key: 'deadline', label: 'Deadline', w: 'minmax(0,1fr)',
    cell: (p) => <DeadlineCell project={p} done={isDone(p)} align="left" /> },
  { key: 'layanan', label: 'Layanan', w: 'minmax(0,0.9fr)', cell: (p) => <ProjectTypes project={p} /> },
  { key: 'cabang', label: 'Cabang / Print', w: 'minmax(0,1fr)', cls: 'min-w-0 pt-0.5',
    // Tim minta cabang DAN lokasi print selalu terlihat, termasuk saat keduanya
    // sama — supaya tidak perlu membuka project untuk memastikan.
    // Yang berbeda ditandai warna supaya langsung kelihatan.
    cell: (p) => {
      const print = p.about?.print_location || p.branch
      const beda = print !== p.branch
      return (
        <>
          <span className="block truncate text-sm font-semibold text-ink">{p.branch}</span>
          <span className={cx('mt-0.5 flex items-center gap-1 truncate text-xs', beda ? 'font-bold text-pop' : 'text-ink-mute')}
            title={beda ? `Dicetak di ${print} (beda dari cabang)` : `Dicetak di ${print}`} data-print={beda ? 'beda' : 'sama'}>
            <Printer className="h-3.5 w-3.5 shrink-0" />{print}
          </span>
        </>
      )
    } },
  { key: 'tahap', label: 'Tahap & Progres', w: 'minmax(0,1.5fr)', cls: 'min-w-0',
    cell: (p, { prog }) => <><span className="block truncate text-xs font-semibold text-brand">{currentStage(p)}</span><span className="mt-1 flex items-center gap-2"><Progress value={prog} /><span className="w-8 text-[11px] font-semibold text-ink-mute">{prog}%</span></span></> },
]
export const ALL_COLS = COLUMNS.map((c) => c.key)

const dlFilterLabel = (f) => !f ? '' : f.kind === 'today' ? 'Hari ini' : f.kind === 'tomorrow' ? 'Besok' : `${tgl(f.from)} – ${tgl(f.to)}`

function ProjectList({ list: listAll, late: lateAll = [], dlFilter, setDlFilter, prFilter = '', setPrFilter = () => {}, cols, bpFilter = { branch: '', print: '' }, setBpFilter = () => {}, options = { branches: [], prints: [] }, detailFor, setDetailFor, filesFor, setFilesFor }) {
  const { data } = useApp()
  const projectOf = (id) => data.projects.find((x) => x.id === id) // versi terbaru (setelah upload/hapus di pop-up)
  const [open, setOpen] = useState(() => new Set())
  const toggle = (id) => setOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const bp = 'both'
  const [bpOpen, setBpOpen] = useState(false)
  const bpActive = !!(bpFilter.branch || bpFilter.print)
  const bpLabel = [bpFilter.branch && `Cabang ${bpFilter.branch}`, bpFilter.print && `Print ${bpFilter.print}`].filter(Boolean).join(' · ')
  const [dlOpen, setDlOpen] = useState(false)

  const [prOpen, setPrOpen] = useState(false)
  const PRIOS = ['Sameday', 'Super Ekspres', 'Ekspres', 'Normal']
  const prCount = (k) => [...lateAll, ...listAll].filter((p) => (p.about?.priority || 'Normal') === k).length
  const list = listAll; const late = lateAll
  const show = (k) => !cols || cols.includes(k) // kolom yang ditampilkan (Pengaturan kolom)
  const gridCols = [...COLUMNS.filter((c) => show(c.key)).map((c) => c.w), '96px'].join(' ')
  const fileCount = (p) => collectFiles(p).length
  const today = dayKey()
  const [range, setRange] = useState({ from: today, to: addDays(today, 7) })
  const pick = (f) => { setDlFilter(f); setDlOpen(false) }
  const renderRow = (p, i) => {
    const prog = progressOf(p)
    return (
            <li key={p.id} className={cx('scroll-mt-28 transition', detailFor?.id === p.id || filesFor?.id === p.id ? 'bg-brand-soft/60 shadow-[inset_3px_0_0_0_var(--brand)]' : open.has(p.id) ? 'border-l-4 border-brand bg-brand-soft/70' : i % 2 === 1 && 'bg-slate-50/80')}>
              <div className="relative">
              {/* Klik baris = buka/tutup rincian sub project; ikon mata = halaman detail */}
              <div role="button" tabIndex={0} aria-expanded={open.has(p.id)} onClick={() => toggle(p.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(p.id) } }}
                className={cx('u-row group block cursor-pointer px-4 pr-[120px] lg:pr-4', open.has(p.id) ? 'pl-3' : 'hover:bg-brand-soft/40')}>
                {/* Desktop: baris tabel */}
                <div style={{ gridTemplateColumns: gridCols }} className="hidden items-start gap-3 text-left lg:grid">
                  {COLUMNS.filter((c) => show(c.key)).map((c) => <span key={c.key} className={c.cls}>{c.cell(p, { prog })}</span>)}
                  {/* Tombol baru muncul saat baris disentuh/diarahkan kursor — 3 tombol × 20 baris
                      yang selalu terlihat membuat tabel penuh kotak tanpa guna. Di layar sentuh
                      (tanpa hover) tombolnya tetap terlihat, begitu juga saat baris sedang dibuka. */}
                  <span className={cx('flex items-center justify-end gap-1 transition-opacity',
                    !open.has(p.id) && detailFor?.id !== p.id && '[@media(hover:hover)]:opacity-0 group-hover:!opacity-100 group-focus-within:!opacity-100')} data-aksi-baris>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setDetailFor(p); setFilesFor(null) }} aria-label={`Detail ${invoiceLabel(p.invoice_no)}`} title="Detail project (panel kanan)"
                      className={cx('grid h-7 w-7 place-items-center rounded-lg ring-1 transition', detailFor?.id === p.id ? 'bg-brand text-white ring-brand' : 'bg-white text-brand ring-brand/30 hover:bg-brand hover:text-white')}><Eye className="h-4 w-4" /></button>
                    {/* ikon catatan: tepat setelah ikon mata, hanya muncul bila project punya catatan */}
                    <NoteIcon note={p.about?.notes} className="shrink-0" />
                    <button type="button" onClick={(e) => { e.stopPropagation(); setFilesFor(p) }} aria-label={`File project ${invoiceLabel(p.invoice_no)}`} title="Folder file project (preview, print, download)"
                      className="relative grid h-7 w-7 place-items-center rounded-lg bg-white text-ink-soft ring-1 ring-slate-300 hover:bg-ink hover:text-white"><FolderOpen className="h-4 w-4" />{fileCount(p) > 0 && <span className="absolute -right-1 -top-1 grid h-3.5 min-w-[14px] place-items-center rounded-full bg-ink px-0.5 text-[9px] font-bold text-white">{fileCount(p)}</span>}</button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); toggle(p.id) }} aria-expanded={open.has(p.id)} aria-label={`${open.has(p.id) ? 'Tutup' : 'Buka'} rincian ${invoiceLabel(p.invoice_no)}`} title="Rincian sub project, data terjemahan & catatan"
                      className={cx('grid h-7 w-7 place-items-center rounded-lg ring-1 transition', open.has(p.id) ? 'bg-brand text-white ring-brand' : 'text-ink-mute ring-slate-200 hover:bg-white hover:text-brand')}><ChevronDown className={cx('h-4 w-4 transition', open.has(p.id) && 'rotate-180')} /></button>
                  </span>
                </div>
                {/* Mobile: baris ringkas */}
                <div className="flex items-center gap-3 lg:hidden">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <InvoiceNo project={p} /><NoteIcon note={p.about?.notes} /><ProjectTypes project={p} />
                      <PrintBadge project={p} iconOnly />
                    </div>
                    <TimeAgo at={p.created_at} prefix="Diposting" />
                    <p className="truncate text-xs font-semibold text-ink">{p.customer?.name} <span className="font-normal text-ink-mute">· {p.branch}{p.about?.print_location && p.about.print_location !== p.branch ? ` · Print ${p.about.print_location}` : ''}</span></p>
                    <SubCountPrio p={p} />
                    <div className="mt-1.5 flex items-center gap-2"><Progress value={prog} /><span className="shrink-0 text-[11px] font-semibold text-brand">{currentStage(p)}</span></div>
                  </div>
                  <div className="w-[76px] shrink-0"><DeadlineCell project={p} done={isDone(p)} /></div>
                </div>
              </div>
              <WorkerActions project={p} />
              <span className="absolute right-3 top-3 flex items-center gap-1 lg:hidden">
                <button type="button" onClick={() => { setDetailFor(p); setFilesFor(null) }} aria-label={`Detail ${invoiceLabel(p.invoice_no)} (HP)`} className="grid h-7 w-7 place-items-center rounded-lg bg-white text-brand ring-1 ring-brand/30"><Eye className="h-4 w-4" /></button>
                <button type="button" onClick={() => setFilesFor(p)} aria-label={`File project ${invoiceLabel(p.invoice_no)} (HP)`} className="grid h-7 w-7 place-items-center rounded-lg bg-white text-ink-soft ring-1 ring-slate-300"><FolderOpen className="h-4 w-4" /></button>
                <button type="button" onClick={() => toggle(p.id)} aria-expanded={open.has(p.id)} aria-label={`${open.has(p.id) ? 'Tutup' : 'Buka'} rincian ${invoiceLabel(p.invoice_no)} (HP)`}
                  className={cx('grid h-7 w-7 place-items-center rounded-lg ring-1', open.has(p.id) ? 'bg-brand text-white ring-brand' : 'text-ink-mute ring-slate-200')}><ChevronDown className={cx('h-4 w-4 transition', open.has(p.id) && 'rotate-180')} /></button>
              </span>
              </div>
              {open.has(p.id) && <ProjectExpand p={p} />}
            </li>
          )
  }
  return (
    <Card className="overflow-visible">
      <div style={{ gridTemplateColumns: gridCols }}
        className="pointer-events-none sticky top-[var(--list-top,var(--appbar))] z-10 hidden gap-3 rounded-t-2xl border-b border-slate-200 bg-slate-50/95 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-mute backdrop-blur lg:grid">
        {COLUMNS.filter((c) => show(c.key)).map((c) => {
          if (c.key === 'prioritas') return (
            <button key={c.key} type="button" onClick={() => setPrOpen(true)} className={cx('pointer-events-auto flex items-center gap-1 text-left uppercase hover:text-brand', prFilter && 'text-brand')} title="Filter prioritas">
              Prioritas <ChevronDown className="h-3 w-3" />{prFilter && <span className="rounded-full bg-brand px-1.5 py-px text-[10px] normal-case tracking-normal text-white">{prFilter}</span>}
            </button>
          )
          if (c.key === 'deadline') return (
            <button key={c.key} type="button" onClick={() => setDlOpen(true)} className={cx('pointer-events-auto flex items-center gap-1 text-left uppercase hover:text-brand', dlFilter && 'text-brand')} title="Filter deadline">
              Deadline <ChevronDown className="h-3 w-3" />{dlFilter && <span className="rounded-full bg-brand px-1.5 py-px text-[10px] normal-case tracking-normal text-white">{dlFilterLabel(dlFilter)}</span>}
            </button>
          )
          if (c.key === 'cabang') return (
            <button key={c.key} type="button" onClick={() => setBpOpen(true)} className={cx('pointer-events-auto flex flex-wrap items-center gap-1 text-left uppercase hover:text-brand', bpActive && 'text-brand')} title="Filter cabang / lokasi print">
              Cabang / Print <ChevronDown className="h-3 w-3" />{bpActive && <span className="rounded-full bg-brand px-1.5 py-px text-[10px] normal-case tracking-normal text-white">{bpLabel}</span>}
            </button>
          )
          return <span key={c.key}>{c.label}</span>
        })}
        <span />
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
        <div className="border-b border-rose-200 bg-rose-50/95">
          <p className="flex items-center gap-2 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide text-rose-700"><AlertTriangle className="h-3.5 w-3.5" />Lewat deadline & belum selesai <span className="rounded-full bg-rose-600 px-1.5 text-[10px] text-white">{late.length}</span><span className="hidden font-medium normal-case tracking-normal text-rose-500 sm:inline">hilang otomatis saat project selesai</span></p>
        </div>
      )}
      <Sheet open={prOpen} onClose={() => setPrOpen(false)} title="Filter prioritas"
        footer={<><Button variant="outline" className="flex-1" onClick={() => { setPrFilter(''); setPrOpen(false) }}>Tampilkan semua</Button><Button className="flex-[2]" onClick={() => setPrOpen(false)}>Selesai</Button></>}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {PRIOS.map((k) => <Button key={k} variant={prFilter === k ? 'primary' : 'outline'} onClick={() => { setPrFilter(k); setPrOpen(false) }}><span className="flex items-center gap-2">{k !== 'Normal' && <PriorityBadge p={k} iconOnly />}{k} <span className="opacity-60">({prCount(k)})</span></span></Button>)}
          </div>
          <p className="text-[11px] text-ink-mute">Urutan kecepatan: Sameday → Super Ekspres → Ekspres → Normal. Filter bisa digabung dengan filter Deadline & Cabang.</p>
        </div>
      </Sheet>
      {prFilter && <div className="flex items-center gap-2 border-b border-slate-100 bg-brand-soft/40 px-4 py-1.5 text-xs lg:hidden"><span className="font-semibold text-brand">Prioritas: {prFilter}</span><button type="button" onClick={() => setPrFilter('')} className="ml-auto font-semibold text-ink-mute hover:text-rose-600">Hapus</button></div>}
      {late.length > 0 && <ul className="divide-y divide-rose-100 border-b-2 border-rose-200 bg-rose-50/60">{late.map(renderRow)}</ul>}
      <ul className="divide-y divide-slate-200/70 [&>li:last-child]:rounded-b-2xl [&>li:last-child]:overflow-hidden">
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
  const inView = (r) => (view === 'selesai' ? r.stage === DONE && !!r.data?.bukti_transfer : view === 'dibayar' ? VENDOR_PAID_STAGES.includes(r.stage) : r.stage === view)
  const list = rows.filter(inView)
  const total = list.reduce((a, r) => a + totalPengajuan(r.data), 0)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="-mx-1 flex overflow-x-auto rounded-xl bg-white p-1 ring-1 ring-slate-200">
          {tabs.map(([k, l]) => (
            <button key={k} onClick={() => setView(k)} className={cx('whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold', view === k ? 'bg-ink text-white' : 'text-ink-soft hover:bg-slate-50')}>
              {l} <span className={view === k ? 'text-white/60' : 'text-ink-mute'}>{rows.filter((r) => (k === 'selesai' ? r.stage === DONE && !!r.data?.bukti_transfer : k === 'dibayar' ? VENDOR_PAID_STAGES.includes(r.stage) : r.stage === k)).length}</span>
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
                <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-bold">{invoiceLabel(r.project.invoice_no)}</span><TypeBadge type={r.type} /><PengajuanStatus stage={r.stage} revision={!!r.data?.revision_note} /></div>
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
/** Lingkaran abu berisi jumlah sub project — tampil di kolom Prioritas (desktop) & baris HP. */
/** Prioritas sebagai teks — "Normal" pun tetap ditampilkan. */
function PrioritasTeks({ p }) {
  const prio = p.about?.priority || 'Normal'
  if (prio === 'Normal') return <span className="block truncate text-sm text-ink-mute" data-prio-normal>Normal</span>
  return <PriorityBadge p={prio} className="max-w-full" />
}
/** Jumlah sub project: teks abu-abu di bawah prioritas, tanpa lingkaran. */
function SubText({ p }) {
  const n = p.sub_projects?.length || 0
  // Hampir semua project berisi satu sub project, jadi menulisnya di setiap
  // baris tidak menambah kabar apa pun. Yang disebut hanya yang lebih dari satu.
  if (n <= 1) return null
  return <span className="mt-0.5 block truncate text-[11px] text-ink-mute" data-sub-teks>{n} sub project</span>
}
function SubCount({ p }) {
  const n = p.sub_projects?.length || 0
  return <span title={`${n} sub project`} aria-label={`${n} sub project`} className="grid h-5 min-w-[20px] shrink-0 place-items-center rounded-full bg-slate-100 px-1 text-[11px] font-bold tabular-nums text-ink-soft ring-1 ring-slate-200">{n}</span>
}
/** Nama CS pembuat project (tanpa keterangan cabang dalam kurung). */
function CsName({ p }) {
  const cs = (p.about?.cs_name || '').replace(/\s*\(.*\)\s*$/, '')
  if (!cs) return null
  return <span className="mt-0.5 block truncate text-[11px] text-ink-mute">CS {cs}</span>
}
/** Baris HP: lingkaran jumlah sub + prioritas (hanya bila bukan Normal), lalu nama CS. */
function SubCountPrio({ p }) {
  const prio = p.about?.priority
  return (
    <>
      <PrioritasTeks p={p} />
      <SubText p={p} />
      <CsName p={p} />
    </>
  )
}

function ProjectExpand({ p }) {
  const { nameOf } = useApp()
  const subs = p.sub_projects || []
  const th = 'whitespace-nowrap px-2.5 py-1.5 text-left text-[11px] font-bold text-ink-mute'
  const td = 'px-2.5 py-1.5 align-top text-xs text-ink'
  return (
    <div className="border-t border-brand/15 bg-slate-100/80 px-3 pb-3 pt-2.5 sm:px-4">
      <div className="space-y-2">
        {/* Tabel sederhana — selaras dengan rincian pada tampilan Tabel */}
        <div className="min-w-0 max-w-full overflow-x-auto rounded-xl bg-white ring-1 ring-slate-200">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th scope="col" className={cx(th, 'w-8')}>#</th>
                <th scope="col" className={th}>Judul</th>
                <th scope="col" className={th}>Arah Bahasa</th>
                <th scope="col" className={th}>Penerjemah/Vendor</th>
                <th scope="col" className={cx(th, 'text-right')}>Dok.</th>
                <th scope="col" className={cx(th, 'text-right')}>Hlm.</th>
                <th scope="col" className={th}>Tahap</th>
              </tr>
            </thead>
            <tbody>
              {subs.length === 0 && (
                <tr><td colSpan={7} className="px-2.5 py-4 text-center text-xs text-ink-mute">Belum ada sub project.</td></tr>
              )}
              {subs.map((sb, i) => {
                const who = sb.translator_kind === 'vendor' ? nameOf(sb.translator || sb.data?.vendor) : nameOf(sb.data?.translator || sb.translator)
                const dok = sb.docs?.length || sb.file_count || 0
                const hlm = sb.docs?.length ? sb.docs.reduce((a, d) => a + (Number(d.pages) || 0), 0) : (Number(sb.pages) || 0)
                const arah = sb.lang_from && sb.lang_to ? `${sb.lang_from} → ${sb.lang_to}` : ''
                return (
                  <tr key={sb.id || i} className="border-t border-slate-100">
                    <td className={cx(td, 'tabular-nums text-ink-mute')}>{i + 1}</td>
                    <td className={cx(td, 'max-w-[220px] truncate font-semibold')} title={sb.title}>{sb.title || '—'}</td>
                    <td className={cx(td, 'whitespace-nowrap')}>{arah || '—'}</td>
                    <td className={cx(td, 'max-w-[160px] truncate')} title={who}>{who || '—'}</td>
                    <td className={cx(td, 'text-right tabular-nums')}>{dok}</td>
                    <td className={cx(td, 'text-right tabular-nums')}>{hlm}</td>
                    <td className={cx(td, 'whitespace-nowrap text-brand')}>{stageLabel(flowOf(sb, p), sb.stage)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {p.about?.notes && <p className="flex items-start gap-1.5 whitespace-pre-line rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200"><StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" /><span><b className="font-semibold">Catatan:</b> {p.about.notes}</span></p>}
      </div>
    </div>
  )
}
