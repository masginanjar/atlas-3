import { useMemo, useState } from 'react'
import { Landmark, Download, Send, Wallet, Flag, CheckCircle2, Clock3, Hourglass, BadgeCheck } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { drive } from '../lib/integrations.js'
import { saveBlob } from '../lib/download.js'
import { totalPengajuan, SUMBER_DANA, sumberLabel, recommendFund } from '../config/workflows.js'
import { can } from '../config/access.js'
import { fundSummary } from '../lib/funds.js'
import { Button, cx } from './ui.jsx'
import { rupiah, tgl, jam } from '../lib/format.js'
import { DONE } from '../config/workflows.js'

export const accountLabel = (a) => (a ? `${a.bank} · ${a.number} · a.n. ${a.holder}` : '—')

const STATUS = {
  pengajuan: { label: 'Draft Pengajuan', icon: Clock3, cls: 'bg-slate-100 text-slate-700 ring-slate-300' },
  persetujuan: { label: 'Menunggu Persetujuan', icon: Hourglass, cls: 'bg-amber-50 text-amber-800 ring-amber-300' },
  pembayaran: { label: 'Disetujui — Menunggu Pembayaran', icon: BadgeCheck, cls: 'bg-sky-50 text-sky-800 ring-sky-300' },
  dibayar: { label: 'Sudah Dibayar', icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-800 ring-emerald-300' },
  selesai: { label: 'Selesai', icon: CheckCircle2, cls: 'bg-slate-800 text-white ring-slate-800' },
}
/** Badge status pengajuan vendor (ikon + teks, bukan hanya warna). */
export function PengajuanStatus({ stage, className }) {
  const s = STATUS[stage] ?? STATUS.pengajuan
  return <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1', s.cls, className)}><s.icon className="h-3 w-3" />{s.label}</span>
}

/** Tombol unduh bukti transfer (untuk dikirim ke vendor). */
export function DownloadBukti({ file, size = 'sm', variant = 'outline', label = 'Bukti Transfer' }) {
  const { notify } = useApp()
  const [busy, setBusy] = useState(false)
  if (!file) return null
  return (
    <Button size={size} variant={variant} loading={busy} onClick={async () => {
      setBusy(true)
      try { await saveBlob(file.name, await drive.blob(file)) } catch (e) { notify(e.message, 'err') } finally { setBusy(false) }
    }}>{!busy && <Download className="h-3.5 w-3.5" />}Download {label}</Button>
  )
}

/** Rincian pengajuan pembayaran vendor. */
export function PengajuanSummary({ sub, className }) {
  const { data, user } = useApp()
  const d = sub.data || {}
  const vendor = data.people.find((p) => p.id === d.vendor)
  const rows = [
    ['Vendor', vendor?.name ?? '—'],
    ['Layanan', d.vendor_service ? `${d.vendor_service}` : '—', rupiah(d.vendor_cost)],
    ['Ongkir', d.ongkir_to || 'Tanpa ongkir', rupiah(d.ongkir_cost)],
  ]
  return (
    <div className={cx('rounded-xl bg-white p-3 ring-1 ring-slate-200', className)}>
      <dl className="space-y-1.5 text-sm">
        {rows.map(([k, v, amt]) => (
          <div key={k} className="flex items-baseline gap-2">
            <dt className="w-16 shrink-0 text-xs font-semibold text-ink-mute">{k}</dt>
            <dd className="min-w-0 flex-1 truncate">{v}</dd>
            {amt && <dd className="shrink-0 tabular-nums text-ink-soft">{amt}</dd>}
          </div>
        ))}
        <div className="flex items-baseline gap-2 border-t border-dashed border-slate-200 pt-1.5">
          <dt className="flex-1 text-xs font-bold uppercase tracking-wide text-ink">Total Pengajuan</dt>
          <dd className="text-base font-extrabold tabular-nums text-ink">{rupiah(totalPengajuan(d))}</dd>
        </div>
        {d.sumber_dana && can.seeFunding(user) && <div className="flex gap-2 text-xs"><dt className="w-16 shrink-0 font-semibold text-ink-mute">Sumber</dt><dd className="min-w-0 flex-1 font-semibold text-ink">{sumberLabel(d.sumber_dana)}</dd></div>}
        {d.rekening && <div className="flex gap-2 text-xs"><dt className="w-16 shrink-0 font-semibold text-ink-mute">Penerima</dt><dd className="min-w-0 flex-1">{accountLabel(d.rekening)}</dd></div>}
        {d.paid_date && <div className="flex gap-2 text-xs"><dt className="w-16 shrink-0 font-semibold text-ink-mute">Dibayar</dt><dd>{tgl(d.paid_date)}</dd></div>}
        {d.vendor_note && <p className="pt-1 text-xs text-ink-mute">Catatan: {d.vendor_note}</p>}
      </dl>
    </div>
  )
}

/** Pilihan sumber dana (rekening perusahaan) — dipilih Direktur saat ACC. */
/** Tombol ACC satu klik dengan rekening rekomendasi (sesuai cabang) + tombol Ganti untuk memilih manual. */
export function QuickAcc({ branch, onAcc, onPick, busy, label = 'ACC' }) {
  const rec = recommendFund(branch)
  return (
    <span className="inline-flex items-center gap-1.5">
      <Button size="sm" loading={busy} onClick={() => onAcc(rec)} title={`Rekomendasi ${sumberLabel(rec)} (cabang ${branch || '—'})`}><CheckCircle2 className="h-3.5 w-3.5" />{label} · {rec}</Button>
      <Button size="sm" variant="outline" onClick={() => onPick(rec)} title="Pilih rekening lain">Ganti</Button>
    </span>
  )
}

export function SumberDanaPicker({ value, onChange, className, recommended }) {
  const { data } = useApp()
  const sum = useMemo(() => Object.fromEntries(fundSummary(data).map((r) => [r.code, r])), [data])
  return (
    <div role="radiogroup" aria-label="Sumber dana" className={cx('grid grid-cols-2 gap-2 sm:grid-cols-4', className)}>
      {SUMBER_DANA.map((d) => {
        const on = value === d.code
        return (
          <button key={d.code} type="button" role="radio" aria-checked={on} onClick={() => onChange(d.code)} title={d.name}
            className={cx('flex flex-col items-start rounded-xl px-3 py-2 text-left ring-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
              on ? 'bg-brand text-white ring-brand' : 'bg-white text-ink ring-slate-300 hover:ring-brand')}>
            <span className="flex items-center gap-1.5 text-sm font-bold"><Landmark className="h-3.5 w-3.5" />{d.code}{on && <CheckCircle2 className="h-3.5 w-3.5" />}{recommended === d.code && <span className={cx('rounded-full px-1.5 text-[9px] font-bold uppercase', on ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700')}>Rekomendasi</span>}</span>
            <span className={cx('text-[10px] leading-tight', on ? 'text-white/80' : 'text-ink-mute')}>{d.name}</span>
            <span className={cx('mt-1 text-[10px] font-semibold leading-tight', on ? 'text-white' : sum[d.code]?.remaining < 0 ? 'text-rose-600' : 'text-ink-soft')}>
              Menunggu {rupiah(sum[d.code]?.waiting || 0)}{sum[d.code]?.remaining !== null && sum[d.code]?.remaining !== undefined ? ` · Sisa ${rupiah(sum[d.code].remaining)}` : ''}
            </span>
          </button>
        )
      })}
    </div>
  )
}

const STEPS = [
  { key: 'submitted', label: 'Diajukan', icon: Send, done: (st) => st !== 'pengajuan' },
  { key: 'approved', label: 'Disetujui', icon: BadgeCheck, done: (st) => ['pembayaran', 'dibayar', DONE].includes(st) },
  { key: 'paid', label: 'Dibayar', icon: Wallet, done: (st) => ['dibayar', DONE].includes(st) },
  { key: 'closed', label: 'Selesai', icon: Flag, done: (st) => st === DONE },
]
/** Progres pengajuan vendor: Diajukan → Disetujui → Dibayar → Selesai (dengan nama & waktu). */
export function PengajuanTracker({ sub, compact, className }) {
  const d = sub.data || {}
  const current = STEPS.findIndex((x) => !x.done(sub.stage))
  if (compact) {
    // versi ringkas satu baris: Diajukan ✓ → Disetujui ● → Dibayar → Selesai
    return (
      <ol className={cx('flex flex-wrap items-center gap-1 text-[11px]', className)} aria-label="Progres pengajuan">
        {STEPS.map((x, i) => {
          const done = x.done(sub.stage); const now = i === current
          const who = d[`${x.key}_name`]; const at = d[`${x.key}_at`]
          return (
            <li key={x.key} className="flex items-center gap-1" title={done && (who || at) ? `${who || ''}${at ? ` · ${jam(at)}` : ''}` : undefined}>
              <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ring-1',
                done ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : now ? 'bg-brand-soft text-brand ring-brand/30' : 'bg-white text-ink-mute ring-slate-200')}>
                {done ? <CheckCircle2 className="h-3 w-3" /> : now ? <span className="h-1.5 w-1.5 rounded-full bg-brand" /> : null}{x.label}
              </span>
              {i < STEPS.length - 1 && <span className={cx('h-px w-3', done ? 'bg-emerald-400' : 'bg-slate-200')} />}
            </li>
          )
        })}
      </ol>
    )
  }
  return (
    <ol className={cx('flex items-start', className)} aria-label="Progres pengajuan">
      {STEPS.map((x, i) => {
        const done = x.done(sub.stage); const now = i === current
        const who = d[`${x.key}_name`]; const at = d[`${x.key}_at`]
        return (
          <li key={x.key} className="flex min-w-0 flex-1 flex-col items-center text-center">
            <div className="flex w-full items-center">
              <span className={cx('h-0.5 flex-1', i === 0 ? 'bg-transparent' : done || now ? 'bg-emerald-400' : 'bg-slate-200')} />
              <span className={cx('grid h-7 w-7 shrink-0 place-items-center rounded-full ring-2',
                done ? 'bg-emerald-500 text-white ring-emerald-500' : now ? 'bg-white text-brand ring-brand' : 'bg-white text-slate-300 ring-slate-200')}>
                {done ? <CheckCircle2 className="h-4 w-4" /> : <x.icon className="h-3.5 w-3.5" />}
              </span>
              <span className={cx('h-0.5 flex-1', i === STEPS.length - 1 ? 'bg-transparent' : done ? 'bg-emerald-400' : 'bg-slate-200')} />
            </div>
            <span className={cx('mt-1 text-[11px] font-semibold', done ? 'text-emerald-700' : now ? 'text-brand' : 'text-ink-mute')}>{x.label}{now && !done ? ' …' : ''}</span>
            {!compact && done && (who || at) && <span className="w-full truncate px-0.5 text-[10px] text-ink-mute">{who}{at ? ` · ${jam(at)}` : ''}</span>}
          </li>
        )
      })}
    </ol>
  )
}
