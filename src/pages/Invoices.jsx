import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, Search, Plus, ExternalLink, AlertTriangle, Loader2, FileText } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { zoho, payStateOf } from '../lib/integrations.js'
import { can, scopeByBranch, branchOfInvoice, invoiceCode, branchesOf, invoiceLabel} from '../config/access.js'
import { canSeePayment } from '../config/menuAccess.js'
import { go } from '../lib/router.js'
import { Button, Card, cx } from '../components/ui.jsx'
import CopyText from '../components/CopyText.jsx'
import ProjectForm from './ProjectForm.jsx'

export { canSeeInvoices, canSeePayment } from '../config/menuAccess.js'
import { PayBadge } from '../components/PayBadge.jsx'



const tgl = (d) => (d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')

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
  const [q, setQ] = useState('')
  const [tab, setTab] = useState('all') // all | unlinked | linked
  const [form, setForm] = useState(null) // { invoice, customer } → panel kanan
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

  const list = useMemo(() => {
    const term = q.trim().toLowerCase()
    return (rows || []).filter((i) => {
      const p = projectOf(i)
      if (tab === 'linked' && !p) return false
      if (tab === 'unlinked' && p) return false
      if (!term) return true
      return String(i.invoice_no).toLowerCase().includes(term) || String(i.customer_name).toLowerCase().includes(term)
    })
  }, [rows, q, tab, projectOf])
  const counts = useMemo(() => {
    const all = rows || []
    const linked = all.filter((i) => projectOf(i)).length
    return { all: all.length, linked, unlinked: all.length - linked }
  }, [rows, projectOf])

  const openForm = async (inv) => {
    if (opening || form) return // cegah klik berulang membuat panel/project ganda
    if (projectOf(inv)) return notify('Invoice ini sudah punya project', 'err')
    setOpening(inv.invoice_no)
    let customer = null
    try { if (inv.customer_id) customer = await zoho.contact(inv.customer_id) } catch { /* lanjut tanpa data pelanggan */ }
    if (!customer && inv.customer_name) customer = { zoho_id: inv.customer_id || '', name: inv.customer_name, email: '', phone: '', ship: {} }
    setOpening('')
    setForm({ invoice_no: inv.invoice_no, zoho_invoice_id: inv.zoho_invoice_id, customer })
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

      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari no. invoice atau nama pelanggan…" aria-label="Cari faktur"
          className="w-full rounded-xl border-0 bg-white py-2.5 pl-9 pr-3 text-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-brand" />
      </label>

      {err && (
        <p role="alert" className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 ring-1 ring-amber-200">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />Sinkronisasi Zoho gagal — daftar di bawah adalah data terakhir yang berhasil dimuat.
        </p>
      )}

      <Card className="overflow-visible p-0">
        <div className="sticky top-[var(--appbar)] z-10 hidden grid-cols-[104px_minmax(0,1.1fr)_minmax(0,1.3fr)_96px_124px_minmax(0,1fr)] gap-3 rounded-t-2xl border-b border-slate-200 bg-slate-50/95 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-ink-mute backdrop-blur lg:grid">
          <span>Tanggal</span><span>No. Invoice</span><span>Nama Pelanggan</span><span>Cabang</span><span>Status Invoice</span><span className="text-right">Project</span>
        </div>
        {rows === null ? <p className="px-4 py-10 text-center text-sm text-ink-mute"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Memuat faktur dari Zoho…</p>
          : list.length === 0 ? <p className="px-4 py-10 text-center text-sm text-ink-mute">Tidak ada faktur yang cocok.</p>
            : (
              <ul className="divide-y divide-slate-100">
                {list.map((i, idx) => {
                  const p = projectOf(i)
                  const canOpen = p && mine.has(p.id)
                  return (
                    <li key={i.zoho_invoice_id || i.invoice_no} className={cx('grid gap-1 px-4 py-2.5 lg:grid-cols-[104px_minmax(0,1.1fr)_minmax(0,1.3fr)_96px_124px_minmax(0,1fr)] lg:items-center lg:gap-3', idx % 2 && 'bg-slate-50/70')}>
                      <p className="text-xs text-ink-soft">{tgl(i.date)}</p>
                      <p className="text-sm font-bold"><CopyText text={invoiceLabel(i.invoice_no)} label="No. Invoice" strong /></p>
                      <p className="truncate text-sm text-ink">{i.customer_name || '—'}</p>
                      <p className="truncate text-xs text-ink-soft">{i.branch || branchOfInvoice(i.invoice_no) || <span className="text-amber-700" title={`Kode ${invoiceCode(i.invoice_no)} belum terdaftar`}>Kode {invoiceCode(i.invoice_no)}</span>}</p>
                      <p><PayBadge status={i.status} prefix={false} /></p>
                      <div className="flex items-center gap-2 lg:justify-end">
                        {p
                          ? canOpen
                            ? <button type="button" onClick={() => go(`projects/${p.id}`)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100">Sudah Masuk Project<ExternalLink className="h-3 w-3" /></button>
                            : <span className="rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200" title="Project ada di cabang lain">Sudah Masuk Project</span>
                          : can.editProject(user)
                            ? <Button size="sm" variant="dark" loading={opening === i.invoice_no} disabled={!!form || (!!opening && opening !== i.invoice_no)} onClick={() => openForm(i)}><Plus className="h-3.5 w-3.5" />Buat Project</Button>
                            : <span className="text-[11px] text-ink-mute">Belum masuk project</span>}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
      </Card>
      <p className="text-[11px] text-ink-mute">Daftar ini disaring dari 3 angka di depan nomor invoice (101 Bali, 202 Jakarta, 303 Bandung, 304 Yogyakarta, 305 Surabaya, 306 Medan, 307 Semarang, 308 Makassar, 309 Batam), jadi tiap cabang hanya melihat fakturnya sendiri. Nomor dan status invoice mengikuti Zoho Books — tidak diubah dari sini. Status pembayaran hanya informasi, tidak memengaruhi alur kerja project.</p>

      {form && (
        <ProjectForm side preset={form} onClose={() => setForm(null)}
          onSaved={() => { setForm(null) /* filter & posisi scroll tetap; tanda berubah sendiri karena project baru masuk daftar */ }} />
      )}
    </div>
  )
}
