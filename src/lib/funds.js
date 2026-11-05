// Ringkasan per sumber dana (ATS / PTI / PAL / ATI): menunggu transfer & sudah ditransfer.
import { SUMBER_DANA, totalPengajuan, DONE } from '../config/workflows.js'

/** Semua transaksi yang memakai sumber dana: pengajuan vendor, pengajuan umum, tagihan vendor. */
export function fundItems(data) {
  data = { ...data, projects: (data.projects || []).filter((p) => !p.demo_perf) } // tugas contoh tidak dihitung sebagai uang
  const out = []
  for (const p of data.projects || []) for (const s of p.sub_projects || []) {
    const d = s.data || {}
    if (!d.sumber_dana || d.bill_id) continue
    const paid = s.stage === 'dibayar' || (s.stage === DONE && d.paid_at)
    if (s.stage === 'pembayaran' || paid) out.push({ code: d.sumber_dana, amount: totalPengajuan(d), status: paid ? 'transfer' : 'menunggu', date: d.paid_date || d.paid_at?.slice(0, 10) || null, kind: 'Vendor', ref: p.invoice_no })
  }
  for (const r of data.requests || []) {
    if (!r.sumber_dana || !['disetujui', 'dibayar'].includes(r.status)) continue
    out.push({ code: r.sumber_dana, amount: Number(r.amount) || 0, status: r.status === 'dibayar' ? 'transfer' : 'menunggu', date: r.paid_date || null, kind: 'Pengajuan umum', ref: r.purpose })
  }
  for (const b of data.vendor_bills || []) {
    if (!b.sumber_dana || !['disetujui', 'dibayar'].includes(b.status)) continue
    out.push({ code: b.sumber_dana, amount: Number(b.total) || 0, status: b.status === 'dibayar' ? 'transfer' : 'menunggu', date: b.paid_date || null, kind: 'Tagihan vendor', ref: b.period })
  }
  return out
}

/** Per sumber dana: saldo (input Akunting), menunggu transfer, ditransfer (dalam rentang), sisa. */
export function fundSummary(data, { from = '', to = '' } = {}) {
  const items = fundItems(data)
  const inRange = (d) => d && (!from || d >= from) && (!to || d <= to)
  return SUMBER_DANA.map((f) => {
    const mine = items.filter((x) => x.code === f.code)
    const waiting = mine.filter((x) => x.status === 'menunggu')
    const sent = mine.filter((x) => x.status === 'transfer' && inRange(x.date))
    const bal = [...(data.fund_balances || [])].filter((b) => b.code === f.code).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0]
    const waitingSum = waiting.reduce((a, x) => a + x.amount, 0)
    return { ...f, waiting: waitingSum, waitingCount: waiting.length, sent: sent.reduce((a, x) => a + x.amount, 0), sentCount: sent.length,
      balance: bal ? Number(bal.balance) : null, balanceAt: bal?.created_at ?? null, balanceBy: bal?.by ?? '', remaining: bal ? Number(bal.balance) - waitingSum : null }
  })
}
