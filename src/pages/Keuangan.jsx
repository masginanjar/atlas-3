import { Wallet, Lock } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { can, WORKER_ROLES, APOSTILLE_FUND, pettyAccountsOf } from '../config/access.js'
import { useDashStats, FinanceGroup, PettyStrip, Segment } from './Dashboard.jsx'
import FundSummary from '../components/FundSummary.jsx'
import { Card, Empty } from '../components/ui.jsx'

import { canSeeKeuangan } from '../config/menuAccess.js'
export { canSeeKeuangan }

/** Halaman Keuangan: sumber dana, pengajuan & tagihan, petty cash — satu tempat untuk semua urusan uang. */
export default function Keuangan() {
  const { user, pettyBalance, branchFilter } = useApp()
  const s = useDashStats()
  if (!canSeeKeuangan(user)) return <Card><Empty icon={Lock} title="Halaman Keuangan tidak tersedia untuk role Anda" /></Card>
  const accounts = pettyAccountsOf(user).filter((k) => k === APOSTILLE_FUND || branchFilter === 'Semua' || k === branchFilter)
  return (
    <div className="space-y-7">
      <div>
        <h1 className="mb-1 flex items-center gap-2 text-xl font-extrabold leading-tight sm:text-[26px]"><span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-glow"><Wallet className="h-4 w-4" /></span>Keuangan</h1>
        <p className="text-[13px] text-ink-mute">Pengajuan, tagihan vendor, sumber dana, dan petty cash — sesuai hak akses Anda.</p>
      </div>
      {can.seeFunding(user) && <Segment title="Sumber Dana"><FundSummary /></Segment>}
      <Segment title="Pengajuan & Tagihan"><FinanceGroup s={s} /></Segment>
      {accounts.length > 0 && <Segment title="Petty Cash" action={<a href="#/settings" className="text-xs font-semibold text-brand hover:underline">Catat pengeluaran / top up di Setting → Petty Cash →</a>}><PettyStrip accounts={accounts} balance={pettyBalance} /></Segment>}
    </div>
  )
}
