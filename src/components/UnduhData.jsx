import { useMemo, useState } from 'react'
import { Download, X } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { Button, Input, cx } from './ui.jsx'
import { saveBlob } from '../lib/download.js'
import { BRANCHES, invoiceLabel } from '../config/access.js'
import { DONE, progressOf, stageLabel, flowOf } from '../config/workflows.js'
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
const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
const keCsv = (head, rows) => '﻿' + [head, ...rows].map((r) => r.map(esc).join(';')).join('\r\n')
const namaFile = (slug) => `${slug}-${new Date().toISOString().slice(0, 10)}.csv`

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
]

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
export default function UnduhData({ className, barisMenu }) {
  const { data, user, notify } = useApp()
  const [buka, setBuka] = useState(false)
  if (!canUnduhData(user)) return null
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
      {buka && <DialogUnduh data={data} notify={notify} onClose={() => setBuka(false)} />}
    </>
  )
}

function DialogUnduh({ data, notify, onClose }) {
  const [pilih, setPilih] = useState(['project'])
  const [f, setF] = useState({ dari: '', sampai: '', cabang: '', status: 'semua' })
  const [sibuk, setSibuk] = useState(false)
  const sumber = useMemo(() => ({ projects: data.projects || [], users: data.users || [], petty: data.petty_cash || [] }), [data])

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
      const berkas = DATASET.filter((d) => pilih.includes(d.key)).map((d) => ({
        nama: namaFile(d.key),
        isi: keCsv(d.head, d.ambil(sumber, f).filter((r) => d.saring(r, f)).map(d.baris)),
      }))
      if (berkas.length === 1) {
        await saveBlob(berkas[0].nama, new Blob([berkas[0].isi], { type: 'text/csv;charset=utf-8' }))
      } else {
        const JSZip = (await import('jszip')).default
        const zip = new JSZip()
        for (const b of berkas) zip.file(b.nama, b.isi)
        await saveBlob(`unduh-data-${new Date().toISOString().slice(0, 10)}.zip`, await zip.generateAsync({ type: 'blob' }))
      }
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
        <p className="mt-2 text-[11px] text-ink-mute">Tanggal memakai deadline project (kalau kosong: tanggal dibuat). Untuk Kas Kecil memakai tanggal transaksi.</p>

        <div className="mt-4 flex items-center gap-2">
          <span className="mr-auto text-xs font-semibold text-ink-mute" data-total>{pilih.length} data · {totalBaris} baris</span>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={unduh} disabled={sibuk || !pilih.length}><Download className="h-4 w-4" />{sibuk ? 'Menyiapkan…' : pilih.length > 1 ? 'Unduh ZIP' : 'Unduh CSV'}</Button>
        </div>
      </div>
    </div>
  )
}
