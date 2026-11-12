// ============================================================
//  LAYAR KERJA PER INVOICE — desain CANVAS ATLAS ("Panel-Samping").
//  Layar penuh: kiri daftar invoice (cari), kanan ringkasan project,
//  daftar dokumen (pilih), kartu Tahap + kartu kerja (isian & tombol
//  tahap yang sama persis dengan detail project).
// ============================================================
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, Search, Check } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { go } from '../lib/router.js'
import { invoiceLabel } from '../config/access.js'
import { DONE, flowOf, stagesOf, stageIndex, stageLabel } from '../config/workflows.js'
import { infoDeadline, warnaKategori } from '../components/BarisCanvas.jsx'
import ProjectDetail, { SubProject } from './ProjectDetail.jsx'
import { cx } from '../components/ui.jsx'

const PELAKSANA = ['penerjemah', 'proofreader', 'otorisator']

export default function LayarKerja({ projectId, subId, daftar = [], onClose }) {
  const { user, data } = useApp()
  const [pid, setPid] = useState(projectId)
  const [sid, setSid] = useState(subId || null)
  const [q, setQ] = useState('')
  useEffect(() => {
    const f = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', f); document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', f); document.body.style.overflow = '' }
  }, [onClose])
  const project = data.projects.find((p) => p.id === pid)
  const list = useMemo(() => {
    const k = q.trim().toLowerCase()
    const dasar = daftar.length ? daftar.map((p) => data.projects.find((x) => x.id === p.id) || p) : project ? [project] : []
    return dasar.filter((p) => !k || `${p.invoice_no} ${p.customer?.name || ''}`.toLowerCase().includes(k)).slice(0, 80)
  }, [daftar, data.projects, q, project])
  if (!project) return null
  const subs = project.sub_projects || []
  const akt = subs.find((x) => x.id === sid) || subs.find((x) => x.stage !== DONE) || subs[0]
  const dl = infoDeadline(project)
  const print = project.about?.print_location || project.branch
  const cs = String(project.about?.cs_name || '').replace(/\s*\(.*\)\s*$/, '')
  const flow = akt ? flowOf(akt, project) : null
  const st = flow ? stagesOf(flow) : []
  const pos = akt ? (akt.stage === DONE ? st.length : stageIndex(flow, akt.stage)) : 0
  const w = warnaKategori(akt)
  const fakta = (l, isi) => <div className="flex flex-col items-start gap-[3px]"><span className="text-xs text-[#5E6380]">{l}</span>{isi}</div>

  return createPortal(
    <div className="fixed inset-0 z-[200] flex bg-[#F3F4F9] text-[#141B34] dark:bg-[#0f1424] dark:text-slate-100" role="dialog" aria-modal="true" aria-label={`Layar kerja ${invoiceLabel(project.invoice_no)}`} data-layar-kerja>
      <nav aria-label="Daftar invoice" className="hidden w-[300px] shrink-0 flex-col gap-3 overflow-y-auto border-r border-[#E7E8F0] bg-white px-3 py-4 md:flex dark:border-white/10 dark:bg-[#121729]">
        <button type="button" onClick={onClose} className="inline-flex min-h-11 items-center gap-1.5 self-start px-2 text-[13px] font-bold"><ChevronLeft className="h-4 w-4" aria-hidden="true" />Daftar project</button>
        <label className="flex min-h-11 items-center gap-2 rounded-xl border border-[#D9DBE7] px-3">
          <Search className="h-4 w-4 text-[#5E6380]" aria-hidden="true" /><span className="sr-only">Cari invoice</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari invoice" className="h-10 min-w-0 flex-1 border-0 bg-transparent p-0 text-sm outline-none focus:ring-0" />
        </label>
        <div className="flex flex-col gap-1">
          {list.map((p) => {
            const on = p.id === pid; const d = infoDeadline(p)
            return (
              <button key={p.id} type="button" onClick={() => { setPid(p.id); setSid(null) }} aria-current={on ? 'true' : undefined} data-pilih-invoice
                className={cx('flex min-h-[52px] w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left', on ? 'bg-[#141B34] text-white' : 'hover:bg-[#F3F4F9] dark:hover:bg-white/5')}>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5"><span className="text-sm font-bold tabular-nums">{invoiceLabel(p.invoice_no)}</span><span className="truncate text-xs opacity-80">{p.customer?.name}</span></span>
                {d && <span className="inline-flex min-h-[22px] items-center whitespace-nowrap rounded-full px-2 text-[11px] font-bold" style={{ background: d.bg, color: d.fg }}>{d.tgl.replace(/ \d\d\.\d\d$/, '')}</span>}
              </button>
            )
          })}
        </div>
      </nav>

      <main className="min-w-0 flex-1 overflow-y-auto px-3 pb-10 pt-5 sm:px-6">
        <div className="mx-auto flex max-w-[1100px] flex-col gap-3.5">
          <button type="button" onClick={onClose} className="inline-flex min-h-11 items-center gap-1.5 self-start text-[13px] font-bold md:hidden"><ChevronLeft className="h-4 w-4" aria-hidden="true" />Daftar project</button>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5 rounded-2xl bg-white px-4 py-3.5 dark:bg-white/5">
            <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-[3px]">
              <h1 className="text-[22px] font-extrabold tracking-tight tabular-nums">{invoiceLabel(project.invoice_no)}</h1>
              <span className="truncate text-sm font-semibold">{project.customer?.name}</span>
            </div>
            {fakta('Prioritas', <span className="text-sm font-bold">{project.about?.priority || 'Normal'}</span>)}
            {dl && fakta('Deadline', <span className="inline-flex min-h-6 items-center whitespace-nowrap rounded-full px-2.5 text-xs font-bold" style={{ background: dl.bg, color: dl.fg }}>{dl.tgl} · {dl.sisa}</span>)}
            {fakta('Cabang · Print', <span className="text-sm font-bold">{project.branch} · {print}</span>)}
            {fakta('CS', <span className="text-sm font-bold">{cs || '—'}</span>)}
          </div>

          {PELAKSANA.includes(user.role) ? (
            <div className="rounded-2xl bg-white p-4 dark:bg-white/5"><ProjectDetail id={project.id} embedded focusSub={akt?.id} /></div>
          ) : (<>
            <div className="overflow-hidden rounded-2xl bg-white dark:bg-white/5">
              {subs.map((x) => {
                const f = flowOf(x, project); const s2 = stagesOf(f); const k = stageIndex(f, x.stage); const on = x.id === akt?.id; const ww = warnaKategori(x)
                return (
                  <button key={x.id} type="button" onClick={() => setSid(x.id)} aria-pressed={on} data-pilih-sub
                    className="grid min-h-12 w-full items-center gap-x-3 border-t border-[#EEF0F5] px-4 py-1.5 text-left text-sm first:border-t-0 md:grid-cols-[minmax(180px,2.4fr)_60px_60px_minmax(130px,1.2fr)_minmax(200px,2fr)]"
                    style={{ background: on ? ww.bg : undefined }}>
                    <span className="min-w-0 truncate font-bold" title={x.title}>{x.title}</span>
                    <span className="whitespace-nowrap">{x.docs?.length || x.file_count || 0} Dok</span>
                    <span className="whitespace-nowrap">{x.docs?.length ? x.docs.reduce((a, d) => a + (Number(d.pages) || 0), 0) : (Number(x.pages) || 0)} Hal</span>
                    <span className="min-w-0 truncate">{x.lang_from && x.lang_to ? `${x.lang_from} → ${x.lang_to}` : '—'}</span>
                    <span className="min-w-0 truncate font-bold">{x.stage === DONE ? 'Selesai' : stageLabel(f, x.stage)}{x.stage !== DONE && <span className="text-xs font-medium text-[#5E6380]"> ▸ {s2[k + 1]?.label || 'Selesai'}</span>}</span>
                  </button>
                )
              })}
            </div>

            {akt && (
              <div className="flex flex-wrap items-start gap-3.5">
                <section aria-labelledby="lk-tahap" className="flex w-full flex-col gap-3 rounded-2xl bg-white p-4 md:max-w-[320px] md:flex-[1_1_240px] dark:bg-white/5">
                  <div className="flex items-center justify-between gap-2">
                    <h2 id="lk-tahap" className="text-[15px] font-medium">Tahap</h2>
                    <span className="inline-flex min-h-6 items-center rounded-lg px-2 text-xs font-bold" style={{ background: w.bg, color: w.fg }}>{akt.type === 'terjemahan' ? 'Terjemahan' : akt.type === 'terjemahan_nt' ? 'Non Tersumpah' : akt.type === 'apostille' ? 'Apostille' : akt.type === 'legalisasi' ? 'Legalisasi' : 'Jasa Lain'}</span>
                  </div>
                  <ol className="flex flex-col gap-1.5">
                    {st.map((x, i) => (
                      <li key={x.key} className={cx('flex items-center gap-2.5 text-[13px]', i === pos ? 'font-extrabold text-[#141B34]' : i < pos ? 'font-medium text-[#4A4F6A]' : 'font-medium text-[#5E6380]')}>
                        <span aria-hidden="true" className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full text-[11px] font-extrabold" style={{ background: i < pos ? '#141B34' : i === pos ? '#4169E1' : '#EEF0F5', color: i <= pos ? '#FFFFFF' : '#4A4F6A' }}>{i < pos ? <Check className="h-3 w-3" /> : i + 1}</span>
                        {x.label}
                      </li>
                    ))}
                  </ol>
                </section>
                <section aria-label="Kerjakan" className="min-w-0 flex-[999_1_420px] overflow-hidden rounded-2xl bg-white dark:bg-white/5">
                  <SubProject key={akt.id} n={subs.indexOf(akt) + 1} project={project} sub={akt} compact tanpaTahap />
                  <div className="flex flex-wrap gap-2 border-t border-[#EEF0F5] px-4 py-3">
                    <button type="button" onClick={() => { onClose(); go(`projects/${project.id}`) }} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#D9DBE7] px-4 text-sm font-semibold hover:bg-[#F6F7FB]">Detail project</button>
                  </div>
                </section>
              </div>
            )}
          </>)}
        </div>
      </main>
    </div>,
    document.body
  )
}
