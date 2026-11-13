import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { InvoiceNo } from '../components/badges.jsx'
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
  // Jumlah berkas per cabang/project hanya untuk Superadmin & Direktur —
  // angka itu memancing perbandingan antar cabang yang tidak perlu.
  const bolehLihatJumlah = ['superadmin', 'direktur'].includes(user?.base_role || user?.role)

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

  // ---------- gaya File Explorer (10 Nov 2026) ----------
  const [tampil, setTampil] = useState(() => { try { return localStorage.getItem('atlas-dok-tampil') || 'detail' } catch { return 'detail' } })
  const gantiTampil = (v) => { setTampil(v); try { localStorage.setItem('atlas-dok-tampil', v) } catch { /* abaikan */ } }
  const [subAktif, setSubAktif] = useState('') // subfolder sub project di dalam folder project
  const [riwayat, setRiwayat] = useState([])
  useEffect(() => { setSubAktif('') }, [aktif.projectId, aktif.jenis])
  const JENIS = { pdf: ['PDF', 'Dokumen PDF', 'bg-rose-600'], image: ['IMG', 'Gambar', 'bg-sky-500'], docx: ['DOC', 'Dokumen Word', 'bg-blue-600'], sheet: ['XLS', 'Lembar kerja', 'bg-emerald-600'], text: ['TXT', 'Teks', 'bg-slate-500'], other: ['FILE', 'Berkas', 'bg-slate-400'] }
  const IkonBerkas = ({ f, besar }) => { const [t, , w] = JENIS[kindOf(f)] || JENIS.other; return <span className={cx('inline-grid shrink-0 place-items-center rounded-[3px] font-extrabold text-white', w, besar ? 'h-[62px] w-[48px] text-[11px] shadow' : 'h-[18px] w-[15px] text-[6px]')}>{t}</span> }
  const IkonFolder = ({ besar }) => <span className={cx('relative inline-block shrink-0 rounded-[3px] bg-gradient-to-b from-[#ffd666] to-[#f5b942]', besar ? 'h-[52px] w-[68px]' : 'h-[14px] w-[18px]')}><span className={cx('absolute left-0 rounded-t-[3px] bg-[#f5b942]', besar ? '-top-2 h-2.5 w-7' : '-top-[3px] h-1 w-2')} /></span>
  // subfolder per sub project
  const subFolder = aktif.jenis === 'project' && projectAktif && !mencari
    ? (projectAktif.sub_projects || []).map((sp) => ({ id: sp.id, nama: sp.title || 'Sub project', n: dalamFolder.filter((f) => f.subId === sp.id).length })).filter((x) => x.n)
    : []
  const tanpaSub = aktif.jenis === 'project' ? dalamFolder.filter((f) => !f.subId || !subFolder.some((x) => x.id === f.subId)) : []
  const barisTampil = aktif.jenis === 'project' && !mencari ? (subAktif ? baris.filter((f) => f.subId === subAktif) : baris.filter((f) => tanpaSub.includes(f))) : baris
  const subNama = subFolder.find((x) => x.id === subAktif)?.nama
  // Akses cepat
  const cepat = [
    { k: 'baru', l: 'Baru diunggah', list: berkas.filter((f) => f.uploaded_at && Date.now() - new Date(f.uploaded_at) < 7 * 864e5) },
    { k: 'hariini', l: 'Deadline hari ini', list: berkas.filter((f) => { const d = f.project.about?.deadline; return d && new Date(d).toDateString() === new Date().toDateString() }) },
  ]
  const [cepatAktif, setCepatAktif] = useState('')
  const daftarCepat = cepat.find((c) => c.k === cepatAktif)?.list || []
  const pilihSatu = terpilih.length === 1 ? terpilih[0] : null
  const fokus = pilihSatu || null
  const pergi = (fn) => { setRiwayat((r) => [...r, { aktif, subAktif, cepatAktif }].slice(-20)); setCepatAktif(''); fn() }
  const mundur = () => { const r = riwayat[riwayat.length - 1]; if (!r) return; setRiwayat(riwayat.slice(0, -1)); setAktif(r.aktif); setTimeout(() => setSubAktif(r.subAktif), 0); setCepatAktif(r.cepatAktif) }
  const naik = () => pergi(() => { if (subAktif) setSubAktif(''); else if (aktif.jenis === 'project') keCabang(aktif.cabang); else keAkar() })
  const klikBaris = (f, e) => { if (e.ctrlKey || e.metaKey) togglePilih(f.key); else setPilih(new Set([f.key])) }
  const listUtama = cepatAktif ? daftarCepat : barisTampil
  const ukuranPilih = terpilih.reduce((a, f) => a + (Number(f.size) || 0), 0)
  const jumlahItem = cepatAktif ? daftarCepat.length : !mencari && aktif.jenis === 'akar' ? cabangList.length : !mencari && aktif.jenis === 'cabang' ? isiCabang(aktif.cabang).length : (subAktif ? 0 : subFolder.length) + listUtama.length

  const Alat = ({ icon: I, label, onClick, disabled, bahaya, hide }) => hide ? null : (
    <button type="button" onClick={onClick} disabled={disabled} title={label}
      className={cx('inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] transition disabled:opacity-40', bahaya ? 'text-rose-600 hover:bg-rose-50' : 'text-ink hover:bg-white')}>
      <I className="h-4 w-4" /><span className="hidden sm:inline">{label}</span>
    </button>
  )
  const BarisFolder = ({ nama, sub, onBuka, data }) => (
    <tr className="cursor-default hover:bg-[#e5f1fb]" onDoubleClick={onBuka} data-folder={data}>
      <td className="px-3 py-1.5" />
      <td className="py-1.5"><button type="button" onClick={onBuka} className="flex min-h-[28px] items-center gap-2 text-left"><IkonFolder /><span className="truncate font-medium text-ink">{nama}</span></button></td>
      <td className="hidden text-ink-mute md:table-cell">{sub || ''}</td><td className="hidden text-ink-mute md:table-cell">Folder</td><td className="hidden md:table-cell" /><td className="hidden md:table-cell" />
    </tr>
  )
  const KotakFolder = ({ nama, onBuka, data }) => (
    <button type="button" onDoubleClick={onBuka} onClick={onBuka} data-folder={data} className="flex w-[104px] flex-col items-center gap-1 rounded-md p-2 text-center text-[11.5px] hover:bg-[#e5f1fb]"><IkonFolder besar /><span className="line-clamp-2 break-all">{nama}</span></button>
  )
  const folderBaris = () => {
    if (cepatAktif || mencari) return []
    if (aktif.jenis === 'akar') return cabangList.map((g) => ({ k: g.nama, nama: g.nama, sub: bolehLihatJumlah ? `${g.project.size} project` : '', onBuka: () => pergi(() => keCabang(g.nama)), data: 'cabang' }))
    if (aktif.jenis === 'cabang') return isiCabang(aktif.cabang).map((g) => ({ k: g.p.id, nama: labelProject(g.p), sub: g.terakhir ? tanggalJam(g.terakhir) : '', onBuka: () => pergi(() => keProject(aktif.cabang, g.p.id)), data: 'project' }))
    if (aktif.jenis === 'project' && !subAktif) return subFolder.map((x, n) => ({ k: x.id, nama: `${n + 1} · ${x.nama}`, sub: `${x.n} berkas`, onBuka: () => pergi(() => setSubAktif(x.id)), data: 'sub' }))
    return []
  }
  const folders = folderBaris()

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-2 p-0 sm:p-1" data-dokumen-explorer>
      <div className="flex items-center gap-2">
        <h1 className="text-[17px] font-extrabold leading-tight tracking-tight flex items-center gap-2">Dokumen</h1>
        <span className="text-[11px] text-ink-mute">{berkas.length} berkas · {kb(totalSize)}</span>
        <Button size="sm" variant="outline" className="ml-auto lg:hidden" onClick={() => setPohonHp(true)}><PanelLeft className="h-3.5 w-3.5" />Folder</Button>
      </div>
      {sibuk && <p role="status" className="flex items-center gap-2 rounded-xl bg-sky-50 px-3 py-2 text-[13px] font-semibold text-sky-900 ring-1 ring-sky-200"><Loader2 className="h-4 w-4 shrink-0 animate-spin" />{sibuk}</p>}

      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-300">
        {/* ribbon */}
        <div className="flex items-center gap-0.5 overflow-x-auto border-b border-slate-200 bg-[#f3f5f9] px-2 py-1.5 [scrollbar-width:none]" data-ribbon>
          <Alat icon={Upload} label="Unggah" onClick={() => unggahRef.current?.click()} disabled={!!sibuk || !(aktif.jenis === 'project' && bisaUbah)} />
          <input ref={unggahRef} type="file" multiple className="hidden" aria-label="Unggah berkas ke folder ini" onChange={(e) => unggah(e.target.files)} />
          <span className="mx-1 h-5 w-px shrink-0 bg-slate-300" />
          <Alat icon={Download} label="Unduh" disabled={!terpilih.length || !!sibuk} onClick={() => (terpilih.length === 1 ? unduh(terpilih[0]) : unduhZip(terpilih, `${namaZipFolder} - ${terpilih.length} berkas`))} />
          <Alat icon={FileArchive} label="Unduh folder" disabled={!dalamFolder.length || !!sibuk || aktif.jenis === 'trash'} onClick={() => unduhZip(dalamFolder, namaZipFolder)} />
          <Alat icon={Pencil} label="Ganti nama" disabled={!pilihSatu || aktif.jenis === 'trash' || !bolehUbah(user, pilihSatu?.project)} onClick={() => setRename({ f: pilihSatu, nama: tanpaEkstensi(pilihSatu.name) })} />
          <Alat icon={FolderOpen} label="Buka project" disabled={!pilihSatu && !projectAktif} onClick={() => go(`projects/${(pilihSatu?.project || projectAktif).id}`)} />
          {aktif.jenis === 'trash' ? (<>
            <Alat icon={CornerUpLeft} label="Kembalikan" disabled={!terpilih.length} onClick={() => kembalikan(terpilih)} />
            <Alat icon={Trash2} label="Hapus permanen" bahaya hide={!bolehKosongkanTrash(user)} disabled={!terpilih.length} onClick={() => hapusPermanen(terpilih)} />
          </>) : <Alat icon={Trash2} label="Hapus" bahaya disabled={!terpilih.length || !terpilih.every((f) => bolehUbah(user, f.project))} onClick={() => keTrash(terpilih)} />}
          <span className="ml-auto flex shrink-0 items-center gap-0.5 rounded-md bg-white p-0.5 ring-1 ring-slate-200">
            {[['detail', '☰ Detail'], ['ikon', '▦ Ikon']].map(([k, l]) => <button key={k} type="button" onClick={() => gantiTampil(k)} className={cx('h-8 rounded px-2.5 text-[12px] font-semibold', tampil === k ? 'bg-[#cce4f7] text-ink' : 'text-ink-soft')}>{l}</button>)}
          </span>
        </div>
        {/* bilah alamat */}
        <div className="flex items-center gap-1.5 border-b border-slate-200 px-2 py-1.5">
          <button type="button" onClick={mundur} disabled={!riwayat.length} aria-label="Kembali" className="grid h-8 w-8 place-items-center rounded text-ink-soft hover:bg-slate-100 disabled:opacity-30">←</button>
          <button type="button" onClick={naik} disabled={aktif.jenis === 'akar' && !cepatAktif} aria-label="Naik satu folder" className="grid h-8 w-8 place-items-center rounded text-ink-soft hover:bg-slate-100 disabled:opacity-30">↑</button>
          <nav aria-label="Lokasi folder" className="flex h-9 min-w-0 flex-1 items-center gap-1 overflow-x-auto rounded-md px-2 text-[13px] ring-1 ring-slate-300 [scrollbar-width:none]" data-alamat>
            <IkonFolder />
            <button type="button" onClick={() => pergi(keAkar)} className="shrink-0 rounded px-1 hover:bg-slate-100">Dokumen</button>
            {cepatAktif && <><ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-mute" /><span className="shrink-0 font-semibold">{cepat.find((c) => c.k === cepatAktif)?.l}</span></>}
            {!cepatAktif && aktif.jenis === 'trash' && <><ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-mute" /><span className="shrink-0 font-semibold">Sampah</span></>}
            {!cepatAktif && aktif.cabang && <><ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-mute" /><button type="button" onClick={() => pergi(() => keCabang(aktif.cabang))} className="shrink-0 rounded px-1 hover:bg-slate-100">{aktif.cabang}</button></>}
            {!cepatAktif && aktif.jenis === 'project' && <><ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-mute" /><button type="button" onClick={() => pergi(() => setSubAktif(''))} className="max-w-[260px] shrink-0 truncate rounded px-1 font-semibold hover:bg-slate-100">{labelProject(projectAktif || {})}</button></>}
            {!cepatAktif && subNama && <><ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-mute" /><span className="shrink-0 font-semibold">{subNama}</span></>}
          </nav>
          <CariTabel atas value={cari} onChange={setCari} label={`Cari di ${cepatAktif ? 'akses cepat' : judulFolder}…`} />
        </div>

        <div className="flex min-h-[480px]">
          {/* panel navigasi */}
          <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-slate-200 py-2 lg:block" style={{ maxHeight: '68vh' }}>
            <p className="px-3 pb-1 text-[11px] font-bold text-ink-soft">⭐ Akses cepat</p>
            {cepat.map((c) => (
              <button key={c.k} type="button" onClick={() => { setRiwayat((r) => [...r, { aktif, subAktif, cepatAktif }]); setCepatAktif(c.k); setPilih(new Set()) }}
                className={cx('flex min-h-[30px] w-full items-center gap-2 px-6 text-left text-[13px] hover:bg-slate-100', cepatAktif === c.k && 'bg-[#cce4f7]')} data-cepat={c.k}>
                <IkonFolder /><span className="min-w-0 flex-1 truncate">{c.l}</span><span className="text-[11px] text-ink-mute">{c.list.length}</span>
              </button>
            ))}
            <div className="mt-2 px-1">
              <PohonFolder cabangList={cabangList} isiCabang={isiCabang} isiProject={isiProject} buka={buka} onToggle={toggleBuka} aktif={cepatAktif ? { jenis: '' } : aktif}
                onPilihAkar={() => pergi(keAkar)} onPilihCabang={(c) => pergi(() => keCabang(c))} onPilihProject={(c, id) => pergi(() => keProject(c, id))}
                onPilihBerkas={(c, id, f) => { pergi(() => keProject(c, id)); setPreview(f) }}
                trashN={diTrash.length} onPilihTrash={() => pergi(keTrashFolder)} tampilJumlah={bolehLihatJumlah} />
            </div>
          </aside>

          {/* isi */}
          <div className="min-w-0 flex-1" onClick={(e) => { if (e.target === e.currentTarget) setPilih(new Set()) }}>
            {jumlahItem === 0 ? (
              <Empty icon={FolderOpen} title={mencari ? 'Tidak ada berkas yang cocok' : aktif.jenis === 'trash' ? 'Sampah kosong' : 'Folder kosong'}
                text={aktif.jenis === 'project' && bisaUbah ? 'Klik Unggah di atas untuk menambah berkas.' : ''} />
            ) : tampil === 'ikon' ? (
              <div className="flex flex-wrap content-start gap-1 p-3" data-tampil-ikon>
                {folders.map((x) => <KotakFolder key={x.k} {...x} />)}
                {listUtama.map((f) => (
                  <button key={f.key} type="button" onClick={(e) => klikBaris(f, e)} onDoubleClick={() => setPreview(f)} onContextMenu={(e) => { e.preventDefault(); setPilih(new Set([f.key])); setMenu(f.key) }}
                    className={cx('relative flex w-[104px] flex-col items-center gap-1 rounded-md p-2 text-center text-[11.5px]', pilih.has(f.key) ? 'bg-[#cce4f7]' : 'hover:bg-[#e5f1fb]')}>
                    {kindOf(f) === 'image' && f.url ? <img src={f.url} alt="" className="h-[62px] w-[62px] rounded object-cover shadow" /> : <IkonBerkas f={f} besar />}
                    <span className="line-clamp-2 break-all">{f.name}</span>
                    <MenuBerkas f={f} buka={menu === f.key} onTutup={() => setMenu('')} bisaUbah={aktif.jenis !== 'trash' && bolehUbah(user, f.project)}
                      onPreview={() => setPreview(f)} onUnduh={() => unduh(f)} onRename={() => setRename({ f, nama: tanpaEkstensi(f.name) })} onTrash={() => keTrash([f])} onBuka={() => go(`projects/${f.project.id}`)} />
                  </button>
                ))}
              </div>
            ) : (
              <table className="w-full table-fixed text-[13px]" data-tampil-detail>
                <thead className="sticky top-0 bg-white text-left text-[12px] text-ink-soft">
                  <tr className="border-b border-slate-200">
                    <th className="w-9 px-3 py-1.5">{listUtama.length > 0 && <input type="checkbox" checked={semuaTerpilih} onChange={togglePilihSemua} aria-label="Pilih semua" className="h-4 w-4 rounded border-slate-300" />}</th>
                    <th className="py-1.5 font-normal"><button type="button" onClick={() => klikJudul('nama')}>Nama {sortKey === 'nama' ? (sortDir === 'asc' ? '▴' : '▾') : ''}</button></th>
                    <th className="hidden w-[150px] font-normal md:table-cell"><button type="button" onClick={() => klikJudul('waktu')}>Tanggal diubah {sortKey === 'waktu' ? (sortDir === 'asc' ? '▴' : '▾') : ''}</button></th>
                    <th className="hidden w-[120px] font-normal md:table-cell">Jenis</th>
                    <th className="hidden w-[80px] font-normal md:table-cell"><button type="button" onClick={() => klikJudul('ukuran')}>Ukuran</button></th>
                    <th className="hidden w-[130px] font-normal lg:table-cell">Oleh</th>
                  </tr>
                </thead>
                <tbody>
                  {folders.map((x) => <BarisFolder key={x.k} {...x} />)}
                  {listUtama.map((f) => (
                    <tr key={f.key} className={cx('cursor-default', pilih.has(f.key) ? 'bg-[#cce4f7]' : 'hover:bg-[#e5f1fb]')} data-berkas
                      onClick={(e) => { if (e.target.tagName !== 'INPUT') klikBaris(f, e) }} onDoubleClick={() => setPreview(f)}
                      onContextMenu={(e) => { e.preventDefault(); setPilih(new Set([f.key])); setMenu(f.key) }}>
                      <td className="px-3 py-1.5"><input type="checkbox" checked={pilih.has(f.key)} onChange={() => togglePilih(f.key)} aria-label={`Pilih ${f.name}`} className="h-4 w-4 rounded border-slate-300" /></td>
                      <td className="relative py-1.5">
                        <span className="flex min-h-[28px] items-center gap-2"><IkonBerkas f={f} /><span className="min-w-0 truncate">{f.name}</span>
                          <button type="button" onClick={(e) => { e.stopPropagation(); setMenu(menu === f.key ? '' : f.key) }} aria-label={`Tindakan untuk ${f.name}`} className="ml-auto mr-1 grid h-8 w-8 shrink-0 place-items-center rounded text-ink-mute hover:bg-white md:hidden"><MoreHorizontal className="h-4 w-4" /></button></span>
                        {(mencari || cepatAktif) && <span className="block truncate pl-6 text-[11px] text-ink-mute">{f.cabang} › {f.folder}</span>}
                        <span className="md:hidden block pl-6 text-[11px] text-ink-mute">{kb(Number(f.size) || 0)} · {f.by || '—'} · {f.uploaded_at ? tanggalJam(f.uploaded_at) : ''}</span>
                        <MenuBerkas f={f} buka={menu === f.key} onTutup={() => setMenu('')} bisaUbah={aktif.jenis !== 'trash' && bolehUbah(user, f.project)}
                          onPreview={() => setPreview(f)} onUnduh={() => unduh(f)} onRename={() => setRename({ f, nama: tanpaEkstensi(f.name) })} onTrash={() => keTrash([f])} onBuka={() => go(`projects/${f.project.id}`)} />
                      </td>
                      <td className="hidden text-ink-soft md:table-cell">{f.uploaded_at ? tanggalJam(f.uploaded_at) : '—'}</td>
                      <td className="hidden text-ink-soft md:table-cell">{(JENIS[kindOf(f)] || JENIS.other)[1]}</td>
                      <td className="hidden text-ink-soft md:table-cell">{kb(Number(f.size) || 0)}</td>
                      <td className="hidden truncate text-ink-soft lg:table-cell">{f.by || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {aktif.jenis === 'project' && bisaUbah && !mencari && !cepatAktif && (
              <button type="button" onClick={() => unggahRef.current?.click()} className="m-3 hidden w-[calc(100%-1.5rem)] place-items-center rounded-xl border-2 border-dashed border-slate-300 py-8 text-[12.5px] text-ink-mute hover:border-brand hover:text-brand md:grid"
                onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); unggah(e.dataTransfer.files) }} data-tarik-unggah>
                <Upload className="mb-1 h-5 w-5" />Tarik &amp; lepas berkas ke sini, atau klik untuk mengunggah ke "{subNama || labelProject(projectAktif || {})}"
              </button>
            )}
          </div>

          {/* panel detail */}
          <aside className="hidden w-[280px] shrink-0 border-l border-slate-200 p-4 xl:block" data-panel-detail>
            {fokus ? (
              <div className="space-y-3 text-[12.5px]">
                <div className="grid h-[170px] place-items-center overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200">
                  {kindOf(fokus) === 'image' && fokus.url ? <img src={fokus.url} alt="" className="max-h-full max-w-full object-contain" /> : <IkonBerkas f={fokus} besar />}
                </div>
                <div><p className="break-all font-semibold text-ink">{fokus.name}</p><p className="text-ink-mute">{(JENIS[kindOf(fokus)] || JENIS.other)[1]} · {kb(Number(fokus.size) || 0)}</p></div>
                <dl className="space-y-1.5 text-[12px]">
                  <div className="flex justify-between gap-2"><dt className="text-ink-mute">Project</dt><dd className="truncate font-semibold">{invoiceLabel(fokus.invoice)}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-ink-mute">Pelanggan</dt><dd className="truncate">{fokus.pelanggan || '—'}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-ink-mute">Cabang</dt><dd>{fokus.cabang}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-ink-mute">Bagian</dt><dd className="truncate">{fokus.source || '—'}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-ink-mute">Diunggah</dt><dd className="truncate">{fokus.by || '—'}{fokus.uploaded_at ? ` · ${tanggalJam(fokus.uploaded_at)}` : ''}</dd></div>
                </dl>
                <div className="grid grid-cols-2 gap-1.5 text-[12px] font-semibold">
                  <button type="button" onClick={() => setPreview(fokus)} className="h-9 rounded-md bg-[#0067c0] text-white">Buka</button>
                  <button type="button" onClick={() => unduh(fokus)} className="h-9 rounded-md ring-1 ring-slate-300">Unduh</button>
                  <button type="button" onClick={() => go(`projects/${fokus.project.id}`)} className="col-span-2 h-9 rounded-md ring-1 ring-slate-300">Buka project ↗</button>
                </div>
              </div>
            ) : terpilih.length > 1 ? (
              <p className="pt-10 text-center text-[13px] text-ink-soft">{terpilih.length} item dipilih<br /><span className="text-ink-mute">{kb(ukuranPilih)}</span></p>
            ) : <p className="pt-10 text-center text-[12px] text-ink-mute">Pilih berkas untuk melihat detailnya.</p>}
          </aside>
        </div>
        {/* bilah status */}
        <div className="flex items-center gap-4 border-t border-slate-200 bg-[#f3f5f9] px-3 py-1 text-[11.5px] text-ink-soft" data-bilah-status>
          <span>{jumlahItem} item</span>{terpilih.length > 0 && <span>{terpilih.length} item dipilih · {kb(ukuranPilih)}</span>}
          {aktif.jenis === 'project' && !bisaUbah && <span className="text-ink-mute">hanya bisa dilihat & diunduh</span>}
          <span className="ml-auto hidden text-ink-mute md:inline">Klik = pilih · Ctrl+klik = pilih banyak · klik ganda = buka · klik kanan = menu</span>
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
          trashN={diTrash.length} onPilihTrash={keTrashFolder} tampilJumlah={bolehLihatJumlah}
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
