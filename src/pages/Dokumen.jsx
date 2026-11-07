import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FolderOpen, Folder, FileText, X, ChevronRight, Download, Eye, Upload, HardDrive,
  User2, Clock, MoreHorizontal, Pencil, Trash2, FileArchive, PanelLeft, Loader2,
  CornerUpLeft, Search,
} from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { Button, Card, Empty, Sheet, Input, cx } from '../components/ui.jsx'
import { useTabel, Th, CariTabel } from '../components/TabelSortir.jsx'
import { collect, patchEverywhere, uploadProjectFiles } from '../components/FileManager.jsx'
import FilePreview from '../components/FilePreview.jsx'
import PohonFolder from '../components/PohonFolder.jsx'
import { scopeByBranch, invoiceLabel } from '../config/access.js'
import { tanggalJam } from '../lib/waktu.js'
import { drive } from '../lib/integrations.js'
import { saveBlob, dataUrlToBlob } from '../lib/download.js'
import { kindOf } from '../lib/printing.js'
import { go } from '../lib/router.js'
import {
  kb, ekstensi, tanpaEkstensi, bolehUbah, bolehKosongkanTrash, labelProject, kemasZip, cocokCari, amanNama,
} from '../lib/dokumen.js'

// ============================================================
//  DOKUMEN — penelusur berkas seperti Drive.
//  Cabang → Project (No. Invoice) → berkas.
//
//  Satu sumber data dengan File Project di My Project: tidak ada
//  salinan terpisah. Unggah, ganti nama, dan hapus di sini langsung
//  terlihat di project, dan sebaliknya.
//
//  Hak akses dicek di tiga tempat: pohon folder & daftar (hanya
//  project yang boleh dilihat orang ini), tindakan berkas (hanya
//  yang boleh mengubah project), dan isi ZIP (hanya berkas yang
//  memang terlihat di layar).
// ============================================================

const WARNA = {
  pdf: 'bg-rose-50 text-rose-600 ring-rose-200',
  image: 'bg-violet-50 text-violet-600 ring-violet-200',
  docx: 'bg-sky-50 text-sky-600 ring-sky-200',
  sheet: 'bg-emerald-50 text-emerald-600 ring-emerald-200',
  text: 'bg-slate-100 text-slate-600 ring-slate-200',
  other: 'bg-slate-100 text-slate-500 ring-slate-200',
}

const KOLOM = [
  { key: 'nama', label: 'Berkas', sort: (f) => String(f.name || '').toLowerCase() },
  { key: 'lokasi', label: 'Lokasi', sort: (f) => `${f.cabang} ${f.folder}`.toLowerCase() },
  { key: 'oleh', label: 'Diunggah oleh', sort: (f) => String(f.by || '').toLowerCase() },
  { key: 'waktu', label: 'Waktu', sort: (f) => String(f.uploaded_at || '') },
  { key: 'ukuran', label: 'Ukuran', num: true, sort: (f) => Number(f.size) || 0 },
]

/** Menu "⋯" per baris — juga muncul saat baris diklik kanan. */
function MenuBerkas({ f, buka, onTutup, bisaUbah, onRename, onTrash, onPreview, onUnduh, onBuka }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!buka) return
    const tutup = (e) => { if (!ref.current?.contains(e.target)) onTutup() }
    document.addEventListener('pointerdown', tutup)
    const esc = (e) => e.key === 'Escape' && onTutup()
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', tutup); document.removeEventListener('keydown', esc) }
  }, [buka, onTutup])
  if (!buka) return null
  const Item = ({ icon: I, children, onClick, bahaya }) => (
    <button type="button" role="menuitem" onClick={() => { onTutup(); onClick() }}
      className={cx('flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition',
        bahaya ? 'text-rose-600 hover:bg-rose-50' : 'text-ink hover:bg-slate-50')}>
      <I className="h-4 w-4 shrink-0 text-ink-mute" />{children}
    </button>
  )
  return (
    <span ref={ref} role="menu" aria-label={`Tindakan untuk ${f.name}`}
      className="absolute right-0 z-30 mt-1 w-48 overflow-hidden rounded-xl bg-white p-1 shadow-xl ring-1 ring-slate-200">
      <Item icon={Eye} onClick={onPreview}>Pratinjau</Item>
      <Item icon={Download} onClick={onUnduh}>Unduh</Item>
      {bisaUbah && <Item icon={Pencil} onClick={onRename}>Ganti nama</Item>}
      <Item icon={FolderOpen} onClick={onBuka}>Buka project</Item>
      {bisaUbah && <Item icon={Trash2} bahaya onClick={onTrash}>Hapus ke Trash</Item>}
    </span>
  )
}

export default function Dokumen() {
  const { user, data, branchFilter, notify, save, ask } = useApp()

  // Folder yang sedang dibuka: akar | cabang | project | trash
  const [aktif, setAktif] = useState({ jenis: 'akar', cabang: '', projectId: '' })
  const [buka, setBuka] = useState(() => new Set())   // cabang pohon yang terbuka
  const [cari, setCari] = useState('')
  const [cakupan, setCakupan] = useState('semua')      // 'semua' | 'folder'
  const [pilih, setPilih] = useState(() => new Set())  // kunci berkas terpilih
  const [preview, setPreview] = useState(null)
  const [menu, setMenu] = useState('')                 // kunci berkas yang menu-nya terbuka
  const [rename, setRename] = useState(null)           // { f, nama }
  const [sibuk, setSibuk] = useState('')               // teks progres
  const [pohonHp, setPohonHp] = useState(false)        // pohon folder di HP
  const unggahRef = useRef(null)

  // Project yang boleh dilihat orang ini — aturannya sama persis dengan My Project.
  const projects = useMemo(
    () => scopeByBranch(user, data.projects, branchFilter),
    [data.projects, user, branchFilter],
  )
  const projectOf = useCallback((id) => projects.find((p) => p.id === id) || null, [projects])

  /** Semua berkas yang boleh dilihat, dilengkapi asal folder & projectnya. */
  const lengkapi = useCallback((p, f) => ({
    ...f,
    project: p,
    cabang: p.branch || '—',
    folder: labelProject(p),
    invoice: p.invoice_no || '',
    pelanggan: p.customer?.name || '',
  }), [])
  const berkas = useMemo(
    () => projects.flatMap((p) => collect(p).map((f) => lengkapi(p, f))),
    [projects, lengkapi],
  )
  const diTrash = useMemo(
    () => projects.flatMap((p) => collect(p, { termasukTrash: true }).filter((f) => f.trashed_at).map((f) => lengkapi(p, f))),
    [projects, lengkapi],
  )

  // ---------- pohon folder ----------
  const cabangList = useMemo(() => {
    const m = new Map()
    for (const f of berkas) {
      if (!m.has(f.cabang)) m.set(f.cabang, { nama: f.cabang, n: 0, size: 0, project: new Set() })
      const g = m.get(f.cabang); g.n += 1; g.size += Number(f.size) || 0; g.project.add(f.project.id)
    }
    return [...m.values()].sort((a, b) => a.nama.localeCompare(b.nama, 'id'))
  }, [berkas])

  // Isi cabang & project dihitung hanya saat cabangnya dibuka (lazy).
  const isiCabang = useCallback((nama) => {
    const m = new Map()
    for (const f of berkas) {
      if (f.cabang !== nama) continue
      if (!m.has(f.project.id)) m.set(f.project.id, { p: f.project, n: 0, size: 0, terakhir: '' })
      const g = m.get(f.project.id); g.n += 1; g.size += Number(f.size) || 0
      if ((f.uploaded_at || '') > g.terakhir) g.terakhir = f.uploaded_at || ''
    }
    return [...m.values()].sort((a, b) => String(b.terakhir).localeCompare(String(a.terakhir)))
  }, [berkas])
  const isiProject = useCallback((id) => berkas.filter((f) => f.project.id === id), [berkas])

  const toggleBuka = (k) => setBuka((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })

  // ---------- isi area utama ----------
  const mencari = !!cari.trim()
  const dalamFolder = useMemo(() => {
    if (aktif.jenis === 'trash') return diTrash
    if (aktif.jenis === 'project') return berkas.filter((f) => f.project.id === aktif.projectId)
    if (aktif.jenis === 'cabang') return berkas.filter((f) => f.cabang === aktif.cabang)
    return berkas
  }, [berkas, diTrash, aktif])

  const hasilCari = useMemo(() => {
    if (!mencari) return []
    // Di dalam Trash, pencarian selalu terbatas pada isi Trash — kalau tidak,
    // hasilnya campur dengan berkas aktif dan membingungkan.
    const sumber = aktif.jenis === 'trash' ? diTrash : (cakupan === 'folder' ? dalamFolder : berkas)
    return sumber.filter((f) => cocokCari(f, cari)).slice(0, 500)
  }, [mencari, cakupan, dalamFolder, berkas, diTrash, cari, aktif.jenis])

  // Daftar berkas yang ditampilkan di tabel.
  const daftar = mencari ? hasilCari
    : aktif.jenis === 'project' || aktif.jenis === 'trash' ? dalamFolder : []
  const { rows: baris, sortKey, sortDir, klikJudul } = useTabel(daftar, KOLOM)

  // Pilihan ikut hilang kalau berkasnya tidak lagi tampil.
  useEffect(() => {
    setPilih((s) => {
      const ada = new Set(baris.map((f) => f.key))
      const n = new Set([...s].filter((k) => ada.has(k)))
      return n.size === s.size ? s : n
    })
  }, [baris])

  const terpilih = baris.filter((f) => pilih.has(f.key))
  const semuaTerpilih = baris.length > 0 && terpilih.length === baris.length
  const togglePilih = (k) => setPilih((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })
  const togglePilihSemua = () => setPilih(semuaTerpilih ? new Set() : new Set(baris.map((f) => f.key)))

  const projectAktif = aktif.jenis === 'project' ? projectOf(aktif.projectId) : null
  const bisaUbah = bolehUbah(user, projectAktif)

  // ---------- tindakan berkas ----------
  const ambilBlob = async (f) => (f.url?.startsWith('data:') ? dataUrlToBlob(f.url) : drive.blob(f))

  const unduh = async (f) => {
    try { setSibuk(`Menyiapkan ${f.name}…`); await saveBlob(f.name, await ambilBlob(f)); notify(`${f.name} diunduh`) }
    catch (e) { notify(e.message || 'Gagal mengunduh', 'err') } finally { setSibuk('') }
  }

  const unduhZip = async (list, namaZip) => {
    if (!list.length) return
    try {
      const JSZip = (await import('jszip')).default
      const { blob, masuk, gagal } = await kemasZip(list, {
        JSZip, ambilBlob,
        onMaju: (i, n) => setSibuk(`Mengemas ${i}/${n} berkas…`),
      })
      if (!blob) throw new Error('Tidak ada berkas yang bisa dikemas')
      setSibuk('Membuat ZIP…')
      await saveBlob(`${amanNama(namaZip)}.zip`, blob)
      notify(gagal.length
        ? `${masuk} berkas dikemas · ${gagal.length} dilewati karena tidak bisa dibaca: ${gagal.slice(0, 3).join(', ')}${gagal.length > 3 ? '…' : ''}`
        : `${masuk} berkas dikemas jadi ZIP`, gagal.length ? 'err' : undefined)
    } catch (e) { notify(e.message || 'Gagal membuat ZIP', 'err') } finally { setSibuk('') }
  }

  /** Simpan perubahan ke project — satu sumber data dengan My Project. */
  const ubahProject = async (p, fn) => {
    const next = { ...p, files: [...(p.files || [])], sub_projects: (p.sub_projects || []).map((s) => ({ ...s, data: { ...s.data } })) }
    fn(next)
    await save('projects', next)
  }

  const simpanRename = async () => {
    const f = rename?.f
    const dasar = (rename?.nama || '').trim()
    if (!f || !dasar) return setRename(null)
    const nama = `${amanNama(dasar)}${ekstensi(f.name)}`
    if (nama === f.name) return setRename(null)
    try {
      setSibuk('Mengganti nama…')
      // Nama diganti di SEMUA tempat berkas ini dipakai, jadi hubungannya
      // dengan project, tahap, dan versinya tidak putus.
      await ubahProject(f.project, (n) => patchEverywhere(n, f, { name: nama }))
      notify(`Nama berkas jadi "${nama}"`)
      setRename(null)
    } catch (e) { notify(e.message || 'Gagal mengganti nama', 'err') } finally { setSibuk('') }
  }

  const keTrash = async (list) => {
    if (!list.length) return
    const teks = list.length === 1
      ? `Pindahkan "${list[0].name}" ke Trash?`
      : `Pindahkan ${list.length} berkas terpilih ke Trash?`
    if (!(await ask(`${teks}\n\nBerkas tidak langsung hilang — masih bisa dikembalikan dari folder Trash.`))) return
    try {
      setSibuk('Memindahkan ke Trash…')
      const stempel = { trashed_at: new Date().toISOString(), trashed_by: user.name }
      for (const p of new Set(list.map((f) => f.project))) {
        await ubahProject(p, (n) => list.filter((f) => f.project.id === p.id).forEach((f) => patchEverywhere(n, f, stempel)))
      }
      setPilih(new Set())
      notify(`${list.length} berkas dipindahkan ke Trash`)
    } catch (e) { notify(e.message || 'Gagal memindahkan', 'err') } finally { setSibuk('') }
  }

  const kembalikan = async (list) => {
    if (!list.length) return
    try {
      setSibuk('Mengembalikan…')
      for (const p of new Set(list.map((f) => f.project))) {
        await ubahProject(p, (n) => list.filter((f) => f.project.id === p.id)
          .forEach((f) => patchEverywhere(n, f, { trashed_at: null, trashed_by: null })))
      }
      setPilih(new Set())
      notify(`${list.length} berkas dikembalikan ke foldernya`)
    } catch (e) { notify(e.message || 'Gagal mengembalikan', 'err') } finally { setSibuk('') }
  }

  const hapusPermanen = async (list) => {
    if (!list.length) return
    if (!(await ask(`Hapus permanen ${list.length} berkas?\n\nIni TIDAK bisa dibatalkan — berkasnya hilang dari penyimpanan.`))) return
    try {
      setSibuk('Menghapus permanen…')
      for (const f of list) { try { await drive.remove(f) } catch { /* berkas sudah tidak ada */ } }
      for (const p of new Set(list.map((f) => f.project))) {
        await ubahProject(p, (n) => list.filter((f) => f.project.id === p.id).forEach((f) => patchEverywhere(n, f, null)))
      }
      setPilih(new Set())
      notify(`${list.length} berkas dihapus permanen`)
    } catch (e) { notify(e.message || 'Gagal menghapus', 'err') } finally { setSibuk('') }
  }

  const unggah = async (fileList) => {
    const dipilih = [...(fileList || [])]
    if (unggahRef.current) unggahRef.current.value = ''
    if (!dipilih.length || !projectAktif) return
    try {
      const added = await uploadProjectFiles(
        dipilih.map((file) => ({ file, name: file.name, sub_id: '' })),
        { branch: projectAktif.branch, invoice: projectAktif.invoice_no, by: user.name },
        (i, n) => setSibuk(`Mengunggah ${i}/${n}…`),
      )
      await ubahProject(projectAktif, (n) => { n.files.push(...added) })
      notify(`${added.length} berkas diunggah ke ${labelProject(projectAktif)}`)
    } catch (e) { notify(e.message || 'Gagal mengunggah', 'err') } finally { setSibuk('') }
  }

  // ---------- pindah folder ----------
  const keAkar = () => { setAktif({ jenis: 'akar', cabang: '', projectId: '' }); setCari('') }
  const keCabang = (c) => { setAktif({ jenis: 'cabang', cabang: c, projectId: '' }); setPohonHp(false) }
  const keProject = (c, id) => { setAktif({ jenis: 'project', cabang: c, projectId: id }); setPohonHp(false) }
  const keTrashFolder = () => { setAktif({ jenis: 'trash', cabang: '', projectId: '' }); setPohonHp(false) }
  const keLokasi = (f) => {
    setCari('')
    setBuka((s) => new Set([...s, `c:${f.cabang}`, `p:${f.project.id}`]))
    setAktif({ jenis: 'project', cabang: f.cabang, projectId: f.project.id })
  }

  const totalSize = berkas.reduce((a, f) => a + (Number(f.size) || 0), 0)
  const judulFolder = aktif.jenis === 'trash' ? 'Trash'
    : aktif.jenis === 'project' ? labelProject(projectAktif || {})
    : aktif.jenis === 'cabang' ? aktif.cabang : 'Semua Cabang'

  const namaZipFolder = aktif.jenis === 'cabang' ? `Dokumen ${aktif.cabang}`
    : aktif.jenis === 'project' ? labelProject(projectAktif || {})
    : 'Dokumen'

  return (
    <div className="mx-auto w-full max-w-6xl space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-lg font-bold text-ink"><HardDrive className="h-5 w-5 text-brand" />Dokumen</h1>
          <p className="text-xs text-ink-soft">
            {berkas.length} berkas · {kb(totalSize)}. Folder mengikuti Cabang → Project; satu sumber dengan File Project.
          </p>
        </div>
        <Button size="sm" variant="outline" className="lg:hidden" onClick={() => setPohonHp(true)}>
          <PanelLeft className="h-3.5 w-3.5" />Folder
        </Button>
      </div>

      {sibuk && (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-sky-50 px-3 py-2 text-[13px] font-semibold text-sky-900 ring-1 ring-sky-200">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />{sibuk}
        </p>
      )}

      <div className="flex min-w-0 gap-3">
        {/* ---------- pohon folder (desktop) ---------- */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <Card className="max-h-[70vh] overflow-y-auto p-2">
            <PohonFolder
              cabangList={cabangList} isiCabang={isiCabang} isiProject={isiProject}
              buka={buka} onToggle={toggleBuka} aktif={aktif}
              onPilihAkar={keAkar} onPilihCabang={keCabang} onPilihProject={keProject}
              onPilihBerkas={(c, id, f) => { keProject(c, id); setPreview(f) }}
              trashN={diTrash.length} onPilihTrash={keTrashFolder}
            />
          </Card>
        </aside>

        {/* ---------- area utama ---------- */}
        <div className="min-w-0 flex-1 space-y-3">
          {/* jejak folder */}
          <nav aria-label="Lokasi folder" className="flex min-w-0 flex-wrap items-center gap-0.5 text-[13px]">
            <button type="button" onClick={keAkar}
              className={cx('rounded-lg px-2 py-1 font-semibold', aktif.jenis === 'akar' ? 'text-ink' : 'text-brand hover:bg-brand-soft')}>
              Semua Cabang
            </button>
            {aktif.jenis === 'trash' && (<><ChevronRight className="h-4 w-4 shrink-0 text-ink-mute" /><span className="px-2 py-1 font-semibold text-ink">Trash</span></>)}
            {aktif.cabang && (
              <>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-mute" />
                <button type="button" onClick={() => keCabang(aktif.cabang)}
                  className={cx('rounded-lg px-2 py-1 font-semibold', aktif.jenis === 'cabang' ? 'text-ink' : 'text-brand hover:bg-brand-soft')}>
                  {aktif.cabang}
                </button>
              </>
            )}
            {aktif.jenis === 'project' && (
              <>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-mute" />
                <span className="min-w-0 truncate px-2 py-1 font-semibold text-ink">{labelProject(projectAktif || {})}</span>
              </>
            )}
          </nav>

          {/* toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <CariTabel value={cari} onChange={setCari} label="Cari nama berkas atau folder…" className="basis-56" />
            {aktif.jenis === 'trash' ? (
              <span className="inline-flex h-[34px] items-center rounded-lg bg-slate-100 px-2.5 text-[13px] font-semibold text-ink-soft">Dalam Trash</span>
            ) : (
              <select value={cakupan} onChange={(e) => setCakupan(e.target.value)} aria-label="Cakupan pencarian"
                className="h-[34px] w-auto max-w-full rounded-lg border-0 bg-white pl-2.5 pr-7 text-[13px] font-semibold text-ink ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-brand">
                <option value="semua">Semua dokumen</option>
                <option value="folder">Folder ini saja</option>
              </select>
            )}

            {aktif.jenis === 'project' && bisaUbah && (
              <>
                <Button size="sm" variant="outline" onClick={() => unggahRef.current?.click()} disabled={!!sibuk}>
                  <Upload className="h-3.5 w-3.5" />Unggah
                </Button>
                <input ref={unggahRef} type="file" multiple className="hidden" aria-label="Unggah berkas ke folder ini"
                  onChange={(e) => unggah(e.target.files)} />
              </>
            )}
            {!mencari && aktif.jenis !== 'trash' && dalamFolder.length > 0 && (
              <Button size="sm" variant="outline" disabled={!!sibuk}
                onClick={() => unduhZip(dalamFolder, namaZipFolder)}>
                <FileArchive className="h-3.5 w-3.5" />Unduh folder ({dalamFolder.length})
              </Button>
            )}
            <span className="ml-auto text-[11px] text-ink-mute">
              {mencari ? `${baris.length} hasil` : `${dalamFolder.length} berkas`}
            </span>
          </div>

          {/* baris tindakan untuk berkas terpilih */}
          {terpilih.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-brand-soft px-3 py-2 ring-1 ring-brand/30">
              <span className="text-[13px] font-bold text-brand">{terpilih.length} berkas terpilih</span>
              <Button size="sm" variant="outline" disabled={!!sibuk}
                onClick={() => unduhZip(terpilih, `${namaZipFolder} - ${terpilih.length} berkas`)}>
                <FileArchive className="h-3.5 w-3.5" />Unduh ZIP
              </Button>
              {aktif.jenis === 'trash' ? (
                <>
                  <Button size="sm" variant="outline" disabled={!!sibuk} onClick={() => kembalikan(terpilih)}>
                    <CornerUpLeft className="h-3.5 w-3.5" />Kembalikan
                  </Button>
                  {bolehKosongkanTrash(user) && (
                    <Button size="sm" variant="outline" disabled={!!sibuk} onClick={() => hapusPermanen(terpilih)}
                      className="!text-rose-600 !ring-rose-200 hover:!bg-rose-50">
                      <Trash2 className="h-3.5 w-3.5" />Hapus permanen
                    </Button>
                  )}
                </>
              ) : bisaUbah && (
                <Button size="sm" variant="outline" disabled={!!sibuk} onClick={() => keTrash(terpilih)}
                  className="!text-rose-600 !ring-rose-200 hover:!bg-rose-50">
                  <Trash2 className="h-3.5 w-3.5" />Hapus ke Trash
                </Button>
              )}
              <button type="button" onClick={() => setPilih(new Set())}
                className="ml-auto rounded-lg px-2 py-1 text-[12px] font-semibold text-ink-mute hover:bg-white">Batal pilih</button>
            </div>
          )}

          {/* isi: daftar folder atau tabel berkas */}
          {!mencari && aktif.jenis === 'akar' && (
            cabangList.length === 0
              ? <Empty icon={FolderOpen} title="Belum ada dokumen" text="Berkas muncul di sini setelah diunggah pada project." />
              : (
                <Card className="divide-y divide-slate-100 overflow-hidden">
                  {cabangList.map((g) => (
                    <button key={g.nama} type="button" data-folder="cabang" onClick={() => keCabang(g.nama)}
                      className="flex min-h-[42px] w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-slate-50">
                      <Folder className="h-4 w-4 shrink-0 text-amber-500" />
                      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{g.nama}</span>
                      <span className="shrink-0 text-[11px] tabular-nums text-ink-mute">{g.project.size} project · {g.n} berkas · {kb(g.size)}</span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                    </button>
                  ))}
                </Card>
              )
          )}

          {!mencari && aktif.jenis === 'cabang' && (
            isiCabang(aktif.cabang).length === 0
              ? <Empty icon={FolderOpen} title="Folder kosong" text="Belum ada berkas di cabang ini." />
              : (
                <Card className="divide-y divide-slate-100 overflow-hidden">
                  {isiCabang(aktif.cabang).map((g) => (
                    <button key={g.p.id} type="button" data-folder="project" onClick={() => keProject(aktif.cabang, g.p.id)}
                      className="flex min-h-[42px] w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-slate-50">
                      <Folder className="h-4 w-4 shrink-0 text-sky-500" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-ink">{invoiceLabel(g.p.invoice_no)}</span>
                        <span className="block truncate text-[11px] text-ink-mute">{g.p.customer?.name}</span>
                      </span>
                      <span className="shrink-0 text-[11px] tabular-nums text-ink-mute">{g.n} berkas · {kb(g.size)}</span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                    </button>
                  ))}
                </Card>
              )
          )}

          {(mencari || aktif.jenis === 'project' || aktif.jenis === 'trash') && (
            baris.length === 0
              ? <Empty icon={FileText} title={mencari ? 'Tidak ada berkas yang cocok' : aktif.jenis === 'trash' ? 'Trash kosong' : 'Folder kosong'}
                  text={mencari ? 'Coba kata kunci lain, atau ubah cakupan pencarian.' : aktif.jenis === 'trash' ? 'Berkas yang dihapus akan muncul di sini.' : 'Project ini belum punya berkas.'} />
              : (
                <Card className="overflow-hidden">
                  <div className="min-w-0 max-w-full overflow-x-auto">
                    <table className="tbl-rapat" style={{ minWidth: '820px' }}>
                      <thead>
                        <tr>
                          <th style={{ width: '40px' }}>
                            <input type="checkbox" checked={semuaTerpilih} onChange={togglePilihSemua}
                              aria-label="Pilih semua berkas yang tampil"
                              className="h-4 w-4 rounded border-slate-300 text-brand" />
                          </th>
                          {KOLOM.map((c) => <Th key={c.key} kolom={c} sortKey={sortKey} sortDir={sortDir} onKlik={klikJudul} />)}
                          <th style={{ width: '112px' }} className="text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {baris.map((f) => {
                          const jenis = kindOf(f)
                          const dipilih = pilih.has(f.key)
                          return (
                            <tr key={f.key} className={cx(dipilih && 'bg-brand-soft/60')}
                              onContextMenu={(e) => { e.preventDefault(); setMenu(f.key) }}>
                              <td>
                                <input type="checkbox" checked={dipilih} onChange={() => togglePilih(f.key)}
                                  aria-label={`Pilih ${f.name}`} className="h-4 w-4 rounded border-slate-300 text-brand" />
                              </td>
                              <td>
                                <span className="flex items-center gap-2">
                                  <span className={cx('grid h-7 w-7 shrink-0 place-items-center rounded-lg ring-1', WARNA[jenis] || WARNA.other)}>
                                    <FileText className="h-3.5 w-3.5" />
                                  </span>
                                  <button type="button" onClick={() => setPreview(f)} title={`Pratinjau ${f.name}`}
                                    className="min-w-0 max-w-[260px] truncate text-left font-semibold text-ink hover:text-brand hover:underline">
                                    {f.name}
                                  </button>
                                </span>
                              </td>
                              <td className="text-[12px] text-ink-soft">
                                <button type="button" onClick={() => keLokasi(f)} title={`Buka folder ${f.cabang} / ${f.folder}`}
                                  className="flex max-w-[220px] items-center gap-1 text-left hover:text-brand hover:underline">
                                  <Folder className="h-3.5 w-3.5 shrink-0 text-sky-500" />
                                  <span className="min-w-0 truncate">{f.cabang} / {f.folder}</span>
                                </button>
                              </td>
                              <td className="text-[12px] text-ink-soft">
                                {f.by
                                  ? <span className="flex max-w-[150px] items-center gap-1.5"><User2 className="h-3.5 w-3.5 shrink-0 text-ink-mute" /><span className="min-w-0 truncate">{f.by}</span></span>
                                  : <span className="text-ink-mute">tidak tercatat</span>}
                              </td>
                              <td className="whitespace-nowrap text-[12px] text-ink-soft">
                                {f.uploaded_at
                                  ? <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-ink-mute" />{tanggalJam(f.uploaded_at)}</span>
                                  : <span className="text-ink-mute">—</span>}
                              </td>
                              <td className="num text-[12px] text-ink-soft">{kb(Number(f.size) || 0)}</td>
                              <td>
                                <span className="aksi relative">
                                  <button type="button" onClick={() => unduh(f)} aria-label={`Unduh ${f.name}`} title="Unduh"
                                    className="text-ink-mute hover:bg-slate-100 hover:text-brand"><Download className="h-4 w-4" /></button>
                                  <button type="button" onClick={() => setMenu(menu === f.key ? '' : f.key)}
                                    aria-haspopup="menu" aria-expanded={menu === f.key}
                                    aria-label={`Tindakan lain untuk ${f.name}`} title="Tindakan lain (atau klik kanan baris)"
                                    className="text-ink-mute hover:bg-slate-100 hover:text-ink"><MoreHorizontal className="h-4 w-4" /></button>
                                  <MenuBerkas f={f} buka={menu === f.key} onTutup={() => setMenu('')}
                                    bisaUbah={aktif.jenis === 'trash' ? false : bolehUbah(user, f.project)}
                                    onPreview={() => setPreview(f)} onUnduh={() => unduh(f)}
                                    onRename={() => setRename({ f, nama: tanpaEkstensi(f.name) })}
                                    onTrash={() => keTrash([f])}
                                    onBuka={() => go(`projects/${f.project.id}`)} />
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

          {aktif.jenis === 'trash' && !mencari && diTrash.length > 0 && (
            <p className="text-[11px] text-ink-mute">
              Berkas di Trash tidak lagi muncul di folder maupun di File Project, tapi belum terhapus dari penyimpanan.
              Pilih berkasnya untuk mengembalikan{bolehKosongkanTrash(user) ? ' atau menghapus permanen' : ''}.
            </p>
          )}

          {!mencari && aktif.jenis === 'project' && !bisaUbah && (
            <p className="text-[11px] text-ink-mute">Anda bisa melihat dan mengunduh berkas di folder ini, tapi tidak mengubahnya.</p>
          )}
        </div>
      </div>

      {/* pohon folder di HP */}
      <Sheet open={pohonHp} onClose={() => setPohonHp(false)} title="Folder"
        footer={<Button variant="outline" className="flex-1" onClick={() => setPohonHp(false)}>Tutup</Button>}>
        <PohonFolder
          cabangList={cabangList} isiCabang={isiCabang} isiProject={isiProject}
          buka={buka} onToggle={toggleBuka} aktif={aktif}
          onPilihAkar={() => { keAkar(); setPohonHp(false) }} onPilihCabang={keCabang} onPilihProject={keProject}
          onPilihBerkas={(c, id, f) => { keProject(c, id); setPreview(f) }}
          trashN={diTrash.length} onPilihTrash={keTrashFolder}
        />
      </Sheet>

      {/* ganti nama */}
      <Sheet open={!!rename} onClose={() => setRename(null)} title="Ganti nama berkas"
        footer={<><Button variant="outline" className="flex-1" onClick={() => setRename(null)}>Batal</Button>
          <Button className="flex-1" onClick={simpanRename} disabled={!rename?.nama?.trim()}>Simpan</Button></>}>
        {rename && (
          <div className="space-y-3">
            <p className="text-[13px] text-ink-soft">Nama lama: <b className="text-ink">{rename.f.name}</b></p>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-ink-soft">Nama baru</span>
              <span className="flex items-center gap-2">
                <Input value={rename.nama} autoFocus aria-label="Nama berkas baru"
                  onChange={(e) => setRename((r) => ({ ...r, nama: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') simpanRename() }} />
                <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-2 text-[13px] font-semibold text-ink-soft">{ekstensi(rename.f.name) || '—'}</span>
              </span>
            </label>
            <p className="text-[11px] text-ink-mute">
              Ekstensi file dipertahankan supaya jenisnya tidak berubah. Nama diganti di semua tempat berkas ini dipakai,
              jadi hubungannya dengan project, tahap, dan versinya tidak putus.
            </p>
          </div>
        )}
      </Sheet>

      {preview && <FilePreview file={preview} onClose={() => setPreview(null)} />}

      <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-mute">
        <Search className="h-3.5 w-3.5" />
        Pencarian, pohon folder, dan isi ZIP semuanya mengikuti hak akses Anda — folder cabang lain tidak ikut tampil.
      </p>
    </div>
  )
}
