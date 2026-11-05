import { useState } from 'react'
import { ArrowLeft, Download, Upload, Eye, CheckCircle2, Loader2, FileText, Send, UserRound, Languages, CalendarClock } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { go } from '../lib/router.js'
import { drive } from '../lib/integrations.js'
import { saveBlob, dataUrlToBlob } from '../lib/download.js'
import { flowOf, stageIndex } from '../config/workflows.js'
import { PriorityBadge } from './Priority.jsx'
import FilePreview from './FilePreview.jsx'
import FileManager, { fieldFiles, uploadProjectFiles, collect } from './FileManager.jsx'
import { useUploadNamer } from './UploadNamer.jsx'
import { cx } from './ui.jsx'
import { tgl, daysLeft } from '../lib/format.js'
import TimeAgo from './TimeAgo.jsx'
import { stageArrivedAt } from '../lib/format.js'
import { placeOf, seeProofreaderIdentity, proofreaderTeamName, pickProofreader } from '../config/access.js'

/**
 * Tampilan SEDERHANA untuk Penerjemah & Proofreader:
 * dapat order → baca/download sumber + data umum klien → kerjakan → upload → proses berikutnya.
 */
const ROLE_CFG = {
  penerjemah: {
    stage: 'penerjemahan', who: 'translator', fileKey: 'hasil_terjemahan',
    read: 'Baca & Download Dokumen Sumber', upload: 'Upload Hasil Terjemahan', next: 'Kirim ke Proofreader', doneLabel: 'Sudah Anda terjemahkan',
  },
  proofreader: {
    stage: 'proofread', who: 'proofreader', fileKey: 'hasil_proofread',
    read: 'Baca Dokumen Sumber & Hasil Terjemahan', upload: 'Upload File Setelah Diperiksa', next: 'Lanjut ke Otorisator', doneLabel: 'Sudah Anda periksa',
  },
}

export default function WorkerView({ project }) {
  const { user } = useApp()
  const cfg = ROLE_CFG[user.role]
  const subs = project.sub_projects.filter((s) => ['tr_int', 'tr_nt'].includes(flowOf(s, project)) && s.data?.[cfg.who] === user.id)
  const todo = subs.filter((s) => s.stage === cfg.stage)
  const done = subs.filter((s) => stageIndex(flowOf(s, project), s.stage) > stageIndex(flowOf(s, project), cfg.stage))
  const d = daysLeft(project.about?.deadline)

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <button onClick={() => go('dashboard')} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-base font-semibold text-ink ring-1 ring-slate-300 hover:bg-slate-50">
        <ArrowLeft className="h-5 w-5" />Kembali
      </button>

      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-extrabold tracking-tight">{project.invoice_no}</h1>
        <TimeAgo at={project.created_at} prefix="Diposting" className="!text-xs" />
        <p className="mt-2 flex items-center gap-2 text-base font-semibold"><UserRound className="h-5 w-5 text-sky-600" />{project.customer?.name || '—'}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className={cx('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ring-1', d !== null && d <= 1 ? 'bg-rose-50 text-rose-700 ring-rose-200' : 'bg-slate-50 text-ink-soft ring-slate-200')}>
            <CalendarClock className="h-4 w-4" />Deadline {tgl(project.about?.deadline)}{d !== null && (d < 0 ? ` · terlambat ${-d} hr` : d === 0 ? ' · hari ini' : ` · ${d} hari lagi`)}
          </span>
          <PriorityBadge p={project.about?.priority} className="!text-xs" />
        </div>
      </div>

      {todo.length === 0 && <p className="rounded-2xl bg-white p-6 text-center text-base text-ink-soft ring-1 ring-slate-200">Tidak ada order untuk Anda di project ini.</p>}
      {todo.map((s) => <OrderCard key={s.id} project={project} sub={s} cfg={cfg} />)}

      {done.length > 0 && (
        <div className="rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
          <p className="mb-2 text-base font-bold text-emerald-800">{cfg.doneLabel}</p>
          {done.map((s) => <p key={s.id} className="flex items-center gap-2 text-base text-emerald-900"><CheckCircle2 className="h-5 w-5" />{s.title}</p>)}
        </div>
      )}

      <FileManager project={project} readOnly />
    </div>
  )
}

function Step({ n, title, done, active, children }) {
  return (
    <div className={cx('rounded-2xl p-4 ring-2 transition', done ? 'bg-emerald-50 ring-emerald-300' : active ? 'bg-white ring-brand' : 'bg-slate-50 ring-slate-200')}>
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

function FileRow({ label, file, onPreview, onDownload, busy }) {
  if (!file) return <p className="text-base text-ink-mute">{label}: file belum tersedia.</p>
  return (
    <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
      <p className="mb-2 flex items-center gap-2 text-sm text-ink-soft"><FileText className="h-4 w-4" /><span className="font-semibold">{label}</span> · <span className="truncate">{file.name}</span></p>
      <div className="grid grid-cols-2 gap-2">
        <Big onClick={onPreview} className="!h-11 bg-white text-sm text-ink ring-1 ring-slate-300 hover:bg-slate-50"><Eye className="h-5 w-5" />Baca</Big>
        <Big onClick={onDownload} disabled={busy} className="!h-11 bg-white text-sm text-ink ring-1 ring-slate-300 hover:bg-slate-50">{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}Download</Big>
      </div>
    </div>
  )
}

function OrderCard({ project, sub, cfg }) {
  const { user, data, processStage, notify } = useApp()
  const [busy, setBusy] = useState(null)
  const [read, setRead] = useState(false)
  const [preview, setPreview] = useState(null)
  const proofreaders = data.users.filter((u) => u.role === 'proofreader' && u.active !== false)
  // Pengguna biasa (mis. penerjemah) mengirim ke TIM Proofreader, bukan ke orang tertentu:
  // sistem memilih proofreader dengan antrean paling sedikit, namanya tidak dibagikan.
  const teamOnly = !seeProofreaderIdentity(user)
  const [pr, setPr] = useState(sub.data?.proofreader || (teamOnly ? '' : proofreaders.find((u) => u.branch === project.branch)?.id || proofreaders[0]?.id || ''))
  const [note, setNote] = useState(sub.data?.catatan_proofread || '')
  const isTr = user.role === 'penerjemah'
  const isNT = flowOf(sub, project) === 'tr_nt' // non tersumpah: selesai langsung kembali ke CS
  const upList = fieldFiles(sub.data, cfg.fileKey)
  const uploaded = upList[0]
  const docs = sub.docs?.length ? sub.docs : [{ desc: sub.title, pages: sub.pages }]
  const many = (label, key) => { const l = fieldFiles(sub.data, key); return (l.length ? l : [null]).map((f, i) => [l.length > 1 ? `${label} ${i + 1}/${l.length}` : label, f]) }
  const sources = [...many('Dokumen Sumber', 'dokumen_sumber'), ...(isTr ? [] : many('Hasil Terjemahan', 'hasil_terjemahan'))]

  const run = async (key, fn, ok) => { setBusy(key); try { await fn(); if (ok) notify(ok) } catch (e) { notify(e.message, 'err') } finally { setBusy(null) } }
  const download = (f, key) => run(key, async () => { await saveBlob(f.name, f.url?.startsWith('data:') ? dataUrlToBlob(f.url) : await drive.blob(f)); setRead(true) })
  // bisa banyak file; replace=true → ganti semua
  const [reviewNames, namerDialog] = useUploadNamer({ existing: collect(project).map((f) => f.name), invoice: project.invoice_no })
  const upload = async (fileList, replace) => { const files = await reviewNames(fileList); return files && run('up', async () => {
    const added = await uploadProjectFiles(files.map(({ file, name }) => ({ file, name, sub_id: sub.id })), { branch: project.branch, invoice: project.invoice_no, by: user.name })
    const list = [...(replace ? [] : upList), ...added]
    await processStage(project, sub.id, { [cfg.fileKey]: list[0], [`${cfg.fileKey}_list`]: list }, false)
  }, `${files.length} file terunggah`) }
  const next = () => run('next', () => {
    const target = isTr && !isNT ? (teamOnly ? pickProofreader(data.users, data.projects) : pr) : null
    if (isTr && !isNT && !target) throw new Error('Tidak ada proofreader aktif — hubungi Supervisor')
    return processStage(project, sub.id, isNT ? {} : isTr ? { proofreader: target } : { catatan_proofread: note }, true)
  }, isNT ? 'Selesai — dokumen kembali ke CS' : isTr ? 'Terkirim ke Tim Proofreader' : 'Lanjut ke Otorisator')
  const canNext = isTr ? !!uploaded && (isNT || teamOnly ? proofreaders.length > 0 : !!pr) : true

  return (
    <div className="space-y-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
      <div>
        <p className="flex flex-wrap items-center gap-2 text-lg font-bold"><FileText className="h-5 w-5 text-brand" />{sub.title}{isNT && <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-[11px] font-semibold text-cyan-700 ring-1 ring-cyan-200">Non Tersumpah</span>}</p>
        <TimeAgo at={stageArrivedAt(sub, project)} prefix="Masuk ke Anda" className="!text-xs" />
        <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-indigo-700"><Languages className="h-4 w-4" />{sub.lang_from} → {sub.lang_to}</p>
        <ul className="mt-2 space-y-0.5 text-sm text-ink-soft">{docs.map((x, i) => <li key={i}>• {x.desc || sub.title} <span className="text-ink-mute">({x.pages || 1} halaman)</span>{isTr && x.kind === 'non_reguler' && <span className="ml-1.5 rounded-full bg-violet-100 px-2 py-0.5 text-sm font-semibold text-violet-800">Non Reguler</span>}</li>)}</ul>
        {sub.description && sub.description.trim() !== `1. ${sub.title}` && <p className="mt-2 whitespace-pre-line rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">{sub.description}</p>}
      </div>

      <Step n={1} title={cfg.read} done={read || !!uploaded} active={!read && !uploaded}>
        <div className="space-y-2">
          {sources.map(([label, f], i) => <FileRow key={label} label={label} file={f} busy={busy === `dl${i}`}
            onPreview={() => { setPreview(f); setRead(true) }} onDownload={() => download(f, `dl${i}`)} />)}
        </div>
      </Step>

      <Step n={2} title={cfg.upload + (isTr ? '' : ' (opsional)')} done={!!uploaded} active={!uploaded}>
        {uploaded ? (
          <div className="space-y-1.5">
            {upList.map((f, i) => <p key={i} className="flex items-center gap-2 text-base text-emerald-800"><CheckCircle2 className="h-5 w-5 shrink-0" /><span className="truncate">{f.name}</span></p>)}
            <p className="flex gap-4 text-sm font-semibold text-brand">
              <label className="cursor-pointer underline">+ Tambah file<input type="file" multiple className="hidden" onChange={(e) => { const fl = [...e.target.files]; e.target.value = ''; upload(fl) }} aria-label={`Tambah ${cfg.upload}`} /></label>
              <label className="cursor-pointer underline">Ganti semua<input type="file" multiple className="hidden" onChange={(e) => { const fl = [...e.target.files]; e.target.value = ''; upload(fl, true) }} aria-label={`Ganti ${cfg.upload}`} /></label>
            </p>
          </div>
        ) : (
          <label className={cx('flex h-12 w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-brand/60 text-base font-bold text-brand hover:bg-brand-soft', busy && 'pointer-events-none opacity-50')}>
            {busy === 'up' ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}Pilih File (bisa banyak)
            <input type="file" multiple className="hidden" onChange={(e) => { const fl = [...e.target.files]; e.target.value = ''; upload(fl) }} aria-label={cfg.upload} />
          </label>
        )}
        {!isTr && <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Catatan pemeriksaan (opsional)"
          className="mt-3 w-full rounded-xl border-0 p-3 text-base ring-1 ring-slate-300 focus:ring-2 focus:ring-brand" aria-label="Catatan pemeriksaan" />}
      </Step>

      <Step n={3} title={isNT ? 'Selesai → Kembali ke CS' : cfg.next} done={false} active={canNext}>
        {isTr && !isNT && (teamOnly ? (
          <p className="mb-3 rounded-xl bg-slate-50 px-3 py-2.5 text-sm ring-1 ring-slate-200">
            Dikirim ke <b>{proofreaderTeamName()}</b> — sistem memilihkan pemeriksa yang antreannya paling sedikit.
          </p>
        ) : (
          <select value={pr} onChange={(e) => setPr(e.target.value)} aria-label="Proofreader"
            className="mb-3 h-11 w-full rounded-xl border-0 px-3 text-sm ring-1 ring-slate-300 focus:ring-2 focus:ring-brand">
            <option value="">— Pilih proofreader —</option>
            {proofreaders.map((u) => <option key={u.id} value={u.id}>{u.name} · {placeOf(u)}</option>)}
          </select>
        ))}
        <Big onClick={next} disabled={!canNext || !!busy} className="bg-emerald-600 text-white hover:bg-emerald-700">
          {busy === 'next' ? <Loader2 className="h-6 w-6 animate-spin" /> : <Send className="h-6 w-6" />}{isNT ? 'Selesai → Kembali ke CS' : cfg.next}
        </Big>
        {isTr && !uploaded && <p className="mt-2 text-center text-sm text-ink-mute">Upload hasil terjemahan dulu.</p>}
      </Step>

      {preview && <FilePreview file={preview} onClose={() => setPreview(null)} />}
      {namerDialog}
    </div>
  )
}
