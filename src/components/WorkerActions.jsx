import { useState } from 'react'
import { Play, Send, FolderOpen, Hand, CheckCircle2, FileText, Upload, Loader2, Circle, Inbox, Building2, Headset, Printer, Eye, Download, ChevronDown, ChevronRight, Undo2, MapPin } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { TolakTugasBtn } from './GantiPenerjemah.jsx'
import { can, activeClaim, placeOf, seeProofreaderIdentity, pickProofreader, invoiceLabel } from '../config/access.js'
import { flowOf, stagesOf } from '../config/workflows.js'
import { SUB_TYPES } from '../config/subtypes.js'
import { fieldFiles, uploadProjectFiles, collect } from './FileManager.jsx'
import FilePreview from './FilePreview.jsx'
import { useUploadNamer } from './UploadNamer.jsx'
import { PriorityBadge } from './Priority.jsx'
import { DEADLINE_H1_ROLES, InvoiceNo } from './badges.jsx'
import CopyText from './CopyText.jsx'
import { drive } from '../lib/integrations.js'
import { StagePanel } from '../pages/ProjectDetail.jsx'
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
// Dokumen yang dibaca tiap tahap (alur 8 Nov 2026):
//  penerjemah : dokumen sumber
//  proofreader: dokumen sumber + hasil terjemahan
//  otorisator : dokumen sumber + hasil proofreader (bila belum ada: hasil terjemahan)
const SOURCE_KEYS = { penerjemahan: ['dokumen_sumber'], proofread: ['dokumen_sumber', 'hasil_terjemahan'], otorisasi: ['dokumen_sumber', 'hasil_proofread'] }
const SOURCE_LABEL = { dokumen_sumber: 'Dokumen sumber', hasil_terjemahan: 'Hasil terjemahan', hasil_proofread: 'Hasil proofreader' }
export const sumberTahap = (sub) => {
  const keys = SOURCE_KEYS[sub.stage] || ['dokumen_sumber']
  const out = keys.flatMap((k) => fieldFiles(sub.data, k).map((f) => ({ ...f, _label: SOURCE_LABEL[k] || k })))
  if (sub.stage === 'otorisasi' && !fieldFiles(sub.data, 'hasil_proofread').length) out.push(...fieldFiles(sub.data, 'hasil_terjemahan').map((f) => ({ ...f, _label: 'Hasil terjemahan (proofreader tidak mengunggah file)' })))
  return out
}

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
  const sources = sumberTahap(sub)

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
  /** Ganti satu file hasil (salah upload) — file lama diganti di posisi yang sama. */
  const replace = async (index, fileList) => {
    const picked = await reviewNames([fileList[0]])
    if (!picked?.length) return false
    return run('up', async () => {
      const added = await uploadProjectFiles(picked.map(({ file, name }) => ({ file, name, sub_id: sub.id })), { branch: project.branch, invoice: project.invoice_no, by: user.name })
      const all = files.map((f, i) => (i === index ? added[0] : f))
      await processStage(project, sub.id, { [fileKey]: all[0], [`${fileKey}_list`]: all }, false)
    }, 'File hasil diganti')
  }
  const remove = (index) => run('up', async () => {
    const all = files.filter((_, i) => i !== index)
    await processStage(project, sub.id, { [fileKey]: all[0] || null, [`${fileKey}_list`]: all }, false)
  }, 'File hasil dihapus')
  const target = () => (teamPick ? pickProofreader(data.users, data.projects) : who)
  const values = () => ({ ...(pick ? { [pick.key]: target() } : {}), ...(noteField && note ? { [noteField.key]: note } : {}) })
  const next = async () => {
    const keOtorisasiSelesai = stage.key === 'otorisasi'
    const ok = await run('next', () => processStage(project, sub.id, values(), true), keOtorisasiSelesai ? `${sub.title} di-ACC — isi nomor registrasi` : `${sub.title} → tahap berikutnya`)
    // Setelah ACC otorisasi, jendela tetap terbuka: form nomor registrasi langsung muncul
    if (ok && !keOtorisasiSelesai) onDone?.()
    return ok
  }
  const blocked = stage.fields.some((f) => f.required && f.type === 'file' && !files.length) ? 'Upload hasil dulu'
    : pick?.required && !(teamPick ? people?.length : who) ? (teamPick ? 'Belum ada proofreader aktif — hubungi Direktur' : `Pilih ${pick.label} dulu`) : ''
  return { stage, started, claim, files, sources, pick, teamPick, people, who, setWho, noteField, note, setNote, busy, start, upload, replace, remove, next, blocked, namerDialog }
}

/** Kotak deadline di atas lembar kerja: batas (H-1 untuk pelaksana) + sisa waktu. */
function KotakDeadline({ project }) {
  const { user } = useApp()
  const batas = batasTugas(project, user)
  if (!batas) return null
  const selisih = batas - Date.now(); const telat = selisih < 0; const abs = Math.abs(selisih)
  const hari = Math.floor(abs / 864e5), jam = Math.floor((abs % 864e5) / 3600e3), mnt = Math.floor((abs % 3600e3) / 6e4)
  const durasi = hari >= 1 ? `${hari} hari ${jam} jam` : jam >= 1 ? `${jam} jam ${mnt} menit` : `${Math.max(1, mnt)} menit`
  const d = new Date(batas); const hariIni = hariWita(d) === hariWita()
  const tgl = `${hariIni ? 'hari ini' : `${d.getUTCDate()} ${BLN_PENDEK[d.getUTCMonth()]}`} ${String(project.about?.deadline_time || '17:00').replace(':', '.')}`
  return (
    <p className={cx('rounded-xl px-3 py-2 text-xs ring-1', telat ? 'bg-rose-50 text-rose-900 ring-rose-200' : hariIni ? 'bg-amber-50 text-amber-900 ring-amber-200' : 'bg-slate-50 text-ink-soft ring-slate-200')} data-kotak-deadline>
      Deadline <b className="font-bold">{tgl}</b> · {telat ? <b className="font-bold">terlambat {durasi}</b> : <>sisa {durasi}</>}{(project.about?.priority || 'Normal') !== 'Normal' ? ` · ${project.about.priority}` : ''}
    </p>
  )
}

/** Proofreader/Otorisator: Sumber & Terjemahan berdampingan (dua ubin), tombol baca keduanya. */
function Bandingkan({ berkas, onBaca }) {
  const sumber = berkas.filter((f) => f._label === 'Dokumen sumber')
  const hasil = berkas.filter((f) => f._label !== 'Dokumen sumber')
  if (!sumber.length || !hasil.length) return null
  const ubin = (judul, f, aksen) => (
    <button type="button" onClick={() => onBaca(f)} className={cx('flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-2 text-left ring-1', aksen ? 'bg-blue-50 ring-blue-200' : 'bg-white ring-slate-200')} data-aksi="bandingkan">
      <FileText className={cx('h-4 w-4 shrink-0', aksen ? 'text-blue-700' : 'text-ink-mute')} />
      <span className="min-w-0"><span className="block text-xs font-bold text-ink">{judul}</span><span className="block truncate text-[11px] text-ink-mute">{f.name}</span></span>
    </button>
  )
  return (
    <section data-bandingkan>
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-mute">Bandingkan</p>
      <div className="flex gap-2">{ubin('Sumber', sumber[0], false)}{ubin(hasil[0]._label.replace(/ \(.*\)$/, ''), hasil[0], true)}</div>
    </section>
  )
}

/** Kembalikan dokumen ke penerjemah untuk diperbaiki (proofreader/otorisator). */
function KembalikanBtn({ project, sub, onDone }) {
  const { kembalikanKePenerjemah, notify } = useApp()
  const [buka, setBuka] = useState(false)
  const [catatan, setCatatan] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const kirim = async () => {
    setSibuk(true)
    try { await kembalikanKePenerjemah(project, sub.id, catatan); notify('Dikembalikan ke penerjemah — penerjemah sudah diberi tahu'); setBuka(false); setCatatan(''); onDone?.() }
    catch (e) { notify(e.message, 'err') } finally { setSibuk(false) }
  }
  if (!buka) return <Button variant="outline" className="w-full !text-amber-800 !ring-amber-300 hover:!bg-amber-50" onClick={() => setBuka(true)} data-aksi="kembalikan-penerjemah"><Undo2 className="h-4 w-4" />Kembalikan ke penerjemah</Button>
  return (
    <div className="space-y-2 rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200" data-form-kembalikan>
      <p className="text-xs font-semibold text-amber-900">Apa yang perlu diperbaiki penerjemah?</p>
      <textarea rows={3} value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="mis. nama pada halaman 2 belum sesuai dokumen sumber" className="w-full rounded-xl border-0 p-3 text-sm ring-1 ring-amber-300 focus:ring-2 focus:ring-amber-500" />
      <div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={() => setBuka(false)}>Batal</Button><Button className="flex-[2] !bg-amber-600 hover:!bg-amber-700" loading={sibuk} onClick={kirim}>Kembalikan</Button></div>
    </div>
  )
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
  // Tahap Nomor Registrasi tidak memakai upload hasil — pakai form nomor (sama dengan di detail project)
  if (t.stage.key === 'registrasi') {
    return (
      <Sheet open side onClose={onClose} title={sub.title} subtitle={`${invoiceLabel(project.invoice_no)} · ${project.customer?.name || ''} · ${t.stage.label}`}
        footer={<Button variant="outline" className="flex-1 sm:flex-none sm:px-6" onClick={onClose}>Tutup</Button>}>
        <div className="-mx-4" data-form-registrasi><StagePanel project={project} sub={sub} stage={t.stage} /></div>
      </Sheet>
    )
  }
  return <WorkSheetBerkas project={project} sub={sub} t={t} onClose={onClose} />
}

function WorkSheetBerkas({ project, sub, t, onClose }) {
  const { notify } = useApp()
  const [preview, setPreview] = useState(null)
  const [dl, setDl] = useState(null)
  // hanya dokumen tahap ini (sumber + hasil tahap sebelumnya) — file sub project lain tidak ikut
  const berkas = t.sources.map((f) => ({ ...f, _sumber: true }))
  // Pilih dokumen tertentu untuk diunduh sekaligus; kosong = semua
  const [pilih, setPilih] = useState(() => new Set())
  const terpilih = pilih.size ? berkas.filter((_, i) => pilih.has(i)) : berkas
  const semuaDipilih = pilih.size === berkas.length && berkas.length > 0
  const togglePilih = (i) => setPilih((v) => { const n = new Set(v); n.has(i) ? n.delete(i) : n.add(i); return n })
  const toggleSemua = () => setPilih(semuaDipilih ? new Set() : new Set(berkas.map((_, i) => i)))
  const download = async (f, i) => {
    setDl(i)
    try { await saveBlob(f.name, f.url?.startsWith('data:') ? dataUrlToBlob(f.url) : await drive.blob(f)) } catch (e) { notify(e.message, 'err') } finally { setDl(null) }
  }
  const unduhZip = async () => {
    setDl('zip')
    try {
      const JSZip = (await import('jszip')).default; const zip = new JSZip(); const used = new Set(); let lewat = 0
      for (const f of terpilih) {
        let blob; try { blob = f.url?.startsWith('data:') ? dataUrlToBlob(f.url) : await drive.blob(f) } catch { lewat++; continue }
        let path = f.name; let k = 1
        while (used.has(path)) path = f.name.replace(/(\.[^.]+)?$/, ` (${k++})$1`)
        used.add(path); zip.file(path, blob)
      }
      if (!used.size) throw new Error('Tidak ada file yang bisa dikemas')
      await saveBlob(`${invoiceLabel(project.invoice_no)} - ${sub.title}.zip`.replace(/[\\/:*?"<>|]/g, '-'), await zip.generateAsync({ type: 'blob' }))
      if (lewat) notify(`${lewat} file dilewati (tidak tersedia)`, 'err')
    } catch (e) { notify(e.message, 'err') } finally { setDl(null) }
  }
  return (
    <Sheet open side onClose={onClose} title={sub.title} subtitle={`${invoiceLabel(project.invoice_no)} · ${project.customer?.name || ''} · ${t.stage.label}`}
      footer={<>
        <Button variant="outline" className="flex-1 sm:flex-none sm:px-6" onClick={onClose}>Tutup</Button>
        <Button className="flex-[2]" variant="dark" loading={t.busy === 'next'} disabled={!!t.blocked}
          onClick={async () => { const ok = await t.next(); if (ok && t.stage.key !== 'otorisasi') onClose() }}>{t.stage.action} <Send className="h-4 w-4" /></Button>
      </>}>
      <div className="space-y-4">
        <KotakDeadline project={project} />
        {t.blocked && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 ring-1 ring-amber-200">{t.blocked} sebelum menekan “{t.stage.action}”.</p>}
        {sub.data?.perbaikan_note && t.stage.key === 'penerjemahan' && (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-900 ring-1 ring-rose-200" data-catatan-perbaikan><b className="font-semibold">Dikembalikan oleh {sub.data.perbaikan_name}</b>{sub.data.perbaikan_count > 1 ? ` · perbaikan ke-${sub.data.perbaikan_count}` : ''}: {sub.data.perbaikan_note}</p>
        )}
        <Bandingkan berkas={berkas} onBaca={setPreview} />

        {/* 1. File project — satu per satu, bisa dibaca/diunduh sendiri-sendiri (file hasil tahap ini tidak ikut) */}
        <section>
          <div className="mb-1.5 flex items-center gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-mute">1. Dokumen untuk dikerjakan</p>
            {berkas.length > 1 && (
              <div className="ml-auto flex items-center gap-2">
                <label className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-ink-soft" title="Pilih semua dokumen">
                  <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand" checked={semuaDipilih} onChange={toggleSemua} data-aksi="pilih-semua-dokumen" />Semua
                </label>
                <Button size="sm" variant="outline" loading={dl === 'zip'} onClick={unduhZip} data-aksi="unduh-zip" title={pilih.size && !semuaDipilih ? 'Unduh dokumen yang dicentang' : 'Unduh semua dokumen'}>
                  <Download className="h-3.5 w-3.5" /><span className="whitespace-nowrap">{pilih.size && !semuaDipilih ? `Unduh ${pilih.size} (ZIP)` : <><span className="hidden sm:inline">Unduh semua </span><span className="sm:hidden">Semua </span>(ZIP)</>}</span>
                </Button>
              </div>
            )}
          </div>
          {berkas.length === 0 ? <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-ink-mute">Belum ada dokumen sumber yang diunggah CS.</p> : (
            <ul className="divide-y divide-slate-100 rounded-xl bg-white ring-1 ring-slate-200" data-berkas-kerja>
              {berkas.map((f, i) => (
                <li key={f.key || i} className={cx('flex items-center gap-2 px-3 py-2', pilih.has(i) && 'bg-brand-soft/50')}>
                  {berkas.length > 1 && <input type="checkbox" className="h-4 w-4 shrink-0 rounded border-slate-300 text-brand focus:ring-brand" checked={pilih.has(i)} onChange={() => togglePilih(i)} aria-label={`Pilih ${f.name}`} data-aksi="pilih-dokumen" />}
                  <FileText className={cx('h-4 w-4 shrink-0', f._sumber ? 'text-brand' : 'text-ink-mute')} />
                  <span className="min-w-0 flex-1 basis-24"><span className="block truncate text-sm font-semibold text-ink">{f.name}</span><span className="text-[11px] text-ink-mute">{f._label}</span></span>
                  <Button size="sm" variant="outline" onClick={() => setPreview(f)} aria-label={`Baca ${f.name}`} className="!h-9 !px-2.5"><Eye className="h-4 w-4" /><span className="hidden sm:inline">Baca</span></Button>
                  <Button size="sm" variant="outline" loading={dl === i} onClick={() => download(f, i)} aria-label={`Unduh ${f.name}`} className="!h-9 !px-2.5"><Download className="h-4 w-4" /><span className="hidden sm:inline">Unduh</span></Button>
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
              {t.files.map((f, i) => <li key={i} className="flex items-center gap-2 px-3 py-1.5 text-sm text-emerald-900"><CheckCircle2 className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1 truncate">{f.name}</span><button type="button" onClick={() => setPreview(f)} className="rounded p-1 text-emerald-700 hover:bg-emerald-100" aria-label={`Baca ${f.name}`}><Eye className="h-4 w-4" /></button>
                <label className="cursor-pointer rounded-lg px-2 py-1 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-300 hover:bg-emerald-100" title="Salah upload? Ganti dengan file lain" data-aksi="ganti-file">Ganti<input type="file" className="hidden" aria-label={`Ganti ${f.name}`} onChange={(e) => { const fl = [...e.target.files]; e.target.value = ''; if (fl.length) t.replace(i, fl) }} /></label>
                <button type="button" onClick={() => t.remove(i)} className="rounded-lg px-2 py-1 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50" aria-label={`Hapus ${f.name}`} data-aksi="hapus-file">Hapus</button></li>)}
            </ul>
          )}
          <UploadBtn t={t} big label="Pilih file hasil (bisa beberapa)" />
        </section>

        {/* 3. Isian tahap (proofreader / catatan) */}
        {t.pick && t.teamPick && (
          <section>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-mute">3. Serahkan ke</p>
            <p className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-slate-200"><span className="min-w-0 flex-1"><span className="block font-semibold">Tim Proofreader</span><span className="block text-[11px] text-ink-mute">dipilih otomatis (antrean paling sedikit)</span></span><span className={cx('rounded-full px-2 py-0.5 text-[10px] font-bold', t.people?.length ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800')}>{t.people?.length ? 'siap' : 'belum ada'}</span></p>
          </section>
        )}
        {((t.pick && !t.teamPick) || t.noteField) && (
          <section className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-mute">{t.pick && t.teamPick ? 'Catatan' : '3. Sebelum dikirim'}</p>
            {t.pick && !t.teamPick && (
              <label className="block text-xs font-semibold text-ink-soft">{t.pick.label}{t.pick.required && <span className="text-rose-500"> *</span>}
                <select value={t.who} onChange={(e) => t.setWho(e.target.value)} className="mt-1 h-10 w-full rounded-xl border-0 bg-white px-3 text-sm ring-1 ring-slate-300 focus:ring-2 focus:ring-brand">
                  <option value="">— Pilih {t.pick.label} —</option>
                  {t.people.map((u) => <option key={u.id} value={u.id}>{u.name} · {placeOf(u)}</option>)}
                </select>
              </label>
            )}
            {t.noteField && (
              <label className="block text-xs font-semibold text-ink-soft">{t.noteField.label}
                <textarea rows={2} value={t.note} onChange={(e) => t.setNote(e.target.value)} className="mt-1 w-full rounded-xl border-0 p-3 text-sm ring-1 ring-slate-300 focus:ring-2 focus:ring-brand" />
              </label>
            )}
          </section>
        )}

        {/* Tidak sanggup mengerjakan? kembalikan ke Direktur dengan alasan */}
        <TolakTugasBtn project={project} sub={sub} blok onDone={onClose} />
        {/* Proofreader / Otorisator: hasil belum layak → kembalikan ke penerjemah dengan catatan */}
        {['proofread', 'otorisasi'].includes(t.stage.key) && <KembalikanBtn project={project} sub={sub} onDone={onClose} />}

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
  const [saring, setSaring] = useState('semua')
  const semua = (projects || []).flatMap((pr) => myWorkSubs(user, pr).map((sub) => ({ pr, sub })))
    .sort((a, b) => new Date(a.pr.about?.deadline || 0) - new Date(b.pr.about?.deadline || 0))
  const batasOf = (pr) => batasTugas(pr, user)
  const hariIni = hariWita()
  const kel = {
    semua: () => true,
    terlambat: ({ pr }) => (batasOf(pr) || Infinity) < Date.now(),
    hariini: ({ pr }) => batasOf(pr) && hariWita(new Date(batasOf(pr))) === hariIni,
    dikerjakan: ({ sub }) => !!(activeClaim(sub) || sub.data?.[`${sub.stage}_work_started_at`]),
    bersama: ({ sub }) => sub.stage === 'otorisasi' && !activeClaim(sub),
    ambil: ({ sub }) => sub.stage === 'otorisasi' && activeClaim(sub)?.by === user.id,
    registrasi: ({ sub }) => sub.stage === 'registrasi',
  }
  const chips = user.role === 'otorisator'
    ? [['semua', 'Semua'], ['bersama', 'To-do bersama'], ['ambil', 'Saya ambil'], ['registrasi', 'No. registrasi'], ['terlambat', 'Terlambat']]
    : [['semua', 'Semua'], ['terlambat', 'Terlambat'], ['hariini', 'Hari ini'], ['dikerjakan', 'Sedang dikerjakan']]
  const rows = semua.filter(kel[saring] || kel.semua)
  if (!semua.length) return <Card><Empty icon={Inbox} title="Tidak ada tugas" text="Semua dokumen yang ditugaskan kepada Anda sudah dikerjakan. 🎉" /></Card>
  return (
    <Card className="overflow-visible" data-testid="worker-board">
      <div className="sticky top-[var(--appbar)] z-10 rounded-t-2xl border-b border-slate-200 bg-brand-soft/90 px-3 py-2 backdrop-blur sm:px-4">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 shrink-0 text-brand" />
          <h2 className="min-w-0 text-[15px] font-bold">Tugas Saya <span className="text-ink-mute">({rows.length}{rows.length !== semua.length ? ` dari ${semua.length}` : ''})</span></h2>
        </div>
        <div className="-mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]" role="tablist" aria-label="Saring tugas" data-chip-tugas>
          {chips.map(([k, l]) => { const n = semua.filter(kel[k]).length; if (k !== 'semua' && !n) return null; return (
            <button key={k} type="button" role="tab" aria-selected={saring === k} onClick={() => setSaring(k)} data-chip={k}
              className={cx('flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold ring-1 transition', saring === k ? (k === 'terlambat' ? 'bg-rose-600 text-white ring-rose-600' : 'bg-ink text-white ring-ink') : k === 'terlambat' ? 'bg-rose-50 text-rose-700 ring-rose-200' : 'bg-white text-ink-soft ring-slate-200 hover:ring-brand')}>
              {l}<span className={cx('tabular-nums', saring === k ? 'text-white/70' : 'text-ink-mute')}>{n}</span>
            </button>
          ) })}
        </div>
      </div>
      {/* Satu tampilan untuk semua tim produksi: list kartu, tiap kolom maksimal 2 baris */}
      <ul className="max-lg:pb-1 lg:divide-y lg:divide-slate-200/70 lg:[&>li:last-child]:overflow-hidden lg:[&>li:last-child]:rounded-b-2xl">
        {rows.length === 0 && <li className="px-4 py-8 text-center text-sm text-ink-mute">Tidak ada tugas pada saringan ini.</li>}
        {rows.map(({ pr, sub }, i) => <TaskRow key={sub.id} project={pr} sub={sub} alt={i % 2 === 1} />)}
      </ul>
    </Card>
  )
}

const BLN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const hariWita = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(d)

/** Waktu batas tugas pelaksana (ms) — H-1 untuk penerjemah/proofreader/otorisator kecuali Sameday. */
export function batasTugas(project, user) {
  const asli = project?.about?.deadline; if (!asli) return null
  const geser = DEADLINE_H1_ROLES.includes(user?.role) && (project?.about?.priority || 'Normal') !== 'Sameday'
  const iso = geser ? new Date(new Date(asli).getTime() - 864e5).toISOString() : asli
  const [hh, mm] = String(project?.about?.deadline_time || '17:00').split(':').map(Number)
  return new Date(`${hariWita(new Date(iso))}T${String(hh).padStart(2, '0')}:${String(mm || 0).padStart(2, '0')}:00+08:00`).getTime()
}

/** Deadline / Jam untuk baris tugas: atas tanggal, bawah jam (+ status terlambat/hari ini). Pelaksana melihat deadline internal H-1 (kecuali Sameday). */
function DeadlineJam({ project }) {
  const { user } = useApp()
  const prio = project?.about?.priority || 'Normal'
  const sameday = prio === 'Sameday'
  const geser = DEADLINE_H1_ROLES.includes(user?.role) && !sameday
  const asli = project?.about?.deadline
  if (!asli) return <div className="text-xs text-ink-mute">—</div>
  const iso = geser ? new Date(new Date(asli).getTime() - 864e5).toISOString() : asli
  const w = new Date(new Date(iso).getTime() + 8 * 3600e3)
  const jam = (project?.about?.deadline_time || '17:00')
  // Waktu deadline sebenarnya (tanggal WITA + jam) → durasi tersisa / keterlambatan
  const [hh, mm] = jam.split(':').map(Number)
  const batas = new Date(`${hariWita(new Date(iso))}T${String(hh).padStart(2, '0')}:${String(mm || 0).padStart(2, '0')}:00+08:00`)
  const selisih = batas - Date.now()
  const telat = selisih < 0
  const abs = Math.abs(selisih)
  const hari = Math.floor(abs / 864e5), jamSisa = Math.floor((abs % 864e5) / 3600e3), menit = Math.floor((abs % 3600e3) / 6e4)
  const durasi = hari >= 1 ? `${hari} hari${jamSisa ? ` ${jamSisa} jam` : ''}` : jamSisa >= 1 ? `${jamSisa} jam${menit ? ` ${menit} mnt` : ''}` : `${Math.max(1, menit)} mnt`
  const hariIni = hariWita(batas) === hariWita()
  const ket = telat ? `Terlambat ${durasi}` : `${hariIni ? 'Hari ini · ' : ''}sisa ${durasi}`
  const tone = telat || hariIni ? 'text-rose-600' : abs < 2 * 864e5 ? 'text-orange-500' : 'text-ink'
  return (
    <div className="min-w-0 leading-tight" title={geser ? `Deadline internal (H-1). Deadline ke pelanggan: ${new Date(asli).getDate()} ${BLN_PENDEK[new Date(asli).getMonth()]}` : undefined} data-deadline={geser ? 'h1' : sameday ? 'sameday' : 'asli'}>
      <p className={cx('truncate text-sm font-bold', tone)}>{w.getUTCDate()} {BLN_PENDEK[w.getUTCMonth()]} · {jam.replace(':', '.')}</p>
      <p className={cx('truncate text-xs', telat || hariIni ? cx('font-semibold', tone) : 'text-ink-mute')}>{ket}</p>
    </div>
  )
}

function TaskRow({ project, sub, alt }) {
  const { nameOf } = useApp()
  const [open, setOpen] = useState(false)
  const [rinci, setRinci] = useState(false)
  const t = useTask(project, sub, () => setOpen(false))
  const docList = (sub.docs || []).filter((d) => d?.desc?.trim())
  const daftar = docList.length ? docList : [{ desc: sub.title, pages: sub.pages, kind: sub.kind }]
  const pages = daftar.reduce((a, d) => a + (Number(d.pages) || 0), 0) || sub.pages || 0
  const jenis = (SUB_TYPES[sub.type] || SUB_TYPES.jasa_lain).label
  return (
    <li className={cx('scroll-mt-28 transition max-lg:mx-2.5 max-lg:my-2 max-lg:overflow-hidden max-lg:rounded-2xl max-lg:ring-1', open ? 'bg-brand-soft/70 shadow-[inset_3px_0_0_0_var(--tw-ring-color)] ring-brand' : t.started ? 'max-lg:ring-brand/70' : 'max-lg:ring-slate-300', !open && (alt ? 'bg-slate-100 lg:bg-slate-50/80' : 'bg-white'))} data-tugas-baris data-aktif={t.started ? '1' : undefined}>
      {/* Baris ringkas, tiap kolom 2 baris (atas/bawah):
          No. invoice / Arah bahasa · Nama / Prioritas · Deadline / Jam · ▸ rincian dokumen · aksi */}
      {/* Desktop: grid 5 kolom */}
      <div className="hidden gap-x-3 gap-y-1.5 px-4 py-2.5 lg:grid lg:grid-cols-[minmax(150px,1fr)_minmax(0,1.4fr)_215px_44px_auto] lg:items-center">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-ink"><CopyText text={invoiceLabel(project.invoice_no)} label="No. Invoice" strong /></p>
          <p className="truncate text-xs text-ink-mute" title={jenis}>{sub.lang_from ? <>{sub.lang_from} <span aria-hidden>→</span> <span className="font-semibold text-ink-soft">{sub.lang_to}</span></> : jenis}</p>
        </div>
        <div className="min-w-0">
          <p className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-ink"><span className="truncate">{project.customer?.name}</span>{project.branch && <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-sky-50 px-1.5 py-px text-[11px] font-semibold text-sky-700 ring-1 ring-sky-200" title="Kota cabang" data-kota-cabang><MapPin className="h-3 w-3" />{project.branch}</span>}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-mute"><PriorityBadge p={project.about?.priority} /><span className="truncate">{daftar.length} dok · {pages} hlm</span></p>
        </div>
        <DeadlineJam project={project} />
        <button type="button" onClick={() => setRinci((v) => !v)} aria-expanded={rinci} aria-label={rinci ? 'Tutup rincian dokumen' : 'Lihat rincian dokumen'} title="Rincian dokumen" data-aksi="rincian-dokumen"
          className={cx('grid h-11 w-11 shrink-0 place-items-center rounded-xl ring-1 transition lg:justify-self-center', rinci ? 'bg-brand-soft text-brand ring-brand' : 'bg-white text-ink-soft ring-slate-200 hover:bg-slate-50')}>
          <ChevronRight className={cx('h-4 w-4 transition-transform', rinci && 'rotate-90')} />
        </button>
        <AksiTugas t={t} project={project} sub={sub} setOpen={setOpen} className="lg:justify-end" />
      </div>
      {/* HP: kartu 4 baris — invoice · prioritas · deadline / nama / arah · dok · hlm / status, lalu tombol */}
      <div className="space-y-1 px-3 py-2.5 lg:hidden" data-kartu-tugas>
        <div className="flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5"><InvoiceNo project={project} /><PriorityBadge p={project.about?.priority} /></div>
          <div className="w-[118px] shrink-0 text-right [&>div>p]:text-right"><DeadlineJam project={project} /></div>
        </div>
        <p className="flex min-w-0 items-center gap-1.5 text-[13px] font-bold text-ink"><span className="truncate">{project.customer?.name}</span>{project.branch && <span className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-sky-50 px-1.5 py-px text-[11px] font-semibold text-sky-700 ring-1 ring-sky-200" title="Kota cabang" data-kota-cabang><MapPin className="h-3 w-3" />{project.branch}</span>}</p>
        <p className="truncate text-xs text-ink-mute">{sub.lang_from ? <>{sub.lang_from} → <span className="font-semibold text-ink-soft">{sub.lang_to}</span></> : jenis} · {daftar.length} dok · {pages} hlm{t.stage.key !== 'penerjemahan' && (sub.data?.translator || sub.translator) ? <> · dari <b className="font-semibold text-ink-soft">{nameOf(sub.data?.translator || sub.translator)}</b></> : ''}</p>
        <StatusTugas t={t} sub={sub} />
        <div className="flex items-center gap-1.5 pt-1">
          <AksiTugas t={t} project={project} sub={sub} setOpen={setOpen} hp className="min-w-0 flex-1" />
          <button type="button" onClick={() => setRinci((v) => !v)} aria-expanded={rinci} aria-label={rinci ? 'Tutup rincian dokumen' : 'Lihat rincian dokumen'} data-aksi="rincian-dokumen"
            className={cx('grid h-11 w-11 shrink-0 place-items-center rounded-xl ring-1 transition', rinci ? 'bg-brand-soft text-brand ring-brand' : 'bg-white text-ink-soft ring-slate-200')}>
            <ChevronDown className={cx('h-4 w-4 transition-transform', rinci && 'rotate-180')} />
          </button>
        </div>
      </div>
      {rinci && (
        <div className="px-4 pb-3" data-rincian-dokumen>
          <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-slate-200">
            <table className="w-full min-w-[320px] border-collapse text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-ink-mute">
                <tr><th className="px-3 py-1.5 text-left font-bold">Deskripsi Dokumen</th><th className="w-28 px-3 py-1.5 text-left font-bold">Dok</th><th className="w-14 px-3 py-1.5 text-center font-bold">Hal</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {daftar.map((d, i) => (
                  <tr key={i}>
                    <td className="px-3 py-1.5 font-semibold text-ink">{d.desc}{sub.data?.reg_numbers?.[i] && <span className="ml-1.5 font-mono text-[11px] text-amber-800">No. Reg {sub.data.reg_numbers[i]}</span>}</td>
                    <td className="px-3 py-1.5 text-ink-mute">{d.kind === 'non_reguler' ? <span className="rounded bg-violet-50 px-1 font-semibold text-violet-700">Non Reguler</span> : 'Reguler'}</td>
                    <td className="px-3 py-1.5 text-center tabular-nums">{d.pages || 1}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50/60"><td className="px-3 py-1.5 text-ink-mute">{jenis}</td><td className="px-3 py-1.5 font-semibold text-ink-soft">{daftar.length} dok</td><td className="px-3 py-1.5 text-center font-semibold tabular-nums">{pages}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
      {t.namerDialog}
      {open && <WorkSheet project={project} sub={sub} t={t} onClose={() => setOpen(false)} />}
    </li>
  )
}

/** Status satu baris di kartu HP: Belum dimulai / Sedang dikerjakan · mulai HH.mm / To-do bersama / diambil Anda. */
function StatusTugas({ t, sub }) {
  const { user } = useApp()
  const jamOf = (iso) => iso ? new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Makassar' }).replace(':', '.') : ''
  const mulai = sub.data?.[`${sub.stage}_work_started_at`]
  let teks, tone = 'text-ink-soft'
  if (t.stage.key === 'registrasi') { teks = 'Nomor Registrasi · siap diisi'; tone = 'text-brand' }
  else if (t.stage.claimable) {
    if (!t.claim) teks = 'To-do bersama · belum diambil siapa pun'
    else if (t.claim.by === user.id) { teks = `Diambil Anda${t.claim.at ? ` · ${jamOf(t.claim.at)}` : ''}`; tone = 'text-brand' }
    else teks = `Sedang diproses ${t.claim.name || ''}`
  } else if (t.started) { teks = `Sedang dikerjakan${mulai ? ` · mulai ${jamOf(mulai)}` : ''}${t.files.length ? ` · ${t.files.length} file terunggah` : ''}`; tone = 'text-brand' }
  else teks = `Belum dimulai${sub.stage_at ? ` · masuk ${jamOf(sub.stage_at)}` : ''}`
  return <p className={cx('truncate text-xs font-semibold', tone)} data-status-tugas>{t.stage.label}<span className={cx('font-medium', tone === 'text-brand' ? 'text-brand/80' : 'text-ink-mute')}> · {teks}</span></p>
}

function AksiTugas({ t, project, sub, setOpen, className, hp }) {
  // Hanya dua tombol: Mulai/Lanjutkan (membuka jendela kerja: unduh dokumen → upload hasil → kirim) dan Tolak.
  const size = hp ? undefined : 'sm'
  const kelas = hp ? '!h-11 flex-1 justify-center' : ''
  return (
    <div className={cx('flex flex-wrap items-center gap-1.5', className)}>
      {!t.started
        ? <Button size={size} className={kelas} variant={hp ? 'dark' : undefined} loading={t.busy === 'start'} title="Tandai mulai dikerjakan dan buka jendela kerja" data-aksi="mulai-tugas"
            onClick={async () => { if (await t.start()) setOpen(true) }}>{t.stage.claimable ? <Hand className="h-4 w-4" /> : <Play className="h-4 w-4" />}{t.stage.claimable ? (hp ? 'Ambil & proses' : 'Ambil') : 'Mulai'}</Button>
        : <Button size={size} className={kelas} variant={t.files.length || hp ? 'dark' : undefined} title="Buka jendela kerja: dokumen, upload hasil, kirim" data-aksi="lanjutkan-tugas" onClick={() => setOpen(true)}>
            {t.files.length ? <CheckCircle2 className="h-4 w-4" /> : <FolderOpen className="h-4 w-4" />}{hp ? (t.stage.key === 'registrasi' ? 'Isi nomor registrasi' : t.files.length ? `Buka lembar kerja · ${t.files.length} file` : 'Buka lembar kerja') : t.files.length ? `Lanjutkan · ${t.files.length} file` : 'Lanjutkan'}
          </Button>}
      <TolakTugasBtn project={project} sub={sub} className={hp ? '!h-11' : '!h-8'} />
    </div>
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
      <AksiTugas t={t} project={project} sub={sub} setOpen={setOpen} />
      {t.namerDialog}
      {open && <WorkSheet project={project} sub={sub} t={t} onClose={() => setOpen(false)} />}
    </div>
  )
}
