import { useMemo, useState } from 'react'
import { Wallet, Undo2, ShoppingCart, Plus, Upload, FileCheck2, Loader2, ChevronUp, X, Check, Inbox, Ban, Banknote } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { drive } from '../lib/integrations.js'
import { BRANCHES, can, branchesOf, pettyAccountsOf, pettyLabel, APOSTILLE_FUND, scopeByBranch, invoiceLabel} from '../config/access.js'
import { sumberLabel } from '../config/workflows.js'
import { SumberDanaPicker, DownloadBukti, QuickAcc } from './Pengajuan.jsx'
import { recommendFund } from '../config/workflows.js'
import CopyText from './CopyText.jsx'
import { Button, Card, Field, Input, Select, Sheet, Textarea, cx } from './ui.jsx'
import { rupiah, tgl } from '../lib/format.js'
import TimeAgo from './TimeAgo.jsx'
import { FinHead, FinBar, FinRow, FinAmount, FinActions, Rek, FinCell } from './FinLayout.jsx'

// ============================================================
//  PENGAJUAN UMUM (tanpa invoice): Top Up Petty Cash, Refund, Lain-lain.
//  Alur: Menunggu ACC (Direktur + sumber dana) → Disetujui (Akunting transfer)
//        → Dibayar.  Top up yang dibayar otomatis masuk ke saldo petty cash.
// ============================================================
export const REQ_KINDS = {
  topup: { label: 'Top Up Petty Cash', icon: Wallet, tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  refund: { label: 'Refund Pelanggan', icon: Undo2, tone: 'bg-rose-50 text-rose-700 ring-rose-200' },
  lain: { label: 'Pengajuan Lain', icon: ShoppingCart, tone: 'bg-sky-50 text-sky-700 ring-sky-200' },
}
export const REQ_STATUS = {
  menunggu: ['Menunggu ACC', 'bg-amber-50 text-amber-800 ring-amber-200'],
  disetujui: ['Disetujui — Menunggu Transfer', 'bg-sky-50 text-sky-700 ring-sky-200'],
  dibayar: ['Sudah Dibayar', 'bg-emerald-50 text-emerald-700 ring-emerald-200'],
  ditolak: ['Ditolak', 'bg-slate-100 text-slate-600 ring-slate-200'],
}
const Badge = ({ cls, children }) => <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1', cls)}>{children}</span>
export const KindBadge = ({ kind }) => { const k = REQ_KINDS[kind] ?? REQ_KINDS.lain; return <Badge cls={k.tone}><k.icon className="h-3 w-3" />{k.label}</Badge> }
export const ReqStatus = ({ status }) => { const [l, c] = REQ_STATUS[status] ?? REQ_STATUS.menunggu; return <Badge cls={c}>{l}</Badge> }

/** Pengajuan umum yang boleh dilihat user. */
export function scopeRequests(user, all = [], branchFilter = 'Semua') {
  if (can.seeAllFinance(user)) return all.filter((r) => branchFilter === 'Semua' || r.branch === branchFilter)
  const mine = branchesOf(user)
  return all.filter((r) => mine.includes(r.branch) || r.requested_by === user.id)
}

/** Tabel kontrol pengajuan umum di dashboard. bare = tanpa kartu/judul (di dalam grup Keuangan). */
export function RequestBoard({ bare }) {
  const { user, data, save, notify, branchFilter, nameOf } = useApp()
  const defTab = user.role === 'direktur' ? 'menunggu' : user.role === 'akunting' ? 'disetujui' : 'aktif'
  const [tab, setTab] = useState(defTab)
  const [open, setOpen] = useState(() => { try { return localStorage.getItem('atlas-fold-req') !== '0' } catch { return true } })
  const [form, setForm] = useState(false)
  const [row, setRow] = useState({}) // per id: { acc, dana, reject, reason, file, date, busy, up }
  const get = (id) => ({ dana: '', reason: '', date: new Date().toISOString().slice(0, 10), ...row[id] })
  const set = (id, patch) => setRow((r) => ({ ...r, [id]: { ...get(id), ...r[id], ...patch } }))
  const fold = () => setOpen((o) => { try { localStorage.setItem('atlas-fold-req', o ? '0' : '1') } catch { /* abaikan */ } return !o })

  const scoped = useMemo(() => scopeRequests(user, data.requests || [], branchFilter), [data.requests, user, branchFilter])
  const groups = {
    aktif: scoped.filter((r) => ['menunggu', 'disetujui'].includes(r.status)),
    menunggu: scoped.filter((r) => r.status === 'menunggu'),
    disetujui: scoped.filter((r) => r.status === 'disetujui'),
    dibayar: scoped.filter((r) => r.status === 'dibayar'),
    ditolak: scoped.filter((r) => r.status === 'ditolak'),
    semua: scoped,
  }
  const list = [...groups[tab]].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  const TABS = [['aktif', 'Aktif'], ['menunggu', 'Menunggu ACC'], ['disetujui', 'Disetujui'], ['dibayar', 'Dibayar'], ['ditolak', 'Ditolak'], ['semua', 'Semua']]
  const canAcc = can.approveVendor(user)
  const canPay = ['superadmin', 'akunting'].includes(user.role)

  const msg = (r, text, to) => save('notifications', { ...to, text: `Pengajuan ${REQ_KINDS[r.kind]?.label} ${rupiah(r.amount)}: ${text}`, by: user.name, read_by: [] }).catch(() => {})
  const hist = (r, action) => [...(r.history || []), { at: new Date().toISOString(), by: user.name, action }]
  const approve = async (r, dana) => {
    const f = { ...get(r.id), ...(dana ? { dana } : {}) }; if (!f.dana) return notify('Pilih sumber dana', 'err')
    set(r.id, { busy: true })
    try {
      await save('requests', { ...r, status: 'disetujui', sumber_dana: f.dana, approved_by: user.id, approved_name: user.name, approved_at: new Date().toISOString(), history: hist(r, `ACC · dana ${f.dana}`) })
      await msg(r, `disetujui (dana ${f.dana}) — menunggu transfer`, { to_role: 'akunting' }); await msg(r, 'disetujui Direktur', { to_user: r.requested_by })
      notify('Pengajuan disetujui'); set(r.id, { busy: false, acc: false })
    } catch (e) { notify(e.message, 'err'); set(r.id, { busy: false }) }
  }
  const reject = async (r) => {
    const f = get(r.id); if (!f.reason.trim()) return notify('Isi alasan penolakan', 'err')
    set(r.id, { busy: true })
    try {
      await save('requests', { ...r, status: 'ditolak', rejected_reason: f.reason, rejected_name: user.name, rejected_at: new Date().toISOString(), history: hist(r, `Ditolak: ${f.reason}`) })
      await msg(r, `ditolak — ${f.reason}`, { to_user: r.requested_by }); notify('Pengajuan ditolak'); set(r.id, { busy: false, reject: false })
    } catch (e) { notify(e.message, 'err'); set(r.id, { busy: false }) }
  }
  const upload = async (r, file) => {
    if (!file) return
    set(r.id, { up: true })
    try { set(r.id, { file: await drive.upload(file, { branch: r.branch, invoice: 'PENGAJUAN' }), up: false }) } catch (e) { notify(e.message, 'err'); set(r.id, { up: false }) }
  }
  const pay = async (r) => {
    const f = get(r.id); if (!f.file) return notify('Upload bukti transfer dulu', 'err')
    set(r.id, { busy: true })
    try {
      await save('requests', { ...r, status: 'dibayar', bukti_transfer: f.file, paid_date: f.date, paid_by: user.id, paid_name: user.name, paid_at: new Date().toISOString(), history: hist(r, 'Dibayar') })
      if (r.kind === 'topup') await save('petty_cash', { branch: r.fund || r.branch, type: 'in', amount: Number(r.amount), note: `Top up (pengajuan ${r.requested_name})${r.purpose ? ` — ${r.purpose}` : ''}`, project_id: null, request_id: r.id, by: user.name })
      await msg(r, r.kind === 'topup' ? `sudah ditransfer — saldo ${pettyLabel(r.fund || r.branch)} bertambah` : 'sudah dibayar — bukti transfer tersedia', { to_user: r.requested_by, kind: 'payment' })
      notify(r.kind === 'topup' ? 'Dibayar · saldo petty cash bertambah' : 'Pengajuan dibayar'); set(r.id, { busy: false })
    } catch (e) { notify(e.message, 'err'); set(r.id, { busy: false }) }
  }
  const projectOf = (r) => data.projects.find((p) => p.id === r.project_id)

  const Wrap = bare ? 'div' : Card
  const canCreate = !['penerjemah', 'proofreader', 'otorisator', 'staf_apostille'].includes(user.role)
  return (
    <Wrap className={bare ? '' : 'overflow-hidden'}>
      {!bare && <div className="flex flex-wrap items-center gap-2 bg-amber-50 px-4 py-3">
        <Inbox className="h-4 w-4 text-amber-600" />
        <h2 className="font-bold">Pengajuan Umum <span className="text-ink-mute">({groups.aktif.length} aktif)</span></h2>
        <span className="hidden text-xs text-ink-mute md:inline">Top up petty cash · refund · pengajuan lain (tanpa invoice)</span>
        <div className="ml-auto flex items-center gap-2">
          {canCreate && <Button size="sm" onClick={() => setForm(true)}><Plus className="h-3.5 w-3.5" />Buat Pengajuan</Button>}
          <button type="button" onClick={fold} aria-expanded={open} aria-label={`${open ? 'Tutup' : 'Buka'} Pengajuan Umum`} className="grid h-8 w-8 place-items-center rounded-lg bg-white text-ink-soft ring-1 ring-slate-200 hover:text-brand hover:ring-brand">
            <ChevronUp className={cx('h-4 w-4 transition-transform', !open && 'rotate-180')} />
          </button>
        </div>
      </div>}
      {(open || bare) && <>
        <FinBar
          left={TABS.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className={cx('shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold sm:px-2 sm:py-0.5 sm:text-[11px]', tab === k ? 'bg-amber-500 text-white' : 'text-ink-soft hover:bg-amber-50')}>{l} {groups[k].length}</button>)}
          total={list.reduce((a, r) => a + Number(r.amount || 0), 0)}
          right={bare && canCreate && <Button size="sm" onClick={() => setForm(true)}><Plus className="h-3.5 w-3.5" />Buat Pengajuan</Button>} />
        <FinHead />
        {list.length === 0 ? <p className="px-4 py-6 text-center text-sm text-ink-mute">Tidak ada pengajuan.</p> : (
          <ul className="divide-y divide-slate-100">
            {list.map((r) => {
              const f = get(r.id); const p = projectOf(r)
              return (
                <FinRow key={r.id}>
                  {/* Jenis: badge di atas, waktu di bawah */}
                  <span className="block min-w-0">
                    <KindBadge kind={r.kind} />
                    <span className="mt-0.5 flex min-w-0 items-center gap-2"><TimeAgo at={r.created_at} prefix="Diajukan" className="!mt-0" />{r.attachment && <DownloadBukti file={r.attachment} label="Lampiran" />}</span>
                  </span>
                  {/* Deskripsi: keterangan di atas, nama CS & cabang di bawah */}
                  <FinCell title={r.purpose || ''} top={r.purpose || '—'}
                    bottom={<>{r.requested_name || nameOf(r.requested_by)} · {r.branch}{r.kind === 'refund' && p ? <> · <CopyText text={invoiceLabel(p.invoice_no)} label="No. Invoice" strong /> · {p.customer?.name} · <a href={`#/projects/${p.id}`} className="font-semibold text-brand hover:underline">buka</a></> : null}</>} />
                  <FinAmount value={r.amount} sub={r.sumber_dana && can.seeFunding(user) ? `Dana ${r.sumber_dana}` : null} />
                  <span className="min-w-0">{r.kind === 'topup' ? <span className="text-[13px] font-semibold text-emerald-700">→ {pettyLabel(r.fund || r.branch)}</span> : <Rek acc={r.recipient} empty="— (tunai / belum diisi)" />}</span>
                  <span className="min-w-0 text-[13px]"><ReqStatus status={r.status} />
                    {r.status === 'ditolak' && <span className="mt-0.5 block truncate text-[11px] text-ink-mute" title={r.rejected_reason}>{r.rejected_reason}</span>}
                    {r.status === 'dibayar' && <span className="mt-0.5 block text-[11px] text-ink-mute">{tgl(r.paid_date)} · {r.paid_name}</span>}
                    {r.approved_name && r.status !== 'ditolak' && r.status !== 'dibayar' && <span className="block text-[11px] text-ink-mute">ACC {r.approved_name}</span>}
                  </span>
                  <FinActions>
                    {r.status === 'menunggu' && canAcc && (f.acc ? (
                      <span className="w-full space-y-1.5 lg:w-[300px]">
                        <SumberDanaPicker value={f.dana} onChange={(v) => set(r.id, { dana: v })} className="!grid-cols-4" recommended={recommendFund(r.branch)} />
                        <span className="flex justify-end gap-1.5"><Button size="sm" variant="outline" onClick={() => set(r.id, { acc: false })}>Batal</Button><Button size="sm" loading={f.busy} disabled={!f.dana} onClick={() => approve(r)}><Check className="h-3.5 w-3.5" />ACC{f.dana ? ` · ${f.dana}` : ''}</Button></span>
                      </span>
                    ) : f.reject ? (
                      <span className="flex w-full gap-1.5 lg:w-[280px]"><Input value={f.reason} onChange={(e) => set(r.id, { reason: e.target.value })} placeholder="Alasan ditolak" className="!h-8 text-xs" aria-label="Alasan penolakan" /><Button size="sm" variant="danger" loading={f.busy} onClick={() => reject(r)}>Tolak</Button><Button size="sm" variant="ghost" onClick={() => set(r.id, { reject: false })} aria-label="Batal"><X className="h-3.5 w-3.5" /></Button></span>
                    ) : (
                      <><QuickAcc branch={r.branch} busy={f.busy} onAcc={(d) => approve(r, d)} onPick={(d) => set(r.id, { acc: true, dana: d })} /><Button size="sm" variant="outline" className="!h-11 !w-11 sm:!h-8 sm:!w-10" onClick={() => set(r.id, { reject: true })} title="Tolak pengajuan" aria-label="Tolak pengajuan"><Ban className="h-4 w-4" /></Button></>
                    ))}
                    {r.status === 'disetujui' && canPay && (
                      <>
                        <Input type="date" value={f.date} onChange={(e) => set(r.id, { date: e.target.value })} className="!h-8 !w-[116px] shrink-0 !px-1.5 text-xs" aria-label="Tanggal bayar" />
                        {f.file ? <span className="flex max-w-[110px] items-center gap-1 truncate text-xs font-semibold text-emerald-700"><FileCheck2 className="h-4 w-4 shrink-0" />{f.file.name}</span> : (
                          <label title="Upload bukti transfer" aria-label="Upload bukti transfer" className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg bg-white text-ink-soft ring-1 ring-slate-300 hover:text-brand hover:ring-brand sm:h-8 sm:w-10">
                            {f.up ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => upload(r, e.target.files?.[0])} aria-label={`Upload bukti pengajuan ${r.purpose}`} />
                          </label>
                        )}
                        <Button size="sm" className="!h-11 !w-11 sm:!h-8 sm:!w-10" loading={f.busy} disabled={!f.file} onClick={() => pay(r)} title="Tandai sudah dibayar" aria-label="Tandai sudah dibayar"><Banknote className="h-4 w-4" /></Button>
                      </>
                    )}
                    {r.status === 'dibayar' && <DownloadBukti file={r.bukti_transfer} />}
                    {r.status === 'menunggu' && !canAcc && <span className="text-xs text-ink-mute">Menunggu Direktur</span>}
                    {r.status === 'disetujui' && !canPay && <span className="text-xs text-ink-mute">Menunggu Akunting</span>}
                  </FinActions>
                </FinRow>
              )
            })}
          </ul>
        )}
      </>}
      <RequestForm open={form} onClose={() => setForm(false)} />
    </Wrap>
  )
}

/** Formulir pengajuan umum. */
export function RequestForm({ open, onClose, side, onSaved }) {
  const { user, data, save, notify, branchFilter } = useApp()
  const myBranches = can.seeAllBranches(user) ? BRANCHES : branchesOf(user)
  const blank = () => ({ kind: 'topup', branch: myBranches[0], fund: pettyAccountsOf(user).includes(APOSTILLE_FUND) && user.role === 'supervisor' ? APOSTILLE_FUND : myBranches[0], amount: '', purpose: '', project_id: '', recipient: { bank: '', number: '', holder: '' }, attachment: null })
  const [f, setF] = useState(blank)
  const [busy, setBusy] = useState(false)
  const projects = useMemo(() => scopeByBranch(user, data.projects, branchFilter).slice().sort((a, b) => b.invoice_no.localeCompare(a.invoice_no)), [user, data.projects, branchFilter])
  const funds = [...new Set([...(user.role === 'supervisor' || can.seeAllBranches(user) ? [APOSTILLE_FUND] : []), ...myBranches])]
  const up = (patch) => setF((x) => ({ ...x, ...patch }))
  const rec = (k) => (e) => up({ recipient: { ...f.recipient, [k]: e.target.value } })

  const upload = async (file) => {
    if (!file) return
    setBusy(true)
    try { up({ attachment: await drive.upload(file, { branch: f.branch, invoice: 'PENGAJUAN' }) }) } catch (e) { notify(e.message, 'err') } finally { setBusy(false) }
  }
  const submit = async () => {
    if (!(Number(f.amount) > 0)) return notify('Nominal harus lebih dari 0', 'err')
    if (!f.purpose.trim()) return notify('Isi keperluan / alasan', 'err')
    if (f.kind === 'refund' && !f.project_id) return notify('Pilih project yang di-refund', 'err')
    setBusy(true)
    try {
      const p = data.projects.find((x) => x.id === f.project_id)
      const row = { ...f, amount: Number(f.amount), branch: f.kind === 'refund' && p ? p.branch : f.kind === 'topup' && f.fund !== APOSTILLE_FUND ? f.fund : f.branch,
        project_id: f.kind === 'refund' ? f.project_id : null, fund: f.kind === 'topup' ? f.fund : null, status: 'menunggu',
        requested_by: user.id, requested_name: user.name, history: [{ at: new Date().toISOString(), by: user.name, action: 'Diajukan' }] }
      await save('requests', row)
      await save('notifications', { to_role: 'direktur', text: `Pengajuan ${REQ_KINDS[f.kind].label} ${rupiah(row.amount)} dari ${user.name} menunggu ACC`, by: user.name, read_by: [] }).catch(() => {})
      notify('Pengajuan terkirim ke Direktur'); setF(blank()); onSaved?.(); onClose()
    } catch (e) { notify(e.message, 'err') } finally { setBusy(false) }
  }

  return (
    <Sheet open={open} side={side ? "right" : undefined} onClose={onClose} title="Buat Pengajuan"
      footer={<><Button variant="outline" className="flex-1" onClick={onClose}>Batal</Button><Button className="flex-1" loading={busy} onClick={submit}>Ajukan ke Direktur</Button></>}>
      <div className="space-y-4">
        <div role="radiogroup" aria-label="Jenis pengajuan" className="grid grid-cols-3 gap-2">
          {Object.entries(REQ_KINDS).map(([k, x]) => (
            <button key={k} type="button" role="radio" aria-checked={f.kind === k} onClick={() => up({ kind: k })}
              className={cx('flex flex-col items-center gap-1 rounded-xl px-2 py-3 text-xs font-semibold ring-1 transition', f.kind === k ? 'bg-brand text-white ring-brand' : 'bg-white text-ink-soft ring-slate-300 hover:ring-brand')}>
              <x.icon className="h-5 w-5" />{x.label}
            </button>
          ))}
        </div>
        {f.kind === 'topup' && <Field label="Kas yang di-top up" required><Select value={f.fund} onChange={(e) => up({ fund: e.target.value })}>{funds.map((b) => <option key={b} value={b}>{pettyLabel(b)}</option>)}</Select></Field>}
        {f.kind === 'refund' && <Field label="Project yang di-refund" required hint="Ketik nomor invoice atau nama pelanggan untuk mencari">
          <ProjectSearch projects={projects} value={f.project_id} onChange={(id) => up({ project_id: id })} />
        </Field>}
        {f.kind === 'lain' && myBranches.length > 1 && <Field label="Cabang"><Select value={f.branch} onChange={(e) => up({ branch: e.target.value })}>{myBranches.map((b) => <option key={b}>{b}</option>)}</Select></Field>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nominal (Rp)" required hint={f.amount ? rupiah(f.amount) : undefined}><Input type="number" inputMode="numeric" value={f.amount} onChange={(e) => up({ amount: e.target.value })} /></Field>
          <Field label={f.kind === 'refund' ? 'Alasan refund' : 'Keperluan'} required><Input value={f.purpose} onChange={(e) => up({ purpose: e.target.value })} placeholder={f.kind === 'lain' ? 'mis. Token listrik kantor, beli meja' : f.kind === 'topup' ? 'mis. Saldo menipis' : 'mis. Pembatalan order'} /></Field>
        </div>
        {f.kind !== 'topup' && (
          <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
            <p className="mb-2 text-xs font-bold text-ink-soft">Rekening penerima {f.kind === 'refund' ? '(pelanggan)' : '(toko / penyedia — kosongkan bila tunai)'}</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <Input placeholder="Bank" value={f.recipient.bank} onChange={rec('bank')} aria-label="Bank penerima" />
              <Input placeholder="No. rekening" value={f.recipient.number} onChange={rec('number')} aria-label="No. rekening penerima" />
              <Input placeholder="Atas nama" value={f.recipient.holder} onChange={rec('holder')} aria-label="Nama penerima" />
            </div>
          </div>
        )}
        <Field label="Lampiran (nota / foto / tagihan — opsional)">
          {f.attachment ? <p className="flex items-center gap-2 text-sm text-emerald-700"><FileCheck2 className="h-4 w-4" />{f.attachment.name}<button className="ml-auto text-xs text-ink-mute underline" onClick={() => up({ attachment: null })}>hapus</button></p> : (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 py-3 text-sm font-semibold text-ink-soft hover:border-brand hover:text-brand">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}Pilih file
              <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => upload(e.target.files?.[0])} aria-label="Lampiran pengajuan" />
            </label>
          )}
        </Field>
      </div>
    </Sheet>
  )
}


/** Pencarian project (invoice / pelanggan) untuk form pengajuan — pengganti dropdown panjang. */
function ProjectSearch({ projects, value, onChange }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const chosen = projects.find((p) => p.id === value)
  const s = q.trim().toLowerCase()
  const hits = (s ? projects.filter((p) => [p.invoice_no, p.customer?.name, p.branch].join(' ').toLowerCase().includes(s)) : projects).slice(0, 8)
  if (chosen && !open) return (
    <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 ring-1 ring-emerald-200">
      <span className="min-w-0 flex-1 text-sm"><b>{invoiceLabel(chosen.invoice_no)}</b> <span className="text-ink-soft">· {chosen.customer?.name} · {chosen.branch}</span></span>
      <button type="button" onClick={() => { onChange(''); setQ(''); setOpen(true) }} className="text-xs font-semibold text-brand hover:underline">Ganti</button>
    </div>
  )
  return (
    <div className="relative">
      <Input autoFocus={open} value={q} onChange={(e) => { setQ(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} placeholder="Cari invoice / pelanggan…" aria-label="Cari project" />
      {open && (
        <ul role="listbox" className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl bg-white p-1 shadow-xl ring-1 ring-slate-200">
          {hits.length === 0 && <li className="px-3 py-2 text-xs text-ink-mute">Tidak ada project yang cocok.</li>}
          {hits.map((p) => (
            <li key={p.id}><button type="button" role="option" aria-selected={p.id === value} onClick={() => { onChange(p.id); setOpen(false) }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm hover:bg-brand-soft">
              <b>{invoiceLabel(p.invoice_no)}</b><span className="min-w-0 flex-1 truncate text-ink-soft">{p.customer?.name}</span><span className="text-[11px] text-ink-mute">{p.branch}</span>
            </button></li>
          ))}
          {!s && projects.length > 8 && <li className="px-3 py-1 text-[11px] text-ink-mute">Menampilkan 8 terbaru — ketik untuk mencari {projects.length} project.</li>}
        </ul>
      )}
    </div>
  )
}
