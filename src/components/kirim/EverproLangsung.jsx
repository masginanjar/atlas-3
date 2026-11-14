// ============================================================
//  PENGIRIMAN — semua kiriman di akun Everpro, langsung dari ATLAS.
//  Tim tidak perlu buka dashboard Everpro: lihat status, salin resi,
//  cetak label (satu / banyak sekaligus), lacak, unduh Excel, buka project.
//  Data diambil dari server (fungsi everpro, aksi 'daftar'); kunci Everpro
//  tetap di server. Khusus pengelola (daftar Everpro tidak dibagi per cabang).
// ============================================================
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Truck, Printer, MapPin, Copy, RefreshCw, Search, ArrowUpRight, Download, PackageCheck, AlertTriangle, Clock, XCircle, Loader2 } from 'lucide-react'
import { useApp } from '../../lib/store.jsx'
import { Button, Input, Sheet, Empty, Tabs, cx } from '../ui.jsx'
import { rupiah } from '../../lib/format.js'
import { panggil, bukaLabel, Riwayat } from '../KirimEverpro.jsx'
import { bukuExcel } from '../UnduhData.jsx'
import { LogoKurir } from './bersama.jsx'
import { saveBlob } from '../../lib/download.js'
import { go } from '../../lib/router.js'

export const canSeePengiriman = (u) => ['superadmin', 'direktur', 'admin_pusat', 'akunting', 'supervisor'].includes(u?.role)

/** Kelompok status (teks status Everpro bisa berbeda per kurir). */
export function kelompok(s) {
  const t = String(s || '').toUpperCase()
  if (/CANCEL/.test(t)) return 'batal'
  if (/FAIL|TROUBLE|RETURN|REJECT|LOST|BROKEN|FORCE/.test(t)) return 'masalah'
  if (/DELIVERED|SELESAI|DITERIMA/.test(t)) return 'selesai'
  if (/WAIT|PENDING|MENUNGGU|DRAFT|NEW/.test(t)) return 'menunggu'
  return 'jalan'
}
const GRUP = {
  semua: ['Semua', null, ''],
  menunggu: ['Menunggu jemput / antar', Clock, 'bg-sky-50 text-sky-700 ring-sky-200'],
  jalan: ['Dalam perjalanan', Truck, 'bg-indigo-50 text-indigo-700 ring-indigo-200'],
  selesai: ['Diterima', PackageCheck, 'bg-emerald-50 text-emerald-700 ring-emerald-200'],
  masalah: ['Bermasalah', AlertTriangle, 'bg-rose-50 text-rose-700 ring-rose-200'],
  batal: ['Dibatalkan', XCircle, 'bg-slate-100 text-slate-600 ring-slate-200'],
}
const TERJEMAH = {
  'WAITING FOR PICKUP': 'Menunggu dijemput', 'WAITING FOR DROP OFF': 'Menunggu diantar ke agen', WAITING: 'Menunggu', 'FAILED PICKUP': 'Gagal dijemput',
  PICKEDUP: 'Sudah dijemput', 'PICKED UP': 'Sudah dijemput', 'ON PROCESS': 'Dalam perjalanan', 'IN PROCESS': 'Dalam perjalanan', 'ON DELIVERY': 'Diantar kurir',
  DELIVERED: 'Diterima', 'IN TROUBLE': 'Bermasalah', 'IN PROCESS RETURN': 'Proses retur', RETURN: 'Diretur', RETURNED: 'Diretur', REJECTED: 'Ditolak',
  CANCELED: 'Dibatalkan', CANCELLED: 'Dibatalkan', 'LOST/BROKEN': 'Hilang / rusak', 'FORCE MAJEURE': 'Force majeure',
}
export const labelStatus = (s) => TERJEMAH[String(s || '').toUpperCase()] || String(s || '-').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())

const tgl = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(d)
const kota = (lok) => { const a = String(lok || '').split(',').map((x) => x.trim()).filter(Boolean); return a.length >= 3 ? a[2].replace(/, Kota$/, '') : a.join(', ') }

export default function EverproLangsung() {
  const { notify } = useApp()
  const [dari, setDari] = useState(() => tgl(new Date(Date.now() - 30 * 864e5)))
  const [sampai, setSampai] = useState(() => tgl(new Date()))
  const [cari, setCari] = useState('')
  const [kata, setKata] = useState('')
  const [grup, setGrup] = useState('semua')
  const [rows, setRows] = useState([])
  const [hal, setHal] = useState({ page: 1, total_page: 1 })
  const [muat, setMuat] = useState(false)
  const [galat, setGalat] = useState('')
  const [pilih, setPilih] = useState(new Set())
  const [lacak, setLacak] = useState(null)
  const [sibuk, setSibuk] = useState('')

  const ambil = useCallback(async (page = 1) => {
    setMuat(true); setGalat('')
    const x = await panggil('daftar', { dari, sampai, cari: kata, page, limit: 50 })
    setMuat(false)
    if (!x.ok) { setGalat(x.alasan || 'Gagal mengambil data Everpro'); return }
    setRows((r) => (page === 1 ? x.data || [] : [...r, ...(x.data || [])]))
    const p = x.pagination || {}
    setHal({ page, total_page: Number(p.total_page ?? p.last_page ?? 1) || 1, total: p.total_data ?? p.total ?? null })
    if (page === 1) setPilih(new Set())
  }, [dari, sampai, kata])
  useEffect(() => { ambil(1) }, [ambil])

  const hitung = useMemo(() => { const c = { semua: rows.length }; for (const r of rows) { const g = kelompok(r.status); c[g] = (c[g] || 0) + 1 } return c }, [rows])
  const tampil = useMemo(() => rows.filter((r) => grup === 'semua' || kelompok(r.status) === grup), [rows, grup])
  const totalOngkir = useMemo(() => tampil.filter((r) => kelompok(r.status) !== 'batal').reduce((a, r) => a + (Number(r.harga) || 0), 0), [tampil])
  const bisaCetak = tampil.filter((r) => r.awb && kelompok(r.status) !== 'batal')
  const semuaDipilih = bisaCetak.length > 0 && bisaCetak.every((r) => pilih.has(r.awb))


  const salin = async (t) => { try { await navigator.clipboard.writeText(t); notify('Resi disalin') } catch { notify('Gagal menyalin', 'err') } }
  const cetak = async (awbs) => { setSibuk('cetak'); await bukaLabel({ awbs }, notify); setSibuk('') }
  const bukaLacak = async (r) => {
    setSibuk(`lacak:${r.awb}`); const x = await panggil('lacak_awb', { nomor: r.awb || r.client_order_no }); setSibuk('')
    if (!x.ok) return notify(x.alasan || 'Gagal melacak', 'err'); setLacak({ r, data: x.lacak || {} })
  }
  const unduh = async () => {
    const head = ['Tanggal', 'No. Order ATLAS', 'No. Everpro', 'Resi', 'Kurir', 'Jenis', 'Status', 'Penerima', 'Tujuan', 'Pengirim', 'Berat (kg)', 'Total ongkir', 'Invoice']
    const isi = tampil.map((r) => [String(r.dibuat || '').slice(0, 16), r.client_order_no, r.no_everpro, r.awb, [r.kurir, r.layanan].filter(Boolean).join(' '), r.jenis === 'DROP' ? 'Antar ke agen' : 'Dijemput', labelStatus(r.status), r.penerima, r.tujuan, r.pengirim, r.berat ?? '', Math.round(Number(r.harga) || 0), r.project?.invoice_no || ''])
    await saveBlob(`Pengiriman Everpro ${dari} sd ${sampai}.xlsx`, await bukuExcel([{ judul: 'Pengiriman', head, rows: isi }]))
  }
  const ganti = (awb) => setPilih((s) => { const n = new Set(s); if (n.has(awb)) n.delete(awb); else n.add(awb); return n })

  return (
    <div className="w-full space-y-3" data-tab-kiriman>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button size="sm" variant="outline" onClick={() => ambil(1)} loading={muat && hal.page === 1}><RefreshCw className="h-4 w-4" />Segarkan</Button>
        <Button size="sm" variant="outline" onClick={unduh} disabled={!tampil.length}><Download className="h-4 w-4" />Unduh Excel</Button>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-2xl bg-white p-3 ring-1 ring-[#E7E8F0] dark:bg-white/5 dark:ring-white/10">
        <label className="text-[11px] font-semibold text-ink-mute">Dari<Input type="date" value={dari} max={sampai} onChange={(e) => setDari(e.target.value)} className="mt-0.5 w-[150px]" /></label>
        <label className="text-[11px] font-semibold text-ink-mute">Sampai<Input type="date" value={sampai} min={dari} onChange={(e) => setSampai(e.target.value)} className="mt-0.5 w-[150px]" /></label>
        <form className="flex min-w-[220px] flex-1 items-end gap-1.5" onSubmit={(e) => { e.preventDefault(); setKata(cari.trim()) }}>
          <label className="flex-1 text-[11px] font-semibold text-ink-mute">Cari resi / nama penerima / no. order
            <Input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="mis. JO0331… atau nama" className="mt-0.5" data-cari-kirim />
          </label>
          <Button size="sm" type="submit"><Search className="h-4 w-4" />Cari</Button>
        </form>
      </div>

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Saring status">
        {Object.entries(GRUP).map(([k, [lbl, Ik]]) => (
          <button key={k} type="button" role="tab" aria-selected={grup === k} onClick={() => setGrup(k)} data-grup={k}
            className={cx('inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-xs font-semibold ring-1 transition sm:h-8', grup === k ? 'bg-[#141B34] text-white ring-[#141B34]' : 'bg-white text-ink-soft ring-slate-200 hover:ring-brand dark:bg-white/5')}>
            {Ik && <Ik className="h-3.5 w-3.5" aria-hidden="true" />}{lbl}<span className="opacity-70">{hitung[k] || 0}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-mute">
        <span>{tampil.length} kiriman · total ongkir <b className="text-ink">{rupiah(totalOngkir)}</b>{hal.total ? ` · ${hal.total} di Everpro untuk rentang ini` : ''}</span>
        {bisaCetak.length > 0 && (
          <label className="ml-auto inline-flex items-center gap-1.5 font-semibold">
            <input type="checkbox" className="h-4 w-4" checked={semuaDipilih} onChange={() => setPilih(semuaDipilih ? new Set() : new Set(bisaCetak.map((r) => r.awb)))} data-pilih-semua />Pilih semua yang punya resi
          </label>
        )}
        <Button size="sm" disabled={!pilih.size} loading={sibuk === 'cetak'} onClick={() => cetak([...pilih])} data-aksi="cetak-massal"><Printer className="h-4 w-4" />Cetak label{pilih.size ? ` (${pilih.size})` : ''}</Button>
      </div>

      {galat && <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-rose-200">{galat}</p>}
      {muat && !rows.length && <p className="flex items-center gap-2 p-6 text-sm text-ink-mute"><Loader2 className="h-4 w-4 animate-spin" />Mengambil data dari Everpro…</p>}
      {!muat && !galat && !tampil.length && <Empty icon={Truck} title="Belum ada kiriman" text="Tidak ada kiriman Everpro untuk saringan ini." />}

      <ul className="space-y-2" data-daftar-kirim>
        {tampil.map((r) => {
          const g = kelompok(r.status); const [, Ik, cls] = GRUP[g]
          return (
            <li key={r.client_order_no || r.no_everpro || r.awb} className="rounded-2xl bg-white p-3 ring-1 ring-[#E7E8F0] dark:bg-white/5 dark:ring-white/10" data-kiriman data-grup-status={g}>
              <div className="flex flex-wrap items-start gap-2">
                {r.awb && g !== 'batal'
                  ? <input type="checkbox" aria-label={`Pilih ${r.awb}`} className="mt-1 h-5 w-5 sm:h-4 sm:w-4" checked={pilih.has(r.awb)} onChange={() => ganti(r.awb)} />
                  : <span className="w-5 sm:w-4" />}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-sm">
                    <b className="truncate">{r.penerima || '-'}</b>
                    <span className="text-ink-mute">→ {kota(r.tujuan) || '-'}</span>
                    <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1', cls)}>{Ik && <Ik className="h-3 w-3" aria-hidden="true" />}{labelStatus(r.status)}</span>
                    {r.batal_diminta && g !== 'batal' && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200">Pembatalan diminta</span>}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-ink-mute">
                    <span>{String(r.dibuat || '').slice(0, 16)}</span>
                    <span className="inline-flex items-center gap-1">{r.kurir && <LogoKurir nama={r.kurir} ukuran={18} />}{[r.kurir, r.layanan].filter(Boolean).join(' ') || '-'} · {r.jenis === 'DROP' ? 'antar ke agen' : 'dijemput'}{r.jemput && r.jenis !== 'DROP' ? ` ${r.jemput}` : ''}</span>
                    <span>{rupiah(Number(r.harga) || 0)}{r.berat ? ` · ${r.berat} kg` : ''}</span>
                    <span className="truncate">dari {r.pengirim || '-'}</span>
                  </div>
                </div>
                <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto">
                  {r.awb
                    ? <button type="button" onClick={() => salin(r.awb)} className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 font-mono text-[12px] font-bold ring-1 ring-slate-200 hover:ring-brand sm:h-8" title="Salin resi"><Copy className="h-3.5 w-3.5" />{r.awb}</button>
                    : <span className="text-[12px] text-ink-mute">Resi belum terbit</span>}
                  {r.awb && g !== 'batal' && <Button size="sm" variant="outline" onClick={() => (r.label ? window.open(r.label, '_blank', 'noopener') : cetak([r.awb]))} title="Cetak label resi"><Printer className="h-4 w-4" /><span className="sm:sr-only">Label</span></Button>}
                  {(r.awb || r.client_order_no) && <Button size="sm" variant="outline" loading={sibuk === `lacak:${r.awb}`} onClick={() => bukaLacak(r)}><MapPin className="h-4 w-4" />Lacak</Button>}
                  {r.project?.id && <Button size="sm" variant="ghost" onClick={() => go(`projects/${r.project.id}`)} title="Buka project"><ArrowUpRight className="h-4 w-4" />{r.project.invoice_no || 'Project'}</Button>}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
      {hal.page < hal.total_page && <div className="text-center"><Button variant="outline" loading={muat} onClick={() => ambil(hal.page + 1)}>Muat lebih banyak</Button></div>}
      <p className="text-[11px] text-ink-mute">Data langsung dari akun Everpro. Kiriman yang dipesan dari ATLAS tertaut ke project-nya; status project ikut berubah otomatis.</p>

      {lacak && (
        <Sheet open onClose={() => setLacak(null)} title={`Lacak ${lacak.r.awb || lacak.r.client_order_no}`} subtitle={`${lacak.r.penerima || ''} · ${[lacak.r.kurir, lacak.r.layanan].filter(Boolean).join(' ')}`}>
          <Riwayat data={lacak.data} />
        </Sheet>
      )}
    </div>
  )
}
