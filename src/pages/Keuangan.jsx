import { useEffect, useState, lazy, Suspense } from 'react'
import { Wallet, Lock, Plus, ArrowUpRight, ArrowDownLeft, FilePlus2, ChevronDown, Images, Download } from 'lucide-react'
import { useApp } from '../lib/store.jsx'
import { can, APOSTILLE_FUND, pettyAccountsOf } from '../config/access.js'
import { useDashStats, FinanceGroup } from './Dashboard.jsx'
import { PettyCash } from './Settings.jsx'
import FundSummary from '../components/FundSummary.jsx'
import KeuanganRingkas from '../components/KeuanganRingkas.jsx'
import { Card, Empty, Button, Sheet, Popover, cx } from '../components/ui.jsx'
import { usePanel } from '../components/WorkspacePanel.jsx'
import { MapTabs, SubTabProvider, useSubTabHost } from '../components/SubTab.jsx'
import { needsAction } from '../lib/badges.js'
import Pengajuan from './Pengajuan.jsx'

import { KeAtas, KELAS_PLUS } from '../components/SlotAtas.jsx'
import { canSeeKeuangan } from '../config/menuAccess.js'
import UnduhData, { canUnduhData } from '../components/UnduhData.jsx'
const BuktiMassal = lazy(() => import('../components/BuktiMassal.jsx'))
export { canSeeKeuangan }

/**
 * Halaman Keuangan — tampilan awal Ringkasan (apa yang perlu diputuskan +
 * saldo kas vs batas), lalu tab rincian. Tab memakai pola "map bertingkat":
 * saringan milik tab aktif tampil di panel yang menyatu dengan tabnya.
 */
export default function Keuangan({ tab }) {
  const { user, data, branchFilter } = useApp()
  const { open } = usePanel()
  const s = useDashStats()
  const accounts = pettyAccountsOf(user).filter((k) => k === APOSTILLE_FUND || branchFilter === 'Semua' || k === branchFilter)
  const host = useSubTabHost()
  const [sheet, setSheet] = useState(false)
  const [massal, setMassal] = useState(false)
  const [unduh, setUnduh] = useState(false)
  const [sub, setSub] = useState(null)        // sub-tab awal yang diminta (mis. dari Perlu Anda)
  const [intent, setIntent] = useState(null)  // { jenis: 'in'|'out', kas, nominal } → dibuka PettyCash

  const nPengajuan = needsAction(user, data, branchFilter)
  const nTagihan = (can.approveVendor(user) ? s.approvals.length : 0) + (['superadmin', 'akunting'].includes(user.role) ? s.payments.length : 0)
  const tabs = [
    { key: 'ringkasan', label: 'Ringkasan', boleh: true },
    { key: 'pengajuan', label: 'Pengajuan', boleh: true, n: nPengajuan },
    { key: 'petty', label: 'Petty Cash', boleh: canSeeKeuangan(user) && accounts.length > 0 },
    { key: 'tagihan', label: 'Tagihan Vendor', boleh: canSeeKeuangan(user), n: nTagihan },
    { key: 'dana', label: 'Sumber Dana', boleh: can.seeFunding(user) },
  ].filter((t) => t.boleh)

  const awal = tabs.some((t) => t.key === tab) ? tab : 'ringkasan'
  const [aktif, setAktif] = useState(awal)
  useEffect(() => { if (tab && tabs.some((t) => t.key === tab)) setAktif(tab) }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps
  const now = tabs.some((t) => t.key === aktif) ? aktif : 'ringkasan'
  const pilih = (k, subAwal = null) => { setSub(subAwal); setAktif(k); if (window.location.hash !== `#/keuangan/${k}`) window.history.replaceState(null, '', `#/keuangan/${k}`) }

  const bisaCatat = canSeeKeuangan(user) && accounts.length > 0
  const bisaTopUp = bisaCatat && can.topUpPettyCash(user)
  const bisaAjukan = !['penerjemah', 'proofreader', 'otorisator', 'staf_apostille'].includes(user.role)
  const buka = (jenis, kas, nominal) => {
    setSheet(false)
    if (jenis === 'ajukan') return open('pengajuan')
    if (jenis === 'unduh') return setUnduh(true)
    if (jenis === 'massal') { pilih('pengajuan', 'disetujui'); return setMassal(true) }
    setIntent({ jenis, kas, nominal, t: Date.now() }); pilih('petty')
  }
  const opsi = [
    bisaCatat && ['out', 'Pengeluaran / dana keluar', 'Biaya project, operasional, kurir…', ArrowUpRight, 'bg-rose-50 text-rose-700'],
    bisaTopUp && ['in', 'Top up / dana masuk', 'Isi saldo petty cash dari PT', ArrowDownLeft, 'bg-emerald-50 text-emerald-700'],
    ['superadmin', 'akunting'].includes(user.role) && ['massal', 'Upload Bukti Transfer Massal', 'Screenshot internet banking → bukti tiap pengajuan', Images, 'bg-sky-50 text-sky-700'],
    canUnduhData(user) && ['unduh', 'Unduh Excel', 'Pengajuan, petty cash & tagihan vendor', Download, 'bg-emerald-50 text-emerald-700'],
    bisaAjukan && ['ajukan', 'Pengajuan baru', 'Minta ACC Direktur: top up, refund, biaya lain', FilePlus2, 'bg-amber-50 text-amber-800'],
  ].filter(Boolean)

  if (!tabs.length) return <Card><Empty icon={Lock} title="Halaman Keuangan tidak tersedia untuk role Anda" /></Card>

  const tombolTambah = opsi.length > 0 && (
    <>
      <button type="button" onClick={() => setSheet(true)} aria-label="Catat / ajukan" data-aksi="tambah-keuangan"
        className={cx(KELAS_PLUS, 'sm:hidden')}><Plus className="h-[17px] w-[17px]" /></button>
      <div className="hidden sm:block">
        <Popover label="Catat / ajukan" width="min-w-[280px]" button={({ toggle, open: o }) => (
          <button type="button" className={KELAS_PLUS} onClick={toggle} aria-expanded={o} aria-haspopup="menu" aria-label="Buat… (catat / ajukan)" title="Buat… (catat / ajukan)" data-aksi="tambah-keuangan"><Plus className="h-[17px] w-[17px]" aria-hidden="true" /></button>
        )}>
          {({ close }) => <MenuCatat opsi={opsi} onPilih={(j) => { close(); buka(j) }} />}
        </Popover>
      </div>
    </>
  )

  return (
    <div className="min-w-0 space-y-3">
      <div className="sr-only" data-alat>
        <h1 className="text-[17px] font-extrabold leading-tight tracking-tight flex items-center gap-2">
          Keuangan
        </h1>
        <KeAtas slot="tambah"><div className="flex items-center gap-1.5">{tombolTambah}</div></KeAtas>
      </div>

      <SubTabProvider value={host.ctx}>
        <MapTabs tabs={tabs} aktif={now} onPilih={pilih} ada={host.ada} setPanelEl={host.setEl} label="Bagian keuangan" />
        <div data-isi-keuangan={now}>
          {now === 'ringkasan' && <KeuanganRingkas s={s} pilihTab={pilih} bukaTopUp={bisaTopUp ? (kas, nominal) => buka('in', kas, nominal) : null} />}
          {now === 'pengajuan' && <Pengajuan subAwal={sub} />}
          {now === 'dana' && <FundSummary />}
          {now === 'tagihan' && <FinanceGroup s={s} subtab />}
          {now === 'petty' && <div data-petty-penuh><PettyCash intent={intent} onIntentDone={() => setIntent(null)} /></div>}
        </div>
      </SubTabProvider>

      <UnduhData buka={unduh} onClose={() => setUnduh(false)} awal={['pengajuan', 'kas', 'tagihan']} />
      {massal && <Suspense fallback={null}><BuktiMassal open onClose={() => setMassal(false)} /></Suspense>}
      <Sheet open={sheet} onClose={() => setSheet(false)} title="Catat / ajukan">
        <MenuCatat opsi={opsi} onPilih={buka} besar />
      </Sheet>
    </div>
  )
}

function MenuCatat({ opsi, onPilih, besar }) {
  return (
    <ul className={cx('space-y-1.5', besar && 'pb-2')}>
      {opsi.map(([k, l, ket, Icon, tone]) => (
        <li key={k}>
          <button type="button" onClick={() => onPilih(k)} data-catat={k}
            className={cx('flex w-full items-center gap-3 rounded-xl px-3 text-left ring-1 ring-slate-200 hover:ring-brand', besar ? 'min-h-[56px] py-2' : 'min-h-[44px] py-1.5')}>
            <span className={cx('grid h-9 w-9 shrink-0 place-items-center rounded-lg', tone)}><Icon className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-ink">{l}</span><span className="block text-xs text-ink-mute">{ket}</span></span>
          </button>
        </li>
      ))}
    </ul>
  )
}
