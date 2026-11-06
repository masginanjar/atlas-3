import { useState } from 'react'
import { Play, Send, FolderOpen, Hand, CheckCircle2, FileText, Upload, Loader2, Circle, Inbox, Building2, Headset, Printer, Eye, Download, ChevronDown } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { can, activeClaim, placeOf, seeProofreaderIdentity, proofreaderTeamName, pickProofreader, invoiceLabel} from '../config/access.js'
import { flowOf, stagesOf } from '../config/workflows.js'
import { SUB_TYPES } from '../config/subtypes.js'
import FileManager, { fieldFiles, uploadProjectFiles, collect } from './FileManager.jsx'
import FilePreview from './FilePreview.jsx'
import { useUploadNamer } from './UploadNamer.jsx'
import { PriorityBadge } from './Priority.jsx'
import { DeadlineCell } from './badges.jsx'
import CopyText from './CopyText.jsx'
import { drive } from '../lib/integrations.js'
import { saveBlob, dataUrlToBlob } from '../lib/download.js'
import { Button, Card, Empty, Sheet, cx } from './ui.jsx'

// Tahap yang dikerjakan tiap role pelaksana — tombolnya tampil langsung di My Project
export const WORK_STAGES = { penerjemah: ['penerjemahan'], proofreader: ['proofread'], otorisator: ['otorisasi'] }
export const isWorkRole = (user) => !!WORK_STAGES[user?.role]
/** Nama CS pembuat project, tanpa keterangan cabang dalam kurung. */
const csName = (p) => (p.about?.cs_name || '').replace(/\s*\(.*\)\s*$/, '')
/** Kolom file hasil yang diunggah pelaksana di tahap ini. */
const fileKeyOf = (stage) => (stage.fields.find((f) => f.type === 'file' && f.required) || stage.fields.find((f) => f.type === 'file'))?.key || ''
/** Isian "pilih orang" wajib (mis. Proofreader) → dropdown kecil, tampil sama di baris & pop-up. */
const pickFieldOf = (stage) => stage.fields.find((f) => String(f.type).startsWith('user:'))
/** Isian catatan (teks) di tahap ini. */
const noteFieldOf = (stage) => stage.fields.find((f) => f.type === 'text')
/** Dokumen yang perlu dibaca pelaksana di tahap ini. */
const SOURCE_KEYS = { penerjemahan: ['dokumen_sumber'], proofread: ['dokumen_sumber', 'hasil_terjemahan'], otorisasi: ['dokumen_sumber', 'hasil_proofread', 'hasil_terjemahan'] }
const SOURCE_LABEL = { dokumen_sumber: 'Dokumen sumber', hasil_terjemahan: 'Hasil terjemahan', hasil_proofread: 'Hasil proofread' }

/** Sub project di satu project yang menjadi tugas user sekarang. */
export function myWorkSubs(user, project) {
  const keys = WORK_STAGES[user?.role]
  if (!keys) return []
  return (project.sub_projects || []).filter((s) => {
    if (!keys.includes(s.stage)) return false
    const st = stagesOf(flowOf(s, project)).find((x) => x.key === s.stage)
    return !!st && can.processStage(user, st, s, project)
  })
}

/**
 * Satu sumber kebenaran untuk tombol di baris DAN di pop-up — supaya tidak ada aksi ganda.
 * Alur: Mulai → (pop-up dokumen sumber) → Upload hasil → Kirim ke tahap berikutnya.
 */
function useTask(project, sub, onDone) {
  const { user, data, processStage, patchSubData, claimSub, notify } = useApp()
  const [busy, setBusy] = useState(null)
  const stage = stagesOf(flowOf(sub, project)).find((x) => x.key === sub.stage)
  const claim = activeClaim(sub)
  const startKey = `${sub.stage}_work_started_at` // penanda mulai per tahap (tidak terbawa ke tahap berikutnya)
  const started = !!claim || !!sub.data?.[startKey]
  const fileKey = fileKeyOf(stage)
  const files = fileKey ? fieldFiles(sub.data, fileKey) : []
  const pick = pickFieldOf(stage)
  const people = pick ? data.users.filter((u) => u.role === String(pick.type).split(':')[1] && u.active !== false) : null
  // Proofreader tampil sebagai SATU identitas tim untuk pengguna biasa:
  // tidak ada daftar nama, sistem memilih yang antreannya paling sedikit.
  const teamPick = pick && String(pick.type) === 'user:proofreader' && !seeProofreaderIdentity(user)
  const noteField = noteFieldOf(stage)
  const [who, setWho] = useState(() => sub.data?.[pick?.key] || '')
  const [note, setNote] = useState(() => sub.data?.[noteField?.key] || '')
  const sources = (SOURCE_KEYS[sub.stage] || ['dokumen_sumber']).flatMap((k) => fieldFiles(sub.data, k).map((f) => ({ ...f, _label: SOURCE_LABEL[k] || k })))

  const run = async (key, fn, ok) => {
    setBusy(key)
    try { await fn(); if (ok) notify(ok); return true } catch (e) { notify(e.message, 'err'); return false } finally { setBusy(null) }
  }
  const start = () => run('start', async () => {
    if (stage.claimable) await claimSub(project, sub.id, true)
    else await patchSubData(project, sub.id, { [startKey]: new Date().toISOString() }, `Mulai dikerjakan (${stage.label})`)
  }, 'Mulai dikerjakan — dokumen sumber siap diunduh')
  const [reviewNames, namerDialog] = useUploadNamer({ existing: collect(project).map((f) => f.name), invoice: project.invoice_no })
  const upload = async (fileList) => {
    const picked = await reviewNames(fileList) // kesempatan ganti nama file dulu
    if (!picked?.length) return false
    return run('up', async () => {
      const added = await uploadProjectFiles(picked.map(({ file, name }) => ({ file, name, sub_id: sub.id })), { branch: project.branch, invoice: project.invoice_no, by: user.name })
      const all = [...files, ...added]
      await processStage(project, sub.id, { [fileKey]: all[0], [`${fileKey}_list`]: all }, false)
    }, 'Hasil terunggah')
  }
  const target = () => (teamPick ? pickProofreader(data.users, data.projects) : who)
  const values = () => ({ ...(pick ? { [pick.key]: target() } : {}), ...(noteField && note ? { [noteField.key]: note } : {}) })
  const next = async () => {
    const ok = await run('next', () => processStage(project, sub.id, values(), true), `${sub.title} → tahap berikutnya`)
    if (ok) onDone?.()
    return ok
  }
  const blocked = stage.fields.some((f) => f.required && f.type === 'file' && !files.length) ? 'Upload hasil dulu'
    : pick?.required && !(teamPick ? people?.length : who) ? (teamPick ? 'Belum ada proofreader aktif — hubungi Supervisor' : `Pilih ${pick.label} dulu`) : ''
  return { stage, started, claim, files, sources, pick, teamPick, people, who, setWho, noteField, note, setNote, busy, start, upload, next, blocked, namerDialog }
}

/** Tombol Upload (dipakai di baris & pop-up) — selalu lewat dialog ganti nama. */
function UploadBtn({ t, label, big }) {
  const n = t.files.length
  return (
    <label className={cx('inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3 font-semibold ring-1 transition',
      big ? 'h-10 w-full justify-center text-sm' : 'h-8 text-xs',
      n ? 'bg-emerald-50 text-emerald-700 ring-emerald-300 hover:bg-emerald-100' : 'bg-white text-brand ring-brand/40 hover:bg-brand-soft',
      t.busy === 'up' && 'pointer-events-none opacity-60')}
      title={n ? `${n} file terunggah — klik untuk menambah` : 'Upload hasil pekerjaan (bisa beberapa file)'}>
      {t.busy === 'up' ? <Loader2 className="h-4 w-4 animate-spin" /> : n ? <CheckCircle2 className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
      {n ? `${n} file${big ? ' — tambah lagi' : ''}` : label || 'Upload'}
      <input type="file" multiple className="hidden" aria-label={`Upload hasil ${t.stage.label}`} onChange={(e) => { const fl = [...e.target.files]; e.target.value = ''; if (fl.length) t.upload(fl) }} />
    </label>
  )
}

/** Jendela kerja: dokumen sumber → upload hasil → kirim. Isinya sama persis dengan tombol di baris. */
function WorkSheet({ project, sub, t, onClose }) {
  const { notify } = useApp()
  const [preview, setPreview] = useState(null)
  const [allFiles, setAllFiles] = useState(false)
  const [dl, setDl] = useState(null)
  const download = async (f, i) => {
    setDl(i)
    try { await saveBlob(f.name, f.url?.startsWith('data:') ? dataUrlToBlob(f.url) : await drive.blob(f)) } catch (e) { notify(e.message, 'err') } finally { setDl(null) }
  }
  return (
    <Sheet open side onClose={onClose} title={sub.title} subtitle={`${invoiceLabel(project.invoice_no)} · ${project.customer?.name || ''} · ${t.stage.label}`}
      footer={<>
        <Button variant="outline" className="flex-1 sm:flex-none sm:px-6" onClick={onClose}>Tutup</Button>
        <Button className="flex-[2]" variant="dark" loading={t.busy === 'next'} disabled={!!t.blocked}
          onClick={async () => { if (await t.next()) onClose() }}>{t.stage.action} <Send className="h-4 w-4" /></Button>
      </>}>
      <div className="space-y-4">
        {t.blocked && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 ring-1 ring-amber-200">{t.blocked} sebelum menekan “{t.stage.action}”.</p>}

        {/* 1. Dokumen untuk dibaca / diunduh */}
        <section>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-mute">1. Dokumen untuk dikerjakan</p>
          {t.sources.length === 0 ? <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-ink-mute">Belum ada dokumen sumber yang diunggah CS.</p> : (
            <ul className="divide-y divide-slate-100 rounded-xl bg-white ring-1 ring-slate-200">
              {t.sources.map((f, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2 px-3 py-2">
                  <FileText className="h-4 w-4 shrink-0 text-brand" />
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink">{f.name}</span><span className="text-[11px] text-ink-mute">{f._label}</span></span>
                  <Button size="sm" variant="outline" onClick={() => setPreview(f)}><Eye className="h-3.5 w-3.5" />Baca</Button>
                  <Button size="sm" variant="outline" loading={dl === i} onClick={() => download(f, i)}><Download className="h-3.5 w-3.5" />Unduh</Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 2. Upload hasil */}
        <section>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-mute">2. Hasil pekerjaan Anda</p>
          {t.files.length > 0 && (
            <ul className="mb-2 divide-y divide-emerald-100 rounded-xl bg-emerald-50/60 ring-1 ring-emerald-200">
              {t.files.map((f, i) => <li key={i} className="flex items-center gap-2 px-3 py-1.5 text-sm text-emerald-900"><CheckCircle2 className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1 truncate">{f.name}</span><button type="button" onClick={() => setPreview(f)} className="rounded p-1 text-emerald-700 hover:bg-emerald-100" aria-label={`Baca ${f.name}`}><Eye className="h-4 w-4" /></button></li>)}
            </ul>
          )}
          <UploadBtn t={t} big label="Pilih file hasil (bisa beberapa)" />
        </section>

        {/* 3. Isian tahap (proofreader / catatan) */}
        {(t.pick || t.noteField) && (
          <section className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-mute">3. Sebelum dikirim</p>
            {t.pick && (t.teamPick ? (
              <p className="rounded-xl bg-white px-3 py-2.5 text-xs ring-1 ring-slate-200">
                Dikirim ke <b className="text-ink">{proofreaderTeamName()}</b> — sistem memilihkan pemeriksa yang antreannya paling sedikit.
              </p>
            ) : (
              <label className="block text-xs font-semibold text-ink-soft">{t.pick.label}{t.pick.required && <span className="text-rose-500"> *</span>}
                <select value={t.who} onChange={(e) => t.setWho(e.target.value)} className="mt-1 h-10 w-full rounded-xl border-0 bg-white px-3 text-sm ring-1 ring-slate-300 focus:ring-2 focus:ring-brand">
                  <option value="">— Pilih {t.pick.label} —</option>
                  {t.people.map((u) => <option key={u.id} value={u.id}>{u.name} · {placeOf(u)}</option>)}
                </select>
              </label>
            ))}
            {t.noteField && (
              <label className="block text-xs font-semibold text-ink-soft">{t.noteField.label}
                <textarea rows={2} value={t.note} onChange={(e) => t.setNote(e.target.value)} className="mt-1 w-full rounded-xl border-0 p-3 text-sm ring-1 ring-slate-300 focus:ring-2 focus:ring-brand" />
              </label>
            )}
          </section>
        )}

        {/* File project lain — tersembunyi supaya tidak mengganggu */}
        <div>
          <button type="button" onClick={() => setAllFiles((v) => !v)} className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline">
            <ChevronDown className={cx('h-3.5 w-3.5 transition', allFiles && 'rotate-180')} />{allFiles ? 'Sembunyikan' : 'Lihat'} semua file project
          </button>
          {allFiles && <div className="mt-2"><FileManager project={project} readOnly /></div>}
        </div>
      </div>
      {preview && <FilePreview file={preview} onClose={() => setPreview(null)} />}
    </Sheet>
  )
}

/**
 * Papan fokus pelaksana: satu baris = satu dokumen yang ditugaskan kepada saya.
 */
export default function WorkerBoard({ projects }) {
  const { user } = useApp()
  const rows = (projects || []).flatMap((pr) => myWorkSubs(user, pr).map((sub) => ({ pr, sub })))
    .sort((a, b) => new Date(a.pr.about?.deadline || 0) - new Date(b.pr.about?.deadline || 0))
  if (!rows.length) return <Card><Empty icon={Inbox} title="Tidak ada tugas" text="Semua dokumen yang ditugaskan kepada Anda sudah dikerjakan. 🎉" /></Card>
  return (
    <Card className="overflow-visible" data-testid="worker-board">
      <div className="pointer-events-none sticky top-[var(--appbar)] z-10 flex items-center gap-2 rounded-t-2xl border-b border-slate-200 bg-brand-soft/90 px-4 py-2 backdrop-blur">
        <FileText className="h-4 w-4 text-brand" />
        <h2 className="text-[15px] font-bold">Tugas Saya <span className="text-ink-mute">({rows.length})</span></h2>
        <span className="ml-auto hidden text-[11px] text-ink-mute sm:inline">Mulai → Upload hasil → Kirim. Semua dari halaman ini.</span>
      </div>
      <ul className="divide-y divide-slate-200/70 [&>li:last-child]:overflow-hidden [&>li:last-child]:rounded-b-2xl">
        {rows.map(({ pr, sub }, i) => <TaskRow key={sub.id} project={pr} sub={sub} alt={i % 2 === 1} />)}
      </ul>
    </Card>
  )
}

function TaskRow({ project, sub, alt }) {
  const [open, setOpen] = useState(false)
  const t = useTask(project, sub, () => setOpen(false))
  const docList = (sub.docs || []).filter((d) => d?.desc?.trim())
  const pages = docList.reduce((a, d) => a + (Number(d.pages) || 0), 0) || sub.pages || 0
  const steps = [['Mulai', t.started], ['Upload hasil', t.files.length > 0], ['Kirim', false]]

  return (
    <li className={cx('scroll-mt-28 transition', open ? 'bg-brand-soft/70 shadow-[inset_3px_0_0_0_var(--tw-ring-color)] ring-brand' : alt ? 'bg-slate-50/80' : '')}>
      <div className="u-row grid gap-2 px-4 lg:grid-cols-[minmax(0,1.6fr)_104px_minmax(0,1fr)_minmax(0,400px)] lg:items-start lg:gap-3">
        {/* Judul: No. Invoice → pelanggan → layanan → cabang & CS */}
        <div className="min-w-0">
          <p className="text-sm font-bold text-ink"><CopyText text={invoiceLabel(project.invoice_no)} label="No. Invoice" strong /></p>
          <p className="truncate text-xs font-semibold text-ink-soft">{project.customer?.name}</p>
          <p className="truncate text-[11px] text-ink-mute">{(SUB_TYPES[sub.type] || SUB_TYPES.jasa_lain).label}{sub.lang_from ? ` · ${sub.lang_from} → ${sub.lang_to}` : ''}{pages ? ` · ${pages} hlm` : ''}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-ink-mute">
            <span className="inline-flex items-center gap-1" title={`Cabang ${project.branch}`}><Building2 className="h-3 w-3" /><b className="font-semibold text-ink-soft">{project.branch}</b></span>
            {csName(project) && <span className="inline-flex items-center gap-1" title={`CS: ${csName(project)}`}>· <Headset className="h-3 w-3" />{csName(project)}</span>}
            {project.about?.print_location && project.about.print_location !== project.branch && <span className="inline-flex items-center gap-1 font-semibold text-fuchsia-700" title={`Lokasi print: ${project.about.print_location}`}>· <Printer className="h-3 w-3" />{project.about.print_location}</span>}
          </p>
        </div>
        {/* Deadline & prioritas */}
        <div className="flex items-center gap-2 lg:block">
          <DeadlineCell project={project} align="left" />
          <PriorityBadge p={project.about?.priority} className="lg:mt-0.5" />
        </div>
        {/* Progres 3 langkah */}
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
          {steps.map(([label, done], i) => (
            <li key={label} className={cx('inline-flex items-center gap-1 font-semibold', done ? 'text-emerald-700' : 'text-ink-mute')}>
              {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}{i + 1}. {label}
            </li>
          ))}
        </ol>
        {/* Aksi: Mulai → Upload → Kirim (tombol yang sama dengan isi pop-up) */}
        <div className="flex flex-wrap items-center gap-1.5 lg:justify-end">
          {!t.started
            ? <Button size="sm" loading={t.busy === 'start'} title="Tandai mulai dikerjakan, lalu unduh dokumen sumber"
                onClick={async () => { if (await t.start()) setOpen(true) }}>{t.stage.claimable ? <Hand className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}{t.stage.claimable ? 'Ambil' : 'Mulai'}</Button>
            : <UploadBtn t={t} />}
          {t.started && t.pick && (
            <select value={t.who} onChange={(e) => t.setWho(e.target.value)} aria-label={t.pick.label} title={t.pick.label}
              className="h-8 max-w-[150px] rounded-xl border-0 bg-white px-2 text-xs font-semibold ring-1 ring-slate-300 focus:ring-2 focus:ring-brand">
              <option value="">{t.pick.label}…</option>
              {t.people.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
          <button type="button" onClick={() => setOpen(true)} aria-label={`Dokumen & rincian ${sub.title}`} title="Buka jendela kerja: dokumen sumber, hasil, catatan"
            className="grid h-8 w-8 place-items-center rounded-xl bg-white text-ink-soft ring-1 ring-slate-300 hover:bg-ink hover:text-white"><FolderOpen className="h-4 w-4" /></button>
          <Button size="sm" variant="dark" loading={t.busy === 'next'} onClick={() => (t.blocked ? setOpen(true) : t.next())} title={t.blocked || t.stage.action} className="whitespace-nowrap">
            <Send className="h-3.5 w-3.5" />{(t.stage.action || 'Selesai').length > 16 ? 'Kirim →' : t.stage.action}
          </Button>
        </div>
      </div>
      {/* Daftar dokumen — tabel menyamping */}
      <div className="u-hide-compact px-4 pb-3">
        <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-slate-200">
          <table className="w-full min-w-[420px] border-collapse text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-ink-mute">
              <tr><th className="w-8 px-2 py-1.5 text-center font-bold">#</th><th className="px-2 py-1.5 text-left font-bold">Dokumen</th><th className="w-14 px-2 py-1.5 text-center font-bold">Hlm</th><th className="px-2 py-1.5 text-left font-bold">Keterangan</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(docList.length ? docList : [{ desc: sub.title, pages: sub.pages }]).map((d, i) => (
                <tr key={i}>
                  <td className="px-2 py-1.5 text-center font-semibold text-ink-mute">{i + 1}</td>
                  <td className="px-2 py-1.5 font-semibold text-ink">{d.desc}</td>
                  <td className="px-2 py-1.5 text-center tabular-nums">{d.pages || 1}</td>
                  <td className="px-2 py-1.5 text-ink-mute">
                    {d.kind === 'non_reguler' && <span className="mr-1 rounded bg-violet-50 px-1 font-semibold text-violet-700">Non Reguler</span>}
                    {sub.data?.reg_numbers?.[i] && <span className="font-mono text-amber-800">No. Reg {sub.data.reg_numbers[i]}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {t.namerDialog}
      {open && <WorkSheet project={project} sub={sub} t={t} onClose={() => setOpen(false)} />}
    </li>
  )
}

/** Strip aksi ringkas di tampilan daftar project biasa (mode lengkap). */
export function WorkerActions({ project }) {
  const { user } = useApp()
  const subs = myWorkSubs(user, project)
  if (!subs.length) return null
  return (
    <div className="space-y-1.5 border-t border-brand/15 bg-brand-soft/40 px-4 py-2" data-testid="worker-actions">
      {subs.map((s) => <WorkStrip key={s.id} project={project} sub={s} />)}
    </div>
  )
}

function WorkStrip({ project, sub }) {
  const [open, setOpen] = useState(false)
  const t = useTask(project, sub, () => setOpen(false))
  return (
    <div className="flex flex-wrap items-center gap-2">
      <FileText className="h-3.5 w-3.5 shrink-0 text-brand" />
      <span className="min-w-0 flex-1 truncate text-xs"><b className="font-semibold text-ink">{sub.title}</b>
        <span className="ml-1.5 text-ink-mute">{t.stage.label}{sub.lang_from ? ` · ${sub.lang_from} → ${sub.lang_to}` : ''}</span>
        {t.started && <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-px text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200"><CheckCircle2 className="h-3 w-3" />Sedang dikerjakan</span>}
      </span>
      {!t.started
        ? <Button size="sm" loading={t.busy === 'start'} onClick={async () => { if (await t.start()) setOpen(true) }}>{t.stage.claimable ? <Hand className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}{t.stage.claimable ? 'Ambil' : 'Mulai'}</Button>
        : <UploadBtn t={t} />}
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}><FolderOpen className="h-3.5 w-3.5" />Dokumen</Button>
      <Button size="sm" variant="dark" loading={t.busy === 'next'} onClick={() => (t.blocked ? setOpen(true) : t.next())} title={t.blocked || t.stage.action} className="whitespace-nowrap">
        <Send className="h-3.5 w-3.5" />{(t.stage.action || 'Selesai').length > 20 ? 'Kirim →' : t.stage.action}
      </Button>
      {t.namerDialog}
      {open && <WorkSheet project={project} sub={sub} t={t} onClose={() => setOpen(false)} />}
    </div>
  )
}
