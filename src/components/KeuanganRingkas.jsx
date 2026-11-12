import { useMemo } from 'react'
import { Check, ArrowLeftRight, AlertTriangle, ChevronRight, Plane, TrendingDown, Wallet } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { Card, cx } from './ui.jsx'
import { can, APOSTILLE_FUND, pettyAccountsOf, pettyLabel, BRANCHES } from '../config/access.js'
import { scopeRequests } from './Requests.jsx'
import { isApprover } from '../lib/badges.js'
import { totalPengajuan } from '../config/workflows.js'
import { fundSummary } from '../lib/funds.js'
import { rupiah } from '../lib/format.js'
import FundSummary from './FundSummary.jsx'

// ============================================================
//  KEUANGAN · RINGKASAN — tampilan awal halaman Keuangan.
//  Perlu Anda (yang butuh keputusan) → angka ringkas → saldo petty cash
//  sebagai bar terhadap batas → (PC) grafik pengeluaran & sumber dana per PT.
// ============================================================

/** Batas (target) saldo tiap kas dan batas minimum sebelum dianggap menipis. */
export const BATAS_KAS = (k) => (k === APOSTILLE_FUND ? 7_000_000 : 1_500_000)
export const MIN_KAS = (k) => (k === APOSTILLE_FUND ? 2_000_000 : 500_000)
const namaKas = (k) => (k === APOSTILLE_FUND ? 'Apostille (Direktur)' : k)

/** Rp 7.850.000 → "7,85 jt"; di bawah 1 jt → "850 rb". */
export const rpPendek = (n) => {
  const v = Math.abs(Number(n) || 0)
  const s = v >= 1e9 ? `${(v / 1e9).toFixed(v % 1e9 ? 2 : 0).replace('.', ',')} M`
    : v >= 1e6 ? `${(v / 1e6).toFixed(v % 1e6 ? (v >= 1e7 ? 1 : 2) : 0).replace(/\.?0+$/, '').replace('.', ',')} jt`
      : v >= 1e3 ? `${Math.round(v / 1e3)} rb` : String(v)
  return `${Number(n) < 0 ? '−' : ''}Rp ${s}`
}

const dk = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar' }).format(new Date(d))

export function useRingkasKeuangan(s) {
  const { user, data, branchFilter, pettyBalance } = useApp()
  return useMemo(() => {
    const req = scopeRequests(user, data.requests || [], branchFilter)
    const menunggu = req.filter((r) => r.status === 'menunggu')
    const transfer = req.filter((r) => r.status === 'disetujui')
    const sum = (rows, f = (r) => Number(r.amount || 0)) => rows.reduce((a, r) => a + f(r), 0)
    const vendorAcc = s?.approvals || []
    const vendorPay = s?.payments || []
    const akun = pettyAccountsOf(user).filter((k) => k === APOSTILLE_FUND || branchFilter === 'Semua' || !branchFilter || k === branchFilter)
    const kas = akun.map((k) => { const saldo = pettyBalance(k); return { k, saldo, batas: BATAS_KAS(k), min: MIN_KAS(k), menipis: saldo < MIN_KAS(k), topup: Math.max(0, BATAS_KAS(k) - saldo) } })
      .sort((a, b) => (b.menipis - a.menipis) || (a.saldo / a.batas) - (b.saldo / b.batas))
    const bulan = dk(new Date()).slice(0, 7)
    const mutasi = (data.petty_cash || []).filter((r) => akun.includes(r.branch) && String(r.date || dk(r.created_at)).startsWith(bulan))
    const keluar = mutasi.filter((r) => r.type === 'out')
    const masuk = mutasi.filter((r) => r.type === 'in')
    const perCabang = {}
    for (const r of keluar) perCabang[r.branch] = (perCabang[r.branch] || 0) + Number(r.amount || 0)
    const perKategori = {}
    for (const r of keluar) { const c = r.project_id ? 'Biaya project' : (r.category || 'Lainnya'); perKategori[c] = (perKategori[c] || 0) + Number(r.amount || 0) }
    const dana = can.seeFunding(user) ? fundSummary(data, { from: `${bulan}-01`, to: dk(new Date()) }) : []
    return {
      menunggu, transfer, vendorAcc, vendorPay,
      nMenunggu: sum(menunggu), nTransfer: sum(transfer), nVendorAcc: sum(vendorAcc, (x) => totalPengajuan(x.data)), nVendorPay: sum(vendorPay, (x) => totalPengajuan(x.data)),
      kas, totalKas: kas.reduce((a, k) => a + k.saldo, 0), menipis: kas.filter((k) => k.menipis),
      keluar: sum(keluar), masuk: sum(masuk), perCabang, perKategori, dana,
      danaTunggu: dana.reduce((a, d) => a + (d.waiting || 0), 0), danaKirim: dana.reduce((a, d) => a + (d.sent || 0), 0),
    }
  }, [user, data, branchFilter, pettyBalance, s])
}

export default function KeuanganRingkas({ s, pilihTab, bukaTopUp }) {
  const { user } = useApp()
  const r = useRingkasKeuangan(s)
  const approver = isApprover(user)
  const bisaBayar = ['superadmin', 'akunting'].includes(user.role)
  const vendorBoleh = can.approveVendor(user) || bisaBayar

  const perlu = [
    approver && r.menunggu.length > 0 && { ic: Check, tone: 'bg-amber-50 text-amber-700', a: `${r.menunggu.length} pengajuan menunggu ACC`, b: ringkasJenis(r.menunggu), n: rpPendek(r.nMenunggu), go: () => pilihTab('pengajuan', 'menunggu') },
    r.transfer.length > 0 && { ic: ArrowLeftRight, tone: 'bg-sky-50 text-sky-700', a: `${r.transfer.length} disetujui, belum ditransfer`, b: [...new Set(r.transfer.map((x) => x.sumber_dana).filter(Boolean))].map((d) => `dana ${d}`).join(' · ') || 'menunggu akunting', n: rpPendek(r.nTransfer), go: () => pilihTab('pengajuan', 'disetujui') },
    vendorBoleh && (r.vendorAcc.length + r.vendorPay.length) > 0 && { ic: AlertTriangle, tone: 'bg-rose-50 text-rose-700', a: `${r.vendorAcc.length + r.vendorPay.length} tagihan vendor perlu ${r.vendorAcc.length ? 'ACC' : 'dibayar'}`, b: `${r.vendorAcc.length} menunggu ACC · ${r.vendorPay.length} perlu dibayar`, n: rpPendek(r.nVendorAcc + r.nVendorPay), go: () => pilihTab('tagihan') },
    ...r.menipis.map((k) => ({ ic: TrendingDown, tone: 'bg-rose-50 text-rose-700', a: `Petty cash ${namaKas(k.k)} menipis`, b: `${rupiah(k.saldo)} · di bawah batas ${rpPendek(k.min)}`, n: 'Top up', merah: true, go: () => (bukaTopUp ? bukaTopUp(k.k, k.topup) : pilihTab('petty')) })),
  ].filter(Boolean)

  const maxCab = Math.max(1, ...Object.values(r.perCabang))
  const urutCab = [APOSTILLE_FUND, ...BRANCHES].filter((b) => r.kas.some((k) => k.k === b))

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start xl:grid-cols-[minmax(0,1fr)_440px]" data-ringkas-keuangan>
      <div className="min-w-0 space-y-3">
        {/* Perlu Anda */}
        <Card className="overflow-hidden p-0" data-perlu-keuangan>
          <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
            <h2 className="flex-1 text-[11px] font-extrabold uppercase tracking-wider text-ink-mute">Perlu Anda hari ini</h2>
            <span className={cx('rounded-full px-2 py-0.5 text-[10.5px] font-bold ring-1', perlu.length ? 'bg-rose-50 text-rose-700 ring-rose-200' : 'bg-emerald-50 text-emerald-700 ring-emerald-200')}>{perlu.length}</span>
          </div>
          {perlu.length === 0 ? <p className="px-4 py-6 text-center text-sm text-ink-mute">Tidak ada yang menunggu keputusan Anda. 🎉</p> : (
            <ul>
              {perlu.map((p, i) => (
                <li key={i} className={cx(i > 0 && 'border-t border-slate-100')}>
                  <button type="button" onClick={p.go} className="flex min-h-[56px] w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50">
                    <span className={cx('grid h-9 w-9 shrink-0 place-items-center rounded-xl', p.tone)}><p.ic className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-bold">{p.a}</span>
                      <span className="block truncate text-[11px] text-ink-mute">{p.b}</span>
                    </span>
                    <span className={cx('shrink-0 text-[13px] font-extrabold tabular-nums', p.merah && 'text-rose-700')}>{p.n}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Angka ringkas */}
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4" data-kpi-keuangan>
          <Kpi k="Petty cash semua" v={rpPendek(r.totalKas)} s={`${r.kas.length} kas${r.menipis.length ? ` · ${r.menipis.length} menipis` : ''}`} />
          <Kpi k="Keluar bulan ini" v={r.keluar ? `−${rpPendek(r.keluar)}` : 'Rp 0'} tone="text-rose-700" s={ringkasKategori(r.perKategori, r.keluar)} />
          {can.seeFunding(user) ? <>
            <Kpi k="Menunggu transfer" v={rpPendek(r.danaTunggu)} tone="text-amber-800" s={r.dana.filter((d) => d.waiting).map((d) => `${d.code} ${rpPendek(d.waiting).replace('Rp ', '')}`).join(' · ') || 'tidak ada antrean'} />
            <Kpi k="Ditransfer bulan ini" v={rpPendek(r.danaKirim)} tone="text-emerald-700" s={`${r.dana.reduce((a, d) => a + (d.sentCount || 0), 0) || ''} pengajuan`.trim()} />
          </> : <>
            <Kpi k="Masuk bulan ini" v={`+${rpPendek(r.masuk)}`} tone="text-emerald-700" s="top up & dana masuk" />
            <Kpi k="Pengajuan aktif" v={r.menunggu.length + r.transfer.length} s={`${r.menunggu.length} menunggu ACC · ${r.transfer.length} menunggu transfer`} />
          </>}
        </div>

        {/* PC: grafik pengeluaran per kas */}
        {r.keluar > 0 && (
          <Card className="hidden overflow-hidden p-0 lg:block" data-grafik-keluar>
            <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
              <h2 className="flex-1 text-[13px] font-extrabold">Pengeluaran petty cash · bulan ini</h2>
              <span className="text-xs font-semibold text-rose-700">−{rupiah(r.keluar)}</span>
            </div>
            <div className="flex items-end gap-3 px-4 pt-4" style={{ height: 130 }}>
              {urutCab.map((b) => {
                const v = r.perCabang[b] || 0
                return (
                  <div key={b} className="flex flex-1 flex-col items-center gap-1 text-[10px] font-semibold text-ink-mute" title={`${namaKas(b)}: ${rupiah(v)}`}>
                    <span className="text-[10.5px] font-bold text-ink">{v ? rpPendek(v).replace('Rp ', '') : '0'}</span>
                    <span className={cx('w-full rounded-t-md', v ? 'bg-[#141B34]' : 'bg-slate-200')} style={{ height: Math.max(2, Math.round((v / maxCab) * 70)) }} />
                    <span className="truncate">{b === APOSTILLE_FUND ? 'Apostille' : b}</span>
                  </div>
                )
              })}
            </div>
            <p className="flex flex-wrap gap-x-3 px-4 py-2.5 text-[11px] text-ink-mute">{Object.entries(r.perKategori).sort((a, b) => b[1] - a[1]).map(([k, v]) => <span key={k}><b className="text-ink">{k}</b> {Math.round((v / r.keluar) * 100)}%</span>)}</p>
          </Card>
        )}
      </div>

      {/* Saldo petty cash vs batas */}
      <div className="min-w-0 space-y-3">
        <Card className="overflow-hidden p-0" data-saldo-kas>
          <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
            <Wallet className="h-4 w-4 text-brand" />
            <h2 className="flex-1 text-[13px] font-extrabold">Saldo petty cash</h2>
            <button type="button" onClick={() => pilihTab('petty')} className="text-[11.5px] font-bold text-brand hover:underline">Semua transaksi →</button>
          </div>
          {r.kas.length === 0 ? <p className="px-4 py-6 text-center text-sm text-ink-mute">Tidak ada kas untuk ditampilkan.</p> : (
            <ul>
              {r.kas.map((k, i) => (
                <li key={k.k} className={cx('flex items-center gap-3 px-3 py-2.5', i > 0 && 'border-t border-slate-100', k.menipis ? 'bg-rose-50' : i % 2 ? 'bg-slate-50/70' : 'bg-white')} data-kas={k.k}>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-[13px] font-bold">{namaKas(k.k)}{k.menipis && <span className="rounded-md bg-rose-100 px-1.5 py-px text-[9.5px] font-bold text-rose-700 ring-1 ring-rose-200">menipis</span>}</p>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
                      <span className={cx('block h-full rounded-full', k.menipis ? 'bg-rose-500' : k.saldo < k.batas * 0.7 ? 'bg-amber-500' : 'bg-emerald-500')} style={{ width: `${Math.min(100, (k.saldo / k.batas) * 100)}%` }} />
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={cx('text-[13px] font-extrabold tabular-nums', k.menipis && 'text-rose-700')}>{rupiah(k.saldo)}</p>
                    <p className="text-[10px] font-semibold text-ink-mute">{k.menipis ? `batas ${rpPendek(k.min)}` : `dari ${rpPendek(k.batas)}`}</p>
                  </div>
                  {k.menipis && bukaTopUp && <button type="button" onClick={() => bukaTopUp(k.k, k.topup)} className="h-9 shrink-0 rounded-xl bg-white px-2.5 text-[11px] font-bold text-rose-700 ring-1 ring-rose-200 hover:ring-rose-400">Top up</button>}
                </li>
              ))}
            </ul>
          )}
          <p className="border-t border-slate-100 px-3 py-2 text-[10.5px] text-ink-mute">Bar = saldo terhadap batas kas (cabang {rpPendek(1_500_000)}, Apostille {rpPendek(7_000_000)}). Merah = di bawah {rpPendek(500_000)} (Apostille {rpPendek(2_000_000)}).</p>
        </Card>
        {can.seeFunding(user) && <div className="hidden lg:block" data-dana-pt><FundSummary /></div>}
      </div>
    </div>
  )
}

function Kpi({ k, v, s, tone }) {
  return (
    <Card className="p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-mute">{k}</p>
      <p className={cx('mt-0.5 text-lg font-extrabold leading-tight lg:text-xl', tone)}>{v}</p>
      <p className="mt-0.5 truncate text-[10.5px] text-ink-mute" title={s}>{s}</p>
    </Card>
  )
}
function ringkasJenis(rows) {
  const m = {}
  for (const r of rows) m[r.kind] = (m[r.kind] || 0) + 1
  const L = { topup: 'top up petty cash', refund: 'refund', lain: 'pengajuan lain' }
  return Object.entries(m).map(([k, n]) => `${n} ${L[k] || k}`).join(' · ')
}
function ringkasKategori(per, total) {
  if (!total) return 'belum ada pengeluaran'
  const top = Object.entries(per).sort((a, b) => b[1] - a[1])[0]
  return top ? `${Math.round((top[1] / total) * 100)}% ${top[0].toLowerCase()}` : ''
}
