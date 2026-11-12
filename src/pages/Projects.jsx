import { useEffect, useMemo, useState } from 'react'
import { go } from '../lib/router.js'
import { Plus, Minus, Search, FolderOpen, Banknote, CalendarClock, Layers, LayoutGrid, List, ChevronRight, ChevronDown, Sparkles, StickyNote, Printer, AlertTriangle, Eye, X, Save, Rows2, Rows3, Rows4, Maximize2, Minimize2, Table2, MoreHorizontal, Columns3, Bookmark } from 'lucide-react'
import FileManager, { fieldFiles, collect as collectFiles } from '../components/FileManager.jsx'
import ProjectDetail, { SubProject, AksiBaris } from './ProjectDetail.jsx'
import WorkerBoard, { WorkerActions, isWorkRole } from '../components/WorkerActions.jsx'
import { useApp } from '../lib/store.jsx'
import { scopeByBranch, can, branchesOf, invoiceLabel, BRANCHES, diKoordinasi, vendorKoordinator, foreignLang } from '../config/access.js'
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
import { langkahBerikutnya } from '../lib/langkah.js'
import { FilterLainnya } from '../components/ToolbarRingkas.jsx'
import TampilanMenu, { muatViews, viewBawaan } from '../components/TampilanProject.jsx'
import { MapTabs } from '../components/SubTab.jsx'
import { muatPref, simpanPref, kelasPref } from '../lib/tampilanProject.js'
import { grupOf, garisUrgensi, baru, umur, sisaWaktu, porsiSla, posisiTahap, kelompokkan, kelasGrup } from '../lib/urgensi.js'
import { TABLE_COLS } from '../lib/projectRow.js'
import TimeAgo from '../components/TimeAgo.jsx'
import CentangApostille from '../components/CentangApostille.jsx'
import { WaktuDibuat, PrioPill, DeadlinePill, CabangPrint, eksekutorOf, dibuatBaru, warnaKategori, infoDeadline } from '../components/BarisCanvas.jsx'
import LayarKerja from './LayarKerja.jsx'
import TugaskanPenerjemah from '../components/TugaskanPenerjemah.jsx'
import { coordinatorFor } from '../config/access.js'

/** Order bahasa Mandarin (direkap Akunting — tanpa koordinator, tiap orang order sendiri). */
const adaMandarin = (p) => (p.sub_projects || []).some((x) => foreignLang(x) === 'Mandarin')
/** Project yang punya sub dikerjakan vendor (order / pengajuan / pembayaran vendor). */
const adaVendor = (p) => (p.sub_projects || []).some((x) => x.translator_kind === 'vendor' || x.data?.vendor || ['persetujuan', 'pembayaran', ...VENDOR_PAID_STAGES].includes(x.stage))

export default function Projects({ tabAwal }) {
  const { user, data, branchFilter, setBranchFilter } = useApp()
  const projectOf = (id) => data.projects.find((x) => x.id === id) // versi terbaru dari store
  // Staf Apostille langsung ke chip Apostille (K6: My Apostille jadi tab di Project)
  const [tab, setTab] = useState(() => tabAwal || (user?.role === 'staf_apostille' ? 'apostille' : 'all'))
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('aktif')
  // Pencarian/filter/urutan tabel disimpan di sini, bukan di dalam tabelnya,
  // supaya tidak hilang saat panel detail dibuka-tutup atau setelah cetak.
  const [tableState, setTableState] = useState(() => { let v = 'deadline'; try { v = localStorage.getItem('atlas-sort') || 'deadline' } catch { /* abaikan */ } return { q: '', sortKey: v === 'baru' ? 'timestamp' : 'deadline', sortDir: v === 'baru' ? 'desc' : 'asc', filters: {}, shownN: 36 } })
  const VIEWS = ['list', 'tabel']
  // Tampilan kartu dihapus; preferensi lama yang masih 'grid' jatuh ke list.
  const [view, setViewRaw] = useState(() => { try { const v = localStorage.getItem('atlas-view'); return VIEWS.includes(v) ? v : 'list' } catch { return 'list' } })
  const setView = (v) => { setViewRaw(v); try { localStorage.setItem('atlas-view', v) } catch { /* abaikan */ } }
  // urutan: 'deadline' (terdekat dulu) atau 'baru' (project terbaru dulu) — tombol saklar, tersimpan per perangkat
  const [sort, setSortRaw] = useState(() => { try { return localStorage.getItem('atlas-sort') || 'deadline' } catch { return 'deadline' } })
  const setSort = (v) => {
    setSortRaw(v); try { localStorage.setItem('atlas-sort', v) } catch { /* abaikan */ }
    // tampilan tabel ikut: Deadline = kolom Deadline naik (terlambat paling akhir), Terbaru = Timestamp turun
    setTableState((t) => ({ ...t, sortKey: v === 'baru' ? 'timestamp' : 'deadline', sortDir: v === 'baru' ? 'desc' : 'asc' }))
  }
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
  // chip cepat: 'hambatan' = lewat tenggat / tenggat hari ini; 'saya' = project yang saya buat / CS-nya saya
  const [cepat, setCepat] = useState('')
  const [detailFor, setDetailFor] = useState(null) // panel kanan: detail project
  const [langkahFor, setLangkahFor] = useState(null) // slide samping: kerjakan langkah berikutnya { p, subId }
  const [tugasFor, setTugasFor] = useState(null) // popup kecil: tetapkan penerjemah + kapasitas di tanggal deadline
  const bukaLangkah = (p, subId, aksi) => {
    setFilesFor(null); setDetailFor(null)
    const sb = (p.sub_projects || []).find((x) => x.id === subId)
    if (aksi && sb?.stage === 'pilih_penerjemah' && !coordinatorFor(data.users, foreignLang(sb))) return setTugasFor({ p, sub: sb })
    setLangkahFor({ p, subId })
  }
  const [filesFor, setFilesFor] = useState(null) // panel kanan: file project
  const [cols, setCols] = useState(() => { try { const v = JSON.parse(localStorage.getItem('atlas-cols-v3') || 'null'); return Array.isArray(v) && v.length ? v.filter((k) => ALL_COLS.includes(k)) : ALL_COLS } catch { return ALL_COLS } })
  const saveCols = (next) => { setCols(next); try { localStorage.setItem('atlas-cols-v3', JSON.stringify(next)) } catch { /* abaikan */ } }
  const worker = isWorkRole(user) // penerjemah / proofreader / otorisator → tampilan fokus tugas
  // Pelaksana freelance tidak terikat cabang, jadi kolom cabang/print/CS disembunyikan.
  // Selain itu tampilan List & Tabel-nya sama persis dengan My Project milik CS.
  const SEMBUNYI_TABEL = ['cabang', 'print', 'cs', 'status', 'orang']
  const SEMBUNYI_LIST = ['cabang'] // pelaksana tidak perlu kolom "Tahap → berikutnya"
  const colsAktif = worker ? cols.filter((k) => !SEMBUNYI_LIST.includes(k)) : cols
  const [fullView, setFullView] = useState(false)
  const [shownN, setShownN] = useState(36)
  const [pref, setPrefRaw] = useState(muatPref)
  const setPref = (p) => { setPrefRaw(p); simpanPref(p) }
  const [namaView, setNamaView] = useState('')
  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return scoped
      .filter((p) => tab === 'all' || (tab === 'vendor' ? adaVendor(p) : tab === 'koordinator' ? (p.sub_projects || []).some((x) => diKoordinasi(user, x)) : tab === 'mandarin' ? adaMandarin(p) : (p.sub_projects || []).some((x) => (x.type || 'jasa_lain') === tab)))
      .filter((p) => status === 'semua' || (status === 'aktif' ? !isDone(p) : isDone(p)))
      .filter((p) => !s || [p.invoice_no, p.customer?.name, p.about?.description, ...(p.sub_projects || []).map((x) => x.title)].join(' ').toLowerCase().includes(s))
      .filter((p) => !dlFilter || (p.about?.deadline && String(p.about.deadline).slice(0, 10) >= dlFilter.from && String(p.about.deadline).slice(0, 10) <= dlFilter.to))
      .filter((p) => (!bpFilter.branch || p.branch === bpFilter.branch) && (!bpFilter.print || (p.about?.print_location || p.branch) === bpFilter.print))
      .filter((p) => !prFilter || (p.about?.priority || 'Normal') === prFilter)
      .filter((p) => cepat !== 'hambatan' || (!isDone(p) && daysLeft(p.about?.deadline) !== null && daysLeft(p.about?.deadline) <= 0))
      .filter((p) => cepat !== 'saya' || p.created_by === user.id || (p.about?.cs_id && p.about.cs_id === user.id))
      .filter((p) => cepat !== 'pilih' || (p.sub_projects || []).some((x) => x.stage === 'pilih_penerjemah'))
      .sort((a, b) => {
        // Terbaru: tanggal input, paling baru dulu
        if (sort === 'baru') return new Date(b.created_at || 0) - new Date(a.created_at || 0)
        // Deadline: hari ini, besok, dst.; yang sudah lewat deadline (dan belum selesai) ditaruh paling akhir
        const lewat = (p) => (!isDone(p) && daysLeft(p.about?.deadline) < 0 ? 1 : 0)
        const la = lewat(a), lb = lewat(b); if (la !== lb) return la - lb
        const da = a.about?.deadline ? new Date(a.about.deadline).getTime() : Infinity, db = b.about?.deadline ? new Date(b.about.deadline).getTime() : Infinity
        return da === db ? new Date(b.created_at || 0) - new Date(a.created_at || 0) : da - db
      })
  }, [scoped, tab, q, status, sort, dlFilter, bpFilter, prFilter, cepat, user.id])
  // project lewat deadline & belum selesai — dihitung untuk ringkasan; urutannya ikut aturan di atas (paling akhir)
  const late = useMemo(() => list.filter((p) => !isDone(p) && daysLeft(p.about?.deadline) < 0), [list])
  const rest = list

  // pengatur tampilan daftar: kepadatan baris, ukuran huruf, dan mode layar penuh
  const [density, setDensity] = useDensity()
  const [zoom, setZoom] = useState(() => { const v = Number(localStorage.getItem('atlas-proj-zoom')); return v >= 70 && v <= 150 ? v : 100 })
  useEffect(() => { try { localStorage.setItem('atlas-proj-zoom', String(zoom)) } catch { /* abaikan */ } }, [zoom])
  const [full, setFull] = useState(false)
  /** Terapkan satu tampilan tersimpan (saringan + kolom + pengaturan tampilan). */
  const terapkanView = (v) => {
    setNamaView(v.name || '')
    setTab(v.tab ?? 'all'); setQ(v.q ?? ''); setStatus(v.status ?? 'aktif'); setSort(v.sort ?? 'deadline'); setCepat(v.cepat ?? '')
    setDlFilter(v.dlFilter ?? null); setPrFilter(v.prFilter ?? ''); setBpFilter(v.bpFilter ?? { branch: '', print: '' })
    if (v.cols) saveCols(v.cols); if (v.view) setView(v.view)
    if (v.pref) setPref({ ...pref, ...v.pref }); if (v.zoom) setZoom(v.zoom); if (v.density) setDensity(v.density)
  }
  useEffect(() => { // tampilan bertanda ★ dibuka otomatis
    const d = viewBawaan(); if (!d) return
    const v = muatViews().find((x) => x.name === d); if (v) terapkanView(v)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { // Esc untuk keluar dari layar penuh
    if (!full) return
    const f = (e) => e.key === 'Escape' && setFull(false)
    window.addEventListener('keydown', f)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', f); document.body.style.overflow = '' }
  }, [full])

  const nHambatan = scoped.filter((p) => !isDone(p) && daysLeft(p.about?.deadline) !== null && daysLeft(p.about?.deadline) <= 0).length
  const nSaya = scoped.filter((p) => !isDone(p) && (p.created_by === user.id || (p.about?.cs_id && p.about.cs_id === user.id))).length
  const dasarStatus = status === 'aktif' ? scoped.filter((p) => !isDone(p)) : status === 'selesai' ? scoped.filter((p) => isDone(p)) : scoped
  const tabs = [
    { value: 'all', label: 'Semua', count: dasarStatus.length },
    ...Object.entries(SUB_TYPES).map(([k, t]) => ({ value: k, label: t.label, count: dasarStatus.filter((p) => (p.sub_projects || []).some((x) => (x.type || 'jasa_lain') === k)).length })),
    { value: 'vendor', label: 'Vendor', count: dasarStatus.filter(adaVendor).length },
    ...(vendorKoordinator(user).length ? [{ value: 'koordinator', label: 'Koordinator', count: dasarStatus.filter((p) => (p.sub_projects || []).some((x) => diKoordinasi(user, x))).length }] : []),
    ...(user.role === 'akunting' ? [{ value: 'mandarin', label: 'Order Mandarin', count: dasarStatus.filter(adaMandarin).length }] : []),
  ]

  return (
    <div className="space-y-3">
      {/* ===== TOOLBAR BARU: satu baris alat · strip Perlu Anda · map status + saringan ===== */}
      {(() => {
        const adaToolbar = !worker || fullView
        const bisaSaring = adaToolbar
        const nAktif = scoped.filter((p) => !isDone(p)).length
        const tabStatus = [['aktif', 'Aktif', nAktif], ['selesai', 'Selesai', scoped.length - nAktif], ['semua', 'Semua', scoped.length]].map(([key, label, n]) => ({ key, label, n: status === key ? 0 : n, ket: n }))
        const nFilter = [!!prFilter, branchFilter !== 'Semua', !!bpFilter.print, !!dlFilter].filter(Boolean).length
        const nHariIni = scoped.filter((p) => !isDone(p) && p.about?.deadline && String(p.about.deadline).slice(0, 10) === dayKey()).length
        const saklarView = (
          <div className="flex shrink-0 rounded-xl bg-white p-1 ring-1 ring-slate-200" data-saklar-view>
            {[['list', List, 'Kartu'], ['tabel', Table2, 'Tabel']].map(([k, Icon, l]) => (
              <button key={k} onClick={() => setView(k)} aria-label={l} title={l} aria-pressed={view === k}
                className={cx('grid h-8 w-8 place-items-center rounded-lg', view === k ? 'bg-ink text-white' : 'text-ink-mute hover:bg-slate-50')}><Icon className="h-4 w-4" /></button>
            ))}
          </div>
        )
        const menuTampilan = (
          <TampilanMenu pref={pref} setPref={setPref} zoom={zoom} setZoom={setZoom} density={density} setDensity={setDensity} setFull={setFull} view={view}
            kolom={{ COLUMNS: COLUMNS.filter((c) => !(worker ? SEMBUNYI_LIST : []).includes(c.key)), colsAktif, saveCols, semua: ALL_COLS.filter((k) => !(worker ? SEMBUNYI_LIST : []).includes(k)) }}
            kolomTabel={TABLE_COLS.filter((c) => !(worker ? SEMBUNYI_TABEL : []).includes(c.key))}
            current={{ name: namaView, tab, q, status, sort, cepat, dlFilter, prFilter, bpFilter, cols: colsAktif, view }} apply={terapkanView} />
        )
        const filterBtn = bisaSaring && (
          <FilterLainnya aktif={nFilter} onReset={() => { setPrFilter(''); setBranchFilter('Semua'); setBpFilter({ branch: '', print: '' }); setDlFilter(null) }}>
            <label className="block text-xs font-semibold text-ink-soft sm:hidden">Urutkan
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="mt-1 h-10 w-full rounded-xl border-0 bg-white px-3 text-sm font-semibold ring-1 ring-slate-200">
                <option value="deadline">Deadline terdekat</option><option value="baru">Project terbaru</option>
              </select></label>
            <label className="block text-xs font-semibold text-ink-soft">Prioritas
              <select value={prFilter} onChange={(e) => setPrFilter(e.target.value)} className="mt-1 h-10 w-full rounded-xl border-0 bg-white px-3 text-sm font-semibold ring-1 ring-slate-200">
                <option value="">Semua prioritas</option>{['Sameday', 'Super Ekspres', 'Ekspres', 'Normal'].map((k) => <option key={k} value={k}>{k}</option>)}
              </select></label>
            {!worker && (can.seeAllBranches(user) || branchesOf(user).length > 1) && <label className="block text-xs font-semibold text-ink-soft">Cabang
              <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} aria-label="Filter cabang" className="mt-1 h-10 w-full rounded-xl border-0 bg-white px-3 text-sm font-semibold ring-1 ring-slate-200">
                <option value="Semua">{can.seeAllBranches(user) ? 'Semua cabang' : 'Semua cabang saya'}</option>{(can.seeAllBranches(user) ? BRANCHES : branchesOf(user)).map((b) => <option key={b} value={b}>{b}</option>)}
              </select></label>}
            {!worker && <label className="block text-xs font-semibold text-ink-soft">Lokasi print
              <select value={bpFilter.print} onChange={(e) => setBpFilter((f) => ({ ...f, print: e.target.value }))} className="mt-1 h-10 w-full rounded-xl border-0 bg-white px-3 text-sm font-semibold ring-1 ring-slate-200">
                <option value="">Semua lokasi</option>{[...new Set(scoped.map((p) => p.about?.print_location || p.branch))].sort().map((b) => <option key={b} value={b}>{b}</option>)}
              </select></label>}
            <div className="text-xs font-semibold text-ink-soft">Deadline
              <div className="mt-1 grid grid-cols-2 gap-1.5">
                <Button variant={dlFilter?.kind === 'today' ? 'primary' : 'outline'} size="sm" onClick={() => setDlFilter({ kind: 'today', from: dayKey(), to: dayKey() })}>Hari ini</Button>
                <Button variant={dlFilter?.kind === 'tomorrow' ? 'primary' : 'outline'} size="sm" onClick={() => setDlFilter({ kind: 'tomorrow', from: addDays(dayKey(), 1), to: addDays(dayKey(), 1) })}>Besok</Button>
              </div>
              <p className="mt-1 text-[11px] font-normal text-ink-mute">Rentang tanggal lain: klik judul kolom Deadline.</p>
            </div>
          </FilterLainnya>
        )
        const ringkasSaringan = [status === 'aktif' ? 'Aktif' : status === 'selesai' ? 'Selesai' : 'Semua status', tab !== 'all' ? (tabs.find((t) => t.value === tab)?.label || tab) : null, cepat === 'hambatan' ? 'Hambatan' : cepat === 'pilih' ? 'Perlu pilih penerjemah' : cepat === 'saya' ? 'Saya' : null, dlFilter ? `Deadline ${dlFilterLabel(dlFilter)}` : null, `urut ${sort === 'baru' ? 'terbaru' : 'deadline'}`].filter(Boolean).join(' › ')

        // --- toolbar disembunyikan: satu baris tipis ---
        if (!pref.toolbar && adaToolbar) {
          return (
            <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-1.5 ring-1 ring-slate-200" data-toolbar-tipis>
              <button type="button" onClick={() => setPref({ ...pref, toolbar: true })} className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-xs text-ink-soft hover:text-brand" title="Tampilkan toolbar">
                <b className="shrink-0 text-ink">Project</b><span className="shrink-0 whitespace-nowrap text-ink-mute">· {list.length}{status === 'aktif' ? ' aktif' : ''}</span>
                <span className="hidden min-w-0 truncate sm:inline">· {ringkasSaringan}</span>
                <span className="ml-1 shrink-0 whitespace-nowrap font-bold text-brand">toolbar ▾</span>
              </button>
              {saklarView}{menuTampilan}
            </div>
          )
        }

        const pil = (on) => (on ? 'bg-[#141B34] text-white border-[#141B34]' : 'bg-white text-[#5E6380] border-[#E7E8F0] hover:border-[#B9BDD0] hover:text-[#141B34]')
        const seg = (on) => cx('min-h-[38px] rounded-[10px] px-3 text-[13px] font-semibold transition', on ? 'bg-[#141B34] text-white' : 'text-[#5E6380] hover:text-[#141B34]')
        const chip = (on, extra) => cx('inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] border px-3 text-[13px] font-semibold transition', extra || pil(on))
        const n = (v, on) => <span className={cx('text-xs font-bold tabular-nums', on ? 'opacity-80' : 'opacity-75')}>{v}</span>
        return (
          <>
            {/* Baris alat (CANVAS ATLAS): cari · Filter · jumlah · urut · tampilan · atur · Project baru · sembunyikan */}
            <div className="flex flex-wrap items-center gap-2.5" data-alat>
              {worker && <h1 className="mr-1 text-xl font-extrabold tracking-tight">Project</h1>}
              {worker && <p className="text-sm text-[#5E6380]">Dokumen yang ditugaskan kepada Anda</p>}
              {bisaSaring && (
                <div className="relative flex min-h-11 min-w-0 max-w-[320px] flex-[1_1_180px] items-center gap-2 rounded-xl border border-[#D9DBE7] bg-white px-3">
                  <Search className="h-[18px] w-[18px] shrink-0 text-[#5E6380]" aria-hidden="true" />
                  <input type="search" aria-label="Cari project" placeholder="Cari invoice, pelanggan" value={q} onChange={(e) => setQ(e.target.value)} className="h-10 min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-[#141B34] outline-none placeholder:text-[#8A8FA8] focus:ring-0" />
                </div>
              )}
              {bisaSaring && filterBtn}
              {!worker && <span className="mr-1.5 hidden text-sm font-semibold text-[#5E6380] 2xl:inline" data-jumlah>{list.length} project</span>}
              <span className="min-w-0 flex-1" />
              {bisaSaring && (
                <div className="hidden rounded-xl border border-[#E7E8F0] bg-white p-[3px] sm:flex" role="group" aria-label="Urutkan" data-urut>
                  {[['deadline', 'Deadline'], ['baru', 'Terbaru']].map(([k, l]) => <button key={k} type="button" onClick={() => setSort(k)} aria-pressed={sort === k} data-urut-pilihan={k} className={seg(sort === k)}>{l}</button>)}
                </div>
              )}
              {adaToolbar && (
                <div className="flex rounded-xl border border-[#E7E8F0] bg-white p-[3px]" role="group" aria-label="Tampilan daftar" data-saklar-view>
                  {[['list', 'Kartu'], ['tabel', 'Tabel']].map(([k, l]) => <button key={k} type="button" onClick={() => setView(k)} aria-pressed={view === k} className={seg(view === k)}>{l}</button>)}
                </div>
              )}
              {adaToolbar && view === 'tabel' && !worker && (
                <div className="flex rounded-xl border border-[#E7E8F0] bg-white p-[3px]" role="group" aria-label="Status project" data-status-tabel>
                  {tabStatus.map((t) => <button key={t.key} type="button" onClick={() => setStatus(t.key)} aria-pressed={status === t.key} className={seg(status === t.key)}>{t.label}</button>)}
                </div>
              )}
              {adaToolbar && menuTampilan}
              {!worker && <button type="button" onClick={() => go('projects/new')} data-aksi="project-baru"
                className="hidden min-h-11 items-center gap-2 rounded-xl bg-[#141B34] px-4 text-sm font-semibold text-white hover:opacity-90 sm:inline-flex">Project baru<Plus className="h-[18px] w-[18px]" aria-hidden="true" /></button>}
              {adaToolbar && <button type="button" onClick={() => setPref({ ...pref, toolbar: false })} aria-label="Sembunyikan toolbar" title="Sembunyikan toolbar"
                className="hidden h-11 w-11 place-items-center rounded-xl border border-[#D9DBE7] bg-white text-[#141B34] hover:bg-[#F3F4F9] sm:grid"><ChevronDown className="h-5 w-5 rotate-180" aria-hidden="true" /></button>}
            </div>
            {worker && <KapasitasSaya />}

            {/* Kartu putih: jenis project + saringan cepat */}
            {bisaSaring && !worker && pref.panel !== false && (
              <div className="rounded-[20px] bg-white p-3.5 dark:bg-white/5" data-panel-chip>
                <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible" role="tablist" aria-label="Jenis project" data-chip-project>
                  {tabs.map((t) => {
                    const on = tab === t.value && !cepat
                    return (
                      <button key={t.value} type="button" role="tab" aria-selected={on} onClick={() => { setTab(t.value); setCepat('') }} data-chip={t.value} className={chip(on)}>
                        {t.label.replace('Terjemahan Non Tersumpah', 'Non Tersumpah').replace('Terjemahan Tersumpah', 'Tersumpah').replace('Pengajuan Vendor', 'Vendor').replace('Apostille/Legalisasi', 'Apostille')}{n(t.count, on)}
                      </button>
                    )
                  })}
                  <span className="ml-2.5" aria-hidden="true" />
                  <button type="button" onClick={() => setDlFilter(dlFilter?.kind === 'today' ? null : { kind: 'today', from: dayKey(), to: dayKey() })} aria-pressed={dlFilter?.kind === 'today'} data-chip="hari-ini" className={chip(dlFilter?.kind === 'today')}>Hari ini{n(nHariIni, dlFilter?.kind === 'today')}</button>
                  <button type="button" onClick={() => { setCepat(cepat === 'hambatan' ? '' : 'hambatan'); setTab('all') }} aria-pressed={cepat === 'hambatan'} data-chip="hambatan"
                    className={chip(cepat === 'hambatan', cepat === 'hambatan' ? null : 'border-[#FFEDE3] bg-[#FFEDE3] text-[#B43D0E] hover:border-[#F2C4AE]')}>Hambatan{n(nHambatan, cepat === 'hambatan')}</button>
                  {['direktur', 'supervisor', 'superadmin'].includes(user.role) && (() => { const nPilih = scoped.filter((p) => !isDone(p) && (p.sub_projects || []).some((x) => x.stage === 'pilih_penerjemah')).length; return (
                    <button type="button" onClick={() => { setTab('all'); setCepat(cepat === 'pilih' ? '' : 'pilih') }} aria-pressed={cepat === 'pilih'} data-chip="pilih" className={chip(cepat === 'pilih')}>Pilih penerjemah{n(nPilih, cepat === 'pilih')}</button>) })()}
                  {!can.seeAllBranches(user) && (
                    <button type="button" onClick={() => { setCepat(cepat === 'saya' ? '' : 'saya'); setTab('all') }} aria-pressed={cepat === 'saya'} data-chip="saya" className={chip(cepat === 'saya')}>Saya{n(nSaya, cepat === 'saya')}</button>
                  )}
                </div>
              </div>
            )}
          </>
        )
      })()}

      {worker && (
        <>
          <WorkerBoard projects={scoped} />
          <button type="button" onClick={() => setFullView((v) => !v)} className="text-xs font-semibold text-brand hover:underline">
            {fullView ? 'Sembunyikan tampilan lengkap' : 'Lihat semua project saya (tampilan lengkap)'}
          </button>
        </>
      )}

      {worker && !fullView ? null : (
        <>
          {(tab === 'koordinator' || tab === 'mandarin') && <InfoKoordinator tab={tab} list={list} />}
          <FilterChips chips={[
            tab !== 'all' && { label: `Jenis: ${tabs.find((t) => t.value === tab)?.label || tab}`, clear: () => setTab('all') },
            cepat && { label: cepat === 'hambatan' ? 'Hanya hambatan' : cepat === 'pilih' ? 'Perlu pilih penerjemah' : 'Hanya project saya', clear: () => setCepat('') },
            sort !== 'deadline' && { label: 'Urut: terbaru', clear: () => setSort('deadline') },
            q.trim() && { label: `Cari: "${q.trim()}"`, clear: () => setQ('') },
            status !== 'aktif' && { label: `Status: ${status === 'selesai' ? 'Selesai' : 'Semua'}`, clear: () => setStatus('aktif') },
            dlFilter && { label: `Deadline: ${dlFilterLabel(dlFilter)}`, clear: () => setDlFilter(null) },
            prFilter && { label: `Prioritas: ${prFilter}`, clear: () => setPrFilter('') },
            branchFilter !== 'Semua' && { label: `Cabang: ${branchFilter}`, clear: () => setBranchFilter('Semua') },
            bpFilter.print && { label: `Print: ${bpFilter.print}`, clear: () => setBpFilter((f) => ({ ...f, print: '' })) },
          ].filter(Boolean)} reset={() => { setTab('all'); setCepat(''); setQ(''); setStatus('aktif'); setSort('deadline'); setDlFilter(null); setPrFilter(''); setBpFilter({ branch: '', print: '' }) }} />

          <ZoomArea zoom={zoom} full={full} onClose={() => setFull(false)} count={list.length} kelas={kelasPref(pref)}
            tools={full ? <TampilanMenu compact pref={pref} setPref={setPref} zoom={zoom} setZoom={setZoom} density={density} setDensity={setDensity} setFull={setFull} view={view}
              current={{ name: namaView, tab, q, status, sort, cepat, dlFilter, prFilter, bpFilter, cols: colsAktif, view }} apply={terapkanView} /> : null}>
          {list.length === 0 && !(view === 'list' && (dlFilter || bpFilter.branch || bpFilter.print || q || tab !== 'all')) ? (
            <Card><Empty icon={FolderOpen} title={worker ? 'Belum ada project untuk Anda' : 'Belum ada project'} text={worker ? 'Project akan muncul di sini begitu ada yang ditugaskan kepada Anda.' : 'Buat project baru dari invoice Zoho.'} action={worker ? null : <Button onClick={() => go('projects/new')}><Plus className="h-4 w-4" />Project Baru</Button>} /></Card>
          ) : view === 'list' ? <ProjectList status={status} setStatus={setStatus} statusOpsi={[['aktif', `Aktif ${scoped.filter((p) => !isDone(p)).length}`], ['selesai', 'Selesai'], ['semua', 'Semua']].map(([key, label]) => ({ key, label }))} pref={{ ...pref, grup: pref.grup && sort === 'deadline' }} list={rest.slice(0, shownN)} nLate={late.length} dlFilter={dlFilter} setDlFilter={setDlFilter} prFilter={prFilter} setPrFilter={setPrFilter} cols={colsAktif} detailFor={detailFor} setDetailFor={setDetailFor} filesFor={filesFor} setFilesFor={setFilesFor} onLangkah={bukaLangkah} bpFilter={bpFilter} setBpFilter={setBpFilter} options={{ branches: [...new Set(scoped.map((p) => p.branch))].sort(), prints: [...new Set(scoped.map((p) => p.about?.print_location || p.branch))].sort() }} /> : (
            <ProjectSpreadsheet pref={pref} list={list} detailFor={detailFor} state={tableState} setState={setTableState} hideCols={worker ? SEMBUNYI_TABEL : []}
              onDetail={(p) => { setFilesFor(null); setDetailFor(p) }}
              onFiles={(p) => setFilesFor(p)}
              onPrint={(p) => { setFilesFor(p) }}
              renderAksi={(p) => { const ctx = { users: data.users, people: data.people, user, worker }; const langkah = langkahBerikutnya(p, user, ctx); return (
                <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  {!worker && <TombolLangkah p={p} langkah={langkah} onBuka={bukaLangkah} />}
                  <a href={`#/projects/${p.id}`} aria-label={`Detail ${invoiceLabel(p.invoice_no)}`} title="Buka halaman detail project" data-aksi="detail" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-ink-mute ring-1 ring-slate-200 hover:text-brand"><Eye className="h-4 w-4" /></a>
                  <button type="button" onClick={() => setFilesFor(p)} aria-label={`File ${invoiceLabel(p.invoice_no)}`} title="Folder file project" data-aksi="file" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-ink-mute ring-1 ring-slate-200 hover:text-brand"><FolderOpen className="h-4 w-4" /></button>
                </span>) }} />
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
      {tugasFor && <TugaskanPenerjemah p={tugasFor.p} sub={tugasFor.sub} onClose={() => setTugasFor(null)} onLainnya={() => { const t = tugasFor; setTugasFor(null); setLangkahFor({ p: t.p, subId: t.sub.id }) }} />}
      {langkahFor && <LayarKerja projectId={langkahFor.p.id} subId={langkahFor.subId} daftar={list} onClose={() => setLangkahFor(null)} />}
      {detailFor && (
        <Sheet open side wide onClose={() => setDetailFor(null)} title={invoiceLabel(detailFor.invoice_no)} subtitle={`${detailFor.customer?.name || ''} · ${detailFor.branch}`}
          footer={<><Button variant="outline" className="flex-1 sm:flex-none sm:px-6" onClick={() => setDetailFor(null)}>Tutup</Button><span className="flex-1" />
            <a href={`#/projects/${detailFor.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline" title="Buka sebagai halaman penuh">Halaman penuh →</a></>}>
          <ProjectDetail id={detailFor.id} embedded />
        </Sheet>
      )}
      {/* Tombol apung + dihapus (K7): Project baru lewat tab Buat (HP) / tombol + (desktop) / Faktur */}
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
function ZoomArea({ zoom, full, onClose, tools, count, kelas, children }) {
  const body = <div className={kelas} style={zoom === 100 ? undefined : { zoom: zoom / 100 }}>{children}</div>
  if (!full) return <div className="space-y-3">{body}</div>
  // Layar penuh data: hanya daftar + pil mengambang (jumlah · Tampilan · tutup)
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[var(--page)]" data-layar-penuh>
      <div className="pointer-events-none absolute right-3 top-2 z-[61] flex items-center gap-1.5">
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-ink/90 py-1 pl-3.5 pr-1 text-xs font-bold text-white shadow-lg backdrop-blur">
          <span className="whitespace-nowrap">Layar penuh · {count} project</span>
          {tools}
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-white text-ink" aria-label="Keluar layar penuh (Esc)"><X className="h-4 w-4" /></button>
        </div>
      </div>
      {/* di layar penuh kepala tabel menempel di atas wadah ini, bukan di bawah header aplikasi */}
      <div className="min-h-0 flex-1 space-y-3 overflow-auto p-2 pt-12 sm:p-3 sm:pt-12" style={{ '--list-top': '0px' }}>{body}</div>
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

/** Tombol langkah berikutnya — label & tujuan dari lib/langkah.js. */
function TombolLangkah({ p, langkah, hp, onBuka, canvas }) {
  const nada = { kerja: 'bg-ink text-white ring-ink hover:bg-brand hover:ring-brand', ping: 'bg-amber-50 text-amber-800 ring-amber-200 hover:bg-amber-100', acc: 'bg-violet-50 text-violet-700 ring-violet-200 hover:bg-violet-100', transfer: 'bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100', buka: 'bg-white text-ink-soft ring-slate-200 hover:text-brand hover:ring-brand' }
  const tuju = () => {
    if (langkah.jenis === 'acc' || langkah.jenis === 'transfer') return go('keuangan')
    if (onBuka) return onBuka(p, langkah.sub?.id, true) // slide dari samping — tanpa pindah halaman
    go(`projects/${p.id}${langkah.sub ? `/${langkah.sub.id}` : ''}`)
  }
  return (
    <button type="button" onClick={tuju} data-aksi="langkah" data-jenis={langkah.jenis} title={`${langkah.tahap}${langkah.berikut ? ` → ${langkah.berikut}` : ''}`}
      className={canvas ? 'h-7 min-w-0 truncate whitespace-nowrap rounded-lg bg-[#DFF1FB] px-2 text-xs font-bold text-[#0B5C8A] transition hover:bg-[#cbe7f7]'
        : cx('shrink-0 whitespace-nowrap rounded-lg px-2.5 text-xs font-bold ring-1 transition', hp ? 'h-11' : 'h-8', nada[langkah.jenis] || nada.buka)}>
      {langkah.label}
    </button>
  )
}

/** Menu ⋯ per baris: detail panel, folder file, rincian. */
function AksiLainnya({ p, hp, open, toggle, detailAktif, onDetail, onFiles, fileCount, canvas }) {
  // Ikon langsung terlihat (tanpa menu titik tiga) supaya cukup 1 klik.
  const btn = (aktif) => canvas
    ? cx('grid h-7 w-7 shrink-0 place-items-center rounded-lg transition', aktif ? 'bg-[#141B34] text-white' : 'text-[#141B34] hover:bg-[#F3F4F9]')
    : cx('grid shrink-0 place-items-center rounded-lg ring-1 transition', hp ? 'h-11 w-11' : 'h-8 w-8',
      aktif ? 'bg-brand-soft text-brand ring-brand/30' : 'bg-white text-ink-mute ring-slate-200 hover:text-brand')
  return (
    <span className="flex shrink-0 items-center gap-1" data-aksi="ikon-baris">
      <button type="button" onClick={onDetail} aria-label={`Detail ${invoiceLabel(p.invoice_no)}`} title="Lihat detail project (panel samping)" className={btn(detailAktif)} data-aksi="detail"><Eye className="h-4 w-4" /></button>
      <button type="button" onClick={onFiles} aria-label={`File ${invoiceLabel(p.invoice_no)}`} title={`Folder file project${fileCount ? ` (${fileCount})` : ''}`} className={cx(btn(false), 'relative')} data-aksi="file"><FolderOpen className="h-4 w-4" />{fileCount > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-brand px-1 text-[9px] font-bold leading-[14px] text-white">{fileCount}</span>}</button>
      <button type="button" onClick={toggle} aria-expanded={open} aria-label={`Rincian ${invoiceLabel(p.invoice_no)}`} title="Buka/tutup rincian sub project" className={btn(open)} data-aksi="rincian"><ChevronDown className={cx('h-4 w-4 transition', open && 'rotate-180')} /></button>
    </span>
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
function KolomPopover({ worker, colsAktif, saveCols }) {
  const SEMBUNYI = worker ? ['cabang', 'tahap'] : []
  const semua = ALL_COLS.filter((k) => !SEMBUNYI.includes(k))
  const berubah = semua.some((k) => !colsAktif.includes(k))
  return (
    <Popover label="Kolom tabel" width="min-w-[230px]" button={({ open, toggle }) => (
      <button type="button" onClick={toggle} aria-expanded={open} aria-label="Pilih kolom" title="Pilih kolom yang ditampilkan" data-alat-kolom
        className={cx('relative grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white ring-1 ring-slate-200 hover:text-brand', open ? 'text-brand ring-brand' : 'text-ink-mute')}>
        <Columns3 className="h-4 w-4" />
        {berubah && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-brand" />}
      </button>
    )}>
      {() => (
        <div>
          <p className="mb-1 px-1 text-[11px] font-bold uppercase tracking-wide text-ink-mute">Kolom tabel</p>
          <div className="max-h-[220px] space-y-0.5 overflow-y-auto">
            {COLUMNS.filter((c) => !SEMBUNYI.includes(c.key)).map((c) => (
              <label key={c.key} className="flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1 text-sm hover:bg-slate-50">
                <input type="checkbox" checked={colsAktif.includes(c.key)} disabled={c.key === 'invoice'}
                  onChange={(e) => saveCols(e.target.checked ? ALL_COLS.filter((k) => k === c.key || colsAktif.includes(k)) : colsAktif.filter((k) => k !== c.key))}
                  className="h-4 w-4 rounded border-slate-300 text-brand disabled:opacity-40" />
                {c.label}{c.key === 'invoice' && <span className="text-[11px] text-ink-mute">(wajib)</span>}
              </label>
            ))}
          </div>
          <button type="button" onClick={() => saveCols(semua)} className="mt-1 w-full rounded-lg px-1 py-1 text-left text-xs font-semibold text-brand hover:underline">Tampilkan semua kolom</button>
        </div>
      )}
    </Popover>
  )
}

function TersimpanPopover({ current, apply }) {
  return (
    <Popover label="Tampilan tersimpan" width="min-w-[260px]" button={({ open, toggle }) => (
      <button type="button" onClick={toggle} aria-expanded={open} aria-label="Tampilan tersimpan" title="Simpan / buka tampilan (filter & kolom) tersimpan" data-alat-tersimpan
        className={cx('grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white ring-1 ring-slate-200 hover:text-brand', open ? 'text-brand ring-brand' : 'text-ink-mute')}>
        <Bookmark className="h-4 w-4" />
      </button>
    )}>
      {({ close }) => <SavedViewsPanel current={current} apply={apply} close={close} />}
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
  const { data, user } = useApp()
  const ctx = { users: data.users, people: data.people, user, worker: isWorkRole(user) }
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
                  {c.cell(p, { prog: progressOf(p), ctx, langkah: langkahBerikutnya(p, user, ctx) })}
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

/** Baris kedua kolom Invoice: prioritas · layanan · cabang · print (print beda = tebal). */
function InfoBaris2({ p, ctx }) {
  const prio = p.about?.priority || 'Normal'
  const print = p.about?.print_location || p.branch
  const beda = print !== p.branch
  const n = p.sub_projects?.length || 0
  return (
    <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-ink-mute" data-info2>
      {prio !== 'Normal' && <PriorityBadge p={prio} />}
      <ProjectTypes project={p} />
      {n > 1 && <span data-sub-teks>{n} sub</span>}
      {!ctx?.worker && (
        <span className="flex items-center gap-1 truncate" title={beda ? `Cabang ${p.branch}, dicetak di ${print} (beda)` : `Cabang ${p.branch}, dicetak di ${print}`} data-print={beda ? 'beda' : 'sama'}>
          {p.branch}<span aria-hidden="true">·</span><Printer className="h-3 w-3 shrink-0" /><span className={cx(beda && 'font-bold text-pop')}>{print}</span>
        </span>
      )}
    </span>
  )
}

/** Stepper tahap: kotak per tahap alur; kotak bercincin = tahap sekarang; merah = macet/terlambat. */
export function Stepper({ p, prog, kecil }) {
  const t = posisiTahap(p)
  const n = Math.min(8, Math.max(2, t.total))
  const idx = t.selesai ? n : Math.min(n - 1, Math.round((t.idx / Math.max(1, t.total)) * n))
  return (
    <span className={cx('flex items-center gap-1', kecil ? 'h-3' : 'h-4')} role="img" aria-label={`Tahap ${idx + 1} dari ${n}, ${prog}%`} data-stepper>
      <span className="flex flex-1 items-center gap-[3px]">
        {Array.from({ length: n }, (_, i) => (
          <span key={i} className={cx('block flex-1 rounded-[3px]', kecil ? 'h-[5px]' : 'h-1.5',
            i < idx || t.selesai ? 'bg-brand' : i === idx ? (t.macet ? 'bg-rose-500 ring-2 ring-rose-200' : 'bg-brand ring-2 ring-brand/30') : 'bg-slate-200')} />
        ))}
      </span>
      {!kecil && <span className="w-9 shrink-0 text-right text-[11px] font-semibold tabular-nums text-ink-mute">{prog}%</span>}
    </span>
  )
}
/** Baris pelaksana: siapa yang memegang tahap sekarang + berapa lama tidak bergerak. */
export function Pelaksana({ p, langkah, className }) {
  const t = posisiTahap(p)
  if (t.selesai) return null
  const diam = t.hariDiam >= 3 ? `${t.hariDiam} hari tidak bergerak` : ''
  const pic = langkah?.pic || ''
  if (!pic && !diam) return null
  return <span className={cx('block truncate text-[11px] text-ink-mute', className)} data-pelaksana>{pic && <>menunggu <b className="font-semibold text-ink-soft">{pic}</b></>}{pic && diam ? ' · ' : ''}{diam && <span className="font-semibold text-rose-600">{diam}</span>}</span>
}
const digitsWa = (t) => { let d = String(t || '').replace(/\D/g, ''); if (d.startsWith('0')) d = `62${d.slice(1)}`; return d }
function WaIkon({ p }) {
  const telp = p.customer?.phone || p.customer?.ship?.phone
  if (!telp) return null
  return <a href={`https://wa.me/${digitsWa(telp)}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} title={`WhatsApp ${telp}`} aria-label="WhatsApp pelanggan" data-aksi="wa"
    className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-emerald-100 text-[9px] font-bold text-emerald-700 hover:bg-emerald-200">✆</a>
}

export const COLUMNS = [
  // Tata letak CANVAS ATLAS (12 Nov 2026): kartu per baris, maks 2 baris per sel (utama + pendukung).
  { key: 'invoice', label: 'Invoice', w: 'minmax(152px,136fr)', cls: 'flex min-w-0 flex-col gap-[3px]',
    cell: (p) => <>
      <a href={`#/projects/${p.id}`} onClick={(e) => e.stopPropagation()} data-inv={dibuatBaru(p) ? 'baru' : 'lama'}
        className={cx('max-w-full self-start truncate rounded-md text-base font-bold leading-[26px] tabular-nums text-[#141B34] hover:underline', dibuatBaru(p) && '-ml-1.5 bg-[#E2F5E8] px-1.5')}>{invoiceLabel(p.invoice_no)}</a>
      <WaktuDibuat p={p} />
    </> },
  { key: 'pelanggan', label: 'Pelanggan', w: 'minmax(0,142fr)', cls: 'flex min-w-0 flex-col gap-[3px]',
    cell: (p) => <>
      <span className="flex min-w-0 items-center gap-1.5"><span className="min-w-0 truncate text-[15px] font-bold leading-[26px]" title={p.customer?.name}>{p.customer?.name}</span><NoteIcon note={p.about?.notes} /><DemoBadge project={p} /></span>
      <span className="truncate text-xs text-[#5E6380]">{(p.about?.cs_name || '').replace(/\s*\(.*\)\s*$/, '') ? `CS ${(p.about.cs_name).replace(/\s*\(.*\)\s*$/, '')}` : '—'}</span>
    </> },
  { key: 'prioritas', label: 'Prioritas', w: 'minmax(0,118fr)', cls: 'min-w-0',
    cell: (p) => <><PrioPill p={p.about?.priority || 'Normal'} /><span className="mt-[3px] block whitespace-nowrap text-xs text-[#5E6380]" data-sub-teks>{p.sub_projects?.length || 0} sub</span></> },
  { key: 'deadline', label: 'Deadline', w: 'minmax(0,98fr)', cls: 'min-w-0',
    cell: (p) => <DeadlinePill p={p} /> },
  { key: 'cabang', label: 'Cabang · Print', w: 'minmax(0,88fr)', cls: 'min-w-0',
    cell: (p) => <CabangPrint p={p} /> },
  { key: 'eksekutor', label: 'Eksekutor', w: 'minmax(0,112fr)', cls: 'flex min-w-0 flex-col gap-[3px]',
    cell: (p, { ctx }) => { const e = eksekutorOf(p, ctx); return <>
      <span className="truncate text-sm font-semibold leading-[26px]" title={e.lay}>{e.lay}</span>
      <span className="truncate text-xs text-[#5E6380]" title={e.eks}>{e.eks}</span>
    </> } },
  { key: 'tahap', label: 'Tahap', w: 'minmax(0,138fr)', cls: 'flex min-w-0 flex-col gap-[3px]',
    cell: (p, { prog, langkah }) => <>
      <span className="truncate text-sm font-bold leading-[26px]" title={langkah ? `${langkah.tahap}${langkah.berikut ? ` → ${langkah.berikut}` : ''}` : ''}>{langkah ? langkah.tahap : currentStage(p)}{langkah?.berikut && langkah.tahap !== 'Selesai' && <span className="text-xs font-medium text-[#5E6380]"> ▸ {langkah.berikut}</span>}</span>
      <span className="flex min-w-0 items-center gap-2"><span className="w-24 shrink-0"><Stepper p={p} prog={prog} kecil /></span><span className="min-w-0 truncate text-xs text-[#5E6380]">{langkah?.pic || ''}</span></span>
    </> },
]
export const ALL_COLS = COLUMNS.map((c) => c.key)

const dlFilterLabel = (f) => !f ? '' : f.kind === 'today' ? 'Hari ini' : f.kind === 'tomorrow' ? 'Besok' : `${tgl(f.from)} – ${tgl(f.to)}`

function ProjectList({ status = 'aktif', setStatus = () => {}, statusOpsi = [], list: listAll, nLate = 0, dlFilter, setDlFilter, prFilter = '', setPrFilter = () => {}, cols, bpFilter = { branch: '', print: '' }, setBpFilter = () => {}, options = { branches: [], prints: [] }, detailFor, setDetailFor, filesFor, setFilesFor, onLangkah, pref = {} }) {
  const [lipat, setLipat] = useState(() => new Set())
  const { data, user } = useApp()
  const projectOf = (id) => data.projects.find((x) => x.id === id) // versi terbaru (setelah upload/hapus di pop-up)
  const [open, setOpen] = useState(() => new Set())
  const toggle = (id) => setOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const [fokus, setFokus] = useState({}) // sub yang panel kerjanya dibuka saat baris dibuka dari tombol aksi
  const bukaKerja = (p, subId) => { setFokus((f) => ({ ...f, [p.id]: subId })); setOpen((s) => new Set(s).add(p.id)) }
  const bp = 'both'
  const [bpOpen, setBpOpen] = useState(false)
  const bpActive = !!(bpFilter.branch || bpFilter.print)
  const bpLabel = [bpFilter.branch && `Cabang ${bpFilter.branch}`, bpFilter.print && `Print ${bpFilter.print}`].filter(Boolean).join(' · ')
  const [dlOpen, setDlOpen] = useState(false)

  const [prOpen, setPrOpen] = useState(false)
  const PRIOS = ['Sameday', 'Super Ekspres', 'Ekspres', 'Normal']
  const prCount = (k) => listAll.filter((p) => (p.about?.priority || 'Normal') === k).length
  const list = listAll; const late = [] // urutan terlambat sudah diatur di induk (paling akhir), tidak lagi dipajang terpisah
  const show = (k) => !cols || cols.includes(k) // kolom yang ditampilkan (Pengaturan kolom)
  const gridCols = [...COLUMNS.filter((c) => show(c.key)).map((c) => c.w), 'minmax(206px,230fr)'].join(' ')
  const [stOpen, setStOpen] = useState(false)
  const fileCount = (p) => collectFiles(p).length
  const today = dayKey()
  const [range, setRange] = useState({ from: today, to: addDays(today, 7) })
  const pick = (f) => { setDlFilter(f); setDlOpen(false) }
  const ctx = useMemo(() => ({ users: data.users, people: data.people, user, worker: isWorkRole(user) }), [data.users, data.people, user])
  const renderRow = (p, i) => {
    const prog = progressOf(p)
    const langkah = langkahBerikutnya(p, user, ctx)
    return (
            <li key={p.id} data-grup={grupOf(p)} data-kartu-baris className={cx('scroll-mt-28 overflow-hidden rounded-2xl border bg-white transition max-xl:mx-0.5 max-xl:my-2 xl:mb-3', open.has(p.id) || detailFor?.id === p.id || filesFor?.id === p.id ? 'border-[var(--brand)] ring-1 ring-[var(--brand)]' : 'border-[#DADDE8] hover:border-[#B9BDD0]')}>
              <div className="relative">
              {/* Klik baris = buka/tutup rincian sub project; ikon mata = halaman detail */}
              <div role="button" tabIndex={0} aria-expanded={open.has(p.id)} onClick={() => toggle(p.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(p.id) } }}
                className="u-row group block cursor-pointer px-4 xl:py-[18px]">
                {/* Desktop: baris tabel */}
                <div style={{ gridTemplateColumns: gridCols }} className="hidden items-start gap-3 text-left xl:grid">
                  {COLUMNS.filter((c) => show(c.key)).map((c) => <span key={c.key} className={c.cls}>{c.cell(p, { prog, ctx, langkah, pref })}</span>)}
                  {/* Tombol baru muncul saat baris disentuh/diarahkan kursor — 3 tombol × 20 baris
                      yang selalu terlihat membuat tabel penuh kotak tanpa guna. Di layar sentuh
                      (tanpa hover) tombolnya tetap terlihat, begitu juga saat baris sedang dibuka. */}
                  {/* Aksi: SATU tombol langkah berikutnya (selalu terlihat) + menu ⋯ (K9) */}
                  <span className="flex min-w-0 items-center justify-end gap-1" data-aksi-baris onClick={(e) => e.stopPropagation()}>
                    {!open.has(p.id) && langkah.jenis === 'kerja' && langkah.sub
                      ? <AksiBaris kecil project={p} sub={langkah.sub} onPanel={() => bukaKerja(p, langkah.sub.id)} onTugas={() => onLangkah(p, langkah.sub.id, true)} />
                      : !open.has(p.id) && <TombolLangkah p={p} langkah={langkah} onBuka={onLangkah} canvas />}
                    <AksiLainnya canvas p={p} open={open.has(p.id)} toggle={() => toggle(p.id)} detailAktif={detailFor?.id === p.id}
                      onDetail={() => { setDetailFor(p); setFilesFor(null) }} onFiles={() => setFilesFor(p)} fileCount={fileCount(p)} />
                  </span>
                </div>
                {/* HP: kartu 4 baris — (1) invoice · prioritas · tenggat, (2) pelanggan, (3) arah bahasa · dok · hlm · cabang, (4) tahap ▸ berikutnya + progres, lalu tombol */}
                <div className="flex flex-col gap-2.5 py-3.5 xl:hidden" data-kartu-hp>
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={cx('min-w-0 truncate text-[15px] font-bold tabular-nums', dibuatBaru(p) && '-ml-1.5 rounded-md bg-[#E2F5E8] px-1.5')}>{invoiceLabel(p.invoice_no)}</span>
                    <PrioPill p={p.about?.priority || 'Normal'} />
                    <span className="flex-1" />
                    {(() => { const d = infoDeadline(p); return d ? <span className="inline-flex min-h-6 shrink-0 items-center whitespace-nowrap rounded-full px-2.5 text-xs font-bold" style={{ background: d.bg, color: d.fg }}>{d.sisa === 'Hari ini' ? 'Hari Ini' : d.sisa === 'Besok' ? 'Besok' : d.tgl.replace(/ \d\d\.\d\d$/, '')}</span> : null })()}
                  </div>
                  <span className="flex min-w-0 items-center gap-1.5 text-[15px] font-semibold"><span className="min-w-0 truncate">{p.customer?.name}</span><NoteIcon note={p.about?.notes} /></span>
                  <span className="min-w-0 truncate text-[13px] text-[#5E6380]">{[!ctx.worker && p.branch, !ctx.worker && `Print ${p.about?.print_location || p.branch}`, (p.sub_projects || [])[0] ? (() => { const sb = p.sub_projects[0]; const t = sb.type || 'jasa_lain'; const v = sb.translator_kind === 'vendor' || sb.executor_kind === 'vendor' || !!sb.data?.vendor; return t === 'terjemahan' ? (v ? 'VEN-TR' : 'TIM-TR') : t === 'terjemahan_nt' ? 'Non Tersumpah' : ['apostille', 'legalisasi'].includes(t) ? (v ? 'VEN-AL' : 'TIM-AL') : 'Jasa Lain' })() : null, eksekutorOf(p, ctx).lay].filter(Boolean).join(' · ')}</span>
                  <div className="flex min-w-0 items-center gap-2 border-t border-[#EEF0F5] pt-2" onClick={(e) => e.stopPropagation()}>
                    <span className="min-w-0 truncate text-sm font-bold">{langkah.tahap}</span>
                    <span className="w-16 shrink-0"><Stepper p={p} prog={prog} kecil /></span>
                    <span className="flex-1" />
                    {!ctx.worker && !open.has(p.id) && langkah.jenis !== 'buka' && <span className="shrink-0">{langkah.jenis === 'kerja' && langkah.sub
                      ? <AksiBaris kecil project={p} sub={langkah.sub} onPanel={() => bukaKerja(p, langkah.sub.id)} onTugas={() => onLangkah(p, langkah.sub.id, true)} />
                      : <TombolLangkah p={p} langkah={langkah} onBuka={onLangkah} canvas />}</span>}
                    <button type="button" onClick={() => { setFilesFor(null); setDetailFor(p) }} aria-label={`Detail ${invoiceLabel(p.invoice_no)}`} data-aksi="detail" className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] text-[#141B34] hover:bg-[#F3F4F9]"><Eye className="h-4 w-4" /></button>
                    <button type="button" onClick={() => setFilesFor(p)} aria-label={`File ${invoiceLabel(p.invoice_no)}`} className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] text-[#141B34] hover:bg-[#F3F4F9]"><FolderOpen className="h-4 w-4" /></button>
                  </div>
                </div>
              </div>
              <WorkerActions project={p} />
              </div>
              {open.has(p.id) && <ProjectExpand key={fokus[p.id] || 'x'} p={p} onLangkah={onLangkah} awal={fokus[p.id]} />}
            </li>
          )
  }
  return (
    <div className="overflow-visible" data-daftar-canvas>
      <div className="sticky top-[var(--list-top,var(--appbar))] z-10 hidden bg-[var(--page,#F3F4F9)] pb-0.5 pt-1.5 xl:block" data-kepala-daftar>
        <div style={{ gridTemplateColumns: gridCols }} className="grid items-center gap-3 rounded-xl bg-[#E6E8F2] px-4 py-1 text-xs font-bold tracking-[0.02em] text-[#3F4563] dark:bg-white/10 dark:text-slate-200">
          {COLUMNS.filter((c) => show(c.key)).map((c) => {
            if (c.key === 'deadline') return (
              <span key={c.key} className="flex min-h-8 items-center gap-1">Deadline
                <button type="button" onClick={() => setDlOpen(true)} aria-label={`Filter deadline${dlFilter ? `: ${dlFilterLabel(dlFilter)}` : ''}`} title="Filter deadline"
                  className={cx('grid h-6 w-6 place-items-center rounded-md', dlFilter ? 'bg-[#4169E1] text-white' : 'text-[#5E6380] hover:bg-white/60')}><ChevronDown className="h-3.5 w-3.5" /></button></span>
            )
            if (c.key === 'prioritas') return (
              <span key={c.key} className="flex min-h-8 items-center gap-1">Prioritas
                <button type="button" onClick={() => setPrOpen(true)} aria-label={`Filter prioritas${prFilter ? `: ${prFilter}` : ''}`} title="Filter prioritas"
                  className={cx('grid h-6 w-6 place-items-center rounded-md', prFilter ? 'bg-[#4169E1] text-white' : 'text-[#5E6380] hover:bg-white/60')}><ChevronDown className="h-3.5 w-3.5" /></button></span>
            )
            if (c.key === 'cabang') return (
              <span key={c.key} className="flex min-h-8 min-w-0 items-center gap-1"><span className="truncate">Cabang · Print</span>
                <button type="button" onClick={() => setBpOpen(true)} aria-label="Filter cabang & print" title="Filter cabang & print"
                  className={cx('grid h-6 w-6 shrink-0 place-items-center rounded-md', bpActive ? 'bg-[#4169E1] text-white' : 'text-[#5E6380] hover:bg-white/60')}><ChevronDown className="h-3.5 w-3.5" /></button></span>
            )
            return <span key={c.key} className="flex min-h-8 min-w-0 items-center truncate">{c.label}</span>
          })}
          <span className="relative flex min-h-8 items-center justify-end gap-2">Kerjakan
            {statusOpsi.length > 0 && <button type="button" onClick={() => setStOpen((v) => !v)} aria-haspopup="menu" aria-expanded={stOpen} aria-label="Status project" data-status-menu
              className="inline-flex min-h-[26px] items-center gap-1 whitespace-nowrap rounded-lg bg-[#141B34] px-2 text-xs font-bold text-white">{(statusOpsi.find((o) => o.key === status) || statusOpsi[0]).label}<ChevronDown className="h-3 w-3" /></button>}
            {stOpen && <button type="button" aria-label="Tutup menu status" tabIndex={-1} onClick={() => setStOpen(false)} onKeyDown={(e) => e.key === 'Escape' && setStOpen(false)} className="fixed inset-0 z-20 cursor-default" />}
            {stOpen && (
              <div role="menu" onKeyDown={(e) => e.key === 'Escape' && setStOpen(false)} className="absolute right-0 top-[calc(100%+4px)] z-30 flex min-w-[160px] flex-col gap-0.5 rounded-xl border border-[#DADDE8] bg-white p-1.5 shadow-[0_10px_28px_rgba(20,27,52,.18)]">
                {statusOpsi.map((o) => <button key={o.key} type="button" role="menuitemradio" aria-checked={status === o.key} onClick={() => { setStatus(o.key); setStOpen(false) }}
                  className={cx('min-h-[34px] whitespace-nowrap rounded-lg px-2.5 text-left text-[13px] text-[#141B34]', status === o.key ? 'bg-[#EEF0F5] font-bold' : 'font-medium hover:bg-[#F6F7FB]')}>{o.label}</button>)}
              </div>
            )}
          </span>
        </div>
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
      {pref.grup ? kelompokkan([...late, ...list]).map((g) => (
        <div key={g.key} data-grup-tenggat={g.key}>
          <button type="button" onClick={() => setLipat((v) => { const n = new Set(v); n.has(g.key) ? n.delete(g.key) : n.add(g.key); return n })} aria-expanded={!lipat.has(g.key)}
            className={cx('sticky top-[var(--list-top,var(--appbar))] z-[9] flex w-full items-center gap-2 border-y px-4 py-1.5 text-left text-[11.5px] font-extrabold xl:top-[calc(var(--list-top,var(--appbar))+34px)]', kelasGrup(g.key))}>
            {g.label}<span className="font-semibold opacity-70">· {g.rows.length} project</span>
            <span className="ml-auto text-[10.5px] font-semibold opacity-70">{lipat.has(g.key) ? 'buka ⌄' : 'lipat ⌃'}</span>
          </button>
          {!lipat.has(g.key) && <ul className="max-xl:pb-1 xl:pt-2">{g.rows.map(renderRow)}</ul>}
        </div>
      )) : (<>
      {late.length > 0 && <ul className="border-b-2 border-rose-200 bg-rose-50/60 xl:divide-y xl:divide-rose-100">{late.map(renderRow)}</ul>}
      <ul className="max-xl:pb-1 xl:pt-2">
        {list.map(renderRow)}
      </ul>
      </>)}
      {(late.length + list.length) > 0 && (() => { const semua = [...late, ...list]; const hlm = semua.reduce((a, p) => a + (p.sub_projects || []).reduce((b, x) => b + (x.docs?.length ? x.docs.reduce((c, d) => c + (Number(d.pages) || 0), 0) : (Number(x.pages) || 0)), 0), 0); return (
        <p className="flex flex-wrap items-center gap-x-3 border-t border-slate-100 px-4 py-2 text-[11px] text-ink-mute" data-ringkas-daftar>
          <span><b className="text-ink">{semua.length}</b> project</span>
          {nLate > 0 && <span><b className="text-rose-600">{nLate}</b> terlambat</span>}
          <span><b className="text-orange-600">{semua.filter((p) => grupOf(p) === 'hariini').length}</b> hari ini</span>
          <span><b className="text-ink">{hlm}</b> hlm berjalan</span>
        </p>) })()}
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
    </div>
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
                <div className="flex flex-wrap items-center gap-2"><InvoiceNo project={r.project} /><TypeBadge type={r.type} /><PengajuanStatus stage={r.stage} revision={!!r.data?.revision_note} /></div>
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
  return <span className="mt-0.5 block min-h-4 truncate text-[11px] leading-4 text-ink-mute">CS {cs}</span>
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

/** Kotak "Perlu Anda hari ini" untuk Direktur: pilih penerjemah · ACC pengajuan · hambatan. */
function PerluAnda({ scoped, nHambatan, onPilih, onHambatan, aktif }) {
  const { data } = useApp()
  const nPilih = scoped.filter((p) => !isDone(p) && (p.sub_projects || []).some((x) => x.stage === 'pilih_penerjemah')).length
  const nAcc = (data.requests || []).filter((r) => r.status === 'menunggu').length
    + scoped.reduce((a, p) => a + (p.sub_projects || []).filter((x) => x.stage === 'persetujuan').length, 0)
  if (!nPilih && !nAcc && !nHambatan) return null
  const chip = (n, l, on, go_, tone) => (
    <button type="button" onClick={go_} aria-pressed={on} className={cx('inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-[11.5px] font-bold ring-1 transition', on ? 'bg-ink text-white ring-ink' : tone)}>
      {l}<span className={cx('tabular-nums', on ? 'text-white/70' : 'opacity-70')}>{n}</span>
    </button>
  )
  return (
    <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-2.5 py-1.5 ring-1 ring-amber-200" data-perlu-anda>
      <p className="shrink-0 text-[11.5px] font-extrabold text-amber-900">Perlu Anda<span className="hidden sm:inline"> hari ini</span></p>
      <div className="-mx-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-1 py-0.5 [scrollbar-width:none]">
        {nPilih > 0 && chip(nPilih, 'Pilih penerjemah', aktif === 'pilih', onPilih, 'bg-white text-ink ring-amber-300 hover:ring-brand')}
        {nAcc > 0 && chip(nAcc, 'ACC pengajuan', false, () => go('keuangan'), 'bg-white text-ink ring-amber-300 hover:ring-brand')}
        {nHambatan > 0 && chip(nHambatan, 'Hambatan', aktif === 'hambatan', onHambatan, 'bg-rose-50 text-rose-700 ring-rose-200 hover:ring-rose-400')}
      </div>
      <span className="hidden shrink-0 text-[11px] text-amber-700 lg:inline">klik chip → daftar tersaring</span>
    </div>
  )
}

/** Ringkasan sub project satu baris: arah bahasa · n dok · n hlm (untuk kartu HP). */
function RingkasSub({ p }) {
  const subs = p.sub_projects || []
  const s0 = subs.find((x) => x.lang_from) || subs[0]
  const dok = subs.reduce((a, x) => a + (x.docs?.length || x.file_count || 0), 0)
  const hlm = subs.reduce((a, x) => a + (x.docs?.length ? x.docs.reduce((b, d) => b + (Number(d.pages) || 0), 0) : (Number(x.pages) || 0)), 0)
  const arah = s0?.lang_from ? <>{s0.lang_from} → <span className="font-semibold text-ink-soft">{s0.lang_to}</span></> : (SUB_TYPES[s0?.type]?.label || 'Jasa lain')
  return <>{arah}{subs.length > 1 && <span className="text-ink-mute"> +{subs.length - 1}</span>}{dok ? ` · ${dok} dok` : ''}{hlm ? ` · ${hlm} hlm` : ''}</>
}

function ProjectExpand({ p: p0, onLangkah, awal }) {
  const { nameOf, user, data } = useApp()
  const p = data.projects.find((x) => x.id === p0.id) || p0 // versi terbaru setelah aksi
  const subs = p.sub_projects || []
  // Klik isi baris = panel kerja langsung di bawahnya (tanpa pindah layar). 1 sub → langsung terbuka.
  const [aktif, setAktif] = useState(() => awal || (subs.length === 1 && subs[0].stage !== DONE ? subs[0].id : ''))
  const w = warnaKategori(subs[0])
  return (
    <div className="pb-1.5 pt-1" style={{ background: w.bg }} data-isi-baris>
      {subs.length === 0 && <p className="px-4 py-3 text-xs text-[#5E6380]">Belum ada sub project.</p>}
      {subs.map((sb, i) => {
        const who = sb.translator_kind === 'vendor' ? nameOf(sb.translator || sb.data?.vendor) : nameOf(sb.data?.translator || sb.translator)
        const dok = sb.docs?.length || sb.file_count || 0
        const hlm = sb.docs?.length ? sb.docs.reduce((a, d) => a + (Number(d.pages) || 0), 0) : (Number(sb.pages) || 0)
        const arah = sb.lang_from && sb.lang_to ? `${sb.lang_from} → ${sb.lang_to}` : '—'
        const flow = flowOf(sb, p); const st = stagesOf(flow); const idx = st.findIndex((x) => x.key === sb.stage)
        const selesai = sb.stage === DONE
        const tahap = selesai ? 'Selesai' : stageLabel(flow, sb.stage)
        const berikut = selesai ? '' : (st[idx + 1]?.label || 'Selesai')
        const stNow = st[idx]
        const bisa = stNow && !selesai && can.processStage(user, stNow, sb, p)
        return (
          <div key={sb.id || i} className="border-t border-[rgba(20,27,52,0.08)]">
          <div role="button" tabIndex={0} aria-expanded={aktif === sb.id} onClick={() => setAktif((a) => (a === sb.id ? '' : sb.id))} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAktif((a) => (a === sb.id ? '' : sb.id)) } }}
            title="Klik untuk mengerjakan di sini" className={cx('grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-2.5 hover:bg-white/40 lg:grid-cols-[minmax(120px,2fr)_48px_48px_minmax(100px,1fr)_minmax(70px,0.8fr)_minmax(130px,1.5fr)_auto]', aktif === sb.id && 'bg-white/50')} data-sub-baris>
            <span className="col-span-2 min-w-0 truncate text-[13px] font-bold lg:col-span-1" title={sb.title}>{sb.title || '—'}<span className="block truncate text-[12.5px] font-normal text-[#5E6380] lg:hidden">{[`${dok} Dok`, `${hlm} Hal`, arah !== '—' && arah, who].filter(Boolean).join(' · ')}</span></span>
            <span className="hidden whitespace-nowrap text-sm tabular-nums lg:block">{dok} Dok</span>
            <span className="hidden whitespace-nowrap text-sm tabular-nums lg:block">{hlm} Hal</span>
            <span className="hidden truncate whitespace-nowrap text-sm lg:block">{arah}</span>
            <span className="hidden min-w-0 truncate text-sm font-semibold lg:block" title={who}>{who || '—'}</span>
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="min-w-0 truncate text-sm font-bold">{tahap}{berikut && <span className="text-xs font-medium" style={{ color: w.fg }}> ▸ {berikut}</span>}</span>
              <span className="flex w-24 shrink-0 gap-[3px]" role="img" aria-label={selesai ? 'Semua tahap selesai' : `Tahap ${idx + 1} dari ${st.length}`}>
                {st.map((x, k) => <span key={x.key} className="h-1.5 max-w-[26px] flex-1 rounded-[3px]" style={{ background: selesai || k < idx ? '#141B34' : k === idx ? '#4169E1' : 'rgba(20,27,52,0.14)' }} />)}
              </span>
            </span>
            <span className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
              <CentangApostille p={p} sb={sb} label="" bulat onPanel={() => setAktif(sb.id)} />
              <StatusVendor sb={sb} />
              {aktif !== sb.id && <AksiBaris project={p} sub={sb} onPanel={() => setAktif(sb.id)} onTugas={() => onLangkah?.(p, sb.id, true)} />}
              <button type="button" onClick={() => onLangkah?.(p, sb.id)} aria-label={`Buka layar kerja: ${sb.title || ''}`} title="Buka layar kerja" data-aksi="layar-kerja"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-[#141B34] hover:bg-[#F6F7FB]"><Columns3 className="h-[19px] w-[19px]" aria-hidden="true" /></button>
            </span>
          </div>
          {aktif === sb.id && (
            <div className="mx-3 mb-3 overflow-hidden rounded-2xl border border-[#DADDE8] bg-white dark:bg-white/5" onClick={(e) => e.stopPropagation()} data-kerja-di-baris>
              <SubProject key={sb.id} n={i + 1} project={p} sub={sb} ringkas />
            </div>
          )}
          </div>
        )
      })}
      {p.about?.notes && <p className="flex items-start gap-2 whitespace-pre-line border-t border-[rgba(20,27,52,0.08)] px-4 py-2 text-[13px]"><StickyNote className="mt-0.5 h-4 w-4 shrink-0" style={{ color: w.fg }} aria-hidden="true" /><span><strong>Catatan:</strong> {p.about.notes}</span></p>}
    </div>
  )
}

/** Ringkas status vendor di baris sub project: nominal pengajuan + kapan dibayar. */
export function StatusVendor({ sb }) {
  const total = totalPengajuan(sb.data || {})
  const vendor = sb.translator_kind === 'vendor' || sb.data?.vendor || ['persetujuan', 'pembayaran', ...VENDOR_PAID_STAGES].includes(sb.stage)
  if (!vendor || (!['pengajuan', 'persetujuan', 'pembayaran', ...VENDOR_PAID_STAGES].includes(sb.stage) && !sb.data?.paid_date)) return null
  return (
    <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[10.5px] font-semibold" data-status-vendor>
      {['pengajuan', 'persetujuan', 'pembayaran', ...VENDOR_PAID_STAGES].includes(sb.stage) && <PengajuanStatus stage={sb.stage} revision={!!sb.data?.revision_note} />}
      {sb.data?.paid_date && <span className="text-emerald-700">· dibayar {tgl(sb.data.paid_date)}</span>}
    </span>
  )
}

/** Info di atas daftar: vendor yang dikoordinasi (tab Koordinator) / rekap order Mandarin (Akunting). Tanpa biaya vendor. */
function InfoKoordinator({ tab, list }) {
  const { user, data } = useApp()
  const vendorNama = (id) => (data.people || []).find((x) => x.id === id)?.name || '—'
  const subs = list.flatMap((p) => (p.sub_projects || []).map((x) => ({ ...x, p })))
    .filter((x) => (tab === 'koordinator' ? diKoordinasi(user, x) : foreignLang(x) === 'Mandarin'))
  const per = new Map()
  for (const x of subs) {
    const k = x.data?.vendor ? vendorNama(x.data.vendor) : x.translator_kind === 'vendor' ? 'Vendor' : 'Belum ada vendor'
    const g = per.get(k) || { n: 0, dok: 0, hal: 0, jalan: 0 }
    g.n += 1; g.dok += x.docs?.length || x.file_count || 1; g.hal += x.docs?.length ? x.docs.reduce((a, d) => a + (Number(d.pages) || 0), 0) : Number(x.pages) || 0
    if (x.stage !== DONE) g.jalan += 1
    per.set(k, g)
  }
  return (
    <Card className="p-3" data-info-koordinator>
      <p className="text-[12px] font-bold text-ink">{tab === 'koordinator'
        ? <>Anda koordinator untuk: {vendorKoordinator(user).map((id) => { const v = (data.people || []).find((x) => x.id === id); return v ? `${v.name}${v.languages?.length ? ` (${v.languages.join(', ')})` : ''}` : '' }).filter(Boolean).join(' · ')}</>
        : <>Rekap order bahasa Mandarin — tidak ada koordinator, tiap orang order sendiri</>}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {[...per.entries()].map(([k, g]) => (
          <span key={k} className="rounded-xl bg-slate-50 px-3 py-1.5 text-[12px] ring-1 ring-slate-200"><b>{k}</b> · {g.n} order · {g.dok} dok · {g.hal} hlm{g.jalan ? <span className="text-amber-700"> · {g.jalan} berjalan</span> : null}</span>
        ))}
        {!per.size && <span className="text-[12px] text-ink-mute">Belum ada order pada saringan ini.</span>}
      </div>
    </Card>
  )
}
