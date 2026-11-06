import { useState } from 'react'
import { Wallet, Lock } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { can, WORKER_ROLES, APOSTILLE_FUND, pettyAccountsOf } from '../config/access.js'
import { useDashStats, FinanceGroup, PettyStrip, Segment } from './Dashboard.jsx'
import FundSummary from '../components/FundSummary.jsx'
import { Card, Empty, cx } from '../components/ui.jsx'
import Pengajuan from './Pengajuan.jsx'

import { canSeeKeuangan } from '../config/menuAccess.js'
export { canSeeKeuangan }

/** Halaman Keuangan: sumber dana, pengajuan & tagihan, petty cash — satu tempat untuk semua urusan uang. */
export default function Keuangan({ tab }) {
  const { user, pettyBalance, branchFilter } = useApp()
  const s = useDashStats()
  const accounts = pettyAccountsOf(user).filter((k) => k === APOSTILLE_FUND || branchFilter === 'Semua' || k === branchFilter)

  // Satu menu, beberapa tab. Tab yang tidak berhak TIDAK DITAMPILKAN sama
  // sekali — hak aksesnya persis seperti saat menunya masih terpisah.
  const tabs = [
    { key: 'pengajuan', label: 'Pengajuan', boleh: true },
    { key: 'dana', label: 'Sumber Dana', boleh: can.seeFunding(user) },
    { key: 'tagihan', label: 'Tagihan Vendor', boleh: canSeeKeuangan(user) },
    { key: 'petty', label: 'Petty Cash', boleh: canSeeKeuangan(user) && accounts.length > 0 },
  ].filter((t) => t.boleh)

  const awal = tabs.some((t) => t.key === tab) ? tab : tabs[0]?.key
  const [aktif, setAktif] = useState(awal)
  const now = tabs.some((t) => t.key === aktif) ? aktif : tabs[0]?.key

  if (!tabs.length) return <Card><Empty icon={Lock} title="Halaman Keuangan tidak tersedia untuk role Anda" /></Card>

  return (
    <div className="min-w-0 space-y-4">
      <div>
        <h1 className="mb-1 flex items-center gap-2 text-xl font-extrabold leading-tight sm:text-[26px]">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-glow"><Wallet className="h-4 w-4" /></span>Keuangan
        </h1>
        <p className="text-[13px] text-ink-mute">Pengajuan, tagihan vendor, sumber dana, dan petty cash — sesuai hak akses Anda.</p>
      </div>

      {tabs.length > 1 && (
        <div className="-mx-1 flex min-w-0 gap-1 overflow-x-auto px-1 pb-0.5" role="tablist" aria-label="Bagian keuangan">
          {tabs.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={now === t.key}
              onClick={() => setAktif(t.key)}
              className={cx('min-h-[44px] shrink-0 whitespace-nowrap rounded-xl px-3.5 text-sm font-semibold transition',
                now === t.key ? 'bg-ink text-white' : 'bg-white text-ink-soft ring-1 ring-slate-200 hover:ring-brand')}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {now === 'pengajuan' && <Pengajuan />}
      {now === 'dana' && <FundSummary />}
      {now === 'tagihan' && <FinanceGroup s={s} />}
      {now === 'petty' && (
        <Segment title="Petty Cash" action={<a href="#/settings" className="text-xs font-semibold text-brand hover:underline">Catat pengeluaran / top up di Setting → Petty Cash →</a>}>
          <PettyStrip accounts={accounts} balance={pettyBalance} />
        </Segment>
      )}
    </div>
  )
}
