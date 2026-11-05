import { useEffect, useState } from 'react'
import { Search, Plus, Check, Loader2, UserRound, Receipt, Upload, X, FileText, RefreshCw, Headset, Building2, Printer, CalendarPlus, CalendarClock, Flag, ClipboardList, Truck, Layers, CloudUpload, StickyNote, Sparkles, Pencil } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { go } from '../lib/router.js'
import { zoho } from '../lib/integrations.js'
import { parseInvoiceItems } from '../lib/zohoParse.js'
import { fromDocs, usesDocs } from '../components/SubProjectEditor.jsx'
import { BRANCHES, can, branchesOf, isMultiBranch } from '../config/access.js'
import { stagesOf, deriveFlow } from '../config/workflows.js'
import { Button, Field, FieldError, Input, Select, Sheet, SectionCard, cx, Textarea } from '../components/ui.jsx'
import SubProjectEditor, { newSub, validateSub, docFileName, safeName } from '../components/SubProjectEditor.jsx'
import { SUB_TYPES, points } from '../config/subtypes.js'
import { uploadProjectFiles } from '../components/FileManager.jsx'
import { kb } from '../lib/format.js'
import { PrioritySelect } from '../components/Priority.jsx'
import CustomerInfo from '../components/CustomerInfo.jsx'
import { CourierSelect } from '../components/Courier.jsx'
import ResiFields from '../components/ResiFields.jsx'
import { rupiah, tgl } from '../lib/format.js'


/** Deadline otomatis: Sameday = hari masuk; Super Ekspres +1; Ekspres +2; Normal +3 (lewati Minggu). */
export function autoDeadline(received, priority) {
  if (!received) return ''
  const add = { Sameday: 0, 'Super Ekspres': 1, Ekspres: 2 }[priority] ?? 3
  const d = new Date(`${String(received).slice(0, 10)}T12:00:00+08:00`)
  for (let i = 0; i < add; i++) { d.setUTCDate(d.getUTCDate() + 1); if (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1) }
  return d.toISOString().slice(0, 10)
}

export default function ProjectForm({ onClose, project }) {
  const { user, data, save, notify } = useApp()
  const editing = !!project
  const [customer, setCustomer] = useState(project?.customer ?? null)
  const [invoice, setInvoice] = useState(project?.invoice_no ?? '')
  const [branch, setBranch] = useState(project?.branch ?? user.branch)
  const [about, setAbout] = useState(() => {
    const today = new Date().toISOString().slice(0, 10)
    return { print_location: user.branch, priority: 'Normal', received_at: today, deadline: project?.about?.deadline || autoDeadline(today, 'Normal'), cs_name: user.name, ...(project?.about ?? {}) }
  })
  // sub project lama: tandai dokumen yang sudah punya file sumber agar tidak diminta upload ulang
  const [subs, setSubs] = useState(() => project?.sub_projects
    ? project.sub_projects.map((sp) => {
      if (!usesDocs(sp.type) || !Array.isArray(sp.docs)) return sp
      const list = sp.data?.dokumen_sumber_list || (sp.data?.dokumen_sumber ? [sp.data.dokumen_sumber] : [])
      return { ...sp, docs: sp.docs.map((d, i) => ({ ...d, existing: list[i]?.name || list[0]?.name || (sp.stage !== 'cs_input' ? 'sudah berjalan' : '') })) }
    })
    : [newSub('terjemahan')])
  const [busy, setBusy] = useState(false)
  const [queue, setQueue] = useState([]) // file yang akan diunggah: {_k, file, name, sub_ref}
  const [progress, setProgress] = useState('')
  const [autoFill, setAutoFill] = useState(null) // ringkasan isian otomatis dari item invoice Zoho
  const [editShip, setEditShip] = useState(false)

  // Sub project yang belum diisi apa pun (boleh diganti isian otomatis)
  const isBlankSub = (x) => !x.id && !points(x.description).length && !(x.docs || []).some((d) => d.desc?.trim() || d.file)
  /** Isi otomatis dari item invoice Zoho: sub project, alamat kirim, kurir, prioritas. Semua tetap bisa diedit. */
  const applyInvoice = (detail, { force = false } = {}) => {
    const p = parseInvoiceItems(detail.items)
    const inv = detail.invoice_no
    let nSubs = 0
    if (p.subs.length) {
      const made = p.subs.map((ps) => {
        const base = newSub(ps.type)
        if (ps.type.startsWith('terjemahan')) {
          const docs = ps.docs.map((d) => ({ desc: d.desc, pages: d.pages, kind: d.kind || 'reguler' }))
          return { ...base, ...fromDocs(docs), docs, lang_from: ps.lang_from || base.lang_from, lang_to: ps.lang_to || base.lang_to, zoho_item: ps.zoho_item }
        }
        const docs = ps.docs.map((d) => ({ desc: d.desc, pages: 1 }))
        return { ...base, ...fromDocs(docs.length ? docs : [{ desc: '', pages: 1 }]), country: ps.country || '', institution: ps.institution || '', zoho_item: ps.zoho_item }
      })
      nSubs = made.length
      setSubs((cur) => (force || cur.every(isBlankSub) ? made : [...cur, ...made]))
    }
    // alamat pengiriman dari item "Delivery Fee" → hanya mengisi kolom yang masih kosong di data Zoho
    let shipFilled = false
    setCustomer((c) => {
      if (!c) return c
      const cur = c.ship || {}
      const next = { ...cur }
      // alamat di item invoice = alamat untuk order ini → menggantikan alamat umum di data Zoho (kolom yang tak ada di invoice dipertahankan)
      if (p.ship && p.hasAddress) {
        for (const k of ['attention', 'street1', 'street2', 'city', 'state', 'zip', 'phone']) if (p.ship[k]) { next[k] = p.ship[k]; shipFilled = true }
        if (shipFilled && p.ship.street1 && !p.ship.city) { next.city = ''; next.state = next.state && cur.street1 !== next.street1 ? '' : next.state }
      }
      const phone = c.phone || detail.contact?.mobile || p.ship?.phone || ''
      const email = c.email || p.email || detail.contact?.email || ''
      return { ...c, ship: next, phone, email, ...(shipFilled ? { ship_source: 'invoice' } : {}) }
    })
    // kurir & prioritas
    const courierRow = p.courier ? (data.couriers || []).find((k) => k.name.toLowerCase() === p.courier.toLowerCase()) || (data.couriers || []).find((k) => k.name.toLowerCase().includes(p.courier.toLowerCase().split(' ')[0])) : null
    setAbout((a) => {
      const next = { ...a }
      if (courierRow && (force || !a.courier)) next.courier = courierRow.id
      if (p.priority && (force || a.priority === 'Normal')) { next.priority = p.priority; const auto = autoDeadline(a.received_at, p.priority); if (auto && (!a.deadline || a.deadline === autoDeadline(a.received_at, a.priority))) next.deadline = auto }
      const extra = [...p.others.map((o) => [o.name, o.description.replace(/\s+/g, ' ').trim()].filter(Boolean).join(': ')), ...(p.office ? [`Ambil/kirim via kantor ${p.office}`] : [])].filter(Boolean)
      if (extra.length && !String(a.notes || '').includes('Dari invoice')) next.notes = [a.notes, `Dari invoice: ${extra.join(' · ')}`].filter(Boolean).join('\n')
      return next
    })
    setAutoFill({ invoice_no: inv, subs: nSubs, ship: !!(p.ship && p.hasAddress), courier: courierRow?.name || '', priority: p.priority, others: p.others.length })
  }
  // Begitu invoice dipilih/diketik → baca item invoice dari salinan Zoho (debounce)
  useEffect(() => {
    if (editing) return
    const no = invoice.trim().toUpperCase()
    if (!/^INV-\d{4,}$/i.test(no) || autoFill?.invoice_no === no) return
    let dead = false
    const t = setTimeout(() => zoho.invoiceDetail(no).then((d) => { if (!dead && d) applyInvoice(d) }).catch(() => {}), 350)
    return () => { dead = true; clearTimeout(t) }
  }, [invoice]) // eslint-disable-line react-hooks/exhaustive-deps
  // Sub project yang alurnya sudah berjalan: jenis & pelaksana dikunci
  const vendorOf = (s) => (s.translator_kind === 'vendor' ? data.people.find((p) => p.id === s.translator) : null)
  const isStarted = (s) => !!s.id && s.stage !== stagesOf(s.flow || project?.category || deriveFlow(s, vendorOf(s)))[0].key

  const setA = (k) => (e) => setAbout((a) => {
    const next = { ...a, [k]: e.target.value }
    // Deadline otomatis mengikuti prioritas (tetap bisa diubah): Sameday = hari masuk, Super Ekspres +1, Ekspres +2, Normal +3 hari kerja
    if (k === 'priority' || k === 'received_at') { const auto = autoDeadline(next.received_at, next.priority); if (auto && (!a.deadline || a.deadline === autoDeadline(a.received_at, a.priority))) next.deadline = auto }
    return next
  })

  const [tried, setTried] = useState(false)
  // Validasi per field — ditampilkan di bawah field setelah tombol simpan ditekan
  const inv0 = invoice.trim().toUpperCase()
  const errs = {
    customer: !customer && 'Pilih pelanggan dari Zoho',
    invoice: !inv0 ? 'Isi nomor invoice' : data.projects.some((p) => p.invoice_no === inv0 && p.id !== project?.id) && `Project ${inv0} sudah ada`,
    deadline: !about.deadline ? 'Isi deadline' : about.received_at && about.deadline.slice(0, 10) < about.received_at.slice(0, 10) && 'Deadline tidak boleh sebelum tanggal masuk',
    subs: subs.map((x, i) => validateSub(x, i)),
  }
  const E = (k) => (tried ? errs[k] || null : null)

  const submit = async () => {
    setTried(true)
    const inv = invoice.trim().toUpperCase()
    if (!customer) return notify('Pilih pelanggan dari Zoho', 'err')
    if (!inv) return notify('Isi nomor invoice', 'err')
    if (!about.deadline) return notify('Isi deadline', 'err')
    if (about.received_at && about.deadline.slice(0, 10) < about.received_at.slice(0, 10)) return notify('Deadline tidak boleh sebelum tanggal masuk', 'err')
    if (data.projects.some((p) => p.invoice_no === inv && p.id !== project?.id)) return notify(`Project ${inv} sudah ada`, 'err')
    if (!subs.length) return notify('Tambahkan minimal 1 sub project', 'err')
    for (let i = 0; i < subs.length; i++) { const err = validateSub(subs[i], i); if (err) return notify(err, 'err') }
    setBusy(true)
    try {
      const now = new Date().toISOString()
      const sub_projects = subs.map(({ _k, ...s }) => {
        const pts = points(s.description || s.title)
        // Judul otomatis = poin pertama deskripsi (+ jumlah poin lain)
        const title = `${(SUB_TYPES[s.type] ?? SUB_TYPES.jasa_lain).label}: ${pts[0]}${pts.length > 1 ? ` +${pts.length - 1}` : ''}`
        // Pilihan di form diteruskan ke tahap alur kerja (penerjemah / vendor)
        const data = { ...(s.data || {}) }
        if (s.translator && s.translator_kind !== 'vendor' && !data.translator) data.translator = s.translator
        const vendorId = s.translator_kind === 'vendor' ? s.translator : s.executor_kind === 'vendor' ? s.executor_id : ''
        if (vendorId && !data.vendor) data.vendor = vendorId
        if (s.executor_kind === 'staff' && s.executor_id) data.staff_apostille = s.executor_id
        // Alur ditentukan dari jenis + pelaksana; dihitung ulang selama belum berjalan
        const flow = isStarted(s) ? (s.flow || project?.category || deriveFlow(s, vendorOf(s))) : deriveFlow(s, vendorOf(s))
        const first = stagesOf(flow)[0].key
        const docs = usesDocs(s.type) && s.docs ? s.docs.filter((d) => d.desc.trim()).map(({ file, file_name, name_edited, existing, ...d }) => d) : undefined
        const { applicant_file, ...rest } = s // file ID pemohon diunggah terpisah (lihat idUploads)
        const base = { ...rest, title, file_count: pts.length, data, flow, docs }
        return s.id ? { ...base, ...(isStarted(s) ? {} : { stage: first }) }
          : { ...base, id: crypto.randomUUID?.() ?? String(Math.random()), stage: first, history: [{ at: now, by: user.name, action: 'Dibuat' }] }
      })
      const row = {
        ...(project ?? {}), invoice_no: inv, branch, customer, sub_projects,
        about: { ...about, deadline: about.deadline ? new Date(about.deadline).toISOString() : null, received_at: about.received_at?.slice(0, 10) || null },
        ...(editing ? {} : { created_by: user.id }),
      }
      // File per dokumen terjemahan → diunggah, masuk File Project & menjadi Dokumen Sumber tahap CS Input
      const docUploads = subs.flatMap((s, si) => (usesDocs(s.type) && s.docs ? s.docs : []).filter((d) => d.desc.trim() && d.file)
        .map((d) => ({ file: d.file, name: docFileName(d), sub_id: sub_projects[si].id, si })))
      if (docUploads.length) {
        const added = await uploadProjectFiles(docUploads, { branch, invoice: inv, by: user.name }, (i, n) => setProgress(`Mengunggah dokumen ${i}/${n}…`))
        added.forEach((f, k) => {
          const sp = sub_projects[docUploads[k].si]; const list = [...(sp.data.dokumen_sumber_list || (sp.data.dokumen_sumber ? [sp.data.dokumen_sumber] : [])), f]
          sp.data = { ...sp.data, dokumen_sumber: sp.data.dokumen_sumber || f, dokumen_sumber_list: list }
        })
        row.files = [...(project?.files || []), ...added]
      }
      // Scan ID / dokumen pemohon (apostille & legalisasi) → File Project + data.dokumen_id
      const idUploads = subs.flatMap((s, si) => (s.applicant_file ? [{ file: s.applicant_file, name: `ID Pemohon - ${safeName(s.applicant_file.name)}`, sub_id: sub_projects[si].id, si }] : []))
      if (idUploads.length) {
        const added = await uploadProjectFiles(idUploads, { branch, invoice: inv, by: user.name }, (i, n) => setProgress(`Mengunggah ID pemohon ${i}/${n}…`))
        added.forEach((f, k) => { const sp = sub_projects[idUploads[k].si]; sp.data = { ...sp.data, dokumen_id: f } })
        row.files = [...(row.files || project?.files || []), ...added]
      }
      if (queue.length) {
        const refToId = (ref) => { const i = subs.findIndex((x) => String(x.id ?? x._k) === String(ref)); return i < 0 ? null : sub_projects[i].id }
        const added = await uploadProjectFiles(queue.map((q) => ({ file: q.file, name: q.name.trim() || q.file.name, sub_id: refToId(q.sub_ref) })),
          { branch, invoice: inv, by: user.name }, (i, n) => setProgress(`Mengunggah file ${i}/${n}…`))
        row.files = [...(row.files || project?.files || []), ...added]
      }
      // Dokumen sudah diunggah saat project dibuat → tahap "CS Input/Upload" dianggap selesai: langsung ke Supervisor (terjemahan) / antrean staf (apostille)
      const autoNotes = []
      if (!editing) for (const sp of sub_projects) {
        const st = stagesOf(sp.flow); const first = st[0]; const second = st[1]
        if (!second || !sp.data?.dokumen_sumber) continue
        const toSpv = sp.flow === 'tr_int' && first.key === 'cs_input' && !sp.data.translator
        const toStaf = first.key === 'cs_upload'
        if (!toSpv && !toStaf) continue
        sp.stage = second.key; sp.stage_at = now
        sp.history = [...(sp.history || []), { at: now, by: user.name, action: `${first.label} → ${second.label} · otomatis (dokumen sudah diunggah saat project dibuat)` }]
        if (toStaf && first.notify) autoNotes.push(...first.notify(row, sp, user).map((n) => ({ ...n, text: `${inv} · ${sp.title}: ${n.text}` })))
      }
      const saved = await save('projects', row)
      for (const n of autoNotes) await save('notifications', { ...n, project_id: saved.id, by: user.name, read_by: [] }).catch(() => {})
      // Terjemahan yang belum punya penerjemah/vendor → otomatis minta Supervisor (tembusan Direktur & Superadmin) membagi penerjemah
      if (!editing) {
        const need = sub_projects.filter((s) => s.type === 'terjemahan' && !s.data?.translator && !s.data?.vendor && !s.translator)
        for (const s of need) {
          const text = `${inv} · ${s.title}: Perlu penerjemah — ${s.lang_from || '?'} → ${s.lang_to || '?'}, ${s.pages || s.file_count || 0} hlm, ${(about.priority || 'Normal')}${about.deadline ? `, deadline ${new Date(about.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}` : ''}`
          for (const role of ['supervisor', 'direktur', 'superadmin']) await save('notifications', { to_role: role, kind: 'need_translator', text, project_id: saved.id, sub_id: s.id, by: user.name, read_by: [] }).catch(() => {})
        }
      }
      notify(editing ? 'Project diperbarui' : `Project ${inv} dibuat`)
      onClose(); if (!editing) go(`projects/${saved.id}`)
    } catch (e) { notify(e.message, 'err') } finally { setBusy(false); setProgress('') }
  }

  return (
    <Sheet open xwide tinted onClose={onClose} title={editing ? `Edit ${project.invoice_no}` : 'Project Baru'}
      footer={<><Button variant="outline" className="flex-1 sm:flex-none sm:px-6" onClick={onClose}>Batal</Button><Button className="flex-1" loading={busy} onClick={submit}>{progress || (editing ? 'Simpan Perubahan' : 'Buat Project')}</Button></>}>
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard tone="sky" icon={UserRound} title="Data Pelanggan" aside="Zoho Books">
            <div className="space-y-5">
              <div>
                <CustomerPicker value={customer} invalid={!!E('customer')} onChange={(c) => { setCustomer(c); if (!editing) setInvoice('') }} />
                {E('customer') && <FieldError>{E('customer')}</FieldError>}
              </div>
              <InvoicePicker customer={customer} value={invoice} onChange={setInvoice} error={E('invoice')} />
            </div>
          </SectionCard>

          <SectionCard tone="peach" icon={Truck} title="Alamat Pengiriman & Kurir">
            <div className="space-y-5">
              {customer
                ? (
                  <div className="space-y-2">
                    {editShip
                      ? <ShipEditor ship={customer.ship || {}} onChange={(ship) => setCustomer((c) => ({ ...c, ship }))} onDone={() => setEditShip(false)} />
                      : <CustomerInfo c={customer} part="shipping" />}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {customer.ship_source === 'invoice' && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800"><Sparkles className="h-3 w-3" />Alamat dibaca dari item invoice — periksa</span>}
                      {!editShip && <button type="button" onClick={() => setEditShip(true)} className="inline-flex items-center gap-1 font-semibold text-orange-700 hover:underline"><Pencil className="h-3 w-3" />Edit alamat</button>}
                    </div>
                  </div>
                )
                : <p className="rounded-xl border border-dashed border-orange-300 bg-white/60 px-4 py-6 text-center text-sm text-ink-mute">Alamat pengiriman tampil otomatis setelah pelanggan dipilih.</p>}
              <div>
                <CourierSelect value={about.courier} onChange={(id) => setAbout((a) => ({ ...a, courier: id }))} printLocation={about.print_location} />
              </div>
              <ResiFields about={about} branch={branch} invoice={invoice.trim().toUpperCase()} onChange={(patch) => setAbout((a) => ({ ...a, ...patch }))} />
            </div>
          </SectionCard>
        </div>

        <SectionCard tone="lavender" icon={ClipboardList} title="Tentang Project">
          <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="CS" icon={Headset}><Input value={about.cs_name} readOnly tabIndex={-1} disabled /></Field>
            <Field label="Cabang" icon={Building2}>
              {can.seeAllBranches(user) || isMultiBranch(user)
                ? <Select value={branch} onChange={(e) => setBranch(e.target.value)}>{(can.seeAllBranches(user) ? BRANCHES : branchesOf(user)).map((b) => <option key={b}>{b}</option>)}</Select>
                : <Input value={branch} readOnly tabIndex={-1} disabled />}
            </Field>
            <Field label="Print" icon={Printer}>
              <Select value={about.print_location} onChange={setA('print_location')}>{BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}</Select>
            </Field>
            <Field label="Prioritas" icon={Flag}>
              <PrioritySelect value={about.priority} onChange={(v) => setA('priority')({ target: { value: v } })} />
            </Field>
            <Field label="Tanggal Masuk" icon={CalendarPlus} required><Input type="date" value={about.received_at?.slice(0, 10) || ''} onChange={setA('received_at')} /></Field>
            <Field label="Deadline" icon={CalendarClock} required error={E('deadline')} hint={about.priority === 'Sameday' ? 'Sameday: sama dengan tanggal masuk' : undefined}>
              <div className="flex gap-2">
                <Input type="date" aria-invalid={!!E('deadline')} value={about.deadline?.slice(0, 10) || ''} min={about.received_at?.slice(0, 10)} onChange={setA('deadline')} />
                <Input type="time" value={about.deadline_time || '17:00'} onChange={setA('deadline_time')} className="!w-28" aria-label="Jam deadline" title="Jam deadline (WITA)" />
              </div>
            </Field>
            <Field label="Catatan" icon={StickyNote} hint="Opsional — tampil sebagai ikon catatan di daftar My Project (muncul saat kursor diarahkan)." className="sm:col-span-2">
              <Textarea rows={2} value={about.notes || ''} onChange={setA('notes')} placeholder="mis. Pelanggan minta hasil dikirim ke alamat kantor; nama di ijazah berbeda dengan KTP" />
            </Field>
          </div>
        </SectionCard>

        <SectionCard tone="mint" icon={Layers} title="Sub Project & Detail Dokumen" aside={`${subs.length} sub project`}>
          <div className="space-y-4">
            {autoFill && (
              <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900 ring-1 ring-amber-200">
                <Sparkles className="h-4 w-4 shrink-0 text-amber-600" />
                <span><b className="font-semibold">Diisi otomatis dari {autoFill.invoice_no}</b>: {[autoFill.subs && `${autoFill.subs} sub project`, autoFill.ship && 'alamat kirim', autoFill.courier && `kurir ${autoFill.courier}`, autoFill.priority && `prioritas ${autoFill.priority}`].filter(Boolean).join(' · ') || 'tidak ada item yang dikenali'}. Periksa & edit bila perlu.</span>
                <button type="button" className="ml-auto inline-flex items-center gap-1 font-semibold text-amber-800 hover:underline" onClick={() => zoho.invoiceDetail(autoFill.invoice_no).then((d) => d && applyInvoice(d, { force: true }))}><RefreshCw className="h-3 w-3" />Isi ulang dari invoice</button>
              </div>
            )}
            {subs.map((s, i) => (
              <SubProjectEditor key={s.id ?? s._k} n={i + 1} sub={s} branch={branch} error={tried ? errs.subs[i] : null}
                locked={isStarted(s)}
                onChange={(next) => setSubs((arr) => arr.map((x, j) => (j === i ? next : x)))}
                onRemove={subs.length > 1 && !isStarted(s) ? () => setSubs((a) => a.filter((_, j) => j !== i)) : null} />
            ))}
            <Button type="button" variant="outline" className="w-full border-dashed text-emerald-700 ring-emerald-300 hover:bg-emerald-50" onClick={() => setSubs((a) => [...a, newSub(a[a.length - 1]?.type ?? 'terjemahan')])}><Plus className="h-4 w-4" />Tambah Sub Project</Button>
          </div>
        </SectionCard>

        <SectionCard tone="aqua" icon={CloudUpload} title="Upload File" aside="Google Drive">
          <FileQueue queue={queue} setQueue={setQueue} subs={subs} />
          {editing && (project.files?.length > 0) && <p className="mt-3 text-xs text-ink-mute">{project.files.length} file sudah ada — kelola di halaman detail (File Project).</p>}
        </SectionCard>
      </div>
    </Sheet>
  )
}

function FileQueue({ queue, setQueue, subs }) {
  const [over, setOver] = useState(false)
  const add = (list) => { const files = [...(list || [])]; setQueue((q) => [...q, ...files.map((file) => ({ _k: Math.random(), file, name: file.name, sub_ref: '' }))]) }
  const set = (k, patch) => setQueue((q) => q.map((x) => (x._k === k ? { ...x, ...patch } : x)))
  return (
    <div className="space-y-2.5">
      <label onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files) }}
        className={cx('flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed bg-white px-4 py-6 text-sm font-semibold transition focus-within:ring-2 focus-within:ring-cyan-500',
          over ? 'border-cyan-500 bg-cyan-50 text-cyan-800' : 'border-cyan-300 text-cyan-800 hover:border-cyan-500 hover:bg-cyan-50')}>
        <Upload className="h-5 w-5" />Pilih atau tarik file ke sini
        <span className="text-xs font-normal text-ink-mute">Bisa beberapa file sekaligus · kaitkan tiap file ke sub project</span>
        <input type="file" multiple className="hidden" onChange={(e) => { add(e.target.files); e.target.value = '' }} />
      </label>
      {queue.map((q) => (
        <div key={q._k} className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-2.5 ring-1 ring-slate-200">
          <FileText className="h-4 w-4 shrink-0 text-brand" />
          <Input value={q.name} onChange={(e) => set(q._k, { name: e.target.value })} className="min-w-0 flex-1" aria-label="Nama file" />
          <span className="text-[11px] text-ink-mute">{kb(q.file.size)}</span>
          <Select value={q.sub_ref} onChange={(e) => set(q._k, { sub_ref: e.target.value })} className="w-full sm:w-48" aria-label="Sub project">
            <option value="">Umum (project)</option>
            {subs.map((s, i) => <option key={s.id ?? s._k} value={s.id ?? s._k}>Sub {i + 1} · {(SUB_TYPES[s.type] ?? SUB_TYPES.jasa_lain).label}</option>)}
          </Select>
          <button type="button" onClick={() => setQueue((x) => x.filter((y) => y._k !== q._k))} className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50" aria-label="Batalkan file"><X className="h-4 w-4" /></button>
        </div>
      ))}
    </div>
  )
}

/** Form kecil untuk mengoreksi alamat pengiriman (tersimpan di project, bukan ke Zoho). */
function ShipEditor({ ship, onChange, onDone }) {
  const set = (k) => (e) => onChange({ ...ship, [k]: e.target.value })
  return (
    <div className="grid gap-x-3 gap-y-2.5 rounded-xl bg-white p-3 ring-1 ring-orange-200 sm:grid-cols-2">
      <Field label="Nama penerima"><Input value={ship.attention || ''} onChange={set('attention')} /></Field>
      <Field label="No. HP penerima"><Input value={ship.phone || ''} onChange={set('phone')} inputMode="tel" /></Field>
      <div className="sm:col-span-2"><Field label="Alamat"><Textarea rows={2} value={ship.street1 || ''} onChange={set('street1')} /></Field></div>
      <Field label="Kec/Kab/Kota"><Input value={ship.city || ''} onChange={set('city')} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Provinsi"><Input value={ship.state || ''} onChange={set('state')} /></Field>
        <Field label="Kode pos"><Input value={ship.zip || ''} onChange={set('zip')} inputMode="numeric" /></Field>
      </div>
      <div className="sm:col-span-2 flex justify-end"><Button size="sm" onClick={onDone}><Check className="h-4 w-4" />Selesai</Button></div>
    </div>
  )
}

function CustomerPicker({ value, onChange, invalid }) {
  const [q, setQ] = useState('')
  const [res, setRes] = useState([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (value || q.trim().length < 2) { setRes([]); return }
    const t = setTimeout(async () => {
      setLoading(true); setErr('')
      try { setRes(await zoho.searchContacts(q.trim())) } catch (e) { setErr(e.message) } finally { setLoading(false) }
    }, 350)
    return () => clearTimeout(t)
  }, [q, value])

  const pick = async (c) => {
    setLoading(true); setErr('')
    try { onChange({ ...c, ...((await zoho.contact(c.zoho_id)) || {}) }) } catch (e) { setErr(e.message); onChange(c) } finally { setLoading(false) }
  }

  if (value) return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
      <div className="flex items-center gap-3">
        <UserRound className="h-4 w-4 shrink-0 text-ink-mute" />
        <p className="min-w-0 flex-1 truncate text-base font-bold text-ink">{value.name}</p>
        <button type="button" onClick={() => pick(value)} className="rounded-lg p-1.5 text-brand hover:bg-white" aria-label="Tarik ulang dari Zoho" title="Tarik ulang dari Zoho">
          <RefreshCw className={cx('h-4 w-4', loading && 'animate-spin')} />
        </button>
        <Button size="sm" variant="outline" onClick={() => onChange(null)}>Ganti</Button>
      </div>
      <CustomerInfo c={value} part="customer" plain className="mt-3 border-t border-slate-100 pt-3" />
    </div>
  )
  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input className="h-11 pl-9" aria-invalid={invalid} placeholder="Cari nama / email pelanggan (min. 2 huruf)" value={q} onChange={(e) => setQ(e.target.value)} />
        {loading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-brand" />}
      </div>
      {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}
      {res.length > 0 && (
        <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-slate-200">
          {res.map((c) => (
            <li key={c.zoho_id}><button type="button" onClick={() => pick(c)} className="w-full px-3 py-2.5 text-left hover:bg-slate-50">
              <p className="text-sm font-semibold">{c.name}</p><p className="text-xs text-ink-mute">{c.email || '—'}</p>
            </button></li>
          ))}
        </ul>
      )}
      {!loading && q.trim().length >= 2 && !res.length && !err && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200">
          <span className="min-w-0 flex-1">Tidak ditemukan di data Zoho (disinkron berkala). Pelanggan baru di Zoho muncul paling lama 1 jam — atau isi manual dulu.</span>
          <Button size="sm" variant="outline" onClick={() => onChange({ zoho_id: null, name: q.trim(), email: '', phone: '', city: '', ship: { attention: q.trim() }, manual: true })}>Isi manual: “{q.trim()}”</Button>
        </div>
      )}
    </div>
  )
}

function InvoicePicker({ customer, value, onChange, error }) {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!customer?.zoho_id) { setList([]); return }
    setLoading(true)
    zoho.invoicesOf(customer.zoho_id).then(setList).catch(() => setList([])).finally(() => setLoading(false))
  }, [customer?.zoho_id])

  return (
    <div>
      <span className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-ink-soft"><Receipt className="h-3.5 w-3.5 text-ink-mute" />No. Invoice<span className="text-rose-500" aria-hidden>*</span><span className="ml-auto text-xs font-normal text-ink-mute">dipakai sebagai nama project</span></span>
      <div className="space-y-2">
      {loading && <p className="flex items-center gap-2 text-xs text-ink-mute"><Loader2 className="h-3 w-3 animate-spin" />Memuat invoice dari Zoho…</p>}
      {list.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {list.map((iv) => (
            <button key={iv.invoice_no} type="button" onClick={() => onChange(iv.invoice_no)}
              title={`${tgl(iv.date)} · ${rupiah(iv.total)} · ${iv.status}`} aria-pressed={value === iv.invoice_no} className={cx('flex items-center gap-1.5 rounded-lg px-3 py-2 text-left ring-1 transition', value === iv.invoice_no ? 'bg-brand text-white ring-brand' : 'bg-white ring-slate-300 hover:ring-brand')}>
              <span className="text-sm font-semibold">{iv.invoice_no}</span><span className={cx('text-xs', value === iv.invoice_no ? 'text-white/80' : 'text-ink-mute')}>{rupiah(iv.total)}</span>
              {value === iv.invoice_no && <Check className="h-3.5 w-3.5" />}
            </button>
          ))}
        </div>
      )}
      <Input aria-invalid={!!error} placeholder={customer ? 'atau ketik manual, mis. INV-000245' : 'Pilih pelanggan dulu, atau ketik manual'} value={value} onChange={(e) => onChange(e.target.value)} />
      {error && <FieldError>{error}</FieldError>}
      </div>
    </div>
  )
}
