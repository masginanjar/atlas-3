import { useState } from 'react'
import JSZip from 'jszip'
import { ArrowLeft, Hand, Download, Upload, BadgeCheck, CheckCircle2, Loader2, Lock, FileText, Archive, X } from 'lucide-react'
import FileManager, { collect, uploadProjectFiles } from './FileManager.jsx'
import { useUploadNamer } from './UploadNamer.jsx'
import { useApp } from '../lib/store.jsx'
import { go } from '../lib/router.js'
import { drive } from '../lib/integrations.js'
import { saveBlob, dataUrlToBlob } from '../lib/download.js'
import { activeClaim } from '../config/access.js'
import { flowOf } from '../config/workflows.js'
import { cx } from './ui.jsx'
import { tgl, daysLeft } from '../lib/format.js'
import TimeAgo from './TimeAgo.jsx'
import { stageArrivedAt } from '../lib/format.js'

/**
 * Tampilan SEDERHANA untuk Otorisator (huruf besar, tombol besar, 4 langkah):
 * 1. Ambil & Proses → 2. Download Dokumen → 3. Upload Dokumen Setelah Proses → 4. Otorisasi → Siap Print
 */
export default function OtorisatorView({ project }) {
  const { user } = useApp()
  const subs = project.sub_projects.filter((s) => flowOf(s, project) === 'tr_int')
  const todo = subs.filter((s) => s.stage === 'otorisasi')
  const done = subs.filter((s) => s.data?.authorized_by === user.id && s.stage !== 'otorisasi')
  const d = daysLeft(project.about?.deadline)

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <button onClick={() => go('dashboard')} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-base font-semibold text-ink ring-1 ring-slate-300 hover:bg-slate-50">
        <ArrowLeft className="h-5 w-5" />Kembali
      </button>
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{project.invoice_no}</h1>
        <TimeAgo at={project.created_at} prefix="Diposting" className="!text-xs" />
        <p className={cx('mt-1 text-base', d !== null && d <= 1 ? 'font-bold text-rose-600' : 'text-ink-soft')}>Deadline: {tgl(project.about?.deadline)}</p>
      </div>

      {todo.length === 0 && <p className="rounded-2xl bg-white p-6 text-center text-base text-ink-soft ring-1 ring-slate-200">Tidak ada dokumen yang perlu diotorisasi di project ini.</p>}
      {todo.map((s) => <DocCard key={s.id} project={project} sub={s} />)}

      {done.length > 0 && (
        <div className="rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
          <p className="mb-2 text-base font-bold text-emerald-800">Sudah Anda otorisasi</p>
          {done.map((s) => <p key={s.id} className="flex items-center gap-2 text-base text-emerald-900"><CheckCircle2 className="h-5 w-5" />{s.title}</p>)}
        </div>
      )}
      <FileManager project={project} readOnly />
    </div>
  )
}

function Step({ n, title, done, active, children }) {
  return (
    <div className={cx('rounded-2xl p-4 ring-2 transition', done ? 'bg-emerald-50 ring-emerald-300' : active ? 'bg-white ring-brand' : 'bg-slate-50 ring-slate-200 opacity-60')}>
      <p className="mb-3 flex items-center gap-3 text-base font-bold text-ink">
        <span className={cx('grid h-9 w-9 shrink-0 place-items-center rounded-full text-base font-extrabold', done ? 'bg-emerald-500 text-white' : active ? 'bg-brand text-white' : 'bg-slate-300 text-white')}>
          {done ? <CheckCircle2 className="h-5 w-5" /> : n}
        </span>{title}
      </p>
      {children}
    </div>
  )
}

const Big = ({ className, children, ...p }) => (
  <button type="button" {...p} className={cx('flex h-12 w-full items-center justify-center gap-2.5 rounded-xl text-base font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-40', className)}>{children}</button>
)

function DocCard({ project, sub }) {
  const { user, claimSub, processStage, notify } = useApp()
  const [busy, setBusy] = useState(null)
  const [downloaded, setDownloaded] = useState(false)
  const claim = activeClaim(sub)
  const mine = claim?.by === user.id
  const other = claim && !mine
  const docs = [['Dokumen Sumber', sub.data?.dokumen_sumber], ['Hasil Terjemahan', sub.data?.hasil_terjemahan], ['Hasil Proofread', sub.data?.hasil_proofread]].filter(([, f]) => f)
  const uploadedList = sub.data?.file_final_list?.length ? sub.data.file_final_list : sub.data?.file_final ? [sub.data.file_final] : []
  const uploaded = uploadedList[0] ?? null

  const run = async (key, fn, ok) => { setBusy(key); try { await fn(); if (ok) notify(ok) } catch (e) { notify(e.message, 'err') } finally { setBusy(null) } }
  const take = () => run('take', () => claimSub(project, sub.id, true), 'Dokumen diambil')
  const blobOf = async (f) => (f.url?.startsWith('data:') ? dataUrlToBlob(f.url) : drive.blob(f))
  // semua dokumen sub project dalam 1 file ZIP
  const download = () => run('dl', async () => {
    const zip = new JSZip(); const used = new Set()
    for (const [label, f] of docs) {
      let name = `${label} - ${f.name}`; let i = 2
      while (used.has(name)) name = `${label} (${i++}) - ${f.name}`
      used.add(name); zip.file(name, await blobOf(f))
    }
    await saveBlob(`${project.invoice_no} - ${sub.title}.zip`.replace(/[\\/:*?"<>|]/g, '-'), await zip.generateAsync({ type: 'blob' })); setDownloaded(true)
  })
  const saveList = (list) => processStage(project, sub.id, { file_final: list[0] ?? null, file_final_list: list }, false)
  const [reviewNames, namerDialog] = useUploadNamer({ existing: collect(project).map((f) => f.name), invoice: project.invoice_no })
  const upload = async (picked) => { const files = await reviewNames(picked); return files && run('up', async () => {
    const added = await uploadProjectFiles(files.map(({ file, name }) => ({ file, name, sub_id: sub.id })), { branch: project.branch, invoice: project.invoice_no, by: user.name })
    await saveList([...uploadedList, ...added])
  }, files.length > 1 ? `${files.length} dokumen terunggah` : 'Dokumen terunggah') }
  const removeOne = (i) => run('rm', () => saveList(uploadedList.filter((_, j) => j !== i)))
  const authorize = () => run('ok', () => processStage(project, sub.id, { file_final: uploaded, file_final_list: uploadedList }, true), 'Diotorisasi — lanjut ke Nomor Registrasi (Admin Pusat)')

  return (
    <div className="space-y-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
      <p className="flex items-center gap-2 text-lg font-bold"><FileText className="h-5 w-5 text-brand" />{sub.title}</p>
      <TimeAgo at={stageArrivedAt(sub, project)} prefix="Masuk otorisasi" className="!text-xs" />

      {other ? (
        <p className="flex items-center gap-3 rounded-xl bg-amber-50 p-3 text-base text-amber-900 ring-1 ring-amber-300"><Lock className="h-6 w-6 shrink-0" />Sedang diproses oleh <b>{claim.name}</b></p>
      ) : (
        <>
          <Step n={1} title="Ambil & Proses" done={mine} active={!mine}>
            {!mine && <Big onClick={take} disabled={!!busy} className="bg-brand text-white hover:bg-brand-dark">{busy === 'take' ? <Loader2 className="h-6 w-6 animate-spin" /> : <Hand className="h-6 w-6" />}Ambil & Proses</Big>}
          </Step>
          <Step n={2} title="Download Semua Dokumen" done={mine && (downloaded || !!uploaded)} active={mine && !uploaded}>
            {mine && (docs.length
              ? <>
                <Big onClick={download} disabled={!!busy} className="bg-white text-ink ring-2 ring-slate-300 hover:bg-slate-50">{busy === 'dl' ? <Loader2 className="h-6 w-6 animate-spin" /> : <Archive className="h-6 w-6" />}Download Semua Dokumen (ZIP)</Big>
                <p className="mt-2 text-sm text-ink-mute">Isi ZIP: {docs.map(([l]) => l).join(', ')}</p>
              </>
              : <p className="text-base text-ink-mute">File dokumen belum tersedia.</p>)}
          </Step>
          <Step n={3} title="Upload Dokumen Setelah Proses" done={!!uploaded} active={mine && !uploaded}>
            {mine && <>
              {uploadedList.length > 0 && <ul className="mb-3 space-y-1.5">{uploadedList.map((f, i) => (
                <li key={i} className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-base text-emerald-900"><CheckCircle2 className="h-5 w-5 shrink-0" /><span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <button type="button" onClick={() => removeOne(i)} disabled={!!busy} aria-label={`Hapus ${f.name}`} className="rounded p-1 text-ink-mute hover:bg-white hover:text-rose-600"><X className="h-5 w-5" /></button></li>
              ))}</ul>}
              <label className={cx('flex h-12 w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-brand/60 text-base font-bold text-brand hover:bg-brand-soft', busy && 'pointer-events-none opacity-50')}>
                {busy === 'up' ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}{uploadedList.length ? 'Tambah File Lagi' : 'Pilih File Hasil (bisa banyak)'}
                <input type="file" multiple className="hidden" accept="application/pdf,image/*" onChange={(e) => { const fs = [...(e.target.files || [])]; e.target.value = ''; upload(fs) }} aria-label="Upload dokumen hasil otorisasi" />
              </label>
            </>}
          </Step>
          <Step n={4} title="Otorisasi → Nomor Registrasi" done={false} active={mine && !!uploaded}>
            {mine && <Big onClick={authorize} disabled={!uploaded || !!busy} className="bg-emerald-600 text-white hover:bg-emerald-700">{busy === 'ok' ? <Loader2 className="h-6 w-6 animate-spin" /> : <BadgeCheck className="h-6 w-6" />}Otorisasi → No. Registrasi</Big>}
          </Step>
          {mine && <button type="button" onClick={() => run('rel', () => claimSub(project, sub.id, false), 'Dokumen dilepas')} className="w-full py-2 text-center text-sm font-semibold text-ink-mute underline">Batal ambil (lepaskan dokumen)</button>}
        </>
      )}
      {namerDialog}
    </div>
  )
}
