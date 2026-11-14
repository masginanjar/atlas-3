import { useMemo, useState } from 'react'
import { Download, X } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { Button, Input, cx } from './ui.jsx'
import { saveBlob } from '../lib/download.js'
import { BRANCHES, invoiceLabel } from '../config/access.js'
import { DONE, progressOf, stageLabel, flowOf } from '../config/workflows.js'
import { REQ_KINDS, REQ_STATUS, scopeRequests } from './Requests.jsx'
import { SUB_TYPES } from '../config/subtypes.js'

// ============================================================
//  UNDUH DATA — satu pintu untuk semua ekspor.
//  Hanya Superadmin, Direktur, dan Akunting yang boleh mengunduh data
//  mentah; peran lain tetap bisa melihat datanya di layar, tapi tidak
//  bisa membawanya keluar sistem.
// ============================================================

export const canUnduhData = (u) => ['superadmin', 'direktur', 'akunting'].includes(u?.base_role || u?.role)

const hari = (v) => (v ? String(v).slice(0, 10) : '')
/** Tahap paling awal di antara sub project = posisi project saat ini. */
const tahapKini = (p) => {
  const open = (p.sub_projects || []).filter((s) => s.stage !== DONE)
  if (!open.length) return 'Selesai'
  const l = [...new Set(open.map((s) => stageLabel(flowOf(s, p), s.stage)))]
  return l.length > 1 ? `${l[0]} +${l.length - 1}` : l[0]
}
const namaFile = (slug) => `ATLAS-${slug}-${new Date().toISOString().slice(0, 10)}.xlsx`
const VB_STATUS = { menunggu: 'Menunggu ACC', disetujui: 'Disetujui — Menunggu Transfer', dibayar: 'Sudah Dibayar', ditolak: 'Ditolak' }
/** Kolom berisi uang → format ribuan di Excel. */
const UANG = /nominal|nilai|total/i

/** Semua pilihan data. Tiap entri tahu cara menyaring & membentuk barisnya sendiri. */
const DATASET = [
  {
    key: 'project', label: 'Project', ket: 'Satu baris per project (invoice)',
    head: ['No. Invoice', 'Pelanggan', 'Cabang', 'Lokasi Print', 'Prioritas', 'Deadline', 'Jml Sub Project', 'Tahap', 'Progres %', 'Dibuat'],
    ambil: ({ projects }) => projects,
    saring: (p, f) => cocokProject(p, f),
    baris: (p) => [invoiceLabel(p.invoice_no), p.customer?.name || '', p.branch, p.about?.print_location || p.branch,
      p.about?.priority || 'Normal', hari(p.about?.deadline), (p.sub_projects || []).length,
      tahapKini(p), progressOf(p), hari(p.created_at)],
  },
  {
    key: 'dokumen', label: 'Dokumen (sub project)', ket: 'Satu baris per dokumen di dalam project',
    head: ['No. Invoice', 'Pelanggan', 'Cabang', 'Jenis', 'Dokumen', 'Halaman', 'Bahasa', 'Tahap', 'Penerjemah', 'Deadline'],
    ambil: ({ projects, users }) => projects.flatMap((p) => (p.sub_projects || []).map((s) => ({ p, s, users }))),
    saring: ({ p }, f) => cocokProject(p, f),
    baris: ({ p, s, users }) => [invoiceLabel(p.invoice_no), p.customer?.name || '', p.branch,
      SUB_TYPES[s.type || 'jasa_lain']?.label || s.type || '', s.title || s.description || '', Number(s.pages) || '',
      [s.lang_from, s.lang_to].filter(Boolean).join(' → '), s.stage || '',
      users.find((u) => u.id === (s.data?.translator || s.translator))?.name || '', hari(p.about?.deadline)],
  },
  {
    key: 'pelanggan', label: 'Pelanggan', ket: 'Dirangkum dari project — nama, kontak, nilai',
    head: ['Pelanggan', 'Email', 'Telepon', 'Cabang', 'Jumlah Project', 'Nilai', 'Project Terakhir'],
    ambil: ({ projects }, f) => {
      const peta = new Map()
      for (const p of projects) {
        if (!cocokProject(p, f)) continue
        const nama = (p.customer?.name || '').trim(); if (!nama) continue
        const k = p.customer?.zoho_id || nama.toLowerCase()
        if (!peta.has(k)) peta.set(k, { nama, email: '', phone: '', cabang: new Set(), jml: 0, nilai: 0, terakhir: '' })
        const r = peta.get(k)
        if (!r.email && p.customer?.email) r.email = p.customer.email
        if (!r.phone && (p.customer?.ship?.phone || p.customer?.phone)) r.phone = p.customer.ship?.phone || p.customer.phone
        if (p.branch) r.cabang.add(p.branch)
        r.jml += 1; r.nilai += Number(p.about?.total) || 0
        const t = hari(p.created_at); if (t > r.terakhir) r.terakhir = t
      }
      return [...peta.values()].sort((a, b) => b.jml - a.jml)
    },
    saring: () => true,
    baris: (r) => [r.nama, r.email, r.phone, [...r.cabang].join(', '), r.jml, Math.round(r.nilai), r.terakhir],
  },
  {
    key: 'kas', label: 'Kas Kecil', ket: 'Pemasukan & pengeluaran petty cash',
    head: ['Tanggal', 'Akun', 'Jenis', 'Keterangan', 'Nominal', 'Oleh'],
    ambil: ({ petty }) => petty,
    saring: (k, f) => (!f.dari || hari(k.created_at) >= f.dari) && (!f.sampai || hari(k.created_at) <= f.sampai)
      && (!f.cabang || k.branch === f.cabang),
    baris: (k) => [hari(k.created_at), k.branch, k.type === 'in' ? 'Masuk' : 'Keluar', k.note || '', Math.round(Number(k.amount) || 0), k.by || ''],
  },
  {
    key: 'pengajuan', label: 'Pengajuan', ket: 'Top up, refund & pengajuan lain beserta statusnya',
    head: ['Tanggal Diajukan', 'Jenis', 'Keterangan', 'Cabang', 'Pemohon', 'Nominal', 'Sumber Dana', 'Status', 'Bank Penerima', 'No. Rekening', 'Nama Penerima', 'Tanggal Bayar', 'Dibayar Oleh'],
    ambil: ({ requests }) => requests,
    saring: (q, f) => (!f.dari || hari(q.created_at) >= f.dari) && (!f.sampai || hari(q.created_at) <= f.sampai) && (!f.cabang || q.branch === f.cabang),
    baris: (q) => [hari(q.created_at), REQ_KINDS[q.kind]?.label || q.kind, q.purpose || '', q.branch || '', q.requested_name || '', Math.round(Number(q.amount) || 0), q.sumber_dana || '',
      (REQ_STATUS[q.status] || [q.status])[0], q.recipient?.bank || '', q.recipient?.number || '', q.recipient?.holder || '', hari(q.paid_date), q.paid_name || ''],
  },
  {
    key: 'tagihan', label: 'Tagihan Vendor', ket: 'Tagihan vendor/penerjemah lepas & status bayarnya',
    head: ['Tanggal', 'Vendor', 'No. Tagihan Vendor', 'Periode', 'Jml Order', 'Total', 'Sumber Dana', 'Status', 'Tanggal Bayar', 'Dibayar Oleh'],
    ambil: ({ bills, people }) => bills.map((b) => ({ b, v: people.find((x) => x.id === b.vendor_id) })),
    saring: ({ b }, f) => (!f.dari || hari(b.created_at) >= f.dari) && (!f.sampai || hari(b.created_at) <= f.sampai),
    baris: ({ b, v }) => [hari(b.created_at), v?.name || '', b.vendor_invoice_no || '', b.period || '', (b.items || []).length, Math.round(Number(b.total) || 0), b.sumber_dana || '',
      VB_STATUS[b.status] || b.status || '', hari(b.paid_date), b.paid_name || ''],
  },
]

/** Buat 1 file Excel: satu sheet per data, judul tebal & dibekukan, filter, lebar kolom, angka uang berformat ribuan. */
async function bukuExcel(daftar) {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook(); wb.creator = 'ATLAS'; wb.created = new Date()
  for (const { judul, head, rows } of daftar) {
    const ws = wb.addWorksheet(judul.slice(0, 31), { views: [{ state: 'frozen', ySplit: 1 }] })
    ws.addRow(head); rows.forEach((r) => ws.addRow(r))
    const h = ws.getRow(1); h.font = { bold: true, color: { argb: 'FFFFFFFF' } }; h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF141B34' } }; h.alignment = { vertical: 'middle' }; h.height = 20
    head.forEach((t, i) => {
      const col = ws.getColumn(i + 1)
      const lebar = Math.max(String(t).length, ...rows.slice(0, 500).map((r) => String(r[i] ?? '').length))
      col.width = Math.min(48, Math.max(10, lebar + 2))
      if (UANG.test(t)) col.numFmt = '#,##0'
    })
    if (rows.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: head.length } }
  }
  return new Blob([await wb.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

/** Saringan bersama untuk data yang berasal dari project. */
function cocokProject(p, f) {
  if (f.cabang && p.branch !== f.cabang) return false
  const dl = hari(p.about?.deadline) || hari(p.created_at)
  if (f.dari && dl < f.dari) return false
  if (f.sampai && dl > f.sampai) return false
  if (f.status !== 'semua') {
    const selesai = progressOf(p) >= 100
    if (f.status === 'selesai' && !selesai) return false
    if (f.status === 'aktif' && selesai) return false
  }
  return true
}

/**
 * Tombol + popup "Unduh Data". Dipakai di toolbar My Project; bisa dipasang
 * di halaman lain dengan komponen yang sama.
 */
export default function UnduhData({ className, barisMenu, awal, buka: bukaLuar, onClose }) {
  const { data, user, notify } = useApp()
  const [bukaSendiri, setBuka] = useState(false)
  const buka = bukaLuar ?? bukaSendiri
  const tutup = () => { setBuka(false); onClose?.() }
  if (!canUnduhData(user)) return null
  if (bukaLuar !== undefined) return buka ? <DialogUnduh data={data} user={user} notify={notify} awal={awal} onClose={tutup} /> : null
  return (
    <>
      {barisMenu ? (
        <button type="button" onClick={() => setBuka(true)}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-semibold text-ink hover:bg-brand-soft hover:text-brand" data-aksi="menu-unduh">
          <Download className="h-4 w-4 shrink-0" />Unduh data…
        </button>
      ) : (
        <button type="button" onClick={() => setBuka(true)} aria-label="Unduh data" title="Unduh data (pilih data & filter)"
          className={cx('grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-ink-mute ring-1 ring-slate-200 hover:text-brand', className)}>
          <Download className="h-4 w-4" />
        </button>
      )}
      {buka && <DialogUnduh data={data} user={user} notify={notify} awal={awal} onClose={tutup} />}
    </>
  )
}

function DialogUnduh({ data, user, notify, onClose, awal }) {
  const [pilih, setPilih] = useState(awal || ['project'])
  const [f, setF] = useState({ dari: '', sampai: '', cabang: '', status: 'semua' })
  const [sibuk, setSibuk] = useState(false)
  const sumber = useMemo(() => ({ projects: data.projects || [], users: data.users || [], petty: data.petty_cash || [], requests: scopeRequests(user, data.requests || [], 'Semua'), bills: data.vendor_bills || [], people: data.people || [] }), [data, user])

  // Jumlah baris tiap data — dihitung ulang tiap kali filter berubah supaya
  // terlihat dulu berapa banyak yang akan terunduh.
  const jumlah = useMemo(() => {
    const out = {}
    for (const d of DATASET) { try { out[d.key] = d.ambil(sumber, f).filter((r) => d.saring(r, f)).length } catch { out[d.key] = 0 } }
    return out
  }, [sumber, f])

  const togel = (k) => setPilih((a) => (a.includes(k) ? a.filter((x) => x !== k) : [...a, k]))
  const totalBaris = pilih.reduce((a, k) => a + (jumlah[k] || 0), 0)

  const unduh = async () => {
    if (!pilih.length) return notify('Pilih dulu data yang mau diunduh')
    setSibuk(true)
    try {
      const daftar = DATASET.filter((d) => pilih.includes(d.key)).map((d) => ({
        judul: d.label, head: d.head, rows: d.ambil(sumber, f).filter((r) => d.saring(r, f)).map(d.baris),
      }))
      await saveBlob(namaFile(daftar.length === 1 ? pilih[0] : 'data'), await bukuExcel(daftar))
      notify(`${totalBaris} baris diunduh`)
      onClose()
    } catch (e) {
      notify(e?.message || 'Unduhan gagal')
    } finally { setSibuk(false) }
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-end bg-black/40 p-0 sm:place-items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Unduh data"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:max-w-lg sm:rounded-2xl">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="mr-auto text-base font-extrabold">Unduh Data</h2>
          <button type="button" onClick={onClose} aria-label="Tutup" className="grid h-11 w-11 place-items-center rounded-lg text-ink-mute hover:bg-slate-50 md:h-9 md:w-9"><X className="h-4 w-4" /></button>
        </div>

        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-mute">Data yang diunduh</p>
        <div className="space-y-1.5">
          {DATASET.map((d) => (
            <label key={d.key} className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl px-2 ring-1 ring-slate-200 hover:bg-slate-50">
              <input type="checkbox" checked={pilih.includes(d.key)} onChange={() => togel(d.key)}
                className="h-4 w-4 shrink-0 rounded border-slate-300 text-brand" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{d.label}</span>
                <span className="block text-[11px] text-ink-mute">{d.ket}</span>
              </span>
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold tabular-nums text-ink-soft" data-jml={d.key}>{jumlah[d.key]} baris</span>
            </label>
          ))}
        </div>

        <p className="mb-2 mt-4 text-[11px] font-bold uppercase tracking-wide text-ink-mute">Filter</p>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs font-semibold text-ink-soft">Dari tanggal
            <Input type="date" value={f.dari} onChange={(e) => setF((x) => ({ ...x, dari: e.target.value }))} aria-label="Dari tanggal" /></label>
          <label className="text-xs font-semibold text-ink-soft">Sampai tanggal
            <Input type="date" value={f.sampai} min={f.dari || undefined} onChange={(e) => setF((x) => ({ ...x, sampai: e.target.value }))} aria-label="Sampai tanggal" /></label>
          <label className="text-xs font-semibold text-ink-soft">Cabang
            <select value={f.cabang} onChange={(e) => setF((x) => ({ ...x, cabang: e.target.value }))} aria-label="Filter cabang"
              className="h-11 w-full rounded-xl border-0 bg-white px-3 text-sm font-semibold ring-1 ring-slate-200 focus:ring-2 focus:ring-brand">
              <option value="">Semua cabang</option>
              {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
            </select></label>
          <label className="text-xs font-semibold text-ink-soft">Status project
            <select value={f.status} onChange={(e) => setF((x) => ({ ...x, status: e.target.value }))} aria-label="Filter status"
              className="h-11 w-full rounded-xl border-0 bg-white px-3 text-sm font-semibold ring-1 ring-slate-200 focus:ring-2 focus:ring-brand">
              <option value="semua">Semua</option><option value="aktif">Aktif</option><option value="selesai">Selesai</option>
            </select></label>
        </div>
        <p className="mt-2 text-[11px] text-ink-mute">Tanggal memakai deadline project (kalau kosong: tanggal dibuat). Kas Kecil, Pengajuan & Tagihan Vendor memakai tanggal transaksi/pengajuan. Beberapa data sekaligus = 1 file Excel dengan beberapa sheet.</p>

        <div className="mt-4 flex items-center gap-2">
          <span className="mr-auto text-xs font-semibold text-ink-mute" data-total>{pilih.length} data · {totalBaris} baris</span>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={unduh} disabled={sibuk || !pilih.length}><Download className="h-4 w-4" />{sibuk ? 'Menyiapkan…' : 'Unduh Excel'}</Button>
        </div>
      </div>
    </div>
  )
}
