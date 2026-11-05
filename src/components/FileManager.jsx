import { useMemo, useRef, useState } from 'react'
import JSZip from 'jszip'
import { FileText, FileImage, Upload, Download, Trash2, Pencil, Check, X, Archive, Loader2, FolderOpen, Eye, Printer } from 'lucide-react'
import FilePreview from './FilePreview.jsx'
import { canPreview, kindOf, printBlob } from '../lib/printing.js'
import { useApp } from '../lib/store.jsx'
import { drive } from '../lib/integrations.js'
import { saveBlob } from '../lib/download.js'
import { stagesOf, flowOf } from '../config/workflows.js'
import { Button, Card, Empty, Select, cx } from './ui.jsx'
import { jam, kb } from '../lib/format.js'
import { useUploadNamer, nameTaken } from './UploadNamer.jsx'

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
export function collect(project) {
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
  return list.sort((a, b) => new Date(b.uploaded_at || 0) - new Date(a.uploaded_at || 0))
}

/** Hapus / ubah satu file di semua tempat ia dipakai (File Project & field tahap). */
function patchEverywhere(next, f, value) {
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
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(() => new Set())
  const [renaming, setRenaming] = useState(null)
  const [newName, setNewName] = useState('')
  const [uploadSub, setUploadSub] = useState('')
  const [busy, setBusy] = useState(null)
  const [preview, setPreview] = useState(null)
  const inputRef = useRef(null)

  const all = useMemo(() => collect(project), [project])
  const [reviewNames, namerDialog] = useUploadNamer({ existing: all.map((f) => f.name), invoice: project.invoice_no })
  const subs = project.sub_projects || []
  const subLabel = (id) => { const i = subs.findIndex((s) => s.id === id); return i < 0 ? 'Umum' : `Sub ${i + 1} · ${subs[i].title}` }
  const shown = all.filter((f) => filter === 'all' || (filter === 'umum' ? !f.subId : f.subId === filter))
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
    try { setBusy(`Menyiapkan print ${f.name}…`); await printBlob(await drive.blob(f), kindOf(f)) } catch (e) { notify(e.message, 'err') } finally { setBusy(null) }
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
      const zip = new JSZip(); const used = new Set(); let skipped = 0
      for (let i = 0; i < files.length; i++) {
        const f = files[i]; setBusy(`Mengemas ZIP ${i + 1}/${files.length}…`)
        let blob; try { blob = await drive.blob(f) } catch { skipped++; continue }
        const folder = subLabel(f.subId).replace(/[\\/:*?"<>|]/g, '-').slice(0, 60)
        let path = `${folder}/${f.name}`; let k = 1
        while (used.has(path)) path = `${folder}/${f.name.replace(/(\.[^.]+)?$/, ` (${k++})$1`)}`
        used.add(path); zip.file(path, blob)
      }
      if (!used.size) throw new Error('Tidak ada file yang bisa dikemas')
      setBusy('Membuat ZIP…')
      await saveBlob(`${project.invoice_no}${suffix}.zip`, await zip.generateAsync({ type: 'blob' }))
      if (skipped) notify(`${skipped} file dilewati (tidak tersedia)`, 'err')
    } catch (e) { notify(e.message, 'err') } finally { setBusy(null) }
  }

  const selList = all.filter((f) => selected.has(f.key))

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-4">
        <div className="mr-auto">
          <h2 className="font-bold">File Project <span className="text-ink-mute">({all.length})</span></h2>
          <p className="text-[11px] text-ink-mute">Google Drive · ATLAS / {project.branch} / {project.invoice_no}</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => downloadZip()} disabled={!all.length || !!busy}><Archive className="h-3.5 w-3.5" />Download ZIP</Button>
      </div>

      {/* Upload */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-50 px-4 py-3">
        <Select value={uploadSub} onChange={(e) => setUploadSub(e.target.value)} className="h-9 flex-1 bg-white py-1.5 text-xs sm:max-w-xs" aria-label="Kaitkan ke sub project">
          <option value="">Ke: Umum</option>
          {subs.map((s, i) => <option key={s.id} value={s.id}>Ke: Sub {i + 1} · {s.title}</option>)}
        </Select>
        <Button size="sm" onClick={() => inputRef.current?.click()} disabled={!!busy}><Upload className="h-3.5 w-3.5" />Upload File</Button>
        <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => onUpload(e.target.files)} />
      </div>

      {/* Filter & aksi terpilih */}
      <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
        <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-8 max-w-[160px] bg-white py-1 text-xs" aria-label="Filter sub project">
          <option value="all">Semua file</option><option value="umum">Umum</option>
          {subs.map((s, i) => <option key={s.id} value={s.id}>Sub {i + 1}</option>)}
        </Select>
        {shown.length > 0 && (
          <label className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft">
            <input type="checkbox" checked={shown.every((f) => selected.has(f.key))}
              onChange={(e) => setSelected(e.target.checked ? new Set(shown.map((f) => f.key)) : new Set())} />Pilih semua
          </label>
        )}
        {selList.length > 0 && (
          <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
            <Button size="sm" disabled={!!busy} onClick={() => (selList.length === 1 ? download(selList[0]) : downloadZip(selList, '-terpilih'))}
              title={selList.length === 1 ? 'Unduh file' : 'Unduh sebagai satu file ZIP'}>
              <Download className="h-3.5 w-3.5" />Download {selList.length}<span className="hidden sm:inline"> terpilih</span>{selList.length > 1 ? ' (ZIP)' : ''}
            </Button>
            {!readOnly && <Button size="sm" variant="danger" disabled={!!busy} onClick={() => remove(selList)}><Trash2 className="h-3.5 w-3.5" />Hapus {selList.length}<span className="hidden sm:inline"> terpilih</span></Button>}
          </div>
        )}
        {busy && <span className="ml-auto flex items-center gap-1.5 text-xs text-brand"><Loader2 className="h-3.5 w-3.5 animate-spin" />{busy}</span>}
      </div>

      {shown.length === 0 ? <Empty icon={FolderOpen} title="Belum ada file" text="Unggah dokumen dan kaitkan dengan sub project." /> : (
        <ul className="mt-2 divide-y divide-slate-100">
          {shown.map((f) => {
            const Icon = /\.(png|jpe?g|webp|gif|heic)$/i.test(f.name) ? FileImage : FileText
            return (
              <li key={f.key} className={cx('flex items-center gap-3 px-4 py-2.5', selected.has(f.key) && 'bg-brand-soft/50')}>
                <input type="checkbox" checked={selected.has(f.key)} onChange={() => toggle(f.key)} aria-label={`Pilih ${f.name}`} />
                <Icon className="h-5 w-5 shrink-0 text-brand" />
                <div className="min-w-0 flex-1">
                  {renaming === f.key ? (
                    <form className="flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); doRename(f) }}>
                      <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
                        className="w-full rounded-lg bg-white px-2 py-1 text-sm ring-2 ring-brand focus:outline-none" />
                      <button className="rounded p-1 text-emerald-600" aria-label="Simpan nama"><Check className="h-4 w-4" /></button>
                      <button type="button" onClick={() => setRenaming(null)} className="rounded p-1 text-ink-mute" aria-label="Batal"><X className="h-4 w-4" /></button>
                    </form>
                  ) : canPreview(f)
                    ? <button type="button" onClick={() => setPreview(f)} className="block max-w-full truncate text-left text-sm font-semibold hover:text-brand hover:underline">{f.name}</button>
                    : <p className="truncate text-sm font-semibold">{f.name}</p>}
                  <p className="truncate text-[11px] text-ink-mute">{subLabel(f.subId)} · {f.source}{f.usedIn?.length ? ` · dipakai di ${f.usedIn.join(', ')}` : ''} · {kb(f.size || 0)}{f.uploaded_at ? ` · ${jam(f.uploaded_at)}` : ''}</p>
                </div>
                {renaming !== f.key && (
                  <div className="flex shrink-0">
                    {canPreview(f) && <button onClick={() => setPreview(f)} className="rounded-lg p-1.5 text-ink-mute hover:bg-slate-100 hover:text-brand" aria-label="Preview" title="Preview"><Eye className="h-4 w-4" /></button>}
                    {canPreview(f) && <button onClick={() => printFile(f)} className="rounded-lg p-1.5 text-ink-mute hover:bg-slate-100 hover:text-brand" aria-label="Print" title="Print"><Printer className="h-4 w-4" /></button>}
                    <button onClick={() => download(f)} className="rounded-lg p-1.5 text-ink-mute hover:bg-slate-100 hover:text-brand" aria-label="Download" title="Download"><Download className="h-4 w-4" /></button>
                    {!readOnly && <><button onClick={() => startRename(f)} className="rounded-lg p-1.5 text-ink-mute hover:bg-slate-100 hover:text-ink" aria-label="Ganti nama" title="Ganti nama"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => remove([f])} className="rounded-lg p-1.5 text-ink-mute hover:bg-rose-50 hover:text-rose-600" aria-label="Hapus" title="Hapus"><Trash2 className="h-4 w-4" /></button></>}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <div className="h-2" />
      {preview && <FilePreview file={preview} onClose={() => setPreview(null)} />}
      {namerDialog}
    </Card>
  )
}
