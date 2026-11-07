import { useMemo, useState } from 'react'
import {
  FolderOpen, Folder, FileText, Search, X, ChevronRight, Download, Eye,
  Upload, HardDrive, User2, Clock,
} from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { Card, Input, Empty, cx } from '../components/ui.jsx'
import { useTabel, Th } from '../components/TabelSortir.jsx'
import { collect } from '../components/FileManager.jsx'
import FilePreview from '../components/FilePreview.jsx'
import { scopeByBranch, invoiceLabel } from '../config/access.js'
import { tanggalJam } from '../lib/waktu.js'
import { drive } from '../lib/integrations.js'
import { saveBlob, dataUrlToBlob } from '../lib/download.js'
import { kindOf } from '../lib/printing.js'
import { go } from '../lib/router.js'

// ============================================================
//  DOKUMEN — penelusur berkas seperti Drive.
//  Cabang → Project (No. Invoice) → berkas.
//  Tidak ada penyimpanan baru: semuanya dibaca dari file yang
//  sudah menempel pada project, jadi angkanya selalu nyata.
// ============================================================

const kb = (n) => (!n ? '—' : n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`)

const WARNA = {
  pdf: 'bg-rose-50 text-rose-600 ring-rose-200',
  image: 'bg-violet-50 text-violet-600 ring-violet-200',
  docx: 'bg-sky-50 text-sky-600 ring-sky-200',
  sheet: 'bg-emerald-50 text-emerald-600 ring-emerald-200',
  text: 'bg-slate-100 text-slate-600 ring-slate-200',
  other: 'bg-slate-100 text-slate-500 ring-slate-200',
}

/** Kolom tabel berkas — judulnya bisa diklik untuk mengurutkan. */
const KOLOM_BERKAS = [
  { key: 'nama', label: 'Berkas', sort: (f) => String(f.name || '').toLowerCase() },
  { key: 'oleh', label: 'Diunggah oleh', sort: (f) => String(f.by || '').toLowerCase() },
  { key: 'waktu', label: 'Waktu', sort: (f) => String(f.at || '') },
  { key: 'ukuran', label: 'Ukuran', num: true, sort: (f) => Number(f.size) || 0 },
  { key: 'aksi', label: 'Aksi', num: true },
]

export default function Dokumen() {
  const { user, data, branchFilter, notify } = useApp()
  const [q, setQ] = useState('')
  const [cabang, setCabang] = useState('')   // folder tingkat 1
  const [projectId, setProjectId] = useState('') // folder tingkat 2
  const [preview, setPreview] = useState(null)

  // Project yang boleh dilihat orang ini — aturan cabangnya sama dengan My Project.
  const projects = useMemo(
    () => scopeByBranch(user, data.projects, branchFilter),
    [data.projects, user, branchFilter],
  )

  /** Semua berkas, sudah dilengkapi asal project & cabangnya. */
  const berkas = useMemo(() => projects.flatMap((p) => collect(p).map((f) => ({
    ...f,
    project: p,
    cabang: p.branch || '—',
    invoice: p.invoice_no || '',
    pelanggan: p.customer?.name || '',
  }))), [projects])

  const cocok = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return berkas
    return berkas.filter((f) => [f.name, f.invoice, f.pelanggan, f.by, f.source]
      .filter(Boolean).some((v) => String(v).toLowerCase().includes(s)))
  }, [berkas, q])

  // Saat mencari, hasilnya ditampilkan rata — tidak perlu masuk folder dulu.
  const mencari = !!q.trim()

  const folderCabang = useMemo(() => {
    const m = new Map()
    for (const f of cocok) {
      if (!m.has(f.cabang)) m.set(f.cabang, { nama: f.cabang, n: 0, size: 0, project: new Set() })
      const g = m.get(f.cabang); g.n += 1; g.size += Number(f.size) || 0; g.project.add(f.project.id)
    }
    return [...m.values()].sort((a, b) => b.n - a.n)
  }, [cocok])

  const folderProject = useMemo(() => {
    if (!cabang) return []
    const m = new Map()
    for (const f of cocok.filter((x) => x.cabang === cabang)) {
      if (!m.has(f.project.id)) m.set(f.project.id, { p: f.project, n: 0, size: 0, terakhir: '' })
      const g = m.get(f.project.id); g.n += 1; g.size += Number(f.size) || 0
      if ((f.uploaded_at || '') > g.terakhir) g.terakhir = f.uploaded_at || ''
    }
    return [...m.values()].sort((a, b) => String(b.terakhir).localeCompare(String(a.terakhir)))
  }, [cocok, cabang])

  const isiFolder = useMemo(() => {
    if (mencari) return cocok.slice(0, 300)
    if (projectId) return cocok.filter((f) => f.project.id === projectId)
    return []
  }, [cocok, projectId, mencari])

  // Sortir dari judul kolom tabel berkas.
  const { rows: barisBerkas, sortKey, sortDir, klikJudul } = useTabel(isiFolder, KOLOM_BERKAS)

  const unduh = async (f) => {
    try { await saveBlob(f.name, f.url?.startsWith('data:') ? dataUrlToBlob(f.url) : await drive.blob(f)); notify(`${f.name} diunduh`) }
    catch (e) { notify(e.message || 'Gagal mengunduh', 'err') }
  }

  const totalSize = berkas.reduce((a, f) => a + (Number(f.size) || 0), 0)

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4">
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-lg font-bold text-ink"><HardDrive className="h-5 w-5 text-brand" />Dokumen</h1>
        <p className="text-xs text-ink-soft">
          {berkas.length} berkas · {kb(totalSize)}. Dirangkum dari file yang menempel pada project — tidak ada salinan terpisah.
        </p>
      </div>

      {/* pencarian */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input className="pl-9 pr-9" placeholder="Cari nama berkas, invoice, pelanggan, atau pengunggah…"
          value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari dokumen" />
        {q && (
          <button type="button" onClick={() => setQ('')} aria-label="Hapus pencarian"
            className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-ink-mute hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* jejak folder */}
      {!mencari && (
        <nav aria-label="Lokasi folder" className="flex flex-wrap items-center gap-1 text-sm">
          <button type="button" onClick={() => { setCabang(''); setProjectId('') }}
            className={cx('rounded-lg px-2 py-1 font-semibold', cabang ? 'text-brand hover:bg-brand-soft' : 'text-ink')}>
            Semua Cabang
          </button>
          {cabang && (
            <>
              <ChevronRight className="h-4 w-4 shrink-0 text-ink-mute" />
              <button type="button" onClick={() => setProjectId('')}
                className={cx('rounded-lg px-2 py-1 font-semibold', projectId ? 'text-brand hover:bg-brand-soft' : 'text-ink')}>
                {cabang}
              </button>
            </>
          )}
          {projectId && (
            <>
              <ChevronRight className="h-4 w-4 shrink-0 text-ink-mute" />
              <span className="px-2 py-1 font-semibold text-ink">
                {invoiceLabel(folderProject.find((x) => x.p.id === projectId)?.p.invoice_no || '')}
              </span>
            </>
          )}
        </nav>
      )}

      {/* tingkat 1: cabang */}
      {!mencari && !cabang && (
        folderCabang.length === 0
          ? <Empty icon={FolderOpen} title="Belum ada dokumen" text="Berkas muncul di sini setelah diunggah pada project." />
          : (
            <Card className="divide-y divide-slate-100 overflow-hidden">
              {folderCabang.map((g) => (
                <button key={g.nama} type="button" onClick={() => setCabang(g.nama)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-slate-50">
                  <Folder className="h-4 w-4 shrink-0 text-amber-500" />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{g.nama}</span>
                  <span className="shrink-0 text-[11px] tabular-nums text-ink-mute">{g.project.size} project · {g.n} berkas · {kb(g.size)}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                </button>
              ))}
            </Card>
          )
      )}

      {/* tingkat 2: project */}
      {!mencari && cabang && !projectId && (
        folderProject.length === 0
          ? <Empty icon={FolderOpen} title="Folder kosong" text="Belum ada berkas di cabang ini." />
          : (
            <Card className="divide-y divide-slate-100 overflow-hidden">
              {folderProject.map((g) => (
                <button key={g.p.id} type="button" onClick={() => setProjectId(g.p.id)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-slate-50">
                  <Folder className="h-4 w-4 shrink-0 text-sky-500" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{invoiceLabel(g.p.invoice_no)}</span>
                    <span className="block truncate text-[11px] text-ink-mute">{g.p.customer?.name}</span>
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-ink-mute">{g.n} berkas · {kb(g.size)}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                </button>
              ))}
            </Card>
          )
      )}

      {/* daftar berkas */}
      {(mencari || projectId) && (
        barisBerkas.length === 0
          ? <Empty icon={FileText} title="Tidak ada berkas" text={mencari ? 'Coba kata kunci lain.' : 'Project ini belum punya berkas.'} />
          : (
            <Card className="overflow-hidden">
              <div className="md:overflow-x-auto">
                <table className="card-table w-full text-sm">
                  <thead>
                    <tr>
                      {KOLOM_BERKAS.map((c) => <Th key={c.key} kolom={c} sortKey={sortKey} sortDir={sortDir} onKlik={klikJudul} />)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {barisBerkas.map((f) => {
                      const jenis = kindOf(f)
                      return (
                        <tr key={f.key} className="align-top">
                          <td data-label="Berkas" className="px-3 py-2">
                            <span className="flex items-start gap-2">
                              <span className={cx('mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[10px] font-bold uppercase ring-1', WARNA[jenis] || WARNA.other)}>
                                <FileText className="h-3.5 w-3.5" />
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate font-semibold text-ink" title={f.name}>{f.name}</span>
                                <span className="block truncate text-[11px] text-ink-mute">
                                  {mencari ? `${invoiceLabel(f.invoice)} · ` : ''}{f.source}
                                </span>
                              </span>
                            </span>
                          </td>
                          <td data-label="Diunggah oleh" className="px-3 py-2 text-xs">
                            {f.by
                              ? <span className="inline-flex items-center gap-1.5 font-semibold text-ink-soft"><User2 className="h-3.5 w-3.5 text-ink-mute" />{f.by}</span>
                              : <span className="text-ink-mute">tidak tercatat</span>}
                          </td>
                          <td data-label="Waktu" className="px-3 py-2 text-xs text-ink-soft">
                            {f.uploaded_at
                              ? <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-ink-mute" />{tanggalJam(f.uploaded_at)}</span>
                              : <span className="text-ink-mute">—</span>}
                          </td>
                          <td data-label="Ukuran" className="px-3 py-2 text-right text-xs tabular-nums text-ink-soft">{kb(Number(f.size) || 0)}</td>
                          <td data-label="Aksi" className="px-3 py-2">
                            <span className="flex items-center justify-end gap-1">
                              <button type="button" onClick={() => setPreview(f)} aria-label={`Pratinjau ${f.name}`} title="Pratinjau"
                                className="grid h-11 w-11 place-items-center rounded-lg text-ink-mute hover:bg-slate-100 hover:text-brand md:h-9 md:w-9">
                                <Eye className="h-4 w-4" />
                              </button>
                              <button type="button" onClick={() => unduh(f)} aria-label={`Unduh ${f.name}`} title="Unduh"
                                className="grid h-11 w-11 place-items-center rounded-lg text-ink-mute hover:bg-slate-100 hover:text-brand md:h-9 md:w-9">
                                <Download className="h-4 w-4" />
                              </button>
                              <button type="button" onClick={() => go(`projects/${f.project.id}`)} aria-label={`Buka project ${invoiceLabel(f.invoice)}`} title="Buka project"
                                className="grid h-11 w-11 place-items-center rounded-lg text-ink-mute hover:bg-slate-100 hover:text-brand md:h-9 md:w-9">
                                <FolderOpen className="h-4 w-4" />
                              </button>
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )
      )}

      <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-mute">
        <Upload className="h-3.5 w-3.5" />
        Mengunggah berkas tetap dilakukan dari dalam project, supaya setiap berkas menempel pada tahap yang benar.
        Halaman ini untuk menelusuri, melihat, dan mengunduh.
      </p>

      {preview && <FilePreview file={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}
