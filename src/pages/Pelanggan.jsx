import { useMemo, useState } from 'react'
import { Users, Search, X, Building2, Mail, Phone, FolderKanban, Lock } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { Card, Input, Empty, cx } from '../components/ui.jsx'
import { useTabel, Th } from '../components/TabelSortir.jsx'
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
  { key: 'terakhir', label: 'Terakhir', sort: (r) => r.invoiceTerakhir || '' },
]

export default function Pelanggan() {
  const { user, data, branchFilter } = useApp()
  const [q, setQ] = useState('')

  const rows = useMemo(() => {
    const semua = data.projects || []
    const scoped = branchFilter && branchFilter !== 'Semua'
      ? semua.filter((p) => p.branch === branchFilter)
      : semua
    return rangkum(scoped)
  }, [data.projects, branchFilter])

  const cocok = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return rows
    return rows.filter((r) => [r.nama, r.email, r.phone, ...r.cabang].filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(s)))
  }, [rows, q])

  // Sortir dari judul kolom (pencarian memakai kolom cari di atas).
  const { rows: baris, sortKey, sortDir, klikJudul } = useTabel(cocok, KOLOM)

  if (!canSeePelanggan(user)) {
    return <Card><Empty icon={Lock} title="Halaman Pelanggan hanya untuk Superadmin" /></Card>
  }

  const totalProject = rows.reduce((n, r) => n + r.jml, 0)

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4">
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-lg font-bold text-ink"><Users className="h-5 w-5 text-brand" />Pelanggan</h1>
        <p className="text-xs text-ink-soft">
          {rows.length} pelanggan dari {totalProject} project. Dirangkum otomatis dari project — tidak ada data terpisah yang perlu diisi.
        </p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input className="pl-9 pr-9" placeholder="Cari nama, email, telepon, cabang…" value={q}
          onChange={(e) => setQ(e.target.value)} aria-label="Cari pelanggan" />
        {q && (
          <button type="button" onClick={() => setQ('')} aria-label="Hapus pencarian"
            className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-ink-mute hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {!baris.length ? (
        <Empty icon={Users} title="Tidak ada pelanggan" text={q ? 'Coba kata kunci lain.' : 'Belum ada project yang tercatat.'} />
      ) : (
        <Card className="overflow-hidden">
          <div className="md:overflow-x-auto">
            <table className="card-table w-full text-sm">
              <thead>
                <tr>
                  {KOLOM.map((c) => <Th key={c.key} kolom={c} sortKey={sortKey} sortDir={sortDir} onKlik={klikJudul} />)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {baris.map((r) => (
                  <tr key={r.kunci} className="align-top">
                    <td data-label="Pelanggan" className="px-3 py-2">
                      <span className="block font-semibold text-ink">{r.nama}</span>
                      {r.nilai > 0 && <span className="block text-[11px] text-ink-mute">{rupiah(r.nilai)}</span>}
                    </td>
                    <td data-label="Kontak" className="px-3 py-2 text-xs text-ink-soft">
                      {r.email && <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 shrink-0 text-ink-mute" /><span className="min-w-0 truncate">{r.email}</span></span>}
                      {r.phone && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 shrink-0 text-ink-mute" />{r.phone}</span>}
                      {!r.email && !r.phone && <span className="text-ink-mute">—</span>}
                    </td>
                    <td data-label="Cabang" className="px-3 py-2 text-xs">
                      <span className="flex flex-wrap items-center gap-1">
                        {r.cabang.map((b) => (
                          <span key={b} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
                            <Building2 className="h-3 w-3" />{b}
                          </span>
                        ))}
                      </span>
                    </td>
                    <td data-label="Project" className="px-3 py-2 text-right">
                      <span className={cx('text-base font-bold tabular-nums', r.jml > 1 ? 'text-brand' : 'text-ink')}>{r.jml}</span>
                    </td>
                    <td data-label="Terakhir" className="px-3 py-2 text-xs">
                      {r.idTerakhir ? (
                        <button type="button" onClick={() => go(`projects/${r.idTerakhir}`)}
                          className="inline-flex items-center gap-1.5 font-semibold text-brand hover:underline">
                          <FolderKanban className="h-3.5 w-3.5" />{invoiceLabel(r.invoiceTerakhir)}
                        </button>
                      ) : <span className="text-ink-mute">—</span>}
                      {r.terakhir && <span className="block text-ink-mute">{tanggal(r.terakhir)}</span>}
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
