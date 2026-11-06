import { useLayoutEffect, useRef, useState, useEffect } from 'react'
import { Trash2, Plus, RotateCcw, Files, BookOpen, Languages, ArrowLeftRight, UserPen, Globe2, Landmark, UserCog, Stamp, ScrollText, Shapes, Lock, Upload, Paperclip, X, IdCard } from 'lucide-react'

const TYPE_ICON = { terjemahan: Languages, terjemahan_nt: Languages, apostille: Stamp, legalisasi: ScrollText, jasa_lain: Shapes }
import { useApp } from '../lib/store.jsx'
import { SUB_TYPES, COUNTRIES, OBJEK_APOSTILLE, points, renumber } from '../config/subtypes.js'
import { Field, FieldError, Input, Select, cx } from './ui.jsx'
import { placeOf } from '../config/access.js'
import PilihCari from './PilihCari.jsx'

const LANGS = ['Indonesia', 'Inggris', 'Mandarin', 'Jepang', 'Korea', 'Arab', 'Belanda', 'Jerman', 'Prancis', 'Spanyol', 'Rusia', 'Lainnya']

export const newSub = (type = 'terjemahan') => ({
  _k: Math.random(), type, description: '', file_count: 0, pages: 0, pages_manual: false, docs: usesDocs(type) ? [{ desc: '', pages: 1 }] : undefined,
  translator: '', translator_kind: '', lang_from: 'Indonesia', lang_to: 'Inggris', country: '', objek: '', institution: '', executor_kind: '', executor_id: '', applicant_id: '',
})

/** Textarea bernomor: Enter → baris baru dengan nomor berikutnya. */
function NumberedTextarea({ value, onChange, placeholder, invalid }) {
  const ref = useRef(null)
  const caretRef = useRef(null)
  // Pasang posisi kursor tepat setelah nilai baru dirender (sebelum ketikan berikutnya)
  useLayoutEffect(() => {
    if (caretRef.current !== null && ref.current) { ref.current.setSelectionRange(caretRef.current, caretRef.current); caretRef.current = null }
  }, [value])
  const onKeyDown = (e) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
    e.preventDefault()
    const el = e.currentTarget
    const before = value.slice(0, el.selectionStart)
    const after = value.slice(el.selectionEnd)
    const next = renumber(before + '\n' + after)
    const lineIdx = before.split('\n').length // indeks baris baru
    const caret = next.split('\n').slice(0, lineIdx).join('\n').length + 1 + `${lineIdx + 1}. `.length
    caretRef.current = caret
    onChange(next)
  }
  return (
    <textarea ref={ref} rows={3} value={value} placeholder={placeholder} aria-invalid={invalid}
      onFocus={() => { if (!value) onChange('1. ') }}
      onBlur={() => { if (value.trim() && value.trim() !== '1.') onChange(renumber(value.split('\n').filter((l) => l.replace(/^\s*\d+[.)]\s*/, '').trim()).join('\n'))) }}
      onKeyDown={onKeyDown} onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border-0 bg-white px-3 py-2.5 text-sm leading-relaxed text-ink ring-1 ring-slate-300 placeholder:text-slate-400 hover:ring-slate-400 focus:outline-none focus:ring-2 focus:ring-brand aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-rose-500" />
  )
}

/** Jenis sub project yang detail dokumennya per baris (deskripsi + upload file per dokumen). */
export const usesDocs = (type) => type === 'terjemahan' || type === 'apostille' || type === 'legalisasi'
/** Baris dokumen. Data lama tanpa `docs` diturunkan dari deskripsi. */
export function docsOf(sub) {
  if (Array.isArray(sub.docs) && sub.docs.length) return sub.docs
  const pts = points(sub.description)
  if (!pts.length) return [{ desc: '', pages: 1 }]
  return pts.map((desc) => ({ desc, pages: pts.length === 1 ? Math.max(1, Number(sub.pages) || 1) : 1 }))
}
/** Turunan otomatis dari baris dokumen: deskripsi bernomor, jumlah file & total halaman. */
export function fromDocs(docs) {
  const filled = docs.filter((d) => d.desc.trim())
  return {
    docs,
    description: filled.map((d, i) => `${i + 1}. ${d.desc.trim()}`).join('\n'),
    file_count: filled.length,
    pages: filled.reduce((a, d) => a + (Number(d.pages) || 0), 0),
    pages_manual: false,
  }
}

const extOf = (n = '') => (n.match(/\.[^.]+$/)?.[0] || '')
export const safeName = (n = '') => n.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim()
/** Nama file otomatis dari deskripsi dokumen (ekstensi file asli dipertahankan). */
export const docFileName = (d) => d.file_name?.trim() || `${safeName(d.desc) || (d.file?.name || 'dokumen').replace(/\.[^.]+$/, '')}${extOf(d.file?.name)}`

function DocTable({ docs, onChange, invalid, simple = false, uploadLabel = 'Upload file dokumen ini' }) {
  const [focus, setFocus] = useState(null)
  const refs = useRef([])
  useEffect(() => { if (focus !== null) { refs.current[focus]?.focus(); setFocus(null) } }, [focus, docs.length])
  const upd = (i, patch) => onChange(docs.map((d, j) => (j === i ? { ...d, ...patch } : d)))
  const add = (at = docs.length) => { const next = [...docs]; next.splice(at, 0, { desc: '', pages: 1, kind: docs[at - 1]?.kind || 'reguler' }); onChange(next); setFocus(at) }
  const del = (i) => onChange(docs.length > 1 ? docs.filter((_, j) => j !== i) : [{ desc: '', pages: 1 }])
  const total = docs.filter((d) => d.desc.trim()).reduce((a, d) => a + (Number(d.pages) || 0), 0)
  const count = docs.filter((d) => d.desc.trim()).length
  const nonReg = docs.filter((d) => d.desc.trim() && d.kind === 'non_reguler').reduce((a, d) => a + (Number(d.pages) || 0), 0)

  return (
    <div className={cx('overflow-hidden rounded-xl bg-white ring-1', invalid ? 'ring-2 ring-rose-500' : 'ring-slate-300')}>
      <div className={cx('grid items-center gap-1.5 bg-emerald-50 px-1.5 py-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-900 sm:gap-2 sm:px-2', simple ? 'grid-cols-[26px_1fr_30px] sm:grid-cols-[32px_1fr_32px]' : 'grid-cols-[26px_1fr_64px_48px_30px] sm:grid-cols-[32px_1fr_116px_72px_32px]')}>
        <span className="text-center">No</span><span>Deskripsi<span className="hidden sm:inline"> Dokumen</span> & File</span>{!simple && <span className="text-center">Jenis</span>}{!simple && <span className="text-center">Hlm</span>}<span />
      </div>
      {docs.map((d, i) => (
        <div key={i} className={cx('grid items-center gap-1.5 border-t border-slate-100 px-1.5 py-1.5 transition hover:bg-slate-50/60 sm:gap-2 sm:px-2', simple ? 'grid-cols-[26px_1fr_30px] sm:grid-cols-[32px_1fr_32px]' : 'grid-cols-[26px_1fr_64px_48px_30px] sm:grid-cols-[32px_1fr_116px_72px_32px]')}>
          <span className="grid h-6 w-6 place-items-center justify-self-center rounded-md bg-slate-100 text-xs font-semibold text-ink-soft">{i + 1}</span>
          <div className="min-w-0 space-y-1">
            <input ref={(el) => (refs.current[i] = el)} value={d.desc} placeholder="mis. KTP a.n. …" aria-label={`Deskripsi dokumen ${i + 1}`}
              onChange={(e) => upd(i, { desc: e.target.value, ...(d.file && !d.name_edited ? { file_name: `${safeName(e.target.value) || 'dokumen'}${extOf(d.file.name)}` } : {}) })}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); add(i + 1) } }}
              className="h-9 w-full min-w-0 rounded-lg border-0 bg-white px-2.5 text-sm text-ink ring-1 ring-slate-200 placeholder:text-slate-400 hover:ring-slate-300 focus:outline-none focus:ring-2 focus:ring-brand" />
            {d.file ? (
              <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2 py-1 ring-1 ring-emerald-200">
                <Paperclip className="h-3.5 w-3.5 shrink-0 text-emerald-700" />
                <input value={d.file_name ?? docFileName(d)} onChange={(e) => upd(i, { file_name: e.target.value, name_edited: true })} aria-label={`Nama file dokumen ${i + 1}`} title="Nama file saat diunggah — bisa diedit"
                  className="h-7 min-w-0 flex-1 rounded-md border-0 bg-white px-2 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-200 focus:outline-none focus:ring-2 focus:ring-brand" />
                <span className="hidden shrink-0 text-[10px] text-emerald-700 sm:inline">{Math.max(1, Math.round((d.file.size || 0) / 1024))} KB</span>
                <button type="button" onClick={() => upd(i, { file: null, file_name: '', name_edited: false })} aria-label={`Hapus file dokumen ${i + 1}`} className="grid h-6 w-6 place-items-center rounded-md text-emerald-700 hover:bg-white hover:text-rose-600"><X className="h-3.5 w-3.5" /></button>
              </div>
            ) : d.existing ? (
              <p className="flex items-center gap-1.5 px-1 text-[11px] text-ink-mute"><Paperclip className="h-3 w-3" />{d.existing}</p>
            ) : (
              <label className={cx('inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold ring-1', invalid && !d.file ? 'bg-rose-50 text-rose-700 ring-rose-300' : 'bg-white text-brand ring-brand/30 hover:bg-brand-soft')}>
                <Upload className="h-3.5 w-3.5" />{uploadLabel}
                <input type="file" className="hidden" accept="application/pdf,image/*,.doc,.docx" aria-label={`File dokumen ${i + 1}`}
                  onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) upd(i, { file: f, file_name: `${safeName(d.desc) || f.name.replace(/\.[^.]+$/, '')}${extOf(f.name)}`, name_edited: false }) }} />
              </label>
            )}
          </div>
          {!simple && <select value={d.kind || 'reguler'} onChange={(e) => upd(i, { kind: e.target.value })} aria-label={`Jenis dokumen ${i + 1}`} title="Reguler / Non Reguler"
            className={cx('h-9 w-full min-w-0 rounded-lg border-0 px-1 text-xs font-semibold ring-1 focus:outline-none focus:ring-2 focus:ring-brand', d.kind === 'non_reguler' ? 'bg-violet-50 text-violet-800 ring-violet-200' : 'bg-white text-ink ring-slate-200')}>
            <option value="reguler">Reguler</option><option value="non_reguler">Non Reguler</option>
          </select>}
          {!simple && <input type="number" min="1" inputMode="numeric" value={d.pages} aria-label={`Jumlah halaman dokumen ${i + 1}`}
            onChange={(e) => upd(i, { pages: Math.max(0, Number(e.target.value)) })}
            className="h-9 w-full rounded-lg border-0 bg-white px-1 text-center text-sm font-semibold text-ink ring-1 ring-slate-200 hover:ring-slate-300 focus:outline-none focus:ring-2 focus:ring-brand" />}
          <button type="button" onClick={() => del(i)} title="Hapus dokumen" aria-label={`Hapus dokumen ${i + 1}`}
            className="grid h-8 w-7 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/70 px-2 py-2">
        <button type="button" onClick={() => add()} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[13px] font-semibold text-brand ring-1 ring-brand/30 hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
          <Plus className="h-4 w-4" />Tambah Dokumen
        </button>
        <span className="flex items-center gap-2 text-[13px] text-ink-soft">
          <span className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 ring-1 ring-slate-200" title="Jumlah file/dokumen"><Files className="h-3.5 w-3.5 text-emerald-600" /><b className="font-bold text-ink">{count}</b> dokumen</span>
          {!simple && <span className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 ring-1 ring-slate-200" title="Total halaman"><BookOpen className="h-3.5 w-3.5 text-emerald-600" /><b className="font-bold text-ink">{total}</b> halaman{nonReg > 0 && <span className="text-violet-700"> · {nonReg} non reguler</span>}</span>}
        </span>
      </div>
    </div>
  )
}

export default function SubProjectEditor({ n, sub, onChange, onRemove, branch, locked, error }) {
  const { data } = useApp()
  const of = (type) => data.people.filter((p) => p.type === type && (p.branch === branch || p.branch === 'Semua'))
  const set = (patch) => onChange({ ...sub, ...patch })
  const extra = (SUB_TYPES[sub.type] ?? SUB_TYPES.jasa_lain).extra
  const errOn = (word) => !!error && error.toLowerCase().includes(word)

  const setDesc = (description) => {
    const count = points(description).length
    set({ description, file_count: count, ...(sub.pages_manual ? {} : { pages: count }) })
  }

  return (
    <div className={cx('rounded-xl bg-white p-3 shadow-sm ring-1 sm:p-5', error ? 'ring-2 ring-rose-400' : 'ring-emerald-200')}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="grid h-7 min-w-7 place-items-center rounded-lg bg-emerald-600 px-2 text-xs font-bold text-white">{n}</span>
        <div className="order-last flex min-w-0 flex-1 basis-full gap-1 rounded-xl bg-slate-100 p-1 sm:order-none sm:basis-0" role="tablist" aria-label="Jenis sub project">
          {Object.entries(SUB_TYPES).map(([k, t]) => {
            const Icon = TYPE_ICON[k]; const on = sub.type === k
            return (
              <button key={k} type="button" role="tab" disabled={locked} aria-selected={on}
                onClick={() => set(usesDocs(k) ? { type: k, ...fromDocs(docsOf(sub)) } : { type: k })} title={t.label} aria-label={t.label} aria-pressed={on}
                className={cx('flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-50',
                  on ? 'flex-[2] bg-brand text-white shadow-sm' : 'flex-1 text-ink-soft hover:bg-brand-soft hover:text-brand')}>
                <Icon className="h-4 w-4 shrink-0" /><span className={on ? '' : 'hidden sm:inline'}>{t.label}</span>
              </button>
            )
          })}
        </div>
        <span className="flex-1 sm:hidden" />
        {locked && <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-ink-mute"><Lock className="h-3 w-3" />Alur berjalan</span>}
        {onRemove && <button type="button" onClick={onRemove} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-rose-600 ring-1 ring-rose-200 hover:bg-rose-50" aria-label={`Hapus sub project ${n}`}><Trash2 className="h-3.5 w-3.5" /><span className="hidden sm:inline">Hapus</span></button>}
      </div>

      {error && <FieldError className="-mt-2 mb-3">{error}</FieldError>}

      <div className="space-y-5">
        {usesDocs(sub.type) ? (
          <div>
            <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">{sub.type === 'terjemahan' ? 'Detail Dokumen' : `Dokumen yang akan di-${sub.type === 'apostille' ? 'apostille' : 'legalisasi'}`} <span className="text-rose-500" aria-hidden>*</span></span>
            <DocTable docs={docsOf(sub)} invalid={errOn('dokumen')} simple={sub.type !== 'terjemahan'} uploadLabel={sub.type === 'terjemahan' ? 'Upload file dokumen ini' : 'Upload scan dokumen ini'} onChange={(docs) => set(fromDocs(docs))} />
            {sub.type !== 'terjemahan' && <p className="mt-1.5 text-[11px] text-ink-mute">1 baris = 1 dokumen · tekan Enter untuk baris berikutnya · scan/foto dokumen diunggah per baris agar tim proses bisa mengunduhnya</p>}
          </div>
        ) : (
          <>
            <Field label="Deskripsi" required hint="Tekan Enter untuk poin berikutnya · 1 poin = 1 file">
              <NumberedTextarea value={sub.description} invalid={errOn('deskripsi')} onChange={setDesc} placeholder="1. Nama dokumen" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Jumlah File" icon={Files} hint="Otomatis dari deskripsi">
                <Input value={sub.file_count} readOnly tabIndex={-1} disabled />
              </Field>
              <Field label="Jumlah Halaman" icon={BookOpen} hint={sub.pages_manual
                ? <button type="button" onClick={() => set({ pages_manual: false, pages: sub.file_count })} className="inline-flex items-center gap-1 font-semibold text-brand hover:underline"><RotateCcw className="h-3 w-3" />Kembali otomatis</button>
                : 'Otomatis, bisa diubah'}>
                <Input type="number" min="0" inputMode="numeric" value={sub.pages} onChange={(e) => set({ pages: Number(e.target.value), pages_manual: true })} />
              </Field>
            </div>
          </>
        )}

        {(extra.includes('lang') || extra.includes('translator')) && (
          <div className="grid gap-4 sm:grid-cols-2">
            {extra.includes('lang') && (
              <Field label="Bahasa" icon={Languages}>
                <div className="flex items-center gap-2">
                  <Select value={sub.lang_from} onChange={(e) => set({ lang_from: e.target.value })} aria-label="Bahasa asal" className="min-w-0 flex-1">{LANGS.map((x) => <option key={x}>{x}</option>)}</Select>
                  <button type="button" onClick={() => set({ lang_from: sub.lang_to, lang_to: sub.lang_from })} aria-label="Tukar bahasa asal dan tujuan" title="Tukar arah bahasa (asal ⇄ tujuan)"
                    className="group inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-ink-mute ring-1 ring-slate-300 transition hover:bg-emerald-50 hover:text-emerald-700 hover:ring-emerald-400 active:scale-90">
                    <ArrowLeftRight className="h-4 w-4 transition-transform duration-300 group-hover:rotate-180" />
                  </button>
                  <Select value={sub.lang_to} onChange={(e) => set({ lang_to: e.target.value })} aria-label="Bahasa tujuan" className="min-w-0 flex-1">{LANGS.map((x) => <option key={x}>{x}</option>)}</Select>
                </div>
              </Field>
            )}
            {extra.includes('translator_nt') && (
              <Field label="Penerjemah" icon={UserPen} required hint={locked ? 'Terkunci — alur sudah berjalan' : 'Langsung ke penerjemah internal — tanpa supervisor, proofreader & otorisasi'}>
                <Select value={sub.translator || ''} disabled={locked} aria-invalid={errOn('penerjemah')} onChange={(e) => set({ translator_kind: 'translator', translator: e.target.value })}>
                  <option value="">— Pilih penerjemah —</option>
                  {data.users.filter((u) => u.role === 'penerjemah' && u.active !== false).map((u) => <option key={u.id} value={u.id}>{u.name} · {placeOf(u)}</option>)}
                </Select>
              </Field>
            )}
            {extra.includes('translator') && (
              <Field label="Penerjemah" icon={UserPen} hint={locked ? 'Terkunci — alur sudah berjalan' : 'Opsional — kosong = ditentukan Supervisor'}>
                <Select value={sub.translator ? `${sub.translator_kind || 'translator'}:${sub.translator}` : ''} disabled={locked}
                  onChange={(e) => { const [kind, id] = e.target.value.split(':'); set({ translator_kind: kind || '', translator: id || '' }) }}>
                  <option value="">Ditentukan Supervisor</option>
                  <optgroup label="Penerjemah (internal)">{data.users.filter((u) => u.role === 'penerjemah' && u.active !== false).map((u) => <option key={u.id} value={`translator:${u.id}`}>{u.name} · {placeOf(u)}</option>)}</optgroup>
                  <optgroup label="Vendor (eksternal)">{of('vendor').map((p) => <option key={p.id} value={`vendor:${p.id}`}>{p.name}</option>)}</optgroup>
                </Select>
              </Field>
            )}
          </div>
        )}

        {['apostille', 'legalisasi'].includes(sub.type) && (
          <Field label="Nomor ID Pemohon / No. NIB / SK Kemenkumham Perusahaan" icon={IdCard} hint="Identitas pemohon pada dokumen: NIK/paspor untuk perorangan, NIB atau nomor SK Kemenkumham untuk perusahaan. Lampirkan scan ID-nya di sebelah kanan.">
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <Input value={sub.applicant_id || ''} onChange={(e) => set({ applicant_id: e.target.value })} placeholder="mis. 5171xxxxxxxxxxxx / NIB 1234567890123 / AHU-0012345.AH.01.01.2024" />
              {sub.applicant_file ? (
                <div className="flex items-center gap-1.5 rounded-xl bg-emerald-50 px-2.5 ring-1 ring-emerald-200">
                  <Paperclip className="h-3.5 w-3.5 shrink-0 text-emerald-700" />
                  <span className="max-w-[180px] truncate text-xs font-semibold text-emerald-900" title={sub.applicant_file.name}>{sub.applicant_file.name}</span>
                  <button type="button" onClick={() => set({ applicant_file: null })} aria-label="Hapus file ID pemohon" className="grid h-6 w-6 place-items-center rounded-md text-emerald-700 hover:bg-white hover:text-rose-600"><X className="h-3.5 w-3.5" /></button>
                </div>
              ) : sub.data?.dokumen_id ? (
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-50 px-2.5 text-xs text-ink-mute ring-1 ring-slate-200"><Paperclip className="h-3.5 w-3.5" />{sub.data.dokumen_id.name}</span>
              ) : (
                <label className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-brand ring-1 ring-brand/30 hover:bg-brand-soft">
                  <Upload className="h-3.5 w-3.5" />Upload scan ID / dokumen pemohon
                  <input type="file" className="hidden" accept="application/pdf,image/*" aria-label="File ID pemohon" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) set({ applicant_file: f }) }} />
                </label>
              )}
            </div>
          </Field>
        )}
        {(extra.includes('country') || extra.includes('institution') || extra.includes('executor')) && (
          <div className="grid gap-4 sm:grid-cols-2">
            {extra.includes('country') && (
              <Field label="Tujuan Negara" icon={Globe2} required>
                <PilihCari label="Tujuan negara" invalid={errOn('negara')} value={sub.country}
                  onChange={(v) => set({ country: v })} options={COUNTRIES}
                  placeholder="Pilih negara…" kosong="Negara tidak ditemukan" />
              </Field>
            )}
            {extra.includes('institution') && (
              <Field label="Lembaga" icon={Landmark} required hint={!of('lembaga').length ? 'Belum ada lembaga — tambahkan di Setting → Master Data' : undefined}>
                <PilihCari label="Lembaga" invalid={errOn('lembaga')} value={sub.institution}
                  onChange={(v) => set({ institution: v })} placeholder="Pilih lembaga…" kosong="Lembaga tidak ditemukan"
                  options={of('lembaga').map((p) => ({ value: p.id, label: p.name, note: p.note || '' }))} />
                {/* Persyaratan lembaga — diisi di Setting → Master Data, bukan di kode. */}
                {(() => { const l = of('lembaga').find((p) => p.id === sub.institution); return l?.note
                  ? <p className="mt-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] leading-relaxed text-amber-900 ring-1 ring-amber-200">{l.note}</p>
                  : null })()}
              </Field>
            )}
            {extra.includes('objek') && (
              <Field label="Yang diapostille" icon={Stamp} required>
                <div className="flex flex-wrap gap-1.5">
                  {OBJEK_APOSTILLE.map(([v, l]) => (
                    <button key={v} type="button" onClick={() => set({ objek: v })} aria-pressed={sub.objek === v}
                      className={cx('min-h-[44px] rounded-xl px-3 text-sm font-semibold ring-1 transition',
                        sub.objek === v ? 'bg-ink text-white ring-ink' : 'bg-white text-ink-soft ring-slate-300 hover:ring-brand')}>
                      {l}
                    </button>
                  ))}
                </div>
              </Field>
            )}
            {extra.includes('executor') && (
              <Field label="Eksekutor" icon={UserCog} required hint={locked ? 'Terkunci — alur sudah berjalan' : 'Staf Apostille (internal) atau vendor luar'}>
                <Select value={sub.executor_id ? `${sub.executor_kind}:${sub.executor_id}` : ''} disabled={locked} aria-invalid={errOn('eksekutor')}
                  onChange={(e) => { const [kind, id] = e.target.value.split(':'); set({ executor_kind: kind || '', executor_id: id || '' }) }}>
                  <option value="">Pilih eksekutor…</option>
                  <optgroup label="Staf Apostille (internal)">{data.users.filter((u) => u.role === 'staf_apostille' && u.active !== false).map((u) => <option key={u.id} value={`staff:${u.id}`}>{u.name} · {placeOf(u)}</option>)}</optgroup>
                  <optgroup label="Vendor (luar)">{of('vendor').map((p) => <option key={p.id} value={`vendor:${p.id}`}>{p.name}</option>)}</optgroup>
                </Select>
              </Field>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** Validasi sub project sebelum disimpan. Mengembalikan pesan error atau null. */
export function validateSub(s, i) {
  const label = `Sub ${i + 1}`
  if (!points(s.description).length) return usesDocs(s.type) ? `${label}: isi minimal 1 dokumen` : `${label}: isi deskripsi minimal 1 poin`
  if (usesDocs(s.type)) {
    const missing = (s.docs || []).filter((d) => d.desc.trim() && !d.file && !d.existing)
    if (missing.length) return `${label}: upload file untuk dokumen ${missing.map((d) => `"${d.desc.trim()}"`).join(', ')} — project hanya bisa dibuat bila semua dokumen sudah diunggah`
  }
  const extra = (SUB_TYPES[s.type] ?? SUB_TYPES.jasa_lain).extra
  if (extra.includes('translator_nt') && !s.translator) return `${label}: pilih penerjemah`
  if (extra.includes('country') && !s.country.trim()) return `${label}: pilih tujuan negara`
  if (extra.includes('institution') && !s.institution) return `${label}: pilih lembaga`
  if (extra.includes('objek') && !s.objek) return `${label}: pilih yang diapostille (asli / terjemahan / keduanya)`
  if (extra.includes('executor') && !s.executor_id) return `${label}: pilih eksekutor`
  return null
}
