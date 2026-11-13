import { useMemo, useState } from 'react'
import { Users, Building2, Mail, Phone, FolderKanban, Lock } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { Card, Empty, cx } from '../components/ui.jsx'
import { useTabel, Th, CariTabel } from '../components/TabelSortir.jsx'
import { invoiceLabel, rolesOf } from '../config/access.js'
import { tanggal } from '../lib/waktu.js'
import { go } from '../lib/router.js'

// ============================================================
//  PELANGGAN — daftar pelanggan yang dirangkum dari project.
//  Tidak ada data baru yang disimpan: semuanya dibaca dari project
//  yang sudah ada, jadi angkanya selalu mengikuti data sebenarnya.
//  Hanya Superadmin yang boleh membukanya.
// ============================================================

export const canSeePelanggan = (u) => rolesOf(u).includes('superadmin')

const rupiah = (n) => (Number(n) || 0).toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })

/** Satu baris per pelanggan, dirangkum dari seluruh project miliknya. */
function rangkum(projects) {
  const peta = new Map()
  for (const p of projects || []) {
    const c = p.customer
    const nama = (c?.name || '').trim()
    if (!nama) continue
    const kunci = c?.zoho_id || nama.toLowerCase()
    if (!peta.has(kunci)) {
      peta.set(kunci, {
        kunci, nama, zoho_id: c?.zoho_id || '',
        email: c?.email || '', phone: c?.ship?.phone || c?.phone || '',
        cabang: new Set(), jml: 0, nilai: 0, terakhir: '', invoiceTerakhir: '', idTerakhir: '',
      })
    }
    const r = peta.get(kunci)
    if (!r.email && c?.email) r.email = c.email
    if (!r.phone && (c?.ship?.phone || c?.phone)) r.phone = c.ship?.phone || c.phone
    if (p.branch) r.cabang.add(p.branch)
    r.jml += 1
    r.nilai += Number(p.about?.total) || Number(p.total) || 0
    const at = p.created_at || ''
    if (at > r.terakhir) { r.terakhir = at; r.invoiceTerakhir = p.invoice_no || ''; r.idTerakhir = p.id }
  }
  return [...peta.values()]
    .map((r) => ({ ...r, cabang: [...r.cabang].sort() }))
    .sort((a, b) => b.jml - a.jml || a.nama.localeCompare(b.nama))
}

/** Kolom tabel Pelanggan — semua judul bisa diklik untuk mengurutkan. */
const KOLOM = [
  { key: 'nama', label: 'Pelanggan', sort: (r) => r.nama.toLowerCase() },
  { key: 'kontak', label: 'Kontak', sort: (r) => `${r.email || ''} ${r.phone || ''}`.trim().toLowerCase() },
  { key: 'cabang', label: 'Cabang', sort: (r) => r.cabang.join(', ').toLowerCase() },
  { key: 'jml', label: 'Project', num: true, sort: (r) => r.jml },
  { key: 'nilai', label: 'Nilai', num: true, sort: (r) => r.nilai || 0 },
  { key: 'terakhir', label: 'Terakhir', sort: (r) => r.invoiceTerakhir || '' },
]

export default function Pelanggan() {
  const { user, data, branchFilter } = useApp()
  const [q, setQ] = useState('')
  const [fCabang, setFCabang] = useState('')

  const rows = useMemo(() => {
    const semua = data.projects || []
    const scoped = branchFilter && branchFilter !== 'Semua'
      ? semua.filter((p) => p.branch === branchFilter)
      : semua
    return rangkum(scoped)
  }, [data.projects, branchFilter])

  const cabangAda = useMemo(
    () => [...new Set(rows.flatMap((r) => r.cabang))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'id')),
    [rows],
  )
  const cocok = useMemo(() => {
    const s = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (fCabang && !r.cabang.includes(fCabang)) return false
      if (!s) return true
      return [r.nama, r.email, r.phone, ...r.cabang].filter(Boolean).some((v) => String(v).toLowerCase().includes(s))
    })
  }, [rows, q, fCabang])

  // Sortir dari judul kolom (pencarian memakai kolom cari di atas).
  const { rows: baris, sortKey, sortDir, klikJudul } = useTabel(cocok, KOLOM)

  if (!canSeePelanggan(user)) {
    return <Card><Empty icon={Lock} title="Halaman Pelanggan hanya untuk Superadmin" /></Card>
  }

  const totalProject = rows.reduce((n, r) => n + r.jml, 0)

  return (
    <div className="w-full space-y-3">
      {/* Baris 2 ringkas: judul · jumlah · filter cabang */}
      <div className="flex flex-wrap items-center gap-2" data-baris-dua>
        <h1 className="text-[17px] font-extrabold leading-tight tracking-tight" title="Dirangkum otomatis dari project — tidak ada data terpisah yang perlu diisi.">Pelanggan <span className="text-[13px] font-semibold text-[#5E6380]">· {baris.length} dari {rows.length} ({totalProject} project)</span></h1>
        <CariTabel atas value={q} onChange={setQ} label="Cari nama, email, telepon, cabang…" />
        <select value={fCabang} onChange={(e) => setFCabang(e.target.value)} aria-label="Filter cabang"
          className="h-11 w-auto max-w-full rounded-[10px] border-0 bg-white pl-2.5 pr-7 text-[13px] font-semibold text-ink ring-1 ring-[#D9DBE7] focus:outline-none focus:ring-2 focus:ring-brand md:h-8">
          <option value="">Semua cabang</option>
          {cabangAda.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>

      {!baris.length ? (
        <Empty icon={Users} title="Tidak ada pelanggan" text={q ? 'Coba kata kunci lain.' : 'Belum ada project yang tercatat.'} />
      ) : (
        <Card className="overflow-hidden">
          <div className="min-w-0 max-w-full overflow-x-auto">
            <table className="tbl-rapat" style={{ minWidth: '760px' }}>
              <thead>
                <tr>
                  {KOLOM.map((c) => <Th key={c.key} kolom={c} sortKey={sortKey} sortDir={sortDir} onKlik={klikJudul} />)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {baris.map((r) => (
                  <tr key={r.kunci}>
                    <td><span className="block max-w-[260px] truncate font-semibold text-ink" title={r.nama}>{r.nama}</span></td>
                    <td className="text-[12px] text-ink-soft">
                      {r.email || r.phone ? (
                        <span className="flex max-w-[240px] items-center gap-1.5">
                          {r.email ? <Mail className="h-3.5 w-3.5 shrink-0 text-ink-mute" /> : <Phone className="h-3.5 w-3.5 shrink-0 text-ink-mute" />}
                          <span className="min-w-0 truncate" title={[r.email, r.phone].filter(Boolean).join(' · ')}>{[r.email, r.phone].filter(Boolean).join(' · ')}</span>
                        </span>
                      ) : <span className="text-ink-mute">—</span>}
                    </td>
                    <td className="text-[12px]">
                      <span className="flex max-w-[200px] items-center gap-1 whitespace-nowrap" title={r.cabang.join(', ')}>
                        <Building2 className="h-3 w-3 shrink-0 text-ink-mute" />
                        <span className="min-w-0 truncate text-ink-soft">{r.cabang.join(', ') || '—'}</span>
                      </span>
                    </td>
                    <td className="num">
                      <span className={cx('text-[14px] font-bold', r.jml > 1 ? 'text-brand' : 'text-ink')}>{r.jml}</span>
                    </td>
                    <td className="num text-[12px] text-ink-soft">{r.nilai > 0 ? rupiah(r.nilai) : '—'}</td>
                    <td className="text-[12px]">
                      {r.idTerakhir ? (
                        <button type="button" onClick={() => go(`projects/${r.idTerakhir}`)} title={r.terakhir ? `Project terakhir · ${tanggal(r.terakhir)}` : 'Project terakhir'}
                          className="inline-flex items-center gap-1.5 whitespace-nowrap font-semibold text-brand hover:underline">
                          <FolderKanban className="h-3.5 w-3.5 shrink-0" />{invoiceLabel(r.invoiceTerakhir)}
                          {r.terakhir && <span className="font-normal text-ink-mute">· {tanggal(r.terakhir)}</span>}
                        </button>
                      ) : <span className="text-ink-mute">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <p className="text-[11px] text-ink-mute">
        Daftar ini mengikuti filter cabang di header. Nama, email, dan telepon berasal dari data project —
        mengubahnya dilakukan di project yang bersangkutan, bukan di sini.
      </p>
    </div>
  )
}
