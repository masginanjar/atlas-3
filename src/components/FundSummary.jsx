import { useMemo, useState } from 'react'
import { Landmark, ChevronUp, Pencil, Check, X } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { can } from '../config/access.js'
import { fundSummary } from '../lib/funds.js'
import { dayKey, addDays } from '../lib/performance.js'
import { Card, Input, cx } from './ui.jsx'
import { rupiah, tgl, jam } from '../lib/format.js'

/** Ringkasan Sumber Dana (ATS/PTI/PAL/ATI) — hanya Superadmin, Direktur, Akunting. */
/** Ringkas: 2.500.000 → 2,5jt · 350.000 → 0,4jt · 80.000 → 80rb */
const jt = (n) => { const a = Math.abs(n); const sign = n < 0 ? '−' : ''; if (!a) return '0'; if (a < 100000) return `${sign}${Math.round(a / 1000)}rb`; return `${sign}${(a / 1e6).toFixed(1).replace('.', ',').replace(/,0$/, '')}jt` }

export default function FundSummary() {
  const { user, data, save, notify } = useApp()
  const [open, setOpen] = useState(() => { try { return localStorage.getItem('atlas-fold-fund') !== '0' } catch { return true } })
  const toggle = () => setOpen((o) => { try { localStorage.setItem('atlas-fold-fund', o ? '0' : '1') } catch { /* abaikan */ } return !o })
  const today = dayKey(); const monthStart = `${today.slice(0, 8)}01`
  const [range, setRange] = useState({ from: monthStart, to: today })
  const [edit, setEdit] = useState(null) // { code, value }
  const rows = useMemo(() => fundSummary(data, range), [data, range])
  const canEdit = ['superadmin', 'akunting'].includes(user.role)
  const tot = rows.reduce((a, r) => ({ waiting: a.waiting + r.waiting, sent: a.sent + r.sent, balance: a.balance + (r.balance ?? 0) }), { waiting: 0, sent: 0, balance: 0 })
  const saveBal = async () => {
    const v = Number(edit.value); if (!(v >= 0)) return notify('Isi saldo dengan angka', 'err')
    await save('fund_balances', { code: edit.code, balance: v, by: user.name }); notify(`Saldo ${edit.code} diperbarui`); setEdit(null)
  }
  if (!can.seeFunding(user)) return null
  const chip = (on) => cx('rounded-lg px-2.5 py-1 text-xs font-semibold ring-1', on ? 'bg-ink text-white ring-ink' : 'bg-white text-ink-soft ring-slate-200 hover:ring-ink')
  return (
    <Card className="overflow-hidden">
      <div className="card-head flex flex-wrap items-center gap-2 bg-gradient-to-r from-indigo-50 to-cyan-50 px-4 py-3">
        <Landmark className="h-4 w-4 text-ink" />
        <h2 className="font-bold">Sumber Dana</h2>
        <span className="basis-full text-[11px] text-ink-mute sm:basis-auto sm:text-xs">Menunggu transfer <b className="text-ink">{rupiah(tot.waiting)}</b> · Ditransfer <b className="text-ink">{rupiah(tot.sent)}</b></span>
        <button type="button" onClick={toggle} aria-expanded={open} aria-label={`${open ? 'Tutup' : 'Buka'} Sumber Dana`} className="fold ml-auto grid h-8 w-8 place-items-center rounded-lg bg-white text-ink-soft ring-1 ring-slate-200 hover:text-brand"><ChevronUp className={cx('h-4 w-4 transition-transform', !open && 'rotate-180')} /></button>
      </div>
      {!open && (
        <button type="button" onClick={toggle} className="flex w-full flex-wrap items-stretch gap-2 px-4 py-2.5 text-left" aria-label="Ringkasan sumber dana — klik untuk buka">
          {rows.map((r) => (
            <span key={r.code} className="rounded-lg bg-white px-2.5 py-1 ring-1 ring-slate-200" title={`${r.name}: menunggu transfer ${rupiah(r.waiting)}${r.remaining !== null ? ` · sisa ${rupiah(r.remaining)}` : ''}`}>
              <span className="text-[11px] font-black">{r.code}</span> <b className="tabular-nums">{jt(r.waiting)}</b>
              {r.remaining !== null && <span className={cx('ml-1 text-[10px] font-semibold tabular-nums', r.remaining < 0 ? 'text-rose-600' : 'text-emerald-700')}>sisa {jt(r.remaining)}</span>}
            </span>
          ))}
          <span className="rounded-lg bg-ink px-2.5 py-1 text-white"><span className="text-[11px] font-black">TOTAL</span> <b className="tabular-nums">{jt(tot.waiting)}</b>
            {rows.every((r) => r.remaining !== null) && <span className={cx('ml-1 text-[10px] font-semibold tabular-nums', tot.balance - tot.waiting < 0 ? 'text-rose-300' : 'text-emerald-300')}>sisa {jt(tot.balance - tot.waiting)}</span>}</span>
          <span className="self-center text-[11px] text-ink-mute">menunggu transfer</span>
        </button>
      )}
      {open && <>
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 px-4 py-2 text-xs">
          <span className="font-semibold text-ink-mute">Ditransfer:</span>
          <button className={chip(range.from === today && range.to === today)} onClick={() => setRange({ from: today, to: today })}>Hari ini</button>
          <button className={chip(range.from === addDays(today, -6) && range.to === today)} onClick={() => setRange({ from: addDays(today, -6), to: today })}>7 hari</button>
          <button className={chip(range.from === monthStart && range.to === today)} onClick={() => setRange({ from: monthStart, to: today })}>Bulan ini</button>
          <button className={chip(!range.from && !range.to)} onClick={() => setRange({ from: '', to: '' })}>Semua</button>
          <Input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className="!w-36 !py-1 text-xs" aria-label="Dari tanggal" />–
          <Input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className="!w-36 !py-1 text-xs" aria-label="Sampai tanggal" />
        </div>
        {/* HP: kartu per sumber */}
        <ul className="divide-y divide-slate-100 sm:hidden">
          {rows.map((r) => (
            <li key={r.code} className="space-y-1.5 px-3 py-3">
              <div className="flex items-center gap-2"><span className="rounded-md bg-ink px-1.5 py-0.5 text-xs font-bold text-white">{r.code}</span><span className="min-w-0 flex-1 truncate text-xs text-ink-soft">{r.name}</span>
                {canEdit && edit?.code !== r.code && <button onClick={() => setEdit({ code: r.code, value: r.balance ?? '' })} aria-label={`Ubah saldo ${r.code} (HP)`} className="rounded p-1 text-ink-mute hover:bg-slate-100 hover:text-brand"><Pencil className="h-3.5 w-3.5" /></button>}</div>
              {edit?.code === r.code && <div className="flex items-center gap-1"><Input type="number" inputMode="numeric" value={edit.value} onChange={(e) => setEdit({ ...edit, value: e.target.value })} className="!py-1 text-right text-sm" aria-label={`Saldo ${r.code} (HP)`} placeholder="Saldo" />
                <button onClick={saveBal} aria-label="Simpan saldo (HP)" className="rounded p-1 text-emerald-600"><Check className="h-4 w-4" /></button><button onClick={() => setEdit(null)} aria-label="Batal (HP)" className="rounded p-1 text-ink-mute"><X className="h-4 w-4" /></button></div>}
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <dt className="text-ink-mute">Saldo</dt><dd className="text-right font-semibold tabular-nums">{r.balance === null ? '—' : rupiah(r.balance)}</dd>
                <dt className="text-ink-mute">Menunggu transfer</dt><dd className="text-right tabular-nums">{rupiah(r.waiting)} <span className="text-[10px] text-ink-mute">({r.waitingCount})</span></dd>
                <dt className="text-ink-mute">Sisa setelah transfer</dt><dd className={cx('text-right font-bold tabular-nums', r.remaining === null ? 'font-normal text-ink-mute' : r.remaining < 0 ? 'text-rose-600' : 'text-emerald-700')}>{r.remaining === null ? 'isi saldo dulu' : rupiah(r.remaining)}</dd>
                <dt className="text-ink-mute">Ditransfer</dt><dd className="text-right tabular-nums">{rupiah(r.sent)} <span className="text-[10px] text-ink-mute">({r.sentCount})</span></dd>
              </dl>
            </li>
          ))}
          <li className="grid grid-cols-2 gap-x-3 gap-y-1 bg-slate-50 px-3 py-2.5 text-xs font-bold"><span>Total menunggu</span><span className="text-right tabular-nums">{rupiah(tot.waiting)}</span><span>Total ditransfer</span><span className="text-right tabular-nums">{rupiah(tot.sent)}</span></li>
        </ul>
        <div className="hidden overflow-x-auto sm:block"><table className="w-full min-w-[760px] text-sm">
          <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-ink-mute"><tr>
            <th className="px-4 py-2">Sumber</th><th className="px-2 py-2 text-right">Saldo</th><th className="px-2 py-2 text-right">Menunggu transfer</th><th className="px-2 py-2 text-right">Sisa setelah transfer</th><th className="px-4 py-2 text-right">Ditransfer ({range.from || range.to ? 'rentang' : 'semua'})</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{rows.map((r) => (
            <tr key={r.code}>
              <td className="px-4 py-2.5"><span className="mr-2 rounded-md bg-ink px-1.5 py-0.5 text-xs font-bold text-white">{r.code}</span><span className="text-xs text-ink-soft">{r.name}</span></td>
              <td className="px-2 py-2.5 text-right">
                {edit?.code === r.code ? (
                  <span className="inline-flex items-center gap-1"><Input type="number" inputMode="numeric" value={edit.value} onChange={(e) => setEdit({ ...edit, value: e.target.value })} className="!w-36 !py-1 text-right text-xs" aria-label={`Saldo ${r.code}`} autoFocus />
                    <button onClick={saveBal} aria-label="Simpan saldo" className="rounded p-1 text-emerald-600 hover:bg-emerald-50"><Check className="h-4 w-4" /></button><button onClick={() => setEdit(null)} aria-label="Batal" className="rounded p-1 text-ink-mute hover:bg-slate-100"><X className="h-4 w-4" /></button></span>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <span className="tabular-nums" title={r.balanceAt ? `Diperbarui ${jam(r.balanceAt)} oleh ${r.balanceBy}` : 'Belum diisi'}>{r.balance === null ? <span className="text-ink-mute">—</span> : <b>{rupiah(r.balance)}</b>}</span>
                    {canEdit && <button onClick={() => setEdit({ code: r.code, value: r.balance ?? '' })} aria-label={`Ubah saldo ${r.code}`} className="rounded p-1 text-ink-mute hover:bg-slate-100 hover:text-brand"><Pencil className="h-3.5 w-3.5" /></button>}
                  </span>
                )}
                {r.balanceAt && <p className="text-[10px] text-ink-mute">per {tgl(r.balanceAt)}</p>}
              </td>
              <td className="px-2 py-2.5 text-right tabular-nums">{rupiah(r.waiting)}<p className="text-[10px] text-ink-mute">{r.waitingCount} transaksi</p></td>
              <td className={cx('px-2 py-2.5 text-right font-bold tabular-nums', r.remaining !== null && r.remaining < 0 ? 'text-rose-600' : 'text-emerald-700')}>{r.remaining === null ? <span className="font-normal text-ink-mute">isi saldo dulu</span> : rupiah(r.remaining)}{r.remaining !== null && r.remaining < 0 && <p className="text-[10px] font-semibold">Saldo kurang</p>}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{rupiah(r.sent)}<p className="text-[10px] text-ink-mute">{r.sentCount} transaksi</p></td>
            </tr>
          ))}</tbody>
          <tfoot className="border-t border-slate-200 bg-slate-50 text-sm font-bold"><tr><td className="px-4 py-2">Total</td><td className="px-2 py-2 text-right tabular-nums">{rupiah(tot.balance)}</td><td className="px-2 py-2 text-right tabular-nums">{rupiah(tot.waiting)}</td><td className="px-2 py-2 text-right tabular-nums">{rupiah(tot.balance - tot.waiting)}</td><td className="px-4 py-2 text-right tabular-nums">{rupiah(tot.sent)}</td></tr></tfoot>
        </table></div>
        <p className="px-4 py-2 text-[11px] text-ink-mute">Menunggu transfer = pengajuan vendor, pengajuan umum & tagihan vendor yang sudah di-ACC tetapi belum dibayar. Saldo diisi Akunting/Superadmin (tidak terhubung ke bank). Hanya terlihat oleh Superadmin, Direktur & Akunting.</p>
      </>}
    </Card>
  )
}
