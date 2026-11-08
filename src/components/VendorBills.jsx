import { useMemo, useState } from 'react'
import { InvoiceNo } from './badges.jsx'
import { Receipt, Plus, Upload, FileCheck2, Loader2, Check, X, Ban, Banknote } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { drive } from '../lib/integrations.js'
import { can, foreignLang, branchesOf, invoiceLabel} from '../config/access.js'
import { flowOf, DONE, PAYMENT_TERMS, termOf, isBilled, recommendFund } from '../config/workflows.js'
import { SumberDanaPicker, DownloadBukti, QuickAcc } from './Pengajuan.jsx'
import CopyText from './CopyText.jsx'
import { Button, Field, Input, Sheet, cx } from './ui.jsx'
import { rupiah, tgl } from '../lib/format.js'
import TimeAgo from './TimeAgo.jsx'
import { FinHead, FinBar, FinRow, FinAmount, FinActions, Rek, FinCell } from './FinLayout.jsx'

// ============================================================
//  TAGIHAN VENDOR — untuk vendor bertermin "sesuai tagihan" / "bulanan".
//  Order dicatat dulu (tidak langsung dibayar) → kumpulkan order → Buat Tagihan (upload tagihan vendor)
//  → Direktur ACC + sumber dana → Akunting transfer sekali + bukti → tiap order tercatat Lunas
//  (portal vendor menampilkan alokasi 1 transfer ke beberapa proyek).
// ============================================================
const ST = { menunggu: ['Menunggu ACC', 'bg-amber-50 text-amber-800 ring-amber-200'], disetujui: ['Disetujui — Menunggu Transfer', 'bg-sky-50 text-sky-700 ring-sky-200'],
  dibayar: ['Sudah Dibayar', 'bg-emerald-50 text-emerald-700 ring-emerald-200'], ditolak: ['Ditolak', 'bg-slate-100 text-ink-soft ring-slate-200'] }

/** Order vendor bertermin tagihan yang belum masuk tagihan (dan boleh dilihat user). */
export function useUnbilled() {
  const { user, data } = useApp()
  return useMemo(() => {
    const all = can.seeAllBranches(user) || user.role === 'akunting'
    const mine = branchesOf(user)
    return data.projects.flatMap((p) => (p.sub_projects || []).map((s) => ({ ...s, project: p, flow: flowOf(s, p) })))
      .filter((x) => x.flow === 'tr_bill' && ['proses_vendor', DONE].includes(x.stage) && x.data?.vendor && !x.data?.bill_id)
      .filter((x) => all || mine.includes(x.project.branch) || (user.coordinator_lang && foreignLang(x) === user.coordinator_lang) || x.data?.coordinator === user.id)
  }, [data.projects, user])
}

export default function VendorBills() {
  const { user, data, save, notify } = useApp()
  const unbilled = useUnbilled()
  const vendors = data.people.filter((p) => p.type === 'vendor')
  const byVendor = Object.entries(unbilled.reduce((a, x) => { (a[x.data.vendor] ||= []).push(x); return a }, {}))
  const fund = can.seeFunding(user)
  // koordinator hanya melihat tagihan yang ia buat sendiri, tanpa sumber dana
  const bills = [...(data.vendor_bills || [])].filter((b) => fund || b.created_by === user.id).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
  const [make, setMake] = useState(null) // vendor id
  const [row, setRow] = useState({})
  const get = (id) => ({ dana: '', date: new Date().toISOString().slice(0, 10), ...row[id] })
  const set = (id, patch) => setRow((r) => ({ ...r, [id]: { ...get(id), ...r[id], ...patch } }))
  const canAcc = can.approveVendor(user)
  const canPay = ['superadmin', 'akunting'].includes(user.role)
  const vName = (id) => vendors.find((v) => v.id === id)?.name ?? '—'

  // perbarui sub project yang termasuk tagihan
  const patchSubs = async (items, fn) => {
    const byProject = items.reduce((a, it) => { (a[it.project_id] ||= []).push(it); return a }, {})
    for (const [pid, its] of Object.entries(byProject)) {
      const p = data.projects.find((x) => x.id === pid); if (!p) continue
      await save('projects', { ...p, sub_projects: p.sub_projects.map((s) => { const it = its.find((i) => i.sub_id === s.id); return it ? { ...s, data: { ...s.data, ...fn(s, it) } } : s }) })
    }
  }
  // cabang tagihan = cabang terbanyak dari order di dalamnya
  const billBranch = (b) => { const c = {}; b.items.forEach((it) => { const br = data.projects.find((p) => p.id === it.project_id)?.branch; if (br) c[br] = (c[br] || 0) + 1 }); return Object.entries(c).sort((x, y) => y[1] - x[1])[0]?.[0] }
  const approve = async (b, dana) => {
    const f = { ...get(b.id), ...(dana ? { dana } : {}) }; if (!f.dana) return notify('Pilih sumber dana', 'err')
    await save('vendor_bills', { ...b, status: 'disetujui', sumber_dana: f.dana, approved_by: user.id, approved_name: user.name, approved_at: new Date().toISOString() })
    await save('notifications', { to_role: 'akunting', text: `Tagihan ${vName(b.vendor_id)} ${rupiah(b.total)} disetujui (dana ${f.dana}) — menunggu transfer`, by: user.name, read_by: [] }).catch(() => {})
    notify('Tagihan disetujui'); set(b.id, { acc: false })
  }
  const reject = async (b) => {
    const f = get(b.id); if (!f.reason?.trim()) return notify('Isi alasan', 'err')
    await save('vendor_bills', { ...b, status: 'ditolak', rejected_reason: f.reason, rejected_name: user.name, rejected_at: new Date().toISOString() })
    await patchSubs(b.items, () => ({ bill_id: null })) // order kembali ke daftar belum ditagih
    notify('Tagihan ditolak — order kembali ke daftar belum ditagih')
  }
  const upload = async (b, file) => {
    if (!file) return; set(b.id, { up: true })
    try { set(b.id, { file: await drive.upload(file, { branch: 'Tagihan', invoice: `TAGIHAN-${b.vendor_id}` }), up: false }) } catch (e) { notify(e.message, 'err'); set(b.id, { up: false }) }
  }
  const pay = async (b) => {
    const f = get(b.id); if (!f.file) return notify('Upload bukti transfer', 'err')
    const v = vendors.find((x) => x.id === b.vendor_id)
    await save('vendor_bills', { ...b, status: 'dibayar', bukti_transfer: f.file, paid_date: f.date, paid_by: user.id, paid_name: user.name, paid_at: new Date().toISOString(), rekening: v?.accounts?.[0] ?? null })
    await patchSubs(b.items, (s, it) => ({ payments: [...(s.data.payments || []), { amount: it.amount, date: f.date, bukti: f.file, bill_id: b.id }], paid_at: new Date().toISOString(), paid_date: f.date, bukti_transfer: f.file }))
    if (b.created_by) await save('notifications', { to_user: b.created_by, kind: 'payment', text: `Tagihan ${vName(b.vendor_id)} ${rupiah(b.total)} sudah dibayar`, by: user.name, read_by: [] }).catch(() => {})
    notify('Tagihan dibayar — semua order tercatat Lunas')
  }

  return (
    <div>
      <FinBar note={`Order belum ditagih: ${unbilled.length}`} total={bills.filter((b) => b.status !== 'ditolak' && b.status !== 'dibayar').reduce((a, b) => a + Number(b.total || 0), 0)}
        left={byVendor.map(([vid, list]) => {
          const v = vendors.find((x) => x.id === vid)
          return (
            <span key={vid} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-2 py-0.5 text-[11px] text-violet-900 ring-1 ring-violet-200">
              <b>{v?.name}</b><span className="text-violet-700">· {PAYMENT_TERMS[termOf(v)].short} · {list.length} order · {rupiah(list.reduce((a, x) => a + (Number(x.data.vendor_cost) || 0), 0))}</span>
              {!['direktur'].includes(user.role) && <button type="button" onClick={() => setMake(vid)} className="ml-1 inline-flex items-center gap-0.5 rounded-md bg-brand px-1.5 py-0.5 font-semibold text-white hover:bg-brand-dark"><Plus className="h-3 w-3" />Buat Tagihan</button>}
            </span>
          )
        })} />
      <FinHead cols={['Vendor', 'Rincian Tagihan', 'Nominal', 'Rekening Vendor', 'Status', 'Aksi']} />
      {bills.length === 0 ? <p className="px-4 py-6 text-center text-sm text-ink-mute">Belum ada tagihan vendor.</p> : (
        <ul className="divide-y divide-slate-100">{bills.map((b) => {
          const f = get(b.id); const v = vendors.find((x) => x.id === b.vendor_id); const acc = v?.accounts?.[0]
          return (
            <FinRow key={b.id}>
              <span className="block min-w-0">
                <span className="block truncate text-[15px] font-bold leading-snug text-ink">{v?.name}</span>
                <span className="mt-0.5 flex items-center gap-2"><TimeAgo at={b.created_at} prefix="Diajukan" className="!mt-0" />{b.invoice_file && <DownloadBukti file={b.invoice_file} label="File tagihan" />}</span>
              </span>
              <FinCell title={b.items.map((it) => `${invoiceLabel(it.invoice_no)} · ${it.title} · ${rupiah(it.amount)}`).join('\n')}
                top={`${b.items.length} order: ${b.items.map((it) => it.invoice_no).join(', ')}`}
                bottom={`${b.period}${b.vendor_invoice_no ? ` · No. ${invoiceLabel(b.vendor_invoice_no)}` : ''}`} />
              <FinAmount value={b.total} sub={fund && b.sumber_dana ? `Dana ${b.sumber_dana}` : null} />
              <Rek acc={acc} empty="Belum ada rekening vendor" emptyHref="#/settings/vendor" />
              <span className="min-w-0 text-xs"><span className={cx('rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1', ST[b.status][1])}>{ST[b.status][0]}</span>
                {b.rejected_reason && <span className="mt-0.5 block truncate text-[11px] text-ink-mute" title={b.rejected_reason}>{b.rejected_reason}</span>}
                {b.paid_date && <span className="mt-0.5 block text-[11px] text-ink-mute">{tgl(b.paid_date)} · {b.paid_name}</span>}
                {b.approved_name && b.status === 'disetujui' && <span className="block text-[11px] text-ink-mute">ACC {b.approved_name}</span>}
              </span>
              <FinActions>
                {b.status === 'menunggu' && canAcc && (f.acc ? (
                  <span className="w-full space-y-1.5 lg:w-[300px]"><SumberDanaPicker value={f.dana} onChange={(x) => set(b.id, { dana: x })} className="!grid-cols-4" recommended={recommendFund(billBranch(b))} />
                    <span className="flex justify-end gap-1.5"><Button size="sm" variant="outline" onClick={() => set(b.id, { acc: false })}>Batal</Button><Button size="sm" disabled={!f.dana} onClick={() => approve(b)}><Check className="h-3.5 w-3.5" />ACC{f.dana ? ` · ${f.dana}` : ''}</Button></span></span>
                ) : f.rej ? (
                  <span className="flex w-full gap-1.5 lg:w-[280px]"><Input value={f.reason || ''} onChange={(e) => set(b.id, { reason: e.target.value })} placeholder="Alasan" className="!h-8 text-xs" aria-label="Alasan penolakan tagihan" /><Button size="sm" variant="danger" onClick={() => reject(b)}>Tolak</Button><Button size="sm" variant="ghost" onClick={() => set(b.id, { rej: false })} aria-label="Batal"><X className="h-3.5 w-3.5" /></Button></span>
                ) : <><QuickAcc branch={billBranch(b)} onAcc={(d) => approve(b, d)} onPick={(d) => set(b.id, { acc: true, dana: d })} /><Button size="sm" variant="outline" className="!h-11 !w-11 sm:!h-8 sm:!w-10" onClick={() => set(b.id, { rej: true })} title="Tolak tagihan" aria-label="Tolak tagihan"><Ban className="h-4 w-4" /></Button></>)}
                {b.status === 'disetujui' && canPay && (
                  <>
                    <Input type="date" value={f.date} onChange={(e) => set(b.id, { date: e.target.value })} className="!h-8 !w-[130px] !px-2 text-xs" aria-label="Tanggal bayar tagihan" />
                    {f.file ? <span className="flex max-w-[110px] items-center gap-1 truncate text-xs font-semibold text-emerald-700"><FileCheck2 className="h-4 w-4" />{f.file.name}</span> : (
                      <label title="Upload bukti transfer" aria-label="Upload bukti transfer" className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg bg-white ring-1 ring-slate-300 hover:ring-brand sm:h-8 sm:w-10">{f.up ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => upload(b, e.target.files?.[0])} aria-label={`Upload bukti tagihan ${v?.name}`} /></label>
                    )}
                    <Button size="sm" className="!h-11 !w-11 sm:!h-8 sm:!w-10" disabled={!f.file || !acc} onClick={() => pay(b)} title="Tandai sudah dibayar" aria-label="Tandai sudah dibayar"><Banknote className="h-4 w-4" /></Button>
                  </>
                )}
                {b.status === 'dibayar' && <DownloadBukti file={b.bukti_transfer} />}
                {b.status === 'menunggu' && !canAcc && <span className="text-xs text-ink-mute">Menunggu Direktur</span>}
                {b.status === 'disetujui' && !canPay && <span className="text-xs text-ink-mute">Menunggu Akunting</span>}
              </FinActions>
            </FinRow>
          )
        })}</ul>
      )}
      {make && <BillForm vendor={vendors.find((x) => x.id === make)} orders={unbilled.filter((x) => x.data.vendor === make)} onClose={() => setMake(null)} patchSubs={patchSubs} />}
    </div>
  )
}

function BillForm({ vendor, orders, onClose, patchSubs }) {
  const { user, save, notify } = useApp()
  const [sel, setSel] = useState(orders.map((o) => o.id))
  const [amt, setAmt] = useState(Object.fromEntries(orders.map((o) => [o.id, o.data.vendor_cost ?? ''])))
  const now = new Date()
  const [period, setPeriod] = useState(termOf(vendor) === 'monthly' ? now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) : '')
  const [no, setNo] = useState('')
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const chosen = orders.filter((o) => sel.includes(o.id))
  const total = chosen.reduce((a, o) => a + (Number(amt[o.id]) || 0), 0)
  const upload = async (f) => { if (!f) return; setBusy(true); try { setFile(await drive.upload(f, { branch: 'Tagihan', invoice: `TAGIHAN-${vendor.id}` })) } catch (e) { notify(e.message, 'err') } finally { setBusy(false) } }
  const submit = async () => {
    if (!chosen.length) return notify('Pilih minimal 1 order', 'err')
    if (chosen.some((o) => !(Number(amt[o.id]) > 0))) return notify('Isi nominal setiap order', 'err')
    if (!file) return notify('Upload tagihan dari vendor', 'err')
    setBusy(true)
    try {
      const items = chosen.map((o) => ({ project_id: o.project.id, sub_id: o.id, invoice_no: o.project.invoice_no, title: o.title, amount: Number(amt[o.id]) }))
      const bill = await save('vendor_bills', { vendor_id: vendor.id, term: termOf(vendor), period, vendor_invoice_no: no, invoice_file: file, items, total, status: 'menunggu', created_by: user.id, created_name: user.name })
      await patchSubs(items, (s, it) => ({ bill_id: bill.id, total_pengajuan: it.amount }))
      await save('notifications', { to_role: 'direktur', text: `Tagihan vendor ${vendor.name} ${rupiah(total)} (${items.length} order) menunggu ACC`, by: user.name, read_by: [] }).catch(() => {})
      notify('Tagihan diajukan ke Direktur'); onClose()
    } catch (e) { notify(e.message, 'err') } finally { setBusy(false) }
  }
  return (
    <Sheet open onClose={onClose} wide title={<span className="inline-flex items-center gap-2"><Receipt className="h-4 w-4 text-brand" />Buat Tagihan · {vendor?.name}</span>}
      footer={<><Button variant="outline" className="flex-1" onClick={onClose}>Batal</Button><Button className="flex-1" loading={busy} onClick={submit}>Ajukan Tagihan {rupiah(total)}</Button></>}>
      <div className="space-y-4">
        <p className="rounded-xl bg-violet-50 px-3 py-2 text-xs text-violet-800 ring-1 ring-violet-200">Termin: <b>{PAYMENT_TERMS[termOf(vendor)].label}</b>. Pilih order yang ada di tagihan vendor, sesuaikan nominal dengan tagihan, lalu ajukan ke Direktur.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Periode / keterangan"><Input value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="mis. Oktober 2026" /></Field>
          <Field label="No. tagihan vendor"><Input value={no} onChange={(e) => setNo(e.target.value)} placeholder="opsional" /></Field>
        </div>
        <Field label="Upload tagihan dari vendor" required>
          {file ? <p className="flex items-center gap-2 text-sm text-emerald-700"><FileCheck2 className="h-4 w-4" />{file.name}<button className="ml-auto text-xs text-ink-mute underline" onClick={() => setFile(null)}>ganti</button></p> : (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 py-3 text-sm font-semibold text-ink-soft hover:border-brand hover:text-brand">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}Pilih file tagihan
              <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => upload(e.target.files?.[0])} aria-label="File tagihan vendor" /></label>
          )}
        </Field>
        <Field label={`Order (${chosen.length}/${orders.length})`}>
          <ul className="space-y-1.5">{orders.map((o) => (
            <li key={o.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 ring-1 ring-slate-200">
              <input type="checkbox" checked={sel.includes(o.id)} onChange={() => setSel((x) => (x.includes(o.id) ? x.filter((y) => y !== o.id) : [...x, o.id]))} aria-label={`Pilih ${invoiceLabel(o.project.invoice_no)}`} />
              <span className="min-w-0 flex-1 text-sm"><InvoiceNo project={o.project} /> · {o.title}<span className="block text-xs text-ink-mute">{o.data.vendor_service} · order {tgl(o.data.ordered_at)}{o.stage === DONE ? ' · hasil diterima' : ' · masih dikerjakan'}</span></span>
              <Input type="number" inputMode="numeric" value={amt[o.id]} onChange={(e) => setAmt((a) => ({ ...a, [o.id]: e.target.value }))} className="!w-32 text-right" aria-label={`Nominal ${invoiceLabel(o.project.invoice_no)}`} />
            </li>
          ))}</ul>
        </Field>
        <p className="text-right text-sm">Total tagihan: <b className="text-lg">{rupiah(total)}</b></p>
      </div>
    </Sheet>
  )
}

export const billBadgeCount = (user, bills, unbilledCount) => (user.role === 'direktur' ? bills.filter((b) => b.status === 'menunggu').length
  : user.role === 'akunting' ? bills.filter((b) => b.status === 'disetujui').length : unbilledCount + bills.filter((b) => b.status === 'menunggu' && b.created_by === user.id).length)
export { isBilled }
