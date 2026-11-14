import { useMemo, useRef, useState } from 'react'
import { Upload, Download, Trash2, Pencil, Check, X, Archive, Loader2, FolderOpen, Eye, Printer, ChevronRight } from 'lucide-react'
import MiniPratinjau from './MiniPratinjau.jsx'
import FilePreview from './FilePreview.jsx'
import { canPreview, kindOf, printBlob } from '../lib/printing.js'
import { useApp } from '../lib/store.jsx'
import { drive } from '../lib/integrations.js'
import { saveBlob } from '../lib/download.js'
import { stagesOf, flowOf } from '../config/workflows.js'
import { Card, Empty, cx } from './ui.jsx'
import { jam, kb } from '../lib/format.js'
import { useUploadNamer, nameTaken } from './UploadNamer.jsx'
import { invoiceLabel } from '../config/access.js'

const uid = () => crypto.randomUUID?.() ?? String(Date.now() + Math.random())
const ext = (n) => (n.match(/\.[^.]+$/)?.[0] ?? '')

/** Upload banyak file ke Drive → objek file project. */
export async function uploadProjectFiles(items, { branch, invoice, by }, onProgress) {
  const out = []
  for (let i = 0; i < items.length; i++) {
    onProgress?.(i + 1, items.length)
    const { file, name, sub_id } = items[i]
    const f = name && name !== file.name ? new File([file], name, { type: file.type }) : file
    const up = await drive.upload(f, { branch, invoice })
    out.push({ id: uid(), ...up, sub_id: sub_id || null, by })
  }
  return out
}

/** Identitas file (untuk mencegah file ganda antara File Project & tahap alur kerja). */
export const fileIdentity = (f) => (f ? f.id || f.drive_id || `${f.url || ''}|${f.name}|${f.size || 0}` : '')
/** Daftar file sebuah field tahap: field utama + lanjutan (field_list). */
export const fieldFiles = (data, key) => {
  const list = data?.[`${key}_list`]
  return (Array.isArray(list) && list.length ? list : data?.[key] && typeof data[key] === 'object' ? [data[key]] : []).filter(Boolean)
}

/** Semua file project: file manajemen project + file yang diunggah di tahap alur kerja (tanpa ganda). */
export function collect(project, { termasukTrash = false } = {}) {
  const list = (project.files || []).map((f) => ({ ...f, key: `p:${f.id}`, kind: 'project', subId: f.sub_id, source: 'Manajemen file' }))
  const seen = new Map(list.map((f) => [fileIdentity(f), f]))
  for (const s of project.sub_projects || []) {
    for (const st of stagesOf(flowOf(s, project))) {
      for (const fl of st.fields.filter((x) => x.type === 'file')) {
        fieldFiles(s.data, fl.key).forEach((v, i) => {
          const id = fileIdentity(v)
          if (seen.has(id)) { const e = seen.get(id); if (!e.usedIn?.includes(fl.label)) e.usedIn = [...(e.usedIn || []), fl.label]; return }
          const e = { ...v, key: `s:${s.id}:${fl.key}:${i}`, kind: 'stage', subId: s.id, fieldKey: fl.key, index: i, source: fl.label }
          seen.set(id, e); list.push(e)
        })
      }
    }
  }
  const hasil = termasukTrash ? list : list.filter((f) => !f.trashed_at)
  return hasil.sort((a, b) => new Date(b.uploaded_at || 0) - new Date(a.uploaded_at || 0))
}

/** Hapus / ubah satu file di semua tempat ia dipakai (File Project & field tahap). */
export function patchEverywhere(next, f, value) {
  const id = fileIdentity(f)
  next.files = value ? next.files.map((x) => (fileIdentity(x) === id ? { ...x, ...value } : x)) : next.files.filter((x) => fileIdentity(x) !== id)
  for (const s of next.sub_projects) {
    for (const k of Object.keys(s.data || {})) {
      const v = s.data[k]
      if (Array.isArray(v) && k.endsWith('_list') && v.some((x) => x && typeof x === 'object' && 'name' in x)) {
        s.data[k] = value ? v.map((x) => (fileIdentity(x) === id ? { ...x, ...value } : x)) : v.filter((x) => fileIdentity(x) !== id)
        s.data[k.slice(0, -5)] = s.data[k][0] || ''
      } else if (v && typeof v === 'object' && !Array.isArray(v) && 'name' in v && fileIdentity(v) === id) {
        s.data[k] = value ? { ...v, ...value } : (s.data[`${k}_list`]?.find((x) => fileIdentity(x) !== id) || '')
      }
    }
  }
}

export default function FileManager({ project, readOnly }) {
  const { user, save, notify, ask } = useApp()
  // SATU folder aktif: yang dilihat = yang jadi tujuan upload.
  // Acuannya ID sub project, bukan namanya — sub bernama sama tidak tertukar.
  const [folder, setFolder] = useState('all')
  const [selected, setSelected] = useState(() => new Set())
  const [renaming, setRenaming] = useState(null)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(null)
  const [preview, setPreview] = useState(null)
  const inputRef = useRef(null)

  const all = useMemo(() => collect(project), [project])
  const [reviewNames, namerDialog] = useUploadNamer({ existing: all.map((f) => f.name), invoice: project.invoice_no })
  const subs = project.sub_projects || []
  const subLabel = (id) => { const i = subs.findIndex((s) => s.id === id); return i < 0 ? 'Umum' : `Sub ${i + 1} · ${subs[i].title}` }
  const shown = all.filter((f) => folder === 'all' || (folder === 'umum' ? !f.subId : f.subId === folder))
  // Upload selalu masuk ke folder yang sedang terlihat. Di tampilan "semua
  // file" belum ada folder yang dituju, jadi diarahkan ke Umum.
  const uploadSub = folder === 'all' || folder === 'umum' ? '' : folder
  const folderLabel = folder === 'all' ? 'Semua file' : folder === 'umum' ? 'Umum' : subLabel(folder)
  const toggle = (k) => setSelected((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n })

  // ---- simpan perubahan ke project ----
  const applyChanges = async (fn) => {
    const next = { ...project, files: [...(project.files || [])], sub_projects: subs.map((s) => ({ ...s, data: { ...s.data } })) }
    fn(next)
    await save('projects', next)
  }
  const patchEntry = (next, f, value) => patchEverywhere(next, f, value)

  const onUpload = async (fileList) => {
    const picked = [...(fileList || [])]; if (inputRef.current) inputRef.current.value = ''
    const files = await reviewNames(picked); if (!files) return
    try {
      const added = await uploadProjectFiles(files.map(({ file, name }) => ({ file, name, sub_id: uploadSub })), { branch: project.branch, invoice: project.invoice_no, by: user.name },
        (i, n) => setBusy(`Mengunggah ${i}/${n}…`))
      await applyChanges((n) => { n.files.push(...added) })
      notify(`${added.length} file diunggah`)
    } catch (e) { notify(e.message, 'err') } finally { setBusy(null); if (inputRef.current) inputRef.current.value = '' }
  }

  const download = async (f) => {
    try { setBusy(`Menyiapkan ${f.name}…`); await saveBlob(f.name, await drive.blob(f)) } catch (e) { notify(e.message, 'err') } finally { setBusy(null) }
  }

  const printFile = async (f) => {
    const k = kindOf(f)
    if (k === 'docx' || k === 'sheet') { setPreview(f); notify('File Word/Excel dirender dulu — tekan Print di jendela pratinjau'); return } // perlu dirender di browser dulu
    try { setBusy(`Menyiapkan print ${f.name}…`); await printBlob(await drive.blob(f), k) } catch (e) { notify(e.message, 'err') } finally { setBusy(null) }
  }

  const remove = async (list) => {
    if (!list.length) return
    if (!(await ask(list.length === 1 ? `Hapus "${list[0].name}"?` : `Hapus ${list.length} file terpilih?`))) return
    try {
      setBusy('Menghapus…')
      for (const f of list) await drive.remove(f)
      await applyChanges((n) => list.forEach((f) => patchEntry(n, f, null)))
      setSelected(new Set()); notify(`${list.length} file dihapus`)
    } catch (e) { notify(e.message, 'err') } finally { setBusy(null) }
  }

  const startRename = (f) => { setRenaming(f.key); setNewName(f.name) }
  const doRename = async (f) => {
    let name = newName.trim()
    if (!name) return setRenaming(null)
    if (!ext(name) && ext(f.name)) name += ext(f.name) // pertahankan ekstensi
    if (name !== f.name && nameTaken(name, all.filter((x) => x.key !== f.key).map((x) => x.name))) return notify(`Nama "${name}" sudah dipakai di File Project`, 'err')
    try { await drive.rename(f, name); await applyChanges((n) => patchEntry(n, f, { name })); notify('Nama file diubah') }
    catch (e) { notify(e.message, 'err') } finally { setRenaming(null) }
  }

  const downloadZip = async (files = all, suffix = '') => {
    if (!files.length) return
    try {
      const JSZip = (await import('jszip')).default; const zip = new JSZip(); const used = new Set(); let skipped = 0
      for (let i = 0; i < files.length; i++) {
        const f = files[i]; setBusy(`Mengemas ZIP ${i + 1}/${files.length}…`)
        let blob; try { blob = await drive.blob(f) } catch { skipped++; continue }
        const namaFolder = subLabel(f.subId).replace(/[\\/:*?"<>|]/g, '-').slice(0, 60)
        let path = `${namaFolder}/${f.name}`; let k = 1
        while (used.has(path)) path = `${namaFolder}/${f.name.replace(/(\.[^.]+)?$/, ` (${k++})$1`)}`
        used.add(path); zip.file(path, blob)
      }
      if (!used.size) throw new Error('Tidak ada file yang bisa dikemas')
      setBusy('Membuat ZIP…')
      await saveBlob(`${invoiceLabel(project.invoice_no)}${suffix}.zip`, await zip.generateAsync({ type: 'blob' }))
      if (skipped) notify(`${skipped} file dilewati (tidak tersedia)`, 'err')
    } catch (e) { notify(e.message, 'err') } finally { setBusy(null) }
  }

  const selList = all.filter((f) => selected.has(f.key))
  const satu = selList.length === 1 ? selList[0] : null

  // ---- Tampilan ala File Explorer (sama dengan halaman Dokumen) ----
  const [tampil, setTampil] = useState(() => { try { return localStorage.getItem('atlas-dok-tampil') || 'detail' } catch { return 'detail' } })
  const gantiTampil = (v) => { setTampil(v); try { localStorage.setItem('atlas-dok-tampil', v) } catch { /* abaikan */ } }
  const diAkar = folder === 'all'
  const isiFolder = (id) => all.filter((f) => (id === 'umum' ? !f.subId : f.subId === id))
  const daftarFolder = diAkar ? [{ id: 'umum', nama: 'Umum' }, ...subs.map((sb, i) => ({ id: sb.id, nama: `Sub ${i + 1} · ${sb.title}` }))].map((x) => ({ ...x, n: isiFolder(x.id).length })) : []
  const berkas = diAkar ? [] : shown
  const buka = (id) => { setFolder(id); setSelected(new Set()) }
  const klik = (f, e) => { if (e.ctrlKey || e.metaKey || e.shiftKey) toggle(f.key); else setSelected(new Set([f.key])) }
  const JENIS = { pdf: ['PDF', 'Dokumen PDF', 'bg-rose-600'], image: ['IMG', 'Gambar', 'bg-sky-500'], docx: ['DOC', 'Dokumen Word', 'bg-blue-600'], sheet: ['XLS', 'Lembar kerja', 'bg-emerald-600'], text: ['TXT', 'Teks', 'bg-slate-500'], other: ['FILE', 'Berkas', 'bg-slate-400'] }
  const IkonBerkas = ({ f, besar }) => { const [t, , w] = JENIS[kindOf(f)] || JENIS.other; return <span className={cx('inline-grid shrink-0 place-items-center rounded-[3px] font-extrabold text-white', w, besar ? 'h-[62px] w-[48px] text-[11px] shadow' : 'h-[18px] w-[15px] text-[6px]')}>{t}</span> }
  const IkonFolder = ({ besar }) => <span className={cx('relative inline-block shrink-0 rounded-[3px] bg-gradient-to-b from-[#ffd666] to-[#f5b942]', besar ? 'h-[52px] w-[68px]' : 'h-[14px] w-[18px]')}><span className={cx('absolute left-0 rounded-t-[3px] bg-[#f5b942]', besar ? '-top-2 h-2.5 w-7' : '-top-[3px] h-1 w-2')} /></span>
  const Alat = ({ icon: I, label, onClick, disabled, bahaya, hide }) => hide ? null : (
    <button type="button" onClick={onClick} disabled={disabled} title={label}
      className={cx('inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] transition disabled:opacity-40', bahaya ? 'text-rose-600 hover:bg-rose-50' : 'text-ink hover:bg-white')}>
      <I className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">{label}</span>
    </button>
  )
  const NamaAtauUbah = ({ f }) => renaming === f.key ? (
    <form className="flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); doRename(f) }} onClick={(e) => e.stopPropagation()}>
      <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} aria-label="Nama file baru"
        className="w-full rounded bg-white px-1.5 py-0.5 text-[13px] ring-2 ring-[#0067c0] focus:outline-none" />
      <button className="rounded p-1 text-emerald-600" aria-label="Simpan nama"><Check className="h-4 w-4" /></button>
      <button type="button" onClick={() => setRenaming(null)} className="rounded p-1 text-ink-mute" aria-label="Batal"><X className="h-4 w-4" /></button>
    </form>
  ) : <span className="min-w-0 truncate" title={f.name}>{f.name}</span>
  const bukaPratinjau = (f) => { if (canPreview(f)) setPreview(f); else download(f) }

  return (
    <Card className="overflow-hidden" data-file-explorer>
      {/* Judul */}
      <div className="flex flex-wrap items-baseline gap-x-2 px-4 pb-2 pt-3">
        <h2 className="text-[15px] font-bold">File Project</h2>
        <span className="text-[12px] text-ink-mute">{all.length} berkas · {kb(all.reduce((a, f) => a + (Number(f.size) || 0), 0))}</span>
      </div>

      {/* Bilah perintah (sama dengan halaman Dokumen) */}
      <div className="flex flex-wrap items-center gap-0.5 border-y border-slate-200 bg-[#f3f3f3] px-2 py-1 dark:border-white/10 dark:bg-white/5" role="toolbar" aria-label="Perintah berkas">
        {!readOnly && <Alat icon={Upload} label="Unggah" onClick={() => inputRef.current?.click()} disabled={!!busy} />}
        <span className="mx-1 h-5 w-px bg-slate-300" aria-hidden="true" />
        <Alat icon={Download} label={selList.length > 1 ? `Unduh ${selList.length} (ZIP)` : 'Unduh'} disabled={!selList.length || !!busy} onClick={() => (satu ? download(satu) : downloadZip(selList, '-terpilih'))} />
        <Alat icon={Archive} label="Unduh semua (ZIP)" disabled={!all.length || !!busy} onClick={() => downloadZip()} />
        <Alat icon={Printer} label="Print" disabled={!satu || !canPreview(satu) || !!busy} onClick={() => printFile(satu)} />
        <Alat icon={Eye} label="Pratinjau" disabled={!satu || !canPreview(satu)} onClick={() => setPreview(satu)} />
        {!readOnly && <Alat icon={Pencil} label="Ganti nama" disabled={!satu} onClick={() => startRename(satu)} />}
        {!readOnly && <Alat icon={Trash2} label={selList.length > 1 ? `Hapus ${selList.length}` : 'Hapus'} bahaya disabled={!selList.length || !!busy} onClick={() => remove(selList)} />}
        <div className="ml-auto flex items-center gap-0.5 rounded-md bg-white p-0.5 ring-1 ring-slate-200 dark:bg-white/5 dark:ring-white/10" role="group" aria-label="Tampilan">
          {[['detail', '☰ Detail'], ['list', '≡ List'], ['ikon', '▦ Ikon']].map(([k, l]) => (
            <button key={k} type="button" onClick={() => gantiTampil(k)} aria-pressed={tampil === k} className={cx('h-8 rounded px-2.5 text-[12px] font-semibold', tampil === k ? 'bg-[#cce4f7] text-ink' : 'text-ink-soft hover:bg-slate-50')}>{l}</button>
          ))}
        </div>
        <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => onUpload(e.target.files)} aria-label="Pilih satu atau beberapa file" />
      </div>

      {/* Bilah alamat */}
      <div className="flex items-center gap-1 px-2 py-1.5">
        <button type="button" onClick={() => buka('all')} disabled={diAkar} aria-label="Naik satu folder" className="grid h-8 w-8 place-items-center rounded text-ink-soft hover:bg-slate-100 disabled:opacity-30"><ChevronRight className="h-4 w-4 rotate-180" /></button>
        <nav aria-label="Lokasi folder" className="flex min-h-9 min-w-0 flex-1 items-center gap-1 overflow-hidden rounded-md px-2 text-[13px] ring-1 ring-slate-200 dark:ring-white/10">
          <IkonFolder />
          <button type="button" onClick={() => buka('all')} className="shrink-0 rounded px-1 hover:bg-slate-100">File Project</button>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-mute" aria-hidden="true" />
          <span className={cx('shrink-0 px-1 tabular-nums', diAkar && 'font-semibold')}>{invoiceLabel(project.invoice_no)}</span>
          {!diAkar && <><ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-mute" aria-hidden="true" /><span className="min-w-0 truncate px-1 font-semibold">{folderLabel}</span></>}
        </nav>
        {busy && <span className="flex shrink-0 items-center gap-1.5 px-2 text-xs text-brand" aria-live="polite"><Loader2 className="h-3.5 w-3.5 animate-spin" />{busy}</span>}
      </div>

      {/* Isi */}
      <div className="min-h-[140px] border-t border-slate-100 dark:border-white/10" data-isi-explorer onDragOver={(e) => { if (!readOnly) e.preventDefault() }} onDrop={(e) => { if (readOnly) return; e.preventDefault(); onUpload(e.dataTransfer.files) }}>
        {!daftarFolder.length && !berkas.length ? (
          <Empty icon={FolderOpen} title="Folder ini kosong" text={readOnly ? '' : `Klik Unggah atau tarik berkas ke sini — tersimpan ke ${folderLabel}.`} />
        ) : tampil === 'ikon' ? (
          <div className="flex flex-wrap content-start gap-1 p-3" data-tampil-ikon>
            {daftarFolder.map((x) => (
              <button key={x.id} type="button" onClick={() => buka(x.id)} data-folder className="flex w-[104px] flex-col items-center gap-1 rounded-md p-2 text-center text-[11.5px] hover:bg-[#e5f1fb]">
                <IkonFolder besar /><span className="line-clamp-2 break-all">{x.nama}</span><span className="text-[10.5px] text-ink-mute">{x.n} berkas</span>
              </button>
            ))}
            {berkas.map((f) => (
              <button key={f.key} type="button" onClick={(e) => klik(f, e)} onDoubleClick={() => bukaPratinjau(f)}
                className={cx('flex w-[104px] flex-col items-center gap-1 rounded-md p-2 text-center text-[11.5px]', selected.has(f.key) ? 'bg-[#cce4f7]' : 'hover:bg-[#e5f1fb]')}>
                {['pdf', 'image'].includes(kindOf(f)) ? <MiniPratinjau f={f} jenis={kindOf(f)} ambilBlob={(x) => drive.blob(x)} fallback={<IkonBerkas f={f} besar />} /> : <IkonBerkas f={f} besar />}
                {renaming === f.key ? <NamaAtauUbah f={f} /> : <span className="line-clamp-2 break-all">{f.name}</span>}
              </button>
            ))}
          </div>
        ) : tampil === 'list' ? (
          <ul className="columns-1 gap-x-4 p-2 text-[13px] sm:columns-2 lg:columns-3" data-tampil-list>
            {daftarFolder.map((x) => (
              <li key={x.id} className="break-inside-avoid"><button type="button" onClick={() => buka(x.id)} data-folder className="flex min-h-9 w-full items-center gap-2 rounded px-2 text-left hover:bg-[#e5f1fb]"><IkonFolder /><span className="min-w-0 truncate">{x.nama}</span><span className="ml-auto text-[11px] text-ink-mute">{x.n}</span></button></li>
            ))}
            {berkas.map((f) => (
              <li key={f.key} className="break-inside-avoid">
                <button type="button" onClick={(e) => klik(f, e)} onDoubleClick={() => bukaPratinjau(f)} className={cx('flex min-h-9 w-full items-center gap-2 rounded px-2 text-left', selected.has(f.key) ? 'bg-[#cce4f7]' : 'hover:bg-[#e5f1fb]')}>
                  <IkonBerkas f={f} /><NamaAtauUbah f={f} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <table className="w-full table-fixed text-[13px]" data-tampil-detail>
            <thead className="text-left text-[12px] text-ink-soft">
              <tr className="border-b border-slate-200 dark:border-white/10">
                <th className="w-9 px-3 py-1.5">{berkas.length > 0 && <input type="checkbox" checked={berkas.every((f) => selected.has(f.key))} onChange={(e) => setSelected(e.target.checked ? new Set(berkas.map((f) => f.key)) : new Set())} aria-label="Pilih semua" className="h-4 w-4 rounded" />}</th>
                <th className="py-1.5 font-normal">Nama</th>
                <th className="hidden w-[26%] font-normal md:table-cell">Tanggal diubah</th>
                <th className="hidden w-[17%] font-normal md:table-cell">Jenis</th>
                <th className="hidden w-[13%] font-normal md:table-cell">Ukuran</th>
              </tr>
            </thead>
            <tbody>
              {daftarFolder.map((x) => (
                <tr key={x.id} className="cursor-default hover:bg-[#e5f1fb]" onDoubleClick={() => buka(x.id)} data-folder>
                  <td className="px-3 py-1.5" />
                  <td className="overflow-hidden py-1.5 pr-3"><button type="button" onClick={() => buka(x.id)} title={x.nama} className="flex min-h-[28px] w-full min-w-0 items-center gap-2 text-left"><IkonFolder /><span className="min-w-0 truncate font-medium text-ink">{x.nama}</span></button></td>
                  <td className="hidden text-ink-mute md:table-cell" /><td className="hidden text-ink-mute md:table-cell">Folder</td><td className="hidden text-ink-mute md:table-cell">{x.n} berkas</td>
                </tr>
              ))}
              {berkas.map((f) => (
                <tr key={f.key} onClick={(e) => { if (e.target.closest('input,button,form')) return; klik(f, e) }} onDoubleClick={() => bukaPratinjau(f)}
                  className={cx('cursor-default', selected.has(f.key) ? 'bg-[#cce4f7]' : 'hover:bg-[#e5f1fb]')} data-berkas>
                  <td className="px-3 py-1.5"><input type="checkbox" checked={selected.has(f.key)} onChange={() => toggle(f.key)} aria-label={`Pilih ${f.name}`} className="h-4 w-4 rounded" /></td>
                  <td className="overflow-hidden py-1.5 pr-3"><span className="flex min-h-[28px] min-w-0 items-center gap-2"><IkonBerkas f={f} /><NamaAtauUbah f={f} /></span>
                    <span className="block truncate pl-[23px] text-[11px] text-ink-mute md:hidden">{kb(f.size || 0)}{f.uploaded_at ? ` · ${jam(f.uploaded_at)}` : ''}</span></td>
                  <td className="hidden truncate text-ink-mute md:table-cell">{f.uploaded_at ? jam(f.uploaded_at) : '—'}</td>
                  <td className="hidden truncate text-ink-mute md:table-cell" title={f.source}>{(JENIS[kindOf(f)] || JENIS.other)[1]}</td>
                  <td className="hidden text-ink-mute md:table-cell">{kb(f.size || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Bilah status */}
      <div className="flex items-center gap-3 border-t border-slate-200 bg-[#f3f3f3] px-3 py-1 text-[11.5px] text-ink-soft dark:border-white/10 dark:bg-white/5">
        <span>{diAkar ? `${daftarFolder.length} folder` : `${berkas.length} item`}</span>
        {selList.length > 0 && <span>{selList.length} dipilih · {kb(selList.reduce((a, f) => a + (Number(f.size) || 0), 0))}</span>}
        {!readOnly && <span className="ml-auto hidden sm:inline">Unggah tersimpan ke <b>{diAkar ? 'Umum' : folderLabel}</b></span>}
      </div>
      {preview && <FilePreview file={preview} onClose={() => setPreview(null)} />}
      {namerDialog}
    </Card>
  )
}
