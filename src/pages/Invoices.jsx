import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, Plus, ExternalLink, AlertTriangle, Loader2, FileText } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { zoho, payStateOf } from '../lib/integrations.js'
import { can, scopeByBranch, branchOfInvoice, invoiceCode, branchesOf, invoiceLabel} from '../config/access.js'
import { canSeePayment } from '../config/menuAccess.js'
import { go } from '../lib/router.js'
import { Button, Card, cx } from '../components/ui.jsx'
import { useTabel, Th, CariTabel } from '../components/TabelSortir.jsx'
import CopyText from '../components/CopyText.jsx'
import ProjectForm from './ProjectForm.jsx'

export { canSeeInvoices, canSeePayment } from '../config/menuAccess.js'
import { PayBadge } from '../components/PayBadge.jsx'



const tgl = (d) => (d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')

/** Kolom tabel Faktur — judulnya bisa diklik untuk mengurutkan. */
const KOLOM = [
  { key: 'tanggal', label: 'Tanggal', w: '104px', sort: (i) => String(i.date || '') },
  { key: 'invoice', label: 'No. Invoice', w: '132px', sort: (i) => String(i.invoice_no || '').toLowerCase() },
  { key: 'pelanggan', label: 'Nama Pelanggan', w: '22%', sort: (i) => String(i.customer_name || '').toLowerCase() },
  { key: 'cabang', label: 'Cabang', w: '110px', sort: (i) => String(i.branch || branchOfInvoice(i.invoice_no) || '').toLowerCase() },
  { key: 'status', label: 'Status Invoice', w: '132px', sort: (i) => String(i.status || '').toLowerCase() },
]

export default function Invoices() {
  const { user, data, notify, invoices: all, invoiceErr: err, refreshInvoices, branchFilter } = useApp()
  // Faktur dipisah per cabang lewat 3 angka di depan nomor invoice (101 Bali, 202 Jakarta, dst.)
  const rows = useMemo(() => {
    if (!all) return all
    const mine = branchesOf(user)
    return all.filter((i) => {
      const b = i.branch || branchOfInvoice(i.invoice_no)
      if (can.seeAllBranches(user)) return branchFilter === 'Semua' || b === branchFilter
      return b && mine.includes(b)
    })
  }, [all, user, branchFilter])
  const [busy, setBusy] = useState(false)
  const [fCabang, setFCabang] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [tab, setTab] = useState('all') // all | unlinked | linked
  const [opening, setOpening] = useState('')

  // sumber data: satu tempat di store (dipakai juga untuk angka di menu Faktur)
  const load = useCallback(async (manual) => {
    setBusy(true)
    const ok = await refreshInvoices()
    if (manual) notify(ok ? 'Daftar faktur diperbarui' : 'Gagal menyegarkan faktur', ok ? 'ok' : 'err')
    setBusy(false)
  }, [refreshInvoices, notify])
  useEffect(() => { if (rows === null) load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Project yang sudah terkait: dicocokkan lewat id invoice Zoho, atau nomor invoice bila id belum ada
  const byInvoice = useMemo(() => {
    const m = new Map()
    for (const p of data.projects) {
      if (p.zoho_invoice_id) m.set(`id:${p.zoho_invoice_id}`, p)
      if (p.invoice_no) m.set(`no:${String(p.invoice_no).toUpperCase()}`, p)
    }
    return m
  }, [data.projects])
  const projectOf = useCallback((inv) => byInvoice.get(`id:${inv.zoho_invoice_id}`) || byInvoice.get(`no:${String(inv.invoice_no).toUpperCase()}`), [byInvoice])
  const mine = useMemo(() => new Set(scopeByBranch(user, data.projects).map((p) => p.id)), [data.projects, user])

  const cabangOf = useCallback((i) => i.branch || branchOfInvoice(i.invoice_no) || '', [])
  const cabangAda = useMemo(
    () => [...new Set((rows || []).map(cabangOf).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'id')),
    [rows, cabangOf],
  )
  const statusAda = useMemo(
    () => [...new Set((rows || []).map((i) => i.status).filter(Boolean))].sort(),
    [rows],
  )
  const list = useMemo(() => (rows || []).filter((i) => {
    const p = projectOf(i)
    if (tab === 'linked' && !p) return false
    if (tab === 'unlinked' && p) return false
    if (fCabang && cabangOf(i) !== fCabang) return false
    if (fStatus && i.status !== fStatus) return false
    return true
  }), [rows, tab, projectOf, fCabang, fStatus, cabangOf])
  // Pencarian, filter & urutan disimpan di halaman, jadi tidak hilang saat pop-up dibuka.
  const { rows: baris, sortKey, sortDir, klikJudul, cari, setCari } = useTabel(list, KOLOM)
  const counts = useMemo(() => {
    const all = rows || []
    const linked = all.filter((i) => projectOf(i)).length
    return { all: all.length, linked, unlinked: all.length - linked }
  }, [rows, projectOf])

  // Project Baru dibuka sebagai HALAMAN PENUH. Data pelanggan diambil dulu
  // dari Zoho, lalu dititipkan lewat sessionStorage karena alamat hanya
  // memuat nomor invoice — bukan seluruh isian.
  const openForm = async (inv) => {
    if (opening) return // cegah klik berulang membuat project ganda
    if (projectOf(inv)) return notify('Invoice ini sudah punya project', 'err')
    setOpening(inv.invoice_no)
    let customer = null
    try { if (inv.customer_id) customer = await zoho.contact(inv.customer_id) } catch { /* lanjut tanpa data pelanggan */ }
    if (!customer && inv.customer_name) customer = { zoho_id: inv.customer_id || '', name: inv.customer_name, email: '', phone: '', ship: {} }
    setOpening('')
    const preset = { invoice_no: inv.invoice_no, zoho_invoice_id: inv.zoho_invoice_id, customer }
    try { sessionStorage.setItem(`atlas-preset:${inv.zoho_invoice_id}`, JSON.stringify(preset)) } catch { /* abaikan */ }
    go(`projects/new/${inv.zoho_invoice_id}`)
  }

  const TABS = [['all', 'Semua', counts.all], ['unlinked', 'Belum masuk project', counts.unlinked], ['linked', 'Sudah masuk project', counts.linked]]

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold tracking-tight"><FileText className="h-5 w-5 text-ink-mute" />Faktur</h1>
          <p className="text-sm text-ink-soft">Invoice dari Zoho Books — lihat mana yang sudah dan belum dibuatkan project.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => load(true)} disabled={busy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}Segarkan
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TABS.map(([k, label, n]) => (
          <button key={k} type="button" onClick={() => setTab(k)} aria-pressed={tab === k}
            className={cx('rounded-xl px-3 py-1.5 text-xs font-semibold ring-1 transition', tab === k ? 'bg-ink text-white ring-ink' : 'bg-white text-ink-soft ring-slate-200 hover:ring-brand')}>
            {label} <span className="tabular-nums opacity-70">{n}</span>
          </button>
        ))}
      </div>

      {/* Toolbar: cari · filter cabang & status — tinggi kontrol 34px */}
      <div className="flex flex-wrap items-center gap-2">
        <CariTabel value={cari} onChange={setCari} label="Cari no. invoice atau nama pelanggan…" className="basis-64" />
        <select value={fCabang} onChange={(e) => setFCabang(e.target.value)} aria-label="Filter cabang"
          className="h-[34px] w-auto max-w-full rounded-lg border-0 bg-white pl-2.5 pr-7 text-[13px] font-semibold text-ink ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-brand">
          <option value="">Semua cabang</option>
          {cabangAda.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} aria-label="Filter status invoice"
          className="h-[34px] w-auto max-w-full rounded-lg border-0 bg-white pl-2.5 pr-7 text-[13px] font-semibold text-ink ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-brand">
          <option value="">Semua status</option>
          {statusAda.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        <span className="ml-auto text-[11px] text-ink-mute">{baris.length} faktur</span>
      </div>

      {err && (
        <p role="alert" className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 ring-1 ring-amber-200">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />Sinkronisasi Zoho gagal — daftar di bawah adalah data terakhir yang berhasil dimuat.
        </p>
      )}

      {rows === null ? <Card><p className="px-4 py-10 text-center text-sm text-ink-mute"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Memuat faktur dari Zoho…</p></Card>
        : baris.length === 0 ? <Card><p className="px-4 py-10 text-center text-sm text-ink-mute">Tidak ada faktur yang cocok.</p></Card>
          : (
            <Card className="overflow-hidden">
              <div className="min-w-0 max-w-full overflow-x-auto">
                <table className="tbl-rapat" style={{ minWidth: '840px' }}>
                  <thead>
                    <tr>
                      {KOLOM.map((c) => <Th key={c.key} kolom={c} sortKey={sortKey} sortDir={sortDir} onKlik={klikJudul} />)}
                      <th style={{ width: '168px' }} className="text-right">Project</th>
                    </tr>
                  </thead>
                  <tbody>
                    {baris.map((i) => {
                      const p = projectOf(i)
                      const canOpen = p && mine.has(p.id)
                      return (
                        <tr key={i.zoho_invoice_id || i.invoice_no}>
                          <td><span className="whitespace-nowrap text-ink-soft">{tgl(i.date)}</span></td>
                          <td><span className="font-bold"><CopyText text={invoiceLabel(i.invoice_no)} label="No. Invoice" strong /></span></td>
                          <td><span className="block max-w-[220px] truncate text-ink">{i.customer_name || '—'}</span></td>
                          <td><span className="whitespace-nowrap text-ink-soft">{i.branch || branchOfInvoice(i.invoice_no) || <span className="text-amber-700" title={`Kode ${invoiceCode(i.invoice_no)} belum terdaftar`}>Kode {invoiceCode(i.invoice_no)}</span>}</span></td>
                          <td><PayBadge status={i.status} prefix={false} /></td>
                          <td>
                            <span className="flex items-center justify-end gap-2">
                              {p
                                ? canOpen
                                  ? <button type="button" onClick={() => go(`projects/${p.id}`)} className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100">Sudah Masuk Project<ExternalLink className="h-3 w-3" /></button>
                                  : <span className="whitespace-nowrap rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200" title="Project ada di cabang lain">Sudah Masuk Project</span>
                                : can.editProject(user)
                                  ? <Button size="sm" variant="dark" loading={opening === i.invoice_no} disabled={!!opening && opening !== i.invoice_no} onClick={() => openForm(i)}><Plus className="h-3.5 w-3.5" />Buat Project</Button>
                                  : <span className="whitespace-nowrap text-[11px] text-ink-mute">Belum masuk project</span>}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
      <p className="text-[11px] text-ink-mute">Daftar ini disaring dari 3 angka di depan nomor invoice (101 Bali, 202 Jakarta, 303 Bandung, 304 Yogyakarta, 305 Surabaya, 306 Medan, 307 Semarang, 308 Makassar, 309 Batam), jadi tiap cabang hanya melihat fakturnya sendiri. Nomor dan status invoice mengikuti Zoho Books — tidak diubah dari sini. Status pembayaran hanya informasi, tidak memengaruhi alur kerja project.</p>

    </div>
  )
}
