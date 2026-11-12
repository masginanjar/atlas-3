import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, Plus, ExternalLink, AlertTriangle, Loader2, FileText } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { zoho, payStateOf } from '../lib/integrations.js'
import { can, scopeByBranch, branchOfInvoice, invoiceCode, branchesOf, invoiceLabel, BRANCHES } from '../config/access.js'
import { canSeePayment } from '../config/menuAccess.js'
import { go } from '../lib/router.js'
import { Button, Card, cx } from '../components/ui.jsx'
import { useTabel, Th, CariTabel } from '../components/TabelSortir.jsx'
import { PilihPeriode, FilterLainnya, hariIni, tambahHari } from '../components/ToolbarRingkas.jsx'
import CopyText from '../components/CopyText.jsx'
import ProjectForm from './ProjectForm.jsx'

export { canSeeInvoices, canSeePayment } from '../config/menuAccess.js'
import { PayBadge } from '../components/PayBadge.jsx'



const tgl = (d) => (d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')

/**
 * Periode faktur. Faktur diambil dari salinan Zoho per rentang tanggal, jadi
 * pilihannya per bulan — tanpa ini, bulan terbaru bisa menghabiskan batas baris
 * sehingga bulan sebelumnya tidak pernah muncul.
 */
export const periodeFaktur = (today = hariIni()) => {
  const bln = (geser) => {
    const d = new Date(`${today.slice(0, 7)}-01T00:00:00Z`)
    d.setUTCMonth(d.getUTCMonth() + geser)
    const awal = d.toISOString().slice(0, 10)
    d.setUTCMonth(d.getUTCMonth() + 1)
    return { from: awal, to: tambahHari(d.toISOString().slice(0, 10), -1) }
  }
  const namaBln = (r) => new Date(`${r.from}T00:00:00Z`).toLocaleDateString('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const ini = bln(0); const lalu = bln(-1); const lalu2 = bln(-2)
  return [
    ['30 hari', { from: tambahHari(today, -29), to: today }],
    ['Bulan ini & lalu', { from: lalu.from, to: '' }],
    [namaBln(ini), { from: ini.from, to: ini.to }],
    [namaBln(lalu), lalu],
    [namaBln(lalu2), lalu2],
    ['Semua', { from: '', to: '' }],
  ]
}

/** Jam pembayaran dari Zoho (pembayaran pelanggan): Lunas = pembayaran terakhir, DP = pembayaran pertama. */
function JamBayar({ i }) {
  const at = i.status === 'paid' ? (i.paid_at || i.first_paid_at) : i.status === 'partially_paid' ? (i.first_paid_at || i.paid_at) : ''
  if (!at) return null
  const d = new Date(at)
  const teks = `${d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })} ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(':', '.')}`
  const lunas = i.status === 'paid'
  return <span className={`block whitespace-nowrap text-[11px] font-semibold ${lunas ? 'text-emerald-700' : 'text-amber-700'}`} data-jam-bayar title={lunas ? 'Jam pembayaran lunas tercatat di Zoho' : 'Jam pembayaran DP tercatat di Zoho'}>{lunas ? 'Lunas' : 'DP'} {teks}</span>
}

const hariIniKey = (d) => String(d || '').slice(0, 10) === new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date())
/** Kolom tabel Faktur — judulnya bisa diklik untuk mengurutkan. */
const KOLOM = [
  { key: 'tanggal', label: 'Tanggal', w: '104px', sort: (i) => String(i.date || '') },
  { key: 'invoice', label: 'No. Invoice', w: '132px', sort: (i) => String(i.invoice_no || '').toLowerCase() },
  { key: 'pelanggan', label: 'Nama Pelanggan', w: '22%', sort: (i) => String(i.customer_name || '').toLowerCase() },
  { key: 'cabang', label: 'Cabang', w: '110px', sort: (i) => String(i.branch || branchOfInvoice(i.invoice_no) || '').toLowerCase() },
  { key: 'sales', label: 'CS / Sales', w: '130px', sort: (i) => String(i.salesperson || '').toLowerCase() },
  { key: 'status', label: 'Pembayaran', w: '132px', sort: (i) => String(i.status || '').toLowerCase() },
]

export default function Invoices() {
  const { user, data, notify, invoices: all, invoiceErr: err, refreshInvoices, branchFilter, setBranchFilter, invoiceRange, setInvoiceRange } = useApp()
  // Faktur dipisah per cabang lewat 3 angka di depan nomor invoice (101 Bali, 202 Jakarta, dst.)
  const rows = useMemo(() => {
    if (!all) return all
    const mine = branchesOf(user)
    const { from, to } = invoiceRange || {}
    return all.filter((i) => {
      const d = String(i.date || '').slice(0, 10)
      if (from && d < from) return false
      if (to && d > to) return false
      const b = i.branch || branchOfInvoice(i.invoice_no)
      if (can.seeAllBranches(user)) return branchFilter === 'Semua' || b === branchFilter
      return b && mine.includes(b)
    })
  }, [all, user, branchFilter, invoiceRange])
  const [busy, setBusy] = useState(false)
  const [fStatus, setFStatus] = useState('')
  const [tab, setTab] = useState('unlinked') // unlinked | linked | all — pekerjaan utama CS: faktur yang belum jadi project
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
    if (fStatus && i.status !== fStatus) return false
    return true
  }), [rows, tab, projectOf, fStatus, cabangOf])
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

  const TABS = [['unlinked', 'Belum jadi project', counts.unlinked], ['linked', 'Sudah jadi project', counts.linked], ['all', 'Semua', counts.all]]

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2" data-alat>
        <h1 className="mr-1 flex items-center gap-2 text-2xl font-extrabold tracking-tight">Faktur</h1>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]" role="tablist" aria-label="Status project" data-tab-faktur>
          {TABS.map(([k, label, n]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} data-tab-faktur-item={k}
              className={cx('flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold ring-1 transition', tab === k ? 'bg-ink text-white ring-ink' : k === 'unlinked' && n > 0 ? 'bg-amber-50 text-amber-800 ring-amber-200 hover:ring-amber-400' : 'bg-white text-ink-soft ring-slate-200 hover:ring-brand')}>
              {label}<span className={cx('tabular-nums', tab === k ? 'text-white/70' : 'text-ink-mute')}>{n}</span>
            </button>
          ))}
        </div>
        <div className="ml-auto flex min-w-0 basis-full flex-wrap items-center justify-end gap-2 sm:flex-1 sm:basis-auto sm:flex-nowrap" data-toolbar-faktur>
          <CariTabel value={cari} onChange={setCari} label="Cari no. invoice atau nama pelanggan…" className="min-w-0 flex-1 basis-full sm:max-w-[260px] sm:basis-auto" />
          <PilihPeriode range={invoiceRange} setRange={setInvoiceRange} pilihan={periodeFaktur()} label="Periode" />
          <FilterLainnya aktif={[branchFilter !== 'Semua', fStatus].filter(Boolean).length} onReset={() => { setBranchFilter('Semua'); setFStatus('') }}>
            {(can.seeAllBranches(user) || branchesOf(user).length > 1) && <label className="block text-xs font-semibold text-ink-soft">Cabang
              <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} aria-label="Filter cabang" className="mt-1 h-10 w-full rounded-xl border-0 bg-white pl-3 pr-8 text-sm font-semibold ring-1 ring-slate-200">
                <option value="Semua">{can.seeAllBranches(user) ? 'Semua cabang' : 'Semua cabang saya'}</option>{(can.seeAllBranches(user) ? BRANCHES : branchesOf(user)).map((b) => <option key={b} value={b}>{b}</option>)}
              </select></label>}
            <label className="block text-xs font-semibold text-ink-soft">Status pembayaran
              <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} aria-label="Filter status invoice" className="mt-1 h-10 w-full rounded-xl border-0 bg-white pl-3 pr-8 text-sm font-semibold ring-1 ring-slate-200">
                <option value="">Semua status</option>{statusAda.map((x) => <option key={x} value={x}>{x}</option>)}
              </select></label>
          </FilterLainnya>
          <button type="button" onClick={() => load(true)} disabled={busy} aria-label="Segarkan faktur dari Zoho" title="Segarkan sekarang (otomatis tiap 10 menit)" data-aksi="segarkan-faktur"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-ink-soft ring-1 ring-slate-200 hover:text-brand disabled:opacity-60 sm:h-10 sm:w-10">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </button>
          <span className="hidden text-[11px] text-ink-mute sm:inline">{baris.length} faktur</span>
        </div>
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
                          <td>{hariIniKey(i.date) ? <span className="inline-block whitespace-nowrap rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white" title="Faktur hari ini" data-faktur-hari-ini>{tgl(i.date)}</span> : <span className="whitespace-nowrap text-ink-soft">{tgl(i.date)}</span>}<JamBayar i={i} /></td>
                          <td><span className="font-bold"><CopyText text={invoiceLabel(i.invoice_no)} label="No. Invoice" strong /></span></td>
                          <td><span className="block max-w-[220px] truncate text-ink">{i.customer_name || '—'}</span></td>
                          <td><span className="whitespace-nowrap text-ink-soft">{i.branch || branchOfInvoice(i.invoice_no) || <span className="text-amber-700" title={`Kode ${invoiceCode(i.invoice_no)} belum terdaftar`}>Kode {invoiceCode(i.invoice_no)}</span>}</span></td>
                          <td><span className="block max-w-[130px] truncate text-ink-soft" data-sales title={i.salesperson || ''}>{i.salesperson || '—'}</span></td>
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
